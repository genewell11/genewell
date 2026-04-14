import type {
  WellnessUserProfile,
  RuleEngineOutput,
  RiskFlag,
  PrioritizedLabTest,
  NarrativeHint,
} from "../../shared/wellness-types";
import {
  evaluateSleepSeverity,
  evaluateStressSeverity,
  evaluateWeightRisk,
  isScoreLow,
  isScoreHigh,
} from "../../shared/score-utils";
import type { MetabolicRisk } from "../../shared/score-utils";

function evaluateMetabolicRisk(profile: WellnessUserProfile): MetabolicRisk {
  let riskScore = 0;
  if (profile.bmi > 27) riskScore++;
  if (evaluateStressSeverity(profile.stressScore) === "severe") riskScore++;
  if (isScoreLow(profile.sleepScore)) riskScore++;
  const conditions = profile.medicalConditions.map(c => c.toLowerCase());
  if (conditions.includes("diabetes") || conditions.includes("pcos")) riskScore++;
  if (conditions.includes("thyroid")) riskScore++;
  if (riskScore >= 3) return "high";
  if (riskScore >= 1) return "moderate";
  return "low";
}

function hasCondition(profile: WellnessUserProfile, keyword: string): boolean {
  return profile.medicalConditions.some(c => c.toLowerCase().includes(keyword.toLowerCase()));
}

function buildRiskFlags(profile: WellnessUserProfile): RiskFlag[] {
  const flags: RiskFlag[] = [];

  const sleepSev = evaluateSleepSeverity(profile.sleepScore);
  if (sleepSev === "severe") {
    flags.push({
      category: "Sleep",
      severity: "critical",
      description: "Severely disrupted sleep pattern detected. Sleep score indicates chronic sleep deprivation.",
      actionRequired: "Immediate sleep hygiene intervention required. Consider clinical evaluation for sleep disorders.",
    });
  } else if (sleepSev === "moderate") {
    flags.push({
      category: "Sleep",
      severity: "high",
      description: "Moderate sleep disruption detected. This impacts recovery, metabolism, and cognitive function.",
      actionRequired: "Implement structured sleep protocol with consistent timing and environment optimization.",
    });
  } else if (sleepSev === "mild") {
    flags.push({
      category: "Sleep",
      severity: "moderate",
      description: "Mild sleep quality concerns. Room for improvement in sleep duration or quality.",
      actionRequired: "Optimize sleep hygiene practices and maintain consistent sleep-wake schedule.",
    });
  }

  const stressSev = evaluateStressSeverity(profile.stressScore);
  if (stressSev === "severe") {
    flags.push({
      category: "Stress",
      severity: "high",
      description: "High chronic stress detected. Elevated cortisol impacts weight, sleep, immunity, and metabolic health.",
      actionRequired: "Daily stress management protocol required. Consider cortisol-lowering interventions.",
    });
  } else if (stressSev === "moderate") {
    flags.push({
      category: "Stress",
      severity: "moderate",
      description: "Moderate stress levels detected. May impact recovery and long-term health outcomes.",
      actionRequired: "Incorporate daily stress-reduction techniques: breathing exercises, meditation, or movement.",
    });
  }

  const weightRisk = evaluateWeightRisk(profile.bmi);
  if (weightRisk === "obese") {
    flags.push({
      category: "Weight",
      severity: "high",
      description: "BMI indicates obesity. Increased risk for metabolic syndrome, cardiovascular disease, and diabetes.",
      actionRequired: "Structured fat-loss program with caloric deficit, resistance training, and metabolic monitoring.",
    });
  } else if (weightRisk === "overweight") {
    flags.push({
      category: "Weight",
      severity: "moderate",
      description: "BMI indicates overweight. Associated with increased cardiometabolic risk.",
      actionRequired: "Implement moderate caloric deficit with progressive exercise program.",
    });
  } else if (weightRisk === "underweight") {
    flags.push({
      category: "Weight",
      severity: "moderate",
      description: "BMI indicates underweight. May indicate nutritional deficiencies or underlying conditions.",
      actionRequired: "Nutritional assessment and caloric surplus plan with nutrient-dense foods.",
    });
  }

  if (hasCondition(profile, "pcos")) {
    flags.push({
      category: "Hormonal",
      severity: "high",
      description: "PCOS detected. Insulin resistance, hormonal imbalance, and metabolic disruption likely.",
      actionRequired: "Insulin-focused management with low-glycemic nutrition and targeted supplementation.",
    });
  }

  if (hasCondition(profile, "thyroid")) {
    flags.push({
      category: "Endocrine",
      severity: "high",
      description: "Thyroid condition detected. Impacts metabolism, energy, weight, and mood.",
      actionRequired: "Thyroid-specific protocol with regular monitoring and nutrition adjustments.",
    });
  }

  if (hasCondition(profile, "diabetes")) {
    flags.push({
      category: "Metabolic",
      severity: "high",
      description: "Diabetes detected. Blood sugar management is critical for all health outcomes.",
      actionRequired: "Blood sugar management protocol with glycemic control nutrition and regular HbA1c monitoring.",
    });
  }

  if (hasCondition(profile, "hypertension") || hasCondition(profile, "blood-pressure")) {
    flags.push({
      category: "Cardiovascular",
      severity: "high",
      description: "Hypertension detected. Elevated cardiovascular and stroke risk.",
      actionRequired: "Cardiovascular protocol with sodium management, regular BP monitoring, and cardio exercise.",
    });
  }

  if (profile.digestiveIssues.length > 0) {
    flags.push({
      category: "Digestive",
      severity: "moderate",
      description: `Digestive issues reported: ${profile.digestiveIssues.join(", ")}. May indicate gut microbiome imbalance.`,
      actionRequired: "Gut health protocol with probiotics, fiber optimization, and trigger food identification.",
    });
  }

  if (isScoreLow(profile.energyScore)) {
    flags.push({
      category: "Energy",
      severity: "moderate",
      description: "Very low energy levels reported. May indicate nutritional deficiencies or hormonal issues.",
      actionRequired: "Comprehensive blood work to rule out deficiencies. Optimize nutrition and sleep.",
    });
  }

  return flags;
}

interface ModuleDefinition {
  module_id: string;
  max_occurrence: number;
  render_condition: (profile: WellnessUserProfile, plan: string) => boolean;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { module_id: "executive_summary", max_occurrence: 1, render_condition: () => true },
  { module_id: "metabolic_profile", max_occurrence: 1, render_condition: () => true },
  { module_id: "lab_tests", max_occurrence: 1, render_condition: () => true },
  { 
    module_id: "beginner_program", 
    max_occurrence: 1, 
    render_condition: (p) => p.activityScore < 30 
  },
  { 
    module_id: "movement_program", 
    max_occurrence: 1, 
    render_condition: (p) => p.activityScore >= 30 
  },
  { 
    module_id: "sleep_protocol", 
    max_occurrence: 1, 
    render_condition: (p) => p.sleepScore < 70 
  },
  { 
    module_id: "stress_management", 
    max_occurrence: 1, 
    render_condition: (p) => p.stressScore > 40 
  },
  { 
    module_id: "fat_loss_program", 
    max_occurrence: 1, 
    render_condition: (p) => p.bmi > 25 || p.goals.some(g => /weight loss|lose|fat/i.test(g))
  },
  { 
    module_id: "muscle_building", 
    max_occurrence: 1, 
    render_condition: (p) => p.activityScore >= 30 && p.goals.some(g => /muscle|gain|build/i.test(g))
  },
  { 
    module_id: "insulin_management", 
    max_occurrence: 1, 
    render_condition: (p, plan) => (plan === "premium" || plan === "coaching") && (hasCondition(p, "pcos") || hasCondition(p, "diabetes"))
  },
  { 
    module_id: "thyroid_protocol", 
    max_occurrence: 1, 
    render_condition: (p, plan) => (plan === "premium" || plan === "coaching") && hasCondition(p, "thyroid")
  },
  { 
    module_id: "cardiovascular", 
    max_occurrence: 1, 
    render_condition: (p, plan) => (plan === "premium" || plan === "coaching") && /hypertension|blood-pressure|cholesterol/i.test(p.medicalConditions.join(","))
  },
  { 
    module_id: "gut_health", 
    max_occurrence: 1, 
    render_condition: (p, plan) => (plan === "premium" || plan === "coaching") && p.digestiveIssues.length > 0
  },
  { 
    module_id: "skin_health", 
    max_occurrence: 1, 
    render_condition: (p, plan) => (plan === "premium" || plan === "coaching") && p.skinConcerns.length > 0
  },
  { module_id: "nutrition_strategy", max_occurrence: 1, render_condition: () => true },
];

function buildActiveModules(profile: WellnessUserProfile, plan: string = "free"): string[] {
  return MODULE_DEFINITIONS
    .filter(def => def.render_condition(profile, plan))
    .map(def => def.module_id);
}

function buildLabTests(profile: WellnessUserProfile, riskFlags: RiskFlag[]): PrioritizedLabTest[] {
  const tests: PrioritizedLabTest[] = [];
  const addedTests = new Map<string, number>();

  function addTest(name: string, weight: number, reason: string, cost: string, frequency: string) {
    const existing = addedTests.get(name);
    if (existing !== undefined) {
      if (weight > existing) {
        const idx = tests.findIndex(t => t.name === name);
        if (idx >= 0) {
          tests[idx].priority = weight;
          tests[idx].reason = reason;
        }
        addedTests.set(name, weight);
      }
      return;
    }
    addedTests.set(name, weight);
    tests.push({ name, priority: weight, reason, estimatedCostINR: cost, frequency });
  }

  const severityWeights: Record<string, number> = {};
  for (const flag of riskFlags) {
    const w = flag.severity === "critical" ? 100 : flag.severity === "high" ? 80 : flag.severity === "moderate" ? 50 : 20;
    severityWeights[flag.category] = Math.max(severityWeights[flag.category] || 0, w);
  }

  const sleepWeight = severityWeights["Sleep"] || 0;
  const stressWeight = severityWeights["Stress"] || 0;
  const weightRiskW = severityWeights["Weight"] || 0;

  if (sleepWeight >= 50 || stressWeight >= 50) {
    addTest("Vitamin D (25-hydroxyvitamin D)", 90 + sleepWeight, "Sleep and stress recovery require optimal vitamin D levels", "₹800-1200", "Every 3 months");
    addTest("Thyroid Panel (TSH, Free T3, Free T4)", 85 + stressWeight, "Thyroid dysfunction directly impacts sleep and stress response", "₹500-800", "Every 6 months");
  }

  if (weightRiskW >= 50) {
    addTest("Lipid Profile (Total Cholesterol, LDL, HDL, Triglycerides)", 90 + weightRiskW, "Weight-related cardiovascular risk assessment", "₹400-600", "Every 6 months");
    addTest("HbA1c (Glycated Hemoglobin)", 88 + weightRiskW, "Insulin resistance screening for weight management", "₹400-600", "Every 3 months");
    addTest("Fasting Blood Glucose", 85 + weightRiskW, "Metabolic health baseline for weight management", "₹100-200", "Every 3 months");
  }

  if (hasCondition(profile, "pcos")) {
    addTest("Fasting Insulin", 180, "Insulin resistance assessment critical for PCOS management", "₹400-600", "Every 3 months");
    addTest("HbA1c (Glycated Hemoglobin)", 175, "Blood sugar control monitoring for PCOS", "₹400-600", "Every 3 months");
    addTest("Hormonal Panel (LH, FSH, Estradiol, Testosterone)", 160, "Hormonal balance assessment for PCOS", "₹1500-2500", "Every 6 months");
  }

  if (hasCondition(profile, "thyroid")) {
    addTest("Thyroid Panel (TSH, Free T3, Free T4)", 185, "Regular thyroid monitoring essential for condition management", "₹500-800", "Every 3 months");
    addTest("Thyroid Antibodies (Anti-TPO, Anti-TG)", 140, "Autoimmune thyroid assessment", "₹800-1200", "Every 6 months");
  }

  if (hasCondition(profile, "diabetes")) {
    addTest("HbA1c (Glycated Hemoglobin)", 190, "Primary diabetes control marker", "₹400-600", "Every 3 months");
    addTest("Fasting Blood Glucose", 185, "Daily blood sugar management baseline", "₹100-200", "Monthly");
    addTest("Kidney Function (Creatinine, BUN, eGFR)", 170, "Diabetes-related kidney damage screening", "₹400-600", "Every 6 months");
  }

  if (hasCondition(profile, "hypertension") || hasCondition(profile, "blood-pressure")) {
    addTest("Lipid Profile (Total Cholesterol, LDL, HDL, Triglycerides)", 175, "Cardiovascular risk assessment", "₹400-600", "Every 6 months");
    addTest("Kidney Function (Creatinine, BUN, eGFR)", 150, "Hypertension-related kidney impact monitoring", "₹400-600", "Every 6 months");
    addTest("Electrolytes (Sodium, Potassium, Chloride)", 130, "Electrolyte balance for blood pressure management", "₹300-500", "Every 6 months");
  }

  addTest("Complete Blood Count (CBC)", 60, "General health screening and anemia detection", "₹300-500", "Every 6 months");
  addTest("Liver Function Tests (SGOT, SGPT, ALP, Bilirubin)", 55, "Liver health and metabolic function assessment", "₹400-600", "Every 6 months");

  if (profile.age > 50) {
    addTest("Bone Density (DEXA Scan)", 70, "Age-appropriate bone health screening for 50+", "₹2000-3500", "Annually");
    addTest("Cardiac Risk Panel (hs-CRP, Homocysteine)", 75, "Age-appropriate cardiovascular screening for 50+", "₹1000-1500", "Annually");
    addTest("Vitamin B12", 65, "B12 deficiency risk increases with age", "₹600-900", "Every 6 months");
  }

  if (profile.age > 40) {
    addTest("Lipid Profile (Total Cholesterol, LDL, HDL, Triglycerides)", 50, "Age-appropriate lipid screening for 40+", "₹400-600", "Every 6 months");
    addTest("Complete Metabolic Panel", 45, "Comprehensive metabolic screening for 40+", "₹800-1200", "Annually");
  }

  if (profile.gender.toLowerCase() === "female" && profile.age > 35) {
    addTest("Iron Panel (Serum Iron, Ferritin, TIBC)", 55, "Iron deficiency screening for women over 35", "₹300-500", "Every 6 months");
    addTest("Hormonal Panel (Estradiol, Progesterone, FSH)", 50, "Hormonal health screening for women over 35", "₹1200-2000", "Annually");
  }

  addTest("Vitamin D (25-hydroxyvitamin D)", 40, "General wellness screening - widespread deficiency in India", "₹800-1200", "Every 6 months");
  addTest("Vitamin B12", 35, "General wellness screening - common deficiency", "₹600-900", "Every 6 months");

  if (profile.digestiveIssues.length > 0) {
    addTest("Stool Analysis", 80, "Gut health assessment for reported digestive issues", "₹500-800", "As needed");
  }

  tests.sort((a, b) => b.priority - a.priority);
  
  // FINAL HARD VALIDATION: Ensure all tests have a valid reason and priority
  const validTests = tests.filter(t => t.priority > 0 && t.reason.length > 0);
  
  return validTests;
}

function buildNarrativeHints(profile: WellnessUserProfile, activeModules: string[]): NarrativeHint[] {
  const hints: NarrativeHint[] = [];
  const conditions = profile.medicalConditions.map(c => c.toLowerCase());
  const globalAvoid: string[] = [];
  if (conditions.includes("diabetes")) globalAvoid.push("high sugar foods", "sugary drinks", "refined carbohydrates");
  if (conditions.includes("hypertension") || conditions.includes("blood-pressure")) globalAvoid.push("high sodium foods", "excessive salt");
  if (profile.foodIntolerances.includes("lactose")) globalAvoid.push("dairy products");
  if (profile.foodIntolerances.includes("gluten")) globalAvoid.push("gluten-containing foods");

  if (activeModules.includes("executive_summary")) {
    hints.push({ section: "executive_summary", tone: "clinical", focusAreas: ["overall health assessment", "key risk areas", "priority action items"], avoidTopics: [] });
  }
  if (activeModules.includes("metabolic_profile")) {
    hints.push({ section: "metabolic_profile", tone: "clinical", focusAreas: ["BMR and TDEE interpretation", "macronutrient ratios", "metabolic efficiency"], avoidTopics: globalAvoid });
  }
  if (activeModules.includes("sleep_protocol")) {
    const tone = profile.sleepScore < 30 ? "urgent" : profile.sleepScore < 50 ? "clinical" : "motivational";
    hints.push({ section: "sleep_protocol", tone, focusAreas: ["sleep hygiene", "circadian rhythm optimization", "recovery enhancement"], avoidTopics: ["stimulant supplements late in day"] });
  }
  if (activeModules.includes("stress_management")) {
    const tone = profile.stressScore > 70 ? "urgent" : "motivational";
    hints.push({ section: "stress_management", tone, focusAreas: ["cortisol management", "breathing techniques", "lifestyle modifications"], avoidTopics: ["high-intensity exercise during acute stress periods"] });
  }
  if (activeModules.includes("fat_loss_program")) {
    hints.push({ section: "fat_loss_program", tone: "motivational", focusAreas: ["caloric deficit strategy", "resistance training", "metabolic adaptation prevention"], avoidTopics: [...globalAvoid, "crash dieting", "extreme caloric restriction"] });
  }
  if (activeModules.includes("muscle_building")) {
    hints.push({ section: "muscle_building", tone: "motivational", focusAreas: ["progressive overload", "protein timing", "recovery optimization"], avoidTopics: [...globalAvoid, "steroid use"] });
  }
  if (activeModules.includes("insulin_management")) {
    hints.push({ section: "insulin_management", tone: "clinical", focusAreas: ["glycemic control", "insulin sensitivity", "low-GI nutrition"], avoidTopics: ["high sugar foods", "refined carbohydrates", "fruit juices"] });
  }
  if (activeModules.includes("thyroid_protocol")) {
    hints.push({ section: "thyroid_protocol", tone: "clinical", focusAreas: ["thyroid-supportive nutrition", "iodine and selenium balance", "medication timing"], avoidTopics: ["excessive cruciferous vegetables", "soy interference with medication"] });
  }
  if (activeModules.includes("cardiovascular")) {
    hints.push({ section: "cardiovascular", tone: "clinical", focusAreas: ["heart-healthy nutrition", "blood pressure management", "aerobic exercise"], avoidTopics: ["high sodium foods", "trans fats", "excessive caffeine"] });
  }
  if (activeModules.includes("gut_health")) {
    hints.push({ section: "gut_health", tone: "motivational", focusAreas: ["microbiome diversity", "fiber intake", "probiotic foods", "trigger identification"], avoidTopics: [...globalAvoid, "processed foods"] });
  }
  if (activeModules.includes("skin_health")) {
    hints.push({ section: "skin_health", tone: "motivational", focusAreas: ["hydration", "antioxidant nutrition", "skin-supportive supplements"], avoidTopics: ["excessive sugar", "processed foods"] });
  }
  if (activeModules.includes("nutrition_strategy")) {
    hints.push({ section: "nutrition_strategy", tone: "motivational", focusAreas: ["meal timing", "portion control", "nutrient density", "regional food options"], avoidTopics: globalAvoid });
  }
  if (activeModules.includes("movement_program")) {
    hints.push({ section: "movement_program", tone: "motivational", focusAreas: ["exercise progression", "activity variety", "injury prevention"], avoidTopics: conditions.includes("hypertension") ? ["heavy isometric exercises", "valsalva maneuver"] : [] });
  }
  return hints;
}

// ════════════════════════════════════════════════════════════
// EXTENDED RULES — calorie logic, snacks, hydration, shift work
// ════════════════════════════════════════════════════════════

function applyGoalCalorieLogic(profile: WellnessUserProfile, riskFlags: RiskFlag[]): void {
  const goals = (profile.goals || []).map(g => g.toLowerCase());
  const wantsGain = goals.some(g => g.includes("gain") || g.includes("muscle"));
  const wantsLoss = goals.some(g => g.includes("los") || g.includes("fat"));

  if (wantsGain) {
    // Ensure calorie surplus is encoded as a flag
    const hasSurplus = riskFlags.some(f => f.category === "GoalCalories");
    if (!hasSurplus) {
      riskFlags.push({
        category: "GoalCalories",
        severity: "low",
        description: "Goal is weight/muscle gain. Calorie target must be SURPLUS (+200–300 kcal above TDEE), not deficit.",
        actionRequired: `Calorie target = TDEE + 200–300 kcal. Focus on lean muscle gain with protein-first meals and progressive resistance training.`,
      });
    }
  } else if (wantsLoss) {
    const hasDeficit = riskFlags.some(f => f.category === "GoalCalories");
    if (!hasDeficit) {
      riskFlags.push({
        category: "GoalCalories",
        severity: "low",
        description: "Goal is fat loss. Calorie target is a deficit (−400–500 kcal below TDEE).",
        actionRequired: "Calorie target = TDEE − 400–500 kcal. Prioritize protein (1.8g/kg) to preserve muscle during fat loss.",
      });
    }
  }
}

function applyLowMealFrequencyRule(profile: WellnessUserProfile, activeModules: string[]): void {
  const mealFreq = profile.mealFrequency || 3;
  if (mealFreq <= 2 && !activeModules.includes("snack_protocol")) {
    activeModules.push("snack_protocol");
  }
}

function applyHydrationRule(profile: WellnessUserProfile, activeModules: string[], riskFlags: RiskFlag[]): void {
  const waterL = profile.waterLiters || profile.waterIntake || 0;
  const hasLowHydration = waterL > 0 && waterL < 1.5;
  if (hasLowHydration && !activeModules.includes("hydration_correction")) {
    activeModules.push("hydration_correction");
    riskFlags.push({
      category: "Hydration",
      severity: "moderate",
      description: `Water intake of ${waterL.toFixed(1)}L/day is below the minimum recommended 1.5–2.5L. Dehydration suppresses thyroid, worsens acidity, and reduces energy.`,
      actionRequired: "Increase water intake gradually: +200ml every 3 days. Add a full glass on waking and 30 min before each meal.",
    });
  }
}

function applyShiftWorkRule(profile: WellnessUserProfile, activeModules: string[]): void {
  const ws = (profile.workSchedule || "").toLowerCase();
  if ((ws.includes("shift") || ws.includes("night") || ws.includes("rotating")) && !activeModules.includes("shift_sleep_protocol")) {
    activeModules.push("shift_sleep_protocol");
  }
}

function applyThyroidLabPriority(profile: WellnessUserProfile, labTests: PrioritizedLabTest[]): void {
  if (!hasCondition(profile, "thyroid")) return;
  const hasTPO = labTests.some(t => t.name.includes("Anti-TPO"));
  if (!hasTPO) {
    labTests.unshift({
      name: "Anti-TPO + Anti-TG (Thyroid Antibodies)",
      priority: 195,
      reason: "Autoimmune thyroid assessment. Sleep deprivation suppresses TSH — get baseline BEFORE starting any supplements.",
      estimatedCostINR: "₹800-1200",
      frequency: "Baseline + every 6 months",
    });
  }
  // Boost existing thyroid panel to very top
  const panelIdx = labTests.findIndex(t => t.name.includes("Thyroid Panel"));
  if (panelIdx >= 0) {
    labTests[panelIdx].priority = 200;
    labTests[panelIdx].reason = "CRITICAL: Get TSH + Free T3 + Free T4 BEFORE starting any supplements. Sleep deprivation suppresses TSH independently of thyroid condition.";
  }
  labTests.sort((a, b) => b.priority - a.priority);
}

function applyDietaryRestrictionNarratives(profile: WellnessUserProfile, hints: NarrativeHint[]): void {
  const intolerances = (profile.foodIntolerances || []).map(f => f.toLowerCase());
  const hasLactose = intolerances.some(f => f.includes("lactose") || f.includes("dairy"));
  const hasGluten = intolerances.some(f => f.includes("gluten"));

  if (hasLactose) {
    hints.push({
      section: "lactose_protocol",
      tone: "clinical",
      focusAreas: [
        "LACTOSE INTOLERANCE ACTIVE: All dairy removed globally",
        "Calcium sources: sesame (til), ragi, fortified oat milk, chia seeds",
        "Replacements: oat milk/soy milk for milk, tofu for paneer, coconut yogurt for curd",
        "Ghee is naturally lactose-free and can be included",
      ],
      avoidTopics: ["milk", "paneer", "curd", "regular yogurt", "cheese", "whey protein"],
    });
  }

  if (hasGluten) {
    hints.push({
      section: "gluten_protocol",
      tone: "clinical",
      focusAreas: [
        "GLUTEN-FREE ACTIVE: All wheat, roti, bread, maida, semolina removed globally",
        "Replacements: rice roti, jowar roti, bajra roti, rice, quinoa, millets",
        "Check labels for hidden gluten: soy sauce, processed foods, some oats",
      ],
      avoidTopics: ["wheat", "roti", "bread", "maida", "semolina", "rava", "pasta", "naan"],
    });
  }
}

export function runRuleEngine(profile: WellnessUserProfile, plan: string = "free"): RuleEngineOutput {
  const riskFlags = buildRiskFlags(profile);
  const activeModules = buildActiveModules(profile, plan);
  const labTestPriority = buildLabTests(profile, riskFlags);
  const narrativeHints = buildNarrativeHints(profile, activeModules);

  // Extended rule applications
  applyGoalCalorieLogic(profile, riskFlags);
  applyLowMealFrequencyRule(profile, activeModules);
  applyHydrationRule(profile, activeModules, riskFlags);
  applyShiftWorkRule(profile, activeModules);
  applyThyroidLabPriority(profile, labTestPriority);
  applyDietaryRestrictionNarratives(profile, narrativeHints);

  const severityProfile = {
    sleepSeverity: evaluateSleepSeverity(profile.sleepScore),
    stressSeverity: evaluateStressSeverity(profile.stressScore),
    weightRisk: evaluateWeightRisk(profile.bmi),
    metabolicRisk: evaluateMetabolicRisk(profile),
  };

  return {
    riskFlags,
    activeModules,
    labTestPriority,
    narrativeHints,
    severityProfile,
  };
}
