import { z } from "zod";

export const GenderEnum = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof GenderEnum>;

export const QuizInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  phone: z.string().regex(/^\d{10,15}$/, "Phone number must be exactly 10-15 digits"),
  gender: GenderEnum,
  age: z.number().int().min(10, "Age must be at least 10").max(120, "Age must be under 120"),
  heightCm: z.number().min(100, "Height must be at least 100cm").max(250, "Height must be under 250cm"),
  weightKg: z.number().min(20, "Weight must be at least 20kg").max(300, "Weight must be under 300kg"),

  sleepScore: z.number().min(0).max(100),
  stressScore: z.number().min(0).max(100),
  activityScore: z.number().min(0).max(100),
  energyScore: z.number().min(0).max(100),

  goals: z.array(z.string()).min(1, "At least one goal required"),
  medicalConditions: z.array(z.string()),
  digestiveIssues: z.array(z.string()),
  foodIntolerances: z.array(z.string()),
  skinConcerns: z.array(z.string()),

  dietaryPreference: z.enum(["veg", "non-veg", "vegan", "eggetarian"]),
  exercisePreference: z.array(z.string()),
  exerciseIntensity: z.enum(["low", "moderate", "high"]),
  workSchedule: z.string(),
  region: z.string(),
  mealFrequency: z.number().int().min(1).max(6),
  dnaConsent: z.boolean(),
});

export type QuizInput = z.infer<typeof QuizInputSchema>;

export const PDFRequestSchema = z.object({
  profile: QuizInputSchema,
  tier: z.enum(["free", "essential", "premium", "coaching", "subscription"]),
  addOns: z.array(z.string()).default([]),
  orderId: z.string().min(1, "Order ID required"),
  numDays: z.number().int().min(1).max(14).default(7),
});

export type PDFRequest = z.infer<typeof PDFRequestSchema>;

export function validateQuizInput(data: unknown): { success: true; data: QuizInput } | { success: false; errors: string[] } {
  const result = QuizInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}

export function validatePDFRequest(data: unknown): { success: true; data: PDFRequest } | { success: false; errors: string[] } {
  const result = PDFRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}
