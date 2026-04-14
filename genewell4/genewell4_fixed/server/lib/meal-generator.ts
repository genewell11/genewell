import type { MealPlanOutput, DayMeal, MealItem, WellnessUserProfile } from "../../shared/wellness-types";

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

interface FoodEntry {
  name: string;
  category: "breakfast" | "lunch" | "dinner" | "snack";
  macroType: "protein" | "carb" | "fat" | "balanced";
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  defaultPortionG: number;
  dietCompatible: string[];
  conditions: string[];
  avoidForConditions: string[];
  intoleranceFlags: string[];
}

const FOOD_DATABASE: FoodEntry[] = [
  // ==================== BREAKFAST ====================
  {
    name: "Poha (Flattened Rice)",
    category: "breakfast",
    macroType: "carb",
    caloriesPer100g: 110,
    proteinPer100g: 2.5,
    carbsPer100g: 21,
    fatsPer100g: 1.8,
    defaultPortionG: 200,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Upma (Semolina)",
    category: "breakfast",
    macroType: "carb",
    caloriesPer100g: 130,
    proteinPer100g: 3.5,
    carbsPer100g: 20,
    fatsPer100g: 4,
    defaultPortionG: 200,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["gluten"],
  },
  {
    name: "Idli (Steamed Rice Cake)",
    category: "breakfast",
    macroType: "carb",
    caloriesPer100g: 130,
    proteinPer100g: 4,
    carbsPer100g: 25,
    fatsPer100g: 0.5,
    defaultPortionG: 150,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Masala Dosa",
    category: "breakfast",
    macroType: "carb",
    caloriesPer100g: 165,
    proteinPer100g: 3.5,
    carbsPer100g: 24,
    fatsPer100g: 6,
    defaultPortionG: 150,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Aloo Paratha",
    category: "breakfast",
    macroType: "carb",
    caloriesPer100g: 210,
    proteinPer100g: 5,
    carbsPer100g: 30,
    fatsPer100g: 8,
    defaultPortionG: 120,
    dietCompatible: ["veg", "non-veg", "eggetarian"],
    conditions: [],
    avoidForConditions: ["diabetes"],
    intoleranceFlags: ["gluten", "dairy"],
  },
  {
    name: "Oats Porridge with Almonds",
    category: "breakfast",
    macroType: "balanced",
    caloriesPer100g: 95,
    proteinPer100g: 4,
    carbsPer100g: 12,
    fatsPer100g: 3.5,
    defaultPortionG: 250,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Paneer Bhurji with Roti",
    category: "breakfast",
    macroType: "protein",
    caloriesPer100g: 180,
    proteinPer100g: 9,
    carbsPer100g: 14,
    fatsPer100g: 10,
    defaultPortionG: 200,
    dietCompatible: ["veg", "non-veg", "eggetarian"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["dairy", "gluten"],
  },
  {
    name: "Boiled Eggs (2) with Toast",
    category: "breakfast",
    macroType: "protein",
    caloriesPer100g: 155,
    proteinPer100g: 11,
    carbsPer100g: 12,
    fatsPer100g: 7,
    defaultPortionG: 150,
    dietCompatible: ["non-veg", "eggetarian"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["eggs", "gluten"],
  },
  {
    name: "Moong Dal Cheela",
    category: "breakfast",
    macroType: "protein",
    caloriesPer100g: 125,
    proteinPer100g: 7.5,
    carbsPer100g: 18,
    fatsPer100g: 3,
    defaultPortionG: 180,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Besan Cheela (Gram Flour)",
    category: "breakfast",
    macroType: "protein",
    caloriesPer100g: 135,
    proteinPer100g: 8,
    carbsPer100g: 19,
    fatsPer100g: 3.5,
    defaultPortionG: 180,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },

  // ==================== LUNCH ====================
  {
    name: "Dal Tadka with Steamed Rice",
    category: "lunch",
    macroType: "balanced",
    caloriesPer100g: 120,
    proteinPer100g: 4.5,
    carbsPer100g: 22,
    fatsPer100g: 2.5,
    defaultPortionG: 400,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Rajma (Kidney Beans) with Brown Rice",
    category: "lunch",
    macroType: "balanced",
    caloriesPer100g: 115,
    proteinPer100g: 5.5,
    carbsPer100g: 19,
    fatsPer100g: 1.8,
    defaultPortionG: 400,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Chole (Chickpeas) with Roti",
    category: "lunch",
    macroType: "balanced",
    caloriesPer100g: 145,
    proteinPer100g: 6,
    carbsPer100g: 24,
    fatsPer100g: 3,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["gluten"],
  },
  {
    name: "Palak Paneer with Roti",
    category: "lunch",
    macroType: "protein",
    caloriesPer100g: 160,
    proteinPer100g: 8,
    carbsPer100g: 15,
    fatsPer100g: 9,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "eggetarian"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["dairy", "gluten"],
  },
  {
    name: "Grilled Chicken Breast with Quinoa",
    category: "lunch",
    macroType: "protein",
    caloriesPer100g: 140,
    proteinPer100g: 18,
    carbsPer100g: 12,
    fatsPer100g: 3.5,
    defaultPortionG: 300,
    dietCompatible: ["non-veg"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Fish Curry with Rice",
    category: "lunch",
    macroType: "protein",
    caloriesPer100g: 130,
    proteinPer100g: 14,
    carbsPer100g: 15,
    fatsPer100g: 4,
    defaultPortionG: 350,
    dietCompatible: ["non-veg"],
    conditions: ["thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["seafood", "fish"],
  },
  {
    name: "Soya Chunk Curry with Brown Rice",
    category: "lunch",
    macroType: "protein",
    caloriesPer100g: 120,
    proteinPer100g: 12,
    carbsPer100g: 14,
    fatsPer100g: 2,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["thyroid", "general-wellness"],
    avoidForConditions: ["pcos"],
    intoleranceFlags: ["soy"],
  },
  {
    name: "Mix Veg Curry with Bajra Roti",
    category: "lunch",
    macroType: "carb",
    caloriesPer100g: 110,
    proteinPer100g: 3.5,
    carbsPer100g: 20,
    fatsPer100g: 2.5,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Yellow Moong Dal with Ragi Roti",
    category: "lunch",
    macroType: "balanced",
    caloriesPer100g: 125,
    proteinPer100g: 6,
    carbsPer100g: 21,
    fatsPer100g: 2,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },

  // ==================== DINNER ====================
  {
    name: "Tofu Stir-fry with Broccoli",
    category: "dinner",
    macroType: "protein",
    caloriesPer100g: 90,
    proteinPer100g: 9,
    carbsPer100g: 6,
    fatsPer100g: 4.5,
    defaultPortionG: 300,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "general-wellness"],
    avoidForConditions: ["thyroid"],
    intoleranceFlags: ["soy"],
  },
  {
    name: "Lentil Soup (Dal) with Salad",
    category: "dinner",
    macroType: "balanced",
    caloriesPer100g: 80,
    proteinPer100g: 5,
    carbsPer100g: 12,
    fatsPer100g: 1.5,
    defaultPortionG: 400,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Grilled Paneer with Sautéed Veggies",
    category: "dinner",
    macroType: "protein",
    caloriesPer100g: 150,
    proteinPer100g: 10,
    carbsPer100g: 8,
    fatsPer100g: 9,
    defaultPortionG: 250,
    dietCompatible: ["veg", "non-veg", "eggetarian"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["dairy"],
  },
  {
    name: "Roasted Chicken with Asparagus",
    category: "dinner",
    macroType: "protein",
    caloriesPer100g: 120,
    proteinPer100g: 20,
    carbsPer100g: 4,
    fatsPer100g: 3,
    defaultPortionG: 250,
    dietCompatible: ["non-veg"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Boiled Eggs (3) White with Mixed Veggies",
    category: "dinner",
    macroType: "protein",
    caloriesPer100g: 75,
    proteinPer100g: 12,
    carbsPer100g: 5,
    fatsPer100g: 1,
    defaultPortionG: 300,
    dietCompatible: ["non-veg", "eggetarian"],
    conditions: ["diabetes", "pcos", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["eggs"],
  },
  {
    name: "Baked Fish with Lemon and Garlic",
    category: "dinner",
    macroType: "protein",
    caloriesPer100g: 110,
    proteinPer100g: 19,
    carbsPer100g: 2,
    fatsPer100g: 3.5,
    defaultPortionG: 250,
    dietCompatible: ["non-veg"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["seafood", "fish"],
  },
  {
    name: "Vegetable Khichdi (Light)",
    category: "dinner",
    macroType: "balanced",
    caloriesPer100g: 95,
    proteinPer100g: 3.5,
    carbsPer100g: 18,
    fatsPer100g: 1.5,
    defaultPortionG: 350,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },

  // ==================== SNACKS ====================
  {
    name: "Roasted Makhana (Fox Nuts)",
    category: "snack",
    macroType: "carb",
    caloriesPer100g: 350,
    proteinPer100g: 9,
    carbsPer100g: 75,
    fatsPer100g: 0.5,
    defaultPortionG: 30,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["pcos", "thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Mixed Nuts (Almonds, Walnuts)",
    category: "snack",
    macroType: "fat",
    caloriesPer100g: 600,
    proteinPer100g: 20,
    carbsPer100g: 15,
    fatsPer100g: 55,
    defaultPortionG: 20,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["thyroid", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["nuts"],
  },
  {
    name: "Greek Yogurt with Berries",
    category: "snack",
    macroType: "protein",
    caloriesPer100g: 70,
    proteinPer100g: 8,
    carbsPer100g: 7,
    fatsPer100g: 1,
    defaultPortionG: 150,
    dietCompatible: ["veg", "non-veg", "eggetarian"],
    conditions: ["pcos", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: ["dairy"],
  },
  {
    name: "Sprouted Moong Salad",
    category: "snack",
    macroType: "protein",
    caloriesPer100g: 105,
    proteinPer100g: 7,
    carbsPer100g: 16,
    fatsPer100g: 0.5,
    defaultPortionG: 150,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["diabetes", "pcos", "general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
  {
    name: "Roasted Chana (Chickpeas)",
    category: "snack",
    macroType: "protein",
    caloriesPer100g: 360,
    proteinPer100g: 19,
    carbsPer100g: 58,
    fatsPer100g: 6,
    defaultPortionG: 40,
    dietCompatible: ["veg", "non-veg", "vegan", "eggetarian"],
    conditions: ["general-wellness"],
    avoidForConditions: [],
    intoleranceFlags: [],
  },
];

type MealSlot = "breakfast" | "midMorningSnack" | "lunch" | "eveningSnack" | "dinner";

const MEAL_SLOT_CALORIE_FRACTION: Record<MealSlot, number> = {
  breakfast: 0.25,
  midMorningSnack: 0.1,
  lunch: 0.3,
  eveningSnack: 0.1,
  dinner: 0.25,
};

function filterFoodPool(profile: WellnessUserProfile) {
  const diet = profile.dietaryPreference?.toLowerCase() || "veg";
  const conditions = (profile.medicalConditions || []).map(c => c.toLowerCase());
  const intolerances = (profile.foodIntolerances || []).map(i => i.toLowerCase());

  const patterns: Record<string, RegExp> = {
    lactose: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    dairy: /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i,
    gluten: /wheat|roti|bread|maida|semolina|rava|pasta/i,
    seafood: /fish|prawn|shrimp|seafood|crab|lobster/i,
    fish: /fish|prawn|shrimp|seafood|crab|lobster/i,
    nuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
    peanuts: /peanut|almond|cashew|walnut|pistachio|nut/i,
    soy: /soy|tofu|edamame|soya/i,
    eggs: /egg|omelette/i,
  };

  const pool = FOOD_DATABASE.filter(food => {
    // Diet compatibility
    if (!food.dietCompatible.includes(diet)) return false;

    // Conditions to avoid
    for (const cond of conditions) {
      if (food.avoidForConditions.some(ac => cond.includes(ac.toLowerCase()))) return false;
    }

    // Intolerance compatibility
    for (const intolerance of intolerances) {
      const regex = patterns[intolerance];
      if (regex && regex.test(food.name)) return false;
      if (food.intoleranceFlags.includes(intolerance)) return false;
    }

    return true;
  });

  const preferred = pool.filter(food => {
    for (const cond of conditions) {
      if (food.conditions.some(c => cond.includes(c.toLowerCase()))) return true;
    }
    return false;
  });

  const regular = pool.filter(food => !preferred.includes(food));

  return { preferred, regular };
}

function selectMealItems(
  slot: MealSlot,
  preferred: FoodEntry[],
  regular: FoodEntry[],
  rng: SeededRandom,
  avoidNames: Set<string>
): FoodEntry[] {
  const category = (slot === "midMorningSnack" || slot === "eveningSnack") ? "snack" : slot;
  
  let pool = [...preferred, ...regular].filter(f => f.category === category);
  
  // Try to avoid repeating previous day's food
  const nonRepeatPool = pool.filter(f => !avoidNames.has(f.name));
  if (nonRepeatPool.length > 0) pool = nonRepeatPool;

  if (pool.length === 0) {
    // Fallback if pool is empty after strict filtering
    pool = FOOD_DATABASE.filter(f => f.category === category);
  }

  // Pick 1-2 items per slot
  const items: FoodEntry[] = [];
  const numItems = (slot === "lunch" || slot === "dinner" || slot === "breakfast") ? 2 : 1;
  
  const shuffled = [...pool].sort(() => rng.next() - 0.5);
  return shuffled.slice(0, Math.min(numItems, shuffled.length));
}

function scaleMealItems(foods: FoodEntry[], targetCals: number): MealItem[] {
  const items: MealItem[] = [];
  if (foods.length === 0) return [];

  const calsPerFood = targetCals / foods.length;

  for (const food of foods) {
    const factor = calsPerFood / (food.caloriesPer100g || 100);
    const scaledPortion = Math.max(10, Math.round(100 * factor)); // Minimum 10g to avoid 1g placeholders
    
    // Recalculate based on the potentially adjusted portion
    const actualFactor = scaledPortion / 100;
    const calories = Math.round(food.caloriesPer100g * actualFactor);
    const protein = Math.round(food.proteinPer100g * actualFactor * 10) / 10;
    const carbs = Math.round(food.carbsPer100g * actualFactor * 10) / 10;
    const fats = Math.round(food.fatsPer100g * actualFactor * 10) / 10;

    items.push({
      name: food.name,
      calories,
      protein,
      carbs,
      fats,
      portion: `${scaledPortion}g`,
    });
  }

  return items;
}

export function generateMealPlan(
  profile: WellnessUserProfile,
  numDays: number = 7
): MealPlanOutput {
  const dailyTargetCalories = profile.tdee || 2000;
  const { preferred, regular } = filterFoodPool(profile);

  const slots: MealSlot[] = ["breakfast", "midMorningSnack", "lunch", "eveningSnack", "dinner"];

  const previousDaySlotNames: Record<MealSlot, Set<string>> = {
    breakfast: new Set(),
    midMorningSnack: new Set(),
    lunch: new Set(),
    eveningSnack: new Set(),
    dinner: new Set(),
  };

  const days: DayMeal[] = [];
  const baseSeed = (profile.age || 30) + (profile.weightKg || 70) + (profile.gender === "male" ? 100 : 200);

  for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
    const dayLabel = `Day ${dayIdx + 1}`;
    const rng = new SeededRandom(baseSeed + (dayIdx * 1000));
    const dayMeal: DayMeal = {
      dayLabel,
      breakfast: [],
      midMorningSnack: [],
      lunch: [],
      eveningSnack: [],
      dinner: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFats: 0,
    };

    const currentDaySlotNames: Record<MealSlot, Set<string>> = {
      breakfast: new Set(),
      midMorningSnack: new Set(),
      lunch: new Set(),
      eveningSnack: new Set(),
      dinner: new Set(),
    };

    for (const slot of slots) {
      const targetCals = Math.round(dailyTargetCalories * MEAL_SLOT_CALORIE_FRACTION[slot]);
      const selectedFoods = selectMealItems(slot, preferred, regular, rng, previousDaySlotNames[slot]);
      const mealItems = scaleMealItems(selectedFoods, targetCals);

      (dayMeal as any)[slot] = mealItems;
      for (const food of selectedFoods) {
        currentDaySlotNames[slot].add(food.name);
      }
    }

    // Calculate totals
    let tCal = 0, tProt = 0, tCarb = 0, tFat = 0;
    for (const slot of slots) {
      for (const item of (dayMeal as any)[slot]) {
        tCal += item.calories;
        tProt += item.protein;
        tCarb += item.carbs;
        tFat += item.fats;
      }
    }

    dayMeal.totalCalories = Math.round(tCal);
    dayMeal.totalProtein = Math.round(tProt * 10) / 10;
    dayMeal.totalCarbs = Math.round(tCarb * 10) / 10;
    dayMeal.totalFats = Math.round(tFat * 10) / 10;

    // Final enforcement: Total protein MUST match target ±5g
    const proteinTarget = profile.proteinGrams || 150;
    
    // First Pass: Adjust portions to hit protein target exactly (±0.1g)
    const currentProtein = slots.reduce((acc, s) => acc + (dayMeal as any)[s].reduce((si: any, ii: any) => si + ii.protein, 0), 0);
    const pScale = proteinTarget / (currentProtein || 1);
    
    for (const s of slots) {
      for (const item of (dayMeal as any)[s]) {
        const oldP = item.protein;
        item.protein = Math.round(item.protein * pScale * 10) / 10;
        // Adjust calories based on protein change (4 cals/g)
        item.calories = Math.round(item.calories + (item.protein - oldP) * 4);
        if (item.portion.includes("g")) {
          const grams = parseInt(item.portion);
          if (!isNaN(grams)) item.portion = `${Math.max(10, Math.round(grams * pScale))}g`;
        }
      }
    }

    // Second Pass: If calories now deviate >3%, adjust other macros but LOCK protein
    const currentCals = slots.reduce((acc, s) => acc + (dayMeal as any)[s].reduce((si: any, ii: any) => si + ii.calories, 0), 0);
    const calDeviation = Math.abs(currentCals - dailyTargetCalories) / dailyTargetCalories;
    
    if (calDeviation > 0.03) {
      const cScale = dailyTargetCalories / (currentCals || 1);
      for (const s of slots) {
        for (const item of (dayMeal as any)[s]) {
          item.calories = Math.round(item.calories * cScale);
          if (item.portion.includes("g")) {
            const grams = parseInt(item.portion);
            if (!isNaN(grams)) item.portion = `${Math.max(10, Math.round(grams * cScale))}g`;
          }
        }
      }
    }

    // Re-calculate Final Totals
    let finalCal = 0, finalProt = 0, finalCarb = 0, finalFat = 0;
    for (const slot of slots) {
      for (const item of (dayMeal as any)[slot]) {
        finalCal += item.calories;
        finalProt += item.protein;
        finalCarb += item.carbs;
        finalFat += item.fats;
      }
    }
    dayMeal.totalCalories = Math.round(finalCal);
    dayMeal.totalProtein = Math.round(finalProt * 10) / 10;
    dayMeal.totalCarbs = Math.round(finalCarb * 10) / 10;
    dayMeal.totalFats = Math.round(finalFat * 10) / 10;

    days.push(dayMeal);
    for (const slot of slots) {
      previousDaySlotNames[slot] = currentDaySlotNames[slot];
    }
  }

  return {
    days,
    dailyTargetCalories,
    macroTargets: {
      protein: profile.proteinGrams || 150,
      carbs: profile.carbsGrams || 200,
      fats: profile.fatsGrams || 65,
    },
    dietaryNotes: [
      `Plan generated specifically for ${profile.dietaryPreference} diet.`,
      `Portion sizes calibrated to ${dailyTargetCalories} kcal daily target.`
    ],
  };
}
