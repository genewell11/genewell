import { RequestHandler } from "express";
import {
  LifestyleQuizSchema,
  LifestyleQuiz,
  PersonalizedRecommendations,
} from "../../shared/api";
import { users } from "./auth";

// In-memory storage for quiz responses
const quizResponses = new Map<string, LifestyleQuiz>();

// Generate enhanced recommendations based on quiz responses
const generateQuizBasedRecommendations = (
  quiz: LifestyleQuiz,
  userId: string,
): PersonalizedRecommendations => {
  const user = Array.from(users.values()).find((u) => u.id === userId);
  const age = user?.age || 30;
  const gender = user?.gender || "other";

  // Adjust recommendations based on quiz responses
  const proteinMultiplier = quiz.goals.includes("muscle_gain") ? 1.5 : 1.0;
  const baseProtein = gender === "male" ? 25 : 20;

  const recommendations: PersonalizedRecommendations = {
    nutrition: {
      macroRatio: {
        protein: Math.floor(baseProtein * proteinMultiplier),
        carbs: quiz.goals.includes("weight_loss") ? 30 : 45,
        fats: quiz.goals.includes("weight_loss") ? 35 : 25,
      },
      recommendedFoods: [
        ...(quiz.goals.includes("muscle_gain")
          ? ["Greek yogurt", "Lean beef", "Eggs", "Protein smoothies"]
          : []),
        ...(quiz.goals.includes("weight_loss")
          ? ["Leafy greens", "Lean proteins", "Fiber-rich foods"]
          : []),
        ...(quiz.goals.includes("energy_boost")
          ? ["Complex carbs", "Iron-rich foods", "B-vitamin sources"]
          : []),
        "Whole grains",
        "Fresh fruits",
        "Vegetables",
        "Nuts and seeds",
      ],
      avoidFoods: [
        ...(quiz.goals.includes("weight_loss")
          ? ["Processed snacks", "Sugary drinks", "Fried foods"]
          : []),
        ...(quiz.dietaryRestrictions.includes("gluten")
          ? ["Wheat products", "Barley", "Rye"]
          : []),
        ...(quiz.dietaryRestrictions.includes("dairy")
          ? ["Milk products", "Cheese", "Butter"]
          : []),
        "Trans fats",
        "Excessive sugar",
      ],
      mealTiming: [
        quiz.activityLevel === "very_active" ||
        quiz.activityLevel === "extremely_active"
          ? "Eat within 30 minutes post-workout"
          : "Eat within 1 hour of waking",
        quiz.goals.includes("muscle_gain")
          ? "Consume protein every 3-4 hours"
          : "Space meals 4-5 hours apart",
        `Stop eating ${quiz.sleepHours < 7 ? "2" : "3"} hours before bed`,
      ],
      hydration: `Drink ${quiz.activityLevel === "very_active" || quiz.activityLevel === "extremely_active" ? "12-14" : "8-10"} glasses of water daily`,
    },
    fitness: {
      workoutType: quiz.exercisePreference.includes("none")
        ? ["Walking", "Light stretching"]
        : quiz.exercisePreference.length > 0
          ? quiz.exercisePreference.map((pref) => {
              switch (pref) {
                case "cardio":
                  return "Cardiovascular exercise";
                case "strength":
                  return "Strength training";
                case "yoga":
                  return "Yoga and flexibility";
                case "sports":
                  return "Sports activities";
                case "walking":
                  return "Walking and hiking";
                default:
                  return pref;
              }
            })
          : ["Mixed training", "Bodyweight exercises"],
      intensity:
        quiz.activityLevel === "extremely_active"
          ? "high"
          : quiz.activityLevel === "very_active"
            ? "high"
            : quiz.activityLevel === "moderately_active"
              ? "moderate"
              : "low",
      frequency:
        quiz.activityLevel === "extremely_active"
          ? 6
          : quiz.activityLevel === "very_active"
            ? 5
            : quiz.activityLevel === "moderately_active"
              ? 4
              : quiz.activityLevel === "lightly_active"
                ? 3
                : 2,
      duration:
        quiz.activityLevel === "extremely_active"
          ? 60
          : quiz.activityLevel === "very_active"
            ? 50
            : quiz.activityLevel === "moderately_active"
              ? 40
              : 30,
      restDays:
        quiz.activityLevel === "extremely_active" ||
        quiz.activityLevel === "very_active"
          ? 1
          : 2,
    },
    lifestyle: {
      sleepRecommendations:
        quiz.sleepHours < 7
          ? "Increase sleep to 7-9 hours. Establish a bedtime routine."
          : quiz.sleepHours > 9
            ? "Maintain consistent sleep schedule. Consider sleep quality."
            : "Maintain your good sleep habits of 7-9 hours.",
      stressManagement:
        quiz.stressLevel === "high"
          ? [
              "Daily meditation (15-20 minutes)",
              "Deep breathing exercises",
              "Progressive muscle relaxation",
              "Consider professional stress counseling",
            ]
          : quiz.stressLevel === "moderate"
            ? [
                "Regular meditation (10-15 minutes)",
                "Yoga or tai chi",
                "Nature walks",
                "Journaling",
              ]
            : [
                "Continue current stress management",
                "Light meditation (5-10 minutes)",
                "Regular outdoor time",
              ],
      supplementSuggestions: [
        ...(quiz.goals.includes("muscle_gain")
          ? ["Protein powder", "Creatine"]
          : []),
        ...(quiz.goals.includes("energy_boost")
          ? ["B-Complex vitamins", "Iron (if deficient)"]
          : []),
        ...(quiz.stressLevel === "high" ? ["Magnesium", "Ashwagandha"] : []),
        ...(quiz.sleepHours < 7 ? ["Melatonin", "Magnesium"] : []),
        "Vitamin D3",
        "Omega-3 fatty acids",
        "Multivitamin",
      ],
      habitChanges: [
        ...(quiz.sleepHours < 7
          ? ["Establish consistent bedtime", "Limit evening screen time"]
          : []),
        ...(quiz.stressLevel === "high"
          ? ["Practice stress-reduction techniques", "Limit caffeine intake"]
          : []),
        ...(quiz.activityLevel === "sedentary"
          ? ["Take regular walking breaks", "Use standing desk if possible"]
          : []),
        "Meal prep on weekends",
        "Stay hydrated throughout the day",
        "Practice mindful eating",
      ],
    },
    personalizedTips: [
      quiz.goals.includes("weight_loss")
        ? "Focus on creating a moderate caloric deficit through diet and exercise"
        : quiz.goals.includes("weight_gain")
          ? "Increase caloric intake with nutrient-dense foods"
          : "Maintain balanced nutrition for your activity level",
      quiz.budgetRange === "budget"
        ? "Focus on affordable protein sources like eggs, beans, and seasonal vegetables"
        : quiz.budgetRange === "premium"
          ? "Consider organic options, specialty supplements, and premium protein sources"
          : "Balance quality and cost with frozen vegetables, bulk grains, and lean proteins",
      age < 25
        ? "Take advantage of your high metabolism and recovery capacity"
        : age > 40
          ? "Focus on joint health, flexibility, and injury prevention"
          : "Maintain consistent habits for long-term health",
      quiz.healthConditions.length > 0
        ? "Consult healthcare providers before making significant changes"
        : "You're in a great position to optimize your health",
    ],
  };

  return recommendations;
};

export const handleSubmitQuiz: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);
    const userId = token.split("_")[2];
    const userKey = Array.from(users.keys()).find((key) =>
      key.includes(userId),
    );

    if (!userKey) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const validatedQuiz = LifestyleQuizSchema.parse(req.body);

    // Store quiz responses
    quizResponses.set(userKey, validatedQuiz);

    // Generate personalized recommendations
    const recommendations = generateQuizBasedRecommendations(
      validatedQuiz,
      userKey,
    );

    res.status(200).json({
      success: true,
      message: "Quiz submitted successfully",
      recommendations,
      nextSteps: {
        uploadDNA: !users.get(userKey)?.hasUploadedDNA,
        generateReport: true,
        trackProgress: true,
      },
    });
  } catch (error) {
    console.error("Quiz submission error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid quiz data",
    });
  }
};

export const handleGetQuizResults: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);
    const userId = token.split("_")[2];
    const userKey = Array.from(users.keys()).find((key) =>
      key.includes(userId),
    );

    if (!userKey) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const quizData = quizResponses.get(userKey);

    if (!quizData) {
      return res.status(404).json({
        success: false,
        message: "No quiz data found",
      });
    }

    const recommendations = generateQuizBasedRecommendations(quizData, userKey);

    res.status(200).json({
      success: true,
      quiz: quizData,
      recommendations,
    });
  } catch (error) {
    console.error("Quiz results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quiz results",
    });
  }
};

// Export for use in other modules
export { quizResponses };
