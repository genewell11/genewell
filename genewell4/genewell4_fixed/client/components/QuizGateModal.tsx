import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Brain, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuizGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
}

export default function QuizGateModal({
  isOpen,
  onClose,
  productName = "this product",
}: QuizGateModalProps) {
  const navigate = useNavigate();

  const handleStartQuiz = () => {
    navigate("/quiz");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-0 shadow-2xl scale-[0.80]">
        <DialogHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Complete Your Wellness Quiz
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 mt-3">
            To access {productName}, you need to complete our personalized
            wellness quiz. It takes just 3 minutes and helps us create your
            customized wellness blueprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Why take the quiz?</span>
              <br />
              Our AI analyzes your unique body, habits, and goals to create a
              personalized wellness plan that actually works for you.
            </p>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⏱️</span>
              <span>Takes only 3 minutes</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎯</span>
              <span>Personalized results instantly</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">🔒</span>
              <span>Your data is secure & private</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Button
            onClick={handleStartQuiz}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 text-lg font-semibold"
          >
            <Brain className="mr-2 h-5 w-5" />
            Start Free Quiz Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-900"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
