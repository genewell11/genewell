import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Dna,
  ArrowLeft,
  Construction,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  comingSoon?: boolean;
}

export default function PlaceholderPage({
  title,
  description,
  comingSoon = false,
}: PlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-wellness-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md">
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
            <div className="flex items-center space-x-2">
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-wellness-600 hover:text-wellness-700 hover:bg-wellness-50">
                  <Dna className="mr-2 h-4 w-4" /> HOME
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="w-24 h-24 bg-wellness-gradient rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Construction className="h-12 w-12 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-wellness-900 mb-4">
            {title}
          </h1>
          <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto">
            {description}
          </p>

          {comingSoon && (
            <div className="bg-wellness-100 border border-wellness-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-wellness-900 mb-2">
                Coming Soon!
              </h3>
              <p className="text-foreground/70">
                We're working hard to bring you this feature. Stay tuned for
                updates!
              </p>
            </div>
          )}

          <Card className="max-w-lg mx-auto border-wellness-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-wellness-600" />
                <span>Need Help Building This Page?</span>
              </CardTitle>
              <CardDescription>
                Let me know what specific features or content you'd like to see
                on this page, and I'll help you build it out!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-left space-y-2">
                <p className="text-sm text-foreground/70">
                  You can ask me to create:
                </p>
                <ul className="text-sm text-foreground/70 space-y-1 list-disc list-inside">
                  <li>User dashboards and analytics</li>
                  <li>Authentication and user management</li>
                  <li>Data visualization and reports</li>
                  <li>Interactive forms and workflows</li>
                  <li>Any other features you need</li>
                </ul>
              </div>

              <div className="flex flex-col space-y-3">
                <Link to="/upload">
                  <Button className="w-full bg-wellness-gradient">
                    Start with DNA Upload
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline" className="w-full">
                    Return to Homepage
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
