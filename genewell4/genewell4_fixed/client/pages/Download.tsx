import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getLanguage, setLanguage } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sparkles, CheckCircle, FileText, AlertCircle, Loader, ArrowLeft, RefreshCw } from "lucide-react";
import LegalFooter from "@/components/LegalFooter";
import { getProductByPlanId, getAddOnById, PlanConfiguration } from "@/lib/products";
import { generatePersonalizedPDFClient, downloadPDF, type PersonalizationData } from "@/lib/client-pdf-generator";
import { analyzeQuizData } from "@/lib/quiz-analysis";

type PageState = "language-select" | "generating" | "done" | "error" | "no-quiz";

export default function Download() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pageState, setPageState] = useState<PageState>("language-select");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi">(getLanguage());
  const [configuration, setConfiguration] = useState<PlanConfiguration | null>(null);

  const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");
  const analysisId = localStorage.getItem("analysisId");

  useEffect(() => {
    const stateConfig = (location.state?.configuration || location.state?.planId)
      ? {
          planId: location.state?.planId || location.state?.configuration?.planId,
          selectedAddOns: location.state?.addOns || location.state?.configuration?.selectedAddOns || [],
          totalPrice: location.state?.configuration?.totalPrice || 0,
        }
      : JSON.parse(localStorage.getItem("planConfiguration") || "null");

    if (!stateConfig && !analysisId) {
      setPageState("no-quiz");
      return;
    }

    if (stateConfig) {
      setConfiguration(stateConfig);
    } else if (analysisId) {
      const fallback: PlanConfiguration = { planId: "free_blueprint", selectedAddOns: [], totalPrice: 0 };
      setConfiguration(fallback);
      localStorage.setItem("planConfiguration", JSON.stringify(fallback));
    }
  }, []);

  const buildPDF = async (config: PlanConfiguration) => {
    setPageState("generating");
    setErrorMsg("");

    try {
      const freshAnalysisId = localStorage.getItem("analysisId");
      const savedQuizData = localStorage.getItem("quizData");

      if (!freshAnalysisId) throw new Error("Quiz not found. Please complete the quiz first.");
      if (!savedQuizData) throw new Error("Quiz data missing. Please complete the quiz first.");

      let parsed: any;
      try {
        parsed = JSON.parse(savedQuizData);
      } catch {
        throw new Error("Corrupted quiz data. Please retake the quiz.");
      }

      const analyzed = analyzeQuizData(parsed, parsed.userName, parsed.userEmail);

      const ap = analyzed.profile as any;
      const personalizationData: PersonalizationData = {
        profile: {
          ...(ap),
          name: (ap.name && ap.name.trim()) || "User",
          email: ap.email || "user@genewell.com",
          age: (typeof ap.age === "number" && ap.age > 0 && ap.age < 150) ? ap.age : 30,
          gender: ap.gender || "female",
          estimatedHeightCm: (ap.estimatedHeightCm > 0 && !isNaN(ap.estimatedHeightCm)) ? ap.estimatedHeightCm : (ap.gender === "male" ? 175 : 160),
          estimatedWeightKg: (ap.estimatedWeightKg > 0 && !isNaN(ap.estimatedWeightKg)) ? ap.estimatedWeightKg : (ap.gender === "male" ? 75 : 65),
          estimatedBMR: (ap.estimatedBMR > 0 && !isNaN(ap.estimatedBMR)) ? ap.estimatedBMR : 1500,
          estimatedTDEE: (ap.estimatedTDEE > 0 && !isNaN(ap.estimatedTDEE)) ? ap.estimatedTDEE : 2000,
          proteinGrams: (ap.proteinGrams > 0 && !isNaN(ap.proteinGrams)) ? ap.proteinGrams : 120,
          carbsGrams: (ap.carbsGrams > 0 && !isNaN(ap.carbsGrams)) ? ap.carbsGrams : 200,
          fatsGrams: (ap.fatsGrams > 0 && !isNaN(ap.fatsGrams)) ? ap.fatsGrams : 60,
          stressScore: !isNaN(ap.stressScore) ? ap.stressScore : 50,
          sleepScore: !isNaN(ap.sleepScore) ? ap.sleepScore : 60,
          activityScore: !isNaN(ap.activityScore) ? ap.activityScore : 50,
          energyScore: !isNaN(ap.energyScore) ? ap.energyScore : 60,
          medicalConditions: ap.medicalConditions || [],
          digestiveIssues: ap.digestiveIssues || [],
          foodIntolerances: ap.foodIntolerances || [],
          skinConcerns: ap.skinConcerns || [],
          dietaryPreference: ap.dietaryPreference || "non-veg",
          exercisePreference: ap.exercisePreference || ["walking"],
          workSchedule: ap.workSchedule || "9-to-5",
          region: ap.region || "India",
          recommendedTests: ap.recommendedTests || [],
          supplementPriority: ap.supplementPriority || [],
          exerciseIntensity: ap.exerciseIntensity || "moderate",
          mealFrequency: ap.mealFrequency || 3,
          dnaConsent: ap.dnaConsent || false,
        },
        insights: {
          metabolicInsight: analyzed.insights.metabolicInsight || "Your metabolic profile has been analyzed.",
          recommendedMealTimes: analyzed.insights.recommendedMealTimes || ["8:00 AM", "1:00 PM", "7:00 PM"],
          calorieRange: analyzed.insights.calorieRange || { min: 1600, max: 2200 },
          macroRatios: analyzed.insights.macroRatios || { protein: 30, carbs: 40, fats: 30 },
          supplementStack: (analyzed.insights.supplementStack || []).map((s: any) => ({
            name: s.name || "Supplement",
            reason: s.reason || "General wellness",
            dosage: s.dosage || "As directed",
          })),
          workoutStrategy: analyzed.insights.workoutStrategy || "30 minutes of moderate exercise daily.",
          sleepStrategy: analyzed.insights.sleepStrategy || "Aim for 7-8 hours of quality sleep.",
          stressStrategy: analyzed.insights.stressStrategy || "Practice mindfulness and breathing exercises.",
        },
      };

      const planTier = config.planId.replace("_blueprint", "");

      const pdfResult = await generatePersonalizedPDFClient(personalizationData, {
        tier: planTier as any,
        addOns: config.selectedAddOns || [],
        orderId: freshAnalysisId,
        timestamp: new Date().toISOString(),
        language: selectedLanguage,
      });

      downloadPDF(pdfResult.blob, pdfResult.filename);
      setPageState("done");

      fetch("/api/wellness/download-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: parsed.userEmail,
          userName: parsed.userName,
          productName: `GeneWell ${config.planId}`,
          planTier: config.planId,
          pdfRecordId: `pdf_${freshAnalysisId}`,
          analysisId: freshAnalysisId,
        }),
      }).catch(() => {});

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Download] PDF generation failed:", msg, err);
      setErrorMsg(msg);
      setPageState("error");
    }
  };

  if (pageState === "no-quiz") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Quiz Required</h1>
            <p className="text-slate-600 mb-6">Your wellness blueprint is personalized based on your quiz responses. Please complete the wellness quiz first.</p>
            <Button onClick={() => navigate("/quiz")} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">Take Wellness Quiz</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "generating") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <Loader className="h-14 w-14 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Building Your Blueprint...</h2>
          <p className="text-slate-600 text-sm mb-1">Generating your science-backed wellness plan</p>
          <p className="text-slate-400 text-xs">This takes 5–15 seconds. Please keep this page open.</p>
        </Card>
      </div>
    );
  }

  if (pageState === "done") {
    const plan = getProductByPlanId(configuration?.planId || "free_blueprint");
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
        <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-blue-900">Genewell</span>
            </Link>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Home
            </Button>
          </div>
        </header>
        <div className="flex-1 py-12 flex items-center justify-center px-4">
          <Card className="w-full max-w-lg text-center">
            <CardContent className="p-10">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Download Started!</h1>
              <p className="text-slate-600 mb-2">Your personalized wellness blueprint is downloading.</p>
              <p className="text-slate-500 text-sm mb-6">Check your downloads folder if it didn't open automatically.</p>
              {plan && <p className="text-sm text-blue-700 font-medium mb-6">{plan.name}</p>}
              <Button
                onClick={() => configuration && buildPDF(configuration)}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Download Again
              </Button>
            </CardContent>
          </Card>
        </div>
        <LegalFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
          <CardTitle className="text-2xl">Almost Ready!</CardTitle>
          <CardDescription>Choose your preferred PDF language before we generate your personalized blueprint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {pageState === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-semibold text-sm">PDF generation failed</p>
                  <p className="text-red-600 text-xs mt-1 break-words">{errorMsg}</p>
                  {errorMsg.toLowerCase().includes("blocked") && (
                    <p className="text-red-500 text-xs mt-2">
                      Tip: Check your quiz data is complete, or try retaking the quiz.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3 text-center">Select PDF Language / भाषा चुनें</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSelectedLanguage("en"); setLanguage("en"); localStorage.setItem("language", "en"); }}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selectedLanguage === "en" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300 bg-white"}`}
              >
                <span className="text-2xl mb-1">🇬🇧</span>
                <span className="font-semibold text-slate-900">English</span>
                <span className="text-xs text-slate-500 mt-1">Full report in English</span>
              </button>
              <button
                onClick={() => { setSelectedLanguage("hi"); setLanguage("hi"); localStorage.setItem("language", "hi"); }}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selectedLanguage === "hi" ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-orange-300 bg-white"}`}
              >
                <span className="text-2xl mb-1">🇮🇳</span>
                <span className="font-semibold text-slate-900">हिन्दी</span>
                <span className="text-xs text-slate-500 mt-1">पूरी रिपोर्ट हिंदी में</span>
              </button>
            </div>
          </div>

          <Button
            onClick={() => configuration && buildPDF(configuration)}
            disabled={!configuration}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white"
          >
            <FileText className="mr-2 h-5 w-5" />
            {pageState === "error"
              ? (selectedLanguage === "hi" ? "फिर से कोशिश करें" : "Try Again")
              : (selectedLanguage === "hi" ? "हिन्दी PDF बनाएं" : "Generate My PDF Blueprint")}
          </Button>

          <p className="text-xs text-slate-500 text-center">Takes 5–15 seconds to generate</p>

          {!configuration && (
            <p className="text-xs text-amber-600 text-center">
              Plan not found in session.{" "}
              <button className="underline" onClick={() => navigate("/pricing")}>Go back to plans</button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
