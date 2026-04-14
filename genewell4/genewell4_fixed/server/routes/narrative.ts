import { Router } from "express";
import type { Request, Response } from "express";
import { runRuleEngine } from "../lib/rule-engine";
import { generateNarratives } from "../lib/narrative-generator";
import { generateMealPlan } from "../lib/meal-generator";
import { runValidationController } from "../lib/validation-controller";
import { buildComputedProfile, toWellnessUserProfile } from "../../shared/computed-profile";
import { QuizInputSchema } from "../../shared/input-schema";
import type { WellnessUserProfile, PDFDataBundle } from "../../shared/wellness-types";

const router = Router();

router.post("/api/generate-narratives", async (req: Request, res: Response) => {
  try {
    const { profile } = req.body as { profile: WellnessUserProfile };
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    const rules = runRuleEngine(profile);
    const narratives = await generateNarratives(profile, rules);

    res.json({ narratives, rules });
  } catch (error) {
    console.error("Error generating narratives:", error);
    res.status(500).json({ error: "Failed to generate narratives" });
  }
});

router.post("/api/generate-meal-plan", async (req: Request, res: Response) => {
  try {
    const { profile, numDays } = req.body as { profile: WellnessUserProfile; numDays?: number };
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    const mealPlan = generateMealPlan(profile, numDays || 7);

    res.json({ mealPlan });
  } catch (error) {
    console.error("Error generating meal plan:", error);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
});

router.post("/api/generate-pdf-data", async (req: Request, res: Response) => {
  try {
    // ═══════════════════════════════════════════════
    // LAYER 1: INPUT VALIDATION (strict schema)
    // Converts legacy WellnessUserProfile → QuizInput
    // then validates with Zod. Rejects invalid types.
    // ═══════════════════════════════════════════════
    const body = req.body;
    if (!body.profile || !body.tier || !body.orderId) {
      return res.status(400).json({ error: "Missing required fields: profile, tier, orderId" });
    }

    const p = body.profile;

    const candidateInput = {
      name: p.name,
      email: p.email,
      phone: p.phone || "",
      gender: p.gender,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      sleepScore: p.sleepScore,
      stressScore: p.stressScore,
      activityScore: p.activityScore,
      energyScore: p.energyScore,
      goals: p.goals,
      medicalConditions: p.medicalConditions,
      digestiveIssues: p.digestiveIssues,
      foodIntolerances: p.foodIntolerances,
      skinConcerns: p.skinConcerns,
      dietaryPreference: p.dietaryPreference,
      exercisePreference: p.exercisePreference,
      exerciseIntensity: p.exerciseIntensity,
      workSchedule: p.workSchedule,
      region: p.region,
      mealFrequency: p.mealFrequency,
      dnaConsent: p.dnaConsent,
    };

    const schemaResult = QuizInputSchema.safeParse(candidateInput);
    if (!schemaResult.success) {
      return res.status(400).json({
        error: "Input validation failed — invalid types or missing required fields",
        details: schemaResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
      });
    }

    const rawInput = schemaResult.data;

    const validTiers = ["free", "essential", "premium", "coaching"] as const;
    if (!(validTiers as readonly string[]).includes(body.tier)) {
      return res.status(400).json({ error: `Invalid tier: ${body.tier}. Must be one of: ${validTiers.join(", ")}` });
    }

    const tier = body.tier as "free" | "essential" | "premium" | "coaching";
    const addOns: string[] = Array.isArray(body.addOns) ? body.addOns : [];
    const orderId: string = String(body.orderId);
    const numDays: number = Number(body.numDays) || 7;

    // ═══════════════════════════════════════════════
    // LAYER 2: CENTRAL COMPUTATION (single source of truth)
    // ═══════════════════════════════════════════════
    const computed = buildComputedProfile(rawInput);
    const wellnessProfile = toWellnessUserProfile({ input: rawInput, computed });

    // ═══════════════════════════════════════════════
    // GENERATION: Rule engine + Narratives + Meal plan
    // (LLM only writes summaries, never calculates)
    // ═══════════════════════════════════════════════
    const rules = runRuleEngine(wellnessProfile, tier);
    const narratives = await generateNarratives(wellnessProfile, rules);

    const includeMealPlan = tier === "premium" || tier === "coaching";
    const mealPlan = includeMealPlan
      ? generateMealPlan(wellnessProfile, numDays)
      : generateMealPlan(wellnessProfile, 1);

    const bundle: PDFDataBundle = {
      profile: wellnessProfile,
      rules,
      narratives,
      mealPlan,
      tier,
      addOns,
      orderId,
      timestamp: new Date().toISOString(),
    };

    // ═══════════════════════════════════════════════
    // LAYER 3: GLOBAL VALIDATION CONTROLLER
    // Loops until validation_status = PASS
    // ═══════════════════════════════════════════════
    const { bundle: validatedBundle, report } = await runValidationController(bundle, computed);

    console.log(`PDF validation: status=${report.validation_status}, iterations=${report.iterations}, adjustments=${report.adjustments.length}`);

    if (report.validation_status === "FAIL") {
      return res.status(422).json({ 
        error: "PDF generation failed validation checks after multiple attempts",
        details: report.checks.filter(c => c.status === "FAIL").map(c => c.detail)
      });
    }

    res.json(validatedBundle);
  } catch (error) {
    console.error("Error generating PDF data:", error);
    res.status(500).json({ error: "Failed to generate PDF data" });
  }
});

export default router;
