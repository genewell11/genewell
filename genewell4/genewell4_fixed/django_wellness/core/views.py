"""
Views for Genewell wellness quiz submission, PDF download, and Instamojo payment.
"""
import json
import requests
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import UserProfile, PremiumAddOn
from .pdf_generator import generate_wellness_pdf


def quiz_view(request):
    """Render the wellness quiz form."""
    addons = PremiumAddOn.objects.filter(is_active=True)
    return render(request, 'core/quiz.html', {'addons': addons})


def quiz_submit(request):
    """
    POST: Validate and save quiz data → generate PDF → return as download.
    """
    if request.method != 'POST':
        return redirect('quiz')

    data = request.POST

    # Parse JSON / list fields (comma-separated from form)
    def parse_list(field):
        raw = data.get(field, '')
        if not raw:
            return []
        try:
            return json.loads(raw)
        except Exception:
            return [x.strip() for x in raw.split(',') if x.strip()]

    try:
        user = UserProfile(
            name=data.get('name', '').strip(),
            email=data.get('email', '').strip(),
            phone=data.get('phone', '').strip(),
            age=int(data.get('age', 25)),
            gender=data.get('gender', 'female'),
            location=data.get('location', '').strip(),
            language=data.get('language', 'english'),
            height_cm=float(data.get('height_cm', 165)),
            weight_kg=float(data.get('weight_kg', 65)),
            activity_level=data.get('activity_level', 'moderate'),
            work_schedule=data.get('work_schedule', ''),
            sleep_hours=float(data.get('sleep_hours', 7)),
            wake_up_time=data.get('wake_up_time', ''),
            tired_time=data.get('tired_time', ''),
            stress_level=data.get('stress_level', 'moderate'),
            energy_levels=data.get('energy_levels', 'moderate'),
            mood_patterns=data.get('mood_patterns', ''),
            exercise_preference=data.get('exercise_preference', ''),
            weight_goal=data.get('weight_goal', 'maintain'),
            meals_per_day=int(data.get('meals_per_day', 3)),
            eating_out=data.get('eating_out', ''),
            cravings=data.get('cravings', ''),
            hunger_frequency=data.get('hunger_frequency', ''),
            hydration_habits=data.get('hydration_habits', ''),
            food_intolerances=parse_list('food_intolerances'),
            supplement_usage=data.get('supplement_usage', ''),
            digestive_issues=data.get('digestive_issues', ''),
            skin_concerns=data.get('skin_concerns', ''),
            medical_conditions=parse_list('medical_conditions'),
            bleeding_frequency=data.get('bleeding_frequency', ''),
            plan_type=data.get('plan_type', 'free'),
            purchased_addons=parse_list('purchased_addons'),
        )
        # Handle DNA file upload
        if 'dna_upload' in request.FILES:
            user.dna_upload = request.FILES['dna_upload']

        user.save()  # triggers validation (pcos removal for males, etc.)
    except (ValueError, TypeError) as e:
        return HttpResponse(f"Invalid form data: {e}", status=400)

    # Generate PDF
    app_url = getattr(settings, 'APP_URL', 'http://localhost:8001')
    pdf_buffer = generate_wellness_pdf(user, app_url=app_url)

    filename = f"Genewell_Wellness_Blueprint_{user.name.replace(' ', '_')}_{user.order_id}.pdf"
    response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def buy_addon(request, slug):
    """
    Initiate Instamojo payment for a premium add-on.
    On success, Instamojo redirects to /addon-success/ with payment details.
    """
    addon = get_object_or_404(PremiumAddOn, slug=slug, is_active=True)
    order_id = request.GET.get('order_id') or request.POST.get('order_id', '')

    if not order_id:
        return HttpResponse("Missing order_id parameter.", status=400)

    api_key = settings.INSTAMOJO_API_KEY
    auth_token = settings.INSTAMOJO_AUTH_TOKEN
    app_url = getattr(settings, 'APP_URL', 'http://localhost:8001')

    redirect_url = f"{app_url}/addon-success/?slug={slug}&order_id={order_id}"
    webhook_url = f"{app_url}/addon-webhook/"

    if not api_key or not auth_token:
        # Dev fallback: simulate success
        return redirect(f"/addon-success/?slug={slug}&order_id={order_id}&payment_status=Credit")

    headers = {
        'X-Api-Key': api_key,
        'X-Auth-Token': auth_token,
    }
    payload = {
        'purpose': f"Genewell Add-On: {addon.name[:30]}",
        'amount': str(addon.price_inr),
        'buyer_name': '',
        'email': '',
        'phone': '',
        'redirect_url': redirect_url,
        'webhook': webhook_url,
        'allow_repeated_payments': False,
        'send_email': True,
        'send_sms': True,
    }

    try:
        resp = requests.post(
            f"{settings.INSTAMOJO_BASE_URL}/payment-requests/",
            data=payload,
            headers=headers,
            timeout=10
        )
        resp.raise_for_status()
        result = resp.json()
        if result.get('success'):
            payment_url = result['payment_request']['longurl']
            return redirect(payment_url)
        return HttpResponse(f"Instamojo error: {result}", status=502)
    except requests.RequestException as e:
        return HttpResponse(f"Payment gateway error: {e}", status=502)


def addon_success(request):
    """
    Handle Instamojo redirect after payment.
    Updates purchased_addons on the user's profile.
    Redirects to PDF download page.
    """
    slug = request.GET.get('slug', '')
    order_id = request.GET.get('order_id', '')
    payment_status = request.GET.get('payment_status', '')

    if payment_status == 'Credit' and slug and order_id:
        try:
            user = UserProfile.objects.get(order_id=order_id)
            purchased = list(user.purchased_addons or [])
            if slug not in purchased:
                purchased.append(slug)
                user.purchased_addons = purchased
                user.save()

            # Regenerate and serve updated PDF
            app_url = getattr(settings, 'APP_URL', 'http://localhost:8001')
            pdf_buffer = generate_wellness_pdf(user, app_url=app_url)
            filename = f"Genewell_Updated_Blueprint_{user.name.replace(' ', '_')}_{order_id}.pdf"
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except UserProfile.DoesNotExist:
            return HttpResponse("Order not found.", status=404)

    # Payment failed or cancelled
    return render(request, 'core/payment_failed.html', {
        'slug': slug,
        'order_id': order_id,
        'status': payment_status
    })


@csrf_exempt
def addon_webhook(request):
    """Instamojo webhook endpoint — processes payment notifications asynchronously."""
    if request.method == 'POST':
        data = request.POST
        payment_id = data.get('payment_id', '')
        payment_request_id = data.get('payment_request_id', '')
        status = data.get('status', '')
        # In production: verify MAC signature here
        # For now: log and acknowledge
        return HttpResponse("OK", status=200)
    return HttpResponse("Method not allowed", status=405)
