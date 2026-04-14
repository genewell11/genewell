import type { WellnessUserProfile } from "../../shared/wellness-types";

export function getEssentialPathologyTests(profile: WellnessUserProfile): Array<{name: string; reason: string; frequency: string}> {
  const tests: Array<{name: string; reason: string; frequency: string}> = [];
  const conditions = (profile.medicalConditions || []).map(c => c.toLowerCase());
  
  // Test 1: Based on BMI
  if (profile.bmi >= 25) {
    tests.push({
      name: "Fasting Blood Glucose (FBS)",
      reason: `Your BMI of ${profile.bmi.toFixed(1)} increases diabetes risk. FBS detects pre-diabetes early.`,
      frequency: "Once baseline, then annually"
    });
  } else if (conditions.includes("thyroid")) {
    tests.push({
      name: "Thyroid Profile (TSH, T3, T4)",
      reason: "Critical for metabolism assessment given your thyroid condition.",
      frequency: "Baseline + every 6 months"
    });
  } else {
    tests.push({
      name: "Complete Blood Count (CBC)",
      reason: "Essential baseline health marker covering immune health and anemia screening.",
      frequency: "Once baseline, then annually"
    });
  }
  
  // Test 2: Gender/condition-specific
  if (profile.gender === "female" && conditions.includes("pcos")) {
    tests.push({
      name: "Insulin Levels & Hormonal Panel (LH/FSH)",
      reason: "PCOS management requires insulin sensitivity and hormone monitoring.",
      frequency: "Baseline + every 6 months"
    });
  } else if (profile.age >= 30 && (profile.stressScore > 60)) {
    tests.push({
      name: "Vitamin D (25-hydroxyvitamin D)",
      reason: `At ${profile.age} years with elevated stress, Vitamin D deficiency is common in India (>70%).`,
      frequency: "Baseline + annually"
    });
  }
  
  return tests.slice(0, 2);
}
