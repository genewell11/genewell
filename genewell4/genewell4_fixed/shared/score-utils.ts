export type ScoreLevel = "high" | "moderate" | "low";

export function classifyScore(score: number): ScoreLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

export type SleepSeverity = "normal" | "mild" | "moderate" | "severe";
export type StressSeverity = "normal" | "mild" | "moderate" | "severe";
export type WeightRisk = "underweight" | "normal" | "overweight" | "obese";
export type MetabolicRisk = "low" | "moderate" | "high";

export function evaluateSleepSeverity(sleepScore: number): SleepSeverity {
  if (sleepScore < 30) return "severe";
  if (sleepScore < 50) return "moderate";
  if (sleepScore < 70) return "mild";
  return "normal";
}

export function evaluateStressSeverity(stressScore: number): StressSeverity {
  // 0-30 = normal (low risk)
  // 31-70 = moderate
  // 71-100 = severe (high risk)
  if (stressScore >= 71) return "severe";
  if (stressScore >= 31) return "moderate";
  return "normal";
}

export function evaluateWeightRisk(bmi: number): WeightRisk {
  if (bmi < 18.5) return "underweight";
  if (bmi > 30) return "obese";
  if (bmi > 27) return "overweight";
  return "normal";
}

export function isScoreHigh(score: number): boolean {
  return score >= 70;
}

export function isScoreModerate(score: number): boolean {
  return score >= 40 && score < 70;
}

export function isScoreLow(score: number): boolean {
  return score < 40;
}

export function scoreInterpretation(label: string, score: number): string {
  if (label === "Stress Resilience") {
    if (score >= 71) return "High stress load — nervous system support is priority";
    if (score >= 31) return "Elevated stress — daily management techniques are essential";
    return "Well-managed — continue current practices";
  }

  const level = classifyScore(score);
  const interpretations: Record<string, Record<ScoreLevel, string>> = {
    "Energy Level": {
      low: "Needs immediate attention — likely linked to sleep, nutrition, or stress",
      moderate: "Below optimal — targeted changes will help significantly",
      high: "Good to excellent — focus on maintaining consistency",
    },
    "Sleep Quality": {
      low: "Critical — sleep is likely impacting all other health areas",
      moderate: "Moderate — sleep protocol will be transformative for you",
      high: "Decent to strong — maintain your current sleep habits",
    },
    "Physical Activity": {
      low: "Sedentary — gradual movement introduction needed",
      moderate: "Light to moderate activity — structured exercise will boost energy",
      high: "Active — progressive training will optimize results",
    },
  };
  return interpretations[label]?.[level] || `Score: ${score}/100`;
}
