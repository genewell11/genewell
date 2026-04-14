import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Building2, User, Mail, Phone, Lock, ArrowRight, CheckCircle, Gift, Infinity } from "lucide-react";

export default function B2BRegister() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    businessName: "", contactName: "", email: "", phone: "", password: "", confirmPassword: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (mode === "register") {
      if (!form.businessName || !form.contactName || !form.email || !form.password)
        return setError("All fields are required.");
      if (form.password !== form.confirmPassword)
        return setError("Passwords do not match.");
      if (form.password.length < 6)
        return setError("Password must be at least 6 characters.");
    } else {
      if (!form.email || !form.password) return setError("Email and password required.");
    }

    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/api/b2b/register" : "/api/b2b/login";
      const body = mode === "register"
        ? { businessName: form.businessName, contactName: form.contactName, email: form.email, phone: form.phone, password: form.password }
        : { email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) return setError(data.message || "Something went wrong.");

      localStorage.setItem("b2bToken", data.token);
      localStorage.setItem("b2bClient", JSON.stringify(data.client));
      navigate("/b2b");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg text-purple-900">Genewell</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold ml-1">for Business</span>
          </Link>
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="text-purple-600">See Plans</Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-center">

          {/* Left: Value prop */}
          <div className="hidden lg:block">
            <div className="mb-8">
              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">B2B Subscription</span>
              <h1 className="text-4xl font-bold text-slate-900 mt-4 mb-4 leading-tight">
                Generate Personalized<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Wellness Reports</span><br />
                for Your Users
              </h1>
              <p className="text-slate-600 text-lg">
                One subscription. Unlimited quiz links. Every user gets a premium 35+ page personalized blueprint — free for them, managed by you.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Gift, title: "45-Day Free Trial", desc: "Full access, no credit card needed to start" },
                { icon: Infinity, title: "Unlimited Quiz Links", desc: "Generate a unique link for each of your users" },
                { icon: CheckCircle, title: "All Reports Included", desc: "Premium tier with all add-ons for every user" },
                { icon: Building2, title: "White-Label Ready", desc: "Your users see GeneWell reports under your brand" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{title}</p>
                    <p className="text-sm text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
              <p className="text-sm text-purple-800 font-semibold">💼 Perfect for:</p>
              <p className="text-sm text-purple-700 mt-1">Gyms · Corporates · Clinics · Dieticians · HR Teams · Wellness Coaches</p>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            <Card className="shadow-2xl border-0">
              <CardHeader className="pb-4">
                <div className="flex rounded-xl bg-slate-100 p-1 mb-2">
                  {(["register", "login"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(""); }}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === m ? "bg-white shadow text-purple-700" : "text-slate-500"}`}
                    >
                      {m === "register" ? "Start Free Trial" : "Sign In"}
                    </button>
                  ))}
                </div>
                <CardTitle className="text-xl">
                  {mode === "register" ? "Create Business Account" : "Welcome Back"}
                </CardTitle>
                <CardDescription>
                  {mode === "register"
                    ? "Free 45-day trial · No credit card required"
                    : "Sign in to your B2B dashboard"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {mode === "register" && (
                  <>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">Business / Organization / Professional Name *</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input placeholder="e.g. FitLife Gym, Apollo Clinic, Dr. Sharma (Nutritionist)" className="pl-9" value={form.businessName} onChange={set("businessName")} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">Your Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input placeholder="Contact person name" className="pl-9" value={form.contactName} onChange={set("contactName")} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 mb-1 block">Phone (optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input placeholder="+91 XXXXXXXXXX" className="pl-9" value={form.phone} onChange={set("phone")} />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Business Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input type="email" placeholder="you@company.com" className="pl-9" value={form.email} onChange={set("email")} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1 block">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input type="password" placeholder="Min. 6 characters" className="pl-9" value={form.password} onChange={set("password")} />
                  </div>
                </div>

                {mode === "register" && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">Confirm Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input type="password" placeholder="Repeat password" className="pl-9" value={form.confirmPassword} onChange={set("confirmPassword")} />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3"
                  size="lg"
                >
                  {loading ? "Please wait..." : mode === "register" ? "Start Free Trial →" : "Sign In →"}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                {mode === "register" && (
                  <p className="text-xs text-center text-slate-400 mt-2">
                    By registering you agree to our Terms of Service. No credit card required for trial.
                  </p>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-sm text-slate-500 mt-4">
              Individual user?{" "}
              <Link to="/quiz" className="text-purple-600 font-semibold hover:underline">Take the free quiz →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
