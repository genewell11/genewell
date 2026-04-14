import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { getLanguage, setLanguage, type Language } from "@/lib/translations";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const [lang, setLang] = useState<Language>(getLanguage());

  useEffect(() => {
    const handler = () => setLang(getLanguage());
    window.addEventListener("languageChange", handler);
    return () => window.removeEventListener("languageChange", handler);
  }, []);

  const toggle = () => {
    const newLang = lang === "en" ? "hi" : "en";
    setLanguage(newLang);
    setLang(newLang);
    window.location.reload();
  };

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors ${className}`}
      title={lang === "en" ? "Switch to Hindi" : "Switch to English"}
    >
      <Globe className="h-4 w-4" />
      {lang === "en" ? "हिन्दी" : "English"}
    </button>
  );
}
