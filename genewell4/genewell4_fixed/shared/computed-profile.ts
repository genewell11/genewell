import type { QuizInput, Gender } from "./input-schema";

export interface ComputedProfile {
  bmi: number;
  bmiCategory: "underweight" | "normal" | "overweight" | "obese";
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  proteinPct: number;
  carbsPct: number;
  fatsPct: number;
}

export interface FullProfile {
  input: QuizInput;
  computed: ComputedProfile;
}

function activityMultiplier(activityScore: number): number {
  if (activityScore <= 20) return 1.2;
  if (activityScore <= 40) return 1.375;
  if (activityScore <= 60) return 1.55;
  if (activityScore <= 80) return 1.725;
  return 1.9;
}

function computeBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

function classifyBMI(bmi: number): "underweight" | "normal" | "overweight" | "obese" {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function computeBMR(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  if (gender === "male") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
}

function computeCalorieTarget(tdee: number, bmiCategory: string, goals: string[], age: number, bmr: number): number {
  const goalsLower = goals.map(g => g.toLowerCase());
  const wantsLoss = goalsLower.some(g => g.includes("lose") || g.includes("weight loss") || g.includes("fat loss") || g.includes("fat-loss") || g.includes("lose-weight"));
  const wantsGain = goalsLower.some(g => g.includes("gain") || g.includes("muscle") || g.includes("build"));

  let target: number;

  // FIX: Use fixed kcal deficit/surplus matching rules.json (400-500 deficit, 200-300 surplus)
  // Old code used % multipliers (tdee * 0.80) which gave wildly different numbers per user
  if (wantsLoss) {
    target = Math.round(tdee - 450); // 450 kcal deficit (midpoint of 400-500 range)
  } else if (wantsGain) {
    target = Math.round(tdee + 250); // 250 kcal surplus (midpoint of 200-300 range)
  } else if (bmiCategory === "obese") {
    target = Math.round(tdee - 400); // even without explicit loss goal, obese → moderate deficit
  } else if (bmiCategory === "underweight") {
    target = Math.round(tdee + 300);
  } else {
    target = Math.round(tdee + 100); // maintenance / general wellness
  }

  // Senior Safety Constraint (Age >= 60): never go below 85% of TDEE
  if (age >= 60) {
    const floor = Math.max(bmr, Math.round(tdee * 0.85));
    if (target < floor) target = floor;
  }

  // Absolute Floor: Never below BMR for anyone
  if (target < bmr) target = bmr;

  return target;
}

function computeMacros(
  calorieTarget: number,
  gender: Gender,
  goals: string[],
  conditions: string[]
): { proteinGrams: number; carbsGrams: number; fatsGrams: number; proteinPct: number; carbsPct: number; fatsPct: number } {
  const goalsLower = goals.map(g => g.toLowerCase());
  const conditionsLower = conditions.map(c => c.toLowerCase());

  let proteinPct = 0.25;
  let fatsPct = 0.25;
  let carbsPct = 0.50;

  if (goalsLower.some(g => g.includes("muscle") || g.includes("build") || g.includes("gain"))) {
    proteinPct = 0.30;
    carbsPct = 0.45;
    fatsPct = 0.25;
  } else if (goalsLower.some(g => g.includes("lose") || g.includes("fat"))) {
    proteinPct = 0.30;
    carbsPct = 0.40;
    fatsPct = 0.30;
  }

  if (conditionsLower.some(c => c.includes("diabetes") || c.includes("pcos"))) {
    proteinPct = 0.30;
    carbsPct = 0.35;
    fatsPct = 0.35;
  }

  const total = proteinPct + carbsPct + fatsPct;
  proteinPct = proteinPct / total;
  carbsPct = carbsPct / total;
  fatsPct = fatsPct / total;

  const proteinGrams = Math.round((calorieTarget * proteinPct) / 4);
  const carbsGrams = Math.round((calorieTarget * carbsPct) / 4);
  const fatsGrams = Math.round((calorieTarget * fatsPct) / 9);

  return {
    proteinGrams,
    carbsGrams,
    fatsGrams,
    proteinPct: Math.round(proteinPct * 100),
    carbsPct: Math.round(carbsPct * 100),
    fatsPct: Math.round(fatsPct * 100),
  };
}

export function buildComputedProfile(input: QuizInput): ComputedProfile {
  const bmi = computeBMI(input.weightKg, input.heightCm);
  const bmiCategory = classifyBMI(bmi);
  const bmr = computeBMR(input.gender, input.weightKg, input.heightCm, input.age);
  const multiplier = activityMultiplier(input.activityScore);
  const tdee = Math.round(bmr * multiplier);
  const calorieTarget = computeCalorieTarget(tdee, bmiCategory, input.goals, input.age, bmr);
  const macros = computeMacros(calorieTarget, input.gender, input.goals, input.medicalConditions);

  return {
    bmi,
    bmiCategory,
    bmr,
    tdee,
    calorieTarget,
    ...macros,
  };
}

export function buildFullProfile(input: QuizInput): FullProfile {
  return {
    input,
    computed: buildComputedProfile(input),
  };
}

export function toWellnessUserProfile(fp: FullProfile): import("./wellness-types").WellnessUserProfile {
  const { input: i, computed: c } = fp;
  return {
    name: i.name,
    email: i.email,
    age: i.age,
    gender: i.gender,
    heightCm: i.heightCm,
    weightKg: i.weightKg,
    bmi: c.bmi,
    bmr: c.bmr,
    // FIX: was c.calorieTarget (already goal-adjusted) — template-mapper was then applying
    // deficit/surplus again on top of an already-adjusted number (double-counting).
    // Pass the raw TDEE here so template-mapper can compute the correct goal target.
    tdee: c.tdee,
    // Also expose calorieTarget for display purposes
    calorieTarget: c.calorieTarget,
    proteinGrams: c.proteinGrams,
    carbsGrams: c.carbsGrams,
    fatsGrams: c.fatsGrams,
    stressScore: i.stressScore,
    sleepScore: i.sleepScore,
    activityScore: i.activityScore,
    energyScore: i.energyScore,
    medicalConditions: i.medicalConditions,
    digestiveIssues: [
      ...(i.digestiveIssues || []),
      ...(["sometimes", "often", "always"].includes((i as any).bloatingFrequency || "") ? ["bloating"] : []),
    ],
    foodIntolerances: i.foodIntolerances,
    skinConcerns: i.skinConcerns,
    dietaryPreference: i.dietaryPreference,
    exercisePreference: i.exercisePreference,
    exerciseIntensity: i.exerciseIntensity,
    workSchedule: i.workSchedule,
    region: i.region,
    goals: i.goals,
    recommendedTests: [],
    supplementPriority: [],
    mealFrequency: i.mealFrequency,
    dnaConsent: i.dnaConsent,
  };
}
