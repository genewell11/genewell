import { RequestHandler } from "express";
import {
  DNAUploadSchema,
  DNAProcessingResponse,
  AnalysisResultResponse,
  GeneticMarkers,
  PersonalizedRecommendations,
} from "../../shared/api";
import { users } from "./auth";

// In-memory storage for DNA processing results
const dnaAnalysisResults = new Map<
  string,
  {
    geneticMarkers: GeneticMarkers;
    recommendations: PersonalizedRecommendations;
    confidence: number;
    processingDate: string;
  }
>();

// Mock genetic analysis function (replace with real AI processing)
const analyzeGeneticData = (
  fileData: string,
  userId: string,
): {
  geneticMarkers: GeneticMarkers;
  recommendations: PersonalizedRecommendations;
  confidence: number;
} => {
  // Simulate analysis based on file content and user data
  const user = Array.from(users.values()).find((u) => u.id === userId);
  const age = user?.age || 30;
  const gender = user?.gender || "other";

  // Generate realistic mock results based on age/gender
  const metabolismType = age < 25 ? "fast" : age > 45 ? "slow" : "normal";
  const fitnessScore = gender === "male" ? 75 : 70;

  const geneticMarkers: GeneticMarkers = {
    metabolism: {
      type: metabolismType,
      score:
        Math.floor(Math.random() * 30) + (metabolismType === "fast" ? 70 : 50),
      genes: ["FTO", "MC4R", "ADRB2"],
    },
    foodSensitivities: {
      lactose: Math.random() > 0.7 ? "intolerant" : "tolerant",
      gluten: Math.random() > 0.9 ? "sensitive" : "tolerant",
      caffeine: Math.random() > 0.5 ? "fast" : "normal",
      alcohol: Math.random() > 0.6 ? "slow" : "normal",
    },
    vitaminDeficiencies: {
      vitaminD: Math.random() > 0.6 ? "moderate_risk" : "low_risk",
      vitaminB12: Math.random() > 0.8 ? "moderate_risk" : "low_risk",
      folate: Math.random() > 0.9 ? "high_risk" : "low_risk",
      iron: gender === "female" ? "moderate_risk" : "low_risk",
    },
    fitnessResponse: {
      cardioResponse: fitnessScore > 70 ? "excellent" : "good",
      strengthResponse: fitnessScore > 65 ? "good" : "average",
      recoverySpeed: age < 30 ? "fast" : "normal",
      injuryRisk: age > 40 ? "moderate" : "low",
    },
    weightManagement: {
      fatLossResponse: metabolismType === "fast" ? "excellent" : "good",
      muscleGainPotential: gender === "male" ? "excellent" : "good",
      appetiteControl: Math.random() > 0.5 ? "good" : "average",
    },
  };

  const recommendations: PersonalizedRecommendations = {
    nutrition: {
      macroRatio: {
        protein: metabolismType === "fast" ? 30 : 25,
        carbs: metabolismType === "slow" ? 35 : 45,
        fats: 25,
      },
      recommendedFoods: [
        "Lean proteins (chicken, fish, tofu)",
        "Complex carbohydrates (quinoa, sweet potato)",
        "Healthy fats (avocado, nuts, olive oil)",
        "Leafy greens (spinach, kale)",
        "Berries (blueberries, strawberries)",
      ],
      avoidFoods:
        geneticMarkers.foodSensitivities.lactose === "intolerant"
          ? ["Dairy products", "Processed foods", "Refined sugars"]
          : ["Processed foods", "Refined sugars", "Trans fats"],
      mealTiming: [
        "Eat within 1 hour of waking",
        "Have protein with every meal",
        "Stop eating 3 hours before bed",
      ],
      hydration: "Drink 8-10 glasses of water daily, more if active",
    },
    fitness: {
      workoutType:
        fitnessScore > 70
          ? ["HIIT", "Strength training", "Cardio"]
          : ["Walking", "Light weights", "Yoga"],
      intensity: age < 30 ? "high" : "moderate",
      frequency: age < 25 ? 5 : 4,
      duration: 45,
      restDays: 2,
    },
    lifestyle: {
      sleepRecommendations: "7-9 hours of quality sleep, consistent bedtime",
      stressManagement: [
        "Daily meditation (10-15 minutes)",
        "Deep breathing exercises",
        "Regular outdoor time",
      ],
      supplementSuggestions: [
        geneticMarkers.vitaminDeficiencies.vitaminD !== "low_risk"
          ? "Vitamin D3"
          : "",
        "Omega-3 fatty acids",
        "Magnesium for sleep",
        "Probiotics for gut health",
      ].filter(Boolean),
      habitChanges: [
        "Establish a morning routine",
        "Limit screen time before bed",
        "Practice mindful eating",
      ],
    },
    personalizedTips: [
      `Based on your ${metabolismType} metabolism, focus on ${metabolismType === "fast" ? "frequent small meals" : "portion control"}`,
      `Your ${geneticMarkers.fitnessResponse.cardioResponse} cardio response suggests ${fitnessScore > 70 ? "high-intensity workouts" : "steady-state cardio"}`,
      age > 35
        ? "Prioritize recovery and joint health"
        : "Take advantage of your quick recovery",
    ],
  };

  return {
    geneticMarkers,
    recommendations,
    confidence: Math.floor(Math.random() * 20) + 80, // 80-100% confidence
  };
};

export const handleDNAUpload: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const validatedData = DNAUploadSchema.parse(req.body);
    const {
      fileName,
      fileSize,
      provider,
      processingConsent,
      deleteAfterProcessing,
    } = validatedData;

    if (!processingConsent) {
      return res.status(400).json({
        success: false,
        message: "Processing consent is required",
      });
    }

    // Generate processing ID
    const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate processing time based on file size
    const estimatedTime = Math.max(30, Math.floor(fileSize / 1000)); // seconds

    const response: DNAProcessingResponse = {
      success: true,
      processingId,
      estimatedTime,
      message: "DNA file uploaded successfully. Analysis in progress...",
    };

    // Simulate background processing
    setTimeout(() => {
      // In real implementation, this would process the actual DNA file
      console.log(`Processing DNA file: ${fileName} from ${provider}`);
      console.log(`Delete after processing: ${deleteAfterProcessing}`);
    }, 1000);

    res.status(200).json(response);
  } catch (error) {
    console.error("DNA upload error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid upload data",
    });
  }
};

export const handleGetAnalysisResults: RequestHandler = async (req, res) => {
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

    // Check if analysis exists, if not generate it
    if (!dnaAnalysisResults.has(userKey)) {
      // Generate analysis results
      const analysisResult = analyzeGeneticData("mock_dna_data", userKey);
      dnaAnalysisResults.set(userKey, {
        ...analysisResult,
        processingDate: new Date().toISOString(),
      });

      // Update user's DNA upload status
      const user = users.get(userKey);
      if (user) {
        user.hasUploadedDNA = true;
        users.set(userKey, user);
      }
    }

    const result = dnaAnalysisResults.get(userKey)!;

    const response: AnalysisResultResponse = {
      success: true,
      geneticMarkers: result.geneticMarkers,
      recommendations: result.recommendations,
      confidence: result.confidence,
      reportUrl: `/api/reports/download/${userKey}`,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Analysis results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis results",
    });
  }
};

export const handleGenerateReport: RequestHandler = async (req, res) => {
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

    const user = users.get(userKey);
    const analysis = dnaAnalysisResults.get(userKey);

    if (!user || !analysis) {
      return res.status(404).json({
        success: false,
        message: "No analysis data found",
      });
    }

    // Mock PDF generation (in production, use a library like puppeteer or jsPDF)
    const reportContent = {
      title: "Personalized Wellness Report",
      userName: user.name,
      generatedDate: new Date().toISOString(),
      geneticMarkers: analysis.geneticMarkers,
      recommendations: analysis.recommendations,
      confidence: analysis.confidence,
    };

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wellness-report-${user.name}.json"`,
    );

    res.status(200).json({
      success: true,
      report: reportContent,
      message: "Report generated successfully",
    });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
};

// Export for use in other modules
export { dnaAnalysisResults };
