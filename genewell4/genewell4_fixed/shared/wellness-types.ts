export interface WellnessUserProfile {
  name: string;
  email: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmr: number;
  tdee: number;
  calorieTarget?: number; // FIX: added — goal-adjusted calorie target (distinct from raw TDEE)
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  stressScore: number;
  sleepScore: number;
  activityScore: number;
  energyScore: number;
  medicalConditions: string[];
  digestiveIssues: string[];
  foodIntolerances: string[];
  skinConcerns: string[];
  dietaryPreference: string;
  exercisePreference: string[];
  exerciseIntensity: string;
  workSchedule: string;
  region: string;
  goals: string[];
  recommendedTests: string[];
  supplementPriority: string[];
  mealFrequency: number;
  dnaConsent: boolean;
  // Extended profile fields (computed from quiz data)
  sleepHours?: number;
  waterLiters?: number;
  waterIntake?: number;
  healthConditions?: string[];
  afternoonCrash?: boolean;
  estimatedTDEE?: number;
  activityMultiplier?: number;
  eatingOutFrequency?: string;
  city?: string;
  snoringOrApnea?: boolean;
  stressSymptoms?: string[];
  moodPatterns?: string[];
  cravings?: string[];
  hungerFrequency?: string;
  activityLevel?: string;
}

export interface RuleEngineOutput {
  riskFlags: RiskFlag[];
  activeModules: string[];
  labTestPriority: PrioritizedLabTest[];
  narrativeHints: NarrativeHint[];
  severityProfile: {
    sleepSeverity: "normal" | "mild" | "moderate" | "severe";
    stressSeverity: "normal" | "mild" | "moderate" | "severe";
    weightRisk: "underweight" | "normal" | "overweight" | "obese";
    metabolicRisk: "low" | "moderate" | "high";
  };
}

export interface RiskFlag {
  category: string;
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
  actionRequired: string;
}

export interface PrioritizedLabTest {
  name: string;
  priority: number;
  reason: string;
  estimatedCostINR: string;
  frequency: string;
}

export interface NarrativeHint {
  section: string;
  tone: string;
  focusAreas: string[];
  avoidTopics: string[];
}

export interface NarrativeOutput {
  executiveSummary: string;
  riskInterpretation: string;
  goalStrategy: string;
  sleepNarrative: string;
  stressNarrative: string;
  nutritionNarrative: string;
  movementNarrative: string;
  conditionNarratives: Record<string, string>;
}

export interface MealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portion: string;
}

export interface DayMeal {
  dayLabel: string;
  breakfast: MealItem[];
  midMorningSnack: MealItem[];
  lunch: MealItem[];
  eveningSnack: MealItem[];
  dinner: MealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

export interface MealPlanOutput {
  days: DayMeal[];
  dailyTargetCalories: number;
  macroTargets: { protein: number; carbs: number; fats: number };
  dietaryNotes: string[];
}

export interface PDFDataBundle {
  profile: WellnessUserProfile;
  rules: RuleEngineOutput;
  narratives: NarrativeOutput;
  mealPlan: MealPlanOutput;
  tier: "free" | "essential" | "premium" | "coaching";
  addOns: string[];
  orderId: string;
  timestamp: string;
  adjustments?: string[];
}
