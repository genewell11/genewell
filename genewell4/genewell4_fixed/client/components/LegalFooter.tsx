import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { X, ShieldAlert } from "lucide-react";

export default function LegalFooter() {
  const [openModal, setOpenModal] = useState<string | null>(null);

  const legalContent = {
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "January 2024",
      sections: [
        {
          heading: "1. Data Collection",
          content:
            "We collect health, lifestyle, and optional genetic data you provide through our quiz. Your DNA data is processed using zero-knowledge architecture and never permanently stored without consent.",
        },
        {
          heading: "2. Data Protection",
          content:
            "All data is encrypted with 256-bit SSL/TLS during transmission and at rest. We comply with GDPR, CCPA, and other global privacy regulations. Your genetic information is protected with bank-level security.",
        },
        {
          heading: "3. How We Use Your Data",
          content:
            "Your data is used exclusively to generate personalized wellness recommendations. We never sell your data to third parties. With your consent, we may use anonymized data for research to improve our algorithms.",
        },
        {
          heading: "4. Third-Party Services",
          content:
            "We use secure third-party services for payment processing (Stripe), email delivery, and cloud storage. All partners are vetted for GDPR and privacy compliance.",
        },
        {
          heading: "5. Your Rights",
          content:
            "You have the right to access, modify, or delete your data at any time. Contact privacy@genewell.com to exercise your rights. We respond within 30 days.",
        },
        {
          heading: "6. Cookies",
          content:
            "We use essential cookies for authentication and optional cookies for analytics. You can control cookies in your browser settings.",
        },
      ],
    },
    shipping: {
      title: "Shipping & Delivery",
      sections: [
        {
          heading: "Digital Products",
          content:
            "All Genewell products are digital. Your wellness blueprint is delivered instantly via download and email after payment confirmation. No physical shipping required.",
        },
        {
          heading: "Delivery Timeline",
          content:
            "Premium Analysis: 2-4 hours processing time. Complete Transformation: 4-6 hours for personalized coaching assignment. You receive a tracking email with status updates.",
        },
        {
          heading: "DNA Testing Kit Orders",
          content:
            "If ordering a DNA testing kit (optional add-on): Standard shipping takes 5-7 business days. Express delivery available for ₹499. Shipments are tracked via courier email.",
        },
        {
          heading: "International Shipping",
          content:
            "We currently ship DNA kits to India, US, UK, Canada, and Australia. Additional countries coming soon. International orders include customs clearance assistance.",
        },
        {
          heading: "Delivery Guarantee",
          content:
            "Digital downloads guaranteed within 24 hours or we provide full refund + ₹500 credit. Physical kits guaranteed within 10 days or refund applies.",
        },
      ],
    },
    refund: {
      title: "Refund & Returns Policy",
      sections: [
        {
          heading: "30-Day Money-Back Guarantee",
          content:
            "Not satisfied with your wellness blueprint? Get a full refund within 30 days of purchase. No questions asked. Just email support@genewell.com with your order ID.",
        },
        {
          heading: "Refund Processing",
          content:
            "Refunds are processed within 5-7 business days after approval. The refunded amount goes back to your original payment method. You'll receive a confirmation email once processed.",
        },
        {
          heading: "Subscription Cancellation",
          content:
            "Cancel your Premium or Pro subscription anytime. You'll maintain access until the end of your billing period. No cancellation fees.",
        },
        {
          heading: "DNA Kit Returns",
          content:
            "Unopened DNA kits can be returned within 14 days for full refund. Return shipping is prepaid. Used kits cannot be returned for health/safety reasons.",
        },
        {
          heading: "Refund Ineligibility",
          content:
            "Refunds cannot be issued for: duplicate purchases (due to user error), services already fully utilized, or after 30 days. Promotional credits are non-refundable.",
        },
        {
          heading: "Partial Refunds",
          content:
            "If using multiple plans simultaneously, you can request prorated refunds for specific services. We calculate refunds based on unused service days.",
        },
      ],
    },
    terms: {
      title: "Terms & Conditions",
      lastUpdated: "January 2024",
      sections: [
        {
          heading: "1. Acceptance of Terms",
          content:
            "By using Genewell, you agree to these terms and conditions. If you don't agree, please don't use our service.",
        },
        {
          heading: "2. Medical Disclaimer",
          content:
            "Genewell provides health insights based on genetics and lifestyle data. Our recommendations are NOT a substitute for professional medical advice. Always consult healthcare professionals for medical decisions.",
        },
        {
          heading: "3. Service Description",
          content:
            "Genewell offers personalized wellness analysis through a health quiz, optional DNA analysis, and AI-powered recommendations. Services vary by plan level.",
        },
        {
          heading: "4. Age & Eligibility",
          content:
            "You must be at least 18 years old to use Genewell. If under 18, parents/guardians must provide consent.",
        },
        {
          heading: "5. Payment Terms",
          content:
            "Payment is due upfront. Subscriptions auto-renew monthly or yearly unless canceled. You can cancel anytime before renewal. Late payments may result in service suspension.",
        },
        {
          heading: "6. Intellectual Property",
          content:
            "Your personalized blueprints are for personal use only. You may not copy, share, or resell them without permission. Genewell retains all software and algorithm rights.",
        },
        {
          heading: "7. Limitation of Liability",
          content:
            "Genewell is not liable for any indirect, incidental, or consequential damages. Our liability is limited to refund amount.",
        },
        {
          heading: "8. Changes to Terms",
          content:
            "We may update these terms anytime. Continued use after updates means you accept new terms. We'll notify you of major changes via email.",
        },
      ],
    },
  };

  const renderModal = (key: keyof typeof legalContent) => {
    const content = legalContent[key];
    return (
      <Dialog
        open={openModal === key}
        onOpenChange={(open) => !open && setOpenModal(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {content.title}
            </DialogTitle>
            {"lastUpdated" in content && (
              <DialogDescription className="text-xs mt-1">
                Last updated: {content.lastUpdated}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {content.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="font-bold text-gray-900 mb-2">
                  {section.heading}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <p>For detailed questions, contact legal@genewell.com</p>
          </div>

          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="/#how-it-works" className="hover:text-white transition">
                    About Genewell
                  </a>
                </li>
                <li>
                  <a href="/#science" className="hover:text-white transition">
                    Our Mission
                  </a>
                </li>
                <li>
                  <a href="/#results" className="hover:text-white transition">
                    Our Plans
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center space-x-2">
                  <span>📞</span>
                  <a
                    href="tel:8009785785"
                    className="hover:text-white transition"
                  >
                    8009785785
                  </a>
                </li>
                <li className="flex items-center space-x-2">
                  <span>📧</span>
                  <a
                    href="mailto:support@genewell.com"
                    className="hover:text-white transition"
                  >
                    support@genewell.com
                  </a>
                </li>
                <li>
                  <a href="/#how-it-works" className="hover:text-white transition">
                    Help Center
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Wellness Programs</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a
                    href="/#science"
                    className="hover:text-white transition"
                  >
                    Genetic Analysis
                  </a>
                </li>
                <li>
                  <a href="/#how-it-works" className="hover:text-white transition">
                    Nutrition Planning
                  </a>
                </li>
                <li>
                  <a href="/pricing" className="hover:text-white transition">
                    Fitness Coaching
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Connect With Us</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a
                    href="https://instagram.com"
                    className="hover:text-white transition"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    className="hover:text-white transition"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com"
                    className="hover:text-white transition"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twitter/X
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="text-sm text-gray-400">
                © 2025 Genewell Health. All rights reserved.
              </div>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <button
                  onClick={() => setOpenModal("privacy")}
                  className="text-gray-400 hover:text-white transition"
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => setOpenModal("terms")}
                  className="text-gray-400 hover:text-white transition"
                >
                  Terms of Service
                </button>
                <button
                  onClick={() => setOpenModal("shipping")}
                  className="text-gray-400 hover:text-white transition"
                >
                  Shipping
                </button>
                <button
                  onClick={() => setOpenModal("refund")}
                  className="text-gray-400 hover:text-white transition"
                >
                  Refunds
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldAlert className="h-3 w-3" />
              <span>
                All data encrypted with 256-bit SSL. Compliant with GDPR, CCPA,
                and HIPAA standards.
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {renderModal("privacy")}
      {renderModal("terms")}
      {renderModal("shipping")}
      {renderModal("refund")}
    </>
  );
}
