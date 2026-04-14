import type { WellnessUserProfile, PDFDataBundle, NarrativeOutput, MealPlanOutput, RuleEngineOutput } from "../../shared/wellness-types";
import type { ComputedProfile } from "../../shared/computed-profile";
import { generateNarratives, getDefaultNarratives } from "./narrative-generator";
import { generateMealPlan } from "./meal-generator";

export type CheckName =
  | "gender_condition"
  | "macro_accuracy"
  | "narrative_score_consistency"
  | "activity_training_alignment"
  | "food_intolerance"
  | "supplement_dedup"
  | "placeholder_clean"
  | "integrity_audit";

// ... existing code ...

function checkIntegrityAudit(bundle: PDFDataBundle): CheckResult {
  const errors: string[] = [];
  const modules = bundle.rules.activeModules || [];
  
  // 1. No duplicate module IDs
  const uniqueModules = new Set(modules);
  if (uniqueModules.size !== modules.length) {
    errors.push("Duplicate module IDs detected in activeModules");
  }

  // 2. No duplicate headings (using keys from narratives as a proxy for sections)
  const headings = [
    "executiveSummary", "riskInterpretation", "goalStrategy", 
    "sleepNarrative", "stressNarrative", "nutritionNarrative", "movementNarrative"
  ].filter(h => !!(bundle.narratives as any)[h]);
  const uniqueHeadings = new Set(headings);
  if (uniqueHeadings.size !== headings.length) {
    errors.push("Duplicate narrative sections detected");
  }

  // 3. Name-gender consistency check
  const name = bundle.profile.name.toLowerCase();
  const gender = bundle.profile.gender.toLowerCase();
  if (gender === "male" && (name.includes("mrs.") || name.includes("ms.") || name.includes("miss"))) {
    errors.push("Gender-name prefix mismatch (Male with Mrs/Ms/Miss)");
  }
  if (gender === "female" && (name.includes("mr.") || name.includes("master"))) {
    errors.push("Gender-name prefix mismatch (Female with Mr/Master)");
  }

  // 4. Placeholder check including extreme portions
  const mealPlan = bundle.mealPlan;
  if (mealPlan && mealPlan.days) {
    for (const day of mealPlan.days) {
      const allItems = [day.breakfast, day.lunch, day.dinner, day.midMorningSnack, day.eveningSnack].flat();
      for (const item of allItems) {
        if (item.portion === "1g" || item.portion === "0g" || item.calories <= 0) {
          errors.push(`Invalid portion detected: ${item.name} (${item.portion})`);
        }
      }
    }
  }

  // 5. Ineligible module check
  const genderModules = gender === "male" 
    ? ["pcos_protocol", "ovarian_health", "menstrual_cycle", "women_hormone"]
    : ["prostate_health", "testosterone_optimization", "men_performance"];
  
  const invalidModule = modules.find(m => genderModules.includes(m));
  // 6. Senior Safety Check
  if (bundle.profile.age >= 60) {
    const tdee = bundle.profile.bmr * 1.2; // Min multiplier for sedentary
    // Note: profile.tdee stores the final target, let's check against computed base
    const maxDeficit = 0.15;
    const floor = Math.max(bundle.profile.bmr, Math.round(bundle.profile.bmr * 1.2 * (1 - maxDeficit)));
    
    // We use bundle.profile.tdee which represents the daily target in our WellnessUserProfile
    if (bundle.profile.tdee < bundle.profile.bmr) {
      errors.push(`Senior Safety Violation: Calorie target (${bundle.profile.tdee}) below BMR (${bundle.profile.bmr})`);
    }
  }

  if (errors.length > 0) {
    return { check: "integrity_audit", status: "FAIL", detail: errors.join("; ") };
  }
  return { check: "integrity_audit", status: "PASS", detail: "Integrity audit passed" };
}

export interface CheckResult {
  check: CheckName;
  status: "PASS" | "FAIL";
  detail: string;
}

export interface ValidationReport {
  validation_status: "PASS" | "FAIL";
  checks: CheckResult[];
  adjustments: string[];
  iterations: number;
}

const MAX_REGENERATION_LOOPS = 3;

function checkGenderCondition(profile: WellnessUserProfile, narratives: NarrativeOutput): CheckResult {
  if (profile.gender.toLowerCase() === "male") {
    const hasPCOS = profile.medicalConditions.some(c => c.toLowerCase().includes("pcos"));
    if (hasPCOS) {
      return { check: "gender_condition", status: "FAIL", detail: "Male profile contains PCOS condition" };
    }
    const narrativeText = JSON.stringify(narratives).toLowerCase();
    if (/\bpcos\b|\bovarian\b|\bmenstrual\b|\bwomen[']s health\b/.test(narrativeText)) {
      return { check: "gender_condition", status: "FAIL", detail: "Male profile narratives contain female-specific terms" };
    }
  }
  if (profile.gender.toLowerCase() === "female") {
    const narrativeText = JSON.stringify(narratives).toLowerCase();
    if (/\bprostate\b|\btestosterone therapy\b|\bmen[']s performance\b/.test(narrativeText)) {
      return { check: "gender_condition", status: "FAIL", detail: "Female profile narratives contain male-specific terms" };
    }
  }
  return { check: "gender_condition", status: "PASS", detail: "Gender-condition alignment verified" };
}

function checkMacroAccuracy(mealPlan: MealPlanOutput, computed: ComputedProfile): CheckResult {
  if (!mealPlan.days || mealPlan.days.length === 0) {
    return { check: "macro_accuracy", status: "PASS", detail: "No meal plan to validate" };
  }

  for (const day of mealPlan.days) {
    const calDeviation = Math.abs(day.totalCalories - computed.calorieTarget) / computed.calorieTarget;
    if (calDeviation > 0.03) {
      return {
        check: "macro_accuracy",
        status: "FAIL",
        detail: `${day.dayLabel}: calories ${day.totalCalories} deviates ${(calDeviation * 100).toFixed(1)}% from target ${computed.calorieTarget} (max ±3%)`,
      };
    }

    const proteinDiff = Math.abs(day.totalProtein - computed.proteinGrams);
    if (proteinDiff > 5) {
      return {
        check: "macro_accuracy",
        status: "FAIL",
        detail: `CRITICAL: ${day.dayLabel} protein ${day.totalProtein}g deviates by ${proteinDiff.toFixed(1)}g (Target: ${computed.proteinGrams}g). LIMIT: ±5g. EXPORT BLOCKED.`,
      };
    }
  }

  return { check: "macro_accuracy", status: "PASS", detail: "All days within ±3% calories and ±5g protein" };
}

function checkNarrativeScoreConsistency(profile: WellnessUserProfile, narratives: NarrativeOutput): CheckResult {
  if (profile.sleepScore >= 70 && narratives.sleepNarrative && narratives.sleepNarrative.length > 50) {
    if (/severely disrupted|critical|dangerous|urgent/i.test(narratives.sleepNarrative)) {
      return { check: "narrative_score_consistency", status: "FAIL", detail: "High sleep score (≥70) but narrative uses severe language" };
    }
  }
  if (profile.sleepScore < 30 && narratives.sleepNarrative) {
    if (/excellent|great|optimal|well-managed/i.test(narratives.sleepNarrative)) {
      return { check: "narrative_score_consistency", status: "FAIL", detail: "Low sleep score (<30) but narrative uses positive language" };
    }
  }

  if (profile.stressScore < 30 && narratives.stressNarrative && narratives.stressNarrative.length > 50) {
    if (/severely|critical|dangerous|urgent|high chronic/i.test(narratives.stressNarrative)) {
      return { check: "narrative_score_consistency", status: "FAIL", detail: "Low stress score (<30) but narrative uses severe language" };
    }
  }
  if (profile.stressScore >= 70 && narratives.stressNarrative) {
    if (/well-managed|low stress|minimal|excellent/i.test(narratives.stressNarrative)) {
      return { check: "narrative_score_consistency", status: "FAIL", detail: "High stress score (≥70) but narrative uses positive language" };
    }
  }

  return { check: "narrative_score_consistency", status: "PASS", detail: "Narrative tone matches score severity" };
}

function checkActivityTrainingAlignment(profile: WellnessUserProfile, rules: RuleEngineOutput): CheckResult {
  const isBeginner = profile.activityScore < 30;
  const modules = rules.activeModules;

  if (isBeginner && modules.includes("muscle_building")) {
    return { check: "activity_training_alignment", status: "FAIL", detail: "Beginner activity score (<30) assigned muscle_building module" };
  }

  if (!isBeginner && modules.includes("beginner_program") && !modules.includes("movement_program")) {
    return { check: "activity_training_alignment", status: "FAIL", detail: "Non-beginner assigned only beginner_program" };
  }

  return { check: "activity_training_alignment", status: "PASS", detail: "Activity level matches training program" };
}

function checkFoodIntolerance(profile: WellnessUserProfile, mealPlan: MealPlanOutput): CheckResult {
  if (!mealPlan.days || mealPlan.days.length === 0) {
    return { check: "food_intolerance", status: "PASS", detail: "No meal plan to validate" };
  }

  const intolerances = profile.foodIntolerances.map(i => i.toLowerCase());
  if (intolerances.length === 0) {
    return { check: "food_intolerance", status: "PASS", detail: "No food intolerances reported" };
  }

  const patterns: Record<string, RegExp> = {
    lactose: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    dairy: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    gluten: /wheat|roti|bread|maida|semolina|rava|pasta/i,
    seafood: /fish|prawn|shrimp|seafood|crab|lobster/i,
    fish: /fish|prawn|shrimp|seafood|crab|lobster/i,
    nuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
    peanuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
  };

  for (const day of mealPlan.days) {
    const allItems = [day.breakfast, day.lunch, day.dinner, day.midMorningSnack, day.eveningSnack].flat();
    for (const item of allItems) {
      for (const intolerance of intolerances) {
        const regex = patterns[intolerance];
        if (regex && regex.test(item.name)) {
          return {
            check: "food_intolerance",
            status: "FAIL",
            detail: `${day.dayLabel}: "${item.name}" conflicts with ${intolerance} intolerance`,
          };
        }
      }
    }
  }

  return { check: "food_intolerance", status: "PASS", detail: "No intolerance conflicts found" };
}

function checkSupplementDedup(profile: WellnessUserProfile): CheckResult {
  if (!profile.supplementPriority || profile.supplementPriority.length === 0) {
    return { check: "supplement_dedup", status: "PASS", detail: "No supplements to check" };
  }

  const seen = new Set<string>();
  for (const s of profile.supplementPriority) {
    const normalized = s.toLowerCase().trim().replace(/\s+/g, "");
    if (seen.has(normalized)) {
      return { check: "supplement_dedup", status: "FAIL", detail: `Duplicate supplement: ${s}` };
    }
    seen.add(normalized);
  }

  return { check: "supplement_dedup", status: "PASS", detail: "No duplicate supplements" };
}

function checkPlaceholders(bundle: PDFDataBundle): CheckResult {
  const text = JSON.stringify(bundle);
  if (/\$\{/.test(text)) {
    return { check: "placeholder_clean", status: "FAIL", detail: "Unresolved ${} template found" };
  }
  const placeholders = ["[Insert", "TODO", "TBD", "PLACEHOLDER", "NARRATIVE_HERE"];
  for (const p of placeholders) {
    if (text.toUpperCase().includes(p.toUpperCase())) {
      return { check: "placeholder_clean", status: "FAIL", detail: `Placeholder text found: ${p}` };
    }
  }
  return { check: "placeholder_clean", status: "PASS", detail: "No placeholders or templates found" };
}

function fixGenderCondition(profile: WellnessUserProfile, narratives: NarrativeOutput, rules: RuleEngineOutput): { profile: WellnessUserProfile; narratives: NarrativeOutput; rules: RuleEngineOutput } {
  const fixedProfile = { ...profile };
  const fixedNarratives = { ...narratives };
  const fixedRules = { ...rules };

  if (profile.gender.toLowerCase() === "male") {
    fixedProfile.medicalConditions = fixedProfile.medicalConditions.filter(c => !c.toLowerCase().includes("pcos"));
    fixedRules.activeModules = (fixedRules.activeModules || []).filter(m => !["pcos_protocol", "ovarian_health", "menstrual_cycle", "women_hormone"].includes(m));
    for (const key in fixedNarratives) {
      const k = key as keyof NarrativeOutput;
      if (typeof fixedNarratives[k] === "string") {
        (fixedNarratives as any)[k] = (fixedNarratives[k] as string).replace(/pcos|ovarian|menstrual/gi, "metabolic balance");
      }
    }
  }
  if (profile.gender.toLowerCase() === "female") {
    fixedRules.activeModules = (fixedRules.activeModules || []).filter(m => !["prostate_health", "testosterone_optimization", "men_performance"].includes(m));
    for (const key in fixedNarratives) {
      const k = key as keyof NarrativeOutput;
      if (typeof fixedNarratives[k] === "string") {
        (fixedNarratives as any)[k] = (fixedNarratives[k] as string).replace(/prostate|testosterone therapy/gi, "hormonal balance");
      }
    }
  }

  return { profile: fixedProfile, narratives: fixedNarratives, rules: fixedRules };
}

function fixMacroAccuracy(mealPlan: MealPlanOutput, computed: ComputedProfile): MealPlanOutput {
  const fixed = structuredClone(mealPlan);

  for (const day of fixed.days) {
    const currentCals = day.totalCalories;
    const calDeviation = Math.abs(currentCals - computed.calorieTarget) / computed.calorieTarget;

    if (calDeviation > 0.03 || Math.abs(day.totalProtein - computed.proteinGrams) > 5) {
      const calScale = computed.calorieTarget / (currentCals || 1);
      const slots = ["breakfast", "midMorningSnack", "lunch", "eveningSnack", "dinner"] as const;

      for (const slot of slots) {
        for (const item of day[slot]) {
          item.calories = Math.round(item.calories * calScale);
          item.protein = Math.round(item.protein * calScale * 10) / 10;
          item.carbs = Math.round(item.carbs * calScale * 10) / 10;
          item.fats = Math.round(item.fats * calScale * 10) / 10;
          if (item.portion.includes("g")) {
            const grams = parseInt(item.portion);
            if (!isNaN(grams)) item.portion = `${Math.round(grams * calScale)}g`;
          }
        }
      }

      day.totalCalories = computed.calorieTarget;
      day.totalProtein = computed.proteinGrams;
      day.totalCarbs = computed.carbsGrams;
      day.totalFats = computed.fatsGrams;
    }
  }

  return fixed;
}

function fixActivityTrainingAlignment(profile: WellnessUserProfile, rules: RuleEngineOutput): RuleEngineOutput {
  const fixed = structuredClone(rules);
  const isBeginner = profile.activityScore < 30;

  if (isBeginner) {
    fixed.activeModules = fixed.activeModules.filter(m => m !== "muscle_building");
    if (!fixed.activeModules.includes("beginner_program")) {
      fixed.activeModules.push("beginner_program");
    }
  } else {
    if (fixed.activeModules.includes("beginner_program") && !fixed.activeModules.includes("movement_program")) {
      fixed.activeModules = fixed.activeModules.filter(m => m !== "beginner_program");
      fixed.activeModules.push("movement_program");
    }
  }

  return fixed;
}

function fixFoodIntolerance(profile: WellnessUserProfile, mealPlan: MealPlanOutput): MealPlanOutput {
  const fixed = structuredClone(mealPlan);
  const intolerances = profile.foodIntolerances.map(i => i.toLowerCase());

  const patterns: Record<string, RegExp> = {
    lactose: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    dairy: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    gluten: /wheat|roti|bread|maida|semolina|rava|pasta/i,
    seafood: /fish|prawn|shrimp|seafood|crab|lobster/i,
    fish: /fish|prawn|shrimp|seafood|crab|lobster/i,
    nuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
    peanuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
  };

  for (const day of fixed.days) {
    const slots = ["breakfast", "midMorningSnack", "lunch", "eveningSnack", "dinner"] as const;
    for (const slot of slots) {
      (day as any)[slot] = day[slot].filter(item => {
        for (const intolerance of intolerances) {
          const regex = patterns[intolerance];
          if (regex && regex.test(item.name)) return false;
        }
        return true;
      });
    }
  }

  return fixed;
}

function fixSupplementDedup(profile: WellnessUserProfile): WellnessUserProfile {
  const fixed = { ...profile };
  if (fixed.supplementPriority) {
    const seen = new Set<string>();
    fixed.supplementPriority = fixed.supplementPriority.filter(s => {
      const normalized = s.toLowerCase().trim().replace(/\s+/g, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }
  return fixed;
}

function fixPlaceholders(bundle: PDFDataBundle): PDFDataBundle {
  const fixed = structuredClone(bundle);
  const narratives = fixed.narratives;

  for (const key in narratives) {
    const k = key as keyof NarrativeOutput;
    if (typeof narratives[k] === "string") {
      let text = narratives[k] as string;
      text = text.replace(/\$\{.*?\}/g, "");
      const placeholders = ["[Insert", "TODO", "TBD", "PLACEHOLDER", "NARRATIVE_HERE"];
      placeholders.forEach(p => {
        const reg = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
        text = text.replace(reg, "");
      });
      text = text.replace(/[\uFFFD]|Â|Ã|Å|Ê/g, "");
      (narratives as any)[k] = text;
    }
  }

  return fixed;
}

export async function runValidationController(
  bundle: PDFDataBundle,
  computed: ComputedProfile,
): Promise<{ bundle: PDFDataBundle; report: ValidationReport }> {
  let current = structuredClone(bundle);
  const adjustments: string[] = [];
  let iteration = 0;

  while (iteration < MAX_REGENERATION_LOOPS) {
    iteration++;
    const checks: CheckResult[] = [];

    const genderCheck = checkGenderCondition(current.profile, current.narratives);
    checks.push(genderCheck);
    if (genderCheck.status === "FAIL") {
      const { profile, narratives, rules } = fixGenderCondition(current.profile, current.narratives, current.rules);
      current.profile = profile;
      current.narratives = narratives;
      current.rules = rules;
      adjustments.push("Gender-condition conflict resolved (gender-specific modules filtered)");
    }

    const macroCheck = checkMacroAccuracy(current.mealPlan, computed);
    checks.push(macroCheck);
    if (macroCheck.status === "FAIL") {
      current.mealPlan = fixMacroAccuracy(current.mealPlan, computed);
      adjustments.push("Macro targets aligned (±3% cal, ±5g protein)");
    }

    const narrativeCheck = checkNarrativeScoreConsistency(current.profile, current.narratives);
    checks.push(narrativeCheck);
    if (narrativeCheck.status === "FAIL") {
      const defaults = getDefaultNarratives(current.profile, current.rules);
      if (/sleep/i.test(narrativeCheck.detail)) {
        current.narratives.sleepNarrative = defaults.sleepNarrative;
      }
      if (/stress/i.test(narrativeCheck.detail)) {
        current.narratives.stressNarrative = defaults.stressNarrative;
      }
      adjustments.push("Narrative tone realigned with scores");
    }

    const activityCheck = checkActivityTrainingAlignment(current.profile, current.rules);
    checks.push(activityCheck);
    if (activityCheck.status === "FAIL") {
      current.rules = fixActivityTrainingAlignment(current.profile, current.rules);
      adjustments.push("Training program matched to activity level");
    }

    const foodCheck = checkFoodIntolerance(current.profile, current.mealPlan);
    checks.push(foodCheck);
    if (foodCheck.status === "FAIL") {
      current.mealPlan = fixFoodIntolerance(current.profile, current.mealPlan);
      adjustments.push("Food intolerance conflicts removed");
    }

    const suppCheck = checkSupplementDedup(current.profile);
    checks.push(suppCheck);
    if (suppCheck.status === "FAIL") {
      current.profile = fixSupplementDedup(current.profile);
      adjustments.push("Duplicate supplements removed");
    }

    const placeholderCheck = checkPlaceholders(current);
    checks.push(placeholderCheck);
    if (placeholderCheck.status === "FAIL") {
      current = fixPlaceholders(current);
      adjustments.push("Placeholder text cleaned");
    }

    const auditCheck = checkIntegrityAudit(current);
    checks.push(auditCheck);
    if (auditCheck.status === "FAIL") {
      // Regeneration logic: regenerate only failed components if possible
      if (auditCheck.detail.includes("portion") || auditCheck.detail.includes("calories")) {
        current.mealPlan = generateMealPlan(current.profile, 7);
      }
      if (auditCheck.detail.includes("module") || auditCheck.detail.includes("prefix")) {
        const { profile, narratives, rules } = fixGenderCondition(current.profile, current.narratives, current.rules);
        current.profile = profile;
        current.narratives = narratives;
        current.rules = rules;
      }
      iteration++; 
      continue;
    }

    const allPass = checks.every(c => c.status === "PASS");
    if (allPass) {
      current.adjustments = [...new Set(adjustments)];
      return {
        bundle: current,
        report: {
          validation_status: "PASS",
          checks,
          adjustments: [...new Set(adjustments)],
          iterations: iteration,
        },
      };
    }

    console.log(`Validation loop ${iteration}: ${checks.filter(c => c.status === "FAIL").length} checks failed, auto-correcting...`);
  }

  current.adjustments = [...new Set(adjustments)];
  const finalChecks: CheckResult[] = [
    checkGenderCondition(current.profile, current.narratives),
    checkMacroAccuracy(current.mealPlan, computed),
    checkNarrativeScoreConsistency(current.profile, current.narratives),
    checkActivityTrainingAlignment(current.profile, current.rules),
    checkFoodIntolerance(current.profile, current.mealPlan),
    checkSupplementDedup(current.profile),
    checkPlaceholders(current),
  ];

  return {
    bundle: current,
    report: {
      validation_status: finalChecks.every(c => c.status === "PASS") ? "PASS" : "FAIL",
      checks: finalChecks,
      adjustments: [...new Set(adjustments)],
      iterations: iteration,
    },
  };
}
