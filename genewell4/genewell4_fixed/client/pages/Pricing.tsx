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
  Check,
  Star,
  Zap,
  ArrowLeft,
  Gift,
} from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { getLanguage } from "@/lib/translations";
import QuizGateModal from "@/components/QuizGateModal";
import LegalFooter from "@/components/LegalFooter";
import {
  FREE_BLUEPRINT,
  ESSENTIAL_BLUEPRINT,
  PREMIUM_BLUEPRINT,
  COMPLETE_COACHING,
  defaultAddOns,
  AddOn,
  PLAN_IDS,
  PlanConfiguration,
} from "@/lib/products";
import { filterAddonsByGender, getStoredGender } from "@/lib/addon-filter";

const defaultPlans = [
  { ...FREE_BLUEPRINT, buttonText: "Get Free Blueprint" },
  { ...ESSENTIAL_BLUEPRINT, buttonText: "Get Essential" },
  { ...PREMIUM_BLUEPRINT, buttonText: "Get Premium" },
  { ...COMPLETE_COACHING, buttonText: "Start Coaching" },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [quizGateOpen, setQuizGateOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAddOns, setShowAddOns] = useState(false);
  const [addOns, setAddOns] = useState<AddOn[]>(defaultAddOns);
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState(defaultPlans);

  useEffect(() => {
    const gender = getStoredGender();

    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.products?.length > 0) {
          const apiPlans = data.products
            .filter((p: any) => p.visible && p.plan_id !== PLAN_IDS.SUBSCRIPTION)
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((p: any) => {
              const base = defaultPlans.find(d => d.planId === p.plan_id);
              return {
                ...(base || {}),
                id: p.plan_id.replace('_blueprint', '-blueprint').replace('_', '-'),
                planId: p.plan_id,
                name: p.name,
                description: p.description || base?.description,
                details: Array.isArray(p.details) ? p.details : JSON.parse(p.details || '[]'),
                price: Number(p.price),
                originalPrice: p.original_price ? Number(p.original_price) : undefined,
                color: p.color || base?.color,
                icon: p.icon || base?.icon,
                pageCount: Number(p.page_count),
                badge: p.badge || undefined,
                popular: !!p.popular,
                link: '/quiz',
                buttonText: base?.buttonText || 'Get Started',
              };
            });
          if (apiPlans.length > 0) setPlans(apiPlans);
        }
      })
      .catch(() => {});

    fetch('/api/addons')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.addons?.length > 0) {
          const allAddons = data.addons.map((a: any) => ({
            id: a.addon_id,
            name: a.name,
            description: a.description,
            price: Number(a.price),
            originalPrice: a.original_price ? Number(a.original_price) : undefined,
            icon: a.icon,
            features: Array.isArray(a.features) ? a.features : JSON.parse(a.features || '[]'),
            pageCountAddition: a.page_count_addition,
            visible: a.visible,
          }));
          const filtered = filterAddonsByGender(allAddons, gender);
          setAddOns(filtered);
        }
      })
      .catch(() => {});

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data.success) setSiteSettings(data.settings); })
      .catch(() => {});
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  const handleSelectPlan = (planId: string) => {
    const quizCompleted = localStorage.getItem("analysisId");
    if (!quizCompleted) {
      setSelectedPlanId(planId);
      setQuizGateOpen(true);
    } else {
      setSelectedPlanId(planId);
      setSelectedAddOns([]);
      setShowAddOns(true);
    }
  };

  const calculateTotal = () => {
    if (!selectedPlanId) return 0;
    const plan = plans.find((p) => p.id === selectedPlanId);
    const addOnPrice = selectedAddOns.reduce((sum, addonId) => {
      const addon = addOns.find((a) => a.id === addonId);
      return sum + (addon?.price || 0);
    }, 0);
    return (plan?.price || 0) + addOnPrice;
  };

  const calculateTotalPages = () => {
    if (!selectedPlanId) return 0;
    const plan = plans.find((p) => p.id === selectedPlanId);
    const addonPages = selectedAddOns.reduce((sum, addonId) => {
      const addon = addOns.find((a) => a.id === addonId);
      return sum + (addon?.pageCountAddition || 0);
    }, 0);
    return (plan?.pageCount || 0) + addonPages;
  };

  const handleContinueCheckout = () => {
    if (!selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan || !plan.planId) return;
    const configuration: PlanConfiguration = {
      planId: plan.planId,
      selectedAddOns,
      totalPrice: calculateTotal(),
    };
    localStorage.setItem("planConfiguration", JSON.stringify(configuration));
    navigate("/checkout", { state: { configuration } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <QuizGateModal
        isOpen={quizGateOpen}
        onClose={() => setQuizGateOpen(false)}
        productName={selectedPlanId || ""}
      />

      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-blue-900">Genewell</span>
            </Link>
            <div className="flex items-center space-x-1 sm:space-x-3">
              <LanguageToggle />
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 sm:px-3">
                <Zap className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">HOME</span>
              </Button>
              <Link to="/login" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleBack} className="px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {(siteSettings['banner_enabled'] !== 'false') && (
        <div className="mb-16 bg-gradient-to-r from-purple-50 via-pink-50 to-red-50 border-2 border-purple-300 rounded-lg p-6 md:p-8">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <Gift className="h-10 w-10 text-purple-600 animate-bounce" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-purple-900 mb-2">
                {siteSettings['banner_title'] || '🚀 45-Day Launch Offer!'}
              </h2>
              <p className="text-purple-700 font-semibold mb-3 text-lg">
                <span className="text-red-600 bg-red-50 px-2 py-1 rounded">{siteSettings['banner_subtitle'] || 'All premium products are FREE for 45 days'}</span>
              </p>
              {(siteSettings['banner_body'] || 'Get full access to Essential, Premium, or Complete Coaching plans at no cost during our launch period.') && (
                <p className="text-purple-600 mb-2">
                  {siteSettings['banner_body'] || 'Get full access to Essential, Premium, or Complete Coaching plans at no cost during our launch period.'}
                </p>
              )}
              {(siteSettings['banner_exception'] || 'Live Training & Coaching services available as paid add-ons') && (
                <p className="text-sm text-purple-600">
                  <span className="font-semibold">Exception:</span> {siteSettings['banner_exception'] || 'Live Training & Coaching services available as paid add-ons'}
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            {siteSettings['pricing_headline'] || 'Evidence-Based Wellness, Every Budget'}
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            {siteSettings['pricing_subheadline'] || 'Science-backed plans personalized to your sleep, nutrition, training, and stress. No pseudoscience. No gimmicks.'}
          </p>
        </div>

        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Core Plans
            </h2>
            <p className="text-slate-600">
              Choose the depth of personalization that fits your goals
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col ${
                  selectedPlanId === plan.id
                    ? "ring-2 ring-blue-500 shadow-xl"
                    : ""
                } ${
                  plan.popular
                    ? "border-2 border-green-500 shadow-xl lg:scale-[1.02]"
                    : "border-slate-200"
                }`}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-center py-2 text-sm font-semibold">
                    <Star className="inline h-4 w-4 mr-1" />
                    Most Popular
                  </div>
                )}

                <CardHeader className={plan.popular ? "pt-4" : ""}>
                  {plan.badge && (
                    <div className="mb-3 flex items-center gap-2">
                      <Badge className={`text-xs font-semibold ${
                        plan.badge === "Awareness" ? 'bg-slate-600' :
                        plan.badge === "Planning" ? 'bg-blue-600' :
                        plan.badge === "Transformation" ? 'bg-green-600' :
                        'bg-orange-600'
                      }`}>
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-slate-600 text-sm font-medium mt-2">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-2 text-xs text-slate-500">
                    {plan.planId === PLAN_IDS.FREE ? "10–12 pages" :
                     plan.planId === PLAN_IDS.ESSENTIAL ? "12–16 pages" :
                     plan.planId === PLAN_IDS.PREMIUM ? "16–22 pages" :
                     "20–28 pages"} (varies by profile)
                  </div>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-2 mb-3">
                      {plan.originalPrice && (
                        <span className="text-base text-slate-400 line-through">
                          ₹{plan.originalPrice.toLocaleString("en-IN")}
                        </span>
                      )}
                      <span className="text-3xl font-bold text-slate-900">
                        {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-slate-500 text-xs">one-time</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full font-semibold ${
                      plan.popular
                        ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 text-white shadow-md"
                        : selectedPlanId === plan.id
                          ? "bg-blue-600 text-white"
                          : ""
                    }`}
                    variant={
                      selectedPlanId === plan.id
                        ? "default"
                        : plan.popular
                          ? "default"
                          : "outline"
                    }
                  >
                    {selectedPlanId === plan.id ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Selected
                      </>
                    ) : (
                      plan.buttonText
                    )}
                  </Button>

                  <div className="space-y-2 flex-1">
                    <h4 className="font-semibold text-slate-900 text-sm mb-2">
                      What's Included:
                    </h4>
                    <ul className="space-y-1.5">
                      {plan.details.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start space-x-2 text-xs sm:text-sm text-slate-700"
                        >
                          <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {showAddOns && selectedPlanId && (
            <div className="mb-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Enhance Your Blueprint
                </h2>
                <p className="text-slate-600">
                  Add specialized modules to your plan (optional)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {addOns.filter(a => a.visible !== false).map((addon) => (
                  <Card
                    key={addon.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedAddOns.includes(addon.id)
                        ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50/50"
                        : "border-slate-200"
                    }`}
                    onClick={() => {
                      setSelectedAddOns(prev =>
                        prev.includes(addon.id)
                          ? prev.filter(id => id !== addon.id)
                          : [...prev, addon.id]
                      );
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-slate-900 text-sm">{addon.name}</h3>
                        <div className="flex items-center gap-1">
                          {addon.originalPrice && (
                            <span className="text-xs text-slate-400 line-through">₹{addon.originalPrice}</span>
                          )}
                          <Badge className={selectedAddOns.includes(addon.id) ? "bg-blue-600" : "bg-slate-600"}>
                            ₹{addon.price}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{addon.description}</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedAddOns.includes(addon.id)
                            ? "border-blue-500 bg-blue-500"
                            : "border-slate-300"
                        }`}>
                          {selectedAddOns.includes(addon.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-xs text-slate-500">+{addon.pageCountAddition} pages</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="max-w-lg mx-auto">
                <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-slate-600">Your selection</p>
                        <p className="text-lg font-bold text-slate-900">
                          {plans.find(p => p.id === selectedPlanId)?.name}
                          {selectedAddOns.length > 0 && ` + ${selectedAddOns.length} add-on${selectedAddOns.length > 1 ? 's' : ''}`}
                        </p>
                        <p className="text-xs text-slate-500">{calculateTotalPages()} pages total</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-slate-900">
                          {calculateTotal() === 0 ? "Free" : `₹${calculateTotal().toLocaleString("en-IN")}`}
                        </p>
                        {calculateTotal() > 0 && <p className="text-xs text-slate-500">one-time</p>}
                      </div>
                    </div>
                    <Button
                      onClick={handleContinueCheckout}
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-5 text-lg"
                    >
                      {calculateTotal() === 0 ? "Get Free Blueprint" : "Continue to Checkout"}
                      <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
