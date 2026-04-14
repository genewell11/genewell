import { RequestHandler } from "express";
import { UserDashboardResponse } from "../../shared/api";
import { users } from "./auth";
import { dnaAnalysisResults } from "./dna";
import { quizResponses } from "./quiz";

export const handleGetDashboard: RequestHandler = async (req, res) => {
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
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove password from user object
    const { password: _, ...userResponse } = user;

    // Get analysis results if available
    const analysisResult = dnaAnalysisResults.get(userKey);
    const quizResult = quizResponses.get(userKey);

    const response: UserDashboardResponse = {
      success: true,
      user: userResponse,
      hasAnalysis: !!analysisResult,
      geneticMarkers: analysisResult?.geneticMarkers,
      recommendations: analysisResult?.recommendations,
      reportUrl: analysisResult
        ? `/api/reports/download/${userKey}`
        : undefined,
      lastUpdated: analysisResult?.processingDate,
    };

    // Add additional dashboard data
    const dashboardData = {
      ...response,
      hasCompletedQuiz: !!quizResult,
      analysisProgress: {
        quizCompleted: !!quizResult,
        dnaUploaded: user.hasUploadedDNA,
        analysisComplete: !!analysisResult,
        reportGenerated: !!analysisResult,
      },
      insights: analysisResult
        ? {
            metabolismType: analysisResult.geneticMarkers.metabolism.type,
            fitnessResponse:
              analysisResult.geneticMarkers.fitnessResponse.cardioResponse,
            primaryGoal: quizResult?.goals[0] || "general_health",
            riskFactors: [
              ...(analysisResult.geneticMarkers.vitaminDeficiencies.vitaminD !==
              "low_risk"
                ? ["Vitamin D deficiency"]
                : []),
              ...(analysisResult.geneticMarkers.foodSensitivities.lactose ===
              "intolerant"
                ? ["Lactose intolerance"]
                : []),
              ...(analysisResult.geneticMarkers.fitnessResponse.injuryRisk !==
              "low"
                ? ["Elevated injury risk"]
                : []),
            ],
          }
        : undefined,
      nextSteps: [
        ...(!quizResult ? ["Complete your lifestyle assessment"] : []),
        ...(!user.hasUploadedDNA ? ["Upload your DNA data"] : []),
        ...(!analysisResult && user.hasUploadedDNA
          ? ["Analysis in progress..."]
          : []),
        ...(analysisResult && quizResult
          ? [
              "Download your personalized report",
              "Start following your recommendations",
              "Track your progress",
            ]
          : []),
      ],
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

export const handleGetProgressStats: RequestHandler = async (req, res) => {
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
    const analysisResult = dnaAnalysisResults.get(userKey);
    const quizResult = quizResponses.get(userKey);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate progress statistics
    const progressStats = {
      completionPercentage: Math.floor(
        ((Number(!!quizResult) +
          Number(user.hasUploadedDNA) +
          Number(!!analysisResult)) /
          3) *
          100,
      ),
      daysActive: Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
      featuresUnlocked: [
        ...(quizResult ? ["Lifestyle Assessment"] : []),
        ...(user.hasUploadedDNA ? ["DNA Analysis"] : []),
        ...(analysisResult ? ["Personalized Reports"] : []),
      ],
      recommendationsFollowed: analysisResult
        ? Math.floor(Math.random() * 80) + 20 // Mock progress data
        : 0,
      healthScore: analysisResult
        ? Math.floor(
            (analysisResult.geneticMarkers.metabolism.score +
              (analysisResult.geneticMarkers.fitnessResponse.cardioResponse ===
              "excellent"
                ? 90
                : 70) +
              (analysisResult.geneticMarkers.weightManagement
                .fatLossResponse === "excellent"
                ? 85
                : 65)) /
              3,
          )
        : null,
      improvements: analysisResult
        ? [
            "Metabolism optimization identified",
            "Personalized nutrition plan created",
            "Exercise routine customized",
            ...(quizResult?.stressLevel === "high"
              ? ["Stress management strategies provided"]
              : []),
          ]
        : [],
    };

    res.status(200).json({
      success: true,
      stats: progressStats,
    });
  } catch (error) {
    console.error("Progress stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch progress statistics",
    });
  }
};
