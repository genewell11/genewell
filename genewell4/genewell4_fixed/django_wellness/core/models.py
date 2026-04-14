import uuid
from django.db import models
from django.core.exceptions import ValidationError


class SiteConfig(models.Model):
    """Frontend & branding configuration editable from admin."""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.CharField(max_length=255, blank=True)
    
    class Meta:
        verbose_name = "Site Configuration"
        verbose_name_plural = "Site Configurations"
    
    def __str__(self):
        return f"{self.key} = {self.value[:50]}"


class PremiumAddOn(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    short_description = models.CharField(max_length=500)
    detailed_description = models.TextField()
    price_inr = models.PositiveIntegerField(help_text="Price in INR (99-399 only)")
    image = models.ImageField(upload_to='addons/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    gender_required = models.CharField(
        max_length=10,
        choices=[('male', 'Male Only'), ('female', 'Female Only'), ('any', 'Any')],
        default='any'
    )
    min_activity_score = models.PositiveIntegerField(default=0, help_text="Minimum activity score (0-100)")
    required_conditions = models.JSONField(
        default=list,
        blank=True,
        help_text="List of conditions required (e.g. ['pcos', 'thyroid'])"
    )

    class Meta:
        verbose_name = "Premium Add-On"
        verbose_name_plural = "Premium Add-Ons"
        ordering = ['price_inr']

    def clean(self):
        if not (99 <= self.price_inr <= 399):
            raise ValidationError("Price must be between ₹99 and ₹399 only.")
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (₹{self.price_inr})"


class UserProfile(models.Model):
    GENDER_CHOICES = [('male', 'Male'), ('female', 'Female'), ('other', 'Other')]
    PLAN_CHOICES = [
        ('free', 'Free Starter'),
        ('essential', 'Essential'),
        ('premium', 'Premium'),
        ('coaching', 'Coaching Edition'),
    ]

    order_id = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    # Personal info
    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    location = models.CharField(max_length=200, blank=True)
    language = models.CharField(max_length=20, default='english')

    # Physical stats
    height_cm = models.FloatField()
    weight_kg = models.FloatField()

    # Lifestyle
    activity_level = models.CharField(
        max_length=20,
        choices=[('sedentary', 'Sedentary'), ('light', 'Light'), ('moderate', 'Moderate'), ('active', 'Active'), ('very_active', 'Very Active')],
        default='moderate'
    )
    work_schedule = models.CharField(max_length=50, blank=True)
    sleep_hours = models.FloatField(default=7.0)
    wake_up_time = models.CharField(max_length=20, blank=True)
    tired_time = models.CharField(max_length=20, blank=True)
    stress_level = models.CharField(
        max_length=20,
        choices=[('low', 'Low'), ('moderate', 'Moderate'), ('high', 'High'), ('very_high', 'Very High')],
        default='moderate'
    )
    energy_levels = models.CharField(
        max_length=20,
        choices=[('low', 'Low'), ('moderate', 'Moderate'), ('high', 'High')],
        default='moderate'
    )
    mood_patterns = models.CharField(max_length=200, blank=True)
    exercise_preference = models.CharField(max_length=200, blank=True)

    # Health data
    weight_goal = models.CharField(
        max_length=30,
        choices=[('lose', 'Lose Weight'), ('gain', 'Gain Weight'), ('maintain', 'Maintain'), ('build_muscle', 'Build Muscle')],
        default='maintain'
    )
    meals_per_day = models.PositiveIntegerField(default=3)
    eating_out = models.CharField(max_length=50, blank=True)
    cravings = models.CharField(max_length=200, blank=True)
    hunger_frequency = models.CharField(max_length=50, blank=True)
    hydration_habits = models.CharField(max_length=200, blank=True)
    food_intolerances = models.JSONField(default=list, blank=True)
    supplement_usage = models.TextField(blank=True)
    digestive_issues = models.CharField(max_length=200, blank=True)
    skin_concerns = models.CharField(max_length=200, blank=True)
    medical_conditions = models.JSONField(default=list, blank=True)

    # Female-specific
    bleeding_frequency = models.CharField(max_length=50, blank=True)

    # Optional DNA upload
    dna_upload = models.FileField(upload_to='dna/', blank=True, null=True)

    # Plan & add-ons
    plan_type = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    purchased_addons = models.JSONField(
        default=list,
        blank=True,
        help_text="List of purchased add-on slugs"
    )

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.email}) — {self.plan_type}"

    def save(self, *args, **kwargs):
        # Validation: remove pcos for males
        if self.gender == 'male' and isinstance(self.medical_conditions, list):
            self.medical_conditions = [c for c in self.medical_conditions if c.lower() != 'pcos']
        # Validation: clear bleeding_frequency for males
        if self.gender == 'male':
            self.bleeding_frequency = ''
        super().save(*args, **kwargs)

    @property
    def bmi(self):
        if self.height_cm and self.weight_kg:
            h = self.height_cm / 100
            return round(self.weight_kg / (h * h), 1)
        return None

    @property
    def bmr(self):
        """Mifflin-St Jeor equation"""
        if self.gender == 'male':
            return round(10 * self.weight_kg + 6.25 * self.height_cm - 5 * self.age + 5, 1)
        return round(10 * self.weight_kg + 6.25 * self.height_cm - 5 * self.age - 161, 1)

    @property
    def tdee(self):
        multipliers = {
            'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55,
            'active': 1.725, 'very_active': 1.9
        }
        return round(self.bmr * multipliers.get(self.activity_level, 1.55), 0)
