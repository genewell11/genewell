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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import {
  Dna,
  User,
  BarChart3,
  Download,
  Plus,
  TrendingUp,
  Heart,
  Brain,
  Zap,
  Shield,
  FileText,
  Calendar,
  Bell,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
} from "lucide-react";
import {
  UserDashboardResponse,
  GeneticMarkers,
  PersonalizedRecommendations,
  User as UserType,
} from "@shared/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [geneticMarkers, setGeneticMarkers] = useState<GeneticMarkers | null>(
    null,
  );
  const [recommendations, setRecommendations] =
    useState<PersonalizedRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetchDashboardData();
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setDashboardData(data);
        setGeneticMarkers(data.geneticMarkers);
        setRecommendations(data.recommendations);
      } else {
        setError("Failed to load dashboard data");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const downloadReport = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/dna/report", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Create and download the report
        const reportData = JSON.stringify(data.report, null, 2);
        const blob = new Blob([reportData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wellness-report-${user?.name || "user"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError("Failed to download report");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-wellness-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-wellness-gradient rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Dna className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-wellness-900 mb-2">
            Loading your wellness insights...
          </h2>
          <p className="text-foreground/70">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wellness-50 flex items-center justify-center">
        <Card className="max-w-md border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex space-x-2">
              <Button onClick={fetchDashboardData} className="flex-1">
                Try Again
              </Button>
              <Link to="/">
                <Button variant="outline">Go Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wellness-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-wellness-gradient rounded-lg">
                <Dna className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-wellness-900">
                GeneWell
              </span>
            </Link>

            <div className="flex items-center space-x-4">
              <Badge
                variant="outline"
                className="border-wellness-200 text-wellness-700"
              >
                {user?.subscription?.toUpperCase()}
              </Badge>
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-wellness-900">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-foreground/70 mt-1">
                Your personalized wellness insights are ready
              </p>
            </div>
            <div className="flex space-x-3">
              {geneticMarkers && (
                <Button
                  onClick={downloadReport}
                  className="bg-wellness-gradient"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              )}
              <Link to="/upload">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload New Data
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        {dashboardData?.analysisProgress && (
          <Card className="mb-8 border-wellness-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-wellness-600" />
                <span>Your Wellness Journey</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      dashboardData.analysisProgress.quizCompleted
                        ? "bg-wellness-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <User className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-wellness-900">
                    Lifestyle Assessment
                  </h3>
                  <p className="text-sm text-foreground/70">
                    {dashboardData.analysisProgress.quizCompleted
                      ? "Completed"
                      : "Pending"}
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      dashboardData.analysisProgress.dnaUploaded
                        ? "bg-wellness-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <Dna className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-wellness-900">DNA Upload</h3>
                  <p className="text-sm text-foreground/70">
                    {dashboardData.analysisProgress.dnaUploaded
                      ? "Uploaded"
                      : "Pending"}
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      dashboardData.analysisProgress.analysisComplete
                        ? "bg-wellness-600 text-white"
                        : dashboardData.analysisProgress.dnaUploaded
                          ? "bg-yellow-500 text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <Brain className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-wellness-900">AI Analysis</h3>
                  <p className="text-sm text-foreground/70">
                    {dashboardData.analysisProgress.analysisComplete
                      ? "Complete"
                      : dashboardData.analysisProgress.dnaUploaded
                        ? "Processing"
                        : "Pending"}
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                      dashboardData.analysisProgress.reportGenerated
                        ? "bg-wellness-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-wellness-900">
                    Personal Report
                  </h3>
                  <p className="text-sm text-foreground/70">
                    {dashboardData.analysisProgress.reportGenerated
                      ? "Ready"
                      : "Pending"}
                  </p>
                </div>
              </div>

              {!dashboardData.analysisProgress.quizCompleted && (
                <div className="mt-6 text-center">
                  <Link to="/quiz">
                    <Button className="bg-wellness-gradient">
                      Complete Lifestyle Assessment
                    </Button>
                  </Link>
                </div>
              )}

              {!dashboardData.analysisProgress.dnaUploaded && (
                <div className="mt-6 text-center">
                  <Link to="/upload">
                    <Button className="bg-wellness-gradient">
                      Upload Your DNA Data
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {geneticMarkers && recommendations ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
              <TabsTrigger value="fitness">Fitness</TabsTrigger>
              <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Health Score */}
              <Card className="border-wellness-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-wellness-600" />
                    <span>Your Wellness Score</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-wellness-600 mb-2">
                      {geneticMarkers.metabolism.score}/100
                    </div>
                    <p className="text-foreground/70 mb-4">
                      Based on your genetic profile and lifestyle factors
                    </p>
                    <Progress
                      value={geneticMarkers.metabolism.score}
                      className="h-3"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Key Insights */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-wellness-600" />
                      <span>Metabolism</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-wellness-900 mb-2">
                      {geneticMarkers.metabolism.type.charAt(0).toUpperCase() +
                        geneticMarkers.metabolism.type.slice(1)}
                    </div>
                    <p className="text-sm text-foreground/70">
                      Your genetic predisposition indicates a{" "}
                      {geneticMarkers.metabolism.type} metabolic rate
                    </p>
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className="border-wellness-200 text-wellness-700"
                      >
                        Score: {geneticMarkers.metabolism.score}/100
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Heart className="h-5 w-5 text-wellness-600" />
                      <span>Fitness Response</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-wellness-900 mb-2">
                      {geneticMarkers.fitnessResponse.cardioResponse
                        .charAt(0)
                        .toUpperCase() +
                        geneticMarkers.fitnessResponse.cardioResponse.slice(1)}
                    </div>
                    <p className="text-sm text-foreground/70">
                      Your cardiovascular exercise response potential
                    </p>
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className="border-wellness-200 text-wellness-700"
                      >
                        Recovery: {geneticMarkers.fitnessResponse.recoverySpeed}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-wellness-600" />
                      <span>Weight Management</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-wellness-900 mb-2">
                      {geneticMarkers.weightManagement.fatLossResponse
                        .charAt(0)
                        .toUpperCase() +
                        geneticMarkers.weightManagement.fatLossResponse.slice(
                          1,
                        )}
                    </div>
                    <p className="text-sm text-foreground/70">
                      Your genetic fat loss response potential
                    </p>
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className="border-wellness-200 text-wellness-700"
                      >
                        Muscle Gain:{" "}
                        {geneticMarkers.weightManagement.muscleGainPotential}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Food Sensitivities */}
              <Card className="border-wellness-200">
                <CardHeader>
                  <CardTitle>Food Sensitivities & Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-wellness-50 rounded-lg">
                      <h4 className="font-medium text-wellness-900 mb-1">
                        Lactose
                      </h4>
                      <Badge
                        variant={
                          geneticMarkers.foodSensitivities.lactose ===
                          "intolerant"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {geneticMarkers.foodSensitivities.lactose}
                      </Badge>
                    </div>
                    <div className="text-center p-4 bg-wellness-50 rounded-lg">
                      <h4 className="font-medium text-wellness-900 mb-1">
                        Gluten
                      </h4>
                      <Badge
                        variant={
                          geneticMarkers.foodSensitivities.gluten ===
                          "sensitive"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {geneticMarkers.foodSensitivities.gluten}
                      </Badge>
                    </div>
                    <div className="text-center p-4 bg-wellness-50 rounded-lg">
                      <h4 className="font-medium text-wellness-900 mb-1">
                        Caffeine
                      </h4>
                      <Badge variant="secondary">
                        {geneticMarkers.foodSensitivities.caffeine} metabolism
                      </Badge>
                    </div>
                    <div className="text-center p-4 bg-wellness-50 rounded-lg">
                      <h4 className="font-medium text-wellness-900 mb-1">
                        Alcohol
                      </h4>
                      <Badge variant="secondary">
                        {geneticMarkers.foodSensitivities.alcohol} metabolism
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nutrition" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Optimal Macro Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Protein</span>
                        <span className="font-semibold">
                          {recommendations.nutrition.macroRatio.protein}%
                        </span>
                      </div>
                      <Progress
                        value={recommendations.nutrition.macroRatio.protein}
                        className="h-2"
                      />

                      <div className="flex justify-between items-center">
                        <span>Carbohydrates</span>
                        <span className="font-semibold">
                          {recommendations.nutrition.macroRatio.carbs}%
                        </span>
                      </div>
                      <Progress
                        value={recommendations.nutrition.macroRatio.carbs}
                        className="h-2"
                      />

                      <div className="flex justify-between items-center">
                        <span>Fats</span>
                        <span className="font-semibold">
                          {recommendations.nutrition.macroRatio.fats}%
                        </span>
                      </div>
                      <Progress
                        value={recommendations.nutrition.macroRatio.fats}
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Recommended Foods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.nutrition.recommendedFoods.map(
                        (food, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4 text-wellness-600" />
                            <span className="text-sm">{food}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Foods to Limit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.nutrition.avoidFoods.map(
                        (food, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">{food}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Meal Timing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.nutrition.mealTiming.map(
                        (timing, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Clock className="h-4 w-4 text-wellness-600" />
                            <span className="text-sm">{timing}</span>
                          </li>
                        ),
                      )}
                    </ul>
                    <div className="mt-4 p-3 bg-wellness-50 rounded-lg">
                      <p className="text-sm text-wellness-700">
                        <strong>Hydration:</strong>{" "}
                        {recommendations.nutrition.hydration}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="fitness" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Workout Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-wellness-900">
                          Frequency
                        </label>
                        <p className="text-2xl font-bold text-wellness-600">
                          {recommendations.fitness.frequency}x/week
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wellness-900">
                          Duration
                        </label>
                        <p className="text-2xl font-bold text-wellness-600">
                          {recommendations.fitness.duration} min
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wellness-900">
                          Intensity
                        </label>
                        <Badge
                          variant="outline"
                          className="border-wellness-200"
                        >
                          {recommendations.fitness.intensity}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wellness-900">
                          Rest Days
                        </label>
                        <p className="text-2xl font-bold text-wellness-600">
                          {recommendations.fitness.restDays}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Optimal Workout Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.fitness.workoutType.map(
                        (workout, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Zap className="h-4 w-4 text-wellness-600" />
                            <span className="text-sm">{workout}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-wellness-200">
                <CardHeader>
                  <CardTitle>Genetic Fitness Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <h4 className="font-medium text-wellness-900 mb-2">
                        Cardio Response
                      </h4>
                      <div className="text-2xl font-bold text-wellness-600 mb-1">
                        {geneticMarkers.fitnessResponse.cardioResponse
                          .charAt(0)
                          .toUpperCase() +
                          geneticMarkers.fitnessResponse.cardioResponse.slice(
                            1,
                          )}
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="font-medium text-wellness-900 mb-2">
                        Strength Response
                      </h4>
                      <div className="text-2xl font-bold text-wellness-600 mb-1">
                        {geneticMarkers.fitnessResponse.strengthResponse
                          .charAt(0)
                          .toUpperCase() +
                          geneticMarkers.fitnessResponse.strengthResponse.slice(
                            1,
                          )}
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="font-medium text-wellness-900 mb-2">
                        Injury Risk
                      </h4>
                      <div className="text-2xl font-bold text-wellness-600 mb-1">
                        {geneticMarkers.fitnessResponse.injuryRisk
                          .charAt(0)
                          .toUpperCase() +
                          geneticMarkers.fitnessResponse.injuryRisk.slice(1)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lifestyle" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Sleep Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/70">
                      {recommendations.lifestyle.sleepRecommendations}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Stress Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.lifestyle.stressManagement.map(
                        (tip, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <CheckCircle className="h-4 w-4 text-wellness-600" />
                            <span className="text-sm">{tip}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Supplement Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.lifestyle.supplementSuggestions.map(
                        (supplement, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Plus className="h-4 w-4 text-wellness-600" />
                            <span className="text-sm">{supplement}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-wellness-200">
                  <CardHeader>
                    <CardTitle>Personalized Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {recommendations.personalizedTips.map((tip, index) => (
                        <li
                          key={index}
                          className="p-3 bg-wellness-50 rounded-lg"
                        >
                          <p className="text-sm text-wellness-800">{tip}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // No Analysis Yet
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-wellness-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Dna className="h-12 w-12 text-wellness-600" />
            </div>
            <h2 className="text-2xl font-bold text-wellness-900 mb-4">
              Ready to Unlock Your Genetic Potential?
            </h2>
            <p className="text-foreground/70 max-w-md mx-auto mb-8">
              Upload your DNA data to receive personalized wellness
              recommendations based on your unique genetic profile.
            </p>
            <div className="flex justify-center space-x-4">
              <Link to="/upload">
                <Button size="lg" className="bg-wellness-gradient">
                  <Dna className="mr-2 h-5 w-5" />
                  Upload DNA Data
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline">
                  View Sample Report
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
