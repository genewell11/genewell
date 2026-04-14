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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Brain,
  Heart,
  Clock,
  Activity,
  Moon,
  Zap,
  Target,
  Upload,
  CheckCircle,
  User,
  Utensils,
  Scale,
  Bed,
  AlertCircle,
  Globe,
  Loader,
} from "lucide-react";
import { WellnessQuiz } from "@shared/api";
import LegalFooter from "@/components/LegalFooter";
import { analyzeQuizData } from "@/lib/quiz-analysis";

// Quiz Questions Configuration
const quizQuestions = [
  {
    id: "age",
    title: "Let's start with your age",
    subtitle: "This helps us understand your metabolic baseline",
    icon: User,
    type: "select" as const,
    options: [
      { value: "16-20", label: "16-20 years", emoji: "🌱" },
      { value: "21-25", label: "21-25 years", emoji: "🌟" },
      { value: "26-30", label: "26-30 years", emoji: "💪" },
      { value: "31-35", label: "31-35 years", emoji: "🎯" },
      { value: "36-40", label: "36-40 years", emoji: "⚡" },
      { value: "41-45", label: "41-45 years", emoji: "🔥" },
      { value: "46-50", label: "46-50 years", emoji: "💎" },
      { value: "51-60", label: "51-60 years", emoji: "🏆" },
    ],
  },
  {
    id: "gender",
    title: "What's your gender identity?",
    subtitle: "Hormonal differences affect metabolism and nutrition needs",
    icon: Heart,
    type: "select" as const,
    options: [
      { value: "male", label: "Male", emoji: "👨" },
      { value: "female", label: "Female", emoji: "👩" },
    ],
  },
  {
    id: "wakeUpTime",
    title: "What time do you usually wake up?",
    subtitle: "Your circadian rhythm affects optimal meal timing",
    icon: Clock,
    type: "select" as const,
    options: [
      { value: "before-6", label: "Before 6 AM", emoji: "🌅" },
      { value: "6-8", label: "6-8 AM", emoji: "☀️" },
      { value: "8-10", label: "8-10 AM", emoji: "🌤️" },
      { value: "after-10", label: "After 10 AM", emoji: "🌞" },
    ],
  },
  {
    id: "mealsPerDay",
    title: "How many meals do you eat daily?",
    subtitle: "Your current eating pattern reveals digestive capacity",
    icon: Utensils,
    type: "select" as const,
    options: [
      { value: "1", label: "1 meal (OMAD)", emoji: "🍽️" },
      { value: "2", label: "2 meals", emoji: "🥗" },
      { value: "3", label: "3 meals", emoji: "🍜" },
      { value: "4-plus", label: "4+ meals/snacks", emoji: "🍎" },
    ],
  },
  {
    id: "tiredTime",
    title: "When do you feel most tired?",
    subtitle: "Energy dips reveal your natural metabolic rhythm",
    icon: Bed,
    type: "select" as const,
    options: [
      { value: "morning", label: "Morning (hard to wake up)", emoji: "😴" },
      { value: "afternoon", label: "Afternoon (post-lunch dip)", emoji: "🥱" },
      { value: "evening", label: "Evening (dinner time)", emoji: "😮‍💨" },
      { value: "rarely", label: "Rarely tired during day", emoji: "⚡" },
    ],
  },
  {
    id: "bloatingFrequency",
    title: "How often do you feel bloated after eating?",
    subtitle: "Digestive patterns indicate food compatibility",
    icon: Activity,
    type: "select" as const,
    options: [
      { value: "often", label: "Often (most meals)", emoji: "😣" },
      { value: "sometimes", label: "Sometimes", emoji: "😐" },
      { value: "rarely", label: "Rarely", emoji: "🙂" },
      { value: "never", label: "Never", emoji: "😊" },
    ],
  },
  {
    id: "stressLevel",
    title: "How would you rate your stress levels?",
    subtitle: "Stress directly impacts metabolism and digestion",
    icon: Brain,
    type: "select" as const,
    options: [
      { value: "very-high", label: "Very High", emoji: "🔥" },
      { value: "moderate", label: "Moderate", emoji: "😰" },
      { value: "low", label: "Low", emoji: "😌" },
      { value: "minimal", label: "Minimal/None", emoji: "🧘‍♀️" },
    ],
  },
  {
    id: "hungerFrequency",
    title: "How often do you feel hungry between meals?",
    subtitle:
      "Hunger patterns reveal metabolic speed and blood sugar stability",
    icon: Clock,
    type: "select" as const,
    options: [
      { value: "1-2-hours", label: "Every 1-2 hours", emoji: "🍿" },
      { value: "3-4-hours", label: "Every 3-4 hours", emoji: "⏰" },
      { value: "rarely", label: "Rarely feel hungry", emoji: "🎯" },
      { value: "depends", label: "Depends on the day", emoji: "🤷‍♀️" },
    ],
  },
  {
    id: "weightGoal",
    title: "What's your current weight goal?",
    subtitle: "Your goals shape the intensity and focus of your plan",
    icon: Target,
    type: "select" as const,
    options: [
      { value: "lose-weight", label: "Lose weight (fat loss)", emoji: "📉" },
      { value: "gain-weight", label: "Gain weight (muscle/mass)", emoji: "📈" },
      { value: "maintain", label: "Maintain current weight", emoji: "⚖️" },
      { value: "no-goal", label: "No specific goal", emoji: "🌟" },
    ],
  },
  {
    id: "sleepHours",
    title: "How many hours do you sleep?",
    subtitle: "Sleep quality affects hormones, metabolism, and recovery",
    icon: Moon,
    type: "select" as const,
    options: [
      { value: "less-than-5", label: "Less than 5 hours", emoji: "😵" },
      { value: "5-6", label: "5-6 hours", emoji: "😪" },
      { value: "7-8", label: "7-8 hours", emoji: "😴" },
      { value: "more-than-8", label: "More than 8 hours", emoji: "😌" },
    ],
  },
  {
    id: "activityLevel",
    title: "How physically active are you daily?",
    subtitle:
      "Activity level determines caloric needs and exercise recommendations",
    icon: Zap,
    type: "select" as const,
    options: [
      {
        value: "sedentary",
        label: "Sedentary (desk job, minimal walking)",
        emoji: "🪑",
      },
      {
        value: "lightly-active",
        label: "Lightly active (walks, chores)",
        emoji: "🚶‍♀️",
      },
      {
        value: "moderately-active",
        label: "Moderately active (gym 2-3x/week)",
        emoji: "🏋️‍♀️",
      },
      {
        value: "highly-active",
        label: "Highly active (daily training)",
        emoji: "🏃‍♀️",
      },
    ],
  },
  {
    id: "cravings",
    title: "What do you crave most often?",
    subtitle: "Cravings reveal nutrient deficiencies and metabolic imbalances",
    icon: Heart,
    type: "select" as const,
    options: [
      { value: "sweet-foods", label: "Sweet foods", emoji: "🍰" },
      { value: "salty-snacks", label: "Salty snacks", emoji: "🥨" },
      { value: "fried-junk", label: "Fried/junk food", emoji: "🍟" },
      { value: "spicy-sour", label: "Spicy/sour foods", emoji: "🌶️" },
      { value: "no-cravings", label: "I don't crave often", emoji: "🎯" },
    ],
  },
  {
    id: "energyLevels",
    title: "How would you describe your energy levels?",
    subtitle:
      "Energy patterns help identify metabolic optimization opportunities",
    icon: Zap,
    type: "select" as const,
    options: [
      { value: "very-low", label: "Very Low (constantly tired)", emoji: "🔋" },
      { value: "low", label: "Low (need stimulants)", emoji: "☕" },
      { value: "moderate", label: "Moderate (ups and downs)", emoji: "📊" },
      { value: "high", label: "High (consistently good)", emoji: "⚡" },
      {
        value: "very-high",
        label: "Very High (always energetic)",
        emoji: "🚀",
      },
    ],
  },
  {
    id: "hydrationHabits",
    title: "How much water do you drink daily?",
    subtitle: "Hydration affects metabolism, energy, and nutrient transport",
    icon: Activity,
    type: "select" as const,
    options: [
      {
        value: "less-than-4-glasses",
        label: "Less than 4 glasses",
        emoji: "🥤",
      },
      { value: "4-6-glasses", label: "4-6 glasses", emoji: "💧" },
      { value: "6-8-glasses", label: "6-8 glasses", emoji: "🌊" },
      { value: "more-than-8", label: "More than 8 glasses", emoji: "🏊‍♀️" },
    ],
  },
  {
    id: "digestiveIssues",
    title: "Do you face any digestive issues?",
    subtitle:
      "Digestive health is key to nutrient absorption and overall wellness",
    icon: Activity,
    type: "select" as const,
    options: [
      { value: "acidity", label: "Acidity or heartburn", emoji: "🔥" },
      { value: "constipation", label: "Constipation", emoji: "🚫" },
      { value: "loose-motions", label: "Loose motions", emoji: "💨" },
      { value: "gas", label: "Gas or bloating", emoji: "💨" },
      { value: "none", label: "No digestive issues", emoji: "✅" },
    ],
  },
  {
    id: "medicalConditions",
    title: "Any medical conditions we should know about?",
    subtitle: "Medical history helps customize safe, effective recommendations",
    icon: Heart,
    type: "select" as const,
    options: [
      { value: "pcos", label: "PCOS or hormonal imbalance", emoji: "⚖️" },
      { value: "thyroid", label: "Thyroid (Hyper/Hypo)", emoji: "🦋" },
      { value: "diabetes", label: "Diabetes or pre-diabetes", emoji: "🍯" },
      { value: "blood-pressure", label: "Blood pressure concerns", emoji: "❤️" },
      { value: "none", label: "No major conditions", emoji: "💚" },
      { value: "prefer-not-to-say", label: "Prefer not to disclose", emoji: "🤐" },
    ],
  },
  {
    id: "eatingOut",
    title: "How often do you eat out or order food?",
    subtitle:
      "Eating patterns affect nutritional consistency and meal planning",
    icon: Utensils,
    type: "select" as const,
    options: [
      { value: "daily", label: "Daily", emoji: "🛵" },
      { value: "3-5-times", label: "3-5 times a week", emoji: "📦" },
      { value: "1-2-times", label: "1-2 times a week", emoji: "🍕" },
      { value: "rarely", label: "Rarely/Never", emoji: "🏠" },
    ],
  },
  {
    id: "exercisePreference",
    title: "What type of movement excites you most?",
    subtitle: "We’ll tailor workouts around what keeps you consistent",
    icon: Activity,
    type: "select" as const,
    options: [
      { value: "cardio", label: "Cardio (running, cycling)", emoji: "🏃‍♀️" },
      { value: "strength", label: "Strength training", emoji: "🏋️‍♀️" },
      { value: "yoga", label: "Yoga or Pilates", emoji: "🧘‍♀️" },
      { value: "dance", label: "Dance or Zumba", emoji: "💃" },
      { value: "sports", label: "Sports or games", emoji: "⚽" },
      { value: "walking", label: "Walking and hiking", emoji: "🚶‍♀️" },
      { value: "none", label: "Getting started (no routine yet)", emoji: "🛋️" },
    ],
  },
  {
    id: "workSchedule",
    title: "What's your work schedule like?",
    subtitle:
      "Work patterns affect meal timing and stress management strategies",
    icon: Clock,
    type: "select" as const,
    options: [
      { value: "9-to-5", label: "Regular 9-to-5", emoji: "🏢" },
      { value: "shift-work", label: "Shift work", emoji: "🌙" },
      { value: "flexible", label: "Flexible/Remote", emoji: "💻" },
      { value: "student", label: "Student", emoji: "📚" },
      { value: "homemaker", label: "Homemaker", emoji: "🏠" },
    ],
  },
  {
    id: "dnaUpload",
    title: "DNA Report for Deeper Analysis?",
    subtitle:
      "Optional: Upload your DNA report for 99% accurate personalization",
    icon: Upload,
    type: "select" as const,
    options: [
      {
        value: "yes-upload",
        label: "Yes, I want to upload my DNA report",
        emoji: "🧬",
      },
      {
        value: "have-but-no-upload",
        label: "I have it but prefer not to upload",
        emoji: "🔒",
      },
      { value: "dont-have", label: "I don't have a DNA report", emoji: "🤷‍♀️" },
    ],
  },
  {
    id: "skinConcerns",
    title: "Any skin concerns?",
    subtitle: "Helps tailor anti-inflammatory nutrition",
    icon: Heart,
    type: "select" as const,
    options: [
      { value: "acne", label: "Acne", emoji: "🧴" },
      { value: "dryness", label: "Dryness", emoji: "💧" },
      { value: "oiliness", label: "Oiliness", emoji: "🛢️" },
      { value: "pigmentation", label: "Pigmentation", emoji: "🟤" },
      { value: "aging", label: "Aging", emoji: "⌛" },
      { value: "none", label: "None", emoji: "✅" },
    ],
  },
  {
    id: "moodPatterns",
    title: "How are your mood patterns?",
    subtitle: "Impacts stress and nutrition",
    icon: Brain,
    type: "select" as const,
    options: [
      { value: "mood-swings", label: "Mood swings", emoji: "🎢" },
      { value: "anxiety", label: "Anxiety", emoji: "😟" },
      { value: "depression", label: "Low mood", emoji: "🌧️" },
      { value: "irritability", label: "Irritability", emoji: "😠" },
      { value: "stable", label: "Stable", emoji: "🙂" },
    ],
  },
  {
    id: "foodIntolerances",
    title: "Any food intolerances?",
    subtitle: "Personalizes food lists",
    icon: Utensils,
    type: "select" as const,
    options: [
      { value: "lactose", label: "Lactose", emoji: "🥛" },
      { value: "gluten", label: "Gluten", emoji: "🍞" },
      { value: "nuts", label: "Nuts", emoji: "🥜" },
      { value: "seafood", label: "Seafood", emoji: "🦐" },
      { value: "eggs", label: "Eggs", emoji: "🥚" },
      { value: "none", label: "None", emoji: "✅" },
    ],
  },
  {
    id: "supplementUsage",
    title: "Do you use supplements?",
    subtitle: "We’ll adjust recommendations",
    icon: Sparkles,
    type: "select" as const,
    options: [
      { value: "none", label: "None", emoji: "🚫" },
      { value: "multivitamin", label: "Multivitamin", emoji: "💊" },
      { value: "protein", label: "Protein", emoji: "🥤" },
      { value: "specific-deficiency", label: "For specific deficiency", emoji: "🧪" },
      { value: "multiple", label: "Multiple", emoji: "📦" },
    ],
  },
  {
    id: "userInfo",
    title: "Your details",
    subtitle: "We’ll email your results and receipt",
    icon: User,
    type: "form" as const,
    options: [],
  },
];

export default function Quiz() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [quizData, setQuizData] = useState<Partial<WellnessQuiz>>({});
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [dnaFile, setDnaFile] = useState<File | null>(null);

  // B2B link support
  const [b2bToken, setB2bToken] = useState<string | null>(null);
  const [b2bBusiness, setB2bBusiness] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bt = params.get("b2b");
    if (!bt) return;
    // Validate token with server
    fetch(`/api/b2b/validate/${bt}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setB2bToken(bt);
          setB2bBusiness(data.businessName);
          // Pre-fill recipient email if provided
          if (data.recipientEmail) setQuizData(q => ({ ...q, email: data.recipientEmail }));
        }
      })
      .catch(() => {});
  }, []);

  const currentQuestion = quizQuestions[currentStep];
  const progress = ((currentStep + 1) / quizQuestions.length) * 100;
  const Icon = currentQuestion.icon;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setQuizData((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const isStepValid = () => {
    const currentAnswer = quizData[currentQuestion.id as keyof WellnessQuiz];
    if (currentQuestion.id === "dnaUpload" && quizData.dnaUpload === "yes-upload") {
      return !!dnaFile;
    }
    if ((currentQuestion as any).type === "form") {
      return Boolean((quizData as any).userName) && /.+@.+\..+/.test((quizData as any).userEmail || "");
    }
    return !!currentAnswer;
  };

  const handleNext = () => {
    if (currentStep < quizQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const ageRange = quizData.age as string;
      const ageValue = ageRange?.includes("16-20")
        ? 18
        : ageRange?.includes("21-25")
        ? 23
        : ageRange?.includes("26-30")
        ? 28
        : ageRange?.includes("31-35")
        ? 33
        : ageRange?.includes("36-40")
        ? 38
        : ageRange?.includes("41-45")
        ? 43
        : ageRange?.includes("46-50")
        ? 48
        : 55;

      const { userName, userEmail, ...rest } = quizData as any;

      // Handle array fields - convert to single value or keep as array
      const normalizedDigestive = Array.isArray(rest.digestiveIssues)
        ? rest.digestiveIssues[0]
        : rest.digestiveIssues;
      const normalizedMedical = Array.isArray(rest.medicalConditions)
        ? rest.medicalConditions[0]
        : rest.medicalConditions;
      const normalizedExercise = Array.isArray(rest.exercisePreference)
        ? rest.exercisePreference[0]
        : rest.exercisePreference;

      // Ensure skinConcerns and foodIntolerances are arrays
      const skinConcernsArray = Array.isArray(rest.skinConcerns)
        ? rest.skinConcerns
        : rest.skinConcerns
        ? [rest.skinConcerns]
        : ["none"];
      const foodIntolerancesArray = Array.isArray(rest.foodIntolerances)
        ? rest.foodIntolerances
        : rest.foodIntolerances
        ? [rest.foodIntolerances]
        : ["none"];

      const finalQuizData = {
        ...rest,
        age: ageValue,
        language,
        digestiveIssues: normalizedDigestive || "none",
        medicalConditions: normalizedMedical || "none",
        exercisePreference: normalizedExercise || "walking",
        skinConcerns: skinConcernsArray,
        foodIntolerances: foodIntolerancesArray,
        // Add default values for missing optional fields
        energyLevels: rest.energyLevels || "moderate",
        moodPatterns: rest.moodPatterns || "stable",
        hydrationHabits: rest.hydrationHabits || "6-8-glasses",
        supplementUsage: rest.supplementUsage || "none",
        workSchedule: rest.workSchedule || "9-to-5",
      };

      // Perform client-side analysis instead of server call
      console.log("Analyzing quiz data on client...");
      const personalizationData = analyzeQuizData(finalQuizData, userName, userEmail);

      // Generate analysis ID client-side
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create a blueprint from the personalization data
      const blueprint = {
        metabolismType: {
          type: "moderate",
          description: personalizationData.insights.metabolicInsight,
          characteristics: [
            `BMR: ${personalizationData.profile.estimatedBMR} calories`,
            `TDEE: ${personalizationData.profile.estimatedTDEE} calories`,
            `Daily calorie range: ${personalizationData.insights.calorieRange.min} - ${personalizationData.insights.calorieRange.max}`,
          ],
        },
        nutritionPlan: {
          bestFoods: ["Lean proteins", "Whole grains", "Fresh vegetables", "Healthy fats"],
          worstFoods: ["Processed foods", "Refined sugars", "Trans fats"],
          mealTiming: {
            breakfast: personalizationData.insights.recommendedMealTimes[0],
            lunch: personalizationData.insights.recommendedMealTimes[1],
            dinner: personalizationData.insights.recommendedMealTimes[2],
            snacks: ["Mid-morning", "Mid-afternoon"],
          },
        },
        fitnessRoutine: {
          workoutType: personalizationData.profile.exercisePreference,
          frequency: personalizationData.profile.mealFrequency,
          duration: personalizationData.profile.exerciseIntensity === "low" ? 20 : 30,
        },
      };

      localStorage.setItem("analysisId", analysisId);
      localStorage.setItem("blueprint", JSON.stringify(blueprint));
      localStorage.setItem("language", language);
      localStorage.setItem("quizData", JSON.stringify({ ...finalQuizData, userName, userEmail, userPhone: (quizData as any).userPhone, userLocation: (quizData as any).userLocation, language }));
      if (b2bToken) {
        localStorage.setItem("b2bReportTier", "premium");
        fetch(`/api/b2b/links/${b2bToken}/used`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysisId,
            userData: {
              userName,
              userEmail,
              userPhone: (quizData as any).userPhone || "",
              userAge: ageValue,
              userGender: quizData.gender,
              userLocation: (quizData as any).userLocation || "",
              quizData: finalQuizData,
            },
          }),
        }).catch(() => {});
      }

      try {
        await fetch("/api/quiz/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName,
            userEmail,
            userPhone: (quizData as any).userPhone || "",
            userAge: ageValue,
            userGender: quizData.gender,
            userLocation: (quizData as any).userLocation || "",
            quizData: finalQuizData,
            analysisId,
          }),
        });
      } catch (captureErr) {
        console.error("Quiz capture error (non-blocking):", captureErr);
      }

      console.log("Quiz analysis complete. Navigating to results...", { analysisId, blueprint });
      navigate("/quiz-results");
    } catch (err) {
      console.error("Quiz error:", err);
      setError("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAnswer = quizData[currentQuestion.id as keyof WellnessQuiz];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex flex-col">
      {/* B2B Banner */}
      {b2bBusiness && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center py-2.5 text-sm font-medium">
          🎁 Sponsored by <strong>{b2bBusiness}</strong> — Your personalized report is <strong>free</strong> after completing this quiz!
        </div>
      )}
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg sm:rounded-xl">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="hidden xs:block">
                <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Genewell
                </span>
              </div>
            </Link>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguage(language === "en" ? "hi" : "en")}
                className="text-xs sm:text-sm"
              >
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {language === "en" ? "हिंदी" : "English"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-purple-600 hover:text-purple-700 hidden sm:flex">
                <ArrowLeft className="mr-2 h-4 w-4" /> Exit
              </Button>
              <div className="flex items-center bg-purple-50 rounded-full px-3 py-1 border border-purple-200">
                <span className="text-[10px] sm:text-xs font-bold text-purple-600">
                  {currentStep + 1}/{quizQuestions.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 pb-28 sm:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Progress */}
        <div className="mb-3 sm:mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-600 font-medium">Question {currentStep + 1} of {quizQuestions.length}</span>
            <span className="text-xs text-purple-600 font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5 sm:h-2 bg-white/50" />
        </div>

        {/* Error Display */}
        {error && (
          <Alert className="mb-4 sm:mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Question Card */}
        <Card className="border-0 shadow-xl sm:shadow-2xl bg-white/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="text-center pb-2 sm:pb-4 pt-4 sm:pt-6">
            <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4">
              <Icon className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 px-2">
              {currentQuestion.title}
            </CardTitle>
            <CardDescription className="text-xs sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
              {currentQuestion.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 sm:space-y-6 px-3 sm:px-8 pt-2">
            {/* Select Questions */}
            {currentQuestion.type === "select" && (
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {currentQuestion.id === "dnaUpload" &&
                  quizData.dnaUpload === "yes-upload" && (
                    <div className="mb-4 p-4 border-2 border-dashed border-purple-200 rounded-lg bg-purple-50/50">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                          <Upload className="h-5 w-5 text-purple-600" />
                        </div>
                        <h4 className="font-semibold text-purple-900 text-sm mb-1">
                          Upload DNA Report
                        </h4>
                        <p className="text-[12px] text-purple-600 mb-3">
                          PDF, TXT, or Image files supported
                        </p>
                        <Input
                          type="file"
                          className="hidden"
                          id="dna-file-upload"
                          accept=".pdf,.txt,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setDnaFile(file);
                              // Auto move to next after file is selected
                              setTimeout(handleNext, 500);
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          asChild
                          size="sm"
                          className="border-purple-200 hover:bg-purple-100 text-purple-700 cursor-pointer h-9"
                        >
                          <label htmlFor="dna-file-upload">
                            {dnaFile ? dnaFile.name : "Choose File"}
                          </label>
                        </Button>
                        {dnaFile && (
                          <div className="mt-2 flex items-center text-green-600 text-[12px] font-medium">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            File selected
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      handleAnswer(currentQuestion.id, option.value);
                      // Only auto-advance if it's NOT the DNA upload question with "yes-upload" selected
                      // or if it's any other option/question
                      const isDnaYes = currentQuestion.id === "dnaUpload" && option.value === "yes-upload";
                      
                      if (!isDnaYes && currentStep < quizQuestions.length - 1) {
                        setTimeout(handleNext, 300);
                      }
                    }}
                    className={`flex items-center p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all text-left group active:scale-[0.98] ${
                      currentAnswer === option.value
                        ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100"
                        : "border-slate-100 hover:border-purple-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xl sm:text-2xl mr-3 sm:mr-4 group-hover:scale-110 transition-transform">
                      {option.emoji}
                    </span>
                    <span className="flex-1 font-medium text-slate-700 text-[13px] sm:text-base leading-tight">
                      {option.label}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      currentAnswer === option.value
                        ? "border-purple-600 bg-purple-600"
                        : "border-slate-300"
                    }`}>
                      {currentAnswer === option.value && (
                        <CheckCircle className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* User Info Step */}
            {currentQuestion.type === "form" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="userName" className="text-sm sm:text-base">Full Name *</Label>
                  <Input
                    id="userName"
                    placeholder="Your full name"
                    value={(quizData as any).userName || ""}
                    onChange={(e) => handleAnswer("userName", e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userEmail" className="text-sm sm:text-base">Email Address *</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={(quizData as any).userEmail || ""}
                    onChange={(e) => handleAnswer("userEmail", e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userPhone" className="text-sm sm:text-base">Mobile Number</Label>
                  <Input
                    id="userPhone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={(quizData as any).userPhone || ""}
                    onChange={(e) => handleAnswer("userPhone", e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userLocation" className="text-sm sm:text-base">City / Location</Label>
                  <Input
                    id="userLocation"
                    placeholder="e.g. Mumbai, Delhi, Bangalore"
                    value={(quizData as any).userLocation || ""}
                    onChange={(e) => handleAnswer("userLocation", e.target.value)}
                    className="h-11 sm:h-12 text-sm sm:text-base"
                  />
                </div>
              </div>
            )}

            {/* Navigation (Desktop) */}
            <div className="hidden sm:flex justify-between pt-8 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="px-6 py-3 text-lg"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                {language === "en" ? "Previous" : "पिछला"}
              </Button>

              <Button
                onClick={handleNext}
                disabled={!isStepValid() || isSubmitting}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 text-lg"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    {language === "en" ? "Creating..." : "बनाई जा रही है..."}
                  </span>
                ) : currentStep === quizQuestions.length - 1 ? (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    {language === "en" ? "Get My Blueprint" : "मेरी योजना पाएं"}
                  </>
                ) : (
                  <>
                    {language === "en" ? "Next" : "अगला"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-4 sm:mt-8 flex flex-wrap justify-center items-center gap-3 sm:gap-6 text-gray-500 text-[10px] sm:text-sm">
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>100% Secure</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="h-3 w-3 text-purple-500" />
            <span>Instant Results</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="h-3 w-3 text-pink-500" />
            <span>Science-Backed</span>
          </div>
        </div>
        </div>
      </div>

      {/* Sticky Navigation (Mobile) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-4 z-40 pb-safe">
        <div className="max-w-3xl mx-auto flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex-1 h-12 text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {language === "en" ? "Prev" : "पिछला"}
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isStepValid() || isSubmitting}
            className="flex-[1.5] h-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-lg shadow-purple-200"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Wait...
              </span>
            ) : currentStep === quizQuestions.length - 1 ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {language === "en" ? "Get Blueprint" : "पाएं"}
              </>
            ) : (
              <>
                {language === "en" ? "Next" : "अगला"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        {!isStepValid() && (
          <p className="text-center text-red-500 text-[10px] mt-2 font-medium">
            {language === "en" ? "Selection required" : "उत्तर चुनें"}
          </p>
        )}
      </div>

      <LegalFooter />
    </div>
  );
}
