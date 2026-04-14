import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import QuizGateModal from "@/components/QuizGateModal";
import { products, PLAN_IDS } from "@/lib/products";
import {
  generatePersonalizedPDFClient,
  downloadPDF,
  type PersonalizationData,
} from "@/lib/client-pdf-generator";
import {
  Sparkles,
  Brain,
  Target,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Play,
  Users,
  Award,
  CheckCircle,
  Clock,
  Smartphone,
  Heart,
  TrendingUp,
  Download,
  Lock,
  Globe,
  Gift,
  Menu,
  X,
} from "lucide-react";
import LegalFooter from "@/components/LegalFooter";
import LanguageToggle from "@/components/LanguageToggle";
import { t, getLanguage } from "@/lib/translations";

const homeProducts = products.filter((product) => product.planId !== PLAN_IDS.SUBSCRIPTION);

export default function Index() {
  const [quizGateOpen, setQuizGateOpen] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleProductClick = (productId: string, productName: string) => {
    const quizCompleted = localStorage.getItem("analysisId");
    if (!quizCompleted) {
      setSelectedProductName(productName);
      setQuizGateOpen(true);
    } else {
      sessionStorage.setItem("selectedProductId", productId);
      window.location.href = "/download";
    }
  };

  const handleSampleReport = async () => {
    try {
      const sampleData: PersonalizationData = {
        profile: {
          name: "Sample User",
          email: "demo@genewell.com",
          age: 30,
          gender: "male",
          estimatedHeightCm: 175,
          estimatedWeightKg: 75,
          estimatedBMR: 1750,
          estimatedTDEE: 2400,
          proteinGrams: 135,
          carbsGrams: 300,
          fatsGrams: 80,
          stressScore: 65,
          sleepScore: 70,
          activityScore: 65,
          energyScore: 70,
          medicalConditions: [],
          digestiveIssues: [],
          foodIntolerances: [],
          skinConcerns: [],
          dietaryPreference: "omnivore",
          exercisePreference: ["gym", "cardio"],
          workSchedule: "9-to-5",
          region: "India",
          recommendedTests: [
            "Complete Hemogram (CBC)",
            "Fasting Blood Glucose (FBS) & Random Blood Glucose (RBS)",
            "Lipid Profile: Total Cholesterol, LDL, HDL, Triglycerides, VLDL",
            "Liver Function Tests (LFT): SGOT, SGPT, ALP, Bilirubin",
            "Kidney Function Tests (RFT): Creatinine, BUN, Electrolytes",
            "Thyroid Function Tests (TFT): TSH, Free T3, Free T4",
            "Vitamin D (25-hydroxyvitamin D)",
            "Iron Panel (Serum Iron, Ferritin, TIBC)",
          ],
          supplementPriority: [
            "Vitamin D3 2000-4000 IU daily",
            "Omega-3 (fish oil) 2-3g EPA+DHA daily",
            "Magnesium Glycinate 300-400mg before bed",
          ],
          exerciseIntensity: "moderate",
          mealFrequency: 3,
          dnaConsent: false,
        },
        insights: {
          metabolicInsight:
            "Your moderate metabolism and 9-to-5 schedule suggest optimal results with structured meal timing and consistent strength training 3-4x per week.",
          recommendedMealTimes: ["8:00 AM", "1:00 PM", "7:00 PM"],
          calorieRange: { min: 2100, max: 2700 },
          macroRatios: { protein: 22.5, carbs: 50, fats: 27.5 },
          supplementStack: [
            {
              name: "Vitamin D3",
              reason: "Support immune function and mood",
              dosage: "4000 IU daily",
            },
            {
              name: "Omega-3",
              reason: "Anti-inflammatory and brain health",
              dosage: "2-3g daily",
            },
            {
              name: "Magnesium",
              reason: "Sleep quality and muscle recovery",
              dosage: "400mg before bed",
            },
          ],
          workoutStrategy:
            "3-4 days per week with compound movements. Monday/Wednesday/Friday strength training, Tuesday/Thursday optional cardio. Focus on progressive overload and proper form.",
          sleepStrategy:
            "Target 7-8 hours nightly with consistent 10:30 PM bedtime and 6:30 AM wake time. Dark, cool room with minimal screen time 1 hour before sleep.",
          stressStrategy:
            "5-10 minute daily breathing exercises, 30 min walks 3x weekly, and regular strength training which naturally reduces cortisol and anxiety.",
        },
      };

      const { blob, filename } = await generatePersonalizedPDFClient(sampleData, {
        tier: "premium",
        addOns: [],
        orderId: `sample_${Date.now()}`,
        timestamp: new Date().toISOString(),
        language: "en",
      });

      downloadPDF(blob, filename);
    } catch (error) {
      console.error("Error downloading sample report:", error);
      alert("Failed to generate sample report. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <QuizGateModal
        isOpen={quizGateOpen}
        onClose={() => setQuizGateOpen(false)}
        productName={selectedProductName}
      />
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Genewell
                </span>
                <div className="text-xs text-gray-500 font-medium">WELLNESS AI</div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#how-it-works" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">How It Works</a>
              <a href="#science" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">The Science</a>
              <a href="#results" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">Results</a>
              <Link to="/pricing" className="text-gray-700 hover:text-purple-600 transition-colors font-medium">Pricing</Link>
              <Link to="/b2b/register" className="text-indigo-600 hover:text-indigo-800 transition-colors font-semibold text-sm border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-50">🏢 For Business</Link>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <LanguageToggle />
              <Badge className="hidden sm:inline-flex bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs">🔥 16K+ Plans</Badge>
              <Link to="/quiz" className="hidden sm:block">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 sm:px-6 rounded-full text-sm">
                  {t("hero.cta")}
                  <ArrowRight className="ml-1 sm:ml-2 h-4 w-4" />
                </Button>
              </Link>
              <button className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-200 px-4 py-2 rounded-full text-sm font-medium">✨ AI-Powered • Science-Backed • Instant Results</Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">{getLanguage() === "hi" ? "आपका शरीर," : "Your Body,"}</span>
              <br />
              <span className="text-gray-900">{getLanguage() === "hi" ? "3 मिनट में डिकोड" : "Decoded in 3 Minutes"}</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              {getLanguage() === "hi" 
                ? <>अपना व्यक्तिगत <strong>वेलनेस ब्लूप्रिंट</strong> पाएं — मील टाइमिंग से लेकर परफेक्ट वर्कआउट तक — आपके मेटाबॉलिज़्म, जीवनशैली और DNA (वैकल्पिक) पर आधारित।</>
                : <>Get your personalized <strong>Wellness Blueprint</strong> — from optimal meal timing to perfect workouts — based on your unique metabolism, lifestyle & DNA (optional).</>
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link to="/quiz">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-full shadow-2xl hover:shadow-purple-500/25">
                  <Brain className="mr-3 h-6 w-6" />
                  {getLanguage() === "hi" ? "3 मिनट की क्विज़ लें (मुफ़्त)" : "Take the 3-Min Quiz (Free)"}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="border-2 border-purple-200 text-purple-700 hover:bg-purple-50 px-8 py-6 text-lg rounded-full">
                  <Play className="mr-3 h-5 w-5" />
                  Watch How It Works
                </Button>
              </a>
              <Button size="lg" variant="outline" className="border-2 border-orange-200 text-orange-700 hover:bg-orange-50 px-8 py-6 text-lg rounded-full" onClick={handleSampleReport}>
                <Download className="mr-3 h-5 w-5" />
                See Sample Report
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">How It <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Works</span></h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Three simple steps to your personalized wellness blueprint</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-2">01</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Take the 3-Minute Quiz</h3>
              <p className="text-gray-600">Answer 25 questions about your age, diet, sleep, stress, activity level, and health goals. No sign-up required.</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-2">02</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Analyzes Your Data</h3>
              <p className="text-gray-600">Our AI engine calculates your BMR, TDEE, macro splits, stress score, and sleep quality — personalized to your body.</p>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">03</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Download Your Blueprint</h3>
              <p className="text-gray-600">Get a personalized PDF with meal plans, workout routines, supplement stacks, and daily schedules tailored to you.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="science" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">The <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Science</span> Behind It</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Every recommendation is backed by peer-reviewed research and clinical data</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Heart className="h-8 w-8 text-red-500 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Metabolic Analysis</h3>
              <p className="text-sm text-gray-600">BMR & TDEE calculations using Mifflin-St Jeor equation, adjusted for your activity level and body composition.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Clock className="h-8 w-8 text-orange-500 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Circadian Optimization</h3>
              <p className="text-sm text-gray-600">Meal timing and sleep schedules aligned with your circadian rhythm for maximum energy and recovery.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Shield className="h-8 w-8 text-green-500 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Nutrient Precision</h3>
              <p className="text-sm text-gray-600">Protein, carb, and fat ratios personalized to your goals — whether fat loss, muscle gain, or maintenance.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <TrendingUp className="h-8 w-8 text-purple-500 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Adaptive Intelligence</h3>
              <p className="text-sm text-gray-600">Recommendations adapt based on your stress levels, medical conditions, dietary preferences, and fitness goals.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="results" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Your Complete <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Wellness Blueprint</span></h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Everything you need for sustainable body optimization, delivered instantly</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {homeProducts.map((product) => (
              <Card key={product.id} className={`relative border-2 hover:border-opacity-100 transition-all duration-300 hover:shadow-xl ${product.popular ? 'border-green-400 shadow-lg ring-2 ring-green-200' : `border-${product.color}-100 hover:border-${product.color}-300`}`}>
                {product.popular && <div className="bg-green-500 text-white text-center py-2 text-sm font-semibold">Most Popular</div>}
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleProductClick(product.id, product.name)} className="w-full">{product.price === 0 ? 'Get Free Blueprint' : 'Get Started'}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
