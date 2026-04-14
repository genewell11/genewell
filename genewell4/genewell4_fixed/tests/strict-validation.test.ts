import { describe, it, expect } from "vitest";
import { runRuleEngine } from "../server/lib/rule-engine";
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

describe("Strict Validation & Stabilization", () => {
  it("male + PCOS mismatch: validation removes condition and warns", () => {
    const profile = makeProfile({ gender: "male", medicalConditions: ["PCOS", "Diabetes"] });
    const rules = runRuleEngine(profile, "free");
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: { executiveSummary: "Ok", riskInterpretation: "Ok", goalStrategy: "Ok", nutritionNarrative: "Ok", movementNarrative: "Ok", conditionNarratives: {}, sleepNarrative: "Ok", stressNarrative: "Ok" },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test",
      timestamp: new Date().toISOString()
    };
    const result = validatePDFBundle(bundle);
    expect(result.cleaned.profile.medicalConditions).not.toContain("PCOS");
    expect(result.warnings.some(w => w.includes("Removed PCOS"))).toBe(true);
  });

  it("throws error on unresolved ${ placeholders", () => {
    const profile = makeProfile();
    const rules = runRuleEngine(profile, "free");
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: { executiveSummary: "Hello ${name}", riskInterpretation: "Ok", goalStrategy: "Ok", nutritionNarrative: "Ok", movementNarrative: "Ok", conditionNarratives: {}, sleepNarrative: "Ok", stressNarrative: "Ok" },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test",
      timestamp: new Date().toISOString()
    };
    const result = validatePDFBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("found ${ or module name");
  });

  it("throws error on placeholder module names", () => {
    const profile = makeProfile();
    const rules = runRuleEngine(profile, "free");
    const bundle: PDFDataBundle = {
      profile,
      rules,
      narratives: { executiveSummary: "Check executive_summary for info", riskInterpretation: "Ok", goalStrategy: "Ok", nutritionNarrative: "Ok", movementNarrative: "Ok", conditionNarratives: {}, sleepNarrative: "Ok", stressNarrative: "Ok" },
      mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
      tier: "free",
      addOns: [],
      orderId: "test",
      timestamp: new Date().toISOString()
    };
    const result = validatePDFBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("found ${ or module name");
  });

  it("gates premium modules (insulin_management) only for premium plans", () => {
    const profile = makeProfile({ medicalConditions: ["Diabetes"] });
    const freeRules = runRuleEngine(profile, "free");
    expect(freeRules.activeModules).not.toContain("insulin_management");
    
    const premiumRules = runRuleEngine(profile, "premium");
    expect(premiumRules.activeModules).toContain("insulin_management");
  });

  it("10 random test profiles coverage", () => {
    const genders: ("male" | "female")[] = ["male", "female"];
    const conditions = ["Diabetes", "PCOS", "Thyroid", "Hypertension"];
    const tiers: ("free" | "essential" | "premium" | "coaching")[] = ["free", "essential", "premium", "coaching"];
    
    for (let i = 0; i < 10; i++) {
      const gender = genders[i % 2];
      const condition = conditions[i % conditions.length];
      const tier = tiers[i % tiers.length];
      const profile = makeProfile({ gender, medicalConditions: [condition] });
      const rules = runRuleEngine(profile, tier);
      
      if (gender === "male" && condition === "PCOS") {
        const bundle: PDFDataBundle = {
          profile, rules,
          narratives: { executiveSummary: "Ok", riskInterpretation: "Ok", goalStrategy: "Ok", nutritionNarrative: "Ok", movementNarrative: "Ok", conditionNarratives: {}, sleepNarrative: "Ok", stressNarrative: "Ok" },
          mealPlan: { days: [], dailyTargetCalories: 2000, macroTargets: { protein: 130, carbs: 250, fats: 70 }, dietaryNotes: [] },
          tier, addOns: [], orderId: "test-"+i, timestamp: new Date().toISOString()
        };
        const result = validatePDFBundle(bundle);
        expect(result.cleaned.profile.medicalConditions).not.toContain("PCOS");
      }
      
      if (tier === "free") {
        expect(rules.activeModules).not.toContain("insulin_management");
      }
    }
  });
});
