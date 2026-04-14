import io
import pandas as pd
from django.contrib import admin
from django.http import HttpResponse
from .models import UserProfile, PremiumAddOn, SiteConfig


def export_to_excel(modeladmin, request, queryset):
    """Export selected UserProfile records to .xlsx using pandas."""
    data = []
    for u in queryset:
        data.append({
            'Order ID': str(u.order_id),
            'Name': u.name,
            'Email': u.email,
            'Phone': u.phone,
            'Age': u.age,
            'Gender': u.gender,
            'Location': u.location,
            'Language': u.language,
            'Height (cm)': u.height_cm,
            'Weight (kg)': u.weight_kg,
            'BMI': u.bmi,
            'TDEE': int(u.tdee),
            'Plan Type': u.plan_type,
            'Activity Level': u.activity_level,
            'Work Schedule': u.work_schedule,
            'Sleep Hours': u.sleep_hours,
            'Wake Up Time': u.wake_up_time,
            'Tired Time': u.tired_time,
            'Stress Level': u.stress_level,
            'Energy Levels': u.energy_levels,
            'Mood Patterns': u.mood_patterns,
            'Weight Goal': u.weight_goal,
            'Meals Per Day': u.meals_per_day,
            'Eating Out': u.eating_out,
            'Cravings': u.cravings,
            'Hunger Frequency': u.hunger_frequency,
            'Hydration Habits': u.hydration_habits,
            'Food Intolerances': ', '.join(u.food_intolerances or []),
            'Supplement Usage': u.supplement_usage,
            'Digestive Issues': u.digestive_issues,
            'Skin Concerns': u.skin_concerns,
            'Medical Conditions': ', '.join(u.medical_conditions or []),
            'Bleeding Frequency': u.bleeding_frequency,
            'Exercise Preference': u.exercise_preference,
            'Purchased Add-Ons': ', '.join(u.purchased_addons or []),
            'Created At': u.created_at.strftime('%Y-%m-%d %H:%M') if u.created_at else '',
        })

    df = pd.DataFrame(data)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='User Profiles')
    buf.seek(0)
    response = HttpResponse(
        buf.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="genewell_users.xlsx"'
    return response


export_to_excel.short_description = "Export selected to Excel (.xlsx)"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'email', 'phone', 'age', 'gender', 'location',
        'plan_type', 'bmi_display', 'activity_level', 'created_at'
    )
    list_filter = ('gender', 'plan_type', 'activity_level', 'weight_goal', 'stress_level', 'energy_levels', 'created_at')
    search_fields = ('name', 'email', 'phone', 'location', 'order_id')
    readonly_fields = ('order_id', 'created_at', 'bmi_display', 'tdee_display', 'bmr_display')
    actions = [export_to_excel]

    fieldsets = (
        ('Order Info', {
            'fields': ('order_id', 'created_at', 'plan_type', 'purchased_addons')
        }),
        ('Personal Details', {
            'fields': ('name', 'email', 'phone', 'age', 'gender', 'location', 'language')
        }),
        ('Physical Stats', {
            'fields': ('height_cm', 'weight_kg', 'bmi_display', 'bmr_display', 'tdee_display')
        }),
        ('Lifestyle', {
            'fields': (
                'activity_level', 'work_schedule', 'sleep_hours', 'wake_up_time',
                'tired_time', 'stress_level', 'energy_levels', 'mood_patterns', 'exercise_preference'
            )
        }),
        ('Diet & Nutrition', {
            'fields': (
                'weight_goal', 'meals_per_day', 'eating_out', 'cravings',
                'hunger_frequency', 'hydration_habits', 'food_intolerances', 'supplement_usage'
            )
        }),
        ('Health Conditions', {
            'fields': ('digestive_issues', 'skin_concerns', 'medical_conditions', 'bleeding_frequency', 'dna_upload')
        }),
    )

    def bmi_display(self, obj):
        return obj.bmi
    bmi_display.short_description = 'BMI'

    def tdee_display(self, obj):
        return f"{int(obj.tdee)} kcal"
    tdee_display.short_description = 'TDEE'

    def bmr_display(self, obj):
        return f"{int(obj.bmr)} kcal"
    bmr_display.short_description = 'BMR'


@admin.register(PremiumAddOn)
class PremiumAddOnAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price_inr', 'gender_required', 'min_activity_score', 'is_active')
    list_filter = ('is_active', 'gender_required')
    search_fields = ('name', 'slug', 'short_description')
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'slug', 'short_description', 'image', 'is_active')
        }),
        ('Content', {
            'fields': ('detailed_description',)
        }),
        ('Pricing (₹99-399 only)', {
            'fields': ('price_inr',)
        }),
        ('Eligibility Rules', {
            'fields': ('gender_required', 'min_activity_score', 'required_conditions'),
            'description': 'Controls which users see this add-on as recommended.'
        }),
    )


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'description')
    search_fields = ('key',)
    fieldsets = (
        ('Configuration', {
            'fields': ('key', 'description', 'value'),
            'description': 'Control website branding, colors, and text from here.'
        }),
    )
