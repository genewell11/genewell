import type { AddOn } from "./products";

// Gender-based addon filtering rules (mirrors shared/addon_rules.json)
const GENDER_HIDE: Record<string, string[]> = {
  male: ["addon_women_hormone", "addon_women_hormonal"],
  female: ["addon_men_fitness"],
  other: [],
  "non-binary": [],
};

// Addons that are MALE-ONLY (shown for male, other, non-binary only)
const MALE_ONLY_ADDONS = new Set(["addon_men_fitness"]);
// Addons that are FEMALE-ONLY (shown for female, other, non-binary only)
const FEMALE_ONLY_ADDONS = new Set(["addon_women_hormone", "addon_women_hormonal"]);

/**
 * Filters the addon list based on the user's gender.
 * Returns only addons applicable for the given gender.
 */
export function filterAddonsByGender(addOns: AddOn[], gender: string | null | undefined): AddOn[] {
  if (!gender) return addOns; // No gender stored yet → show all (quiz not completed)

  const g = gender.toLowerCase().trim();
  const hiddenIds = GENDER_HIDE[g] ?? [];

  return addOns.filter(addon => !hiddenIds.includes(addon.id));
}

/**
 * Validates a set of selected addon IDs against a gender.
 * Returns { valid: boolean, rejectedAddons: string[], message: string }
 */
export function validateAddonGenderMatch(
  selectedAddonIds: string[],
  gender: string | null | undefined
): { valid: boolean; rejectedAddons: string[]; message: string } {
  if (!gender) return { valid: true, rejectedAddons: [], message: "" };

  const g = gender.toLowerCase().trim();
  const hiddenIds = GENDER_HIDE[g] ?? [];
  const rejectedAddons = selectedAddonIds.filter(id => hiddenIds.includes(id));

  if (rejectedAddons.length === 0) {
    return { valid: true, rejectedAddons: [], message: "" };
  }

  const isMale = g === "male";
  const isFemale = g === "female";

  let message = "";
  if (isMale && rejectedAddons.some(id => FEMALE_ONLY_ADDONS.has(id))) {
    message = "Women's Hormonal Health add-on is not applicable for male profiles and has been removed.";
  } else if (isFemale && rejectedAddons.some(id => MALE_ONLY_ADDONS.has(id))) {
    message = "Men's Performance Pack is not applicable for female profiles and has been removed.";
  } else {
    message = `The following add-ons are not compatible with your profile and have been removed: ${rejectedAddons.join(", ")}`;
  }

  return { valid: false, rejectedAddons, message };
}

/**
 * Removes gender-incompatible addons from the selected list.
 * Returns the cleaned list of addon IDs.
 */
export function removeIncompatibleAddons(
  selectedAddonIds: string[],
  gender: string | null | undefined
): string[] {
  if (!gender) return selectedAddonIds;
  const g = gender.toLowerCase().trim();
  const hiddenIds = GENDER_HIDE[g] ?? [];
  return selectedAddonIds.filter(id => !hiddenIds.includes(id));
}

/**
 * Get the gender stored in localStorage from quiz data.
 * Returns null if not found.
 */
export function getStoredGender(): string | null {
  try {
    const quizData = JSON.parse(localStorage.getItem("quizData") || "null");
    return quizData?.gender ?? null;
  } catch {
    return null;
  }
}
