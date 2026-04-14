import { describe, it, expect } from "vitest";
import {
  classifyScore,
  evaluateSleepSeverity,
  evaluateStressSeverity,
  evaluateWeightRisk,
  isScoreHigh,
  isScoreModerate,
  isScoreLow,
  scoreInterpretation,
} from "../shared/score-utils";
import { runRuleEngine } from "../server/lib/rule-engine";
import { generateMealPlan } from "../server/lib/meal-generator";
import { validatePDFBundle } from "../shared/pdf-validation";
import type { WellnessUserProfile, PDFDataBundle } from "../shared/wellness-types";

function makeProfile(overrides: Partial<WellnessUserProfile> = {}): WellnessUserProfile {
  return {
    name: "Test User",
    email: "test@example.com",
    age: 30,
    gender: "male",
    heightCm: 175,
    weightKg: 70,
    bmi: 22.9,
    bmr: 1700,
    tdee: 2200,
    proteinGrams: 130,
    carbsGrams: 250,
    fatsGrams: 70,
    stressScore: 50,
    sleepScore: 60,
    activityScore: 55,
    energyScore: 60,
    medicalConditions: [],
    digestiveIssues: [],
    foodIntolerances: [],
    skinConcerns: [],
    dietaryPreference: "non-veg",
    exercisePreference: ["walking"],
    exerciseIntensity: "moderate",
    workSchedule: "9-5",
    region: "North India",
    goals: ["general-wellness"],
    recommendedTests: [],
    supplementPriority: [],
    mealFrequency: 3,
    dnaConsent: false,
    ...overrides,
  };
}

describe("Score Mapping", () => {
  it("classifies high scores (>=70)", () => {
    expect(classifyScore(70)).toBe("high");
    expect(classifyScore(85)).toBe("high");
    expect(classifyScore(100)).toBe("high");
  });

  it("classifies moderate scores (40-69)", () => {
    expect(classifyScore(40)).toBe("moderate");
    expect(classifyScore(55)).toBe("moderate");
    expect(classifyScore(69)).toBe("moderate");
  });

  it("classifies low scores (<40)", () => {
    expect(classifyScore(0)).toBe("low");
    expect(classifyScore(20)).toBe("low");
    expect(classifyScore(39)).toBe("low");
  });

  it("boundary: 40 is moderate, not low", () => {
    expect(classifyScore(40)).toBe("moderate");
    expect(isScoreLow(40)).toBe(false);
    expect(isScoreModerate(40)).toBe(true);
  });

  it("boundary: 70 is high, not moderate", () => {
    expect(classifyScore(70)).toBe("high");
    expect(isScoreHigh(70)).toBe(true);
    expect(isScoreModerate(70)).toBe(false);
  });

  it("evaluates sleep severity correctly", () => {
    expect(evaluateSleepSeverity(25)).toBe("severe");
    expect(evaluateSleepSeverity(45)).toBe("moderate");
    expect(evaluateSleepSeverity(65)).toBe("mild");
    expect(evaluateSleepSeverity(80)).toBe("normal");
  });

  it("evaluates stress severity correctly", () => {
    expect(evaluateStressSeverity(75)).toBe("severe");
    expect(evaluateStressSeverity(55)).toBe("moderate");
    expect(evaluateStressSeverity(45)).toBe("mild");
    expect(evaluateStressSeverity(30)).toBe("normal");
  });

  it("evaluates weight risk correctly", () => {
    expect(evaluateWeightRisk(17)).toBe("underweight");
    expect(evaluateWeightRisk(22)).toBe("normal");
    expect(evaluateWeightRisk(28)).toBe("overweight");
    expect(evaluateWeightRisk(32)).toBe("obese");
  });

  it("returns correct score interpretations", () => {
    expect(scoreInterpretation("Energy Level", 20)).toContain("Needs immediate attention");
    expect(scoreInterpretation("Energy Level", 50)).toContain("Below optimal");
    expect(scoreInterpretation("Energy Level", 80)).toContain("maintain");
  });
});

describe("Activity Gating", () => {
  it("blocks muscle_building for activityScore < 30", () => {
    const profile = makeProfile({
      activityScore: 20,
      goals: ["muscle gain", "build muscle"],
    });
    const result = runRuleEngine(profile);
    expect(result.activeModules).not.toContain("muscle_building");
    expect(result.activeModules).toContain("beginner_program");
    expect(result.activeModules).not.toContain("movement_program");
  });

  it("allows muscle_building for activityScore >= 30", () => {
    const profile = makeProfile({
      activityScore: 50,
      goals: ["muscle gain"],
    });
    const result = runRuleEngine(profile);
    expect(result.activeModules).toContain("muscle_building");
    expect(result.activeModules).toContain("movement_program");
    expect(result.activeModules).not.toContain("beginner_program");
  });

  it("enables beginner_program instead of movement_program for low activity", () => {
    const profile = makeProfile({ activityScore: 15 });
    const result = runRuleEngine(profile);
    expect(result.activeModules).toContain("beginner_program");
    expect(result.activeModules).not.toContain("movement_program");
  });

  it("enables movement_program for activityScore >= 30", () => {
    const profile = makeProfile({ activityScore: 60 });
    const result = runRuleEngine(profile);
    expect(result.activeModules).toContain("movement_program");
    expect(result.activeModules).not.toContain("beginner_program");
  });
});

describe("Meal Macro Accuracy", () => {
  it("generates meals within 15% of TDEE target", () => {
    const profile = makeProfile({ tdee: 2000 });
    const plan = generateMealPlan(profile, 3);
    for (const day of plan.days) {
      const deviation = Math.abs(day.totalCalories - 2000) / 2000;
      expect(deviation).toBeLessThan(0.15);
    }
  });

  it("scales portions for high TDEE (3000 kcal)", () => {
    const profile = makeProfile({ tdee: 3000, proteinGrams: 180, carbsGrams: 340, fatsGrams: 90 });
    const plan = generateMealPlan(profile, 2);
    for (const day of plan.days) {
      expect(day.totalCalories).toBeGreaterThan(2500);
      expect(day.totalCalories).toBeLessThan(3500);
    }
  });

  it("scales portions for low TDEE (1400 kcal)", () => {
    const profile = makeProfile({ tdee: 1400, proteinGrams: 85, carbsGrams: 160, fatsGrams: 45 });
    const plan = generateMealPlan(profile, 2);
    for (const day of plan.days) {
      expect(day.totalCalories).toBeGreaterThan(1100);
      expect(day.totalCalories).toBeLessThan(1700);
    }
  });

  it("respects vegetarian diet preference", () => {
    const profile = makeProfile({ dietaryPreference: "veg" });
    const plan = generateMealPlan(profile, 3);
    const nonVegItems = ["Chicken", "Fish", "Egg", "Mutton"];
    for (const day of plan.days) {
      const allItems = [...day.breakfast, ...day.lunch, ...day.dinner, ...day.midMorningSnack, ...day.eveningSnack];
      for (const item of allItems) {
        for (const nv of nonVegItems) {
          expect(item.name.toLowerCase()).not.toContain(nv.toLowerCase());
        }
      }
    }
  });

  it("generates different meals for different days (randomized)", () => {
    const profile = makeProfile();
    const plan = generateMealPlan(profile, 3);
    const day1Names = plan.days[0].breakfast.map(i => i.name).join(",");
    const day2Names = plan.days[1].breakfast.map(i => i.name).join(",");
    const day3Names = plan.days[2].breakfast.map(i => i.name).join(",");
    const allSame = day1Names === day2Names && day2Names === day3Names;
    expect(allSame).toBe(false);
  });

  it("does not hardcode weekday names", () => {
    const profile = makeProfile();
    const plan = generateMealPlan(profile, 7);
    for (const day of plan.days) {
      expect(day.dayLabel).toMatch(/^Day \d+$/);
      expect(day.dayLabel).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i);
    }
  });
});

describe("Supplement Deduplication", () => {
  it("deduplicates supplements in validation", () => {
    const profile = makeProfile({
      supplementPriority: ["Vitamin D", "vitamin d", "Omega-3", "OMEGA-3", "Magnesium"],
    });
    const rules = runRuleEngine(profile);
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: {
        executiveSummary: "Test summary",
        riskInterpretation: "No risks",
        goalStrategy: "Stay healthy",
        sleepNarrative: "",
        stressNarrative: "",
        nutritionNarrative: "Eat well",
        movementNarrative: "Move more",
        conditionNarratives: {},
      },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test-123",
      timestamp: new Date().toISOString(),
    };

    const result = validatePDFBundle(bundle);
    expect(result.cleaned.profile.supplementPriority.length).toBe(3);
    expect(result.warnings.some(w => w.includes("duplicate"))).toBe(true);
  });

  it("removes empty modules", () => {
    const profile = makeProfile();
    const rules = runRuleEngine(profile);
    rules.activeModules.push("", "  ", "");
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: {
        executiveSummary: "OK",
        riskInterpretation: "OK",
        goalStrategy: "OK",
        sleepNarrative: "",
        stressNarrative: "",
        nutritionNarrative: "OK",
        movementNarrative: "OK",
        conditionNarratives: {},
      },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test-456",
      timestamp: new Date().toISOString(),
    };

    const result = validatePDFBundle(bundle);
    expect(result.cleaned.rules.activeModules.every(m => m.trim().length > 0)).toBe(true);
    expect(result.warnings.some(w => w.includes("empty module"))).toBe(true);
  });

  it("fails on unresolved template literals", () => {
    const profile = makeProfile();
    const rules = runRuleEngine(profile);
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: {
        executiveSummary: "Your BMI is ${profile.bmi} which is bad",
        riskInterpretation: "OK",
        goalStrategy: "OK",
        sleepNarrative: "",
        stressNarrative: "",
        nutritionNarrative: "OK",
        movementNarrative: "OK",
        conditionNarratives: {},
      },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test-789",
      timestamp: new Date().toISOString(),
    };

    const result = validatePDFBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("template literal"))).toBe(true);
  });
});

describe("Lab Sorting", () => {
  it("sorts labs descending by priority weight", () => {
    const profile = makeProfile({
      medicalConditions: ["diabetes", "thyroid"],
      sleepScore: 25,
    });
    const result = runRuleEngine(profile);
    const priorities = result.labTestPriority.map(t => t.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });

  it("assigns higher weight to condition-specific tests", () => {
    const profile = makeProfile({ medicalConditions: ["diabetes"] });
    const result = runRuleEngine(profile);
    const hba1c = result.labTestPriority.find(t => t.name.includes("HbA1c"));
    const cbc = result.labTestPriority.find(t => t.name.includes("CBC"));
    expect(hba1c).toBeDefined();
    expect(cbc).toBeDefined();
    expect(hba1c!.priority).toBeGreaterThan(cbc!.priority);
  });

  it("no duplicate lab tests in output", () => {
    const profile = makeProfile({
      medicalConditions: ["diabetes", "thyroid", "pcos"],
      sleepScore: 20,
      stressScore: 80,
    });
    const result = runRuleEngine(profile);
    const names = result.labTestPriority.map(t => t.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });
});
