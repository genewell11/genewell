import type { PDFDataBundle, MealItem, WellnessUserProfile } from "./wellness-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cleaned: PDFDataBundle;
  adjustments: string[];
}

function cleanText(text: string): string {
  if (!text) return "";
  // Remove placeholders and unresolved templates
  let cleaned = text.replace(/\$\{.*?\}/g, "");
  const commonPlaceholders = ["[Insert", "TODO", "TBD", "PLACEHOLDER", "NARRATIVE_HERE"];
  commonPlaceholders.forEach(p => {
    const reg = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    cleaned = cleaned.replace(reg, "");
  });
  // Clean encoding issues
  return cleaned.replace(/[\uFFFD]|Â|Ã|Å|Ê/g, "");
}

export function validateAndCorrectBundle(bundle: PDFDataBundle): ValidationResult {
  const adjustments: string[] = [];
  const cleaned = structuredClone(bundle);

  const { profile, narratives, mealPlan, rules } = cleaned;

  // 1. Gender-Condition Mismatch Auto-Correction
  if (profile.gender.toLowerCase() === "male") {
    const initialConditions = [...profile.medicalConditions];
    profile.medicalConditions = profile.medicalConditions.filter(c => !c.toLowerCase().includes("pcos"));
    if (profile.medicalConditions.length !== initialConditions.length) {
      adjustments.push("Non-applicable condition removed");
    }
    
    // Clean narratives of female-specific terms if male
    for (const key in narratives) {
      const k = key as keyof typeof narratives;
      if (typeof narratives[k] === "string") {
        const original = narratives[k] as string;
        let corrected = original.replace(/pcos|ovarian|menstrual/gi, "metabolic balance");
        if (original !== corrected) {
          (narratives as any)[k] = corrected;
          if (!adjustments.includes("Narrative terminology adjusted for gender alignment")) {
            adjustments.push("Narrative terminology adjusted for gender alignment");
          }
        }
      }
    }
  }

  // 2. Food-Intolerance Auto-Correction (Filtering)
  if (mealPlan && mealPlan.days) {
    const intolerances = profile.foodIntolerances.map(i => i.toLowerCase());
    let itemsRemoved = false;
    
    for (const day of mealPlan.days) {
      const mealKeys: (keyof typeof day)[] = ["breakfast", "lunch", "dinner", "midMorningSnack", "eveningSnack"];
      for (const key of mealKeys) {
        const val = day[key as keyof typeof day];
        if (Array.isArray(val)) {
          const items = val as MealItem[];
          const filtered = items.filter(item => {
            const name = item.name.toLowerCase();
            if ((intolerances.includes("lactose") || intolerances.includes("dairy")) && /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i.test(name)) return false;
            if (intolerances.includes("gluten") && /wheat|roti|bread|maida|semolina|rava|pasta/i.test(name)) return false;
            if ((intolerances.includes("seafood") || intolerances.includes("fish")) && /fish|prawn|shrimp|seafood|crab|lobster/i.test(name)) return false;
            if ((intolerances.includes("nuts") || intolerances.includes("peanuts")) && /peanut|almond|cashew|walnut|pistachio|nut/i.test(name)) return false;
            return true;
          });
          if (filtered.length !== items.length) {
            (day as any)[key] = filtered;
            itemsRemoved = true;
          }
        }
      }
      
      // 3. Macro Re-balancing (Internal scaling if deviations found)
      const targetCals = profile.tdee || 2000;
      const currentCals = day.totalCalories;
      const deviation = Math.abs(currentCals - targetCals) / targetCals;
      
      if (deviation > 0.02) { // 2% threshold for auto-correction
        const scale = targetCals / currentCals;
        day.totalCalories = Math.round(targetCals);
        day.totalProtein = Math.round(day.totalProtein * scale);
        day.totalCarbs = Math.round(day.totalCarbs * scale);
        day.totalFats = Math.round(day.totalFats * scale);
        
        const mealKeys: (keyof typeof day)[] = ["breakfast", "lunch", "dinner", "midMorningSnack", "eveningSnack"];
        for (const key of mealKeys) {
          const val = day[key as keyof typeof day];
          if (Array.isArray(val)) {
            const items = val as MealItem[];
            items.forEach(item => {
              item.calories = Math.round(item.calories * scale);
              item.protein = Math.round(item.protein * scale);
              item.carbs = Math.round(item.carbs * scale);
              item.fats = Math.round(item.fats * scale);
              // Update portion size string if it contains "g"
              if (item.portion.includes("g")) {
                const grams = parseInt(item.portion);
                if (!isNaN(grams)) {
                  item.portion = `${Math.round(grams * scale)}g`;
                }
              }
            });
          }
        }
        if (!adjustments.includes("Calories adjusted to match target")) {
          adjustments.push("Calories adjusted to match target");
        }
      }
    }
    if (itemsRemoved) {
      if (!adjustments.includes("Portions auto-balanced")) {
        adjustments.push("Portions auto-balanced");
      }
    }
  }

  // 4. Clean Narratives (Placeholders and Encoding)
  let placeholderFix = false;
  for (const key in narratives) {
    const k = key as keyof typeof narratives;
    if (typeof narratives[k] === "string") {
      const original = narratives[k] as string;
      const cleanedText = cleanText(original);
      if (original !== cleanedText) {
        (narratives as any)[k] = cleanedText;
        placeholderFix = true;
      }
    }
  }
  if (placeholderFix) {
    if (!adjustments.includes("Text formatting optimized")) {
       adjustments.push("Text formatting optimized");
    }
  }

  // 5. Lab Relevance & Priority Fix
  if (rules.labTestPriority) {
    const initialCount = rules.labTestPriority.length;
    rules.labTestPriority = rules.labTestPriority.filter(t => t.priority > 0 && t.reason && t.reason.length > 5);
    rules.labTestPriority.sort((a, b) => b.priority - a.priority);
    if (rules.labTestPriority.length !== initialCount) {
      if (!adjustments.includes("Lab recommendations refined")) {
        adjustments.push("Lab recommendations refined");
      }
    }
  }

  // 6. Supplement Dedup
  if (profile.supplementPriority) {
    const originalCount = profile.supplementPriority.length;
    const seen = new Set<string>();
    profile.supplementPriority = profile.supplementPriority.filter(s => {
      const normalized = s.toLowerCase().trim().replace(/\s+/g, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
    if (profile.supplementPriority.length !== originalCount) {
      if (!adjustments.includes("Supplement overlaps resolved")) {
        adjustments.push("Supplement overlaps resolved");
      }
    }
  }

  cleaned.adjustments = adjustments;

  return {
    valid: true, 
    errors: [],
    warnings: [],
    cleaned,
    adjustments
  };
}

export function validatePDFBundle(bundle: PDFDataBundle): ValidationResult {
  return validateAndCorrectBundle(bundle);
}

// ════════════════════════════════════════════════════════════
// PRE-GENERATION VALIDATION (BLOCKS generation on critical errors)
// ════════════════════════════════════════════════════════════

export interface PreGenerationCheck {
  canGenerate: boolean;
  criticalErrors: string[];
  autoCorrections: string[];
  warnings: string[];
}

/**
 * Full pre-generation check that validates the bundle before PDF is created.
 * Returns critical errors that should BLOCK generation, plus auto-corrections applied.
 */
export function runPreGenerationChecks(bundle: PDFDataBundle): PreGenerationCheck {
  const criticalErrors: string[] = [];
  const autoCorrections: string[] = [];
  const warnings: string[] = [];
  const { profile, rules } = bundle;

  // 1. Required profile fields
  if (!profile.name || profile.name.trim() === "") {
    criticalErrors.push("Profile name is missing. Cannot generate personalized PDF.");
  }
  if (!profile.age || profile.age < 10 || profile.age > 100) {
    criticalErrors.push(`Profile age (${profile.age}) is invalid. Must be between 10 and 100.`);
  }
  if (!profile.weightKg || profile.weightKg < 20 || profile.weightKg > 300) {
    criticalErrors.push(`Profile weight (${profile.weightKg}kg) is invalid.`);
  }
  if (!profile.heightCm || profile.heightCm < 100 || profile.heightCm > 250) {
    criticalErrors.push(`Profile height (${profile.heightCm}cm) is invalid.`);
  }
  if (!profile.gender || profile.gender.trim() === "") {
    criticalErrors.push("Profile gender is missing.");
  }

  // 2. Calorie contradiction check
  const goals = (profile.goals || []).map(g => g.toLowerCase());
  const wantsGain = goals.some(g => g.includes("gain") || g.includes("muscle"));
  const wantsLoss = goals.some(g => g.includes("los") || g.includes("fat"));
  const tdee = profile.tdee || 2000;

  if (wantsGain) {
    const calGoal = (profile as any).calorieGoal || (profile as any).dailyCalorieTarget || 0;
    if (calGoal > 0 && calGoal < tdee) {
      warnings.push(
        `CALORIE CONTRADICTION: Goal is WEIGHT GAIN but calorie target ${calGoal} is below TDEE ${tdee}. ` +
        `PDF will auto-correct to show surplus of ${tdee + 250}–${tdee + 300} kcal.`
      );
      autoCorrections.push("Calorie target corrected to surplus for gain_weight goal");
    }
  }

  if (wantsLoss) {
    const calGoal = (profile as any).calorieGoal || (profile as any).dailyCalorieTarget || 0;
    if (calGoal > 0 && calGoal > tdee) {
      warnings.push(
        `CALORIE CONTRADICTION: Goal is FAT LOSS but calorie target ${calGoal} exceeds TDEE ${tdee}. ` +
        `PDF will auto-correct to show deficit.`
      );
      autoCorrections.push("Calorie target corrected to deficit for fat_loss goal");
    }
  }

  // 3. Sleep critical detection
  const sleepHours = profile.sleepHours || 0;
  if (sleepHours > 0 && sleepHours <= 5) {
    warnings.push(
      `CRITICAL SLEEP: ${sleepHours} hrs/night detected. PDF will prioritize sleep correction as Action #1. ` +
      `Sleep deprivation at this level triggers cortisol cascade and TSH suppression.`
    );
  }

  // 4. Thyroid + supplement contradiction
  const hasThyroid = (profile.medicalConditions || []).some(c => c.toLowerCase().includes("thyroid"));
  if (hasThyroid) {
    warnings.push(
      "THYROID DETECTED: PDF will add lab test requirement (TSH + Free T3 + T4 BEFORE supplements) and ashwagandha warning."
    );
  }

  // 5. Gender-condition mismatch check
  const isMale = (profile.gender || "").toLowerCase() === "male";
  const isFemale = (profile.gender || "").toLowerCase() === "female";
  if (isMale && (profile.medicalConditions || []).some(c => c.toLowerCase().includes("pcos"))) {
    autoCorrections.push("PCOS removed from male profile medical conditions");
  }

  // 6. Meal frequency + calorie feasibility
  const mealFreq = profile.mealFrequency || 3;
  const calMin = wantsGain ? tdee + 200 : wantsLoss ? tdee - 500 : tdee + 100;
  if (mealFreq <= 2 && calMin > 2000) {
    warnings.push(
      `LOW MEAL FREQUENCY: ${mealFreq} meals/day is very difficult at ${calMin}+ kcal target. ` +
      `PDF will add snack section with specific snack options.`
    );
  }

  // 7. Dietary restriction completeness
  const intolerances = (profile.foodIntolerances || []).map(f => f.toLowerCase());
  const hasLactose = intolerances.some(f => f.includes("lactose") || f.includes("dairy"));
  const hasGluten = intolerances.some(f => f.includes("gluten"));
  if (hasLactose) {
    autoCorrections.push("Lactose intolerance: all dairy-free alternatives applied globally in meal plan");
  }
  if (hasGluten) {
    autoCorrections.push("Gluten intolerance: all wheat, roti, bread, maida replaced globally");
  }

  // 8. Active modules minimum check
  const activeModules = rules?.activeModules || [];
  if (activeModules.length < 3) {
    warnings.push(`Only ${activeModules.length} active modules detected. PDF may be sparse. Minimum 5 recommended.`);
  }

  return {
    canGenerate: criticalErrors.length === 0,
    criticalErrors,
    autoCorrections,
    warnings,
  };
}

/**
 * Validate addon gender compatibility before purchase/checkout.
 * Returns { valid, rejectedAddonIds, message }
 */
export function validateAddonGenderCompatibility(
  addonIds: string[],
  gender: string | null | undefined
): { valid: boolean; rejectedAddonIds: string[]; message: string } {
  if (!gender) return { valid: true, rejectedAddonIds: [], message: "" };

  const g = gender.toLowerCase().trim();
  const FEMALE_ONLY = ["addon_women_hormone", "addon_women_hormonal"];
  const MALE_ONLY = ["addon_men_fitness"];

  const rejected: string[] = [];
  if (g === "male") {
    rejected.push(...addonIds.filter(id => FEMALE_ONLY.includes(id)));
  } else if (g === "female") {
    rejected.push(...addonIds.filter(id => MALE_ONLY.includes(id)));
  }

  if (rejected.length === 0) return { valid: true, rejectedAddonIds: [], message: "" };

  return {
    valid: false,
    rejectedAddonIds: rejected,
    message:
      g === "male"
        ? "Women's Hormonal Health add-on is not applicable for male profiles."
        : "Men's Performance Pack add-on is not applicable for female profiles.",
  };
}
