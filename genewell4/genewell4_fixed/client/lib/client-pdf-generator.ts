import jsPDF from "jspdf";
import type {
  PDFDataBundle,
  WellnessUserProfile,
  RuleEngineOutput,
  NarrativeOutput,
  MealPlanOutput,
  DayMeal,
  MealItem,
  PrioritizedLabTest,
} from "../../shared/wellness-types";
import { validatePDFBundle, runPreGenerationChecks } from "../../shared/pdf-validation";

export function getEssentialPathologyTests(profile: WellnessUserProfile): Array<{name: string; reason: string; frequency: string}> {
  const tests: Array<{name: string; reason: string; frequency: string}> = [];
  const conditions = (profile.medicalConditions || []).map(c => c.toLowerCase());
  
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
  
  if (conditions.includes("pcos")) {
    // FIX 1: Removed gender==="female" filter. Males with PCOS also have insulin
    // resistance, elevated estrogen, and hormonal imbalance — panel required regardless.
    tests.push({
      name: "Insulin Levels & Hormonal Panel (LH, FSH, Testosterone, Estradiol)",
      reason: profile.gender === "female"
        ? "PCOS management requires insulin sensitivity and hormone monitoring. Draw on Day 2–5 of cycle."
        : "PCOS-related insulin resistance and hormonal imbalance affect males too. Testosterone + LH/FSH baseline required.",
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

// ══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE INTERFACES (legacy exports)
// ══════════════════════════════════════════════════════════════

export interface PersonalizationProfile {
  name: string;
  email: string;
  age: number;
  gender: string;
  estimatedHeightCm: number;
  estimatedWeightKg: number;
  estimatedBMR: number;
  estimatedTDEE: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  stressScore: number;
  sleepScore: number;
  activityScore: number;
  energyScore: number;
  medicalConditions: string[];
  digestiveIssues: string[];
  foodIntolerances: string[];
  skinConcerns: string[];
  dietaryPreference: string;
  exercisePreference: string[];
  workSchedule: string;
  region: string;
  recommendedTests: string[];
  supplementPriority: string[];
  exerciseIntensity: string;
  mealFrequency: number;
  dnaConsent: boolean;
}

export interface PersonalizationInsights {
  metabolicInsight: string;
  recommendedMealTimes: string[];
  calorieRange: { min: number; max: number };
  macroRatios: { protein: number; carbs: number; fats: number };
  supplementStack: Array<{ name: string; reason: string; dosage: string }>;
  workoutStrategy: string;
  sleepStrategy: string;
  stressStrategy: string;
}

export interface PersonalizationData {
  profile: PersonalizationProfile;
  insights: PersonalizationInsights;
}

export type { PersonalizationData as QuizPersonalizationData };

export interface PDFGenerationOptions {
  tier: "free" | "essential" | "premium" | "coaching" | "subscription";
  addOns?: string[];
  orderId: string;
  timestamp: string;
  language?: "en" | "hi";
}

export async function generatePersonalizedPDFClient(personalizationData: PersonalizationData, options: PDFGenerationOptions) {
  const pdf = new jsPDF();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(18);
  pdf.text("Genewell Personalized Blueprint", 20, 20);
  pdf.setFontSize(12);
  pdf.text(`Name: ${personalizationData.profile.name}`, 20, 32);
  pdf.text(`Email: ${personalizationData.profile.email}`, 20, 40);
  pdf.text(`Plan: ${options.tier}`, 20, 48);
  pdf.text(`Language: ${options.language || "en"}`, 20, 56);

  let y = 70;
  pdf.setFontSize(14);
  pdf.text("Insights", 20, y);
  y += 10;
  pdf.setFontSize(10);
  const insightLines = pdf.splitTextToSize(personalizationData.insights.metabolicInsight, 170);
  pdf.text(insightLines, 20, y);
  y += insightLines.length * 5 + 8;

  pdf.text("Recommended Meal Times:", 20, y);
  y += 6;
  personalizationData.insights.recommendedMealTimes.forEach((time) => {
    pdf.text(`• ${time}`, 24, y);
    y += 5;
  });

  return {
    blob: pdf.output("blob"),
    filename: `genewell-blueprint-${options.orderId}.pdf`,
  };
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// PDF CONTEXT & LAYOUT UTILITIES
// ══════════════════════════════════════════════════════════════

interface PDFContext {
  pdf: jsPDF;
  yPosition: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  language: "en" | "hi";
}

function addNewPage(ctx: PDFContext): void {
  ctx.pdf.addPage();
  ctx.yPosition = ctx.margin;
}

// Smart page break: only adds a new page if we are more than 30mm past the top margin
// This prevents blank pages when a section ends near the bottom of a page
function smartNewPage(ctx: PDFContext): void {
  if (ctx.yPosition > ctx.margin + 30) {
    addNewPage(ctx);
  }
}

function checkPageBreak(ctx: PDFContext, spaceNeeded: number): void {
  if (ctx.yPosition + spaceNeeded > ctx.pageHeight - ctx.margin) addNewPage(ctx);
}

function safeText(text: string, language: "en" | "hi"): string {
  if (language !== "hi") {
    return text.replace(/₹/g, "Rs.").replace(/→/g, "->").replace(/←/g, "<-");
  }
  return text;
}

function addHeaderSection(ctx: PDFContext, title: string, subtitle?: string): void {
  checkPageBreak(ctx, 18);
  // Navy left accent bar
  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(ctx.margin, ctx.yPosition - 1, 3, subtitle ? 14 : 10, 'F');
  ctx.pdf.setFontSize(15);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(title, ctx.margin + 6, ctx.yPosition + 7);
  ctx.yPosition += 10;
  if (subtitle) {
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    const lines = ctx.pdf.splitTextToSize(subtitle, ctx.contentWidth - 6);
    ctx.pdf.text(lines, ctx.margin + 6, ctx.yPosition);
    ctx.yPosition += lines.length * 4 + 2;
  }
  ctx.pdf.setDrawColor(...GOLD);
  ctx.pdf.setLineWidth(0.6);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.pageWidth - ctx.margin, ctx.yPosition);
  ctx.pdf.setLineWidth(0.2);
  ctx.yPosition += 4;
}

function addSubSection(ctx: PDFContext, title: string): void {
  checkPageBreak(ctx, 10);
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(74, 85, 104);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(title, ctx.margin, ctx.yPosition);
  ctx.yPosition += 7;
}

function addText(ctx: PDFContext, text: string, size = 10, color: [number, number, number] = [17, 24, 39], isBold = false): void {
  checkPageBreak(ctx, 6);
  ctx.pdf.setFontSize(size);
  ctx.pdf.setTextColor(...color);
  setCtxFont(ctx, isBold ? "bold" : "normal");
  const lines = ctx.pdf.splitTextToSize(safeText(text, ctx.language), ctx.contentWidth);
  ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
  ctx.yPosition += lines.length * 4 + 1.5;
}

function addBullet(ctx: PDFContext, text: string, size = 9): void {
  checkPageBreak(ctx, 5);
  ctx.pdf.setFontSize(size);
  ctx.pdf.setTextColor(17, 24, 39);
  setCtxFont(ctx, "normal");
  const lines = ctx.pdf.splitTextToSize(`• ${safeText(text, ctx.language)}`, ctx.contentWidth - 5);
  ctx.pdf.text(lines, ctx.margin + 5, ctx.yPosition);
  ctx.yPosition += lines.length * 3.5 + 0.8;
}

function addNote(ctx: PDFContext, text: string): void {
  checkPageBreak(ctx, 6);
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(107, 114, 128);
  setCtxFont(ctx, "italic");
  const lines = ctx.pdf.splitTextToSize(safeText(text, ctx.language), ctx.contentWidth);
  ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
  ctx.yPosition += lines.length * 3 + 1.5;
}

function addSpacing(ctx: PDFContext, mm = 3): void {
  ctx.yPosition += mm;
}

// ── Premium Color Palette (Navy + Gold) ──────────────────────
const NAVY: [number, number, number] = [13, 27, 42];
const NAVY_MID: [number, number, number] = [27, 46, 68];
const NAVY_LIGHT: [number, number, number] = [36, 59, 85];
const GOLD: [number, number, number] = [201, 168, 76];
const GOLD_LIGHT: [number, number, number] = [232, 201, 122];
const CREAM: [number, number, number] = [245, 240, 232];
const CREAM_DARK: [number, number, number] = [234, 227, 213];
const TEAL_BG: [number, number, number] = [46, 125, 145];
const RED_ALERT: [number, number, number] = [192, 57, 43];
const GREEN_OK: [number, number, number] = [30, 123, 75];
const ORANGE_WARN: [number, number, number] = [212, 101, 26];
// ── Backward-compat aliases (keep existing render fns working)
const PURPLE: [number, number, number] = [27, 46, 68];
const DARK: [number, number, number] = [13, 27, 42];
const GRAY: [number, number, number] = [107, 114, 128];
const SUBTITLE_GRAY: [number, number, number] = [113, 128, 150];
const SECTION_DARK: [number, number, number] = [74, 85, 104];

const TIER_NAMES: Record<string, string> = {
  free: "Free Edition",
  essential: "Essential Edition",
  premium: "Premium Edition",
  coaching: "Complete Coaching Edition",
  subscription: "All Access Edition",
};

// Subscription plan unlocks everything — treat as coaching + all addons
const isSubscription = (tier: string) => tier === "subscription";
const isPremiumOrAbove = (tier: string) => ["premium", "coaching", "subscription"].includes(tier);
const isCoachingOrAbove = (tier: string) => ["coaching", "subscription"].includes(tier);

function createContext(pdf: jsPDF, language: "en" | "hi" = "en"): PDFContext {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  return { pdf, yPosition: margin, margin, pageWidth, pageHeight, contentWidth: pageWidth - margin * 2, language };
}

function setCtxFont(ctx: PDFContext, style: "normal" | "bold" | "italic" = "normal"): void {
  if (ctx.language === "hi") {
    ctx.pdf.setFont("NotoSansDevanagari", "normal");
  } else {
    ctx.pdf.setFont("helvetica", style);
  }
}

// ══════════════════════════════════════════════════════════════
// PREMIUM HELPER FUNCTIONS (Navy + Gold design system)
// ══════════════════════════════════════════════════════════════

function drawSectionBanner(ctx: PDFContext, number: string, title: string, subtitle = ""): void {
  checkPageBreak(ctx, 24);
  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 18, 'F');
  // Gold section number tag
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(...GOLD_LIGHT);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(number, ctx.margin + 3, ctx.yPosition + 7);
  // White title
  ctx.pdf.setFontSize(13);
  ctx.pdf.setTextColor(255, 255, 255);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(title, ctx.margin + 3, ctx.yPosition + 14);
  ctx.yPosition += 21;
  if (subtitle) {
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    const lines = ctx.pdf.splitTextToSize(subtitle, ctx.contentWidth);
    ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
    ctx.yPosition += lines.length * 4 + 2;
  }
  ctx.yPosition += 2;
}

function drawPremiumTable(
  ctx: PDFContext,
  headers: string[],
  rows: string[][],
  colWidths: number[],
): void {
  const pad = 3;
  const headerH = 9;
  const lineH = 4.2;
  const minRowH = 8.5;
  const maxW = ctx.contentWidth;

  const rowHeights = rows.map(row => {
    let maxLines = 1;
    row.forEach((cell, i) => {
      const w = colWidths[i] || 30;
      const lines = ctx.pdf.splitTextToSize(cell, w - pad * 2);
      maxLines = Math.max(maxLines, lines.length);
    });
    return Math.max(minRowH, maxLines * lineH + 4);
  });

  const totalH = headerH + rowHeights.reduce((a, b) => a + b, 0);
  checkPageBreak(ctx, totalH + 6);
  const startY = ctx.yPosition;

  ctx.pdf.setFillColor(...NAVY_MID);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, maxW, headerH, 'F');
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(...GOLD);
  setCtxFont(ctx, "bold");
  let x = ctx.margin;
  headers.forEach((h, i) => {
    ctx.pdf.text(h.toUpperCase(), x + pad, ctx.yPosition + 6.5);
    x += colWidths[i] || 30;
  });
  ctx.yPosition += headerH;

  rows.forEach((row, rowIdx) => {
    const rowH = rowHeights[rowIdx];
    ctx.pdf.setFillColor(...(rowIdx % 2 === 0 ? CREAM : CREAM_DARK));
    ctx.pdf.rect(ctx.margin, ctx.yPosition, maxW, rowH, 'F');
    ctx.pdf.setFontSize(8);
    setCtxFont(ctx, "normal");
    x = ctx.margin;
    row.forEach((cell, i) => {
      if (cell.includes('★CRIT★')) ctx.pdf.setTextColor(...RED_ALERT);
      else if (cell.includes('★WARN★')) ctx.pdf.setTextColor(...ORANGE_WARN);
      else if (cell.includes('★GOOD★')) ctx.pdf.setTextColor(...GREEN_OK);
      else if (i === 0) ctx.pdf.setTextColor(...NAVY);
      else ctx.pdf.setTextColor(...DARK);
      const displayCell = safeText(cell.replace(/★\w+★/g, '').trim(), ctx.language);
      const cellW = colWidths[i] || 30;
      const lines = ctx.pdf.splitTextToSize(displayCell, cellW - pad * 2);
      lines.forEach((line: string, li: number) => {
        ctx.pdf.text(line, x + pad, ctx.yPosition + 5.5 + li * lineH);
      });
      x += cellW;
    });
    ctx.pdf.setDrawColor(220, 215, 205);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.line(ctx.margin, ctx.yPosition + rowH, ctx.margin + maxW, ctx.yPosition + rowH);
    ctx.yPosition += rowH;
  });

  ctx.pdf.setDrawColor(...NAVY_MID);
  ctx.pdf.setLineWidth(0.4);
  ctx.pdf.rect(ctx.margin, startY, maxW, ctx.yPosition - startY, 'S');
  ctx.yPosition += 5;
}

function drawMetricCards(ctx: PDFContext, cards: Array<{ label: string; value: string; unit: string }>): void {
  const n = cards.length;
  const gap = 3;
  const cardW = (ctx.contentWidth - gap * (n - 1)) / n;
  const cardH = 24;
  checkPageBreak(ctx, cardH + 8);
  let x = ctx.margin;
  cards.forEach(card => {
    ctx.pdf.setFillColor(...NAVY_MID);
    ctx.pdf.rect(x, ctx.yPosition, cardW, cardH, 'F');
    // Gold value
    ctx.pdf.setFontSize(15);
    ctx.pdf.setTextColor(...GOLD);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(card.value, x + cardW / 2, ctx.yPosition + 13, { align: "center" });
    // White unit
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(210, 210, 210);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(card.unit, x + cardW / 2, ctx.yPosition + 18, { align: "center" });
    // Label bar
    ctx.pdf.setFillColor(...NAVY_LIGHT);
    ctx.pdf.rect(x, ctx.yPosition + cardH - 7, cardW, 7, 'F');
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(...GOLD_LIGHT);
    ctx.pdf.text(card.label, x + cardW / 2, ctx.yPosition + cardH - 2, { align: "center" });
    x += cardW + gap;
  });
  ctx.yPosition += cardH + 6;
}

function drawGoldCallout(ctx: PDFContext, title: string, text: string): void {
  const textLines = ctx.pdf.splitTextToSize(text, ctx.contentWidth - 14);
  const boxH = 10 + textLines.length * 5 + 5;
  checkPageBreak(ctx, boxH + 5);
  ctx.pdf.setFillColor(255, 249, 220);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, boxH, 'F');
  ctx.pdf.setFillColor(...GOLD);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, 4, boxH, 'F');
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text("▶  " + title, ctx.margin + 8, ctx.yPosition + 7);
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(60, 40, 10);
  setCtxFont(ctx, "normal");
  textLines.forEach((line: string, idx: number) => {
    ctx.pdf.text(line, ctx.margin + 8, ctx.yPosition + 13 + idx * 5);
  });
  ctx.pdf.setDrawColor(...GOLD);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, boxH, 'S');
  ctx.yPosition += boxH + 5;
}

function drawRootCauseChain(ctx: PDFContext, items: Array<{ label: string; tag: string; color: [number, number, number] }>): void {
  checkPageBreak(ctx, items.length * 13 + 5);
  items.forEach((item, idx) => {
    const blockW = ctx.contentWidth * 0.62;
    ctx.pdf.setFillColor(...item.color);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, blockW, 10, 'F');
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(item.label, ctx.margin + 5, ctx.yPosition + 7);
    // Right tag
    ctx.pdf.setFontSize(7.5);
    ctx.pdf.setTextColor(...item.color);
    setCtxFont(ctx, "normal");
    ctx.pdf.text("■  " + item.tag, ctx.margin + blockW + 6, ctx.yPosition + 7);
    ctx.yPosition += 10;
    if (idx < items.length - 1) {
      ctx.pdf.setFontSize(10);
      ctx.pdf.setTextColor(...GRAY);
      ctx.pdf.text("↓", ctx.margin + 5, ctx.yPosition + 2);
      ctx.yPosition += 4;
    }
  });
  ctx.yPosition += 5;
}

function drawConditionTags(ctx: PDFContext, tags: string[], language: "en" | "hi"): void {
  if (!tags || tags.length === 0) return;
  const tagH = 8;
  const tagPad = 4;
  const maxW = ctx.contentWidth;
  let x = ctx.margin;
  checkPageBreak(ctx, tagH + 5);
  tags.forEach(tag => {
    const tw = ctx.pdf.getStringUnitWidth(tag) * 8 / ctx.pdf.internal.scaleFactor + tagPad * 2;
    const safeTW = Math.max(tw, 28);
    if (x + safeTW > ctx.margin + maxW) {
      x = ctx.margin;
      ctx.yPosition += tagH + 3;
      checkPageBreak(ctx, tagH + 3);
    }
    ctx.pdf.setFillColor(...NAVY_MID);
    ctx.pdf.rect(x, ctx.yPosition, safeTW, tagH, 'F');
    ctx.pdf.setFontSize(7.5);
    ctx.pdf.setTextColor(...GOLD_LIGHT);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(tag, x + tagPad, ctx.yPosition + 5.5);
    x += safeTW + 4;
  });
  ctx.yPosition += tagH + 5;
}

// ── Quick Action Cards (numbered, colored) ─────────────────────
function drawQuickActionCards(ctx: PDFContext, cards: Array<{ number: string; title: string; body: string; color: [number, number, number] }>): void {
  const n = cards.length;
  const gap = 4;
  const cardW = (ctx.contentWidth - gap * (n - 1)) / n;
  const estLines = cards.reduce((max, c) => {
    const lines = ctx.pdf.splitTextToSize(c.body, cardW - 8);
    return Math.max(max, lines.length);
  }, 1);
  const cardH = 14 + estLines * 3.8 + 6;
  checkPageBreak(ctx, cardH + 6);
  let x = ctx.margin;
  cards.forEach(card => {
    // Colored header bar
    ctx.pdf.setFillColor(...card.color);
    ctx.pdf.rect(x, ctx.yPosition, cardW, 12, 'F');
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(`${card.number}  ${card.title}`, x + 4, ctx.yPosition + 8.5);
    // Cream body
    ctx.pdf.setFillColor(...CREAM);
    ctx.pdf.rect(x, ctx.yPosition + 12, cardW, cardH - 12, 'F');
    ctx.pdf.setFontSize(7.5);
    ctx.pdf.setTextColor(...DARK);
    setCtxFont(ctx, "normal");
    const bodyLines = ctx.pdf.splitTextToSize(safeText(card.body, ctx.language), cardW - 8);
    bodyLines.forEach((line: string, li: number) => {
      ctx.pdf.text(line, x + 4, ctx.yPosition + 20 + li * 3.8);
    });
    // Border
    ctx.pdf.setDrawColor(...card.color);
    ctx.pdf.setLineWidth(0.4);
    ctx.pdf.rect(x, ctx.yPosition, cardW, cardH, 'S');
    x += cardW + gap;
  });
  ctx.yPosition += cardH + 5;
}

// ── Phase Timeline Block ──────────────────────────────────────
function drawPhaseBlocks(ctx: PDFContext, phases: Array<{ label: string; weeks: string; items: string[]; color: [number, number, number] }>): void {
  phases.forEach(phase => {
    const totalItems = phase.items.length;
    const blockH = 12 + totalItems * 5.5 + 4;
    checkPageBreak(ctx, blockH + 4);
    // Left colored band
    ctx.pdf.setFillColor(...phase.color);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 5, blockH, 'F');
    // Background
    ctx.pdf.setFillColor(...CREAM);
    ctx.pdf.rect(ctx.margin + 5, ctx.yPosition, ctx.contentWidth - 5, blockH, 'F');
    // Phase label
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...phase.color);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(phase.label, ctx.margin + 9, ctx.yPosition + 8);
    // Weeks tag
    ctx.pdf.setFontSize(7.5);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(`[${phase.weeks}]`, ctx.margin + 9 + ctx.pdf.getStringUnitWidth(phase.label) * 9 / ctx.pdf.internal.scaleFactor + 4, ctx.yPosition + 8);
    // Items
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...DARK);
    phase.items.forEach((item, idx) => {
      const yOff = ctx.yPosition + 13 + idx * 5.5;
      ctx.pdf.text("✓", ctx.margin + 9, yOff);
      const lines = ctx.pdf.splitTextToSize(safeText(item, ctx.language), ctx.contentWidth - 20);
      ctx.pdf.text(lines[0] || "", ctx.margin + 14, yOff);
    });
    // Border
    ctx.pdf.setDrawColor(...phase.color);
    ctx.pdf.setLineWidth(0.3);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, blockH, 'S');
    ctx.yPosition += blockH + 4;
  });
}

// ── Checklist Table ────────────────────────────────────────────
function drawChecklistTable(ctx: PDFContext, title: string, rows: string[], color: [number, number, number] = NAVY): void {
  const rowH = 7;
  const totalH = 10 + rows.length * rowH;
  checkPageBreak(ctx, totalH + 4);
  // Header
  ctx.pdf.setFillColor(...color);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 10, 'F');
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(255, 255, 255);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(title.toUpperCase(), ctx.margin + 4, ctx.yPosition + 7);
  ctx.yPosition += 10;
  // Rows
  rows.forEach((row, idx) => {
    ctx.pdf.setFillColor(...(idx % 2 === 0 ? CREAM : CREAM_DARK));
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, rowH, 'F');
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...DARK);
    setCtxFont(ctx, "normal");
    // Checkbox square
    ctx.pdf.setDrawColor(...color);
    ctx.pdf.setLineWidth(0.4);
    ctx.pdf.rect(ctx.margin + 3, ctx.yPosition + 1.5, 4, 4, 'S');
    ctx.pdf.text(safeText(row, ctx.language), ctx.margin + 10, ctx.yPosition + 5.5);
    ctx.yPosition += rowH;
  });
  ctx.pdf.setDrawColor(...color);
  ctx.pdf.setLineWidth(0.4);
  ctx.pdf.rect(ctx.margin, ctx.yPosition - rows.length * rowH - 10, ctx.contentWidth, totalH, 'S');
  ctx.yPosition += 4;
}

// ══════════════════════════════════════════════════════════════
// SECTION RENDERERS
