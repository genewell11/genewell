import type { WellnessUserProfile, RuleEngineOutput } from "./wellness-types";

export interface TemplateContext {
  profile: WellnessUserProfile;
  rules: RuleEngineOutput;
  language: "en" | "hi";
}

/**
 * Resolve {{placeholders}} in narrative text using computed profile values.
 * Supports bilingual output via language context.
 */
export function resolveTemplatePlaceholders(text: string, ctx: TemplateContext): string {
  const { profile, rules } = ctx;
  const l = (en: string, hi: string) => ctx.language === "hi" ? hi : en;

  const bmi = Math.round((profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2))) * 10) / 10;
  const tdee = profile.tdee || profile.estimatedTDEE || 2000;
  const goals = (profile.goals || []).map((g: string) => g.toLowerCase());
  const wantsGain = goals.some(g => g.includes("gain") || g.includes("muscle"));
  const wantsLoss = goals.some(g => g.includes("los") || g.includes("fat"));
  const calMin = wantsGain ? tdee + 200 : wantsLoss ? tdee - 500 : tdee + 100;
  const calMax = wantsGain ? tdee + 300 : wantsLoss ? tdee - 400 : tdee + 200;
  // FIX: Use actual sleepHours from profile if available; fall back to deriving from score only as last resort
  const sleepHours = profile.sleepHours ?? Math.round((profile.sleepScore / 100) * 8 * 10) / 10;

  const hasLactose = (profile.foodIntolerances || []).some(f => f.toLowerCase().includes("lactose") || f.toLowerCase().includes("dairy"));
  const hasGluten = (profile.foodIntolerances || []).some(f => f.toLowerCase().includes("gluten"));
  const hasThyroid = (profile.medicalConditions || []).some(c => c.toLowerCase().includes("thyroid"));
  const mealFreq = profile.mealFrequency || 3;

  const goalLogic = wantsGain
    ? l(
        `Your goal is WEIGHT GAIN. Calorie target = TDEE + 200–300 kcal surplus = ${calMin}–${calMax} kcal/day. Focus: lean muscle gain, NOT fat restriction.`,
        `आपका लक्ष्य वजन बढ़ाना है। कैलोरी लक्ष्य = TDEE + 200–300 kcal = ${calMin}–${calMax} kcal/दिन। ध्यान: दुबली मांसपेशी।`
      )
    : wantsLoss
    ? l(
        `Your goal is FAT LOSS. Calorie target = TDEE − 400–500 kcal deficit = ${calMin}–${calMax} kcal/day. Optimal for muscle preservation.`,
        `आपका लक्ष्य वसा घटाना है। कैलोरी लक्ष्य = TDEE − 400–500 kcal = ${calMin}–${calMax} kcal/दिन।`
      )
    : l(
        `Your goal is GENERAL WELLNESS. Calorie target = ${calMin}–${calMax} kcal/day for gradual recomposition.`,
        `आपका लक्ष्य सामान्य स्वास्थ्य है। कैलोरी लक्ष्य = ${calMin}–${calMax} kcal/दिन।`
      );

  const mealLogic = mealFreq <= 2
    ? l(
        `You eat ${mealFreq} meals/day — too few for your calorie target. Add a mid-morning snack (300–400 kcal) and evening snack (200–300 kcal).`,
        `आप ${mealFreq} भोजन/दिन खाते हैं — आपके कैलोरी लक्ष्य के लिए बहुत कम। मध्य-सुबह (300–400 kcal) और शाम का नाश्ता (200–300 kcal) जोड़ें।`
      )
    : l(
        `Your ${mealFreq} meals/day eating frequency is appropriate. Maintain consistent timing.`,
        `आपकी ${mealFreq} भोजन/दिन की आवृत्ति उचित है। निरंतर समय बनाए रखें।`
      );

  const sleepLogic = sleepHours <= 5
    ? l(
        `CRITICAL: Your sleep of ${sleepHours} hrs/night is severely inadequate. Sleep deprivation suppresses thyroid (TSH), elevates cortisol, and blocks muscle gain even at calorie surplus. Target bedtime anchoring immediately.`,
        `गंभीर: आपकी ${sleepHours} घंटे/रात की नींद बहुत अपर्याप्त है। नींद की कमी थायरॉइड (TSH) दबाती है और मांसपेशी लाभ को रोकती है।`
      )
    : sleepHours <= 6
    ? l(
        `Your sleep of ${sleepHours} hrs/night is below the 7–8 hr target. Improving sleep duration will directly boost energy and recovery.`,
        `आपकी ${sleepHours} घंटे/रात की नींद 7–8 घंटे के लक्ष्य से कम है।`
      )
    : l(
        `Your sleep of ${sleepHours} hrs/night is good. Maintain consistency in sleep-wake timing.`,
        `आपकी ${sleepHours} घंटे/रात की नींद अच्छी है।`
      );

  const dietLogic = hasLactose && hasGluten
    ? l("All dairy AND gluten removed from meal suggestions throughout this report.", "इस रिपोर्ट में सभी डेयरी और ग्लूटन हटाया गया है।")
    : hasLactose
    ? l("All dairy removed. Calcium from sesame, ragi, fortified oat milk, chia seeds.", "सभी डेयरी हटाई गई। कैल्शियम: तिल, रागी, फोर्टिफाइड ओट मिल्क।")
    : hasGluten
    ? l("All gluten (wheat, roti, bread, maida) removed. Use rice, millets, jowar, bajra.", "सभी ग्लूटन (गेहूं, रोटी, ब्रेड) हटाया गया। चावल, बाजरा, ज्वार उपयोग करें।")
    : l("No dietary restrictions detected. Full food variety available.", "कोई आहार प्रतिबंध नहीं।");

  const hydrationLogic = (() => {
    const waterL = profile.waterLiters || profile.waterIntake || 1.5;
    const targetL = profile.weightKg > 70 ? 2.5 : profile.weightKg > 55 ? 2.3 : 2.0;
    if (waterL < 1.5) {
      return l(
        `You drink ${waterL.toFixed(1)}L/day — below your ${targetL}L target. Dehydration suppresses thyroid function and worsens acidity.`,
        `आप ${waterL.toFixed(1)}L/दिन पीते हैं — ${targetL}L लक्ष्य से कम।`
      );
    }
    return l(`Aim for ${targetL}L/day (${Math.round(targetL * 4)} glasses).`, `${targetL}L/दिन का लक्ष्य रखें।`);
  })();

  const supplementLogic = hasThyroid
    ? l(
        "THYROID DETECTED: Get TSH + Free T3 + Free T4 BEFORE starting supplements. Selenium 200mcg safe; avoid iodine supplements without testing; check with doctor before ashwagandha.",
        "थायरॉइड: सप्लीमेंट से पहले TSH + T3 + T4 परीक्षण। सेलेनियम 200mcg सुरक्षित; आयोडीन सप्लीमेंट बिना परीक्षण के नहीं।"
      )
    : l("Standard supplement stack: Vitamin D3, Omega-3, Magnesium bisglycinate.", "मानक सप्लीमेंट: विटामिन D3, ओमेगा-3, मैग्नीशियम बिसग्लाइसिनेट।");

  const addonLogic = l(
    "Add-ons are personalized extensions that provide deeper protocols for specific health goals.",
    "ऐड-ऑन विशिष्ट स्वास्थ्य लक्ष्यों के लिए गहरे प्रोटोकॉल प्रदान करते हैं।"
  );

  const replacements: Record<string, string> = {
    "{{goal_logic}}": goalLogic,
    "{{meal_logic}}": mealLogic,
    "{{sleep_logic}}": sleepLogic,
    "{{diet_logic}}": dietLogic,
    "{{hydration_logic}}": hydrationLogic,
    "{{supplement_logic}}": supplementLogic,
    "{{addon_logic}}": addonLogic,
    "{{name}}": profile.name,
    "{{age}}": String(profile.age),
    "{{gender}}": profile.gender,
    "{{bmi}}": String(bmi),
    "{{tdee}}": String(tdee),
    "{{calorie_min}}": String(calMin),
    "{{calorie_max}}": String(calMax),
    "{{protein_g}}": String(profile.proteinGrams || Math.round(profile.weightKg * 1.8)),
    "{{sleep_hours}}": String(sleepHours),
    "{{meal_frequency}}": String(mealFreq),
    "{{calorie_target}}": `${calMin}–${calMax}`,
  };

  let resolved = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return resolved;
}

/**
 * Resolve placeholders in all string fields of a narratives object.
 */
export function resolveNarratives(
  narratives: Record<string, string>,
  ctx: TemplateContext
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(narratives)) {
    resolved[key] = typeof value === "string" ? resolveTemplatePlaceholders(value, ctx) : value;
  }
  return resolved;
}
