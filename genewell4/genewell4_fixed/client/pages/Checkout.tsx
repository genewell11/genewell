import { useNavigate, useLocation } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  ArrowLeft,
  Check,
  Lock,
  Zap,
  AlertCircle,
  ChevronRight,
  Gift,
  Clock,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getProductByPlanId,
  getAddOnById,
  PlanConfiguration,
} from "@/lib/products";
import LegalFooter from "@/components/LegalFooter";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const configuration: PlanConfiguration | null =
    location.state?.configuration ||
    JSON.parse(localStorage.getItem("planConfiguration") || "null");

  if (!configuration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              No Plan Selected
            </h1>
            <p className="text-slate-600 mb-6">
              Please select a plan to continue
            </p>
            <Button
              onClick={() => navigate("/pricing")}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Back to Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = getProductByPlanId(configuration.planId);
  const selectedAddOns = configuration.selectedAddOns
    .map((id) => getAddOnById(id))
    .filter(Boolean);

  const handlePayWithInstamojo = async () => {
    // Subscription plan → direct Instamojo redirect (no server round-trip needed)
    if (configuration.planId === "subscription_all_access") {
      const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");
      const params = new URLSearchParams({
        data_amount: "1999",
        data_purpose: "GeneWell All Access — 45-Day Launch Offer",
        data_email: quizData.userEmail || "",
        data_name: quizData.userName || "",
        data_phone: quizData.phone || "",
      });
      window.open(`https://www.instamojo.com/@famechase/?${params.toString()}`, "_blank");
      return;
    }

    setIsProcessing(true);

    try {
      const analysisId = localStorage.getItem("analysisId");
      const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");

      if (!analysisId) {
        throw new Error("Analysis ID not found. Please complete the quiz first.");
      }

      // Store configuration for download page
      localStorage.setItem(
        "activeConfiguration",
        JSON.stringify(configuration)
      );

      // Create direct payment link
      const response = await fetch("/api/payments/create-direct-payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: quizData.userEmail || "noemail@genewell.local",
          name: quizData.userName || "User",
          phone: quizData.phone || "9999999999",
          age: parseInt(quizData.age) || null,
          gender: quizData.gender || null,
          analysisId,
          planId: configuration.planId,
          addOns: configuration.selectedAddOns,
          amount: configuration.totalPrice,
          quizData,
          personalizationData: JSON.parse(localStorage.getItem("personalizationData") || "{}"),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create payment link");
      }

      const { paymentUrl, purchaseId } = await response.json();

      localStorage.setItem("currentPurchaseId", purchaseId.toString());

      window.location.href = paymentUrl;
    } catch (err) {
      console.error("Payment error:", err);
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLaunchOfferBypass = async () => {
    setIsProcessing(true);

    try {
      const analysisId = localStorage.getItem("analysisId");
      const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");

      if (!analysisId) {
        throw new Error("Analysis ID not found. Please complete the quiz first.");
      }

      // Store configuration for download page
      localStorage.setItem(
        "activeConfiguration",
        JSON.stringify(configuration)
      );

      // Store launch offer expiry date (45 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 45);
      localStorage.setItem("launchOfferExpiry", expiryDate.toISOString());
      localStorage.setItem("purchaseMethod", "launch-offer");

      // Redirect to download page
      navigate("/download", { state: { planId: configuration.planId, addOns: configuration.selectedAddOns } });
    } catch (err) {
      console.error("Launch offer error:", err);
      alert(err instanceof Error ? err.message : "Failed to process launch offer");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteCheckout = async () => {
    setIsProcessing(true);

    try {
      const analysisId = localStorage.getItem("analysisId");
      const quizData = JSON.parse(localStorage.getItem("quizData") || "{}");

      if (!analysisId) {
        throw new Error("Analysis ID not found. Please complete the quiz first.");
      }

      // Store configuration for download page
      localStorage.setItem(
        "activeConfiguration",
        JSON.stringify(configuration)
      );

      // For free plan, skip payment and go directly to download
      if (configuration.totalPrice === 0) {
        navigate("/download", { state: { planId: configuration.planId, addOns: configuration.selectedAddOns } });
      } else {
        // Default to Instamojo payment
        await handlePayWithInstamojo();
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Plan Not Found
            </h1>
            <p className="text-slate-600 mb-6">
              The selected plan could not be loaded
            </p>
            <Button
              onClick={() => navigate("/pricing")}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Back to Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-blue-900">Genewell</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Zap className="mr-2 h-4 w-4" /> HOME
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plans
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Launch Offer Banner */}
          {configuration.totalPrice > 0 && (
            <div className="mb-8 bg-gradient-to-r from-purple-50 via-pink-50 to-red-50 border-2 border-purple-300 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Gift className="h-8 w-8 text-purple-600 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-purple-900 mb-2">
                    🚀 45-Day Launch Offer!
                  </h3>
                  <p className="text-purple-700 font-semibold mb-2">
                    All premium products are <span className="text-red-600">FREE for 45 days</span> (except Live Training & Coaching)
                  </p>
                  <p className="text-sm text-purple-600">
                    Get full access to your personalized blueprint immediately with our special launch offer
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Review Your Selection
            </h1>
            <p className="text-slate-600">
              You're about to get your personalized wellness blueprint
            </p>
          </div>

          {/* Plan Card */}
          <Card className="mb-6 border-2 border-blue-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl text-slate-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {plan.pageCount} pages personalized for you
                  </CardDescription>
                </div>
                <Badge className="bg-blue-600 text-white text-lg px-4 py-2">
                  {plan.pageCount} pages
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-slate-900 mb-3">
                  What's Included:
                </h3>
                <ul className="space-y-2">
                  {plan.details.map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-start space-x-3 text-slate-700"
                    >
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">Plan Price</p>
                    <p className="text-2xl font-bold text-slate-900">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                  {plan.price === 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Completely Free
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add-Ons Section */}
          {selectedAddOns.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl">Premium Add-Ons</CardTitle>
                <CardDescription>
                  {selectedAddOns.length} add-on{selectedAddOns.length !== 1 ? "s" : ""} selected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedAddOns.map((addon) => (
                    <div
                      key={addon!.id}
                      className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">
                          {addon!.name}
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                          +{addon!.pageCountAddition} pages to your report
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {addon!.description}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="font-semibold text-slate-900">
                          ₹{addon!.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card className="mb-6 border-2 border-blue-600">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-600">{plan.name}</span>
                  <span className="font-semibold text-slate-900">
                    ₹{plan.price.toLocaleString("en-IN")}
                  </span>
                </div>

                {selectedAddOns.map((addon) => (
                  <div key={addon!.id} className="flex justify-between">
                    <span className="text-slate-600">{addon!.name}</span>
                    <span className="font-semibold text-slate-900">
                      ₹{addon!.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg text-slate-900">
                      Total
                    </span>
                    <span className="text-3xl font-bold text-blue-600">
                      ₹{configuration.totalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">100% Secure</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Your data is encrypted and never shared
                    </p>
                  </div>
                </div>
              </div>

              {configuration.totalPrice === 0 ? (
                <Button
                  onClick={handleCompleteCheckout}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white font-semibold py-3 text-lg"
                >
                  {isProcessing ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      Get My Free Blueprint
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={handlePayWithInstamojo}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white font-semibold py-3 text-lg flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Pay with Instamojo
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleLaunchOfferBypass}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full border-2 border-purple-400 text-purple-700 hover:bg-purple-50 font-semibold py-3 text-lg flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-5 w-5" />
                        Get Free for 45 Days (Launch Offer)
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3 justify-center text-sm text-slate-600">
                <div className="flex items-center space-x-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>🔒 100% Secure</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>⚡ Instant Access</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>📱 Mobile Ready</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Note */}
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 ml-2">
              By proceeding, your quiz data will be used to personalize your PDF blueprint with your name, age, activity level, goals, and health considerations. Your data is encrypted and never shared.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Footer */}
      <LegalFooter />
    </div>
  );
}
