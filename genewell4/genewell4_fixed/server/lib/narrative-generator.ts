import OpenAI from "openai";
import type { WellnessUserProfile, RuleEngineOutput, NarrativeOutput } from "../../shared/wellness-types";

let openai: OpenAI | null = null;
try {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
} catch (err) {
  console.warn("OpenAI client initialization failed:", err);
}

export function getDefaultNarratives(profile: WellnessUserProfile, rules: RuleEngineOutput): NarrativeOutput {
  const bmiCategory = rules.severityProfile.weightRisk;
  const bmiDesc = bmiCategory === "normal"
    ? `Your BMI of ${profile.bmi.toFixed(1)} falls within the healthy range.`
    : bmiCategory === "overweight"
    ? `Your BMI of ${profile.bmi.toFixed(1)} indicates you are in the overweight category.`
    : bmiCategory === "obese"
    ? `Your BMI of ${profile.bmi.toFixed(1)} indicates obesity, which requires focused attention.`
    : `Your BMI of ${profile.bmi.toFixed(1)} indicates you are underweight.`;

  const executiveSummary = `${bmiDesc} Your estimated Total Daily Energy Expenditure (TDEE) is ${profile.tdee} kcal, which forms the foundation of your nutrition plan. Based on your health profile, we have identified ${rules.riskFlags.length} area(s) requiring attention. This blueprint is designed to provide you with an evidence-based, actionable wellness strategy tailored to your unique needs.`;

  const riskInterpretation = rules.riskFlags.length > 0
    ? `Your health assessment has identified risks in the following areas: ${rules.riskFlags.map(f => f.category).join(", ")}. ${rules.riskFlags.filter(f => f.severity === "high" || f.severity === "critical").length > 0 ? "Some of these require immediate attention and are addressed in detail within this blueprint." : "These are manageable with the lifestyle modifications outlined in this blueprint."}`
    : "Your health assessment shows no major risk flags. Focus on maintaining your current healthy habits while optimizing the areas highlighted in this blueprint.";

  const goalStrategy = `Your stated goals include: ${profile.goals.join(", ")}. To achieve these, we recommend a structured approach combining targeted nutrition (${profile.tdee} kcal/day with ${profile.proteinGrams}g protein, ${profile.carbsGrams}g carbs, ${profile.fatsGrams}g fats), progressive exercise, and lifestyle modifications. Consistency over the next 12 weeks will be key to seeing measurable results.`;

  let sleepNarrative = "";
  if (rules.severityProfile.sleepSeverity !== "normal") {
    const sleepDesc = rules.severityProfile.sleepSeverity === "severe"
      ? `Your sleep score of ${profile.sleepScore} indicates severely disrupted sleep patterns that are likely impacting your recovery, metabolism, and cognitive function.`
      : rules.severityProfile.sleepSeverity === "moderate"
      ? `Your sleep score of ${profile.sleepScore} suggests moderate sleep disruption that may be affecting your energy levels and recovery.`
      : `Your sleep score of ${profile.sleepScore} shows mild room for improvement in your sleep quality.`;
    sleepNarrative = `${sleepDesc} Implementing a consistent sleep schedule and optimizing your sleep environment will be important components of your wellness journey.`;
  }

  let stressNarrative = "";
  if (rules.severityProfile.stressSeverity !== "normal") {
    const stressDesc = rules.severityProfile.stressSeverity === "severe"
      ? `Your stress score of ${profile.stressScore} indicates high chronic stress levels that may be elevating cortisol and impacting weight management, sleep, and immune function.`
      : rules.severityProfile.stressSeverity === "moderate"
      ? `Your stress score of ${profile.stressScore} suggests moderate stress levels that could benefit from structured stress management techniques.`
      : `Your stress score of ${profile.stressScore} shows mild stress that can be managed with daily breathing exercises and mindfulness practices.`;
    stressNarrative = `${stressDesc} Incorporating daily stress-reduction practices will support your overall health goals.`;
  }

  const nutritionNarrative = `Based on your TDEE of ${profile.tdee} kcal and ${profile.dietaryPreference} dietary preference, your daily macro targets are ${profile.proteinGrams}g protein, ${profile.carbsGrams}g carbs, and ${profile.fatsGrams}g fats. Your meal plan is structured around ${profile.mealFrequency} meals per day, incorporating nutrient-dense foods aligned with Indian dietary patterns. Focus on whole grains, legumes, seasonal vegetables, and adequate protein sources to meet your nutritional needs.`;

  const activityDesc = profile.activityScore < 40
    ? "low activity level"
    : profile.activityScore < 70
    ? "moderate activity level"
    : "good activity level";
  const movementNarrative = `Your activity score of ${profile.activityScore} reflects a ${activityDesc}. Based on your preferences for ${profile.exercisePreference.join(", ")} at ${profile.exerciseIntensity} intensity, we have designed a progressive movement program. Aim for consistent weekly sessions, gradually increasing duration and intensity as your fitness improves.`;

  const conditionNarratives: Record<string, string> = {};
  for (const condition of profile.medicalConditions) {
    const condLower = condition.toLowerCase();
    if (condLower.includes("pcos")) {
      conditionNarratives[condition] = `Your PCOS management plan focuses on insulin sensitivity improvement through low-glycemic nutrition and regular physical activity. Monitoring key hormonal markers and maintaining a balanced weight will be essential for managing symptoms effectively.`;
    } else if (condLower.includes("thyroid")) {
      conditionNarratives[condition] = `Your thyroid condition requires ongoing monitoring and nutrition adjustments. Focus on thyroid-supportive nutrients including selenium and iodine while being mindful of medication timing with meals.`;
    } else if (condLower.includes("diabetes")) {
      conditionNarratives[condition] = `Your diabetes management centres on glycemic control through careful carbohydrate management and regular blood sugar monitoring. Regular HbA1c testing and a low-glycemic diet will help maintain stable blood sugar levels.`;
    } else if (condLower.includes("hypertension") || condLower.includes("blood-pressure")) {
      conditionNarratives[condition] = `Your blood pressure management plan includes sodium restriction, potassium-rich foods, and regular cardiovascular exercise. Consistent monitoring and stress management will support healthy blood pressure levels.`;
    } else {
      conditionNarratives[condition] = `Your ${condition} management is integrated into your overall wellness strategy. Follow the specific dietary and lifestyle recommendations outlined in this blueprint for optimal management.`;
    }
  }

  return {
    executiveSummary,
    riskInterpretation,
    goalStrategy,
    sleepNarrative,
    stressNarrative,
    nutritionNarrative,
    movementNarrative,
    conditionNarratives,
  };
}

export async function generateNarratives(profile: WellnessUserProfile, rules: RuleEngineOutput): Promise<NarrativeOutput> {
  const defaults = getDefaultNarratives(profile, rules);

  if (!openai) {
    console.warn("OpenAI client not available, using default narratives");
    return defaults;
  }

  try {
    const systemPrompt = `You are a clinical wellness expert. Rewrite the provided narratives into clinical but warm, evidence-based text.
   
CRITICAL CONSTRAINTS:
- You MUST ONLY rewrite the provided sections. 
- You CANNOT add, remove, duplicate, or reorder any sections.
- You MUST strictly use the pre-computed numbers provided. NEVER perform your own calculations.
- Maintain the exact JSON structure provided in the template.
- Each section should be 2-4 sentences maximum.
- Tone must match severity: severe scores get urgent language, normal scores get positive language.

Response Template:
{
  "executiveSummary": "Rewrite here",
  "riskInterpretation": "Rewrite here",
  "goalStrategy": "Rewrite here",
  "sleepNarrative": "Rewrite here (only if provided)",
  "stressNarrative": "Rewrite here (only if provided)",
  "nutritionNarrative": "Rewrite here",
  "movementNarrative": "Rewrite here",
  "conditionNarratives": { "conditionName": "Rewrite here" }
}`;

    const userPrompt = `Generate personalized wellness narratives for this user. USE ONLY the pre-computed numbers below. Do NOT recalculate anything.

PROFILE (raw input):
- Name: ${profile.name}
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg

COMPUTED DATA (use these exact numbers, do not recalculate):
- BMI: ${profile.bmi.toFixed(1)}, BMR: ${profile.bmr} kcal, Daily Calorie Target: ${profile.tdee} kcal
- Macros: Protein ${profile.proteinGrams}g, Carbs ${profile.carbsGrams}g, Fats ${profile.fatsGrams}g
- Dietary Preference: ${profile.dietaryPreference}
- Meal Frequency: ${profile.mealFrequency} meals/day

SCORES:
- Sleep Score: ${profile.sleepScore}/100
- Stress Score: ${profile.stressScore}/100
- Activity Score: ${profile.activityScore}/100
- Energy Score: ${profile.energyScore}/100

SEVERITY PROFILE:
- Sleep: ${rules.severityProfile.sleepSeverity}
- Stress: ${rules.severityProfile.stressSeverity}
- Weight Risk: ${rules.severityProfile.weightRisk}
- Metabolic Risk: ${rules.severityProfile.metabolicRisk}

MEDICAL CONDITIONS: ${profile.medicalConditions.length > 0 ? profile.medicalConditions.join(", ") : "None"}
DIGESTIVE ISSUES: ${profile.digestiveIssues.length > 0 ? profile.digestiveIssues.join(", ") : "None"}
FOOD INTOLERANCES: ${profile.foodIntolerances.length > 0 ? profile.foodIntolerances.join(", ") : "None"}
SKIN CONCERNS: ${profile.skinConcerns.length > 0 ? profile.skinConcerns.join(", ") : "None"}

GOALS: ${profile.goals.join(", ")}
EXERCISE PREFERENCES: ${profile.exercisePreference.join(", ")} at ${profile.exerciseIntensity} intensity
WORK SCHEDULE: ${profile.workSchedule}
REGION: ${profile.region}

RISK FLAGS:
${rules.riskFlags.map(f => `- [${f.severity.toUpperCase()}] ${f.category}: ${f.description}`).join("\n")}

ACTIVE MODULES: ${rules.activeModules.join(", ")}

Remember:
- If sleepSeverity is "normal", set sleepNarrative to ""
- If stressSeverity is "normal", set stressNarrative to ""
- Only include conditions the user actually has in conditionNarratives
- Reference their actual numbers (BMI, TDEE, scores) in the narratives`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("Empty response from OpenAI, using default narratives");
      return defaults;
    }

    const parsed = JSON.parse(content) as Partial<NarrativeOutput>;

    return {
      executiveSummary: parsed.executiveSummary || defaults.executiveSummary,
      riskInterpretation: parsed.riskInterpretation || defaults.riskInterpretation,
      goalStrategy: parsed.goalStrategy || defaults.goalStrategy,
      sleepNarrative: parsed.sleepNarrative ?? defaults.sleepNarrative,
      stressNarrative: parsed.stressNarrative ?? defaults.stressNarrative,
      nutritionNarrative: parsed.nutritionNarrative || defaults.nutritionNarrative,
      movementNarrative: parsed.movementNarrative || defaults.movementNarrative,
      conditionNarratives: parsed.conditionNarratives && Object.keys(parsed.conditionNarratives).length > 0
        ? parsed.conditionNarratives
        : defaults.conditionNarratives,
    };
  } catch (error) {
    console.error("Failed to generate AI narratives, using defaults:", error);
    return defaults;
  }
}
