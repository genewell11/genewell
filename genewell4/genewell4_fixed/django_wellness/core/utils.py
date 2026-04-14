"""
Utility functions for Genewell wellness report generation.
Handles score mapping, lab test recommendations, and add-on filtering.
"""


def map_scores(user):
    """
    Map user profile fields to numeric scores (0-100).
    Returns a dict with activity_score, energy_score, sleep_score, goal_text.
    """
    activity_map = {
        'sedentary': 10, 'light': 30, 'moderate': 55, 'active': 75, 'very_active': 95
    }
    energy_map = {'low': 20, 'moderate': 55, 'high': 90}
    goal_map = {
        'lose': 'Weight Loss',
        'gain': 'Weight Gain',
        'maintain': 'Weight Maintenance',
        'build_muscle': 'Muscle Building',
    }

    # Sleep score: 8h = 100, scales linearly (capped 0-100)
    sleep_score = min(100, max(0, int((user.sleep_hours / 8.0) * 100)))

    return {
        'activity_score': activity_map.get(user.activity_level, 55),
        'energy_score': energy_map.get(user.energy_levels, 55),
        'sleep_score': sleep_score,
        'goal_text': goal_map.get(user.weight_goal, 'Weight Maintenance'),
    }


def get_essential_lab_tests(user):
    """
    Returns a list of recommended lab tests.
    Always includes Vitamin D and CBC.
    Adds up to 2 more based on user profile.
    """
    tests = [
        {'name': 'Vitamin D (25-OH)', 'reason': 'Deficiency is widespread in India (>70% population)', 'price': '₹500–₹800'},
        {'name': 'Complete Blood Count (CBC)', 'reason': 'Checks for anaemia, immune health, and infection', 'price': '₹200–₹400'},
    ]
    conditions = [c.lower() for c in (user.medical_conditions or [])]
    extra = 0

    if extra < 2 and 'pcos' in conditions:
        tests.append({'name': 'Fasting Insulin & LH/FSH Ratio', 'reason': 'Critical for PCOS management', 'price': '₹800–₹1,200'})
        extra += 1

    if extra < 2 and 'thyroid' in conditions:
        tests.append({'name': 'TSH (Thyroid Stimulating Hormone)', 'reason': 'Thyroid dysfunction affects metabolism and energy', 'price': '₹300–₹600'})
        extra += 1

    if extra < 2 and user.digestive_issues:
        tests.append({'name': 'Gut Microbiome Panel / H. Pylori', 'reason': 'Identifies underlying digestive pathology', 'price': '₹1,200–₹2,500'})
        extra += 1

    if extra < 2 and user.gender == 'female' and user.bleeding_frequency in ('heavy', 'irregular'):
        tests.append({'name': 'Serum Ferritin & Iron Studies', 'reason': 'Heavy bleeding leads to iron-deficiency anaemia', 'price': '₹400–₹700'})
        extra += 1

    if extra < 2 and user.food_intolerances and 'vegetarian' in str(user.food_intolerances).lower():
        tests.append({'name': 'Vitamin B12 & Folate', 'reason': 'Common deficiencies in vegetarian diets', 'price': '₹400–₹700'})
        extra += 1

    if extra < 2 and user.bmi and user.bmi >= 30:
        tests.append({'name': 'HbA1c (Glycated Haemoglobin)', 'reason': 'BMI ≥30 increases type-2 diabetes risk', 'price': '₹300–₹500'})
        extra += 1

    if extra < 2 and user.age and user.age >= 35:
        tests.append({'name': 'Lipid Profile (Cholesterol Panel)', 'reason': 'Cardiovascular risk assessment after 35', 'price': '₹400–₹700'})
        extra += 1

    return tests[:4]  # max 4 total


def get_relevant_optional_addons(user):
    """
    Returns active PremiumAddOn instances that are NOT yet purchased
    and are relevant to the user's profile.
    """
    from .models import PremiumAddOn

    scores = map_scores(user)
    activity_score = scores['activity_score']
    purchased = set(user.purchased_addons or [])
    conditions = [c.lower() for c in (user.medical_conditions or [])]

    qs = PremiumAddOn.objects.filter(is_active=True).exclude(slug__in=purchased)

    relevant = []
    for addon in qs:
        # Gender filter
        if addon.gender_required == 'male' and user.gender != 'male':
            continue
        if addon.gender_required == 'female' and user.gender != 'female':
            continue
        # Activity score filter
        if addon.min_activity_score and activity_score < addon.min_activity_score:
            continue
        # Required conditions filter
        required = addon.required_conditions or []
        if required and not any(r.lower() in conditions for r in required):
            continue
        relevant.append(addon)

    return relevant


def calculate_hydration(weight_kg):
    """Hydration target in litres per day."""
    return round(weight_kg * 0.033, 1)


def get_calorie_target(user):
    """Return daily calorie target adjusted for goal."""
    tdee = user.tdee
    goal = user.weight_goal
    if goal == 'lose':
        return max(1200, int(tdee - 500))
    elif goal == 'gain' or goal == 'build_muscle':
        return int(tdee + 300)
    return int(tdee)


def get_macros(user):
    """Return protein, carb, fat grams based on calorie target."""
    cal = get_calorie_target(user)
    goal = user.weight_goal
    if goal in ('build_muscle', 'gain'):
        protein_g = int(user.weight_kg * 1.8)
        fat_g = int(cal * 0.25 / 9)
    elif goal == 'lose':
        protein_g = int(user.weight_kg * 1.6)
        fat_g = int(cal * 0.25 / 9)
    else:
        protein_g = int(user.weight_kg * 1.4)
        fat_g = int(cal * 0.30 / 9)

    protein_cal = protein_g * 4
    fat_cal = fat_g * 9
    carb_g = int((cal - protein_cal - fat_cal) / 4)
    return {'protein': protein_g, 'carbs': max(50, carb_g), 'fat': fat_g, 'calories': cal}


def get_essential_pathology_tests(user):
    """Return 1-2 recommended pathology tests based on user profile for Essential & Premium tiers."""
    tests = []
    conditions = [c.lower() for c in (user.medical_conditions or [])]
    
    # Priority test 1: Based on BMI/metabolic risk
    if user.bmi and user.bmi >= 25:
        tests.append({
            'name': 'Fasting Blood Glucose (FBS)',
            'reason': f'Your BMI of {user.bmi} increases diabetes risk. FBS detects pre-diabetes early.',
            'frequency': 'Once baseline, then annually'
        })
    elif 'thyroid' in conditions:
        tests.append({
            'name': 'Thyroid Profile (TSH, T3, T4)',
            'reason': 'Critical for metabolism assessment given your thyroid condition.',
            'frequency': 'Baseline + every 6 months'
        })
    else:
        tests.append({
            'name': 'Complete Blood Count (CBC)',
            'reason': 'Essential baseline health marker covering immune health and anemia screening.',
            'frequency': 'Once baseline, then annually'
        })
    
    # Priority test 2: Gender-specific or condition-specific
    if user.gender == 'female' and 'pcos' in conditions:
        tests.append({
            'name': 'Insulin Levels & Hormonal Panel (LH/FSH)',
            'reason': 'PCOS management requires insulin sensitivity and hormone monitoring.',
            'frequency': 'Baseline + every 6 months'
        })
    elif user.age >= 30 and user.stress_level in ('high', 'very_high'):
        tests.append({
            'name': 'Vitamin D (25-hydroxyvitamin D)',
            'reason': f'At {user.age} years with {user.stress_level} stress, Vitamin D deficiency is common in India (>70%).',
            'frequency': 'Baseline + annually'
        })
    
    return tests[:2]  # Return max 2 tests
