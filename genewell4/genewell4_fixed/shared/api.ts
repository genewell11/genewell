import { z } from "zod";

// User Management Types
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  age: z.number().min(16).max(60),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]),
  createdAt: z.string(),
  hasUploadedDNA: z.boolean().default(false),
  subscription: z.enum(["free", "premium", "pro"]).default("free"),
  language: z.enum(["en", "hi"]).default("en"),
});

export const AuthRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  age: z.number().min(16).max(60),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]),
  language: z.enum(["en", "hi"]).default("en"),
});

export const AuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Enhanced Wellness Quiz Types
export const WellnessQuizSchema = z.object({
  age: z.number().min(16).max(60),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]),
  wakeUpTime: z.enum(["before-6", "6-8", "8-10", "after-10"]),
  mealsPerDay: z.enum(["1", "2", "3", "4-plus"]),
  tiredTime: z.enum(["morning", "afternoon", "evening", "rarely"]),
  bloatingFrequency: z.enum(["often", "sometimes", "rarely", "never"]),
  stressLevel: z.enum(["very-high", "moderate", "low", "minimal"]),
  hungerFrequency: z.enum(["1-2-hours", "3-4-hours", "rarely", "depends"]),
  weightGoal: z.enum(["lose-weight", "gain-weight", "maintain", "no-goal"]),
  sleepHours: z.enum(["less-than-5", "5-6", "7-8", "more-than-8"]),
  activityLevel: z.enum([
    "sedentary",
    "lightly-active",
    "moderately-active",
    "highly-active",
  ]),
  cravings: z.enum([
    "sweet-foods",
    "salty-snacks",
    "fried-junk",
    "spicy-sour",
    "no-cravings",
  ]),
  dnaUpload: z.enum(["yes-upload", "have-but-no-upload", "dont-have"]),
  digestiveIssues: z.enum(["acidity", "constipation", "loose-motions", "gas", "none"]),
  medicalConditions: z.enum([
    "pcos",
    "thyroid",
    "diabetes",
    "blood-pressure",
    "none",
    "prefer-not-to-say",
  ]),
  eatingOut: z.enum(["daily", "3-5-times", "1-2-times", "rarely"]),

  // Additional enhanced questions
  energyLevels: z.enum(["very-low", "low", "moderate", "high", "very-high"]),
  skinConcerns: z.array(
    z.enum(["acne", "dryness", "oiliness", "pigmentation", "aging", "none"]),
  ),
  moodPatterns: z.enum([
    "mood-swings",
    "anxiety",
    "depression",
    "irritability",
    "stable",
  ]),
  hydrationHabits: z.enum([
    "less-than-4-glasses",
    "4-6-glasses",
    "6-8-glasses",
    "more-than-8",
  ]),
  exercisePreference: z.enum([
    "cardio",
    "strength",
    "yoga",
    "dance",
    "sports",
    "walking",
    "none",
  ]),
  foodIntolerances: z.array(
    z.enum(["lactose", "gluten", "nuts", "seafood", "eggs", "none"]),
  ),
  supplementUsage: z.enum([
    "none",
    "multivitamin",
    "protein",
    "specific-deficiency",
    "multiple",
  ]),
  workSchedule: z.enum([
    "9-to-5",
    "shift-work",
    "flexible",
    "student",
    "homemaker",
  ]),
});

// Wellness Blueprint Types
export const WellnessBlueprintSchema = z.object({
  metabolismType: z.object({
    type: z.enum(["fast", "moderate", "slow"]),
    description: z.string(),
    characteristics: z.array(z.string()),
  }),

  nutritionPlan: z.object({
    bestFoods: z.array(z.string()),
    worstFoods: z.array(z.string()),
    mealTiming: z.object({
      breakfast: z.string(),
      lunch: z.string(),
      dinner: z.string(),
      snacks: z.array(z.string()),
    }),
    fastingWindow: z.object({
      startTime: z.string(),
      endTime: z.string(),
      duration: z.string(),
      benefits: z.array(z.string()),
    }),
    hydrationSchedule: z.array(z.string()),
    portions: z.object({
      protein: z.string(),
      carbs: z.string(),
      fats: z.string(),
      vegetables: z.string(),
    }),
  }),

  fitnessRoutine: z.object({
    workoutType: z.array(z.string()),
    frequency: z.number(),
    duration: z.number(),
    weeklyPlan: z.array(
      z.object({
        day: z.string(),
        activity: z.string(),
        duration: z.string(),
        intensity: z.enum(["low", "moderate", "high"]),
      }),
    ),
    homeExercises: z.array(
      z.object({
        name: z.string(),
        sets: z.string(),
        reps: z.string(),
        description: z.string(),
      }),
    ),
  }),

  stressManagement: z.object({
    techniques: z.array(z.string()),
    dailyRoutine: z.array(
      z.object({
        time: z.string(),
        activity: z.string(),
        duration: z.string(),
      }),
    ),
    emergencyProtocols: z.array(z.string()),
    breathingExercises: z.array(
      z.object({
        name: z.string(),
        technique: z.string(),
        duration: z.string(),
      }),
    ),
  }),

  sleepOptimization: z.object({
    bedtime: z.string(),
    wakeTime: z.string(),
    sleepHygiene: z.array(z.string()),
    environmentTips: z.array(z.string()),
    supplementSuggestions: z.array(z.string()),
  }),

  supplementPlan: z.object({
    essential: z.array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        timing: z.string(),
        benefit: z.string(),
      }),
    ),
    optional: z.array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        timing: z.string(),
        benefit: z.string(),
      }),
    ),
    warnings: z.array(z.string()),
  }),

  weeklyPlanner: z.array(
    z.object({
      day: z.string(),
      mealPrep: z.array(z.string()),
      exercise: z.string(),
      selfCare: z.string(),
      goals: z.array(z.string()),
    }),
  ),

  personalizedTips: z.array(z.string()),
  progressTracking: z.object({
    weeklyMetrics: z.array(z.string()),
    monthlyGoals: z.array(z.string()),
    redFlags: z.array(z.string()),
  }),

  ayurvedicInsights: z.object({
    constitution: z.enum(["vata", "pitta", "kapha", "mixed"]),
    imbalances: z.array(z.string()),
    recommendations: z.array(z.string()),
    seasonalTips: z.array(z.string()),
  }).optional(),

  confidenceScore: z.number().min(0).max(100),
  generatedAt: z.string(),
  validUntil: z.string(),
});

// API Response Types
export type User = z.infer<typeof UserSchema>;
export type AuthRegister = z.infer<typeof AuthRegisterSchema>;
export type AuthLogin = z.infer<typeof AuthLoginSchema>;
export type WellnessQuiz = z.infer<typeof WellnessQuizSchema>;
export type WellnessBlueprint = z.infer<typeof WellnessBlueprintSchema>;

// Legacy compatibility aliases
export const LifestyleQuizSchema = WellnessQuizSchema;
export type LifestyleQuiz = WellnessQuiz;
export const GeneticMarkersSchema = z.object({
  metabolism: z.object({
    type: z.enum(["fast", "normal", "slow"]),
    score: z.number().min(0).max(100),
    genes: z.array(z.string()),
  }),
  foodSensitivities: z.object({
    lactose: z.enum(["tolerant", "intolerant", "unknown"]),
    gluten: z.enum(["tolerant", "sensitive", "unknown"]),
    caffeine: z.enum(["fast", "normal", "slow"]),
    alcohol: z.enum(["fast", "normal", "slow"]),
  }),
  vitaminDeficiencies: z.object({
    vitaminD: z.enum(["low_risk", "moderate_risk", "high_risk"]),
    vitaminB12: z.enum(["low_risk", "moderate_risk", "high_risk"]),
    folate: z.enum(["low_risk", "moderate_risk", "high_risk"]),
    iron: z.enum(["low_risk", "moderate_risk", "high_risk"]),
  }),
  fitnessResponse: z.object({
    cardioResponse: z.enum(["excellent", "good", "average", "poor"]),
    strengthResponse: z.enum(["excellent", "good", "average", "poor"]),
    recoverySpeed: z.enum(["fast", "normal", "slow"]),
    injuryRisk: z.enum(["low", "moderate", "high"]),
  }),
  weightManagement: z.object({
    fatLossResponse: z.enum(["excellent", "good", "average", "poor"]),
    muscleGainPotential: z.enum(["excellent", "good", "average", "poor"]),
    appetiteControl: z.enum(["excellent", "good", "average", "poor"]),
  }),
});

export const PersonalizedRecommendationsSchema = z.object({
  nutrition: z.object({
    macroRatio: z.object({
      protein: z.number(),
      carbs: z.number(),
      fats: z.number(),
    }),
    recommendedFoods: z.array(z.string()),
    avoidFoods: z.array(z.string()),
    mealTiming: z.array(z.string()),
    hydration: z.string(),
  }),
  fitness: z.object({
    workoutType: z.array(z.string()),
    intensity: z.enum(["low", "moderate", "high"]),
    frequency: z.number(),
    duration: z.number(),
    restDays: z.number(),
  }),
  lifestyle: z.object({
    sleepRecommendations: z.string(),
    stressManagement: z.array(z.string()),
    supplementSuggestions: z.array(z.string()),
    habitChanges: z.array(z.string()),
  }),
  personalizedTips: z.array(z.string()),
});

export type GeneticMarkers = z.infer<typeof GeneticMarkersSchema>;
export type PersonalizedRecommendations = z.infer<
  typeof PersonalizedRecommendationsSchema
>;

// DNA Upload Types (Enhanced)
export const DNAUploadSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  provider: z.enum(["23andme", "ancestrydna", "myheritage", "ftdna", "other"]),
  processingConsent: z.boolean(),
  deleteAfterProcessing: z.boolean().default(true),
  privacyLevel: z.enum(["basic", "enhanced", "maximum"]).default("enhanced"),
});

export type DNAUpload = z.infer<typeof DNAUploadSchema>;

// Payment Types
export const PaymentSchema = z.object({
  amount: z.number(),
  currency: z.string().default("INR"),
  planType: z.enum(["basic-99", "premium-199", "advanced-299"]),
  paymentMethod: z.enum(["razorpay", "stripe", "upi"]),
  userEmail: z.string().email(),
});

export type Payment = z.infer<typeof PaymentSchema>;

// API Response Interfaces
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface QuizSubmissionResponse {
  success: boolean;
  analysisId: string;
  blueprint?: WellnessBlueprint;
  paymentRequired: boolean;
  paymentUrl?: string;
  message: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  downloadUrl?: string;
  message: string;
}

export interface DownloadResponse {
  success: boolean;
  pdfUrl: string;
  filename: string;
  expiresAt: string;
}

export interface DNAProcessingResponse {
  success: boolean;
  processingId: string;
  estimatedTime: number;
  message: string;
}

export interface AnalysisResultResponse {
  success: boolean;
  geneticMarkers: GeneticMarkers;
  recommendations: PersonalizedRecommendations;
  reportUrl?: string;
  confidence: number;
}

export interface UserDashboardResponse {
  success: boolean;
  user: User;
  hasAnalysis: boolean;
  geneticMarkers?: GeneticMarkers;
  recommendations?: PersonalizedRecommendations;
  reportUrl?: string;
  lastUpdated?: string;
}

// Legacy interfaces for compatibility
export interface DemoResponse {
  message: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}
