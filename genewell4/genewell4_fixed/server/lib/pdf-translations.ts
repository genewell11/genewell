// Hindi and English translations for PDF content
export const translations = {
  en: {
    coverTitle: "Your Wellness Blueprint",
    edition: "Edition — Science-Based & Fully Personalized",
    generated: "Generated",
    at: "at",
    orderId: "Order ID",
    planTier: "Plan Tier",
    age: "Age",
    gender: "Gender",
    height: "Height",
    weight: "Weight",
    dear: "Dear",
    blueprint_intro:
      "This personalized wellness blueprint is uniquely designed for you, based on your quiz answers, lifestyle, and goals. Every recommendation is science-backed and actionable. Follow the daily and weekly steps consistently, and you'll see measurable improvements within 30 days.",
    
    topActions: "Top 3 Actions This Week",
    topActionsSubtitle:
      "Start here—these three changes will have the biggest impact on your energy and results",
    action1Title: "1. Lock Your Wake Time",
    action1Desc:
      "Wake at {time} AM every day (including weekends) for 30 days. This single action resets your circadian rhythm and improves sleep quality within days.",
    action2Title: "2. Eat Within a 10–12 Hour Window",
    action2Desc:
      "Breakfast: {breakfast} | Dinner: {dinner} | Stop eating after {dinner}. This simple timing synchronizes your metabolism and digestion.",
    action3Title: "3. Move for 20–30 Minutes, 3x This Week",
    action3Desc:
      "Any movement counts: walk, yoga, gym, dancing. Research shows this alone reduces stress by 40%, increases energy, and improves sleep. Start with what feels easy.",
    proTip:
      "💡 Pro Tip: These three actions work together. Lock your wake time first (it sets everything else). Add meal timing in week 2. Add movement in week 3. Small steps, big results.",
    
    executiveSummary: "Executive Summary",
    yourAnalysis: "Your Personalized Wellness Analysis",
    
    sleepOptimization: "Sleep Optimization Protocol",
    stressManagement: "Stress Management & Nervous System Optimization",
    movement: "Movement & Training Plan",
    supplements: "Smart Supplement Strategy",
    
    freeBlueprint: "Free Edition",
    essentialBlueprint: "Essential Edition",
    premiumBlueprint: "Premium Edition",
    coachingBlueprint: "Complete Coaching Edition",
  },
  hi: {
    coverTitle: "आपकी वेलनेस ब्लूप्रिंट",
    edition: "संस्करण — विज्ञान-आधारित और पूरी तरह से व्यक्तिगत",
    generated: "तैयार किया गया",
    at: "को",
    orderId: "ऑर्डर आईडी",
    planTier: "योजना स्तर",
    age: "आयु",
    gender: "लिंग",
    height: "ऊंचाई",
    weight: "वजन",
    dear: "प्रिय",
    blueprint_intro:
      "यह व्यक्तिगत वेलनेस ब्लूप्रिंट आपके लिए विशेष रूप से डिज़ाइन किया गया है, आपके क्विज़ उत्तरों, जीवनशैली और लक्ष्यों के आधार पर। हर सिफारिश विज्ञान-आधारित और कार्यान्वयन योग्य है। दैनिक और साप्ताहिक चरणों को लगातार अनुसरण करें, और आप 30 दिनों में मापने योग्य सुधार देखेंगे।",
    
    topActions: "इस सप्ताह के शीर्ष 3 कार्य",
    topActionsSubtitle:
      "यहां शुरू करें—ये तीन परिवर्तन आपकी ऊर्जा और परिणामों पर सबसे बड़ा प्रभाव डालेंगे",
    action1Title: "1. अपना जागने का समय निर्धारित करें",
    action1Desc:
      "हर दिन (सप्ताहांत सहित) {time} AM पर जागें। यह एकल कार्य आपकी सर्कैडियन लय को रीसेट करता है और नींद की गुणवत्ता में कुछ दिनों में सुधार करता है।",
    action2Title: "2. 10-12 घंटे की खिड़की के भीतर खाएं",
    action2Desc:
      "नाश्ता: {breakfast} | रात का खाना: {dinner} | {dinner} के बाद खाना बंद करें। यह सरल समय आपके चयापचय और पाचन को सिंक्रोनाइज करता है।",
    action3Title: "3. सप्ताह में 3x 20-30 मिनट चलें",
    action3Desc:
      "कोई भी आंदोलन गिनता है: चलना, योग, जिम, नृत्य। अनुसंधान से पता चलता है कि यह अकेले तनाव को 40% तक कम करता है, ऊर्जा बढ़ाता है, और नींद में सुधार करता है।",
    proTip:
      "💡 पेशेवर सुझाव: ये तीन कार्य एक साथ काम करते हैं। पहले अपना जागने का समय निर्धारित करें। सप्ताह 2 में भोजन समय जोड़ें। सप्ताह 3 में आंदोलन जोड़ें।",
    
    executiveSummary: "कार्यकारी सारांश",
    yourAnalysis: "आपका व्यक्तिगत वेलनेस विश्लेषण",
    
    sleepOptimization: "नींद अनुकूलन प्रोटोकॉल",
    stressManagement: "तनाव प्रबंधन और तंत्रिका तंत्र अनुकूलन",
    movement: "आंदोलन और प्रशिक्षण योजना",
    supplements: "स्मार्ट पूरक रणनीति",
    
    freeBlueprint: "मुफ्त संस्करण",
    essentialBlueprint: "आवश्यक संस्करण",
    premiumBlueprint: "प्रीमियम संस्करण",
    coachingBlueprint: "पूर्ण कोचिंग संस्करण",
  },
};

export type Language = "en" | "hi";

export function t(key: keyof (typeof translations)["en"], language: Language = "en"): string {
  return translations[language][key as any] || translations.en[key as any] || key;
}
