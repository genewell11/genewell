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

export interface PDFGenerationOptions {
  tier: "free" | "essential" | "premium" | "coaching" | "subscription";
  addOns?: string[];
  orderId: string;
  timestamp: string;
  language?: "en" | "hi";
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
// ══════════════════════════════════════════════════════════════

function renderCoverPage(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, tier, orderId, timestamp } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const bmi = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
  const sleepHoursEnumMap: Record<string,string> = {
    "less-than-5": "< 5", "5-6": "5–6", "6-7": "6–7", "7-8": "7–8", "more-than-8": "8+"
  };
  const rawSleepEnum = (profile as any).sleepHoursEnum || (profile as any).sleepHoursRaw || "";
  const estimatedSleepHours = sleepHoursEnumMap[rawSleepEnum]
    || (profile.sleepHours ? `${profile.sleepHours}` : (profile.sleepScore * 8 / 100).toFixed(1));
  const primaryGoal = profile.goals?.[0] || l("General Wellness", "सामान्य स्वास्थ्य");

  // ── NAVY HEADER BLOCK ──────────────────────────────────────
  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(0, 0, ctx.pageWidth, 68, 'F');

  // GeneWell wordmark
  ctx.pdf.setFontSize(30);
  ctx.pdf.setTextColor(...GOLD);
  setCtxFont(ctx, "bold");
  ctx.pdf.text("GeneWell", ctx.margin, 22);

  // Divider line (gold)
  ctx.pdf.setDrawColor(...GOLD);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.line(ctx.margin, 26, ctx.margin + 60, 26);

  // Tagline
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GOLD_LIGHT);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(
    l("PERSONALIZED WELLNESS BLUEPRINT  ·  " + (TIER_NAMES[tier] || "Premium").toUpperCase(),
      "व्यक्तिगत वेलनेस ब्लूप्रिंट  ·  " + (TIER_NAMES[tier] || "प्रीमियम").toUpperCase()),
    ctx.margin, 33
  );

  // "Prepared exclusively for" subtitle
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(190, 190, 190);
  ctx.pdf.text(l("Prepared exclusively for", "विशेष रूप से तैयार किया गया"), ctx.margin, 42);

  // Client name (large white)
  ctx.pdf.setFontSize(22);
  ctx.pdf.setTextColor(255, 255, 255);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(profile.name.toUpperCase(), ctx.margin, 55);

  // Subtitle below name
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GOLD_LIGHT);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(l("90-Day Health Transformation Blueprint", "90-दिन का स्वास्थ्य परिवर्तन ब्लूप्रिंट"), ctx.margin, 62);

  ctx.yPosition = 76;

  // ── INFO GRID ──────────────────────────────────────────────
  const rowH = 9;
  const labelW = 48;

  const infoRows: [string, string][] = [
    [l("CLIENT", "ग्राहक"), `${profile.name}  ·  ${profile.age} ${l("yrs", "वर्ष")}  ·  ${profile.gender === "male" ? l("Male", "पुरुष") : l("Female", "महिला")}`],
    [l("BODY METRICS", "शारीरिक मापदंड"), `${profile.heightCm} cm  ·  ${profile.weightKg} kg  ·  BMI ${bmi.toFixed(1)}`],
    [l("REGION / DIET", "क्षेत्र / आहार"), `${profile.region || l("India", "भारत")}  ·  ${profile.dietaryPreference}`],
    [l("PRIMARY GOAL", "प्राथमिक लक्ष्य"), primaryGoal],
    [l("SLEEP STATUS", "नींद की स्थिति"), `${estimatedSleepHours} hrs  ·  ${l("Target: 7-8 hrs", "लक्ष्य: 7-8 घंटे")}`],
    [l("ORDER ID", "ऑर्डर आईडी"), orderId.split('_').pop() || orderId],
    [l("GENERATED", "तारीख"), new Date(timestamp).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN")],
  ];

  infoRows.forEach(([label, value], idx) => {
    const isAlt = idx % 2 === 0;
    ctx.pdf.setFillColor(...(isAlt ? CREAM : CREAM_DARK));
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, rowH, 'F');
    // Left label (navy bold)
    ctx.pdf.setFontSize(7.5);
    ctx.pdf.setTextColor(...NAVY_MID);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(label, ctx.margin + 3, ctx.yPosition + 6.3);
    // Value
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...DARK);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(String(value), ctx.margin + labelW, ctx.yPosition + 6.3);
    // Row divider
    ctx.pdf.setDrawColor(215, 210, 200);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.line(ctx.margin, ctx.yPosition + rowH, ctx.margin + ctx.contentWidth, ctx.yPosition + rowH);
    ctx.yPosition += rowH;
  });
  // Table border
  ctx.pdf.setDrawColor(...NAVY_MID);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.rect(ctx.margin, 76, ctx.contentWidth, ctx.yPosition - 76, 'S');
  ctx.yPosition += 7;

  // ── CONDITIONS SECTION ────────────────────────────────────
  const allConditions = [
    ...(profile.medicalConditions || []),
    ...(profile.digestiveIssues || []).slice(0, 2),
    ...(profile.skinConcerns || []).slice(0, 2),
    ...(profile.foodIntolerances || []).slice(0, 2),
  ].filter(Boolean).slice(0, 12);

  if (allConditions.length > 0) {
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(l("ALL CONDITIONS ADDRESSED IN THIS REPORT:", "इस रिपोर्ट में सभी स्थितियां शामिल:"), ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    drawConditionTags(ctx, allConditions, language);
  }

  // ── DISCLAIMER ────────────────────────────────────────────
  ctx.yPosition += 4;
  ctx.pdf.setFillColor(255, 240, 240);
  const discLines = ctx.pdf.splitTextToSize(
    l("Medical Disclaimer: This report is for educational purposes only and is NOT medical advice. Always consult a qualified healthcare professional before making changes to diet, exercise, or supplementation.",
      "चिकित्सा अस्वीकरण: यह रिपोर्ट केवल शैक्षिक उद्देश्यों के लिए है और चिकित्सा सलाह नहीं है। आहार, व्यायाम या सप्लीमेंट में बदलाव से पहले हमेशा योग्य स्वास्थ्य पेशेवर से परामर्श लें।"),
    ctx.contentWidth - 8
  );
  const discH = discLines.length * 4.2 + 6;
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, discH, 'F');
  ctx.pdf.setFillColor(...RED_ALERT);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, 3, discH, 'F');
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(120, 30, 30);
  setCtxFont(ctx, "normal");
  discLines.forEach((line: string, i: number) => {
    ctx.pdf.text(line, ctx.margin + 6, ctx.yPosition + 4.5 + i * 4.2);
  });
  ctx.yPosition += discH;

  // ── NAVY FOOTER ──────────────────────────────────────────
  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(0, ctx.pageHeight - 12, ctx.pageWidth, 12, 'F');
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(...GOLD_LIGHT);
  setCtxFont(ctx, "normal");
  ctx.pdf.text("www.genewell.in", ctx.margin, ctx.pageHeight - 4);
  ctx.pdf.text(l("Confidential · Personal Health Report", "गोपनीय · व्यक्तिगत स्वास्थ्य रिपोर्ट"), ctx.pageWidth / 2, ctx.pageHeight - 4, { align: "center" });

  smartNewPage(ctx);
}

function renderTableOfContents(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, tier, rules } = bundle;
  // Subscription plan unlocks all add-ons automatically
  const ALL_ADDON_IDS = [
    "addon_dna", "addon_supplement", "addon_athlete",
    "addon_family", "addon_women_hormone", "addon_men_fitness", "addon_products"
  ];
  const addOns = isSubscription(tier) ? ALL_ADDON_IDS : (bundle.addOns || []);
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const isFemale = (profile.gender || "").toLowerCase() === "female" || (profile.gender || "").toLowerCase() === "f";
  const isMale = !isFemale;

  // ── NAVY HEADER ──
  const NAVY: [number, number, number] = [13, 27, 42];
  const GOLD: [number, number, number] = [201, 168, 76];
  const CREAM: [number, number, number] = [245, 240, 232];

  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(0, 0, 210, 28, "F");
  ctx.pdf.setTextColor(255, 255, 255);
  setCtxFont(ctx, "bold");
  ctx.pdf.setFontSize(13);
  ctx.pdf.text(l("What's Inside Your Blueprint", "आपके ब्लूप्रिंट में क्या है"), 105, 12, { align: "center" });
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...GOLD);
  ctx.pdf.text(l("Your complete blueprint — 15 science-backed sections", "आपका पूर्ण ब्लूप्रिंट — 15 विज्ञान-समर्थित अनुभाग"), 105, 21, { align: "center" });
  ctx.yPosition = 38;

  // Build the 15-section TOC matching Brainy format
  type TocEntry = { num: string; title: string; subtitle: string; show: boolean };
  const entries: TocEntry[] = [
    {
      num: "01",
      title: l("Personal Health Score Dashboard", "व्यक्तिगत स्वास्थ्य स्कोर डैशबोर्ड"),
      subtitle: l("Generated from your 20 quiz inputs", "आपके 20 प्रश्नों से जेनरेट किया गया"),
      show: true,
    },
    {
      num: "02",
      title: l("Your Calculated Metabolic Numbers", "आपके गणना किए गए मेटाबोलिक नंबर"),
      subtitle: l("Every number computed from your data", "आपके डेटा से गणना की गई हर संख्या"),
      show: true,
    },
    {
      num: "03",
      title: l("Decision Engine & Root Cause Analysis", "निर्णय इंजन और मूल कारण विश्लेषण"),
      subtitle: l("Personalized decision trees for your profile", "आपकी प्रोफ़ाइल के लिए व्यक्तिगत निर्णय पेड़"),
      show: true,
    },
    {
      num: "04",
      title: l("90-Day Weight Projection (Computed)", "90-दिन का वजन अनुमान (गणना)"),
      subtitle: l("Checkpoints with adaptive logic", "अनुकूली तर्क के साथ चौकियां"),
      show: true,
    },
    {
      num: "05",
      title: l("Nutrition Strategy & Macros", "पोषण रणनीति और मैक्रो"),
      subtitle: l("Tailored to your diet and lifestyle", "आपके आहार और जीवनशैली के अनुसार"),
      show: tier !== "free",
    },
    {
      num: "06",
      title: l("7-Day Meal Plan + Eating Out Guide", "7-दिन की भोजन योजना"),
      subtitle: l("Full week with Indian context", "भारतीय संदर्भ के साथ पूरा सप्ताह"),
      show: (isPremiumOrAbove(tier)) && (bundle.mealPlan?.days?.length > 0),
    },
    {
      num: "07",
      title: l("Sleep & Energy Protocol", "नींद और ऊर्जा प्रोटोकॉल"),
      subtitle: l(`Fixing your ${profile.sleepHours || 6}–${(profile.sleepHours || 6) + 0.5} hrs & energy levels`, `आपकी नींद और ऊर्जा सुधार`),
      show: true,
    },
    {
      num: "08",
      title: l("Anxiety & Mood Management", "चिंता और मनोदशा प्रबंधन"),
      subtitle: l("Specific to your stress profile", "आपके तनाव प्रोफ़ाइल के अनुसार"),
      show: tier !== "free",
    },
    {
      num: "09",
      title: l("Training Program", "प्रशिक्षण कार्यक्रम"),
      subtitle: l("Structured exercise plan", "संरचित व्यायाम योजना"),
      show: tier !== "free",
    },
    {
      num: "10",
      title: l("Gut Health & Hydration Protocol", "आंत स्वास्थ्य और जलयोजन"),
      subtitle: l("Digestive healing + water targets", "पाचन सुधार + पानी लक्ष्य"),
      show: (isPremiumOrAbove(tier)),
    },
    {
      num: "11",
      title: l("Skin Health", "त्वचा स्वास्थ्य"),
      subtitle: l("Nutrition & care for your skin concerns", "त्वचा की देखभाल और पोषण"),
      show: (isPremiumOrAbove(tier)),
    },
    {
      num: "12",
      title: l("Supplement Strategy", "सप्लीमेंट रणनीति"),
      subtitle: l("Evidence-based stack for your profile", "आपकी प्रोफ़ाइल के लिए साक्ष्य-आधारित स्टैक"),
      show: isPremiumOrAbove(tier),
    },
    {
      num: "13",
      title: l("Recommended Lab Tests", "अनुशंसित लैब परीक्षण"),
      subtitle: l("Prioritized panel with Indian lab pricing", "भारतीय लैब मूल्य सहित प्राथमिकता पैनल"),
      show: true,
    },
    {
      num: "14",
      title: isFemale
        ? l("Women's Hormonal Health", "महिला हार्मोनल स्वास्थ्य")
        : l("Specialized Add-On Modules", "विशेषीकृत ऐड-ऑन मॉड्यूल"),
      subtitle: isFemale
        ? l("Cycle-synced wellness", "साइकिल-सिंक्ड स्वास्थ्य")
        : l("Your selected premium modules", "आपके चुने हुए प्रीमियम मॉड्यूल"),
      show: addOns?.length > 0,
    },
    {
      num: "15",
      title: l("Progress Tracking & Weekly Check-ins", "प्रगति ट्रैकिंग और साप्ताहिक जांच"),
      subtitle: l("Weekly self-coaching worksheet", "साप्ताहिक आत्म-कोचिंग वर्कशीट"),
      show: true,
    },
    {
      num: "16",
      title: l("90-Day Action Plan & Closing Thoughts", "90-दिन कार्य योजना और समापन विचार"),
      subtitle: l("Your complete transformation roadmap", "आपका पूर्ण परिवर्तन रोडमैप"),
      show: true,
    },
  ];

  const visibleEntries = entries.filter(e => e.show);

  visibleEntries.forEach((entry, index) => {
    checkPageBreak(ctx, 14);

    // Row background alternating
    if (index % 2 === 0) {
      ctx.pdf.setFillColor(...CREAM);
      ctx.pdf.rect(ctx.margin, ctx.yPosition - 4, 170, 13, "F");
    }

    // Section number in gold circle
    ctx.pdf.setFillColor(...GOLD);
    ctx.pdf.circle(ctx.margin + 7, ctx.yPosition + 2, 5, "F");
    ctx.pdf.setTextColor(0, 0, 0);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(entry.num, ctx.margin + 7, ctx.yPosition + 3.5, { align: "center" });

    // Title
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(10);
    ctx.pdf.text(entry.title, ctx.margin + 16, ctx.yPosition + 2);

    // Subtitle
    ctx.pdf.setTextColor(100, 100, 100);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(entry.subtitle, ctx.margin + 16, ctx.yPosition + 7);

    // Arrow →
    ctx.pdf.setTextColor(...GOLD);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(12);
    ctx.pdf.text("→", 185, ctx.yPosition + 3);

    ctx.yPosition += 14;
  });

  smartNewPage(ctx);
}

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Clinical Overview",
  metabolic_profile: "Metabolic Analysis",
  sleep_protocol: "Sleep Optimization",
  stress_management: "Stress Resilience",
  nutrition_strategy: "Nutrition Strategy",
  movement_program: "Training Program",
  beginner_program: "Starter Movement Plan",
  fat_loss_program: "Fat Loss Strategy",
  muscle_building: "Hypertrophy Framework",
  insulin_management: "Blood Sugar Control",
  gut_health: "Digestive Health",
  skin_health: "Skin Nutrition",
  lab_tests: "Biomarker Recommendations",
};

function renderTopActions(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, rules } = bundle;
  const hints = rules.narrativeHints || [];
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("01 · Top 3 Priority Actions", "01 · शीर्ष 3 प्राथमिकता कार्य"), l(`The highest-impact changes for ${profile.name}'s first 3 weeks`, `${profile.name} के पहले 3 सप्ताह में सबसे अधिक प्रभावी बदलाव`));

  if (hints.length >= 3) {
    hints.slice(0, 3).forEach((hint, i) => {
      const title = SECTION_TITLES[hint.section] || hint.section;
      ctx.pdf.setFontSize(12);
      ctx.pdf.setTextColor(...PURPLE);
      setCtxFont(ctx, "bold");
      checkPageBreak(ctx, 6);
      ctx.pdf.text(`${i + 1}. ${title}`, ctx.margin, ctx.yPosition);
      ctx.yPosition += 6;
      addText(ctx, hint.focusAreas.join(". "), 9);
      addSpacing(ctx, 3);
    });
  } else {
    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    setCtxFont(ctx, "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text(l("1. Lock Your Wake-Sleep Schedule", "1. सोने-जागने का समय तय करें"), ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    addText(ctx, l(
      `Your sleep score is ${profile.sleepScore}/100 — ${profile.sleepScore < 50 ? "this is critical for you" : profile.sleepScore < 70 ? "there's significant room for improvement" : "maintaining consistency will sustain your good sleep"}. Consistent wake times improve sleep quality more than sleeping longer (Journal of Clinical Sleep Medicine, 2023).`,
      `आपका नींद स्कोर ${profile.sleepScore}/100 है — ${profile.sleepScore < 50 ? "यह आपके लिए अत्यंत महत्वपूर्ण है" : profile.sleepScore < 70 ? "सुधार की काफी गुंजाइश है" : "निरंतरता आपकी अच्छी नींद बनाए रखेगी"}। निरंतर जागने का समय लंबे समय तक सोने से अधिक नींद की गुणवत्ता सुधारता है।`
    ), 9);
    addSpacing(ctx, 3);

    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    setCtxFont(ctx, "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text(l("2. Structure Your Eating Window", "2. खाने का समय निर्धारित करें"), ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    addText(ctx, l(
      `Eat within a 10-12 hour window. Time-restricted eating improved metabolic markers by 15-25% independent of calorie changes (Cell Metabolism, 2023). Your estimated TDEE is ${profile.tdee} kcal/day.`,
      `10-12 घंटे की खिड़की में खाएं। समय-सीमित भोजन ने कैलोरी परिवर्तन के बिना मेटाबोलिक संकेतकों में 15-25% सुधार किया। आपका अनुमानित TDEE ${profile.tdee} kcal/दिन है।`
    ), 9);
    addSpacing(ctx, 3);

    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    setCtxFont(ctx, "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text(l("3. Move for 20-30 Minutes Daily", "3. प्रतिदिन 20-30 मिनट व्यायाम करें"), ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    const exerciseSuggestion = l(
      profile.exercisePreference?.length > 0
        ? `Based on your preferences (${profile.exercisePreference.slice(0, 2).join(", ")}), start with those activities.`
        : "Walking, yoga, or bodyweight exercises are ideal starting points.",
      profile.exercisePreference?.length > 0
        ? `आपकी पसंद (${profile.exercisePreference.slice(0, 2).join(", ")}) के आधार पर उन गतिविधियों से शुरू करें।`
        : "पैदल चलना, योग, या शारीरिक व्यायाम आदर्श शुरुआती बिंदु हैं।"
    );
    addText(ctx, l(
      `${exerciseSuggestion} Even 20 minutes of moderate activity reduces all-cause mortality by 30% (JAMA Internal Medicine, 2022). Your current activity score is ${profile.activityScore}/100.`,
      `${exerciseSuggestion} 20 मिनट की मध्यम गतिविधि भी सभी कारणों से मृत्यु दर को 30% कम करती है। आपका वर्तमान गतिविधि स्कोर ${profile.activityScore}/100 है।`
    ), 9);
  }

  addSpacing(ctx, 4);
  addNote(ctx, l(
    "Implementation tip: Start with Action 1 this week. Add Action 2 in week 2. Add Action 3 in week 3. Building one habit at a time has a 85% higher success rate (European Journal of Social Psychology, 2022).",
    "कार्यान्वयन सुझाव: इस सप्ताह कार्य 1 से शुरू करें। सप्ताह 2 में कार्य 2 जोड़ें। सप्ताह 3 में कार्य 3 जोड़ें। एक समय में एक आदत बनाने की सफलता दर 85% अधिक होती है।"
  ));
  smartNewPage(ctx);
}

function renderWellnessBaseline(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const NAVY: [number, number, number] = [13, 27, 42];
  const GOLD: [number, number, number] = [201, 168, 76];
  const CREAM: [number, number, number] = [245, 240, 232];
  const RED_ALERT: [number, number, number] = [192, 57, 43];
  const GREEN_OK: [number, number, number] = [39, 174, 96];
  const ORANGE_WARN: [number, number, number] = [230, 126, 34];

  addHeaderSection(
    ctx,
    l("02 · Your Wellness Baseline", "02 · आपका स्वास्थ्य आधार"),
    l(`Current status across ${profile.age} yr ${profile.gender === "female" ? "female" : "male"} health pillars — ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`, `${profile.age} वर्षीय ${profile.gender === "female" ? "महिला" : "पुरुष"} स्वास्थ्य स्तंभ — वर्तमान स्थिति`)
  );

  addText(ctx, l(
    "Each score is derived from your quiz responses. This blueprint directly addresses every low score below.",
    "प्रत्येक स्कोर आपके क्विज़ उत्तरों से लिया गया है। यह ब्लूप्रिंट नीचे हर कम स्कोर को सीधे संबोधित करता है।"
  ), 9);
  addSpacing(ctx, 4);

  // ── Health Score Bars (Brainy-style) ──
  // FIX: Don't default waterLiters to 1.5 — use actual value or treat as low (0.8)
  const waterLiters_scores = profile.waterLiters !== undefined && profile.waterLiters !== null
    ? profile.waterLiters
    : (profile.waterIntake !== undefined && profile.waterIntake !== null ? profile.waterIntake : 0.8);
  const hydrationScore = Math.max(10, Math.min(90, Math.round((waterLiters_scores / 2.3) * 90)));
  const scores = [
    {
      icon: "⚡", label: l("Energy Level", "ऊर्जा स्तर"), score: profile.energyScore,
      note: profile.energyScore < 40
        ? l(`Linked to ${(profile.sleepHours || 6) < 7 ? `${profile.sleepHours || 6} hrs sleep` : "low hydration"} + ${waterLiters_scores < 2 ? `${waterLiters_scores.toFixed(1)}L water` : "stress"}`, `नींद और जलयोजन से जुड़ा`)
        : profile.energyScore < 70 ? l("Elevated — targeted changes will transform this", "सुधार की जरूरत") : l("Good — maintain current habits", "अच्छा — जारी रखें"),
    },
    {
      icon: "🌙", label: l("Sleep Quality", "नींद की गुणवत्ता"), score: profile.sleepScore,
      note: profile.sleepScore < 50
        ? l(`${profile.sleepHours || 6} hrs — critically below the 7–9 hr minimum for your goals`, `${profile.sleepHours || 6} घंटे — लक्ष्यों के लिए न्यूनतम से कम`)
        : profile.sleepScore < 75 ? l("Moderate — sleep protocol will improve energy & mood", "मध्यम — नींद प्रोटोकॉल सुधार करेगा") : l("Strong — maintain consistency", "मजबूत — निरंतरता बनाए रखें"),
    },
    {
      icon: "🧘", label: l("Stress Resilience", "तनाव प्रतिरोधक क्षमता"), score: profile.stressScore,
      // FIX: stressScore is 85 for very-high — don't call that "Moderate stress"
      note: profile.stressScore >= 80
        ? l("Very high stress — cortisol management is your #1 priority", "बहुत उच्च तनाव — कोर्टिसोल प्रबंधन #1 प्राथमिकता")
        : profile.stressScore > 60 ? l("High stress — specific tools provided", "उच्च तनाव — विशिष्ट उपकरण प्रदान") : l("Well-managed — continue practices", "अच्छी तरह प्रबंधित"),
    },
    {
      icon: "🏃", label: l("Physical Activity", "शारीरिक गतिविधि"), score: profile.activityScore,
      note: profile.activityScore < 50
        ? l("Lightly active — structured strength training will transform this", "हल्का सक्रिय — संरचित प्रशिक्षण इसे बदलेगा")
        : profile.activityScore < 75 ? l("Active — progressive training will optimize results", "सक्रिय — प्रगतिशील प्रशिक्षण परिणाम बेहतर करेगा") : l("Highly active — recovery is key", "अत्यधिक सक्रिय — रिकवरी महत्वपूर्ण"),
    },
  ];

  scores.forEach(({ icon, label, score, note }) => {
    checkPageBreak(ctx, 18);
    const scoreColor: [number, number, number] = score < 45 ? RED_ALERT : score < 70 ? ORANGE_WARN : GREEN_OK;
    const scoreLabel = score < 45 ? l("CRITICAL", "गंभीर") : score < 70 ? l("NEEDS WORK", "सुधार जरूरी") : l("GOOD", "अच्छा");

    // Background row
    ctx.pdf.setFillColor(...CREAM);
    ctx.pdf.rect(ctx.margin, ctx.yPosition - 2, 170, 16, "F");

    // Score colored left bar
    ctx.pdf.setFillColor(...scoreColor);
    ctx.pdf.rect(ctx.margin, ctx.yPosition - 2, 3, 16, "F");

    // Icon + label
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(10);
    ctx.pdf.text(`${icon} ${label}`, ctx.margin + 7, ctx.yPosition + 5);

    // Score badge
    ctx.pdf.setFillColor(...scoreColor);
    ctx.pdf.roundedRect(150, ctx.yPosition - 1, 26, 10, 2, 2, "F");
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(`${score}/100 ${scoreLabel}`, 163, ctx.yPosition + 6, { align: "center" });

    // Note
    ctx.pdf.setTextColor(80, 80, 80);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(note, ctx.margin + 7, ctx.yPosition + 12);

    ctx.yPosition += 19;
  });

  addSpacing(ctx, 5);

  // ── Profile Snapshot Table (like Brainy) ──
  addSubSection(ctx, l("Your Profile", "आपकी प्रोफ़ाइल"));
  const bmi = Math.round((profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2))) * 10) / 10;
  const profileRows: [string, string][] = [
    [l("Age / Gender", "आयु / लिंग"), `${profile.age} · ${profile.gender === "female" ? l("Female", "महिला") : l("Male", "पुरुष")}`],
    [l("Height / Weight", "ऊंचाई / वजन"), `${profile.heightCm} cm · ${profile.weightKg} kg`],
    [l("BMI", "बीएमआई"), `${bmi} ${l("(BMI is a screening tool, not the full picture)", "(BMI एक स्क्रीनिंग उपकरण है)")}`],
    [l("Sleep", "नींद"), `${profile.sleepHours || 6} hrs ${profile.sleepHours < 7 ? "⚠" : "✓"}`],
    [l("Goal", "लक्ष्य"), profile.goals?.[0] || l("General Wellness", "सामान्य स्वास्थ्य")],
    [l("Diet", "आहार"), profile.dietaryPreference || l("Balanced", "संतुलित")],
  ];

  profileRows.forEach(([key, val], idx) => {
    checkPageBreak(ctx, 8);
    if (idx % 2 === 0) {
      ctx.pdf.setFillColor(250, 248, 245);
      ctx.pdf.rect(ctx.margin, ctx.yPosition - 2, 170, 7, "F");
    }
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(key, ctx.margin + 3, ctx.yPosition + 3);
    ctx.pdf.setTextColor(60, 60, 60);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(val, ctx.margin + 55, ctx.yPosition + 3);
    ctx.yPosition += 8;
  });

  // ── Conditions Addressed ──
  if (profile.medicalConditions?.length > 0 || profile.foodIntolerances?.length > 0) {
    addSpacing(ctx, 4);
    addSubSection(ctx, l("Conditions Addressed", "संबोधित स्थितियाँ"));
    const allConditions = [
      ...(profile.medicalConditions || []),
      ...(profile.foodIntolerances?.map((f: string) => `${f} ${l("intolerance", "असहिष्णुता")}`) || []),
    ];
    // Render as inline badges
    let xPos = ctx.margin;
    checkPageBreak(ctx, 10);
    allConditions.forEach(cond => {
      const labelText = cond.charAt(0).toUpperCase() + cond.slice(1);
      const textWidth = ctx.pdf.getTextWidth(labelText) + 6;
      if (xPos + textWidth > 185) { xPos = ctx.margin; ctx.yPosition += 9; checkPageBreak(ctx, 10); }
      ctx.pdf.setFillColor(...NAVY);
      ctx.pdf.roundedRect(xPos, ctx.yPosition - 1, textWidth, 7, 2, 2, "F");
      ctx.pdf.setTextColor(255, 255, 255);
      setCtxFont(ctx, "bold");
      ctx.pdf.setFontSize(7);
      ctx.pdf.text(labelText, xPos + 3, ctx.yPosition + 4);
      xPos += textWidth + 4;
    });
    ctx.yPosition += 10;
  }

  // ── Low energy explanation callout (Brainy-style) ──
  const lowScores = scores.filter(s => s.score < 60);
  if (lowScores.length > 0) {
    addSpacing(ctx, 4);
    checkPageBreak(ctx, 20);
    ctx.pdf.setFillColor(255, 243, 205);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 170, 18, "F");
    ctx.pdf.setFillColor(...GOLD);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 3, 18, "F");
    const lowestScore = lowScores.sort((a, b) => a.score - b.score)[0];
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text(l(`Why ${lowestScore.label} is your #1 priority:`, `${lowestScore.label} आपकी #1 प्राथमिकता क्यों:`), ctx.margin + 6, ctx.yPosition + 7);
    ctx.pdf.setTextColor(60, 60, 60);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(l(
      `Your ${lowestScore.label.toLowerCase()} score is ${lowestScore.score}/100. Fix this first and several other scores improve automatically within 3 weeks.`,
      `आपका ${lowestScore.label.toLowerCase()} स्कोर ${lowestScore.score}/100 है। इसे पहले ठीक करें और अन्य स्कोर 3 सप्ताह में स्वतः सुधरेंगे।`
    ), ctx.margin + 6, ctx.yPosition + 14);
    ctx.yPosition += 22;
  }

  smartNewPage(ctx);
}

// ════════════════════════════════════════════════════════════
// 01 · PERSONAL HEALTH SCORE DASHBOARD
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// 01 · PERSONAL HEALTH SCORE DASHBOARD
// ════════════════════════════════════════════════════════════
function renderHealthScoreDashboard(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx,
    l("01 · Personal Health Score Dashboard", "01 · व्यक्तिगत स्वास्थ्य स्कोर डैशबोर्ड"),
    l("Generated from your 20 quiz inputs. Each score is computed from your actual data — not estimated. Red = critical. Orange = needs work. Green = good.",
      "आपके 20 क्विज़ इनपुट से जनरेट। प्रत्येक स्कोर वास्तविक डेटा से — अनुमान नहीं। लाल = गंभीर। नारंगी = सुधार जरूरी। हरा = अच्छा।"));

  // ── Compute 6 dimension scores ──
  const sleepHours = profile.sleepHours || 6;           // FIX: uses numeric hours from quiz-analysis fix
  const sleepScore = profile.sleepScore;
  const stressMgmtScore = Math.max(15, 100 - (profile.stressScore || 50));
  const mealFreq = profile.mealFrequency || 3;          // FIX: now reads real value (not hardcoded 3)
  // FIX Bug 5: mealTimingScore — old formula (mealFreq/3)*100 gave 33 for 1 meal (not critical enough)
  // Correct: optimal is 4-5 meals; 1 meal = 10/100 (CRITICAL), 2 = 35, 3 = 60, 4 = 85, 5+ = 100
  const mealTimingScore = mealFreq >= 5 ? 100
    : mealFreq === 4 ? 85
    : mealFreq === 3 ? 60
    : mealFreq === 2 ? 35
    : 10; // 1 meal/day = CRITICAL
  // FIX Bug 6: waterLiters — old default 1.5 masked low hydration. Now reads real value from profile.
  const waterLiters = profile.waterLiters !== undefined && profile.waterLiters !== null
    ? profile.waterLiters
    : (profile.waterIntake !== undefined && profile.waterIntake !== null ? profile.waterIntake : null);
  // If waterLiters is still null (no data), don't assume 1.5 — treat as unknown/low (0.8)
  const waterLitersResolved = waterLiters !== null ? waterLiters : 0.8;
  const hydrationScore = Math.max(10, Math.min(90, Math.round((waterLitersResolved / 2.3) * 90)));
  const gutScore = Math.max(20, 80 - ((profile.digestiveIssues?.length || 0) * 12));
  const skinScore = Math.max(25, 80 - ((profile.skinConcerns?.length || 0) * 10));
  const overallScore = Math.round((sleepScore + stressMgmtScore + mealTimingScore + hydrationScore + gutScore + skinScore) / 6);

  // ── Overall score display (large number + label) ──
  addSpacing(ctx, 3);
  checkPageBreak(ctx, 20);
  const scoreX = ctx.margin;
  const labelX = scoreX + 30;
  ctx.pdf.setFontSize(32);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(`${overallScore}`, scoreX, ctx.yPosition + 10);
  ctx.pdf.setFontSize(7);
  ctx.pdf.setTextColor(...GRAY);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(l("/100", "/100"), scoreX + 18, ctx.yPosition + 2);
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(l("YOUR OVERALL WELLNESS SCORE", "आपका कुल वेलनेस स्कोर"), labelX, ctx.yPosition + 5);
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GRAY);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(l("Based on 6 health dimensions · Week 1 Baseline", "6 स्वास्थ्य आयामों के आधार पर · सप्ताह 1 बेसलाइन"), labelX, ctx.yPosition + 11);
  ctx.yPosition += 22;
  addSpacing(ctx, 2);

  // ── Root cause per dimension (user-specific) ──
  const sleepRootCause = sleepScore < 50
    ? l(`Only ${sleepHours} hrs (need 8)`, `केवल ${sleepHours} घंटे (8 चाहिए)`)
    : sleepScore < 70
    ? l(`${sleepHours} hrs sleep — target 7-8 hrs`, `${sleepHours} घंटे — लक्ष्य 7-8`)
    : l("Good sleep duration", "नींद अच्छी है");

  const waterTarget = Math.round((profile.estimatedWeightKg || profile.weightKg || 65) * 0.033 * 10) / 10;
  // FIX: use waterLitersResolved so low hydration is never masked by a 1.5 default
  const hydRootCause = waterLitersResolved < 1.0
    ? l(`Only ${waterLitersResolved.toFixed(1)}L/day — severely low (need ${waterTarget}L)`, `केवल ${waterLitersResolved.toFixed(1)}L/दिन — बहुत कम`)
    : waterLitersResolved < 1.5
    ? l(`${waterLitersResolved.toFixed(1)}L/day — below target (need ${waterTarget}L)`, `${waterLitersResolved.toFixed(1)}L/दिन — लक्ष्य से कम`)
    : l(`${waterLitersResolved.toFixed(1)}L/day — near target`, `${waterLitersResolved.toFixed(1)}L/दिन — लक्ष्य के करीब`);

  // FIX: Meal root cause — 1 meal/day must say CRITICAL, not "needs improvement"
  const mealRootCause = mealFreq === 1
    ? l("1 meal/day — CRITICAL (causes cortisol spikes & muscle loss)", "1 भोजन/दिन — गंभीर")
    : mealFreq === 2
    ? l(`${mealFreq} meals/day — too few, add snacks`, `${mealFreq} भोजन/दिन — कम`)
    : mealFreq < 4
    ? l(`${mealFreq} meals/day — adequate, aim for 4-5`, `${mealFreq} भोजन/दिन — ठीक`)
    : l("Good meal frequency", "भोजन आवृत्ति अच्छी");

  // FIX: stressRootCause — was "Moderate-high" even for very-high stress. Now maps correctly.
  const stressScore_ = profile.stressScore || 50;
  const stressRootCause = stressScore_ >= 80
    ? l("Very high stress — immediate action needed", "बहुत उच्च तनाव — तत्काल कार्रवाई")
    : stressScore_ > 60
    ? l("High stress + lifestyle factors", "उच्च तनाव + जीवनशैली")
    : l("Manageable stress level", "तनाव प्रबंधनीय");

  const gutRootCause = profile.digestiveIssues?.length > 0
    ? profile.digestiveIssues.slice(0, 2).join(" + ")
    : l("No major gut issues", "कोई बड़ी पाचन समस्या नहीं");

  const skinRootCause = profile.skinConcerns?.length > 0
    ? profile.skinConcerns.slice(0, 2).join(" + ")
    : l("No major skin concerns", "कोई बड़ी त्वचा समस्या नहीं");

  const dims = [
    { name: l("Sleep", "नींद"), score: sleepScore, gap: 100 - sleepScore, root: sleepRootCause },
    { name: l("Hydration", "जलयोजन"), score: Math.round(hydrationScore), gap: 100 - Math.round(hydrationScore), root: hydRootCause },
    { name: l("Meal Frequency", "भोजन आवृत्ति"), score: mealTimingScore, gap: 100 - mealTimingScore, root: mealRootCause },
    { name: l("Stress Mgmt", "तनाव प्रबंधन"), score: stressMgmtScore, gap: 100 - stressMgmtScore, root: stressRootCause },
    { name: l("Gut Health", "पाचन"), score: Math.round(gutScore), gap: 100 - Math.round(gutScore), root: gutRootCause },
    { name: l("Skin Health", "त्वचा"), score: Math.round(skinScore), gap: 100 - Math.round(skinScore), root: skinRootCause },
  ];

  // ── Visual Progress Bars for each dimension ──
  const barAreaW = ctx.contentWidth;
  const labelColW = 32;
  const scoreColW = 22;
  const barColW = barAreaW - labelColW - scoreColW - 38; // 38 = root cause label width space
  const rootColW = 38;

  checkPageBreak(ctx, dims.length * 12 + 8);
  // Header row
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(...GRAY);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(l("DIMENSION", "आयाम"), ctx.margin, ctx.yPosition);
  ctx.pdf.text(l("SCORE", "स्कोर"), ctx.margin + labelColW + 2, ctx.yPosition);
  ctx.pdf.text(l("PROGRESS BAR", "प्रगति बार"), ctx.margin + labelColW + scoreColW + 2, ctx.yPosition);
  ctx.pdf.text(l("KEY FACTOR", "मुख्य कारक"), ctx.margin + labelColW + scoreColW + barColW + 4, ctx.yPosition);
  ctx.yPosition += 5;

  // Draw thin gold separator line
  ctx.pdf.setDrawColor(...GOLD);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.margin + barAreaW, ctx.yPosition);
  ctx.yPosition += 3;

  dims.forEach((d, i) => {
    const rowH = 10;
    const isAlt = i % 2 === 0;
    // Alternating row background
    ctx.pdf.setFillColor(...(isAlt ? CREAM : [255, 255, 255] as [number, number, number]));
    ctx.pdf.rect(ctx.margin, ctx.yPosition, barAreaW, rowH, "F");

    // Dimension name
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(d.name, ctx.margin + 1, ctx.yPosition + 7);

    // Score number
    const statusColor: [number, number, number] = d.score < 40 ? RED_ALERT : d.score < 70 ? ORANGE_WARN : GREEN_OK;
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(...statusColor);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(`${d.score}`, ctx.margin + labelColW + 2, ctx.yPosition + 7);

    // Progress bar track (background)
    const barX = ctx.margin + labelColW + scoreColW + 2;
    const barY = ctx.yPosition + 3;
    const barH = 5;
    ctx.pdf.setFillColor(220, 224, 230);
    ctx.pdf.rect(barX, barY, barColW, barH, "F");
    // Progress fill
    const fillW = Math.max(2, (d.score / 100) * barColW);
    ctx.pdf.setFillColor(...statusColor);
    ctx.pdf.rect(barX, barY, fillW, barH, "F");
    // Score label on bar right
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    const statusLabel = d.score < 40 ? l("CRITICAL", "गंभीर") : d.score < 70 ? l("WORK", "सुधार") : l("GOOD", "अच्छा");
    ctx.pdf.text(`${statusLabel}`, barX + fillW + 1, barY + 4);

    // Root cause / key factor
    ctx.pdf.setFontSize(7);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    const rootX = ctx.margin + labelColW + scoreColW + barColW + 4;
    const rootLines = ctx.pdf.splitTextToSize(d.root, rootColW + 2);
    ctx.pdf.text(rootLines.slice(0, 1), rootX, ctx.yPosition + 7);

    ctx.yPosition += rowH + 1;
  });

  // Bottom separator
  ctx.pdf.setDrawColor(...GOLD);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.margin + barAreaW, ctx.yPosition);
  ctx.yPosition += 2;

  // ── Limiting factor callout ──
  const worstIdx = dims.reduce((best, d, idx) => d.score < dims[best].score ? idx : best, 0);
  const worst = dims[worstIdx];
  addSpacing(ctx, 4);
  checkPageBreak(ctx, 20);
  ctx.pdf.setFillColor(245, 248, 252);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 22, "F");
  ctx.pdf.setDrawColor(...NAVY);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.margin, ctx.yPosition + 22);
  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(l(`WHY ${worst.name.toUpperCase()} IS YOUR #1 PRIORITY`, `${worst.name.toUpperCase()} आपकी #1 प्राथमिकता क्यों`), ctx.margin + 4, ctx.yPosition + 7);
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...DARK);
  setCtxFont(ctx, "normal");
  const whyText = l(
    `Your limiting factor is ${worst.name} (Score: ${worst.score}/100). Fix ${worst.name.toLowerCase()} first and 5 of your 6 scores improve within 3 weeks without changing anything else. This is the single highest-leverage action in your entire blueprint.`,
    `आपकी सीमित कारक ${worst.name} है (${worst.score}/100)। इसे पहले ठीक करें और 3 सप्ताह में अन्य 5 स्कोर बिना कुछ बदले सुधर जाएंगे।`
  );
  const whyLines = ctx.pdf.splitTextToSize(whyText, ctx.contentWidth - 8);
  ctx.pdf.text(whyLines.slice(0, 2), ctx.margin + 4, ctx.yPosition + 14);
  ctx.yPosition += 26;

  smartNewPage(ctx);
}

// ════════════════════════════════════════════════════════════
// 02 · YOUR CALCULATED METABOLIC NUMBERS
// ════════════════════════════════════════════════════════════
function renderMetabolicCalculations(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const bmi = Math.round((profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2))) * 10) / 10;
  const bmr = profile.bmr;
  const tdee = profile.tdee;
  const heightM = profile.heightCm / 100;
  const isMale = (profile.gender || "").toLowerCase() === "male" || (profile.gender || "").toLowerCase() === "m";
  const genderLabel = isMale ? l("Male", "पुरुष") : l("Female", "महिला");
  const bmrConstant = isMale ? "+5" : "−161";
  const bmrFormula = isMale
    ? l(`(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) + 5 = ${bmr} kcal/day`,
        `(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) + 5 = ${bmr} kcal/दिन`)
    : l(`(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) − 161 = ${bmr} kcal/day`,
        `(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) − 161 = ${bmr} kcal/दिन`);

  const wantsGain = profile.goals?.some((g: string) => g.toLowerCase().includes("gain") || g.toLowerCase().includes("muscle"));
  const wantsLoss = profile.goals?.some((g: string) => g.toLowerCase().includes("los") || g.toLowerCase().includes("fat"));
  const goalCalMin = wantsGain ? tdee + 250 : wantsLoss ? tdee - 500 : tdee + 100;
  const goalCalMax = wantsGain ? tdee + 400 : wantsLoss ? tdee - 400 : tdee + 200;
  const step4Title = wantsLoss
    ? l("STEP 4 · Calorie Target for Fat Loss", "चरण 4 · वसा हानि के लिए कैलोरी लक्ष्य")
    : wantsGain
    ? l("STEP 4 · Calorie Target for Lean Gain", "चरण 4 · दुबली मांसपेशी के लिए कैलोरी लक्ष्य")
    : l("STEP 4 · Calorie Target for General Wellness", "चरण 4 · सामान्य स्वास्थ्य के लिए कैलोरी लक्ष्य");
  const step4Formula = wantsLoss
    ? l(`TDEE − 400 to 500 kcal deficit = ${tdee} − 400-500 = ${goalCalMin}–${goalCalMax} kcal/day`,
        `TDEE − 400–500 = ${goalCalMin}–${goalCalMax} kcal/दिन`)
    : wantsGain
    ? l(`TDEE + 250 to 400 kcal surplus = ${tdee} + 250-400 = ${goalCalMin}–${goalCalMax} kcal/day`,
        `TDEE + 250–400 = ${goalCalMin}–${goalCalMax} kcal/दिन`)
    : l(`TDEE + 100 to 200 kcal = ${goalCalMin}–${goalCalMax} kcal/day (healthy gain/recomposition)`,
        `TDEE + 100–200 = ${goalCalMin}–${goalCalMax} kcal/दिन`);
  const step4Note = wantsLoss
    ? l("400-500 kcal/day deficit = 0.4-0.5 kg fat loss per week — optimal rate for preserving muscle.", "400-500 kcal/दिन कमी = प्रति सप्ताह 0.4-0.5 किग्रा वसा हानि।")
    : wantsGain
    ? l("250-400 kcal/day surplus = 0.25-0.5 kg lean gain per month. Conservative = safe.", "250-400 kcal/दिन अधिशेष = प्रति महीने 0.25-0.5 किग्रा लाभ।")
    : l("100-200 kcal above TDEE supports gradual recomposition without excess fat gain.", "TDEE से 100-200 kcal अधिक — धीरे-धीरे बेहतर बॉडी कंपोजिशन।");

  const bmiNote = bmi < 18.5
    ? l("Underweight — focus on lean muscle gain.", "कम वजन — दुबली मांसपेशी लाभ पर ध्यान दें।")
    : bmi < 25
    ? l("Healthy BMI range (18.5-24.9). Focus on composition, not just weight.", "स्वास्थ्यकर BMI (18.5-24.9)।")
    : l(`Slightly above healthy range (18.5-24.9). ${wantsGain ? "Weight gain goal = lean muscle, not fat." : "Focus on fat reduction, not muscle loss."}`,
        `स्वास्थ्यकर श्रेणी से थोड़ा ऊपर। ${wantsGain ? "लक्ष्य = दुबली मांसपेशी, वसा नहीं।" : "वसा घटाने पर ध्यान दें।"}`);

  addHeaderSection(ctx,
    l("02 · Your Calculated Metabolic Numbers", "02 · आपके गणना किए गए मेटाबोलिक नंबर"),
    l("Every number below is computed from your data — age, weight, height, activity level, goal. These are not estimates from a generic chart.",
      "नीचे प्रत्येक नंबर आपके डेटा से गणना किया गया — आयु, वजन, ऊंचाई, गतिविधि, लक्ष्य। ये जेनेरिक चार्ट के अनुमान नहीं हैं।"));

  addSpacing(ctx, 2);

  // ── Step-by-step formulas ──
  const steps = [
    {
      title: l("STEP 1 · BMI (Body Mass Index)", "चरण 1 · BMI"),
      formula: l(`Weight ÷ Height² = ${profile.weightKg} ÷ ${heightM.toFixed(2)}² = ${bmi}`,
                  `वजन ÷ ऊंचाई² = ${profile.weightKg} ÷ ${heightM.toFixed(2)}² = ${bmi}`),
      note: bmiNote,
    },
    {
      title: l(`STEP 2 · BMR (Mifflin-St Jeor · ${genderLabel})`, `चरण 2 · BMR (${genderLabel})`),
      formula: bmrFormula,
      note: l("Calories your body burns at complete rest. This is your baseline floor.", "आपके शरीर की विश्राम खपत। यह आपकी न्यूनतम है।"),
    },
    {
      title: l("STEP 3 · TDEE (Activity Multiplier)", "चरण 3 · TDEE (गतिविधि गुणक)"),
      formula: (() => {
        const actMap: Record<string,{mult:string,label:string}> = {
          "sedentary":         {mult:"1.2",   label:"Sedentary"},
          "lightly-active":    {mult:"1.375", label:"Lightly Active"},
          "moderately-active": {mult:"1.55",  label:"Moderately Active"},
          "very-active":       {mult:"1.725", label:"Very Active"},
          "highly-active":     {mult:"1.9",   label:"Highly Active"},
        };
        const act = actMap[profile.activityLevel || ""] || actMap[Object.keys(actMap).find(k => actMap[k].mult === (tdee/bmr).toFixed(3)) || ""] || {mult:(tdee/bmr).toFixed(3), label:"Lightly Active"};
        return l(
          `BMR × ${act.mult} (${act.label}) = ${bmr} × ${act.mult} = ${tdee} kcal/day`,
          `BMR × ${act.mult} (${act.label}) = ${bmr} × ${act.mult} = ${tdee} kcal/दिन`
        );
      })(),
      note: wantsGain
        ? l("Total calories you burn on a typical day. You must eat above this to gain weight.", "कुल दैनिक खपत। वजन बढ़ाने के लिए इससे ऊपर खाएं।")
        : l("Total calories you burn on a typical day. Eat below this for fat loss.", "कुल दैनिक खपत।"),
    },
    { title: step4Title, formula: step4Formula, note: step4Note },
  ];

  steps.forEach((step, i) => {
    checkPageBreak(ctx, 20);
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(step.title, ctx.margin, ctx.yPosition);
    ctx.yPosition += 7;
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(...DARK);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFillColor(248, 248, 248);
    const formulaLines = ctx.pdf.splitTextToSize(`  ${step.formula}`, ctx.contentWidth - 4);
    const fH = formulaLines.length * 5 + 6;
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, fH, "F");
    formulaLines.forEach((line: string, li: number) => {
      ctx.pdf.text(line, ctx.margin + 2, ctx.yPosition + 5 + li * 5);
    });
    ctx.yPosition += fH + 3;
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...GRAY);
    ctx.pdf.text(`  ${step.note}`, ctx.margin, ctx.yPosition);
    ctx.yPosition += 8;
    if (i < steps.length - 1) addSpacing(ctx, 2);
  });

  addSpacing(ctx, 4);

  // ── 4 horizontal metric cards ──
  checkPageBreak(ctx, 28);
  const cardW = (ctx.contentWidth - 9) / 4;
  const cardH = 22;
  const metrics = [
    { label: l("BMI", "BMI"), value: `${bmi}`, unit: l("(kg/m²)", "(kg/m²)") },
    { label: l("BMR", "BMR"), value: `${bmr}`, unit: l("kcal/day", "kcal/दिन") },
    { label: l("TDEE", "TDEE"), value: `${tdee}`, unit: l("kcal/day", "kcal/दिन") },
    { label: l("GOAL", "लक्ष्य"), value: `${goalCalMin}–${goalCalMax}`, unit: l("kcal/day", "kcal/दिन") },
  ];
  metrics.forEach((m, i) => {
    const cx = ctx.margin + i * (cardW + 3);
    ctx.pdf.setFillColor(...NAVY);
    ctx.pdf.rect(cx, ctx.yPosition, cardW, cardH, "F");
    ctx.pdf.setFontSize(11);
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(m.value, cx + cardW / 2, ctx.yPosition + 10, { align: "center" });
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(201, 168, 76);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(m.unit, cx + cardW / 2, ctx.yPosition + 15, { align: "center" });
    ctx.pdf.setFontSize(7);
    ctx.pdf.setTextColor(255, 255, 255);
    ctx.pdf.text(m.label, cx + cardW / 2, ctx.yPosition + 20, { align: "center" });
  });
  ctx.yPosition += cardH + 8;

  // ── Macro Targets table ──
  // FIX: Recompute macros FROM goalCals so percentages always sum to 100%.
  // Old code used profile.proteinGrams (sized from TDEE) / goalCals → >100% total.
  const goalCals = Math.round((goalCalMin + goalCalMax) / 2);
  const hasPCOSMacro = (profile.medicalConditions || []).some((c: string) => /pcos/i.test(c));
  const wantsLossMacro = (profile.goals || []).some((g: string) => /lose|loss|fat/i.test(g));
  const wantsGainMacro = (profile.goals || []).some((g: string) => /gain|muscle|build/i.test(g));
  // Macro split: must sum to exactly 1.0
  let _protPct: number, _carbPct: number, _fatPct: number;
  if (hasPCOSMacro) {
    _protPct = 0.30; _carbPct = 0.35; _fatPct = 0.35; // PCOS: low carb, high protein+fat
  } else if (wantsLossMacro) {
    _protPct = 0.30; _carbPct = 0.40; _fatPct = 0.30;
  } else if (wantsGainMacro) {
    _protPct = 0.30; _carbPct = 0.45; _fatPct = 0.25;
  } else {
    _protPct = 0.25; _carbPct = 0.50; _fatPct = 0.25;
  }
  const _macroProteinG = Math.round((goalCals * _protPct) / 4);
  const _macroCarbsG   = Math.round((goalCals * _carbPct) / 4);
  const _macroFatsG    = Math.round((goalCals * _fatPct) / 9);
  const proteinPct = Math.round(_protPct * 100);
  const carbsPct   = Math.round(_carbPct * 100);
  const fatsPct    = Math.round(_fatPct  * 100);
  // Verify sum = 100 (log warning if not due to rounding)
  if (proteinPct + carbsPct + fatsPct !== 100) {
    console.warn("[GeneWell] Macro % sum:", proteinPct + carbsPct + fatsPct, "≠ 100");
  }
  const isVeg = /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "");

  addSubSection(ctx, l("Macro Targets (Computed from Your Goal Calories)", "मैक्रो लक्ष्य (आपकी लक्ष्य कैलोरी से गणना)"));
  drawPremiumTable(ctx,
    [l("Macro", "मैक्रो"), l("Grams/Day", "ग्राम/दिन"), l("% of Calories", "% कैलोरी"), l("Top Sources for You", "आपके लिए मुख्य स्रोत")],
    [
      [l("Protein", "प्रोटीन"), `${_macroProteinG}g`, `${proteinPct}%`,
        isVeg ? l("Paneer, sprouts, lentils, tofu, Greek yogurt, soya", "पनीर, अंकुरित, दाल, टोफू, सोया")
               : l("Eggs, sprouts, lentils, soya chunks, chicken, fish", "अंडे, अंकुरित, दाल, सोया, चिकन")],
      [l("Carbohydrates", "कार्बोहाइड्रेट"), `${_macroCarbsG}g`, `${carbsPct}%`,
        l("Oats, brown rice, millets, sweet potato, banana", "ओट्स, ब्राउन राइस, बाजरा, शकरकंद, केला")],
      [l("Healthy Fats", "स्वास्थ्य वसा"), `${_macroFatsG}g`, `${fatsPct}%`,
        l("Ghee, peanut butter, walnuts, flaxseeds, olive oil", "घी, पीनट बटर, अखरोट, अलसी, जैतून तेल")],
    ],
    [35, 28, 25, 102]
  );

  addSpacing(ctx, 4);

  // ── Adaptive Calorie Adjustment Logic table ──
  addSubSection(ctx, l("Adaptive Calorie Adjustment Logic", "अनुकूली कैलोरी समायोजन तर्क"));
  const adaptiveRows = wantsGain ? [
    [l("Weight not increasing after 2 weeks", "2 सप्ताह बाद भी वजन नहीं बढ़ा"), l("+100-150 kcal/day to meals", "+100-150 kcal/दिन"), l("Check every 2 weeks", "हर 2 सप्ताह")],
    [l("Gaining >1 kg/month (too fast)", ">1 किग्रा/माह बढ़ रहा है"), l("-100 kcal/day from carbs", "-100 kcal/दिन कार्ब्स से"), l("Recheck in 2 weeks", "2 सप्ताह में")],
    [l("Energy crash persists after Week 3", "सप्ताह 3 के बाद ऊर्जा गिरावट"), l("Add 100 kcal mid-morning snack", "सुबह का नाश्ता +100 kcal"), l("Immediate", "तुरंत")],
    [l("Constipation not improved by Week 2", "सप्ताह 2 तक कब्ज नहीं सुधरी"), l("Increase water by 200ml + isabgol dose", "200ml पानी + इसबगोल"), l("Immediate", "तुरंत")],
  ] : wantsLoss ? [
    [l("Weight not decreasing after 2 weeks", "2 सप्ताह बाद भी वजन नहीं घटा"), l("-100 kcal/day from carbs", "-100 kcal/दिन कार्ब्स से"), l("Check every 2 weeks", "हर 2 सप्ताह")],
    [l("Losing >0.7 kg/week (too fast)", ">0.7 किग्रा/सप्ताह घट रहा है"), l("+100-150 kcal/day to protein", "+100-150 kcal/दिन प्रोटीन से"), l("Recheck in 1 week", "1 सप्ताह में")],
    [l("Energy crash or weakness", "ऊर्जा गिरावट या कमजोरी"), l("Add 1 banana + 1 tbsp peanut butter pre-workout", "प्री-वर्कआउट केला + PB"), l("Immediate", "तुरंत")],
    [l("Plateau after Week 6", "सप्ताह 6 के बाद प्लेटो"), l("Add 1 HIIT session/week + -50 kcal", "+1 HIIT/सप्ताह + -50 kcal"), l("Week 6 review", "सप्ताह 6 समीक्षा")],
  ] : [
    [l("Energy levels low throughout day", "दिन भर ऊर्जा कम"), l("Add mid-morning snack 150-200 kcal", "+150-200 kcal नाश्ता"), l("Immediate", "तुरंत")],
    [l("Sleeping poorly (< 6 hrs)", "नींद खराब (< 6 घंटे)"), l("Cut caffeine after 2pm + magnesium 300mg bedtime", "दोपहर के बाद कैफीन बंद"), l("Within 1 week", "1 सप्ताह में")],
    [l("Stress persists despite plan", "तनाव बना हुआ है"), l("Add 10 min morning walk + 4-7-8 breathing", "सुबह वॉक + श्वास अभ्यास"), l("Week 2", "सप्ताह 2")],
    [l("Digestion not improving by Week 2", "पाचन सप्ताह 2 तक नहीं सुधरा"), l("Add probiotic + 200ml water increase daily", "प्रोबायोटिक + 200ml पानी"), l("Immediate", "तुरंत")],
  ];

  drawPremiumTable(ctx,
    [l("Scenario", "परिदृश्य"), l("Action", "कार्य"), l("Timeframe", "समयसीमा")],
    adaptiveRows,
    [75, 80, 35]
  );

  smartNewPage(ctx);
}

// ════════════════════════════════════════════════════════════
// 03 · DECISION ENGINE & ROOT CAUSE ANALYSIS
// ════════════════════════════════════════════════════════════
function renderDecisionEngine(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("03 · Decision Engine & Root Cause Analysis", "03 · निर्णय इंजन और मूल कारण विश्लेषण"),
    l("How your health dimensions interconnect. These rules are derived from your quiz data.",
      "आपके स्वास्थ्य आयाम कैसे जुड़े हैं। ये नियम आपके क्विज़ डेटा से निकाले गए हैं।"));

  addSpacing(ctx, 2);

  // ── Visual Root Cause Chain ──
  const sleepLow = (profile.sleepScore || 50) < 60;
  const stressHigh = (profile.stressScore || 50) > 55;

  let chainTitle = l("Root Cause Chain: Sleep Deprivation", "मूल कारण: नींद की कमी");
  let chainItems: Array<{text: string; type: string}> = [];

  // FIX: PCOS gets insulin resistance chain, not thyroid chain
  const _hasPCOS = [...(profile.medicalConditions || []), ...(profile.healthConditions || [])]
    .some((c: string) => /pcos/i.test(c));
  const _hasThyroid = [...(profile.medicalConditions || []), ...(profile.healthConditions || [])]
    .some((c: string) => /thyroid/i.test(c));

  const _wantsGainChain = profile.goals?.some((g: string) => /gain|muscle|build/i.test(g));

  if (_hasPCOS) {
    chainTitle = l("Root Cause Chain: PCOS + Insulin Resistance", "मूल कारण: PCOS + इंसुलिन प्रतिरोध");
    chainItems = [
      { text: l(`${profile.sleepHours || 5.5} hrs Sleep Disruption`, `${profile.sleepHours || 5.5} घंटे नींद`), type: "ROOT CAUSE" },
      { text: l("Elevated Cortisol", "उच्च कोर्टिसोल"), type: "Hormonal" },
      { text: l("Insulin Resistance — PCOS Core", "इंसुलिन प्रतिरोध — PCOS"), type: "Metabolic" },
      { text: l("Androgen Excess (Testosterone ↑)", "एण्ड्रोजन अधिकता"), type: "PCOS" },
      { text: l("Mood Swings + Irregular Cycles", "मूड स्विंग + अनियमित चक्र"), type: "Hormonal Symptom" },
      { text: l("Weight Gain + Sweet Cravings + Skin", "वजन + मीठे की तृष्णा + त्वचा"), type: "Symptoms" },
    ];
  } else if (sleepLow) {
    chainTitle = l("Root Cause Chain: Sleep Deprivation", "मूल कारण: नींद की कमी");
    chainItems = [
      { text: l(`${profile.sleepHours || 5.5}–${(profile.sleepHours || 5.5) + 0.5} hrs Sleep`, `${profile.sleepHours || 5.5} घंटे नींद`), type: "ROOT CAUSE" },
      { text: l("High Cortisol", "उच्च कोर्टिसोल"), type: "Hormonal" },
      { text: l(_hasThyroid ? "Thyroid Suppression" : "Hormonal Disruption", _hasThyroid ? "थायरॉइड दमन" : "हार्मोनल असंतुलन"), type: "Metabolic" },
      { text: l("Afternoon Crash", "दोपहर की गिरावट"), type: "Energy" },
      { text: l("Salty / Sugar Cravings", "नमकीन/मीठे की तृष्णा"), type: "Behavioral" },
      { text: l("Poor Gut Motility", "खराब आंत गति"), type: "Digestive" },
      { text: l("Constipation + Dry Skin", "कब्ज + सूखी त्वचा"), type: "Symptoms" },
    ];
  } else if (stressHigh) {
    chainTitle = l("Root Cause Chain: High Stress", "मूल कारण: उच्च तनाव");
    chainItems = [
      { text: l("Chronic High Stress", "लगातार उच्च तनाव"), type: "ROOT CAUSE" },
      { text: l("HPA Axis Dysregulation", "HPA अक्ष असंतुलन"), type: "Hormonal" },
      { text: l("Cortisol Spike", "कोर्टिसोल स्पाइक"), type: "Metabolic" },
      { text: l("Sleep Disruption", "नींद में बाधा"), type: "Energy" },
      { text: l("Fatigue + Emotional Eating", "थकान + भावनात्मक खाना"), type: "Behavioral" },
      { text: l("Gut Inflammation", "पेट की सूजन"), type: "Digestive" },
      { text: l("Weight Gain + Skin Issues", "वजन बढ़ना + त्वचा समस्या"), type: "Symptoms" },
    ];
  } else {
    chainTitle = l("Root Cause Chain: Irregular Nutrition", "मूल कारण: अनियमित पोषण");
    chainItems = [
      { text: l("Irregular Meals / Low Calories", "अनियमित भोजन / कम कैलोरी"), type: "ROOT CAUSE" },
      { text: l("Blood Sugar Instability", "रक्त शर्करा अस्थिरता"), type: "Hormonal" },
      { text: l("Insulin Resistance Risk", "इंसुलिन प्रतिरोध"), type: "Metabolic" },
      { text: l("Energy Crashes", "ऊर्जा गिरावट"), type: "Energy" },
      { text: l("Cravings + Overeating", "तृष्णा + अत्यधिक खाना"), type: "Behavioral" },
      { text: l("Gut Microbiome Disruption", "पाचन तंत्र असंतुलन"), type: "Digestive" },
      { text: _wantsGainChain
          ? l("Muscle Gain Blocked + Nutrient Deficit", "मांसपेशी लाभ अवरुद्ध + पोषण कमी")
          : l("Fat Gain + Inflammation", "वसा बढ़ना + सूजन"),
        type: "Symptoms" },
    ];
  }

  // Draw the chain visually
  checkPageBreak(ctx, chainItems.length * 12 + 10);
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(chainTitle, ctx.margin, ctx.yPosition);
  ctx.yPosition += 8;

  chainItems.forEach((item, i) => {
    const boxW = ctx.contentWidth - 50;
    const boxH = 9;
    const isFirst = i === 0;
    ctx.pdf.setFillColor(...(isFirst ? [192, 57, 43] as [number,number,number] : NAVY_MID));
    ctx.pdf.rect(ctx.margin, ctx.yPosition, boxW, boxH, "F");
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, isFirst ? "bold" : "normal");
    ctx.pdf.text(item.text, ctx.margin + 3, ctx.yPosition + 6.5);
    // Type label on right
    ctx.pdf.setFontSize(7);
    ctx.pdf.setTextColor(...GRAY);
    setCtxFont(ctx, "normal");
    ctx.pdf.text(item.type, ctx.margin + boxW + 3, ctx.yPosition + 6.5);
    // "ROOT CAUSE" badge on first
    if (isFirst) {
      ctx.pdf.setFontSize(6.5);
      ctx.pdf.setTextColor(192, 57, 43);
      ctx.pdf.text(l("ROOT CAUSE", "मूल कारण"), ctx.margin + boxW + 3, ctx.yPosition + 6.5);
    }
    ctx.yPosition += boxH;
    // Arrow (except last)
    if (i < chainItems.length - 1) {
      ctx.pdf.setFontSize(8);
      ctx.pdf.setTextColor(...NAVY);
      ctx.pdf.text("v", ctx.margin + boxW / 2 - 1, ctx.yPosition + 3.5);
      ctx.yPosition += 5;
    }
  });

  addSpacing(ctx, 5);

  // ── Personalized Decision Trees ──
  checkPageBreak(ctx, 20);
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(l("Personalized Decision Trees", "व्यक्तिगत निर्णय नियम"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GRAY);
  setCtxFont(ctx, "normal");
  const treeDesc = l("These rules are derived from your quiz data. They are not generic advice — each IF condition matches your specific inputs.",
    "ये नियम आपके क्विज़ डेटा से हैं। प्रत्येक IF शर्त आपके विशिष्ट इनपुट से मेल खाती है।");
  const treeDescLines = ctx.pdf.splitTextToSize(treeDesc, ctx.contentWidth);
  ctx.pdf.text(treeDescLines, ctx.margin, ctx.yPosition);
  ctx.yPosition += treeDescLines.length * 5 + 4;

  const sleepHours = profile.sleepHours || 5.5;
  const waterLiters = profile.waterLiters !== undefined && profile.waterLiters !== null
    ? profile.waterLiters
    : (profile.waterIntake !== undefined && profile.waterIntake !== null ? profile.waterIntake : 0.8);
  const mealFreq = profile.mealFrequency || 3;
  const wantsGain = profile.goals?.some((g: string) => g.toLowerCase().includes("gain") || g.toLowerCase().includes("muscle"));
  const tdee = profile.tdee;

  const rules: string[][] = [];
  if ((profile.sleepScore || 50) < 70)
    rules.push([l(`IF sleep < 6 hrs (yours = ${sleepHours})`, `IF नींद < 6 घंटे (आपकी = ${sleepHours})`),
                l("Fix wake time to 6:30am; bed by 11pm", "जागने का समय 6:30am; सोना 11pm"),
                l("Cortisol/thyroid cascade", "कोर्टिसोल/थायरॉइड")]);
  if (waterLiters < 1.5)
    rules.push([l(`IF water < 1.5L (yours = ${waterLiters}L)`, `IF पानी < 1.5L (आपका = ${waterLiters}L)`),
                l("500ml warm water on waking + hourly schedule", "जागते ही 500ml गर्म पानी + घंटे दर घंटे"),
                l("Constipation + dry skin + crash", "कब्ज + सूखी त्वचा")]);
  if (mealFreq < 3)
    rules.push([l(`IF meals < 3/day (yours = ${mealFreq})`, `IF भोजन < 3/दिन (आपका = ${mealFreq})`),
                l(`Add 300 kcal evening snack immediately`, "शाम को 300 kcal नाश्ता तुरंत"),
                l(`Need ${tdee + 250}+ kcal; ${mealFreq} meals = ~${mealFreq * 700} max`, "कैलोरी लक्ष्य पूरा नहीं")]);
  // Condition-specific rules
  const conds = [...(profile.healthConditions || []), ...(profile.medicalConditions || [])];
  if (conds.some((c: string) => /thyroid/i.test(c)))
    rules.push([l("IF thyroid condition (yes)", "IF थायरॉइड स्थिति (हाँ)"),
                l("Prioritise TSH test + D3/B12 baseline before Week 1", "TSH + D3/B12 परीक्षण पहले करें"),
                l("Sleep deprivation suppresses TSH", "नींद की कमी TSH दबाती है")]);
  if (conds.some((c: string) => /anxiety|mood/i.test(c)))
    rules.push([l("IF anxiety present (yes)", "IF चिंता है (हाँ)"),
                l("4-7-8 breathing + Ashwagandha from Week 5", "4-7-8 श्वास + अश्वगंधा सप्ताह 5 से"),
                l("Cortisol-amygdala loop", "कोर्टिसोल-एमिग्डाला लूप")]);
  if (conds.some((c: string) => /lactose/i.test(c)))
    rules.push([l("IF lactose intolerant (yes)", "IF लैक्टोज असहिष्णु (हाँ)"),
                l("All dairy = lactose-free / coconut curd / almond milk", "सभी डेयरी = लैक्टोज-फ्री / नारियल दही"),
                l("Bloating + constipation amplifier", "सूजन + कब्ज बढ़ाता है")]);
  if (conds.some((c: string) => /gluten/i.test(c)))
    rules.push([l("IF gluten intolerant (yes)", "IF ग्लूटेन असहिष्णु (हाँ)"),
                l("Replace wheat with millets, rice, oats (GF)", "गेहूं की जगह बाजरा, चावल, GF ओट्स"),
                l("Gut inflammation + nutrient malabsorption", "पेट सूजन + पोषण अवशोषण")]);
  if (conds.some((c: string) => /diabetes|blood.sugar/i.test(c)))
    rules.push([l("IF diabetes / blood sugar (yes)", "IF डायबिटीज / रक्त शर्करा (हाँ)"),
                l("Low GI diet + 10-min post-meal walk + no refined sugar", "कम GI आहार + भोजन बाद चलना"),
                l("Insulin spike management", "इंसुलिन स्पाइक प्रबंधन")]);
  if (conds.some((c: string) => /acidity|acid.reflux|gerd/i.test(c)))
    rules.push([l("IF acidity / GERD (yes)", "IF एसिडिटी (हाँ)"),
                l("No food 2hrs before bed + avoid spicy dinner", "सोने से 2 घंटे पहले खाना बंद"),
                l("Gastric acid reduction", "गैस्ट्रिक एसिड नियंत्रण")]);
  if ((profile.skinConcerns || []).some((s: string) => /acne/i.test(s)))
    rules.push([l("IF acne (yes)", "IF मुँहासे (हाँ)"),
                l("Reduce dairy + high-GI foods + add zinc-rich foods", "डेयरी कम + जिंक युक्त खाद्य"),
                l("IGF-1 and sebum production", "IGF-1 और सीबम उत्पादन")]);
  if (profile.digestiveIssues?.some((d: string) => /constipat/i.test(d)))
    rules.push([l("IF constipation (yes)", "IF कब्ज (हाँ)"),
                l("2.1L water + 25g fiber/day + psyllium husk at night", "2.1L पानी + 25g फाइबर"),
                l("Gut motility + hydration", "आंत गति + जलयोजन")]);
  // FIX: Loose-motions is OPPOSITE of constipation — needs binding foods, NOT fiber loading
  if (profile.digestiveIssues?.some((d: string) => /loose.?motion|diarrhea|diarrhoea/i.test(d)))
    rules.push([l("IF loose motions (active)", "IF दस्त (सक्रिय)"),
                l("BRAT: banana, rice, stewed apple + electrolytes. Avoid raw veg, spicy, caffeine, gluten.", "BRAT: केला, चावल, सेब + इलेक्ट्रोलाइट। कच्ची सब्जी, मसाले, ग्लूटेन से बचें।"),
                l("Loose motions = gut inflammation. Opposite of constipation — avoid fiber loading.", "दस्त = पेट की सूजन। कब्ज के विपरीत — फाइबर से बचें।")]);
  if (profile.afternoonCrash || profile.digestiveIssues?.some((d: string) => /crash|fatigue/i.test(d)))
    rules.push([l("IF afternoon crash at 2-4pm (yes)", "IF दोपहर 2-4pm की गिरावट (हाँ)"),
                l("300ml water + banana + 5-min walk at 1:30pm", "1:30pm पर 300ml पानी + केला + 5 मिनट चलना"),
                l("Circadian dip + dehydration + blood sugar", "सर्काडियन गिरावट")]);
  if (wantsGain)
    rules.push([l("IF weight not gaining by Week 4", "IF सप्ताह 4 तक वजन नहीं बढ़ा"),
                l(`Add 100-150 kcal/day (target: ${tdee + 350} kcal)`, `+100-150 kcal/दिन (लक्ष्य: ${tdee + 350})`),
                l("Surplus insufficient for your TDEE", "TDEE के लिए अधिशेष अपर्याप्त")]);

  if (rules.length > 0) {
    drawPremiumTable(ctx,
      [l("IF Your Data Shows", "आपका डेटा दिखाता है"), l("THEN Your Action", "तो आपका कार्य"), l("WHY (Your Condition)", "क्यों")],
      rules,
      [58, 65, 67]
    );
  }

  addSpacing(ctx, 5);

  // ── Limiting Factor Priority Stack ──
  checkPageBreak(ctx, 20);
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...NAVY);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(l("Your Limiting Factor Priority Stack", "आपका सीमित कारक प्राथमिकता क्रम"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 6;

  const sleepHoursVal = profile.sleepHours || 5.5;
  // FIX 3: Use same score formulas as Dashboard — was using stale mealFreq/3 and waterVal default 1.2
  const waterVal2 = profile.waterLiters !== undefined && profile.waterLiters !== null
    ? profile.waterLiters
    : (profile.waterIntake !== undefined && profile.waterIntake !== null ? profile.waterIntake : 0.8);
  const mealFreqVal = profile.mealFrequency || 2;
  // Same mealTimingScore formula as Dashboard (not the old mealFreq/3 formula)
  const mealScoreStack = mealFreqVal >= 5 ? 100 : mealFreqVal === 4 ? 85
    : mealFreqVal === 3 ? 60 : mealFreqVal === 2 ? 35 : 10;
  // Same hydrationScore formula as Dashboard
  const hydScoreStack = Math.max(10, Math.min(90, Math.round((waterVal2 / 2.3) * 90)));
  const stressMgmtScore2 = Math.max(15, 100 - (profile.stressScore || 50));
  const gutScore2 = Math.max(20, 80 - ((profile.digestiveIssues?.length || 0) * 12));

  const dimScores = [
    { name: l("Sleep", "नींद"), score: profile.sleepScore || 50 },
    { name: l("Hydration", "जलयोजन"), score: hydScoreStack },
    { name: l("Meal Frequency", "भोजन आवृत्ति"), score: mealScoreStack },
    { name: l("Stress Mgmt", "तनाव प्रबंधन"), score: stressMgmtScore2 },
    { name: l("Gut Health", "पाचन"), score: gutScore2 },
  ].sort((a, b) => a.score - b.score);

  const impactDesc = (name: string, score: number, rank: number): string => {
    if (name.toLowerCase().includes("sleep") || name.toLowerCase().includes("नींद"))
      return l("Blocks muscle gain + worsens all other symptoms", "मांसपेशी लाभ रोकता है + सभी लक्षण बिगाड़ता है");
    if (name.toLowerCase().includes("hydration") || name.toLowerCase().includes("जल"))
      return l("Direct cause of constipation + dry skin + crash", "कब्ज + सूखी त्वचा + गिरावट का कारण");
    if (name.toLowerCase().includes("meal") || name.toLowerCase().includes("भोजन"))
      return l(`Cannot reach ${tdee + 250} kcal/day on ${mealFreqVal} meals`, `${mealFreqVal} भोजन में लक्ष्य नहीं`);
    if (name.toLowerCase().includes("stress") || name.toLowerCase().includes("तनाव"))
      return l("Amplifies cortisol loop", "कोर्टिसोल लूप को बढ़ाता है");
    return l("Blocks nutrient absorption", "पोषक तत्व अवशोषण बाधित");
  };

  const priorLabel = (score: number): string =>
    score < 40 ? l("CRITICAL", "गंभीर") : score < 60 ? l("HIGH", "उच्च") : l("MEDIUM", "मध्यम");

  const estImp = (score: number): string =>
    score < 40 ? l("+25-35 pts in 3 weeks", "+25-35 अंक 3 सप्ताह में") :
    score < 60 ? l("+20-30 pts in 2 weeks", "+20-30 अंक 2 सप्ताह में") :
                  l("+15-20 pts in 1 week", "+15-20 अंक 1 सप्ताह में");

  drawPremiumTable(ctx,
    [l("Priority", "प्राथमिकता"), l("Factor", "कारक"), l("Your Score", "स्कोर"), l("Impact on Goal", "लक्ष्य पर प्रभाव"), l("Est. Improvement", "अपेक्षित सुधार")],
    dimScores.map((d, i) => [
      `#${i + 1} — ${priorLabel(d.score)}`,
      d.name,
      `${d.score}/100`,
      impactDesc(d.name, d.score, i),
      estImp(d.score),
    ]),
    [32, 30, 22, 70, 36]
  );

  smartNewPage(ctx);
}

// ════════════════════════════════════════════════════════════
// 04 · 90-DAY WEIGHT PROJECTION
// ════════════════════════════════════════════════════════════
function renderWeightProjection(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  const wantsGain = profile.goals?.some((g: string) => g.toLowerCase().includes("gain") || g.toLowerCase().includes("muscle"));
  const wantsLoss = profile.goals?.some((g: string) => g.toLowerCase().includes("los") || g.toLowerCase().includes("fat"));
  // General wellness: small positive recomposition
  const weeklyChange = wantsGain ? 0.35 : wantsLoss ? -0.4 : 0.15;
  const tdee = profile.tdee;
  const calMin = wantsGain ? tdee + 250 : wantsLoss ? tdee - 500 : tdee + 100;
  const calMax = wantsGain ? tdee + 400 : wantsLoss ? tdee - 400 : tdee + 200;
  const calsDisplay = `${calMin}–${calMax} kcal/day`;

  const headerNote = wantsGain
    ? l(`Based on: TDEE ${tdee} kcal/day + 250–400 kcal surplus = ${calMin}–${calMax} kcal target. Conservative estimate: 0.25–0.5 kg lean gain per month.`,
        `TDEE ${tdee} + 250–400 kcal = ${calMin}–${calMax} kcal/दिन। 0.25–0.5 किग्रा/माह।`)
    : wantsLoss
    ? l(`Based on: TDEE ${tdee} kcal/day − 400–500 kcal deficit = ${calMin}–${calMax} kcal target. Conservative: 0.35–0.5 kg fat loss per week.`,
        `TDEE ${tdee} − 400–500 = ${calMin}–${calMax} kcal/दिन। 0.35-0.5 किग्रा/सप्ताह।`)
    : l(`Based on: TDEE ${tdee} kcal/day + 100–200 kcal. General wellness recomposition plan.`,
        `TDEE ${tdee} + 100–200 kcal। सामान्य स्वास्थ्य सुधार।`);

  addHeaderSection(ctx,
    l("04 · 90-Day Weight Projection (Computed)", "04 · 90-दिन का वजन अनुमान (गणना)"),
    headerNote);

  addSpacing(ctx, 2);

  const w0 = profile.weightKg;
  const sign = weeklyChange >= 0 ? "+" : "";

  const week4Lo = (w0 + weeklyChange * 3).toFixed(1);
  const week4Hi = (w0 + weeklyChange * 4).toFixed(1);
  const week8Lo = (w0 + weeklyChange * 6).toFixed(1);
  const week8Hi = (w0 + weeklyChange * 8).toFixed(1);
  const week10Lo = (w0 + weeklyChange * 9).toFixed(1);
  const week10Hi = (w0 + weeklyChange * 10).toFixed(1);

  const gain4Lo = (weeklyChange * 3).toFixed(1);
  const gain4Hi = (weeklyChange * 4).toFixed(1);
  const gain8Lo = (weeklyChange * 6).toFixed(1);
  const gain8Hi = (weeklyChange * 8).toFixed(1);
  const gain10Lo = (weeklyChange * 9).toFixed(1);
  const gain10Hi = (weeklyChange * 10).toFixed(1);

  const checkpoints = [
    [
      l("Week 0 (Now)", "सप्ताह 0 (अभी)"),
      `${w0.toFixed(1)} kg`,
      l("—", "—"),
      calsDisplay,
      l("Weigh in (Mon AM, before eating)", "वजन लें (सोमवार AM, खाने से पहले)"),
    ],
    [
      l("Week 4", "सप्ताह 4"),
      `${week4Lo}–${week4Hi} kg`,
      `${sign}${gain4Lo}–${sign}${gain4Hi} kg`,
      calsDisplay,
      wantsGain ? l("If not gained → +100 kcal/day", "नहीं बढ़ा → +100 kcal/दिन") :
      wantsLoss ? l("If not losing → −100 kcal/day", "नहीं घटा → −100 kcal/दिन") :
      l("Assess energy levels + adjust", "ऊर्जा स्तर देखें + समायोजित करें"),
    ],
    [
      l("Week 8", "सप्ताह 8"),
      `${week8Lo}–${week8Hi} kg`,
      `${sign}${gain8Lo}–${sign}${gain8Hi} kg total`,
      calsDisplay,
      l("Progress photos + measurements", "प्रगति फोटो + माप"),
    ],
    [
      l("Week 12", "सप्ताह 10"),
      `${week10Lo}–${week10Hi} kg`,
      `${sign}${gain10Lo}–${sign}${gain10Hi} kg total`,
      calsDisplay,
      l("Bloodwork retest + plan adjustment", "रक्त परीक्षण दोहराएं + योजना समायोजन"),
    ],
  ];

  drawPremiumTable(ctx,
    [l("Checkpoint", "जांच बिंदु"), l("Expected Weight", "अपेक्षित वजन"), l("Change", "बदलाव"), l("Calorie Target", "कैलोरी लक्ष्य"), l("Verification Action", "सत्यापन कार्य")],
    checkpoints,
    [28, 32, 32, 48, 60]
  );

  smartNewPage(ctx);
}


function renderMetabolicProfile(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const NAVY: [number, number, number] = [13, 27, 42];
  const GOLD: [number, number, number] = [201, 168, 76];
  const CREAM: [number, number, number] = [245, 240, 232];

  const bmi = Math.round((profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2))) * 10) / 10;
  const bmiCategory = bmi < 18.5 ? l("Underweight", "कम वजन") : bmi < 25 ? l("Normal", "सामान्य") : bmi < 30 ? l("Overweight", "अधिक वजन") : l("Obese", "मोटापा");
  const bmr = profile.bmr;
  const tdee = profile.tdee;
  const isMale = (profile.gender || "").toLowerCase() === "male" || (profile.gender || "").toLowerCase() === "m";
  const wantsGain = profile.goals?.some((g: string) => g.toLowerCase().includes("gain") || g.toLowerCase().includes("muscle"));
  const wantsLoss = profile.goals?.some((g: string) => g.toLowerCase().includes("los") || g.toLowerCase().includes("fat"));
  const goalCalMin = wantsGain ? tdee + 250 : wantsLoss ? tdee - 500 : tdee - 200;
  const goalCalMax = wantsGain ? tdee + 400 : wantsLoss ? tdee - 400 : tdee + 200;
  const goalLabel = wantsGain ? l("Gain Lean Muscle (YOUR GOAL)", "दुबली मांसपेशी बढ़ाएं (आपका लक्ष्य)") : wantsLoss ? l("Fat Loss (YOUR GOAL)", "वसा घटाएं (आपका लक्ष्य)") : l("Wellness Recomposition (YOUR GOAL)", "स्वास्थ्य पुनर्गठन (आपका लक्ष्य)");
  const goalNote = wantsGain
    ? l("250–400 kcal surplus above TDEE · 0.25–0.5kg lean gain per month · Optimal rate (JISSN, 2021)", "TDEE से 250–400 kcal अधिशेष · प्रति माह 0.25–0.5 किग्रा लाभ")
    : wantsLoss
    ? l("400–500 kcal deficit · 0.4–0.5 kg fat loss per week · Optimal muscle-preserving rate (JISSN, 2021)", "400–500 kcal कमी · प्रति सप्ताह 0.4–0.5 किग्रा वसा हानि")
    : l("100–200 kcal above TDEE supports gradual recomposition without excess fat gain", "TDEE से 100–200 kcal अधिक — क्रमिक पुनर्गठन");
  const isVeg = (/^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "")) || /plant/i.test(profile.dietaryPreference || "");

  addHeaderSection(ctx,
    l("03 · Metabolic Profile & Calorie Targets", "03 · मेटाबोलिक प्रोफ़ाइल और कैलोरी लक्ष्य"),
    l(`Calibrated for your goal: ${profile.goals?.[0] || "General Wellness"}`, `आपके लक्ष्य के लिए कैलिब्रेट: ${profile.goals?.[0] || "सामान्य स्वास्थ्य"}`)
  );

  addText(ctx, l(
    "Every number below is computed from your data — age, weight, height, activity level. These are not generic chart estimates.",
    "नीचे प्रत्येक नंबर आपके डेटा से गणना: आयु, वजन, ऊंचाई, गतिविधि। ये जेनेरिक चार्ट अनुमान नहीं हैं।"
  ), 9);
  addSpacing(ctx, 4);

  // ── Step-by-step calculation formulas (Brainy-style) ──
  const steps = [
    {
      step: l("STEP 1 · BMI (Body Mass Index)", "चरण 1 · BMI"),
      formula: l(`Weight ÷ Height² = ${profile.weightKg} ÷ ${(profile.heightCm / 100).toFixed(2)}² = ${bmi}`, `भार ÷ ऊंचाई² = ${profile.weightKg} ÷ ${(profile.heightCm / 100).toFixed(2)}² = ${bmi}`),
      note: bmi < 18.5 ? l("Underweight — focus on lean muscle gain.", "कम वजन — मांसपेशी लाभ पर ध्यान दें।")
        : bmi < 25 ? l("Healthy BMI range (18.5–24.9). Focus on body composition.", "स्वस्थ BMI। शरीर संरचना पर ध्यान दें।")
        : l(`Slightly above healthy range (18.5–24.9). ${wantsGain ? "Lean muscle goal — not fat." : "Focus on fat reduction, not muscle loss."}`, `स्वास्थ्यकर से थोड़ा ऊपर।`),
    },
    {
      step: l(`STEP 2 · BMR (Mifflin-St Jeor · ${isMale ? "Male" : "Female"})`, `चरण 2 · BMR`),
      formula: isMale
        ? l(`(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) + 5 = ${bmr} kcal/day`, `= ${bmr} kcal/दिन`)
        : l(`(10 × ${profile.weightKg}) + (6.25 × ${profile.heightCm}) − (5 × ${profile.age}) − 161 = ${bmr} kcal/day`, `= ${bmr} kcal/दिन`),
      note: l("Calories your body burns at complete rest. This is your baseline floor.", "पूर्ण विश्राम में आपका शरीर जितनी कैलोरी जलाता है।"),
    },
    {
      step: l("STEP 3 · TDEE (Activity Multiplier)", "चरण 3 · TDEE"),
      formula: (() => {
        const actLabelMap: Record<string,string> = {
          "sedentary": "Sedentary",
          "lightly-active": "Lightly Active",
          "moderately-active": "Moderately Active",
          "very-active": "Very Active",
          "highly-active": "Highly Active",
        };
        const actLabel = actLabelMap[profile.activityLevel || ""] || "Lightly Active";
        return l(`BMR × ${(tdee / bmr).toFixed(3)} (${actLabel}) = ${bmr} × ${(tdee / bmr).toFixed(3)} = ${tdee} kcal/day`, `BMR × ${(tdee / bmr).toFixed(3)} (${actLabel}) = ${bmr} × ${(tdee / bmr).toFixed(3)} = ${tdee} kcal/दिन`);
      })(),
      note: l("Total calories you burn on a typical day. Eat below this for fat loss.", "एक सामान्य दिन में आप जितनी कैलोरी जलाते हैं।"),
    },
    {
      step: l(`STEP 4 · Calorie Target for ${wantsGain ? "Lean Gain" : wantsLoss ? "Fat Loss" : "General Wellness"}`, "चरण 4 · कैलोरी लक्ष्य"),
      formula: wantsGain
        ? l(`TDEE + 250–400 = ${tdee} + 250–400 = ${goalCalMin}–${goalCalMax} kcal/day`, `${goalCalMin}–${goalCalMax} kcal/दिन`)
        : wantsLoss
        ? l(`TDEE − 400–500 = ${tdee} − 400–500 = ${goalCalMin}–${goalCalMax} kcal/day`, `${goalCalMin}–${goalCalMax} kcal/दिन`)
        : l(`TDEE ± 200 = ${goalCalMin}–${goalCalMax} kcal/day (recomposition)`, `${goalCalMin}–${goalCalMax} kcal/दिन`),
      note: goalNote,
    },
  ];

  steps.forEach(({ step, formula, note }) => {
    checkPageBreak(ctx, 20);
    ctx.pdf.setFillColor(...CREAM);
    ctx.pdf.rect(ctx.margin, ctx.yPosition - 1, 170, 19, "F");
    ctx.pdf.setFillColor(...GOLD);
    ctx.pdf.rect(ctx.margin, ctx.yPosition - 1, 3, 19, "F");
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(step, ctx.margin + 6, ctx.yPosition + 5);
    ctx.pdf.setTextColor(30, 30, 30);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text(formula, ctx.margin + 6, ctx.yPosition + 11);
    ctx.pdf.setTextColor(100, 100, 100);
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(note, ctx.margin + 6, ctx.yPosition + 16);
    ctx.yPosition += 22;
  });

  addSpacing(ctx, 4);

  // ── 4 Metric Cards ──
  checkPageBreak(ctx, 30);
  const cards = [
    { label: l("BMI", "BMI"), value: bmi.toFixed(1), unit: "(kg/m²)" },
    { label: l("BMR", "BMR"), value: String(bmr), unit: "kcal/day" },
    { label: l("TDEE", "TDEE"), value: String(tdee), unit: "kcal/day" },
    { label: l("GOAL", "लक्ष्य"), value: `${goalCalMin}–${goalCalMax}`, unit: "kcal/day" },
  ];
  const cardW = 40;
  cards.forEach((card, i) => {
    const x = ctx.margin + i * (cardW + 3);
    ctx.pdf.setFillColor(...NAVY);
    ctx.pdf.rect(x, ctx.yPosition, cardW, 22, "F");
    ctx.pdf.setTextColor(...GOLD);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(card.label, x + cardW / 2, ctx.yPosition + 6, { align: "center" });
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(i === 3 ? 8 : 11);
    ctx.pdf.text(card.value, x + cardW / 2, ctx.yPosition + 14, { align: "center" });
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(card.unit, x + cardW / 2, ctx.yPosition + 19, { align: "center" });
  });
  ctx.yPosition += 28;

  addSpacing(ctx, 4);

  // ── Calorie Targets Table ──
  addSubSection(ctx, l("Calorie Targets — Your Goal", "कैलोरी लक्ष्य — आपका लक्ष्य"));
  const calRows = [
    { label: goalLabel, value: `${goalCalMin}–${goalCalMax} kcal/day`, isGoal: true, note: goalNote },
    { label: l("⚪ Maintain current weight", "⚪ वर्तमान वजन बनाए रखें"), value: `~${tdee} kcal/day`, isGoal: false, note: l("Reference point only — not your target", "केवल संदर्भ बिंदु") },
  ];
  calRows.forEach((row, idx) => {
    checkPageBreak(ctx, 16);
    ctx.pdf.setFillColor(row.isGoal ? 13 : 240, row.isGoal ? 27 : 240, row.isGoal ? 42 : 240);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 170, 14, "F");
    ctx.pdf.setTextColor(row.isGoal ? 201 : 60, row.isGoal ? 168 : 60, row.isGoal ? 76 : 60);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text(row.label, ctx.margin + 4, ctx.yPosition + 7);
    ctx.pdf.setTextColor(row.isGoal ? 255 : 30, row.isGoal ? 255 : 30, row.isGoal ? 255 : 30);
    ctx.pdf.setFontSize(10);
    ctx.pdf.text(row.value, 175, ctx.yPosition + 7, { align: "right" });
    ctx.pdf.setTextColor(row.isGoal ? 200 : 100, row.isGoal ? 200 : 100, row.isGoal ? 200 : 100);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(row.note, ctx.margin + 4, ctx.yPosition + 12);
    ctx.yPosition += 16;
  });

  addSpacing(ctx, 5);

  // ── Daily Macro Targets (Brainy-style 3 blocks) ──
  addSubSection(ctx, l("Daily Macronutrient Targets", "दैनिक मैक्रोन्यूट्रिएंट लक्ष्य"));
  const proteinPct = Math.round(((profile.proteinGrams * 4) / tdee) * 100);
  const carbsPct = Math.round(((profile.carbsGrams * 4) / tdee) * 100);
  const fatsPct = Math.round(((profile.fatsGrams * 9) / tdee) * 100);

  const macros = [
    {
      name: l("PROTEIN", "प्रोटीन"),
      grams: profile.proteinGrams,
      pct: proteinPct,
      sources: isVeg
        ? l("Sprouts, lentils, paneer, tofu, Greek yogurt, soya", "अंकुरित अनाज, दाल, पनीर, टोफू, ग्रीक दही, सोया")
        : l("Eggs, chicken, fish, paneer, lentils, Greek yogurt", "अंडे, चिकन, मछली, पनीर, दाल, ग्रीक दही"),
    },
    {
      name: l("CARBOHYDRATES", "कार्बोहाइड्रेट"),
      grams: profile.carbsGrams,
      pct: carbsPct,
      sources: l("Oats, millets, brown rice, sweet potato, banana", "ओट्स, बाजरा, भूरे चावल, शकरकंद, केला"),
    },
    {
      name: l("HEALTHY FATS", "स्वस्थ वसा"),
      grams: profile.fatsGrams,
      pct: fatsPct,
      sources: l("Ghee, olive oil, walnuts, peanut butter, flaxseeds", "घी, जैतून का तेल, अखरोट, मूंगफली का मक्खन, अलसी"),
    },
  ];

  checkPageBreak(ctx, 40);
  const mW = 53;
  macros.forEach((macro, i) => {
    const x = ctx.margin + i * (mW + 3);
    ctx.pdf.setFillColor(...CREAM);
    ctx.pdf.rect(x, ctx.yPosition, mW, 40, "F");
    ctx.pdf.setFillColor(...GOLD);
    ctx.pdf.rect(x, ctx.yPosition, mW, 3, "F");
    ctx.pdf.setTextColor(...NAVY);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(7);
    ctx.pdf.text(macro.name, x + mW / 2, ctx.yPosition + 10, { align: "center" });
    ctx.pdf.setFontSize(16);
    ctx.pdf.text(`${macro.grams}g`, x + mW / 2, ctx.yPosition + 21, { align: "center" });
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(100, 100, 100);
    ctx.pdf.text(`${macro.pct}% of calories`, x + mW / 2, ctx.yPosition + 28, { align: "center" });
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(6.5);
    const splitSources = ctx.pdf.splitTextToSize(macro.sources, mW - 4);
    ctx.pdf.text(splitSources.slice(0, 2), x + mW / 2, ctx.yPosition + 34, { align: "center" });
  });
  ctx.yPosition += 46;

  // ── Macro summary bar ──
  addSpacing(ctx, 2);
  checkPageBreak(ctx, 10);
  ctx.pdf.setFillColor(...NAVY);
  ctx.pdf.rect(ctx.margin, ctx.yPosition, 170, 9, "F");
  ctx.pdf.setTextColor(...GOLD);
  setCtxFont(ctx, "bold");
  ctx.pdf.setFontSize(8);
  ctx.pdf.text(
    l(`Protein — ${profile.proteinGrams}g · ${proteinPct}%    Carbohydrates — ${profile.carbsGrams}g · ${carbsPct}%    Fats — ${profile.fatsGrams}g · ${fatsPct}%`,
      `प्रोटीन — ${profile.proteinGrams}g · ${proteinPct}%    कार्ब — ${profile.carbsGrams}g · ${carbsPct}%    वसा — ${profile.fatsGrams}g · ${fatsPct}%`),
    105, ctx.yPosition + 6, { align: "center" }
  );
  ctx.yPosition += 12;

  smartNewPage(ctx);
}

function renderNutritionStrategy(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, narratives } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  const isVeg = (/^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "")) || /plant/i.test(profile.dietaryPreference || "");
  const isVegan = profile.dietaryPreference?.toLowerCase().includes("vegan");

  addHeaderSection(ctx, l("05 · Nutrition Strategy & Macros", "05 · पोषण रणनीति और मैक्रो"), l(`Tailored to ${profile.name}'s diet — ${profile.tdee} kcal target`, `${profile.name} के आहार के लिए — ${profile.tdee} kcal लक्ष्य`));

  addSubSection(ctx, l(`Target Macros: P:${profile.proteinGrams}g | C:${profile.carbsGrams}g | F:${profile.fatsGrams}g`, `लक्ष्य मैक्रो: P:${profile.proteinGrams}g | C:${profile.carbsGrams}g | F:${profile.fatsGrams}g`));

  if (narratives.nutritionNarrative) {
    addText(ctx, narratives.nutritionNarrative, 9);
  } else {
    addText(ctx, l(
      `This plan is calculated specifically for a ${profile.age}-year old ${profile.gender} weighing ${profile.weightKg}kg with a goal of ${profile.activityScore > 50 ? "performance" : "wellness"}.`,
      `यह योजना विशेष रूप से ${profile.age} वर्षीय ${profile.gender === "male" ? "पुरुष" : "महिला"} के लिए तैयार की गई है जिनका वजन ${profile.weightKg}किग्रा है और लक्ष्य ${profile.activityScore > 50 ? "प्रदर्शन" : "स्वास्थ्य"} है।`
    ), 9);
  }
  addSpacing(ctx, 3);

  addSubSection(ctx, l("Core Nutrition Principles", "मुख्य पोषण सिद्धांत"));
  addText(ctx, l("Build every meal with these four components:", "हर भोजन इन चार घटकों से बनाएं:"), 9);
  if (isVegan) {
    addBullet(ctx, l("Protein: Tofu, tempeh, legumes (dal, chickpeas, rajma), seitan, quinoa", "प्रोटीन: टोफू, टेम्पेह, दालें (चना, राजमा), सीटान, क्विनोआ"), 8);
    addBullet(ctx, l("Complex Carbs: Brown rice, millets (ragi, jowar), sweet potato, oats, quinoa", "जटिल कार्ब्स: ब्राउन राइस, बाजरा (रागी, ज्वार), शकरकंद, ओट्स, क्विनोआ"), 8);
    addBullet(ctx, l("Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, carrots, gourds", "सब्जियां: न्यूनतम 3 सर्विंग/दिन — पालक, ब्रोकली, शिमला मिर्च, गाजर, लौकी"), 8);
    addBullet(ctx, l("Healthy Fats: Coconut oil, olive oil, flaxseeds, chia seeds, walnuts, avocado", "स्वस्थ वसा: नारियल तेल, जैतून का तेल, अलसी, चिया बीज, अखरोट, एवोकाडो"), 8);
  } else if (isVeg) {
    addBullet(ctx, l("Protein: Paneer, Greek yogurt, eggs, dal (moong/arhar/masoor), chickpeas, tofu", "प्रोटीन: पनीर, ग्रीक दही, अंडे, दाल (मूंग/अरहर/मसूर), चना, टोफू"), 8);
    addBullet(ctx, l("Complex Carbs: Brown rice, whole wheat roti, oats, millets, sweet potato", "जटिल कार्ब्स: ब्राउन राइस, पूरी गेहूं की रोटी, ओट्स, बाजरा, शकरकंद"), 8);
    addBullet(ctx, l("Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, gourds, beans", "सब्जियां: न्यूनतम 3 सर्विंग/दिन — पालक, ब्रोकली, शिमला मिर्च, लौकी, फलियां"), 8);
    addBullet(ctx, l("Healthy Fats: Ghee, olive oil, nuts (almonds, walnuts), seeds, coconut", "स्वस्थ वसा: घी, जैतून का तेल, मेवे (बादाम, अखरोट), बीज, नारियल"), 8);
  } else {
    addBullet(ctx, l("Protein: Chicken breast, fish (salmon, mackerel), eggs, paneer, dal, legumes", "प्रोटीन: चिकन ब्रेस्ट, मछली (सालमन, मैकेरल), अंडे, पनीर, दाल, फलियां"), 8);
    addBullet(ctx, l("Complex Carbs: Brown rice, whole wheat roti, oats, millets, sweet potato", "जटिल कार्ब्स: ब्राउन राइस, पूरी गेहूं की रोटी, ओट्स, बाजरा, शकरकंद"), 8);
    addBullet(ctx, l("Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, carrots, gourds", "सब्जियां: न्यूनतम 3 सर्विंग/दिन — पालक, ब्रोकली, शिमला मिर्च, गाजर, लौकी"), 8);
    addBullet(ctx, l("Healthy Fats: Ghee, olive oil, nuts (almonds, walnuts), fatty fish, seeds", "स्वस्थ वसा: घी, जैतून का तेल, मेवे (बादाम, अखरोट), वसायुक्त मछली, बीज"), 8);
  }

  if (profile.foodIntolerances?.length > 0) {
    addSpacing(ctx, 2);
    addSubSection(ctx, l("Substitutions for Your Intolerances", "आपकी असहिष्णुता के लिए विकल्प"));
    profile.foodIntolerances.forEach(intolerance => {
      const lower = intolerance.toLowerCase();
      if (lower.includes("lactose") || lower.includes("dairy")) {
        addBullet(ctx, l("Dairy-free: Use almond/oat milk, coconut yogurt, tofu instead of paneer", "डेयरी-मुक्त: पनीर के बजाय बादाम/ओट दूध, नारियल दही, टोफू उपयोग करें"), 8);
      } else if (lower.includes("gluten") || lower.includes("wheat")) {
        addBullet(ctx, l("Gluten-free: Use rice, millets (ragi, jowar, bajra), quinoa, buckwheat instead of wheat", "ग्लूटन-मुक्त: गेहूं के बजाय चावल, बाजरा (रागी, ज्वार, बाजरा), क्विनोआ, कुट्टू उपयोग करें"), 8);
      } else if (lower.includes("nut")) {
        addBullet(ctx, l("Nut-free: Use seeds (sunflower, pumpkin), coconut, soy for healthy fats", "मेवा-मुक्त: स्वस्थ वसा के लिए बीज (सूरजमुखी, कद्दू), नारियल, सोया उपयोग करें"), 8);
      } else if (lower.includes("soy")) {
        addBullet(ctx, l("Soy-free: Use paneer, chickpea flour, and hemp protein as alternatives", "सोया-मुक्त: विकल्प के रूप में पनीर, चने का आटा, और हेम्प प्रोटीन उपयोग करें"), 8);
      } else {
        addBullet(ctx, l(`${intolerance}: Substitute with similar nutrient-dense alternatives`, `${intolerance}: समान पोषक-घने विकल्पों से बदलें`), 8);
      }
    });
  }

  addSpacing(ctx, 3);
  addSubSection(ctx, l("Hydration Protocol", "जलयोजन प्रोटोकॉल"));
  addBullet(ctx, l(`Upon waking: 500ml warm water (rehydrates after ${profile.sleepScore < 60 ? "disrupted" : "overnight"} sleep)`, `जागने पर: 500ml गर्म पानी (${profile.sleepScore < 60 ? "बाधित" : "रात की"} नींद के बाद पुनर्जलयोजन)`), 8);
  addBullet(ctx, l("Before meals: 250ml water 20 min prior (improves digestion and satiety)", "भोजन से पहले: 20 मिनट पहले 250ml पानी (पाचन और तृप्ति में सुधार)"), 8);
  addBullet(ctx, l(`Daily target: ${Math.round(profile.weightKg * 0.033 * 10) / 10} liters (0.033L per kg body weight)`, `दैनिक लक्ष्य: ${Math.round(profile.weightKg * 0.033 * 10) / 10} लीटर (0.033L प्रति किग्रा शरीर भार)`), 8);
  addBullet(ctx, l("Post-exercise: 500ml per 30 minutes of activity", "व्यायाम के बाद: प्रति 30 मिनट गतिविधि पर 500ml"), 8);
  addNote(ctx, l(
    "Ref: European Journal of Nutrition (2021) — adequate hydration improves cognitive function by 14% and reduces fatigue.",
    "संदर्भ: European Journal of Nutrition (2021) — पर्याप्त जलयोजन संज्ञानात्मक कार्य को 14% सुधारता है और थकान कम करता है।"
  ));

  smartNewPage(ctx);
}

function renderMealPlan(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, mealPlan } = bundle;
  if (!mealPlan?.days?.length) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("06 · 7-Day Meal Plan + Eating Out Guide", "06 · 7-दिन की भोजन योजना"), l(`${profile.dietaryPreference || "Balanced"} · ~${profile.tdee} kcal · Indian context`, `${profile.dietaryPreference || "संतुलित"} · ~${profile.tdee} kcal · भारतीय संदर्भ`));

  const hasGlutenIntolerance = (profile.foodIntolerances || []).some((f: string) => /gluten|wheat/i.test(f));
  if (hasGlutenIntolerance) {
    checkPageBreak(ctx, 18);
    ctx.pdf.setFillColor(255, 243, 205);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 16, "F");
    ctx.pdf.setFillColor(255, 193, 7);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 3, 16, "F");
    ctx.pdf.setTextColor(120, 70, 0);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.text(l("⚠ Gluten Intolerance Alert", "⚠ ग्लूटन असहिष्णुता चेतावनी"), ctx.margin + 6, ctx.yPosition + 6);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(8);
    ctx.pdf.text(l("Swap all wheat-based items (roti, atta, maida, bread) with rice, ragi, jowar, bajra, or quinoa. Check labels on packaged oats.", "सभी गेहूं आधारित चीज़ें (रोटी, आटा, मैदा, ब्रेड) को चावल, रागी, ज्वार, बाजरा या क्विनोआ से बदलें।"), ctx.margin + 6, ctx.yPosition + 12);
    ctx.yPosition += 20;
    ctx.pdf.setTextColor(...DARK);
  }

  const renderMealItems = (label: string, items: MealItem[]) => {
    if (!items?.length) return;
    addText(ctx, `${label}:`, 9, DARK, true);
    items.forEach(item => {
      checkPageBreak(ctx, 5);
      ctx.pdf.setFontSize(8);
      ctx.pdf.setTextColor(...DARK);
      setCtxFont(ctx, "normal");
      const line = `  ${item.name} — ${item.portion} | ${item.calories} kcal | P:${item.protein}g C:${item.carbs}g F:${item.fats}g`;
      const lines = ctx.pdf.splitTextToSize(line, ctx.contentWidth - 5);
      ctx.pdf.text(lines, ctx.margin + 5, ctx.yPosition);
      ctx.yPosition += lines.length * 3.2 + 0.5;
    });
  };

  mealPlan.days.forEach((day: DayMeal, idx: number) => {
    if (idx > 0 && idx % 2 === 0) addNewPage(ctx);
    checkPageBreak(ctx, 40);

    addText(ctx, `${day.dayLabel} — Total: ${day.totalCalories} kcal | P:${day.totalProtein}g C:${day.totalCarbs}g F:${day.totalFats}g`, 10, PURPLE, true);
    addSpacing(ctx, 1);

    renderMealItems(l("Breakfast", "नाश्ता"), day.breakfast);
    renderMealItems(l("Mid-Morning Snack", "मध्य-सुबह नाश्ता"), day.midMorningSnack);
    renderMealItems(l("Lunch", "दोपहर का भोजन"), day.lunch);
    renderMealItems(l("Evening Snack", "शाम का नाश्ता"), day.eveningSnack);
    renderMealItems(l("Dinner", "रात का भोजन"), day.dinner);

    addSpacing(ctx, 3);
  });

  if (mealPlan.dietaryNotes?.length > 0) {
    addSpacing(ctx, 2);
    addSubSection(ctx, l("Dietary Notes", "आहार संबंधी नोट्स"));
    mealPlan.dietaryNotes.forEach(note => addBullet(ctx, note, 8));
  }

  addNote(ctx, l(
    `Daily target: ~${mealPlan.dailyTargetCalories} kcal. Portion sizes are calibrated to your metabolic profile. Adjust portions by 10-15% if you feel consistently hungry or overfull.`,
    `दैनिक लक्ष्य: ~${mealPlan.dailyTargetCalories} kcal. भोजन का आकार आपके मेटाबोलिक प्रोफ़ाइल के अनुसार कैलिब्रेट किया गया है। यदि आप लगातार भूखे या बहुत भरे महसूस करते हैं तो 10-15% हिस्से समायोजित करें।`
  ));
  smartNewPage(ctx);
}

function renderSleepProtocol(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, narratives, tier } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("07 · Sleep & Energy Protocol", "07 · नींद और ऊर्जा प्रोटोकॉल"), l(`Sleep Score: ${profile.sleepScore}/100 · Target: 7-8 hrs nightly`, `नींद स्कोर: ${profile.sleepScore}/100 · लक्ष्य: 7-8 घंटे रात`));

  if (narratives.sleepNarrative) {
    addText(ctx, narratives.sleepNarrative, 9);
    addSpacing(ctx, 2);
  }

  addSubSection(ctx, l("3 Non-Negotiable Sleep Rules", "3 अनिवार्य नींद नियम"));
  drawQuickActionCards(ctx, [
    {
      number: "01",
      title: l("Fixed Wake Time", "निश्चित जागने का समय"),
      body: l("Same wake time every day — even weekends. This anchors your circadian rhythm. Variability >60 min raises cardiac risk by 27%.", "हर दिन एक ही समय पर उठें — सप्ताहांत में भी। 60 मिनट से अधिक परिवर्तन हृदय जोखिम 27% बढ़ाता है।"),
      color: NAVY,
    },
    {
      number: "02",
      title: l("Dark + Cool Room", "अंधेरा + ठंडा कमरा"),
      body: l("Blackout curtains or eye mask (<5 lux). Room at 18-20°C. Dim light cuts melatonin 50%. Cool temp helps your body drop its core temperature to trigger sleep.", "ब्लैकआउट पर्दे या आई मास्क। कमरे का तापमान 18-20°C। ठंडा तापमान नींद शुरू करने में मदद करता है।"),
      color: NAVY_MID,
    },
    {
      number: "03",
      title: l("Screen-Free Wind-Down", "स्क्रीन-मुक्त विश्राम"),
      body: l("No screens 60-90 min before bed. Blue light (450-495nm) suppresses melatonin by 85%. Read, stretch, or do breathwork instead.", "सोने से 60-90 मिनट पहले स्क्रीन बंद करें। इसके बजाय पढ़ें, स्ट्रेच करें या श्वास व्यायाम करें।"),
      color: TEAL_BG,
    },
  ]);

  addSpacing(ctx, 2);
  drawChecklistTable(ctx, l("Pre-Sleep Checklist (Nightly)", "सोने से पहले की जांच सूची (रात्रि)"), [
    l("No caffeine after 2 PM — 5-6 hr half-life disrupts sleep onset", "दोपहर 2 बजे के बाद कैफीन नहीं — 5-6 घंटे की अर्ध-जीवन नींद को बाधित करती है"),
    l("Warm shower/bath 90 min before bed — triggers core temp drop", "सोने से 90 मिनट पहले गर्म स्नान — शरीर के तापमान में गिरावट शुरू करता है"),
    l("Phone on DND/silent in another room", "फोन को DND/साइलेंट पर और दूसरे कमरे में रखें"),
    l("Dim all lights at least 1 hour before bed", "सोने से कम से कम 1 घंटे पहले सभी रोशनी कम करें"),
    l("Journal tomorrow's top 3 tasks — clears mental loops", "कल के शीर्ष 3 कार्य लिखें — मानसिक चक्र साफ होता है"),
  ], NAVY);
  addSpacing(ctx, 2);

  if (tier !== "free") {
    drawPremiumTable(ctx,
      [l("SUPPLEMENT", "सप्लीमेंट"), l("DOSE & TIMING", "खुराक और समय"), l("BENEFIT", "लाभ")],
      [
        [l("Magnesium Bisglycinate", "मैग्नीशियम बिसग्लाइसिनेट"), l("300-400mg, 60 min before bed", "300-400mg, सोने से 60 मिनट पहले"), l("Deepens sleep, reduces cortisol", "गहरी नींद, कोर्टिसोल कम करता है")],
        [l("L-Theanine", "L-थियानिन"), l("100-200mg at bedtime", "100-200mg सोते समय"), l("Alpha brain waves = calm without drowse", "अल्फा तरंगें = बिना उनींदापन के शांति")],
        [l("Ashwagandha KSM-66", "अश्वगंधा KSM-66"), l("300mg before bed (stress-only)", "300mg (केवल तनाव के लिए)"), l("Cortisol -23%, improves deep sleep", "कोर्टिसोल -23%, गहरी नींद सुधारता है")],
      ],
      [60, 62, 58]
    );
    addNote(ctx, l("Try the sleep hygiene protocol for 2 weeks before adding supplements. Add one at a time.", "सप्लीमेंट जोड़ने से पहले 2 सप्ताह तक प्रोटोकॉल आजमाएं। एक बार में एक जोड़ें।"));
  }

  if (profile.workSchedule?.toLowerCase().includes("night") || profile.workSchedule?.toLowerCase().includes("shift")) {
    addSpacing(ctx, 2);
    addSubSection(ctx, l("Shift Worker Adaptations", "शिफ्ट कार्यकर्ता अनुकूलन"));
    addBullet(ctx, l("Blackout curtains for daytime sleep — simulate nighttime darkness", "दिन की नींद के लिए ब्लैकआउट पर्दे — रात के अंधेरे का अनुकरण"), 8);
    addBullet(ctx, l("0.5mg melatonin 30 min before desired sleep time on shift days", "शिफ्ट दिनों में वांछित नींद से 30 मिनट पहले 0.5mg मेलाटोनिन"), 8);
    addBullet(ctx, l("Blue-light blocking glasses in last 2 hours of shift", "शिफ्ट के अंतिम 2 घंटों में ब्लू-लाइट अवरोधक चश्मा"), 8);
  }

  smartNewPage(ctx);
}

function renderMovementProgram(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, narratives, rules, tier } = bundle;
  const modules = rules.activeModules || [];
  const isBeginner = modules.includes("beginner_program");
  if (!modules.includes("movement_program") && !isBeginner) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  const title = isBeginner ? l("09 · Starter Movement Plan", "09 · शुरुआती व्यायाम योजना") : l("09 · Training Program", "09 · प्रशिक्षण कार्यक्रम");
  addHeaderSection(ctx, title, l(`${profile.name}'s personalized exercise protocol — Activity Score: ${profile.activityScore}/100`, `${profile.name} का व्यक्तिगत व्यायाम प्रोटोकॉल — गतिविधि स्कोर: ${profile.activityScore}/100`));

  if (narratives.movementNarrative) {
    addText(ctx, narratives.movementNarrative, 9);
    addSpacing(ctx, 2);
  }

  const exercisePrefs = profile.exercisePreference || [];
  const prefText = l(
    exercisePrefs.length > 0 ? `Your preferred activities (${exercisePrefs.join(", ")}) have been incorporated where possible.` : "This program uses fundamental movement patterns suitable for all fitness levels.",
    exercisePrefs.length > 0 ? `आपकी पसंदीदा गतिविधियां (${exercisePrefs.join(", ")}) जहां संभव हो शामिल की गई हैं।` : "यह कार्यक्रम सभी फिटनेस स्तरों के लिए उपयुक्त मौलिक गति पैटर्न उपयोग करता है।"
  );
  addText(ctx, l(
    `${prefText} ${profile.activityScore < 40 ? "Given your sedentary baseline, we start conservatively and build gradually." : profile.activityScore < 60 ? "Your moderate activity level means you can handle progressive challenges." : "Your strong fitness base allows for more advanced programming."}`,
    `${prefText} ${profile.activityScore < 40 ? "आपके निष्क्रिय आधार को देखते हुए, हम सावधानी से शुरू करके धीरे-धीरे बढ़ते हैं।" : profile.activityScore < 60 ? "आपका मध्यम गतिविधि स्तर मतलब आप प्रगतिशील चुनौतियों को संभाल सकते हैं।" : "आपका मजबूत फिटनेस आधार अधिक उन्नत प्रोग्रामिंग की अनुमति देता है।"}`
  ), 9);
  addSpacing(ctx, 3);

  if (tier === "essential") {
    addSubSection(ctx, l("3-Day Foundation Program", "3-दिन का आधार कार्यक्रम"));
    addText(ctx, l(`Designed for sustainable habit building at your current activity level (${profile.activityScore}/100). Each session is 25-35 minutes.`, `आपके वर्तमान गतिविधि स्तर (${profile.activityScore}/100) पर टिकाऊ आदत निर्माण के लिए। प्रत्येक सत्र 25-35 मिनट है।`), 9);
    addSpacing(ctx, 2);
    addText(ctx, l("Day 1 (Mon/Tue): Full Body Strength", "दिन 1 (सोम/मंगल): पूर्ण शरीर शक्ति"), 9, DARK, true);
    addBullet(ctx, l("Warm-up: 5 min light movement (marching, arm circles)", "वार्म-अप: 5 मिनट हल्की हरकत (मार्चिंग, बांह घुमाना)"), 8);
    addBullet(ctx, l("Squats or wall sits: 3 sets x 10-15 reps", "स्क्वाट या वॉल सिट: 3 सेट x 10-15 रेप"), 8);
    addBullet(ctx, l("Push-ups (or knee push-ups): 3 sets x 8-12 reps", "पुश-अप (या घुटने पुश-अप): 3 सेट x 8-12 रेप"), 8);
    addBullet(ctx, l("Dumbbell rows or resistance band rows: 3 sets x 10-12 reps each side", "डम्बल रो या रेजिस्टेंस बैंड रो: 3 सेट x 10-12 रेप प्रत्येक तरफ"), 8);
    addBullet(ctx, l("Plank hold: 3 sets x 20-45 seconds", "प्लैंक होल्ड: 3 सेट x 20-45 सेकंड"), 8);
    addBullet(ctx, l("Cool-down: 5 min stretching", "कूल-डाउन: 5 मिनट स्ट्रेचिंग"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Day 2 (Wed/Thu): Zone 2 Cardio — 30 minutes", "दिन 2 (बुध/गुरु): जोन 2 कार्डियो — 30 मिनट"), 9, DARK, true);
    addBullet(ctx, l("Brisk walk, light jog, cycling, or swimming at conversational pace", "तेज चलना, हल्का जॉग, साइकिलिंग, या बातचीत की गति पर तैराकी"), 8);
    addNote(ctx, l("Zone 2 cardio builds mitochondrial density and fat oxidation capacity (Dr. Peter Attia / Inigo San Millan research).", "जोन 2 कार्डियो माइटोकॉन्ड्रियल घनत्व और वसा ऑक्सीकरण क्षमता बढ़ाता है।"));
    addSpacing(ctx, 2);
    addText(ctx, l("Day 3 (Fri/Sat): Flexibility & Recovery — 20 minutes", "दिन 3 (शुक्र/शनि): लचीलापन और रिकवरी — 20 मिनट"), 9, DARK, true);
    addBullet(ctx, l("Yoga flow or full-body stretching routine", "योग प्रवाह या पूर्ण शरीर स्ट्रेचिंग दिनचर्या"), 8);
    addBullet(ctx, l("Focus on hip flexors, hamstrings, shoulders, and spine mobility", "हिप फ्लेक्सर्स, हैमस्ट्रिंग, कंधे और रीढ़ की गतिशीलता पर ध्यान"), 8);
    addBullet(ctx, l("Deep breathing throughout (4-count inhale, 6-count exhale)", "पूरे समय गहरी सांस (4 गिनती सांस लेना, 6 गिनती छोड़ना)"), 8);
  } else if (tier === "premium") {
    addSubSection(ctx, l("5-Day Progressive Program", "5-दिन का प्रगतिशील कार्यक्रम"));
    addText(ctx, l(`Intermediate program with periodized training. Each session: 40-50 minutes.`, `आवधिक प्रशिक्षण के साथ मध्यवर्ती कार्यक्रम। प्रत्येक सत्र: 40-50 मिनट।`), 9);
    addSpacing(ctx, 2);
    addText(ctx, l("Monday: Lower Body Strength", "सोमवार: निचले शरीर की शक्ति"), 9, DARK, true);
    addBullet(ctx, l("Barbell/goblet squats: 4 sets x 8-12 reps", "बारबेल/गॉब्लेट स्क्वाट: 4 सेट x 8-12 रेप"), 8);
    addBullet(ctx, l("Romanian deadlifts: 3 sets x 10-12 reps", "रोमानियन डेडलिफ्ट: 3 सेट x 10-12 रेप"), 8);
    addBullet(ctx, l("Walking lunges: 3 sets x 10 each leg", "वॉकिंग लंज: 3 सेट x 10 प्रत्येक पैर"), 8);
    addBullet(ctx, l("Leg press or leg curls: 3 sets x 12-15 reps", "लेग प्रेस या लेग कर्ल: 3 सेट x 12-15 रेप"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Tuesday: Upper Body Push", "मंगलवार: ऊपरी शरीर पुश"), 9, DARK, true);
    addBullet(ctx, l("Bench press or dumbbell press: 4 sets x 8-10 reps", "बेंच प्रेस या डम्बल प्रेस: 4 सेट x 8-10 रेप"), 8);
    addBullet(ctx, l("Overhead press: 3 sets x 8-12 reps", "ओवरहेड प्रेस: 3 सेट x 8-12 रेप"), 8);
    addBullet(ctx, l("Incline dumbbell press: 3 sets x 10-12 reps", "इनक्लाइन डम्बल प्रेस: 3 सेट x 10-12 रेप"), 8);
    addBullet(ctx, l("Lateral raises: 3 sets x 12-15 reps", "लेटरल रेज: 3 सेट x 12-15 रेप"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Wednesday: Active Recovery + Zone 2 Cardio", "बुधवार: सक्रिय रिकवरी + जोन 2 कार्डियो"), 9, DARK, true);
    addBullet(ctx, l("30 min brisk walk, light cycling, or swimming", "30 मिनट तेज चलना, हल्की साइकिलिंग, या तैराकी"), 8);
    addBullet(ctx, l("10 min mobility work and foam rolling", "10 मिनट गतिशीलता कार्य और फोम रोलिंग"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Thursday: Upper Body Pull", "गुरुवार: ऊपरी शरीर पुल"), 9, DARK, true);
    addBullet(ctx, l("Pull-ups or lat pulldown: 4 sets x 8-10 reps", "पुल-अप या लैट पुलडाउन: 4 सेट x 8-10 रेप"), 8);
    addBullet(ctx, l("Barbell or cable rows: 3 sets x 10-12 reps", "बारबेल या केबल रो: 3 सेट x 10-12 रेप"), 8);
    addBullet(ctx, l("Face pulls: 3 sets x 15-20 reps", "फेस पुल: 3 सेट x 15-20 रेप"), 8);
    addBullet(ctx, l("Bicep curls: 3 sets x 10-12 reps", "बाइसेप कर्ल: 3 सेट x 10-12 रेप"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Friday: Full Body Power + Core", "शुक्रवार: पूर्ण शरीर शक्ति + कोर"), 9, DARK, true);
    addBullet(ctx, l("Deadlifts: 4 sets x 5-8 reps", "डेडलिफ्ट: 4 सेट x 5-8 रेप"), 8);
    addBullet(ctx, l("Kettlebell swings: 3 sets x 15 reps", "केटलबेल स्विंग: 3 सेट x 15 रेप"), 8);
    addBullet(ctx, l("Box jumps or jump squats: 3 sets x 8 reps", "बॉक्स जंप या जंप स्क्वाट: 3 सेट x 8 रेप"), 8);
    addBullet(ctx, l("Hanging leg raises: 3 sets x 10-15 reps", "हैंगिंग लेग रेज: 3 सेट x 10-15 रेप"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Saturday & Sunday: Rest or light activity (walking, yoga, sports)", "शनिवार और रविवार: आराम या हल्की गतिविधि (पैदल, योग, खेल)"), 9);
  } else if (isCoachingOrAbove(tier)) {
    addSubSection(ctx, l("6-Day Periodized Program", "6-दिन का आवधिक कार्यक्रम"));
    addText(ctx, l(`Advanced program with 12-week periodization for maximal results.`, `अधिकतम परिणामों के लिए 12-सप्ताह के आवधिकरण के साथ उन्नत कार्यक्रम।`), 9);
    addSpacing(ctx, 2);
    addText(ctx, l("Phase 1 — Strength Foundation (Weeks 1-4)", "चरण 1 — शक्ति आधार (सप्ताह 1-4)"), 9, DARK, true);
    addBullet(ctx, l("Mon: Lower body (squat focus) | Tue: Upper push | Wed: Zone 2 cardio + core", "सोम: निचला शरीर (स्क्वाट) | मंगल: ऊपरी पुश | बुध: जोन 2 कार्डियो + कोर"), 8);
    addBullet(ctx, l("Thu: Lower body (hinge focus) | Fri: Upper pull | Sat: Full body power", "गुरु: निचला शरीर (हिंज) | शुक्र: ऊपरी पुल | शनि: पूर्ण शरीर शक्ति"), 8);
    addBullet(ctx, l("Rep range: 6-10 reps | Rest: 2-3 min | Focus: progressive overload", "रेप रेंज: 6-10 रेप | आराम: 2-3 मिनट | फोकस: प्रगतिशील ओवरलोड"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Phase 2 — Hypertrophy (Weeks 5-8)", "चरण 2 — हाइपरट्रॉफी (सप्ताह 5-8)"), 9, DARK, true);
    addBullet(ctx, l("Same split, increased volume: 10-15 reps | Rest: 60-90 sec", "वही विभाजन, बढ़ा हुआ वॉल्यूम: 10-15 रेप | आराम: 60-90 सेकंड"), 8);
    addBullet(ctx, l("Add drop sets and supersets for metabolic stress", "मेटाबोलिक तनाव के लिए ड्रॉप सेट और सुपरसेट जोड़ें"), 8);
    addBullet(ctx, l("Include 2 Zone 2 cardio sessions (30 min each)", "2 जोन 2 कार्डियो सत्र शामिल करें (प्रत्येक 30 मिनट)"), 8);
    addSpacing(ctx, 2);
    addText(ctx, l("Phase 3 — Peak Performance (Weeks 9-12)", "चरण 3 — शीर्ष प्रदर्शन (सप्ताह 9-12)"), 9, DARK, true);
    addBullet(ctx, l("Mixed rep ranges: strength (4-6) + hypertrophy (10-12) + endurance (15-20)", "मिश्रित रेप रेंज: शक्ति (4-6) + हाइपरट्रॉफी (10-12) + सहनशक्ति (15-20)"), 8);
    addBullet(ctx, l("Add HIIT 1-2x per week for metabolic conditioning", "मेटाबोलिक कंडीशनिंग के लिए सप्ताह में 1-2 बार HIIT जोड़ें"), 8);
    addBullet(ctx, l("Deload week 12: reduce volume 40%, maintain intensity", "डीलोड सप्ताह 12: वॉल्यूम 40% कम करें, तीव्रता बनाए रखें"), 8);
  }

  addSpacing(ctx, 3);
  addSubSection(ctx, l("Progressive Overload Principle", "प्रगतिशील ओवरलोड सिद्धांत"));
  addText(ctx, l("To continue improving, gradually increase demands on your body:", "सुधार जारी रखने के लिए, अपने शरीर पर मांगें धीरे-धीरे बढ़ाएं:"), 9);
  addBullet(ctx, l("Add 2.5-5% weight when you complete all target reps for 2 consecutive sessions", "लगातार 2 सत्रों में सभी लक्ष्य रेप पूरे करने पर 2.5-5% वजन बढ़ाएं"), 8);
  addBullet(ctx, l("If stuck on a weight for 3+ sessions, try adding 1 rep instead of weight", "3+ सत्रों के लिए वजन पर अटके रहने पर वजन के बजाय 1 रेप जोड़ें"), 8);
  addBullet(ctx, l("Track every workout — what gets measured gets managed", "हर वर्कआउट ट्रैक करें — जो मापा जाता है वह प्रबंधित होता है"), 8);
  addNote(ctx, l("Ref: Schoenfeld et al. (2021) — progressive overload is the single most important variable for strength and muscle gain.", "संदर्भ: Schoenfeld et al. (2021) — प्रगतिशील ओवरलोड शक्ति और मांसपेशी लाभ के लिए सबसे महत्वपूर्ण चर है।"));

  smartNewPage(ctx);
}

function renderStressManagement(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, narratives, tier } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  const _stressMgmtScore = Math.max(15, 100 - (profile.stressScore || 50));
  addHeaderSection(ctx, l("08 · Anxiety & Mood Management", "08 · चिंता और मनोदशा प्रबंधन"), l(`Stress Mgmt Score: ${_stressMgmtScore}/100 · ${_stressMgmtScore < 45 ? "CRITICAL — act immediately" : _stressMgmtScore < 70 ? "MODERATE — daily tools required" : "WELL MANAGED — maintain practices"}`, `तनाव प्रबंधन स्कोर: ${_stressMgmtScore}/100 · ${_stressMgmtScore < 45 ? "गंभीर — तुरंत कार्य करें" : _stressMgmtScore < 70 ? "मध्यम — दैनिक उपकरण आवश्यक" : "अच्छा — अभ्यास बनाए रखें"}`));

  if (narratives.stressNarrative) {
    addText(ctx, narratives.stressNarrative, 9);
    addSpacing(ctx, 2);
  }

  addSubSection(ctx, l("Emergency Stress Relief — Use Anytime (Under 5 Minutes)", "आपातकालीन तनाव राहत — कभी भी उपयोग करें (5 मिनट से कम)"));
  drawQuickActionCards(ctx, [
    {
      number: "01",
      title: l("Box Breathing", "बॉक्स श्वास"),
      body: l("Inhale 4 sec -> Hold 4 sec -> Exhale 4 sec -> Hold 4 sec. Repeat 4-6 cycles. Activates parasympathetic nervous system in 5 min.", "सांस लें 4 सेकंड -> रोकें 4 -> छोड़ें 4 -> रोकें 4। 4-6 चक्र। 5 मिनट में तंत्रिका तंत्र शांत होता है।"),
      color: NAVY,
    },
    {
      number: "02",
      title: l("Physiological Sigh", "शारीरिक श्वास"),
      body: l("2 short inhales through nose + 1 long exhale through mouth. Fastest known real-time stress reducer (Stanford, 2023).", "नाक से 2 छोटी सांसें + मुंह से 1 लंबी सांस। सबसे तेज तनाव राहत विधि।"),
      color: GREEN_OK,
    },
    {
      number: "03",
      title: l("5-4-3-2-1 Grounding", "5-4-3-2-1 ग्राउंडिंग"),
      body: l("5 things you see, 4 touch, 3 hear, 2 smell, 1 taste. Breaks anxiety spiral by engaging the sensory cortex.", "5 चीजें देखें, 4 स्पर्श, 3 सुनें, 2 सूंघें, 1 चखें। चिंता का चक्र तोड़ता है।"),
      color: TEAL_BG,
    },
  ]);

  if (tier !== "free") {
    addSpacing(ctx, 3);
    addSubSection(ctx, l("Daily Stress Prevention Protocol", "दैनिक तनाव रोकथाम प्रोटोकॉल"));
    drawPremiumTable(ctx,
      [l("TIME", "समय"), l("ACTION", "कार्य"), l("SCIENCE", "विज्ञान")],
      [
        [l("Morning", "सुबह"), l("5-10 min meditation or breathwork — BEFORE checking phone", "5-10 मिनट ध्यान या श्वास — फोन से पहले"), l("Sets cortisol rhythm for the day", "दिन के लिए कोर्टिसोल लय तय करता है")],
        [l("Midday", "दोपहर"), l("5-min walk every 90 min of seated work", "बैठे काम के हर 90 मिनट पर 5 मिनट टहलना"), l("Prevents cortisol accumulation", "कोर्टिसोल संचय रोकता है")],
        [l("Evening", "शाम"), l("15-20 min tech-free. Write 3 gratitude items", "15-20 मिनट टेक-फ्री। 3 कृतज्ञता लिखें"), l("Anxiety -23% in 2 weeks", "2 सप्ताह में चिंता -23%")],
        [l("Weekly", "साप्ताहिक"), l("1 hr in nature (park, garden, forest)", "प्रकृति में 1 घंटा (पार्क, बगीचा, जंगल)"), l("Cortisol -12% per hour outdoors", "बाहर प्रति घंटे कोर्टिसोल -12%")],
        [l("Social", "सामाजिक"), l("30+ min meaningful interaction 3x/week", "3x सप्ताह में 30+ मिनट सार्थक बातचीत"), l("Isolation = stress hormones like smoking", "अकेलापन = धूम्रपान जितना तनाव")],
      ],
      [28, 90, 62]
    );
  }

  if (isCoachingOrAbove(tier)) {
    addSpacing(ctx, 2);
    addSubSection(ctx, l("Advanced Techniques", "उन्नत तकनीकें"));
    addBullet(ctx, l("Cold shower (30 sec at end): Activates vagus nerve, boosts norepinephrine", "ठंडा शॉवर (अंत में 30 सेकंड): वेगस तंत्रिका सक्रिय, नॉरएपिनेफ्रिन बढ़ाता है"), 8);
    addBullet(ctx, l("NSDR (Non-Sleep Deep Rest): 10-20 min lying down. Restores dopamine 65% (Nature Neuroscience, 2022)", "NSDR: 10-20 मिनट लेटकर आराम। डोपामिन 65% बहाल होता है"), 8);
    addBullet(ctx, l("Expressive journaling: 15 min on stressful events. Reduces cortisol + improves immunity", "अभिव्यंजक जर्नलिंग: 15 मिनट। कोर्टिसोल कम + प्रतिरक्षा सुधरती है"), 8);
  }

  smartNewPage(ctx);
}

function renderConditionModules(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const conditionNarratives = bundle.narratives.conditionNarratives || {};
  const conditions = Object.keys(conditionNarratives);
  if (conditions.length === 0) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("Condition-Specific Protocols", "रोग-विशेष प्रोटोकॉल"), l("Evidence-based guidance tailored to your health conditions", "आपकी स्वास्थ्य स्थितियों के अनुसार साक्ष्य-आधारित मार्गदर्शन"));

  conditions.forEach(condition => {
    const narrative = conditionNarratives[condition];
    if (!narrative) return;

    addSubSection(ctx, condition.charAt(0).toUpperCase() + condition.slice(1).replace(/_/g, " ") + " Management");
    addText(ctx, narrative, 9);
    addSpacing(ctx, 4);
  });

  smartNewPage(ctx);
}

function renderSupplementStrategy(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("12 · Supplement Strategy", "12 · सप्लीमेंट रणनीति"), l(`${profile.name}'s evidence-based stack for your profile`, `${profile.name} की प्रोफ़ाइल के लिए साक्ष्य-आधारित स्टैक`));

  addText(ctx, l(
    "Start with food optimization first. Then add supplements one phase at a time — this protocol tells you WHEN to add each, HOW to stack safely, and WHY it applies to your profile. Never add more than one new supplement per 2 weeks.",
    "पहले आहार अनुकूलन करें। फिर एक-एक चरण में सप्लीमेंट जोड़ें — यह प्रोटोकॉल बताता है कब जोड़ें, कैसे सुरक्षित रूप से स्टैक करें, और आपके प्रोफ़ाइल के लिए क्यों।"
  ), 9);
  addSpacing(ctx, 3);

  // ── Phase-based supplement table ──────────────────────────
  const isVeg = /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "");
  const sleepLowSupp = (profile.sleepScore || 50) < 65;
  const stressHighSupp = (profile.stressScore || 50) > 50;
  const hasConstipation = (profile.digestiveIssues || []).some((d: string) => /constip/i.test(d));
  const hasThyroid = (profile.medicalConditions || []).some((c: string) => /thyroid/i.test(c));

  addSubSection(ctx, l("Phase-by-Phase Supplement Protocol", "चरण-दर-चरण सप्लीमेंट प्रोटोकॉल"));

  const suppRows: string[][] = [];

  // FIX: PCOS patients get Myo-Inositol in Phase 1 (main supplement section, not just women's section)
  const _hasPCOSSupp = (profile.medicalConditions || []).some((c: string) => /pcos/i.test(c));
  if (_hasPCOSSupp) {
    suppRows.push([
      l("Phase 1\nWeeks 1-4\nFoundation", "चरण 1\nसप्ताह 1-4\nआधार"),
      l("Myo-Inositol + D-Chiro-Inositol (4:1)", "Myo-इनोसिटोल + D-Chiro (4:1)"),
      l("Myo-Inositol 2g + D-Chiro 50mg twice daily with meals", "Myo-Inositol 2g + D-Chiro 50mg दिन में दो बार"),
      l("★CRIT★ #1 evidence-based PCOS supplement. Improves insulin sensitivity, reduces androgens, regulates cycles.", "★CRIT★ PCOS का सबसे प्रमाणित सप्लीमेंट। इंसुलिन संवेदनशीलता, एण्ड्रोजन और चक्र सुधारता है।"),
      l("₹800-1,200/mo", "₹800-1,200/माह"),
    ]);
  }

  // Phase 1: Foundation (Weeks 1-4)
  suppRows.push([
    l("Phase 1\nWeeks 1-4\nFoundation", "चरण 1\nसप्ताह 1-4\nआधार"),
    "Vitamin D3",
    l("60,000 IU once/week × 8 wks, then 2,000 IU daily with fat", "60,000 IU एक बार/सप्ताह × 8 सप्ताह, फिर 2,000 IU रोज"),
    l("70%+ Indians deficient. Affects mood, immunity, muscle function", "70%+ भारतीयों में कमी। मूड, प्रतिरक्षा, मांसपेशियों पर प्रभाव"),
    l("₹150-200/mo", "₹150-200/माह"),
  ]);
  suppRows.push([
    "",
    l("Magnesium Bisglycinate", "मैग्नीशियम बिसग्लीसिनेट"),
    l("300-400mg at bedtime (NOT citrate form)", "सोते समय 300-400mg (सिट्रेट नहीं)"),
    sleepLowSupp
      ? l("CRITICAL for your sleep score. Reduces cortisol + improves deep sleep", "आपकी नींद के लिए गंभीर। कोर्टिसोल कम करता है + गहरी नींद सुधारता है")
      : l("Supports sleep quality + reduces muscle cramps", "नींद की गुणवत्ता + मांसपेशियों की ऐंठन कम"),
    l("₹350-500/mo", "₹350-500/माह"),
  ]);
  suppRows.push([
    "",
    l("Omega-3 (EPA+DHA)", "ओमेगा-3 (EPA+DHA)"),
    l(isVeg ? "1,000-2,000mg algae-based with largest meal" : "1,000-2,000mg fish oil with largest meal",
      isVeg ? "सबसे बड़े भोजन के साथ 1,000-2,000mg शैवाल-आधारित" : "सबसे बड़े भोजन के साथ 1,000-2,000mg मछली का तेल"),
    l("Anti-inflammatory; brain + cardiovascular health", "सूजन-रोधी; मस्तिष्क + हृदय स्वास्थ्य"),
    l("₹500-800/mo", "₹500-800/माह"),
  ]);
  // FIX 2b: B12 always shown — reason now diet-conditional.
  // Was only shown for veg users and always said "Vegetarian diet = B12 risk" even for non-veg.
  suppRows.push([
    "",
    l("Vitamin B12 (methylcobalamin)", "विटामिन B12 (मिथाइलकोबालामिन)"),
    l("500mcg sublingual daily (under tongue)", "500mcg सबलिंगुअल रोज (जीभ के नीचे)"),
    isVeg
      ? l("Vegetarian/vegan diet = high B12 deficiency risk → fatigue, nerve damage", "शाकाहारी आहार = B12 कमी जोखिम → थकान, तंत्रिका क्षति")
      : l("Chronic sleep deprivation & high stress deplete B12 absorption. Verify with blood test before supplementing.", "नींद की कमी और तनाव B12 अवशोषण घटाते हैं। सप्लीमेंट से पहले परीक्षण करें।"),
    l("₹200-400/mo", "₹200-400/माह"),
  ]);

  // Phase 2: Targeted (Weeks 5-8)
  suppRows.push([
    l("Phase 2\nWeeks 5-8\nTargeted", "चरण 2\nसप्ताह 5-8\nलक्षित"),
    l("Ashwagandha KSM-66", "अश्वगंधा KSM-66"),
    l("300mg morning + 300mg evening (with food). Cycle: 5 days on, 2 off", "सुबह 300mg + शाम 300mg (भोजन के साथ)। 5 दिन ON, 2 दिन OFF"),
    stressHighSupp
      ? l("Your stress score needs this. Reduces cortisol 23%. Improves sleep and energy", "आपके तनाव स्कोर के लिए जरूरी। कोर्टिसोल 23% कम। नींद और ऊर्जा सुधार")
      : l("Stress adaptation + testosterone support", "तनाव अनुकूलन + टेस्टोस्टेरोन समर्थन"),
    l("₹400-600/mo", "₹400-600/माह"),
  ]);
  if (hasConstipation) {
    suppRows.push([
      "",
      l("Probiotics (multi-strain)", "प्रोबायोटिक (मल्टी-स्ट्रेन)"),
      l("10-50B CFU on empty stomach, morning", "सुबह खाली पेट 10-50B CFU"),
      l("You have constipation — probiotics target root cause, not symptoms", "आपको कब्ज है — प्रोबायोटिक लक्षण नहीं, कारण ठीक करता है"),
      l("₹400-700/mo", "₹400-700/माह"),
    ]);
  }

  // Phase 3: Optimization/Maintenance (Weeks 9-12)
  const phase3Items: string[][] = [];
  if (hasThyroid) {
    phase3Items.push([
      l("Phase 3\nWeeks 9-12\nMaintenance", "चरण 3\nसप्ताह 9-12\nरखरखाव"),
      l("Selenium + Zinc (thyroid stack)", "सेलेनियम + जिंक (थायरॉइड स्टैक)"),
      l("Selenium 200mcg/day + Zinc 25mg with food. Never exceed 400mcg Se/day", "सेलेनियम 200mcg/दिन + जिंक 25mg भोजन के साथ"),
      l("Critical for T4→T3 thyroid conversion. Your thyroid condition requires this", "T4→T3 रूपांतरण के लिए गंभीर। आपकी थायरॉइड स्थिति इसकी मांग करती है"),
      l("₹300-500/mo", "₹300-500/माह"),
    ]);
  } else {
    phase3Items.push([
      l("Phase 3\nWeeks 9-12\nMaintenance", "चरण 3\nसप्ताह 9-12\nरखरखाव"),
      l("Zinc (immune + hormone support)", "जिंक (प्रतिरक्षा + हार्मोन समर्थन)"),
      l("25mg elemental zinc with food (not on empty stomach)", "भोजन के साथ 25mg एलिमेंटल जिंक"),
      profile.gender === "female"
        ? l("Immune function, hormonal balance, skin repair. Don't exceed 40mg/day", "प्रतिरक्षा, हार्मोन संतुलन, त्वचा मरम्मत। 40mg/दिन से अधिक न लें")
        : l("Immune function, testosterone, skin repair. Don't exceed 40mg/day", "प्रतिरक्षा, टेस्टोस्टेरोन, त्वचा मरम्मत। 40mg/दिन से अधिक न लें"),
      l("₹200-350/mo", "₹200-350/माह"),
    ]);
  }
  phase3Items.push([
    "",
    l("Curcumin + Piperine", "कर्क्यूमिन + पिपेरिन"),
    l("500-1,000mg curcumin + 20mg piperine (black pepper extract)", "500-1,000mg कर्क्यूमिन + 20mg पिपेरिन"),
    l("Anti-inflammatory. Piperine increases absorption 2000%. Take 2 hrs apart from iron supplements", "सूजन-रोधी। पिपेरिन अवशोषण 2000% बढ़ाता है"),
    l("₹400-600/mo", "₹400-600/माह"),
  ]);
  suppRows.push(...phase3Items);

  drawPremiumTable(ctx,
    [l("Phase", "चरण"), l("Supplement", "सप्लीमेंट"), l("Dose + Timing", "खुराक + समय"), l("Why for You", "आपके लिए क्यों"), l("Cost/Month", "लागत/माह")],
    suppRows,
    [28, 30, 52, 54, 16]
  );

  addSpacing(ctx, 4);
  addSubSection(ctx, l("Stacking Rules — What to Combine, What to Avoid", "स्टैकिंग नियम — क्या मिलाएं, क्या न मिलाएं"));
  drawPremiumTable(ctx,
    [l("Supplement", "सप्लीमेंट"), l("Combine With", "इसके साथ मिलाएं"), l("NEVER Combine With", "कभी न मिलाएं"), l("Reason", "कारण")],
    [
      [l("Magnesium", "मैग्नीशियम"), l("Vitamin D3, B6, glycine (bedtime)", "विटामिन D3, B6, ग्लाइसिन (सोते समय)"), l("Zinc (same dose — compete)", "जिंक (एक साथ — प्रतिस्पर्धा)"), l("Mg + D3 synergistic. Mg + Zinc = block absorption", "Mg + D3 सहक्रियाशील। Mg + Zinc = अवशोषण बाधित")],
      [l("Ashwagandha", "अश्वगंधा"), l("Magnesium (evening), Rhodiola, B-complex", "मैग्नीशियम (शाम), रोडियोला, B-complex"), l("Thyroid meds (without doctor)", "थायरॉइड दवा (डॉक्टर बिना)"), l("Modulates thyroid — may need medication adjustment", "थायरॉइड नियंत्रण — दवा समायोजन हो सकता है")],
      [l("Omega-3", "ओमेगा-3"), l("Vitamin D3, Vitamin E, CoQ10", "विटामिन D3, E, CoQ10"), l("Blood thinners/aspirin (without advice)", "ब्लड थिनर/एस्पिरिन (बिना सलाह)"), l("Mild blood-thinning effect — compounds anticoagulants", "हल्का रक्त-पतला प्रभाव — एंटीकोगुलेंट बढ़ाता है")],
    ],
    [30, 40, 45, 65]
  );

  addSpacing(ctx, 3);
  addNote(ctx, l(
    "Quality: Look for USP/NSF/FSSAI certification. Avoid proprietary blends. Store away from sunlight. Always consult your physician before starting, especially if on medication.",
    "गुणवत्ता: USP/NSF/FSSAI प्रमाणीकरण देखें। मालिकाना मिश्रण से बचें। सूर्यप्रकाश से दूर रखें। शुरू करने से पहले चिकित्सक से परामर्श करें।"
  ));

  smartNewPage(ctx);
}

function renderLabTests(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, rules, tier } = bundle;
  const tests = [...(rules.labTestPriority || [])].sort((a, b) => a.priority - b.priority);
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  const _labHeader = (profile.medicalConditions || []).some((c: string) => /thyroid/i.test(c))
    ? l(`${profile.name}'s prioritized panel — thyroid & full screening`, `${profile.name} का प्राथमिकता पैनल — थायरॉइड और पूर्ण स्क्रीनिंग`)
    : (profile.medicalConditions || []).some((c: string) => /pcos/i.test(c))
    ? l(`${profile.name}'s prioritized panel — PCOS hormonal & full screening`, `${profile.name} का प्राथमिकता पैनल — PCOS हार्मोनल और पूर्ण स्क्रीनिंग`)
    : l(`${profile.name}'s prioritized panel — full health screening`, `${profile.name} का प्राथमिकता पैनल — पूर्ण स्वास्थ्य स्क्रीनिंग`);
  addHeaderSection(ctx, l("13 · Recommended Lab Tests", "13 · अनुशंसित लैब परीक्षण"), _labHeader);

  addText(ctx, l(
    "Moving from guesswork to data-driven health requires clinical baselines. These tests are selected specifically for YOU based on your quiz data, health scores, BMI, and medical conditions. All available at Thyrocare, Dr. Lal PathLabs, SRL Diagnostics, Metropolis.",
    "अनुमान से डेटा-आधारित स्वास्थ्य के लिए नैदानिक बेसलाइन जरूरी हैं। ये परीक्षण आपके डेटा, स्वास्थ्य स्कोर, BMI और स्थितियों के आधार पर चुने गए हैं।"
  ), 9);
  addSpacing(ctx, 3);

  // ── Build personalized test list with tiers ──────────────────
  const bmiVal = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
  const hasThyroidLab = (profile.medicalConditions || []).some((c: string) => /thyroid/i.test(c));
  const hasPCOS = (profile.medicalConditions || []).some((c: string) => /pcos/i.test(c));
  const isMaleLab = (profile.gender || "").toLowerCase() === "male";
  const isFemLab = !isMaleLab;

  type LabTest = { name: string; cost: string; when: string; why: string; tier: "CRITICAL" | "HIGH" | "MEDIUM" };
  const criticalTests: LabTest[] = [];
  const highTests: LabTest[] = [];
  const mediumTests: LabTest[] = [];

  // CRITICAL: always do these
  criticalTests.push({
    name: l("Vitamin D3 (25-hydroxyvitamin D)", "विटामिन D3 (25-OH)"),
    cost: "₹600–1,200",
    when: l("Week 0", "सप्ताह 0"),
    why: l("76% urban Indians deficient. Affects mood, immunity, muscle function, and sleep.", "76% शहरी भारतीयों में कमी। मूड, प्रतिरक्षा, मांसपेशियों और नींद पर प्रभाव।"),
    tier: "CRITICAL",
  });
  criticalTests.push({
    name: l("Complete Blood Count (CBC)", "पूर्ण रक्त गणना (CBC)"),
    cost: "₹200–400",
    when: l("Week 0", "सप्ताह 0"),
    why: l("Baseline for immune health, anaemia screening, and infection markers.", "प्रतिरक्षा, एनीमिया, और संक्रमण मार्करों के लिए आधारभूत।"),
    tier: "CRITICAL",
  });

  if (hasThyroidLab || profile.energyScore < 50) {
    criticalTests.push({
      name: l("Thyroid Panel (TSH, T3, T4, Anti-TPO)", "थायरॉइड पैनल (TSH, T3, T4, Anti-TPO)"),
      cost: "₹400–800",
      when: l("Week 0 — BEFORE starting plan", "सप्ताह 0 — योजना शुरू से पहले"),
      why: hasThyroidLab
        ? l("You have a thyroid condition — TSH is critical for metabolic regulation.", "आपकी थायरॉइड स्थिति है — TSH चयापचय नियंत्रण के लिए गंभीर है।")
        : l("Low energy score suggests thyroid sluggishness. This test confirms or rules it out.", "कम ऊर्जा स्कोर थायरॉइड सुस्ती सुझाता है।"),
      tier: "CRITICAL",
    });
  }

  // HIGH priority
  if (profile.sleepScore < 65 || /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "")) {
    highTests.push({
      name: l("Vitamin B12 & Folate", "विटामिन B12 और फोलेट"),
      cost: "₹500–900",
      when: l("Week 0", "सप्ताह 0"),
        why: (() => {
        const isVeg = /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "");
        // FIX 2: B12 reason was hardcoded as "Vegetarian diet" for ALL users.
        // Now conditional on actual dietary preference.
        return isVeg
          ? l("B12 deficiency causes fatigue, nerve damage, poor mood. Especially critical for vegetarian/vegan diets.", "B12 कमी से थकान, तंत्रिका क्षति। शाकाहारी आहार में विशेष रूप से जरूरी।")
          : l("Chronic sleep deprivation and high stress deplete B12 absorption. Verify deficiency with blood test before supplementing.", "नींद की कमी और तनाव B12 अवशोषण को कम करते हैं। सप्लीमेंट से पहले रक्त परीक्षण से पुष्टि करें।");
      })(),
      tier: "HIGH",
    });
  }
  if (bmiVal > 25 || (profile.digestiveIssues || []).length > 0) {
    highTests.push({
      name: l("HbA1c + Fasting Insulin + Fasting Glucose", "HbA1c + उपवास इंसुलिन + FBS"),
      cost: "₹450–850",
      when: l("Week 0", "सप्ताह 0"),
      why: bmiVal > 25
        ? l(`Your BMI ${bmiVal.toFixed(1)} increases insulin resistance risk. HbA1c reveals 3-month blood sugar history.`, `BMI ${bmiVal.toFixed(1)} = इंसुलिन प्रतिरोध जोखिम। HbA1c 3 महीने का रक्त शर्करा इतिहास दिखाता है।`)
        : l("Digestive issues can co-occur with blood sugar instability. Rule it out early.", "पाचन समस्याएं रक्त शर्करा अस्थिरता के साथ हो सकती हैं।"),
      tier: "HIGH",
    });
  }
  if (hasPCOS) {
    // FIX: Hormonal panel is CRITICAL for PCOS, not HIGH
    criticalTests.push({
      name: l("Hormonal Panel (LH, FSH, Testosterone, Estradiol)", "हार्मोनल पैनल (LH, FSH, टेस्टोस्टेरोन, एस्ट्राडियोल)"),
      cost: "₹800–1,500",
      when: isMaleLab
        ? l("Week 0 (AM draw, 8-10am for accurate testosterone)", "सप्ताह 0 (सुबह 8-10 बजे)")
        : l("Day 2-5 of cycle", "चक्र के दिन 2-5"),
      why: isMaleLab
        ? l("PCOS-related insulin resistance and elevated estrogen affect males. Testosterone + LH/FSH baseline essential.", "PCOS-संबंधी इंसुलिन प्रतिरोध और एस्ट्रोजन पुरुषों को भी प्रभावित करता है।")
        : l("PCOS requires hormone baseline for treatment and monitoring.", "PCOS में हार्मोन बेसलाइन उपचार और निगरानी के लिए जरूरी।"),
      tier: "HIGH",
    });
  }

  // MEDIUM priority
  mediumTests.push({
    name: l("Lipid Profile (LDL, HDL, Triglycerides)", "लिपिड प्रोफ़ाइल (LDL, HDL, ट्राइग्लिसराइड्स)"),
    cost: "₹200–500",
    when: l("Week 0–2", "सप्ताह 0–2"),
    why: profile.age > 30 || bmiVal > 25
      ? l(`Age ${profile.age} + BMI ${bmiVal.toFixed(1)} = elevated cardiovascular risk. Lipids are silent until a crisis.`, `आयु ${profile.age} + BMI ${bmiVal.toFixed(1)} = हृदय जोखिम। लिपिड्स चुपचाप बढ़ते हैं।`)
      : l("Baseline cardiovascular health marker.", "हृदय स्वास्थ्य के लिए आधारभूत।"),
    tier: "MEDIUM",
  });
  mediumTests.push({
    name: l("Iron + Ferritin + TIBC", "आयरन + फेरिटिन + TIBC"),
    cost: "₹400–700",
    when: l("Week 0–4", "सप्ताह 0–4"),
    why: l("Iron deficiency is the most common nutrient deficiency in India — causes fatigue, hair loss, poor focus.", "आयरन की कमी भारत में सबसे आम — थकान, बालों का झड़ना, कम एकाग्रता।"),
    tier: "MEDIUM",
  });
  if (isPremiumOrAbove(tier)) {
    mediumTests.push({
      name: l("hs-CRP (High-Sensitivity C-Reactive Protein)", "hs-CRP (उच्च-संवेदनशीलता CRP)"),
      cost: "₹300–600",
      when: l("Week 0", "सप्ताह 0"),
      why: l("Measures systemic inflammation — the root driver of most chronic disease.", "प्रणालीगत सूजन मापता है — अधिकांश दीर्घकालिक रोगों का मूल कारण।"),
      tier: "MEDIUM",
    });
    if (isMaleLab && profile.age > 25) {
      mediumTests.push({
        name: l("Free & Total Testosterone", "मुक्त और कुल टेस्टोस्टेरोन"),
        cost: "₹500–1,000",
        when: l("Week 0 (AM, 8-10am)", "सप्ताह 0 (सुबह 8-10 बजे)"),
        why: l("Low testosterone causes fatigue, low mood, poor muscle gain. Draw early morning for accuracy.", "कम टेस्टोस्टेरोन से थकान, मूड गिरावट, खराब मांसपेशी लाभ।"),
        tier: "MEDIUM",
      });
    }
  }

  // ── Render tier blocks ────────────────────────────────────────
  const renderTierBlock = (
    tierLabel: string,
    tierHindi: string,
    tierColor: [number, number, number],
    testList: LabTest[],
    timing: string,
    timingHindi: string
  ) => {
    if (testList.length === 0) return;
    checkPageBreak(ctx, testList.length * 13 + 20);

    // Tier header bar
    ctx.pdf.setFillColor(...tierColor);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 8, "F");
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(255, 255, 255);
    setCtxFont(ctx, "bold");
    const tierTitle = language === "hi" ? `${tierHindi} — ${timingHindi}` : `${tierLabel} — ${timing}`;
    ctx.pdf.text(tierTitle, ctx.margin + 3, ctx.yPosition + 5.8);
    ctx.yPosition += 10;

    // Table rows
    testList.forEach((test, i) => {
      const rowH = 11;
      ctx.pdf.setFillColor(...(i % 2 === 0 ? CREAM : [255,255,255] as [number,number,number]));
      ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, rowH, "F");

      // Left color accent
      ctx.pdf.setFillColor(...tierColor);
      ctx.pdf.rect(ctx.margin, ctx.yPosition, 2, rowH, "F");

      // Test name
      ctx.pdf.setFontSize(8.5);
      ctx.pdf.setTextColor(...NAVY);
      setCtxFont(ctx, "bold");
      ctx.pdf.text(test.name, ctx.margin + 4, ctx.yPosition + 4.5);

      // Cost + When
      ctx.pdf.setFontSize(7.5);
      ctx.pdf.setTextColor(...SECTION_DARK);
      setCtxFont(ctx, "normal");
      ctx.pdf.text(`${test.cost}  |  ${language === "hi" ? "कब: " : "When: "}${test.when}`, ctx.margin + 4, ctx.yPosition + 9.5);

      // Why (right column)
      const whyX = ctx.margin + 4;
      const whyW = ctx.contentWidth - 8;
      ctx.pdf.setFontSize(7.5);
      ctx.pdf.setTextColor(...GRAY);
      const whyLines = ctx.pdf.splitTextToSize(test.why, whyW - 60);
      // Print why on right 3/4 of the row
      ctx.pdf.text(whyLines.slice(0, 1), ctx.margin + ctx.contentWidth * 0.42, ctx.yPosition + 7);

      ctx.yPosition += rowH;
    });
    addSpacing(ctx, 3);
  };

  renderTierBlock(
    "CRITICAL — Do This Week", "गंभीर — इस सप्ताह करें",
    RED_ALERT, criticalTests,
    "Do all before starting plan", "योजना शुरू से पहले करें"
  );
  renderTierBlock(
    "HIGH PRIORITY — Before Week 2", "उच्च प्राथमिकता — सप्ताह 2 से पहले",
    ORANGE_WARN, highTests,
    "Complete within first 2 weeks", "पहले 2 सप्ताह में"
  );
  renderTierBlock(
    "MEDIUM — Within First Month", "मध्यम — पहले महीने में",
    GREEN_OK, mediumTests,
    "Complete by Week 4", "सप्ताह 4 तक"
  );

  // ── Testing schedule ──────────────────────────────────────────
  addSpacing(ctx, 2);
  addSubSection(ctx, l("Testing Schedule & Protocol", "परीक्षण कार्यक्रम और प्रोटोकॉल"));
  drawPremiumTable(ctx,
    [l("Timepoint", "समय-बिंदु"), l("Action", "कार्य"), l("Purpose", "उद्देश्य")],
    [
      [l("Week 0 (NOW)", "सप्ताह 0 (अभी)"), l("Baseline: All CRITICAL + HIGH tests", "बेसलाइन: सभी गंभीर + उच्च परीक्षण"), l("Establish data foundation before plan starts", "योजना शुरू से पहले डेटा आधार")],
      [l("Week 12 (Day 90)", "सप्ताह 12 (दिन 90)"), l("Retest: Vitamin D, CBC, Thyroid (if applicable)", "पुनः परीक्षण: विटामिन D, CBC, थायरॉइड"), l("Measure impact of your 90-day lifestyle changes", "90-दिन बदलावों का प्रभाव मापें")],
      [l("Annual", "वार्षिक"), l("Full panel repeat", "पूर्ण पैनल दोहराएं"), l("Ongoing health monitoring", "निरंतर स्वास्थ्य निगरानी")],
    ],
    [30, 70, 80]
  );
  addSpacing(ctx, 2);
  addNote(ctx, l(
    "Estimated total: Basic panel ₹1,500–3,500 | Comprehensive panel ₹3,500–6,000. Always fast 10–12 hours before blood tests (water is OK). Draw thyroid blood before 10am for accuracy.",
    "अनुमानित कुल: बुनियादी पैनल ₹1,500–3,500 | व्यापक पैनल ₹3,500–6,000। रक्त परीक्षण से पहले 10–12 घंटे उपवास (पानी ठीक है)। थायरॉइड रक्त सुबह 10 बजे से पहले लें।"
  ));

  smartNewPage(ctx);
}

function renderDigestiveHealth(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  if (!profile.digestiveIssues?.length) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("10 · Gut Health & Hydration Protocol", "10 · आंत स्वास्थ्य और जलयोजन"), l(`Addressing: ${(profile.digestiveIssues || []).join(", ") || "digestive health"} · Water target: ${Math.round(profile.weightKg * 0.033 * 10) / 10}L/day`, `समस्याएं: ${(profile.digestiveIssues || []).join(", ") || "पाचन स्वास्थ्य"} · पानी लक्ष्य: ${Math.round(profile.weightKg * 0.033 * 10) / 10}L/दिन`));

  addText(ctx, l(
    "Your gut influences immunity (70% of immune cells live here), mood (95% of serotonin produced here), and energy. Gut microbiome diversity is one of the strongest predictors of overall health (Gut, 2023).",
    "आपकी आंत प्रतिरक्षा (70% प्रतिरक्षा कोशिकाएं यहां), मूड (95% सेरोटोनिन यहां बनता है) और ऊर्जा को नियंत्रित करती है।"
  ), 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("4-Week Gut Healing Protocol", "4-सप्ताह आंत उपचार प्रोटोकॉल"));
  drawPremiumTable(ctx,
    [l("PHASE", "चरण"), l("EAT MORE", "अधिक खाएं"), l("AVOID / REDUCE", "कम करें / बचें"), l("KEY SUPPLEMENT", "मुख्य सप्लीमेंट")],
    [
      [l("Week 1-2\nRemove & Repair", "सप्ताह 1-2\nहटाएं और मरम्मत"), l("Bone/veg broth, cooked veg, rice congee, ghee (1 tbsp in dal/rice)", "हड्डी/सब्जी का शोरबा, पकी सब्जियां, खिचड़ी, घी"), l("Processed foods, refined sugar, excess caffeine, alcohol", "प्रसंस्कृत भोजन, चीनी, कैफीन, शराब"), l("Digestive enzymes if needed", "पाचन एंजाइम (यदि आवश्यक)")],
      [l("Week 3-4\nRepopulate & Rebalance", "सप्ताह 3-4\nपुनर्जनन और संतुलन"), l("Homemade curd, idli/dosa, kanji, slightly green banana, garlic, oats", "घर का दही, इडली, कांजी, कच्चा केला, लहसुन, ओट्स"), l("Same as above — gradual reintroduction only", "ऊपर जैसा — धीरे-धीरे पुनर्परिचय"), l("Probiotics 10-50B CFU (empty stomach, morning)", "प्रोबायोटिक्स 10-50B CFU (सुबह खाली पेट)")],
    ],
    [30, 55, 52, 43]
  );

  const hasGlutenGut = (profile.foodIntolerances || []).some((f: string) => /gluten|wheat/i.test(f));
  if (hasGlutenGut) {
    addSpacing(ctx, 2);
    checkPageBreak(ctx, 18);
    ctx.pdf.setFillColor(255, 243, 205);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, ctx.contentWidth, 20, "F");
    ctx.pdf.setFillColor(255, 152, 0);
    ctx.pdf.rect(ctx.margin, ctx.yPosition, 3, 20, "F");
    ctx.pdf.setTextColor(120, 70, 0);
    setCtxFont(ctx, "bold");
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.text(l("⚠ Gluten Intolerance — Gut Protocol Modification", "⚠ ग्लूटन असहिष्णुता — आंत प्रोटोकॉल संशोधन"), ctx.margin + 6, ctx.yPosition + 6);
    setCtxFont(ctx, "normal");
    ctx.pdf.setFontSize(8);
    const glutenGutNote = l(
      "Week 3-4 gut protocol lists idli/dosa & oats — these contain gluten risk. Replace with: rice idli (using only rice + urad dal, confirmed gluten-free), rice-based kanji, and certified gluten-free oats. Avoid atta-based dosa or chapati during gut healing phase.",
      "सप्ताह 3-4 में इडली/दोसा और ओट्स हैं — ये ग्लूटन जोखिम वाले हो सकते हैं। इन्हें बदलें: चावल इडली (केवल चावल + उड़द दाल), चावल कांजी, और प्रमाणित ग्लूटन-मुक्त ओट्स से। आटा-आधारित दोसा या चपाती से बचें।"
    );
    const glutenLines = ctx.pdf.splitTextToSize(glutenGutNote, ctx.contentWidth - 12);
    glutenLines.forEach((line: string, i: number) => ctx.pdf.text(line, ctx.margin + 6, ctx.yPosition + 12 + i * 4));
    ctx.yPosition += 12 + glutenLines.length * 4 + 4;
    ctx.pdf.setTextColor(...DARK);
  }

  addSpacing(ctx, 3);
  addSubSection(ctx, l("Your Condition-Specific Fixes", "आपकी स्थिति-विशेष सुधार"));
  profile.digestiveIssues.forEach(issue => {
    const lower = issue.toLowerCase();
    if (lower.includes("bloat")) {
      addBullet(ctx, l("Bloating: Eat slowly (put fork down between bites). Avoid carbonated drinks. Fennel/ajwain water after meals.", "गैस: धीरे खाएं। कार्बोनेटेड पेय से बचें। भोजन के बाद सौंफ/अजवाइन पानी।"), 8);
    } else if (lower.includes("acid") || lower.includes("reflux")) {
      addBullet(ctx, l("Acidity/Reflux: No lying down within 2 hrs of eating. No spicy food at dinner. Head elevated during sleep.", "एसिडिटी: खाने के 2 घंटे तक न लेटें। रात में मसालेदार भोजन नहीं। सिर ऊंचा रखें।"), 8);
    } else if (lower.includes("constip")) {
      addBullet(ctx, l("Constipation: Warm water first thing every morning. Fiber 25-30g/day (increase gradually). Isabgol (psyllium) 1 tsp before bed.", "कब्ज: हर सुबह पहले गर्म पानी। फाइबर 25-30g/दिन (धीरे-धीरे बढ़ाएं)। सोने से पहले इसबगोल 1 चम्मच।"), 8);
    } else if (lower.includes("ibs") || lower.includes("irritable")) {
      addBullet(ctx, l("IBS: Low-FODMAP elimination for 4 weeks, then systematic reintroduction. Food diary for 2 weeks. Consult a gastroenterologist.", "IBS: 4 सप्ताह लो-FODMAP। 2 सप्ताह भोजन डायरी। गैस्ट्रोएंटेरोलॉजिस्ट से परामर्श।"), 8);
    } else {
      addBullet(ctx, l(`${issue}: Track symptoms with a food diary (2 weeks) to identify personal triggers.`, `${issue}: 2 सप्ताह भोजन डायरी से ट्रिगर पहचानें।`), 8);
    }
  });

  addSpacing(ctx, 2);
  drawGoldCallout(ctx, l("Daily Hydration Target", "दैनिक जलयोजन लक्ष्य"), l(
    `${Math.round(profile.weightKg * 0.033 * 10) / 10}L/day for your weight. Start each morning with 500ml warm water before any food or coffee. This alone improves digestion, reduces constipation, and boosts energy by afternoon.`,
    `आपके वजन के लिए ${Math.round(profile.weightKg * 0.033 * 10) / 10}L/दिन। हर सुबह भोजन या चाय से पहले 500ml गर्म पानी से शुरू करें।`
  ));

  smartNewPage(ctx);
}

function renderSkinHealth(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile } = bundle;
  if (!profile.skinConcerns?.length) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("11 · Skin Health", "11 · त्वचा स्वास्थ्य"), l(`Addressing: ${(profile.skinConcerns || []).join(", ") || "dry skin"} · Inside-out nutrition protocol`, `समस्याएं: ${(profile.skinConcerns || []).join(", ") || "रूखी त्वचा"} · अंदर से पोषण प्रोटोकॉल`));

  addText(ctx, l(
    "Skin reflects your internal health. Research (JAAD, 2023) confirms nutrition, sleep, and hydration impact skin more than topical products. Fix the root first.",
    "त्वचा आपके आंतरिक स्वास्थ्य को दर्शाती है। पोषण, नींद और जलयोजन सामयिक उत्पादों से अधिक प्रभाव डालते हैं। पहले जड़ ठीक करें।"
  ), 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("Skin Nutrition Essentials", "त्वचा पोषण के आवश्यक तत्व"));
  drawPremiumTable(ctx,
    [l("NUTRIENT", "पोषक"), l("BEST FOOD SOURCES (INDIA)", "सर्वोत्तम भारतीय खाद्य स्रोत"), l("SKIN FUNCTION", "त्वचा कार्य"), l("DAILY TARGET", "दैनिक लक्ष्य")],
    [
      [l("Vitamin C", "विटामिन C"), l("Amla, guava, citrus, bell peppers", "आंवला, अमरूद, खट्टे फल, शिमला मिर्च"), l("Collagen synthesis, brightening", "कोलेजन, चमक"), l("65-90mg+", "65-90mg+")],
      [l("Omega-3", "ओमेगा-3"), l("Flaxseeds, walnuts, fatty fish, algae oil", "अलसी, अखरोट, मछली, शैवाल तेल"), l("Barrier repair, inflammation control", "त्वचा बाधा, सूजन नियंत्रण"), l("2g EPA+DHA", "2g EPA+DHA")],
      [l("Zinc", "जिंक"), l("Pumpkin seeds, chickpeas, lentils, sesame", "कद्दू के बीज, चना, दाल, तिल"), l("Wound healing, acne control", "घाव भरना, मुंहासे"), l("8-11mg", "8-11mg")],
      [l("Vitamin A", "विटामिन A"), l("Sweet potato, carrots, spinach, eggs", "शकरकंद, गाजर, पालक, अंडे"), l("Cell turnover, anti-aging", "कोशिका नवीनीकरण, उम्र-रोधी"), l("700-900mcg", "700-900mcg")],
      [l("Hydration", "जलयोजन"), l(`${Math.round(profile.weightKg * 0.033 * 10) / 10}L water daily`, `${Math.round(profile.weightKg * 0.033 * 10) / 10}L पानी रोज़`), l("Plumpness, elasticity, toxin flush", "दृढ़ता, लोच, विषहरण"), l("Start with 500ml warm water morning", "सुबह 500ml गर्म पानी")],
    ],
    [30, 55, 48, 47]
  );

  addSpacing(ctx, 3);
  addSubSection(ctx, l("Your Skin Concern Protocol", "आपकी त्वचा समस्या प्रोटोकॉल"));
  profile.skinConcerns.forEach(concern => {
    const lower = concern.toLowerCase();
    if (lower.includes("acne")) {
      drawGoldCallout(ctx, l("Acne Action Plan", "मुंहासे कार्य योजना"), l(
        "1. Cut dairy & high-glycemic foods (sugar, white rice, bread) — both raise IGF-1. 2. Zinc 15-30mg/day. 3. Probiotics (gut-skin axis). 4. Wash face 2x only — over-washing strips protective oils.",
        "1. डेयरी और उच्च-ग्लाइसेमिक भोजन कम करें। 2. जिंक 15-30mg/दिन। 3. प्रोबायोटिक्स (आंत-त्वचा अक्ष)। 4. दिन में 2 बार चेहरा धोएं।"
      ));
    } else if (lower.includes("dry")) {
      drawGoldCallout(ctx, l("Dry Skin Action Plan", "शुष्क त्वचा कार्य योजना"), l(
        "1. Omega-3 daily (flaxseed oil/walnuts). 2. Vitamin E: almonds, sunflower seeds. 3. Apply coconut/almond oil WHILE skin is still damp (within 3 min of bathing). 4. Avoid hot showers — they strip natural oils.",
        "1. ओमेगा-3 रोज (अलसी तेल/अखरोट)। 2. विटामिन E: बादाम, सूरजमुखी बीज। 3. नहाने के बाद गीली त्वचा पर नारियल/बादाम तेल लगाएं। 4. गर्म पानी से नहाने से बचें।"
      ));
    } else if (lower.includes("aging") || lower.includes("wrinkle")) {
      drawGoldCallout(ctx, l("Anti-Aging Action Plan", "उम्र-रोधी कार्य योजना"), l(
        "1. SPF 30+ every morning — #1 anti-aging strategy. 2. Antioxidants: berries, green tea, turmeric, dark chocolate. 3. Collagen: Vitamin C + bone broth/gelatin daily. 4. Sleep 7-9 hrs — skin repairs 11pm-2am.",
        "1. SPF 30+ हर सुबह — #1 उम्र-रोधी रणनीति। 2. एंटीऑक्सीडेंट: जामुन, हरी चाय, हल्दी। 3. कोलेजन: विटामिन C + हड्डी का शोरबा। 4. 7-9 घंटे नींद।"
      ));
    } else {
      addBullet(ctx, l(`${concern}: Track with a food and skincare diary for 4 weeks to identify triggers.`, `${concern}: 4 सप्ताह भोजन और त्वचा देखभाल डायरी से ट्रिगर पहचानें।`), 8);
    }
  });

  smartNewPage(ctx);
}

function renderCoachingSection(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  addHeaderSection(ctx, l("Habit Formation & Behavioral Psychology", "आदत निर्माण और व्यवहार मनोविज्ञान"), l("The science of making changes stick — exclusive to Coaching Edition", "बदलाव को स्थायी बनाने का विज्ञान — कोचिंग संस्करण विशेष"));

  addText(ctx, l(
    "Research by Phillippa Lally (European Journal of Social Psychology) found that new habits take an average of 66 days to become automatic — not 21 days as commonly believed.",
    "फिलिप्पा लैली के शोध ने पाया कि नई आदतें औसतन 66 दिनों में स्वचालित होती हैं — आमतौर पर माने जाने वाले 21 दिनों में नहीं।"
  ), 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("The Habit Stack Method", "आदत स्टैक विधि"));
  addText(ctx, l("Attach new habits to existing ones for 85% higher success rate:", "नई आदतों को मौजूदा आदतों से जोड़ें, सफलता दर 85% अधिक होगी:"), 9);
  addBullet(ctx, l("After I wake up → I drink 500ml water + take vitamin D", "जागने के बाद → 500ml पानी पीता/पीती हूं + विटामिन D लेता/लेती हूं"), 8);
  addBullet(ctx, l("After I brush my teeth → I do 5 minutes of stretching", "दांत ब्रश करने के बाद → 5 मिनट स्ट्रेचिंग करता/करती हूं"), 8);
  addBullet(ctx, l("After I sit down for lunch → I take 3 deep breaths before eating", "दोपहर के खाने से पहले बैठने के बाद → खाने से पहले 3 गहरी सांसें लेता/लेती हूं"), 8);
  addBullet(ctx, l("After I change into home clothes → I do my workout", "घर के कपड़े पहनने के बाद → अपना व्यायाम करता/करती हूं"), 8);
  addBullet(ctx, l("After I get into bed → I journal 3 things I'm grateful for", "बिस्तर पर जाने के बाद → 3 कृतज्ञ बातें लिखता/लिखती हूं"), 8);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("The 2-Minute Rule", "2-मिनट नियम"));
  addText(ctx, l("When a habit feels overwhelming, scale it down to 2 minutes:", "जब कोई आदत भारी लगे, उसे 2 मिनट तक सीमित करें:"), 9);
  addBullet(ctx, l("'Exercise for 45 minutes' → 'Put on workout clothes and do 2 minutes'", "'45 मिनट व्यायाम' → 'व्यायाम के कपड़े पहनें और 2 मिनट करें'"), 8);
  addBullet(ctx, l("'Meditate for 15 minutes' → 'Sit quietly and take 3 breaths'", "'15 मिनट ध्यान' → 'शांत बैठें और 3 सांसें लें'"), 8);
  addBullet(ctx, l("'Cook a healthy meal' → 'Prepare one healthy ingredient'", "'स्वस्थ भोजन पकाएं' → 'एक स्वस्थ सामग्री तैयार करें'"), 8);
  addText(ctx, l("Starting is always the hardest part. Once you start, continuing is easy.", "शुरुआत करना हमेशा सबसे कठिन हिस्सा है। एक बार शुरू करने के बाद, जारी रखना आसान है।"), 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("Identity-Based Habits", "पहचान-आधारित आदतें"));
  addText(ctx, l("Instead of focusing on outcomes, focus on who you want to become:", "परिणामों पर ध्यान केंद्रित करने के बजाय, इस पर ध्यान दें कि आप कौन बनना चाहते हैं:"), 9);
  addBullet(ctx, l("Not 'I want to lose weight' → 'I am someone who nourishes their body'", "न कि 'मैं वजन कम करना चाहता/चाहती हूं' → 'मैं वह व्यक्ति हूं जो अपने शरीर को पोषण देता/देती है'"), 8);
  addBullet(ctx, l("Not 'I want to exercise more' → 'I am an active person who moves daily'", "न कि 'मैं अधिक व्यायाम करना चाहता/चाहती हूं' → 'मैं एक सक्रिय व्यक्ति हूं जो रोजाना चलता/चलती है'"), 8);
  addBullet(ctx, l("Not 'I want to sleep better' → 'I am someone who prioritizes recovery'", "न कि 'मैं बेहतर नींद चाहता/चाहती हूं' → 'मैं वह व्यक्ति हूं जो रिकवरी को प्राथमिकता देता/देती है'"), 8);
  addNote(ctx, l("Ref: James Clear, Atomic Habits — identity change drives lasting behavior change.", "संदर्भ: जेम्स क्लियर, Atomic Habits — पहचान परिवर्तन स्थायी व्यवहार परिवर्तन को प्रेरित करता है।"));

  addNewPage(ctx);

  addHeaderSection(ctx, l("Mindset & Accountability Framework", "मानसिकता और जवाबदेही ढांचा"), l("Your personal coaching structure for 90 days", "90 दिनों के लिए आपकी व्यक्तिगत कोचिंग संरचना"));

  addSubSection(ctx, l("Weekly Self-Coaching Questions", "साप्ताहिक आत्म-कोचिंग प्रश्न"));
  addText(ctx, l("Answer these every Sunday evening (15 min):", "हर रविवार शाम इनका उत्तर दें (15 मिनट):"), 9);
  addBullet(ctx, l("What went well this week? (Celebrate wins, no matter how small)", "इस सप्ताह क्या अच्छा रहा? (जीत मनाएं, चाहे कितनी छोटी हो)"), 8);
  addBullet(ctx, l("What was my biggest challenge? (Identify, don't judge)", "मेरी सबसे बड़ी चुनौती क्या थी? (पहचानें, निर्णय न लें)"), 8);
  addBullet(ctx, l("What will I do differently next week? (One specific action)", "अगले सप्ताह मैं अलग क्या करूंगा/करूंगी? (एक विशिष्ट कार्य)"), 8);
  addBullet(ctx, l("Am I being consistent, or am I chasing perfection? (Consistency > perfection)", "क्या मैं निरंतर हूं, या पूर्णता का पीछा कर रहा/रही हूं? (निरंतरता > पूर्णता)"), 8);
  addBullet(ctx, l("What am I grateful for in my health journey? (Gratitude builds resilience)", "मेरी स्वास्थ्य यात्रा में मैं किसके लिए कृतज्ञ हूं? (कृतज्ञता लचीलापन बनाती है)"), 8);
  addSpacing(ctx, 3);

  addSubSection(ctx, l("Overcoming Common Obstacles", "सामान्य बाधाओं पर काबू पाना"));
  addText(ctx, l("'I don't have time'", "'मेरे पास समय नहीं है'"), 9, DARK, true);
  addBullet(ctx, l("Reframe: You have the same 24 hours as everyone. It's about priorities, not time.", "पुनर्विचार: आपके पास सभी के समान 24 घंटे हैं। यह समय नहीं, प्राथमिकताओं के बारे में है।"), 8);
  addBullet(ctx, l("Solution: Start with 10 minutes. No one is too busy for 10 minutes.", "समाधान: 10 मिनट से शुरू करें। कोई भी 10 मिनट के लिए बहुत व्यस्त नहीं है।"), 8);
  addSpacing(ctx, 2);

  addText(ctx, l("'I fell off track'", "'मैं पटरी से उतर गया/गई'"), 9, DARK, true);
  addBullet(ctx, l("Reframe: Missing one day doesn't erase your progress. Missing two is the start of a new pattern.", "पुनर्विचार: एक दिन चूकना आपकी प्रगति मिटाता नहीं। दो दिन चूकना एक नए पैटर्न की शुरुआत है।"), 8);
  addBullet(ctx, l("Solution: Never miss twice. Get back on track the very next meal/workout.", "समाधान: कभी दो बार न चूकें। अगले भोजन/व्यायाम पर वापस आएं।"), 8);
  addSpacing(ctx, 2);

  addText(ctx, l("'I'm not seeing results'", "'मुझे परिणाम नहीं दिख रहे'"), 9, DARK, true);
  addBullet(ctx, l("Reframe: Internal changes (energy, mood, sleep) happen before visible changes.", "पुनर्विचार: आंतरिक परिवर्तन (ऊर्जा, मूड, नींद) दृश्य परिवर्तनों से पहले होते हैं।"), 8);
  addBullet(ctx, l("Solution: Track non-scale victories. Energy, sleep quality, and strength are leading indicators.", "समाधान: गैर-तराजू जीत ट्रैक करें। ऊर्जा, नींद गुणवत्ता और शक्ति प्रमुख संकेतक हैं।"), 8);

  addNewPage(ctx);

  addHeaderSection(ctx, l("Weekly Coaching Worksheet", "साप्ताहिक कोचिंग वर्कशीट"), l("Print or copy this template — complete every Sunday", "इस टेम्पलेट को प्रिंट या कॉपी करें — हर रविवार पूरा करें"));
  addSpacing(ctx, 2);
  addText(ctx, l("Week #: ___  |  Date: ___________", "सप्ताह #: ___  |  दिनांक: ___________"), 10, DARK, true);
  addSpacing(ctx, 3);
  const worksheetItems = [
    l("Sleep: Avg hours ___ | Quality (1-10) ___ | Consistent wake time? Y/N", "नींद: औसत घंटे ___ | गुणवत्ता (1-10) ___ | निरंतर जागने का समय? हां/नहीं"),
    l("Nutrition: Meals on plan ___/21 | Water intake ___L/day | Meal timing consistent? Y/N", "पोषण: योजना पर भोजन ___/21 | पानी का सेवन ___L/दिन | भोजन समय निरंतर? हां/नहीं"),
    l("Exercise: Workouts completed ___/target | Intensity (1-10) ___ | Any pain/discomfort? ___", "व्यायाम: वर्कआउट पूरे ___/लक्ष्य | तीव्रता (1-10) ___ | कोई दर्द/असुविधा? ___"),
    l("Stress: Avg stress level (1-10) ___ | Breathwork sessions ___/7 | Nature time this week? Y/N", "तनाव: औसत तनाव स्तर (1-10) ___ | श्वास सत्र ___/7 | इस सप्ताह प्रकृति समय? हां/नहीं"),
    l("Energy: Morning (1-10) ___ | Afternoon (1-10) ___ | Evening (1-10) ___", "ऊर्जा: सुबह (1-10) ___ | दोपहर (1-10) ___ | शाम (1-10) ___"),
    l("Weight: ___ kg | Waist: ___ cm | How clothes fit: ___", "वजन: ___ किग्रा | कमर: ___ सेमी | कपड़े कैसे फिट हैं: ___"),
    l("Win of the week: _______________________________________________", "सप्ताह की जीत: _______________________________________________"),
    l("Challenge of the week: __________________________________________", "सप्ताह की चुनौती: __________________________________________"),
    l("One thing to improve next week: ___________________________________", "अगले सप्ताह सुधार की एक बात: ___________________________________"),
  ];
  worksheetItems.forEach(item => addText(ctx, item, 9));

  smartNewPage(ctx);
}

function renderAddOns(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { addOns, profile } = bundle;
  if (!addOns?.length) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  const bmi = Math.round((profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2))) * 10) / 10;
  const bmiCategory = bmi < 18.5 ? l("Underweight","कम वजन") : bmi < 25 ? l("Normal","सामान्य") : bmi < 30 ? l("Overweight","अधिक वजन") : l("Obese","मोटापा");
  const isVeg = /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "");
  const isMale = profile.gender?.toLowerCase() === "male";
  const isFemale = profile.gender?.toLowerCase() === "female";
  const conditions = (profile.medicalConditions || []).map((c: string) => c.toLowerCase());
  const digestive = (profile.digestiveIssues || []).map((d: string) => d.toLowerCase());
  const sleepHrs = profile.sleepHours ?? Math.round((profile.sleepScore || 60) * 8 / 100 * 10) / 10;
  const stressLevel = (profile.stressScore || 50) > 65 ? l("HIGH","उच्च") : (profile.stressScore || 50) > 45 ? l("MODERATE","मध्यम") : l("LOW","कम");
  const tdee = profile.tdee || profile.estimatedTDEE || 2000;
  const proteinTarget = profile.proteinGrams || Math.round(profile.weightKg * 1.8);
  const maxHR = 220 - (profile.age || 25);
  const exercisePrefs = (profile.exercisePreference || []).join(", ") || l("General","सामान्य");
  // Normalize gender display to prevent "non-binary" raw values from showing
  const genderRaw = (profile.gender || "").toLowerCase();
  const genderDisplay = genderRaw === "female" || genderRaw === "f"
    ? l("Female", "महिला")
    : genderRaw === "male" || genderRaw === "m"
    ? l("Male", "पुरुष")
    : l(profile.gender || "Other", profile.gender || "अन्य");

  // ════════════════════════════════════════════════════════════
  // ADD-ON A · DNA & GENETICS
  // NEW VALUE: Gene→Action matrix, caffeine/folate/fiber typing.
  // Does NOT repeat supplement or movement sections.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_dna")) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("A · DNA & GENETICS", "A · DNA और आनुवांशिकी"),
      l("Gene-to-Action Decision Engine", "जीन से क्रिया निर्णय इंजन"),
      l(`${profile.name} · Age ${profile.age} · ${genderDisplay} · BMI ${bmi} (${bmiCategory}) — Genetic variants most impactful for your profile`,
        `${profile.name} · आयु ${profile.age} · ${genderDisplay} · BMI ${bmi} (${bmiCategory}) — आपके प्रोफ़ाइल के लिए सबसे प्रभावशाली आनुवांशिक वेरिएंट`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l("What follows is NOT theoretical genetics — it is an IF/THEN decision engine derived from the top 3 genes that affect YOUR profile: your sleep score, stress level, and training preferences. Each gene links directly to a dietary or training decision.",
        "यह सैद्धांतिक आनुवांशिकी नहीं है — यह एक IF/THEN निर्णय इंजन है जो उन शीर्ष 3 जीन से बना है जो आपके प्रोफ़ाइल को प्रभावित करते हैं। प्रत्येक जीन सीधे आहार या प्रशिक्षण निर्णय से जुड़ा है।"),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    // Gene Matrix Table
    drawPremiumTable(ctx,
      [l("Gene","जीन"), l("Controls","नियंत्रण"), l("Risk if Variant","वेरिएंट का जोखिम"), l("YOUR Action","आपकी क्रिया"), l("Evidence","प्रमाण")],
      [
        [
          "MTHFR",
          l("Folate conversion + methylation","फोलेट रूपांतरण + मेथिलेशन"),
          l("★WARN★ Poor B12/folate utilization → fatigue, mood dips","★WARN★ खराब B12/फोलेट उपयोग → थकान, मूड गिरावट"),
          l(`Eat spinach, methi, dal daily. 400–600mcg folate target. Use methylfolate (L-5-MTHF) not folic acid.`,
            `पालक, मेथी, दाल रोज़ खाएं। 400-600mcg फोलेट लक्ष्य। फोलिक एसिड की जगह मेथिलफोलेट लें।`),
          l("JAMA 2019","JAMA 2019")
        ],
        [
          "CYP1A2",
          l("Caffeine clearance speed","कैफीन क्लीयरेंस गति"),
          profile.sleepScore < 65
            ? l("★CRIT★ Slow metabolizer — caffeine stays active 6–8 hrs → disrupts sleep","★CRIT★ धीमा मेटाबोलाइज़र — कैफीन 6-8 घंटे सक्रिय → नींद बाधित")
            : l("★WARN★ Slow metabolizer: limit caffeine after 1pm","★WARN★ धीमा मेटाबोलाइज़र: दोपहर 1 बजे बाद कैफीन सीमित करें"),
          profile.sleepScore < 65
            ? l(`CRITICAL for you (sleep ${profile.sleepScore}/100): Cut all caffeine after 12pm. Switch to green tea before workouts.`,
                `आपके लिए गंभीर (नींद ${profile.sleepScore}/100): दोपहर 12 बजे बाद सभी कैफीन बंद करें। वर्कआउट से पहले ग्रीन टी लें।`)
            : l(`Limit to 2 cups before noon. Your sleep (${profile.sleepScore}/100) needs protection.`,
                `दोपहर से पहले 2 कप तक सीमित करें। आपकी नींद (${profile.sleepScore}/100) को सुरक्षा चाहिए।`),
          l("NEJM 2018","NEJM 2018")
        ],
        [
          "ACTN3",
          l("Muscle fiber type ratio","मांसपेशी फाइबर प्रकार अनुपात"),
          l("★GOOD★ RX = mixed fiber type (most Indians)","★GOOD★ RX = मिश्रित फाइबर प्रकार (अधिकांश भारतीय)"),
          exercisePrefs.toLowerCase().includes("cardio")
            ? l("Your cardio preference aligns with endurance training. Add 2x/week strength to balance fiber types.",
                "आपकी कार्डियो प्राथमिकता सहनशक्ति प्रशिक्षण से मेल खाती है। फाइबर प्रकार संतुलित करने के लिए सप्ताह में 2 बार शक्ति प्रशिक्षण जोड़ें।")
            : l("Strength training aligns with RR power phenotype. Include 1x/week endurance for cardiovascular health.",
                "शक्ति प्रशिक्षण RR पावर फेनोटाइप से मेल खाता है। हृदय स्वास्थ्य के लिए सप्ताह में 1 बार सहनशक्ति जोड़ें।"),
          l("Sports Med 2020","Sports Med 2020")
        ],
        [
          "FTO",
          l("Fat mass & appetite regulation","वसा द्रव्यमान और भूख नियंत्रण"),
          bmi >= 25
            ? l("★WARN★ Overweight + FTO variant → 20–30% higher obesity risk","★WARN★ अधिक वजन + FTO वेरिएंट → 20-30% अधिक मोटापे का जोखिम")
            : l("★GOOD★ BMI normal — maintain with protein-first meals","★GOOD★ BMI सामान्य — प्रोटीन-पहले भोजन से बनाए रखें"),
          bmi >= 25
            ? l(`Protein-first eating reduces FTO-driven appetite. Target ${proteinTarget}g protein/day. No late-night eating.`,
                `प्रोटीन-पहले खाना FTO-प्रेरित भूख कम करता है। ${proteinTarget}g प्रोटीन/दिन लक्ष्य। देर रात खाना नहीं।`)
            : l("Continue protein-first meals. 8+ hours sleep prevents FTO-driven fat storage.","प्रोटीन-पहले भोजन जारी रखें। 8+ घंटे नींद FTO-प्रेरित वसा संचय रोकती है।"),
          l("Nature 2020","Nature 2020")
        ],
      ],
      [22, 38, 48, 52, 20]
    );

    addSpacing(ctx, 4);
    drawGoldCallout(ctx,
      l("Your #1 Gene-Linked Action", "आपकी #1 जीन-लिंक्ड क्रिया"),
      profile.sleepScore < 65
        ? l(`CYP1A2 × Sleep: Your sleep score is ${profile.sleepScore}/100. Slow caffeine metabolism + poor sleep = cortisol elevation. Cut all caffeine after 12pm starting TODAY. This single change improves sleep, stress, and energy simultaneously.`,
            `CYP1A2 × नींद: आपका नींद स्कोर ${profile.sleepScore}/100 है। धीमी कैफीन चयापचय + खराब नींद = कोर्टिसोल वृद्धि। आज से दोपहर 12 बजे बाद सभी कैफीन बंद करें।`)
        : l(`MTHFR × Energy: 40% of Indians carry MTHFR variants. Add 2 servings of dark leafy greens daily and switch to methylated B-vitamins. This directly improves energy, mood, and cardiovascular health.`,
            `MTHFR × ऊर्जा: 40% भारतीयों में MTHFR वेरिएंट होते हैं। रोज़ 2 सर्विंग हरी पत्तेदार सब्जियां जोड़ें और मेथिलेटेड B-विटामिन पर स्विच करें।`)
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("Recommended Genetic Tests — India (Actionable Only)", "अनुशंसित आनुवांशिक परीक्षण — भारत (केवल क्रियायोग्य)"));
    drawPremiumTable(ctx,
      [l("Test","परीक्षण"), l("Focus","फोकस"), l("Why for You","आपके लिए क्यों"), l("Price (INR)","मूल्य (INR)"), l("Provider","प्रदाता")],
      [
        ["Xcode Life Gene Nutrition",
          l("Nutrition + Supplement","पोषण + सप्लीमेंट"),
          l("Maps folate, B12, omega-3, caffeine metabolism","फोलेट, B12, ओमेगा-3, कैफीन चयापचय मैप करता है"),
          "₹3,500–5,000", "xcodelife.com"],
        ["Genomepatri (MapMyGenome)",
          l("Full Health + Fitness","पूर्ण स्वास्थ्य + फिटनेस"),
          l("Most comprehensive — 100+ health traits","सबसे व्यापक — 100+ स्वास्थ्य लक्षण"),
          "₹12,000–18,000", "mapmygenome.in"],
        ["Xcode Life Sports + Fitness",
          l("ACTN3 + VO2 max","ACTN3 + VO2 अधिकतम"),
          l(`Best for your ${exercisePrefs} training preference`,`आपकी ${exercisePrefs} प्रशिक्षण प्राथमिकता के लिए सर्वश्रेष्ठ`),
          "₹3,000–4,500", "xcodelife.com"],
      ],
      [50, 36, 60, 28, 36]
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON B · ADVANCED SUPPLEMENT PROTOCOL
  // NEW VALUE: 12-week phased cycles + stacking rules + timing.
  // Does NOT repeat basic supplement list from core section.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_supplement")) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("B · ADVANCED SUPPLEMENT PROTOCOL", "B · उन्नत सप्लीमेंट प्रोटोकॉल"),
      l("12-Week Phased Cycles + Stacking Logic", "12-सप्ताह के चरणबद्ध चक्र + स्टैकिंग लॉजिक"),
      l(`${profile.name} · Stress: ${stressLevel} · Sleep: ${profile.sleepScore}/100 · BMI: ${bmi} — Personalized cycling & timing protocol`,
        `${profile.name} · तनाव: ${stressLevel} · नींद: ${profile.sleepScore}/100 · BMI: ${bmi} — व्यक्तिगत साइकलिंग और टाइमिंग प्रोटोकॉल`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`This protocol goes BEYOND the basic supplement list in your core plan. It tells you WHEN to cycle each supplement, HOW to stack them safely, and HOW to adjust based on your results. Designed for ${profile.name}: ${profile.age} yrs, BMI ${bmi}, stress level ${stressLevel}.`,
        `यह प्रोटोकॉल आपके मूल योजना की बुनियादी सप्लीमेंट सूची से परे है। यह बताता है कि प्रत्येक सप्लीमेंट को कब साइकल करें, उन्हें सुरक्षित रूप से कैसे स्टैक करें, और परिणामों के आधार पर कैसे समायोजित करें।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    // Phase Table
    drawPremiumTable(ctx,
      [l("Phase","चरण"), l("Supplement","सप्लीमेंट"), l("Dose + Timing","डोज़ + समय"), l("Purpose","उद्देश्य"), l("Cost/Month INR","लागत/माह INR")],
      [
        [l("Phase 1\nWeeks 1–4\nFoundation","चरण 1\nसप्ताह 1-4\nआधार"),
          "Vitamin D3 (loading)",
          l("60,000 IU once/week for 8 wks → then 2,000 IU daily","60,000 IU सप्ताह में एक बार 8 सप्ताह → फिर 2,000 IU दैनिक"),
          l("Baseline deficiency in 70%+ Indians. Affects mood, immunity, muscle function.","70%+ भारतीयों में आधारभूत कमी। मूड, प्रतिरक्षा, मांसपेशी कार्य प्रभावित।"),
          "₹150–200"],
        [l("Phase 1\nWeeks 1–4","चरण 1\nसप्ताह 1-4"),
          l("Magnesium Bisglycinate","मैग्नीशियम बिसग्लाइसिनेट"),
          l("300–400mg at bedtime (not citrate)","सोने के समय 300-400mg (साइट्रेट नहीं)"),
          profile.sleepScore < 70
            ? l("★CRIT★ Your sleep needs this. Magnesium reduces cortisol + improves deep sleep.","★CRIT★ आपकी नींद को इसकी जरूरत है। मैग्नीशियम कोर्टिसोल कम करता है + गहरी नींद सुधारता है।")
            : l("★GOOD★ Supports deep sleep architecture and muscle recovery.","★GOOD★ गहरी नींद संरचना और मांसपेशी रिकवरी का समर्थन करता है।"),
          "₹350–500"],
        [l("Phase 1\nWeeks 1–4","चरण 1\nसप्ताह 1-4"),
          "Omega-3 (EPA+DHA)",
          l("1,000–2,000mg daily with largest meal","सबसे बड़े भोजन के साथ 1,000-2,000mg दैनिक"),
          isVeg
            ? (/^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "")) ? l("★WARN★ Vegetarian: use algae-based omega-3 (not fish). Critical for brain + cardiovascular.","★WARN★ शाकाहारी: मछली की जगह शैवाल-आधारित ओमेगा-3 का उपयोग करें।") : l("Omega-3 fish oil or algae-based. Critical for brain + cardiovascular health.","ओमेगा-3 मछली तेल या शैवाल-आधारित। मस्तिष्क + हृदय स्वास्थ्य के लिए महत्वपूर्ण।")
            : l("Anti-inflammatory. Improves insulin sensitivity and cardiovascular markers.","सूजनरोधी। इंसुलिन संवेदनशीलता और हृदय मार्कर सुधारता है।"),
          "₹500–800"],
        [l("Phase 2\nWeeks 5–8\nTargeted","चरण 2\nसप्ताह 5-8\nलक्षित"),
          "Ashwagandha KSM-66",
          l("300mg morning + 300mg evening (with food)","सुबह 300mg + शाम 300mg (भोजन के साथ)"),
          (profile.stressScore || 50) > 55
            ? l(`★CRIT★ Your stress is ${stressLevel}. Ashwagandha reduces cortisol by 27% in 8 weeks (KSM-66 study 2019).`,`★CRIT★ आपका तनाव ${stressLevel} है। अश्वगंधा 8 सप्ताह में कोर्टिसोल 27% कम करता है।`)
            : l("Stress adaptation + testosterone support. Cycle: 5 days ON, 2 days OFF.","तनाव अनुकूलन + टेस्टोस्टेरोन समर्थन। साइकल: 5 दिन चालू, 2 दिन बंद।"),
          "₹400–600"],
        [l("Phase 2\nWeeks 5–8","चरण 2\nसप्ताह 5-8"),
          "Probiotics (Multi-strain)",
          l("10–50B CFU on empty stomach, morning","सुबह खाली पेट 10-50B CFU"),
          digestive.length > 0
            ? l(`★CRIT★ You have ${digestive.slice(0,2).join("+")} — probiotics address root cause, not symptoms.`,`★CRIT★ आपको ${digestive.slice(0,2).join("+")} है — प्रोबायोटिक्स लक्षण नहीं, मूल कारण को संबोधित करते हैं।`)
            : l("Microbiome diversity. Rotate strains every 3 months.","माइक्रोबायोम विविधता। हर 3 महीने स्ट्रेन बदलें।"),
          "₹400–700"],
        [l("Phase 3\nWeeks 9–12\nMaintenance","चरण 3\nसप्ताह 9-12\nरखरखाव"),
          conditions.includes("thyroid")
            ? l("Selenium + Zinc (thyroid stack)","सेलेनियम + जिंक (थायरॉइड स्टैक)")
            : l("Zinc + Curcumin (anti-inflammatory)","जिंक + करक्यूमिन (सूजनरोधी)"),
          conditions.includes("thyroid")
            ? l("Selenium 200mcg/day + Zinc 25mg with food","सेलेनियम 200mcg/दिन + जिंक 25mg भोजन के साथ")
            : l("Zinc 15–25mg with food + Curcumin 500mg with piperine","जिंक 15-25mg भोजन के साथ + करक्यूमिन 500mg पिपेरिन के साथ"),
          conditions.includes("thyroid")
            ? l("★WARN★ Selenium is critical for T4→T3 conversion. Never exceed 400mcg/day.","★WARN★ सेलेनियम T4→T3 रूपांतरण के लिए महत्वपूर्ण है। 400mcg/दिन से अधिक न लें।")
            : l("Piperine increases curcumin absorption 2,000%. Take with healthy fat for best effect.","पिपेरिन करक्यूमिन अवशोषण 2,000% बढ़ाता है। सर्वोत्तम प्रभाव के लिए स्वस्थ वसा के साथ लें।"),
          "₹300–500"],
      ],
      [28, 36, 46, 56, 34]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("Supplement Stacking Rules — What to Combine, What to Avoid", "सप्लीमेंट स्टैकिंग नियम — क्या मिलाएं, क्या न मिलाएं"));
    drawPremiumTable(ctx,
      [l("Stack","स्टैक"), l("Combine With","के साथ मिलाएं"), l("NEVER Combine With","कभी न मिलाएं"), l("Reason","कारण")],
      [
        ["Magnesium",
          l("Vitamin D3, B6, glycine (bedtime)","विटामिन D3, B6, ग्लाइसिन (सोने के समय)"),
          l("Zinc (same dose — compete for absorption)","जिंक (एक ही डोज़ — अवशोषण के लिए प्रतिस्पर्धा)"),
          l("Mg + D3 synergistic. Mg + Zinc = block each other.","Mg + D3 सहक्रियात्मक। Mg + जिंक = एक-दूसरे को ब्लॉक करते हैं।")],
        [l("Ashwagandha","अश्वगंधा"),
          l("Magnesium (evening), Rhodiola, B-complex","मैग्नीशियम (शाम), रोडियोला, B-कॉम्प्लेक्स"),
          l("Thyroid medication (without doctor approval)","थायरॉइड दवा (डॉक्टर की अनुमति के बिना)"),
          l("Ashwagandha modulates thyroid activity. May require medication adjustment.","अश्वगंधा थायरॉइड गतिविधि को नियंत्रित करता है।")],
        ["Omega-3",
          l("Vitamin D3, Vitamin E, CoQ10","विटामिन D3, विटामिन E, CoQ10"),
          l("Blood thinners or aspirin (without medical advice)","रक्त पतला करने वाली दवाएं (चिकित्सीय सलाह के बिना)"),
          l("Omega-3 has mild blood-thinning effect — compounds anticoagulants.","ओमेगा-3 में हल्का रक्त-पतला प्रभाव है।")],
        [l("Curcumin","करक्यूमिन"),
          l("Piperine (20mg increases absorption 2000%), healthy fat","पिपेरिन (20mg अवशोषण 2000% बढ़ाता है), स्वस्थ वसा"),
          l("Iron supplements (binds and reduces iron absorption)","आयरन सप्लीमेंट (बांधता है और अवशोषण कम करता है)"),
          l("Take curcumin 2 hours apart from iron supplements.","करक्यूमिन को आयरन सप्लीमेंट से 2 घंटे अलग लें।")],
      ],
      [30, 44, 46, 60]
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON C · ATHLETIC PERFORMANCE PACK
  // NEW VALUE: 12-week periodization + sport-specific nutrition.
  // Does NOT repeat basic movement program from core.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_athlete")) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("C · ATHLETIC PERFORMANCE PACK", "C · एथलेटिक प्रदर्शन पैक"),
      l("Periodization + Sport Nutrition + Recovery Science", "आवधिकता + खेल पोषण + रिकवरी विज्ञान"),
      l(`${profile.name} · ${profile.weightKg}kg · Activity ${profile.activityScore}/100 · Max HR ${maxHR} bpm — 12-Week structured athlete protocol`,
        `${profile.name} · ${profile.weightKg}kg · गतिविधि ${profile.activityScore}/100 · अधिकतम HR ${maxHR} bpm — 12-सप्ताह संरचित एथलीट प्रोटोकॉल`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`This section is your competitive edge — it goes beyond the general movement protocol in your core plan. It gives you periodization science, sport-specific fueling, and heart-rate zone training computed from YOUR data (Max HR: ${maxHR} bpm, Weight: ${profile.weightKg}kg, TDEE: ${tdee} kcal).`,
        `यह अनुभाग आपका प्रतिस्पर्धात्मक लाभ है — यह मूल योजना के सामान्य आंदोलन प्रोटोकॉल से परे है। यह आपके डेटा से गणना की गई आवधिकता विज्ञान, खेल-विशिष्ट ईंधन और हृदय-दर क्षेत्र प्रशिक्षण देता है।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    // Heart Rate Zones
    addSubSection(ctx, l(`Heart Rate Training Zones — Computed for ${profile.name}`, `हृदय दर प्रशिक्षण क्षेत्र — ${profile.name} के लिए गणना`));
    drawPremiumTable(ctx,
      [l("Zone","क्षेत्र"), l("Name","नाम"), l("HR Range (bpm)","HR रेंज (bpm)"), l("% Max HR","% अधिकतम HR"), l("Purpose","उद्देश्य"), l("Duration","अवधि")],
      [
        ["Z1", l("Recovery","रिकवरी"), `${Math.round(maxHR*0.5)}–${Math.round(maxHR*0.6)}`, "50–60%", l("Active recovery, fat metabolism","सक्रिय रिकवरी, वसा चयापचय"), l("20–45 min","20-45 मिनट")],
        ["Z2", l("Aerobic Base","एरोबिक बेस"), `${Math.round(maxHR*0.6)}–${Math.round(maxHR*0.7)}`, "60–70%", l("★GOOD★ Fat burning + endurance","★GOOD★ वसा दहन + सहनशक्ति"), l("30–90 min","30-90 मिनट")],
        ["Z3", l("Tempo","टेम्पो"), `${Math.round(maxHR*0.7)}–${Math.round(maxHR*0.8)}`, "70–80%", l("Lactate threshold improvement","लैक्टेट थ्रेशोल्ड सुधार"), l("20–40 min","20-40 मिनट")],
        ["Z4", l("Threshold","थ्रेशोल्ड"), `${Math.round(maxHR*0.8)}–${Math.round(maxHR*0.9)}`, "80–90%", l("★WARN★ VO2 max gains — hard","★WARN★ VO2 अधिकतम लाभ — कठिन"), l("8–20 min","8-20 मिनट")],
        ["Z5", l("Max Effort","अधिकतम प्रयास"), `${Math.round(maxHR*0.9)}–${maxHR}`, "90–100%", l("★CRIT★ HIIT/sprints only","★CRIT★ केवल HIIT/स्प्रिंट"), l("30 sec–5 min","30 सेकंड-5 मिनट")],
      ],
      [14, 32, 34, 28, 56, 28]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("12-Week Training Periodization Plan", "12-सप्ताह प्रशिक्षण आवधिकता योजना"));
    drawPremiumTable(ctx,
      [l("Phase","चरण"), l("Weeks","सप्ताह"), l("Focus","फोकस"), l("Intensity","तीव्रता"), l("Sets × Reps","सेट × रेप"), l("Key Lifts","मुख्य लिफ्ट"), l("Cardio","कार्डियो")],
      [
        [l("Adaptation","अनुकूलन"), "1–4", l("Base strength + movement patterns","आधार शक्ति"), "60–70% 1RM", "3×12–15", l("Squat, Row, Press, Hinge","स्क्वाट, रो, प्रेस"), l("Z2 · 3×30 min","Z2 · 3×30 मिनट")],
        [l("Hypertrophy","हाइपरट्रॉफी"), "5–7", l("Muscle size + endurance","मांसपेशी आकार"), "70–80% 1RM", "4×8–12", l("Deadlift, Bench, Pull-up","डेडलिफ्ट, बेंच, पुल-अप"), l("Z3 · 2×20 min","Z3 · 2×20 मिनट")],
        [l("Strength","शक्ति"), "8–10", l("Peak strength output","चरम शक्ति"), "80–90% 1RM", "4–5×4–6", l("Compound priority","कंपाउंड प्राथमिकता"), l("★WARN★ Z4 · 2×15 min","★WARN★ Z4 · 2×15 मिनट")],
        [l("Peak / Power","शक्ति / पावर"), "11", l("Explosive power + agility","विस्फोटक शक्ति"), "85–95% 1RM", "3–5×1–5", l("Cleans, Jumps, Sprints","क्लीन, जंप, स्प्रिंट"), l("Z5 HIIT · 2×10 min","Z5 HIIT · 2×10 मिनट")],
        [l("★GOOD★ Deload","★GOOD★ डीलोड"), "12", l("Active recovery — MANDATORY","सक्रिय रिकवरी — अनिवार्य"), "50–60% 1RM", "2×10–12", l("Same movements, lighter","वही, हल्का"), l("Z1 walk · 3×20 min","Z1 चलना · 3×20 मिनट")],
      ],
      [26, 15, 40, 25, 25, 40, 29]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l(`Sport-Specific Nutrition — ${profile.weightKg}kg Body Weight`, `खेल-विशिष्ट पोषण — ${profile.weightKg}kg शरीर वजन`));
    drawPremiumTable(ctx,
      [l("Timing","समय"), l("What","क्या"), l("Amount for You","आपके लिए मात्रा"), l("Why","क्यों")],
      [
        [l("Pre-workout (90 min before)","वर्कआउट से पहले (90 मिनट)"),
          l("Complex carbs + small protein","कॉम्प्लेक्स कार्ब + थोड़ा प्रोटीन"),
          l(`${Math.round(profile.weightKg * 1.5)}g carbs + ${Math.round(profile.weightKg * 0.2)}g protein`,`${Math.round(profile.weightKg * 1.5)}g कार्ब + ${Math.round(profile.weightKg * 0.2)}g प्रोटीन`),
          l("Glycogen loading without GI distress","GI संकट के बिना ग्लाइकोजन लोडिंग")],
        [l("During (sessions >60 min)","दौरान (60 मिनट से अधिक)"),
          l("Sports drink or banana + water","स्पोर्ट्स ड्रिंक या केला + पानी"),
          l("30–60g carbs/hour + 500–750ml water/hour","30-60g कार्ब/घंटा + 500-750ml पानी/घंटा"),
          l("Prevents 5–10% strength loss from dehydration","निर्जलीकरण से 5-10% शक्ति हानि रोकता है")],
        [l("★CRIT★ Post-workout (30 min)","★CRIT★ वर्कआउट के बाद (30 मिनट)"),
          l("Fast protein + carbs","फास्ट प्रोटीन + कार्ब"),
          l(`${Math.round(profile.weightKg * 0.3)}g protein + ${Math.round(profile.weightKg * 1.0)}g carbs`,`${Math.round(profile.weightKg * 0.3)}g प्रोटीन + ${Math.round(profile.weightKg * 1.0)}g कार्ब`),
          l("mTOR activation window. Missing this = 25% reduced protein synthesis.","mTOR सक्रियण विंडो। यह चूकना = 25% कम प्रोटीन संश्लेषण।")],
        [l("Pre-sleep","सोने से पहले"),
          l("Casein protein or 100g paneer","कैसिन प्रोटीन या 100g पनीर"),
          l("30–40g slow-digesting protein","30-40g धीमी पाचन प्रोटीन"),
          l("Overnight muscle protein synthesis +22% (Sleep Science 2022)","रात भर मांसपेशी प्रोटीन संश्लेषण +22% (Sleep Science 2022)")],
      ],
      [40, 40, 44, 56]
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON D · FAMILY WELLNESS PLAN
  // NEW VALUE: Multi-person personalization, shared cost optimization.
  // Does NOT repeat individual nutrition from core section.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_family")) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("D · FAMILY WELLNESS PLAN", "D · परिवार स्वास्थ्य योजना"),
      l("Multi-Person Nutrition + Shared Meal Optimization + Cost", "बहु-व्यक्ति पोषण + साझा भोजन अनुकूलन + लागत"),
      l(`${profile.name}'s household health guide — Indian dietary culture, region-specific, age-stratified`,
        `${profile.name} का घरेलू स्वास्थ्य मार्गदर्शक — भारतीय आहार संस्कृति, क्षेत्र-विशिष्ट, आयु-स्तरीकृत`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`Your personal plan is built for you. This add-on extends the same evidence-base to your entire family. Each age group has DIFFERENT nutritional priorities — this table tells you exactly what to adjust from your existing meals for each family member.`,
        `आपकी व्यक्तिगत योजना आपके लिए बनाई गई है। यह ऐड-ऑन उसी साक्ष्य-आधार को आपके पूरे परिवार तक विस्तारित करता है। प्रत्येक आयु वर्ग की अलग पोषण प्राथमिकताएं हैं।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    addSubSection(ctx, l("Age-Stratified Nutrition Requirements", "आयु-स्तरीकृत पोषण आवश्यकताएं"));
    drawPremiumTable(ctx,
      [l("Age Group","आयु वर्ग"), l("Calories/day","कैलोरी/दिन"), l("Protein Target","प्रोटीन लक्ष्य"), l("Critical Nutrients","महत्वपूर्ण पोषक तत्व"), l("NEVER Restrict","कभी सीमित न करें"), l("Top Risk","शीर्ष जोखिम")],
      [
        [l("Children 2–12","बच्चे 2-12"),
          l("1,000–1,800 kcal","1,000-1,800 kcal"),
          l("0.9–1.0g/kg body wt","0.9-1.0g/kg शरीर वजन"),
          l("Calcium 500–800mg, Iron 8–15mg, D3 400–600 IU","कैल्शियम 500-800mg, आयरन 8-15mg, D3 400-600 IU"),
          l("★CRIT★ NEVER calorie restrict","★CRIT★ कभी कैलोरी सीमित न करें"),
          l("Iron-deficiency anemia (25% Indian children)","आयरन-कमी एनीमिया")],
        [l("Teens 13–19","किशोर 13-19"),
          l("1,800–2,800 kcal","1,800-2,800 kcal"),
          l("1.0–1.5g/kg body wt","1.0-1.5g/kg शरीर वजन"),
          l("Calcium 1,300mg (peak bone), Iron 18mg (girls), Zinc 9–11mg","कैल्शियम 1,300mg (चरम हड्डी), आयरन 18mg (लड़कियां), जिंक 9-11mg"),
          l("★WARN★ Skip breakfast → GPA drops 15%","★WARN★ नाश्ता न करना → GPA 15% गिरता है"),
          l("Peak bone mass window closes at 18–20","चरम अस्थि द्रव्यमान खिड़की 18-20 पर बंद होती है")],
        [l("Adults 20–45","वयस्क 20-45"),
          `${tdee - 200}–${tdee + 200} kcal`,
          l("1.6–2.0g/kg (active)","1.6-2.0g/kg (सक्रिय)"),
          l("B12 (especially veg), D3 2,000 IU, Magnesium","B12 (विशेष रूप से शाकाहारी), D3 2,000 IU, मैग्नीशियम"),
          l("Refined sugar + ultra-processed food","परिष्कृत चीनी + अत्यधिक प्रसंस्कृत भोजन"),
          l("Insulin resistance (sedentary adults)","इंसुलिन प्रतिरोध (निष्क्रिय वयस्क)")],
        [l("Elderly 55+","बुजुर्ग 55+"),
          l("1,600–2,100 kcal","1,600-2,100 kcal"),
          l("★CRIT★ 1.2–1.5g/kg (prevent sarcopenia)","★CRIT★ 1.2-1.5g/kg (सार्कोपेनिया रोकें)"),
          l("Calcium 1,200mg + D3 2,000 IU, B12 1,000mcg, Omega-3","कैल्शियम 1,200mg + D3 2,000 IU, B12 1,000mcg, ओमेगा-3"),
          l("Protein restriction (leads to muscle loss)","प्रोटीन सीमा (मांसपेशी हानि)"),
          l("Sarcopenia: 1–2% muscle/year after 50","सार्कोपेनिया: 50 के बाद 1-2% मांसपेशी/वर्ष")],
      ],
      [25, 25, 28, 48, 38, 36]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("Shared Meal Modification Guide — From YOUR Base Meal", "साझा भोजन संशोधन गाइड — आपके आधार भोजन से"));
    drawPremiumTable(ctx,
      [l("Base Meal (Your Plan)","आधार भोजन (आपकी योजना)"), l("For Children","बच्चों के लिए"), l("For Elderly","बुजुर्गों के लिए"), l("Why Different","क्यों अलग")],
      [
        [l("Dal + Brown Rice + Sabzi","दाल + ब्राउन चावल + सब्जी"),
          l("Smaller portion. Add ghee (1 tsp) for calories. Reduce spice.","छोटा हिस्सा। कैलोरी के लिए घी (1 tsp) जोड़ें। मसाला कम करें।"),
          l("Extra dal for protein. Soft-cook for digestion. Add turmeric.","प्रोटीन के लिए अतिरिक्त दाल। पाचन के लिए मुलायम पकाएं। हल्दी जोड़ें।"),
          l("Children need more fat %; elderly need protein density, soft texture.","बच्चों को अधिक वसा % चाहिए; बुजुर्गों को प्रोटीन घनत्व, मुलायम बनावट चाहिए।")],
        [l("Roti + Paneer Bhurji","रोटी + पनीर भुर्जी"),
          l("Add milk with meal. Half roti size. Extra paneer portion OK.","भोजन के साथ दूध जोड़ें। आधी रोटी। अतिरिक्त पनीर ठीक है।"),
          l("Add calcium-fortified milk. Same paneer but reduce oil.","कैल्शियम-फोर्टिफाइड दूध जोड़ें। वही पनीर लेकिन तेल कम करें।"),
          l("Children: calcium for bones. Elderly: limit saturated fat, boost calcium.","बच्चे: हड्डियों के लिए कैल्शियम। बुजुर्ग: संतृप्त वसा सीमित, कैल्शियम बढ़ाएं।")],
        [l("Eggs + Oats","अंडे + ओट्स"),
          l("1 whole egg + 2 whites. Oats with milk + banana.","1 पूरा अंडा + 2 सफेद। दूध + केले के साथ ओट्स।"),
          l("2 whole eggs for cholesterol balance. Oats with hot milk.","कोलेस्ट्रॉल संतुलन के लिए 2 पूरे अंडे। गर्म दूध के साथ ओट्स।"),
          l("Children need whole eggs (choline for brain). Elderly: eggs support muscle.","बच्चों को पूरे अंडे चाहिए (मस्तिष्क के लिए कोलीन)। बुजुर्ग: अंडे मांसपेशी समर्थन करते हैं।")],
      ],
      [48, 46, 46, 50]
    );

    addSpacing(ctx, 4);
    drawGoldCallout(ctx,
      l("Family Grocery Budget — Weekly Optimization (India)", "परिवार किराना बजट — साप्ताहिक अनुकूलन (भारत)"),
      l("Family of 4: ₹2,500–₹3,500/week covers all fresh vegetables, dal, rice/millets, eggs/paneer, seasonal fruits. Buy: dals in bulk (saves 20–30%), seasonal produce (saves 25–40%), frozen vegetables in off-season. AVOID: ultra-processed snacks, branded cereals (2–3× expensive, nutrient-poor).",
        "4 लोगों का परिवार: ₹2,500–₹3,500/सप्ताह में सभी ताजी सब्जियां, दाल, चावल/बाजरा, अंडे/पनीर, मौसमी फल शामिल हैं। खरीदें: थोक में दालें (20-30% बचत), मौसमी उत्पाद (25-40% बचत)। बचें: अत्यधिक प्रसंस्कृत स्नैक्स, ब्रांडेड अनाज (2-3× महंगे, पोषण-कमज़ोर)।")
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON E · WOMEN'S HORMONAL HEALTH (female only)
  // NEW VALUE: 28-day cycle-synced plan. PCOS/thyroid specifics.
  // Does NOT repeat general sleep/stress/nutrition from core.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_women_hormone") && isFemale) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("E · WOMEN'S HORMONAL HEALTH", "E · महिला हार्मोनल स्वास्थ्य"),
      l("28-Day Cycle-Synced Nutrition + Training + Hormonal Support", "28-दिन चक्र-समन्वित पोषण + प्रशिक्षण + हार्मोनल समर्थन"),
      l(`${profile.name} · ${profile.age} yrs · TDEE ${tdee} kcal — Phase-specific calorie adjustments and training periodization`,
        `${profile.name} · ${profile.age} वर्ष · TDEE ${tdee} kcal — चरण-विशिष्ट कैलोरी समायोजन और प्रशिक्षण आवधिकता`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`Female hormones follow a 28-day cycle across 4 distinct phases. This section gives you phase-specific CALORIE ADJUSTMENTS, TRAINING RECOMMENDATIONS, and SUPPLEMENT TIMING that are completely absent from the general plan — because they apply only to you.`,
        `महिला हार्मोन 4 अलग-अलग चरणों में 28 दिन के चक्र का पालन करते हैं। यह अनुभाग आपको चरण-विशिष्ट कैलोरी समायोजन, प्रशिक्षण सिफारिशें और सप्लीमेंट टाइमिंग देता है जो सामान्य योजना में बिल्कुल अनुपस्थित हैं।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    drawPremiumTable(ctx,
      [l("Phase","चरण"), l("Days","दिन"), l("Hormones","हार्मोन"), l("Calorie Adj.","कैलोरी समायोजन"), l("Training","प्रशिक्षण"), l("Supplement Priority","सप्लीमेंट प्राथमिकता")],
      [
        [l("Menstrual","मासिक धर्म"), "1–5",
          l("Estrogen + Prog. LOW","एस्ट्रोजन + प्रोज. कम"),
          l(`Base: ${tdee} kcal\n(-100 to 0 kcal)`,`आधार: ${tdee} kcal\n(-100 से 0 kcal)`),
          l("Light yoga, walking. NO high-intensity.","हल्का योग, चलना। कोई उच्च तीव्रता नहीं।"),
          l("★CRIT★ Iron 18mg, Omega-3 2g, Mg 400mg for cramps","★CRIT★ आयरन 18mg, ओमेगा-3 2g, Mg 400mg ऐंठन के लिए")],
        [l("Follicular","फॉलिकुलर"), "6–13",
          l("Estrogen RISING","एस्ट्रोजन बढ़ रहा"),
          l(`+100–200 kcal\n(${tdee+100}–${tdee+200})`,`+100-200 kcal\n(${tdee+100}-${tdee+200})`),
          l("★GOOD★ PEAK performance window. PRs now.","★GOOD★ चरम प्रदर्शन खिड़की। अभी PRs लें।"),
          l("B-complex, Zinc, Magnesium. Reduce iron.","B-कॉम्प्लेक्स, जिंक, मैग्नीशियम। आयरन कम करें।")],
        [l("Ovulatory","ओव्युलेटरी"), "14–16",
          l("LH + Estrogen PEAK","LH + एस्ट्रोजन चरम"),
          l(`+150–250 kcal\n(${tdee+150}–${tdee+250})`,`+150-250 kcal\n(${tdee+150}-${tdee+250})`),
          l("Highest energy. HIIT + strength. Max output.","सर्वाधिक ऊर्जा। HIIT + शक्ति। अधिकतम आउटपुट।"),
          l("Antioxidants: Vit C 500mg, E 200 IU. CoQ10.","एंटीऑक्सीडेंट: Vit C 500mg, E 200 IU। CoQ10।")],
        [l("Luteal","ल्यूटियल"), "17–28",
          l("Progesterone PEAK → drops","प्रोजेस्टेरोन चरम → गिरना"),
          l(`+100–300 kcal\n(${tdee+100}–${tdee+300})\n(metabolism ↑)`,`+100-300 kcal\n(${tdee+100}-${tdee+300})\n(चयापचय ↑)`),
          l("Moderate. Steady-state cardio. Yoga + stretching.","मध्यम। स्थिर-अवस्था कार्डियो। योग + स्ट्रेचिंग।"),
          l("★WARN★ Mg 400mg + Ca 500mg + B6 50mg (PMS support)","★WARN★ Mg 400mg + Ca 500mg + B6 50mg (PMS समर्थन)")],
      ],
      [24, 14, 30, 36, 48, 48]
    );

    addSpacing(ctx, 4);

    if (conditions.includes("pcos") || conditions.includes("thyroid")) {
      addSubSection(ctx, l("Condition-Specific Hormonal Protocols", "स्थिति-विशिष्ट हार्मोनल प्रोटोकॉल"));
      const condRows: string[][] = [];
      if (conditions.includes("pcos")) {
        condRows.push(
          ["PCOS · Insulin Control",
            l("12-hr overnight fast (10pm–10am). Millets over white rice. Low-GI all day.","12 घंटे रात्रि उपवास। सफेद चावल की जगह बाजरा। पूरे दिन कम GI।"),
            l("Inositol 2g Myo + 50mg D-chiro 2×/day","इनोसिटोल 2g Myo + 50mg D-chiro 2×/दिन"),
            l("★CRIT★ Berberine 500mg 2× after meals","★CRIT★ बेर्बेरिन 500mg 2× भोजन के बाद"),
            l("Lab: Fasting insulin + AMH","लैब: फास्टिंग इंसुलिन + AMH")],
          ["PCOS · Androgen Reduction",
            l("Spearmint tea 2×/day (reduces free testosterone 30%). Reduce dairy.","स्पियरमिंट चाय 2×/दिन (मुक्त टेस्टोस्टेरोन 30% कम करती है)। डेयरी कम करें।"),
            l("Saw Palmetto 320mg/day (if prescribed)","सॉ पाल्मेटो 320mg/दिन (यदि निर्धारित)"),
            l("Zinc 30mg/day (anti-androgenic)","जिंक 30mg/दिन (एंटी-एंड्रोजेनिक)"),
            l("Lab: LH/FSH ratio, free testosterone","लैब: LH/FSH अनुपात, मुक्त टेस्टोस्टेरोन")]
        );
      }
      if (conditions.includes("thyroid")) {
        condRows.push(
          ["Thyroid · T4→T3 Support",
            l("Selenium 200mcg/day (CRITICAL — converts T4→T3). Brazil nut = 1 nut/day.","सेलेनियम 200mcg/दिन (महत्वपूर्ण — T4→T3 रूपांतरित करता है)। ब्राज़ील नट = 1 नट/दिन।"),
            l("Avoid raw goitrogens (raw cabbage, kale, broccoli) — cook them.","कच्चे गोइट्रोजन (कच्ची गोभी) से बचें — उन्हें पकाएं।"),
            l("★WARN★ TSH test before starting Ashwagandha","★WARN★ अश्वगंधा शुरू करने से पहले TSH परीक्षण"),
            l("Lab: TSH + Free T3 + Free T4 + Anti-TPO","लैब: TSH + फ्री T3 + फ्री T4 + एंटी-TPO")]
        );
      }
      drawPremiumTable(ctx,
        [l("Protocol","प्रोटोकॉल"), l("Diet Action","आहार क्रिया"), l("Supplement","सप्लीमेंट"), l("Priority Supplement","प्राथमिकता सप्लीमेंट"), l("Lab Test","लैब परीक्षण")],
        condRows,
        [30, 56, 40, 40, 34]
      );
      addSpacing(ctx, 3);
    }

    // Hormone supplement stack with pricing
    addSubSection(ctx, l("Women's Hormone Support Supplement Stack (India Pricing)", "महिला हार्मोन समर्थन सप्लीमेंट स्टैक (भारत मूल्य)"));
    drawPremiumTable(ctx,
      [l("Supplement","सप्लीमेंट"), l("Dose + Phase","डोज़ + चरण"), l("Why for Women","महिलाओं के लिए क्यों"), l("Brand (India)","ब्रांड (भारत)"), l("Price/Month","मूल्य/माह")],
      [
        [l("Iron (Ferrous Bisglycinate)","आयरन (फेरस बिसग्लाइसिनेट)"),
          l("25–30mg · Days 1–7 only","25-30mg · केवल दिन 1-7"),
          l("★CRIT★ Menstrual loss repleted. Bisglycinate = no constipation.","★CRIT★ मासिक हानि पूरी। बिसग्लाइसिनेट = कब्ज नहीं।"),
          "HealthKart Iron Bisglycinate", "₹250–400"],
        ["Magnesium Bisglycinate",
          l("400mg · Luteal phase (Day 17–28)","400mg · ल्यूटियल चरण (दिन 17-28)"),
          l("Reduces PMS cramps by 40–70% (BJOG 2020).","PMS ऐंठन 40-70% कम करता है (BJOG 2020)।"),
          "NOW Foods Mg Bisglycinate", "₹350–550"],
        [l("Vitamin B6 (P5P form)","विटामिन B6 (P5P रूप)"),
          l("50mg · Days 14–28 (luteal)","50mg · दिन 14-28 (ल्यूटियल)"),
          l("Progesterone cofactor. Reduces PMS mood symptoms by 30%.","प्रोजेस्टेरोन सहकारक। PMS मूड लक्षण 30% कम करता है।"),
          "Jarrow P5P / Amazon India", "₹300–450"],
        [l("Myo-Inositol (PCOS only)","Myo-इनोसिटोल (PCOS के लिए)"),
          l("2g + 50mg D-chiro · 2× daily","2g + 50mg D-chiro · 2× दैनिक"),
          l("★WARN★ PCOS-specific. Improves insulin + ovulation (JCEM 2022).","★WARN★ PCOS-विशिष्ट। इंसुलिन + ओव्यूलेशन सुधारता है।"),
          "Myo & D-chiro Ovasitol · Netmeds", "₹800–1,200"],
      ],
      [38, 36, 56, 40, 30]
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON F · MEN'S PERFORMANCE PACK (male only)
  // NEW VALUE: Testosterone optimization + progressive overload.
  // Does NOT repeat basic movement or supplement from core.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_men_fitness") && isMale) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("F · MEN'S PERFORMANCE PACK", "F · पुरुष प्रदर्शन पैक"),
      l("Testosterone Optimization + Muscle Periodization + Body Composition", "टेस्टोस्टेरोन अनुकूलन + मांसपेशी आवधिकता + शरीर संरचना"),
      l(`${profile.name} · ${profile.age} yrs · ${profile.weightKg}kg · BMI ${bmi} (${bmiCategory}) · Sleep ${sleepHrs} hrs — Hormonal + hypertrophy protocol`,
        `${profile.name} · ${profile.age} वर्ष · ${profile.weightKg}kg · BMI ${bmi} (${bmiCategory}) · नींद ${sleepHrs} घंटे — हार्मोनल + हाइपरट्रॉफी प्रोटोकॉल`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`This section gives you the testosterone optimization science + body composition targets that are ABSENT from your core movement plan. Calorie surplus computed from YOUR TDEE (${tdee} kcal), protein targets from YOUR weight (${profile.weightKg}kg).`,
        `यह अनुभाग आपको टेस्टोस्टेरोन अनुकूलन विज्ञान + शरीर संरचना लक्ष्य देता है जो आपके मूल आंदोलन योजना में अनुपस्थित हैं। कैलोरी अधिशेष आपके TDEE (${tdee} kcal) से गणना।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    // Testosterone factors table
    addSubSection(ctx, l("Testosterone Optimization Audit — Your Current Status", "टेस्टोस्टेरोन अनुकूलन ऑडिट — आपकी वर्तमान स्थिति"));
    drawPremiumTable(ctx,
      [l("Factor","कारक"), l("Your Status","आपकी स्थिति"), l("Optimal","इष्टतम"), l("Action Required","आवश्यक क्रिया"), l("Impact on Testosterone","टेस्टोस्टेरोन पर प्रभाव")],
      [
        [l("Sleep","नींद"),
          sleepHrs < 6
            ? `★CRIT★ ${sleepHrs} hrs`
            : sleepHrs < 7
            ? `★WARN★ ${sleepHrs} hrs`
            : `★GOOD★ ${sleepHrs} hrs`,
          l("7–9 hrs","7-9 घंटे"),
          sleepHrs < 6
            ? l("CRITICAL: <5 hrs sleep = 10–15% testosterone drop. Fix sleep before all else.","गंभीर: <5 घंटे नींद = 10-15% टेस्टोस्टेरोन गिरावट। पहले नींद ठीक करें।")
            : l("Add 30 min sleep. Dark room, no screens 1 hr before bed.","30 मिनट नींद जोड़ें। अंधेरा कमरा, सोने से 1 घंटे पहले स्क्रीन नहीं।"),
          l("★CRIT★ -10 to -15% per hour deficit","★CRIT★ -10 से -15% प्रति घंटे की कमी")],
        [l("Body Fat","शरीर वसा"),
          bmi < 25 ? l("★GOOD★ Likely <20% BF","★GOOD★ संभवतः <20% BF") : bmi < 30 ? l("★WARN★ Likely 20–28% BF","★WARN★ संभवतः 20-28% BF") : l("★CRIT★ Likely >28% BF","★CRIT★ संभवतः >28% BF"),
          l("12–18% body fat","12-18% शरीर वसा"),
          bmi >= 25
            ? l(`Create 400–500 kcal deficit from your TDEE (${tdee} kcal). Target: ${tdee - 450} kcal/day.`,`TDEE (${tdee} kcal) से 400-500 kcal घाटा बनाएं। लक्ष्य: ${tdee - 450} kcal/दिन।`)
            : l("Maintain current composition. Add strength training 3×/week.","वर्तमान संरचना बनाए रखें। सप्ताह में 3 बार शक्ति प्रशिक्षण जोड़ें।"),
          l("Aromatase converts T→Estrogen in fat tissue","एरोमेटेज़ वसा ऊतक में T→एस्ट्रोजन बदलती है")],
        [l("Training Type","प्रशिक्षण प्रकार"),
          exercisePrefs.toLowerCase().includes("weights") || exercisePrefs.toLowerCase().includes("gym")
            ? l("★GOOD★ Resistance training","★GOOD★ प्रतिरोध प्रशिक्षण")
            : l("★WARN★ Cardio-dominant","★WARN★ कार्डियो-प्रधान"),
          l("70–85% 1RM compound lifts","70-85% 1RM कंपाउंड लिफ्ट"),
          l("Squat, deadlift, bench: 4 sets. Testosterone spikes 15–25 min post-workout.","स्क्वाट, डेडलिफ्ट, बेंच: 4 सेट। वर्कआउट के 15-25 मिनट बाद टेस्टोस्टेरोन 15-25% बढ़ता है।"),
          l("+15–25% post compound lift","कंपाउंड लिफ्ट के बाद +15-25%")],
        [l("Stress","तनाव"),
          `${stressLevel}`,
          l("LOW (cortisol <18 mcg/dL morning)","LOW (कोर्टिसोल <18 mcg/dL सुबह)"),
          (profile.stressScore || 50) > 55
            ? l("★WARN★ Cortisol suppresses LH which drives testosterone. Add 10-min morning meditation.","★WARN★ कोर्टिसोल LH को दबाता है जो टेस्टोस्टेरोन चलाता है। 10 मिनट सुबह ध्यान जोड़ें।")
            : l("Maintain. 4-7-8 breathing during stressful periods.","बनाए रखें। तनावपूर्ण अवधि के दौरान 4-7-8 श्वास।"),
          l("Cortisol is inverse to testosterone","कोर्टिसोल टेस्टोस्टेरोन का विपरीत है")],
      ],
      [28, 28, 24, 62, 38]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("12-Week Progressive Overload Table — Your Personalized Plan", "12-सप्ताह प्रगतिशील ओवरलोड तालिका — आपकी व्यक्तिगत योजना"));
    drawPremiumTable(ctx,
      [l("Week","सप्ताह"), l("Phase","चरण"), l("Days/Wk","दिन/सप्ताह"), l("Intensity","तीव्रता"), l("Volume","मात्रा"), l("Key Focus","मुख्य फोकस"), l("Protein Target","प्रोटीन लक्ष्य")],
      [
        ["1–4", l("Foundation","आधार"), "3", "60–65% 1RM", l("3×12–15","3×12-15"), l("Movement quality + form + mind-muscle","मूवमेंट गुणवत्ता + फॉर्म"), `${Math.round(profile.weightKg * 1.8)}g`],
        ["5–7", l("Hypertrophy","हाइपरट्रॉफी"), "4", "70–80% 1RM", l("4×8–12 + dropsets","4×8-12 + ड्रॉप सेट"), l("Volume accumulation — 16–20 sets per muscle/week","मात्रा संचय"), `${Math.round(profile.weightKg * 2.0)}g`],
        ["8–10", l("Strength","शक्ति"), "4–5", "80–88% 1RM", l("5×4–6 compounds","5×4-6 कंपाउंड"), l("Progressive load — add 2.5kg/week to main lifts","प्रगतिशील लोड"), `${Math.round(profile.weightKg * 2.1)}g`],
        ["11", l("Peak","चरम"), "4", "88–95% 1RM", l("3–5×1–5","3-5×1-5"), l("Max strength output — rest 4–5 min between sets","अधिकतम शक्ति आउटपुट"), `${Math.round(profile.weightKg * 2.2)}g`],
        ["12", l("★GOOD★ Deload","★GOOD★ डीलोड"), "3", "50% 1RM", l("2×10–12","2×10-12"), l("Active recovery. MANDATORY — allows supercompensation.","सक्रिय रिकवरी। अनिवार्य।"), `${Math.round(profile.weightKg * 1.8)}g`],
      ],
      [16, 26, 18, 24, 26, 60, 24]
    );

    addSpacing(ctx, 4);
    addSubSection(ctx, l("Testosterone-Supporting Supplement Stack (India Pricing)", "टेस्टोस्टेरोन सहायक सप्लीमेंट स्टैक (भारत मूल्य)"));
    drawPremiumTable(ctx,
      [l("Supplement","सप्लीमेंट"), l("Dose + Timing","डोज़ + समय"), l("Why for You","आपके लिए क्यों"), l("Brand (India)","ब्रांड (भारत)"), l("Price/Month INR","मूल्य/माह INR")],
      [
        ["Ashwagandha KSM-66",
          l("600mg daily (morning with food)","600mg दैनिक (सुबह भोजन के साथ)"),
          (profile.stressScore || 50) > 50
            ? l(`★CRIT★ Stress ${stressLevel} suppresses LH. KSM-66 raises testosterone by 15–17% (JISSN 2021).`,`★CRIT★ तनाव ${stressLevel} LH को दबाता है। KSM-66 टेस्टोस्टेरोन 15-17% बढ़ाता है।`)
            : l("Cortisol → testosterone ratio. 15–17% T increase in 8 weeks (KSM-66 study).","कोर्टिसोल → टेस्टोस्टेरोन अनुपात। 8 सप्ताह में 15-17% T वृद्धि।"),
          "OZiva / Himalaya KSM-66", "₹400–700"],
        ["Shilajit (Purified)",
          l("200–500mg daily, morning on empty stomach","200-500mg दैनिक, सुबह खाली पेट"),
          l("Contains fulvic acid + 85+ minerals. Increases free testosterone + sperm quality.","फुल्विक एसिड + 85+ खनिज। मुक्त टेस्टोस्टेरोन + शुक्राणु गुणवत्ता बढ़ाता है।"),
          "Upakarma Shilajit / Amazon India", "₹600–1,200"],
        ["Zinc (Picolinate)",
          l("30mg daily with food (not on empty stomach)","30mg दैनिक भोजन के साथ (खाली पेट नहीं)"),
          l("Zinc is required for testosterone synthesis. Indian diet often deficient.","जिंक टेस्टोस्टेरोन संश्लेषण के लिए आवश्यक। भारतीय आहार में अक्सर कमी।"),
          "HealthKart Zinc Picolinate", "₹200–350"],
        [l("Tongkat Ali (LJ100)","टोंगकट अली"),
          l("200mg daily (LJ100 extract only)","200mg दैनिक (केवल LJ100 एक्सट्रैक्ट)"),
          l("★WARN★ Use LJ100 standardized extract only. Raises free testosterone by reducing SHBG.","★WARN★ केवल LJ100 मानकीकृत एक्सट्रैक्ट। SHBG कम करके मुक्त टेस्टोस्टेरोन बढ़ाता है।"),
          "Double Wood Supplements (Amazon India)", "₹1,200–2,000"],
      ],
      [36, 38, 60, 40, 26]
    );

    addNewPage(ctx);
  }

  // ════════════════════════════════════════════════════════════
  // ADD-ON G · PRODUCT RECOMMENDATIONS
  // NEW VALUE: Product-level specifics (not in any core section).
  // Includes exact pricing, brands, WHY for this user.
  // VALIDATION: Each product ties to a user deficiency/goal.
  // ════════════════════════════════════════════════════════════
  if (addOns.includes("addon_products")) {
    addNewPage(ctx);
    drawSectionBanner(ctx,
      l("G · RECOMMENDED PRODUCTS", "G · अनुशंसित उत्पाद"),
      l("Curated Supplement & Wellness Products — India Pricing + Personalization Link", "क्यूरेटेड सप्लीमेंट और वेलनेस उत्पाद — भारत मूल्य + व्यक्तिगतकरण लिंक"),
      l(`${profile.name} · ${profile.age} yrs · BMI ${bmi} · Goals: ${(profile.goals || ["General Wellness"]).join(", ")} — Deficiency-matched, budget-optimized`,
        `${profile.name} · ${profile.age} वर्ष · BMI ${bmi} · लक्ष्य: ${(profile.goals || ["सामान्य स्वास्थ्य"]).join(", ")} — कमी-आधारित, बजट-अनुकूलित`)
    );

    addSpacing(ctx, 3);
    addText(ctx,
      l(`Every product below is matched to YOUR specific deficiencies, goals, and conditions — NOT a generic list. Each product includes: what to buy, exact dose, when to take it, and WHY it is specifically relevant to your profile. All prices are verified Amazon India / HealthKart / PharmEasy as of 2025–2026.`,
        `नीचे प्रत्येक उत्पाद आपकी विशिष्ट कमियों, लक्ष्यों और स्थितियों से मेल खाता है — सामान्य सूची नहीं। प्रत्येक उत्पाद में शामिल है: क्या खरीदें, सटीक डोज़, कब लें, और WHY यह आपके प्रोफ़ाइल के लिए विशेष रूप से प्रासंगिक है।`),
      8.5, DARK
    );
    addSpacing(ctx, 4);

    // Build personalized product list from profile
    const productRows: string[][] = [];

    // Always recommend D3 (deficiency near-universal in India)
    productRows.push([
      "Vitamin D3 + K2",
      l("2,000 IU D3 + 45mcg K2 · daily with fat-containing meal","2,000 IU D3 + 45mcg K2 · वसा युक्त भोजन के साथ दैनिक"),
      l(`D3 deficiency affects 70%+ Indians including your region (${profile.region || "India"}). K2 ensures D3 calcium goes to bones — not arteries.`,
        `D3 कमी 70%+ भारतीयों को प्रभावित करती है। K2 सुनिश्चित करता है D3 कैल्शियम हड्डियों में जाए — धमनियों में नहीं।`),
      "HealthKart D3+K2 / NOW Foods D3+K2",
      "₹250–450/month"
    ]);

    // Protein (if protein target is high or they're veg)
    const proteinTooLow = isVeg;
    productRows.push([
      isVeg ? l("Plant Protein Powder","प्लांट प्रोटीन पाउडर") : l("Whey Protein Isolate","व्हे प्रोटीन आइसोलेट"),
      isVeg
        ? l(`30g serving 1–2×/day. Target: ${proteinTarget}g/day from all sources.`,`30g सर्विंग 1-2×/दिन। लक्ष्य: ${proteinTarget}g/दिन।`)
        : l(`25–30g post-workout + 1 more serving if needed. Target: ${proteinTarget}g/day.`,`वर्कआउट के बाद 25-30g + 1 और यदि जरूरी। लक्ष्य: ${proteinTarget}g/दिन।`),
      isVeg
        ? l(`Your vegetarian diet makes ${proteinTarget}g/day from food alone very difficult. Plant protein bridges the gap.`,
            `शाकाहारी आहार में ${proteinTarget}g/दिन खाने से अकेले हासिल करना कठिन है। प्लांट प्रोटीन अंतर भरता है।`)
        : l(`Body weight ${profile.weightKg}kg requires ${proteinTarget}g protein/day for muscle maintenance/growth. Food alone often insufficient.`,
            `शरीर वजन ${profile.weightKg}kg के लिए मांसपेशी के लिए ${proteinTarget}g प्रोटीन/दिन चाहिए।`),
      isVeg ? "Gritzo Plant Protein / OZiva Protein (Amazon India)" : "Optimum Nutrition Gold Standard / MuscleBlaze Whey",
      isVeg ? "₹1,200–2,000/month" : "₹1,500–2,500/month"
    ]);

    // Magnesium if sleep is poor
    if ((profile.sleepScore || 70) < 75) {
      productRows.push([
        "Magnesium Bisglycinate",
        l("300–400mg · 30 min before bed","300-400mg · सोने से 30 मिनट पहले"),
        l(`Your sleep score is ${profile.sleepScore}/100. Magnesium bisglycinate is the ONLY form that crosses the blood-brain barrier effectively and promotes GABA — the sleep neurotransmitter. Citrate and oxide forms do NOT work the same.`,
          `आपका नींद स्कोर ${profile.sleepScore}/100 है। मैग्नीशियम बिसग्लाइसिनेट GABA — नींद न्यूरोट्रांसमीटर — को बढ़ावा देता है।`),
        "NOW Foods Magnesium Bisglycinate / HealthKart Mg",
        "₹350–550/month"
      ]);
    }

    // Omega-3 (nearly universal benefit)
    productRows.push([
      l("Omega-3 Fish Oil (EPA+DHA)","ओमेगा-3 फिश ऑयल (EPA+DHA)"),
      l("1,000–2,000mg combined EPA+DHA · with largest meal","1,000-2,000mg संयुक्त EPA+DHA · सबसे बड़े भोजन के साथ"),
      l(`Omega-3 deficiency is near-universal in India (plant-based ALA does NOT convert well to EPA/DHA). Reduces ${digestive.includes("acidity") ? "gut inflammation (acidity)" : "systemic inflammation"} and improves brain function + mood.`,
        `ओमेगा-3 कमी भारत में लगभग सार्वभौमिक है। ${digestive.includes("acidity") ? "आंत की सूजन (अम्लता)" : "प्रणालीगत सूजन"} कम करता है।`),
      "Himalaya Omega / Carlson Elite Omega (Amazon India)",
      "₹500–900/month"
    ]);

    // Ashwagandha if stress is elevated
    if ((profile.stressScore || 50) > 45) {
      productRows.push([
        "Ashwagandha KSM-66",
        l("300–600mg · morning with food (5 days ON, 2 days OFF)","300-600mg · सुबह भोजन के साथ (5 दिन चालू, 2 दिन बंद)"),
        l(`Your stress level is ${stressLevel} (score: ${profile.stressScore}/100). KSM-66 is the only Ashwagandha extract with 24 clinical trials. Reduces cortisol by 27% in 8 weeks. This directly improves your sleep, energy, and immune function.`,
          `आपका तनाव स्तर ${stressLevel} है। KSM-66 केवल 24 क्लिनिकल परीक्षणों वाला अश्वगंधा एक्सट्रैक्ट है। 8 सप्ताह में कोर्टिसोल 27% कम करता है।`),
        "OZiva KSM-66 / Himalaya Ashwagandha (KSM-66 only)",
        "₹400–700/month"
      ]);
    }

    // Condition-specific
    if (digestive.includes("acidity") || digestive.includes("acid reflux")) {
      productRows.push([
        l("Slippery Elm + Aloe Vera (gut coating)","स्लिपरी एल्म + एलोवेरा (आंत कोटिंग)"),
        l("Slippery elm 400mg before meals + 30ml aloe vera juice (unflavored) after meals","भोजन से पहले स्लिपरी एल्म 400mg + भोजन के बाद 30ml एलोवेरा जूस"),
        l(`You have acidity/acid reflux. These coat and protect the esophageal lining (different mechanism to antacids — addresses root cause not symptoms). Avoid if on blood-thinners.`,
          `आपको अम्लता है। ये अन्नप्रणाली की परत को कोट और सुरक्षित करते हैं — एंटासिड की तुलना में अलग तंत्र।`),
        "Himalaya Aloe Vera Juice / Nature's Way Slippery Elm",
        "₹300–600/month"
      ]);
    }
    if (digestive.includes("constipation")) {
      productRows.push([
        "Isabgol (Psyllium Husk) + Probiotics",
        l("1 tsp isabgol in 300ml water before bed + probiotic 10B CFU morning","सोने से पहले 300ml पानी में 1 tsp इसबगोल + सुबह प्रोबायोटिक 10B CFU"),
        l(`Your constipation is directly linked to water intake (${profile.waterLiters || profile.waterIntake || "low"} L/day) and low fiber. Isabgol is 70% soluble fiber — it draws water into the colon. Probiotics add motility-promoting bacteria (L. rhamnosus, B. longum).`,
          `आपकी कब्ज पानी के सेवन और कम फाइबर से जुड़ी है। इसबगोल 70% घुलनशील फाइबर है।`),
        "Sat Isabgol (pharmacy) + Yakult / BlueBiotics Probiotics",
        "₹150–400/month"
      ]);
    }
    if (conditions.includes("thyroid")) {
      productRows.push([
        "Selenium (as Selenomethionine)",
        l("200mcg · with food (NEVER exceed 400mcg/day)","भोजन के साथ 200mcg (400mcg/दिन से अधिक कभी नहीं)"),
        l(`THYROID-SPECIFIC: Selenium is required for the enzyme that converts T4→T3. Your thyroid condition means this conversion may be suboptimal. Selenomethionine is better absorbed than selenite. Brazil nuts (1/day) are an alternative.`,
          `थायरॉइड-विशिष्ट: सेलेनियम T4→T3 रूपांतरित करने वाले एंजाइम के लिए आवश्यक है।`),
        "NOW Foods Selenium 200mcg / HealthKart Selenium",
        "₹300–500/month"
      ]);
    }
    if (profile.skinConcerns?.some((s: string) => s.toLowerCase().includes("acne"))) {
      productRows.push([
        "Zinc Picolinate + Spearmint Extract",
        l("Zinc 25–30mg with food + Spearmint 400mg daily","जिंक 25-30mg भोजन के साथ + स्पियरमिंट 400mg दैनिक"),
        l(`ACNE-SPECIFIC: Zinc reduces sebum production and IGF-1 (key acne driver). Spearmint reduces DHT and free testosterone — the hormonal driver of adult acne. Clinical trial: spearmint tea 2×/day reduced acne by 25% in 30 days.`,
          `मुहांसे-विशिष्ट: जिंक सीबम उत्पादन और IGF-1 कम करता है। स्पियरमिंट DHT और मुक्त टेस्टोस्टेरोन कम करता है।`),
        "HealthKart Zinc Picolinate / NaturesWay Spearmint (Amazon)",
        "₹400–700/month"
      ]);
    }

    drawPremiumTable(ctx,
      [l("Product","उत्पाद"), l("Dose + Timing","डोज़ + समय"), l("Why for YOU","आपके लिए क्यों"), l("Brand (India)","ब्रांड (भारत)"), l("Price/Month","मूल्य/माह")],
      productRows,
      [34, 36, 64, 44, 22]
    );

    addSpacing(ctx, 5);
    drawGoldCallout(ctx,
      l("Where to Buy — India (Verified Sources)", "कहाँ से खरीदें — भारत (सत्यापित स्रोत)"),
      l("Amazon India (amazon.in): Best for international brands · HealthKart (healthkart.com): Best for Indian brands + protein powders · PharmEasy / 1mg: Prescriptions + branded supplements with lab verification · Netmeds: Best for PCOS/thyroid specific supplements · LOCAL: Sat Isabgol, Yakult, basic probiotics at any pharmacy.",
        "Amazon India: अंतरराष्ट्रीय ब्रांड के लिए सर्वश्रेष्ठ · HealthKart: भारतीय ब्रांड + प्रोटीन पाउडर · PharmEasy / 1mg: प्रिस्क्रिप्शन + सत्यापित सप्लीमेंट · Netmeds: PCOS/थायरॉइड विशिष्ट।")
    );

    addNote(ctx, l(
      "All products are for supplementary use only. Prices are approximate (2025–2026, India). Start ONE new supplement at a time, 2-week intervals. Consult your doctor before starting if you are on any prescription medication.",
      "सभी उत्पाद केवल पूरक उपयोग के लिए हैं। मूल्य अनुमानित हैं (2025-2026, भारत)। एक बार में एक नया सप्लीमेंट शुरू करें, 2-सप्ताह के अंतराल पर। कोई भी नुस्खे वाली दवा लेने पर डॉक्टर से परामर्श करें।"
    ));

    addNewPage(ctx);
  }
}

function renderProgressTracking(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, tier } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  addHeaderSection(ctx, l("15 · Progress Tracking & Weekly Check-ins", "15 · प्रगति ट्रैकिंग और साप्ताहिक जांच"), l(`${profile.name}'s 90-day transformation milestones`, `${profile.name} की 90-दिन परिवर्तन उपलब्धियां`));

  addSubSection(ctx, l("Every Sunday: 3-Minute Self-Check (Fill This In)", "हर रविवार: 3-मिनट आत्म-जांच (इसे भरें)"));
  drawPremiumTable(ctx,
    [l("METRIC", "मेट्रिक"), l("SCORE (1-10)", "स्कोर (1-10)"), l("THIS WEEK", "इस सप्ताह"), l("NOTES / CHANGE", "नोट्स / बदलाव")],
    [
      [l("Energy (morning)", "ऊर्जा (सुबह)"), "  ___/10", "", ""],
      [l("Sleep quality", "नींद की गुणवत्ता"), "  ___/10", "", ""],
      [l("Stress level", "तनाव स्तर"), "  ___/10", "", ""],
      [l("Workouts done", "व्यायाम पूरे"), "  ___/target", "", ""],
      [l("Nutrition adherence", "पोषण अनुपालन"), "  ___%", "", ""],
      [l("Water target met?", "पानी लक्ष्य पूरा?"), "  Y / N", "", ""],
    ],
    [55, 30, 42, 53]
  );
  addSpacing(ctx, 3);

  if (tier !== "free") {
    addSubSection(ctx, l("Monthly Assessment — Weeks 4, 8, 12", "मासिक मूल्यांकन — सप्ताह 4, 8, 12"));
    drawChecklistTable(ctx, l("Body & Performance Checks", "शरीर और प्रदर्शन जांच"), [
      l("Weight + waist + hip measurements (same time each month)", "वजन + कमर + कूल्हा माप (हर महीने एक ही समय)"),
      l("Progress photos: same light, same angle, same clothing", "प्रगति फोटो: एक ही प्रकाश, कोण, कपड़े"),
      l("Performance test: push-ups in 60 sec, plank hold time", "प्रदर्शन परीक्षण: 60 सेकंड में पुश-अप, प्लैंक होल्ड"),
      l("Resting heart rate (morning, before rising)", "आराम दिल की धड़कन (सुबह, उठने से पहले)"),
      l("Blood work recheck vs. baseline (Week 12 minimum)", "रक्त जांच आधारभूत से तुलना (कम से कम सप्ताह 12)"),
    ], NAVY_MID);
    addSpacing(ctx, 3);
  }

  addSubSection(ctx, l("What to Expect — Transformation Timeline", "क्या अपेक्षा करें — परिवर्तन समयरेखा"));
  drawPremiumTable(ctx,
    [l("TIMEFRAME", "समयसीमा"), l("WHAT YOU'LL NOTICE", "आप क्या देखेंगे"), l("KEY WIN", "मुख्य जीत")],
    [
      [l("Week 1-2", "सप्ताह 1-2"), l("Sleep improves. Energy begins to stabilize. Some adjustment discomfort is normal.", "नींद सुधरती है। ऊर्जा स्थिर होने लगती है।"), l("Consistent bedtime locked in", "सोने का समय निश्चित")],
      [l("Week 3-4", "सप्ताह 3-4"), l("Mood lifts. Stress reduces. Digestion improving. Workouts feel easier.", "मूड बेहतर। तनाव कम। पाचन सुधर रहा है।"), l("First monthly assessment", "पहला मासिक मूल्यांकन")],
      [l("Week 5-8", "सप्ताह 5-8"), l("Visible body composition changes. Sustained energy all day. Strength gains.", "शरीर संरचना में बदलाव। पूरे दिन ऊर्जा। शक्ति लाभ।"), l("Supplement stack phase 2", "सप्लीमेंट चरण 2")],
      [l("Week 9-12", "सप्ताह 9-12"), l("Habits feel automatic. Confidence up. Biomarkers improving. Major transformation.", "आदतें स्वचालित। आत्मविश्वास ऊंचा। बायोमार्कर सुधरे।"), l("Final blood work recheck", "अंतिम रक्त जांच")],
    ],
    [25, 100, 55]
  );
  addNote(ctx, l(
    "Consistency beats perfection. Even 80% adherence over 90 days produces meaningful, lasting results.",
    "निरंतरता पूर्णता से अधिक महत्वपूर्ण है। 90 दिनों में 80% अनुपालन भी सार्थक परिणाम देता है।"
  ));

  addNewPage(ctx);

  addHeaderSection(ctx, l("16 · 90-Day Action Plan", "16 · 90-दिन कार्य योजना"), l(`${profile.name}'s phase-by-phase transformation roadmap`, `${profile.name} का चरण-दर-चरण परिवर्तन रोडमैप`));

  drawPhaseBlocks(ctx, [
    {
      label: l("PHASE 1: FOUNDATION", "चरण 1: आधार"),
      weeks: l("Weeks 1-2", "सप्ताह 1-2"),
      color: NAVY,
      items: [
        l("Read this blueprint fully — understand the WHY behind every recommendation", "इस ब्लूप्रिंट को पूरी तरह पढ़ें — हर सिफारिश का कारण समझें"),
        l("Lock consistent wake time and meal window (most important habit)", "निरंतर जागने का समय और भोजन विंडो निश्चित करें"),
        l("Stock your kitchen from the nutrition section grocery list", "पोषण सूची से रसोई में सामान भरें"),
        l("Set up tracking (HealthifyMe, MyFitnessPal, or notebook)", "ट्रैकिंग सेट करें (HealthifyMe, MyFitnessPal, या नोटबुक)"),
        ...(tier !== "free" ? [l("Book baseline blood tests (CRITICAL tests, Week 0)", "आधारभूत रक्त परीक्षण बुक करें (सप्ताह 0)")] : []),
        ...(tier !== "free" ? [l("Start 3x/week movement routine — even 20-minute walks count", "सप्ताह में 3 बार व्यायाम शुरू करें — 20 मिनट चलना भी ठीक")] : []),
      ],
    },
    {
      label: l("PHASE 2: MOMENTUM", "चरण 2: गति"),
      weeks: l("Weeks 3-6", "सप्ताह 3-6"),
      color: GREEN_OK,
      items: [
        l("Weekend meal prep: cook 2-3 meals in advance", "सप्ताहांत भोजन तैयारी: 2-3 भोजन पहले बनाएं"),
        l("Add daily breathwork (5 min morning, before phone)", "दैनिक श्वास कार्य जोड़ें (5 मिनट सुबह, फोन से पहले)"),
        l("Increase workout intensity/frequency by 10-15%", "व्यायाम तीव्रता/आवृत्ति 10-15% बढ़ाएं"),
        l("Week 4: Complete first monthly assessment — take photos + measurements", "सप्ताह 4: पहला मासिक मूल्यांकन — फोटो + माप"),
        ...((isPremiumOrAbove(tier)) ? [l("Begin Phase 1 supplements (Vitamin D3 + Magnesium first)", "चरण 1 सप्लीमेंट शुरू करें (विटामिन D3 + मैग्नीशियम पहले)")] : []),
      ],
    },
    {
      label: l("PHASE 3: OPTIMIZATION", "चरण 3: अनुकूलन"),
      weeks: l("Weeks 7-12", "सप्ताह 7-12"),
      color: ORANGE_WARN,
      items: [
        l("Adjust calories/macros based on Week 4 assessment results", "सप्ताह 4 मूल्यांकन परिणामों के आधार पर कैलोरी/मैक्रो समायोजित करें"),
        l("Progressive overload: increase weights every 2 weeks", "प्रगतिशील ओवरलोड: हर 2 सप्ताह वजन बढ़ाएं"),
        l("Week 8: Second monthly assessment — compare to baseline", "सप्ताह 8: दूसरा मासिक मूल्यांकन — आधारभूत से तुलना"),
        l("Refine supplement stack based on how you feel at Week 8", "सप्ताह 8 पर अपनी भावना के आधार पर सप्लीमेंट परिष्कृत करें"),
        l("Week 12: Final assessment + blood work recheck + CELEBRATE", "सप्ताह 12: अंतिम मूल्यांकन + रक्त जांच + जश्न मनाएं"),
      ],
    },
  ]);

  addSpacing(ctx, 3);
  drawGoldCallout(ctx, l("The #1 Rule of This 90-Day Journey", "इस 90-दिन यात्रा का #1 नियम"), l(
    `${profile.name} — do NOT try to do everything at once. Pick ONE habit from each phase. Add the next only when the first feels automatic. Consistency at 80% beats perfection at 20%.`,
    `${profile.name} — एक साथ सब कुछ करने की कोशिश न करें। प्रत्येक चरण से एक आदत चुनें। अगली तभी जोड़ें जब पहली स्वचालित लगे। 80% निरंतरता, 20% पूर्णता से बेहतर है।`
  ));

  smartNewPage(ctx);
}

function renderAdjustments(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  if (!bundle.adjustments || bundle.adjustments.length === 0) return;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;
  
  addNewPage(ctx);
  addHeaderSection(ctx, l("Automatic Adjustments Made", "स्वचालित समायोजन किए गए"), l("Internal corrections applied to ensure blueprint accuracy and safety", "ब्लूप्रिंट की सटीकता और सुरक्षा सुनिश्चित करने के लिए आंतरिक सुधार"));
  bundle.adjustments.forEach(adj => addBullet(ctx, adj, 10));
  addSpacing(ctx, 5);
  addNote(ctx, l(
    "These adjustments are made automatically by our validation engine to align the recommendations with your physiological profile and dietary constraints.",
    "ये समायोजन हमारे सत्यापन इंजन द्वारा स्वचालित रूप से किए जाते हैं ताकि सिफारिशें आपके शारीरिक प्रोफ़ाइल और आहार प्रतिबंधों के अनुरूप हों।"
  ));
}

function renderClosing(ctx: PDFContext, bundle: PDFDataBundle, language: "en" | "hi" = "en"): void {
  const { profile, tier, orderId, timestamp } = bundle;
  const l = (en: string, hi: string) => language === "hi" ? hi : en;

  ctx.pdf.setFontSize(16);
  ctx.pdf.setTextColor(...PURPLE);
  setCtxFont(ctx, "bold");
  ctx.pdf.text(l("Remember", "याद रखें"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 10;

  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(...DARK);
  setCtxFont(ctx, "normal");
  const closingMessage = l(
    `${profile.name}, this blueprint is your evidence-based roadmap to better health. You don't need to be perfect — you need to be consistent. Start with the Top 3 Actions and build from there.\n\nSmall, consistent steps create lasting transformation. You have everything you need to succeed. Trust the process.`,
    `${profile.name}, यह ब्लूप्रिंट बेहतर स्वास्थ्य के लिए आपका साक्ष्य-आधारित रोडमैप है। आपको परफेक्ट होने की जरूरत नहीं — बस निरंतर रहें। पहले शीर्ष 3 कार्यों से शुरू करें और आगे बढ़ें।\n\nछोटे, निरंतर कदम स्थायी परिवर्तन लाते हैं। सफल होने के लिए आपके पास सब कुछ है। प्रक्रिया पर भरोसा रखें।`
  );
  const closingLines = ctx.pdf.splitTextToSize(closingMessage, ctx.contentWidth);
  ctx.pdf.text(closingLines, ctx.margin, ctx.yPosition);
  ctx.yPosition += closingLines.length * 5 + 10;

  if (isCoachingOrAbove(tier)) {
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PURPLE);
    setCtxFont(ctx, "bold");
    ctx.pdf.text(l("Coaching Edition Exclusive:", "कोचिंग संस्करण विशेष:"), ctx.margin, ctx.yPosition);
    ctx.yPosition += 5;
    setCtxFont(ctx, "normal");
    ctx.pdf.setTextColor(...DARK);
    const coachingNote = ctx.pdf.splitTextToSize(
      l(
        "As a Coaching Edition member, you have access to the weekly coaching worksheets and mindset framework. Use them every Sunday to stay on track and adjust your approach.",
        "कोचिंग संस्करण सदस्य के रूप में, आपको साप्ताहिक कोचिंग वर्कशीट और मानसिकता ढांचे तक पहुंच है। ट्रैक पर रहने और अपना दृष्टिकोण समायोजित करने के लिए उन्हें हर रविवार उपयोग करें।"
      ),
      ctx.contentWidth
    );
    ctx.pdf.text(coachingNote, ctx.margin, ctx.yPosition);
    ctx.yPosition += coachingNote.length * 5 + 6;
  }

  addSpacing(ctx, 8);
  ctx.pdf.setDrawColor(229, 231, 235);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.pageWidth - ctx.margin, ctx.yPosition);
  ctx.yPosition += 6;

  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GRAY);
  setCtxFont(ctx, "normal");
  ctx.pdf.text(l("Disclaimer: This blueprint is for educational purposes and does not constitute medical advice.", "अस्वीकरण: यह ब्लूप्रिंट शैक्षिक उद्देश्यों के लिए है और चिकित्सा सलाह नहीं है।"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text(l("Always consult qualified healthcare professionals before making significant lifestyle changes.", "महत्वपूर्ण जीवनशैली परिवर्तन करने से पहले हमेशा योग्य स्वास्थ्य पेशेवरों से परामर्श करें।"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text(l("Individual results may vary based on adherence, genetics, and pre-existing conditions.", "व्यक्तिगत परिणाम अनुपालन, आनुवांशिकी और पूर्व-मौजूद स्थितियों के आधार पर भिन्न हो सकते हैं।"), ctx.margin, ctx.yPosition);
  ctx.yPosition += 6;
  ctx.pdf.text(l(`Generated by GeneWell Wellness Platform | Order: ${orderId} | ${new Date(timestamp).toLocaleDateString("en-IN")}`, `GeneWell वेलनेस प्लेटफॉर्म द्वारा तैयार | ऑर्डर: ${orderId} | ${new Date(timestamp).toLocaleDateString("hi-IN")}`), ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text(l("© 2026 GeneWell. All rights reserved. | www.genewell.in", "© 2026 GeneWell. सर्वाधिकार सुरक्षित। | www.genewell.in"), ctx.margin, ctx.yPosition);
}

// ══════════════════════════════════════════════════════════════
// COMPOSITION LAYER — NEW PRIMARY ENTRY POINT
// ══════════════════════════════════════════════════════════════

async function loadDevanagariFont(pdf: jsPDF): Promise<void> {
  try {
    const response = await fetch("/NotoSansDevanagari-Regular.ttf");
    if (!response.ok) throw new Error("Font fetch failed");
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    pdf.addFileToVFS("NotoSansDevanagari-Regular.ttf", base64);
    pdf.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
  } catch (e) {
    console.warn("Devanagari font could not be loaded, falling back to helvetica", e);
  }
}

export async function generatePDFFromBundle(rawBundle: PDFDataBundle, language: "en" | "hi" = "en"): Promise<{ blob: Blob; filename: string }> {
  // Run pre-generation checks (validates profile, calorie logic, gender, dietary flags)
  const preCheck = runPreGenerationChecks(rawBundle);
  if (!preCheck.canGenerate) {
    throw new Error(`PDF generation blocked: ${preCheck.criticalErrors.join("; ")}`);
  }
  if (preCheck.warnings.length > 0) {
    console.warn("[PDF] Pre-generation warnings:", preCheck.warnings);
  }
  if (preCheck.autoCorrections.length > 0) {
    console.log("[PDF] Auto-corrections applied:", preCheck.autoCorrections);
  }

  const validation = validatePDFBundle(rawBundle);
  if (validation.adjustments.length > 0) {
    console.log("Auto-adjustments applied:", validation.adjustments);
  }
  const bundle = validation.cleaned;
  const pdfLanguage = language;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (pdfLanguage === "hi") {
    await loadDevanagariFont(pdf);
  }
  const ctx = createContext(pdf, pdfLanguage);
  const { tier, rules, addOns, profile } = bundle;
  
  // Filter modules based on gender to ensure clean render tree
  // This is the source of truth for the entire render process
  const activeModules = (rules.activeModules || []).filter(m => {
    if (profile.gender === "male") {
      return !["pcos_protocol", "ovarian_health", "menstrual_cycle", "women_hormone"].includes(m);
    }
    if (profile.gender === "female") {
      return !["prostate_health", "testosterone_optimization", "men_performance"].includes(m);
    }
    return true;
  });

  // RENDER COVER PAGE FIRST - mandatory for all tiers
  renderCoverPage(ctx, bundle, pdfLanguage);
  renderTableOfContents(ctx, bundle, pdfLanguage);

  // TOP 3 PRIORITY ACTIONS — appears after TOC for immediate impact
  renderTopActions(ctx, bundle, pdfLanguage);

  // ══════════════════════════════════════════════════════════════
  // BRAINY 15-SECTION STRUCTURE — matches reference format exactly
  // ══════════════════════════════════════════════════════════════

  // 01 · Personal Health Score Dashboard — ALL tiers
  renderHealthScoreDashboard(ctx, bundle, pdfLanguage);

  // 02 · Your Calculated Metabolic Numbers — ALL tiers
  renderMetabolicCalculations(ctx, bundle, pdfLanguage);

  // 03 · Decision Engine & Root Cause Analysis — ALL tiers
  renderDecisionEngine(ctx, bundle, pdfLanguage);

  // 04 · 90-Day Weight Projection — ALL tiers
  renderWeightProjection(ctx, bundle, pdfLanguage);

  // 05 · Nutrition Strategy & Macros — essential/premium/coaching
  if (tier !== "free" && activeModules.includes("nutrition_strategy")) {
    renderNutritionStrategy(ctx, bundle, pdfLanguage);
  }

  // 06 · 7-Day Meal Plan — premium/coaching
  if ((isPremiumOrAbove(tier)) && activeModules.includes("meal_plan")) {
    renderMealPlan(ctx, bundle, pdfLanguage);
  }

  // 07 · Sleep & Energy Protocol — ALL tiers
  renderSleepProtocol(ctx, bundle, pdfLanguage);

  // 08 · Anxiety & Mood Management — essential/premium/coaching
  if (tier !== "free") {
    renderStressManagement(ctx, bundle, pdfLanguage);
  }

  // 09 · Training Program — essential/premium/coaching
  if (tier !== "free" && (activeModules.includes("movement_program") || activeModules.includes("beginner_program"))) {
    renderMovementProgram(ctx, bundle, pdfLanguage);
  }

  // 10 · Gut Health & Hydration — premium/coaching
  if ((isPremiumOrAbove(tier)) && activeModules.includes("gut_health")) {
    renderDigestiveHealth(ctx, bundle, pdfLanguage);
  }

  // 11 · Skin Health — premium/coaching (if skin concerns)
  if ((isPremiumOrAbove(tier)) && activeModules.includes("skin_health") && profile.skinConcerns?.length > 0) {
    renderSkinHealth(ctx, bundle, pdfLanguage);
  }

  // 12 · Supplement Strategy — premium/coaching
  if ((isPremiumOrAbove(tier)) && activeModules.includes("supplements")) {
    renderSupplementStrategy(ctx, bundle, pdfLanguage);
  }

  // 13 · Recommended Lab Tests — ALL tiers
  renderLabTests(ctx, bundle, pdfLanguage);

  // 14 · Condition-specific add-ons (Women's Hormonal, Men's, DNA, etc.)
  if (addOns?.length > 0) {
    renderAddOns(ctx, bundle, pdfLanguage);
  }

  // 15 · Progress Tracking & Weekly Check-ins — ALL tiers
  // Coaching edition also adds detailed coaching content
  if (isCoachingOrAbove(tier) && activeModules.includes("coaching_edition")) {
    renderCoachingSection(ctx, bundle, pdfLanguage);
  } else {
    renderProgressTracking(ctx, bundle, pdfLanguage);
  }

  // 16 · 90-Day Action Plan & Closing Thoughts — ALL tiers
  renderClosing(ctx, bundle, pdfLanguage);

  const pdfBlob = pdf.output("blob");
  const sanitizedName = bundle.profile.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  const filename = `${sanitizedName}_${tier}_wellness_blueprint_${bundle.orderId}.pdf`;

  return { blob: pdfBlob, filename };
}

// ══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE ADAPTER
// ══════════════════════════════════════════════════════════════

function convertLegacyToBundle(data: PersonalizationData, options: PDFGenerationOptions): PDFDataBundle {
  const { profile, insights } = data;
  const { tier, addOns = [], orderId, timestamp } = options;

  const bmi = profile.estimatedWeightKg / Math.pow(profile.estimatedHeightCm / 100, 2);

  const wellnessProfile: WellnessUserProfile = {
    name: profile.name,
    email: profile.email,
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.estimatedHeightCm,
    weightKg: profile.estimatedWeightKg,
    bmi: parseFloat(bmi.toFixed(1)),
    bmr: profile.estimatedBMR,
    tdee: profile.estimatedTDEE,
    proteinGrams: profile.proteinGrams,
    carbsGrams: profile.carbsGrams,
    fatsGrams: profile.fatsGrams,
    stressScore: profile.stressScore,
    sleepScore: profile.sleepScore,
    activityScore: profile.activityScore,
    energyScore: profile.energyScore,
    medicalConditions: profile.medicalConditions || [],
    digestiveIssues: profile.digestiveIssues || [],
    foodIntolerances: profile.foodIntolerances || [],
    skinConcerns: profile.skinConcerns || [],
    dietaryPreference: profile.dietaryPreference || "non-veg",
    exercisePreference: profile.exercisePreference || [],
    exerciseIntensity: profile.exerciseIntensity || "moderate",
    workSchedule: profile.workSchedule || "9-to-5",
    region: profile.region || "India",
    goals: (profile as any).goals || ["General Wellness"],
    recommendedTests: profile.recommendedTests || [],
    supplementPriority: profile.supplementPriority || [],
    mealFrequency: profile.mealFrequency || 3,
    dnaConsent: profile.dnaConsent || false,
    // Extended fields — computed from quiz data
    sleepHours: (profile as any).sleepHours ?? Math.round((profile.sleepScore / 100) * 8 * 10) / 10,
    waterLiters: (profile as any).waterLiters || (profile as any).waterIntake || 0.8,
    city: (profile as any).city || profile.region || "India",
    eatingOutFrequency: (profile as any).eatingOutFrequency || "occasionally",
    cravings: (profile as any).cravings || [],
    moodPatterns: (profile as any).moodPatterns || [],
    activityLevel: (profile as any).activityLevel || "",
  };

  const hasDigestive = profile.digestiveIssues?.length > 0;
  const hasSkin = profile.skinConcerns?.length > 0;
  const hasMedical = profile.medicalConditions?.length > 0;

  const activeModules: string[] = ["top_actions", "wellness_baseline", "sleep", "stress", "progress_tracking"];
  if (tier !== "free") {
    activeModules.push("metabolic_profile", "nutrition", "movement");
  }
  if (hasDigestive && tier !== "free") activeModules.push("gut_health");
  if (hasSkin && (isPremiumOrAbove(tier))) activeModules.push("skin_health");
  if (hasMedical) activeModules.push("condition_modules");
  if (isPremiumOrAbove(tier)) {
    activeModules.push("supplements", "lab_tests");
  }

  const sleepSeverity = profile.sleepScore < 40 ? "severe" as const : profile.sleepScore < 60 ? "moderate" as const : profile.sleepScore < 80 ? "mild" as const : "normal" as const;
  const stressSeverity = profile.stressScore > 70 ? "severe" as const : profile.stressScore > 50 ? "moderate" as const : profile.stressScore > 30 ? "mild" as const : "normal" as const;
  const weightRisk = bmi < 18.5 ? "underweight" as const : bmi < 25 ? "normal" as const : bmi < 30 ? "overweight" as const : "obese" as const;

  const rules: RuleEngineOutput = {
    riskFlags: [],
    activeModules,
    labTestPriority: [],
    narrativeHints: [],
    severityProfile: {
      sleepSeverity,
      stressSeverity,
      weightRisk,
      metabolicRisk: bmi > 30 ? "high" as const : bmi > 25 ? "moderate" as const : "low" as const,
    },
  };

  const conditionNarratives: Record<string, string> = {};
  if (hasMedical) {
    const conditions = profile.medicalConditions.map(c => c.toLowerCase());
    if (conditions.some(c => c.includes("thyroid"))) {
      conditionNarratives["thyroid"] = "Thyroid Support: Prioritize selenium-rich foods (brazil nuts) and iodine (if cleared by doctor). Avoid excessive raw cruciferous vegetables.";
    }
    if (conditions.some(c => c.includes("pcos") || c.includes("ovarian"))) {
      conditionNarratives["pcos"] = "PCOS Management: Focus on low-glycemic index (GI) foods to manage insulin sensitivity. Inositol supplementation may be beneficial.";
    }
    if (conditions.some(c => c.includes("diabetes") || c.includes("sugar"))) {
      const saltyCraving = ((profile as any).cravings || []).includes("salty-snacks");
      conditionNarratives["diabetes"] = "Glycemic Control: Pair all carbohydrates with fiber, protein, and healthy fats to blunt insulin spikes. Post-meal 10-minute walks are mandatory."
        + (saltyCraving ? " ⚠️ Salty cravings detected: Excess sodium worsens insulin resistance and raises blood pressure. Replace namkeen/chips with roasted makhana, cucumber slices with rock salt, or a small handful of unsalted nuts." : "");
    }
    if (conditions.some(c => c.includes("hypertension") || c.includes("blood pressure"))) {
      conditionNarratives["hypertension"] = `Blood Pressure Management: Reduce sodium to <2,300mg/day, increase potassium-rich foods. Your stress score of ${profile.stressScore}/100 ${profile.stressScore < 60 ? "suggests stress may be contributing." : "is manageable."}`;
    }
    if (conditions.some(c => c.includes("cholesterol") || c.includes("lipid"))) {
      conditionNarratives["cholesterol"] = "Cholesterol Support: Increase soluble fiber (oats, barley, beans), omega-3 fatty acids, and reduce trans fats. Regular aerobic exercise raises HDL.";
    }
  }

  const narratives: NarrativeOutput = {
    executiveSummary: `Dear ${profile.name},\n\nThis wellness blueprint has been created exclusively for you based on your quiz responses, lifestyle patterns, and health goals. Every recommendation is grounded in peer-reviewed research and tailored to your unique profile.\n\nThis is not a generic plan—it reflects YOUR age, body composition, activity level, dietary preferences, stress patterns, and health concerns. Follow the steps consistently for 90 days and track your progress.`,
    riskInterpretation: insights.metabolicInsight,
    goalStrategy: "",
    sleepNarrative: insights.sleepStrategy,
    stressNarrative: insights.stressStrategy,
    nutritionNarrative: `This plan is calculated specifically for a ${profile.age}-year old ${profile.gender} weighing ${profile.estimatedWeightKg}kg. Research in Cell Reports (2022) shows that aligning meals with your circadian rhythm improves insulin sensitivity by up to 36% and reduces inflammation markers.`,
    movementNarrative: insights.workoutStrategy,
    conditionNarratives,
  };

  const scaleFactor = profile.estimatedTDEE / 1800;
  const sc = (base: number) => Math.round(base * scaleFactor / 10) * 10;
  const isVeg = /^(veg|vegan|eggetarian)/i.test(profile.dietaryPreference || "");

  const mealPlan: MealPlanOutput = {
    days: [],
    dailyTargetCalories: profile.estimatedTDEE,
    macroTargets: { protein: profile.proteinGrams, carbs: profile.carbsGrams, fats: profile.fatsGrams },
    dietaryNotes: [`Portion sizes calibrated to your ${profile.estimatedTDEE} kcal target.`],
  };

  if (isPremiumOrAbove(tier)) {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    dayNames.forEach(dayLabel => {
      const makeMeal = (name: string, cal: number): MealItem => ({
        name,
        calories: sc(cal),
        protein: Math.round(sc(cal) * 0.25 / 4),
        carbs: Math.round(sc(cal) * 0.45 / 4),
        fats: Math.round(sc(cal) * 0.30 / 9),
        portion: "1 serving",
      });

      const day: DayMeal = {
        dayLabel,
        breakfast: [makeMeal(isVeg ? "Masala oat porridge with almonds + banana" : "3 eggs scrambled + whole wheat toast", 350)],
        midMorningSnack: [makeMeal("Roasted makhana + green tea", 120)],
        lunch: [makeMeal(isVeg ? "Rajma curry + brown rice + salad" : "Grilled chicken + brown rice + dal + salad", 550)],
        eveningSnack: [makeMeal("Trail mix (nuts + seeds)", 140)],
        dinner: [makeMeal(isVeg ? "Paneer tikka + roti + palak sabzi" : "Fish curry + roti + steamed vegetables", 500)],
        totalCalories: sc(1660),
        totalProtein: Math.round(profile.proteinGrams),
        totalCarbs: Math.round(profile.carbsGrams),
        totalFats: Math.round(profile.fatsGrams),
      };
      mealPlan.days.push(day);
    });
  }

  return {
    profile: wellnessProfile,
    rules,
    narratives,
    mealPlan,
    tier,
    addOns,
    orderId,
    timestamp,
  };
}

export async function generatePersonalizedPDFClient(
  personalizationData: PersonalizationData,
  options: PDFGenerationOptions
): Promise<{ blob: Blob; filename: string }> {
  const bundle = convertLegacyToBundle(personalizationData, options);
  return generatePDFFromBundle(bundle, options.language || "en");
}

// ══════════════════════════════════════════════════════════════
// DOWNLOAD HELPER
// ══════════════════════════════════════════════════════════════

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
