import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  Brain,
  Heart,
  Clock,
  Zap,
  ArrowLeft,
} from "lucide-react";
import LegalFooter from "@/components/LegalFooter";

export default function QuizResults() {
  const navigate = useNavigate();
  const [quizData, setQuizData] = useState<any>(null);
  const [blueprint, setBlueprint] = useState<any>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    const savedQuizData = localStorage.getItem("quizData");
    const savedAnalysisId = localStorage.getItem("analysisId");
    const savedBlueprint = localStorage.getItem("blueprint");

    if (!savedQuizData || !savedAnalysisId || !savedBlueprint) {
      navigate("/quiz");
      return;
    }

    setQuizData(JSON.parse(savedQuizData));
    setBlueprint(JSON.parse(savedBlueprint));
    setAnalysisComplete(true);
    // B2B: auto-navigate to checkout with premium tier
    if (localStorage.getItem("b2bReportTier") === "premium") {
      const cfg = { planId: "premium_blueprint", selectedAddOns: [], totalPrice: 0, b2b: true };
      localStorage.setItem("planConfiguration", JSON.stringify(cfg));
    }
  }, [navigate]);

  const handleContinueToPricing = () => {
    navigate("/pricing");
  };

  if (!quizData || !analysisComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-16 w-16 text-purple-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900">Preparing your results...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Genewell
                </span>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <Badge className="bg-green-100 text-green-700">
                ✅ Analysis Complete
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Sparkles className="mr-2 h-4 w-4" /> HOME
              </Button>
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            🎉 Your Wellness Blueprint is Ready!
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Based on your responses, we've created a personalized analysis perfect for your goals and lifestyle
          </p>
        </div>

        {/* Key Insights Preview */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="border-2 border-purple-200 bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Your Type</h3>
              <p className="text-sm text-gray-600">
                {blueprint?.metabolismType?.type
                  ? `${blueprint.metabolismType.type[0].toUpperCase()}${blueprint.metabolismType.type.slice(1)} Metabolism`
                  : "Metabolism"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-pink-200 bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Heart className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Best Foods</h3>
              <p className="text-sm text-gray-600">
                {blueprint?.nutritionPlan?.bestFoods?.slice(0, 1)?.[0] || "Personalized foods"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Meal Timing</h3>
              <p className="text-sm text-gray-600">
                {blueprint?.nutritionPlan?.mealTiming?.breakfast
                  ? `Breakfast ${blueprint.nutritionPlan.mealTiming.breakfast}`
                  : "Optimized timing"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-emerald-200 bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Exercise</h3>
              <p className="text-sm text-gray-600">
                {blueprint?.fitnessRoutine?.workoutType?.[0] || "Personalized routine"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Next Steps Card */}
        <Card className="max-w-2xl mx-auto border-2 border-purple-200 shadow-xl mb-12">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              What Comes Next?
            </CardTitle>
            <CardDescription>
              Choose your plan to unlock your personalized wellness blueprint
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0 bg-purple-600 text-white">1</Badge>
                <div>
                  <h4 className="font-semibold text-gray-900">Select Your Plan</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose from Free, Essential, Premium, or Complete Coaching. Each unlocks progressively more detailed guidance.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0 bg-purple-600 text-white">2</Badge>
                <div>
                  <h4 className="font-semibold text-gray-900">Optional Add-Ons</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Enhance with DNA Analysis, Supplement Stack, Athletic Performance, or other specialized modules.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Badge className="mt-1 flex-shrink-0 bg-purple-600 text-white">3</Badge>
                <div>
                  <h4 className="font-semibold text-gray-900">Download Your Blueprint</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Get your personalized PDF with your name, profile data, and actionable recommendations.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <p className="text-sm text-gray-700">
                <strong>💡 Tip:</strong> Your quiz data carries forward to any plan. You can always upgrade later without repeating the quiz.
              </p>
            </div>

            <Button
              onClick={handleContinueToPricing}
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-semibold py-6 text-lg"
            >
              Choose Your Plan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <Card className="max-w-4xl mx-auto border-2 border-gray-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Plan Overview</CardTitle>
            <CardDescription>All plans include your personalized analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-3 px-2 font-semibold text-gray-900">Plan</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-900">Price</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-900">Pages</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-900">Focus</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-2 font-semibold text-gray-900">Basic Plan</td>
                    <td className="py-3 px-2 text-center text-gray-600">Free</td>
                    <td className="py-3 px-2 text-center text-gray-600">10–12</td>
                    <td className="py-3 px-2 text-gray-600">Sleep, stress, basics</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-2 font-semibold text-gray-900">Personalized Pro</td>
                    <td className="py-3 px-2 text-center text-gray-600">₹499</td>
                    <td className="py-3 px-2 text-center text-gray-600">12–16</td>
                    <td className="py-3 px-2 text-gray-600">Meal timing, workouts</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50 bg-purple-50">
                    <td className="py-3 px-2 font-semibold text-gray-900">Personalized Pro+</td>
                    <td className="py-3 px-2 text-center text-gray-600">₹999</td>
                    <td className="py-3 px-2 text-center text-gray-600">16–22</td>
                    <td className="py-3 px-2 text-gray-600">Meal plan, supplements, training</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-2 font-semibold text-gray-900">Done-With-You System</td>
                    <td className="py-3 px-2 text-center text-gray-600">₹2,999</td>
                    <td className="py-3 px-2 text-center text-gray-600">20–28</td>
                    <td className="py-3 px-2 text-gray-600">Coaching + habit science</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <LegalFooter />
    </div>
  );
}
