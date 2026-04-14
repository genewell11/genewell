import { useState, useRef, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import {
  Dna,
  Upload,
  Shield,
  CheckCircle,
  FileText,
  Lock,
  ArrowLeft,
  AlertCircle,
  X,
  Eye,
  Download,
} from "lucide-react";
import { DNAUpload, DNAProcessingResponse } from "@shared/api";

interface UploadedFile {
  file: File;
  provider: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
  processingId?: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingConsent, setProcessingConsent] = useState(false);
  const [deleteAfterProcessing, setDeleteAfterProcessing] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("auth_token");
    setIsAuthenticated(!!token);
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const validTypes = [".txt", ".csv", ".tsv"];
    const maxSize = 50 * 1024 * 1024; // 50MB

    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (!validTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: "Please upload a valid DNA file (.txt, .csv, or .tsv)",
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: "File size must be less than 50MB",
      };
    }

    if (file.size < 1000) {
      return {
        valid: false,
        error: "File appears to be too small to be a valid DNA report",
      };
    }

    return { valid: true };
  };

  const detectProvider = (fileName: string, fileContent?: string): string => {
    const name = fileName.toLowerCase();

    if (name.includes("23andme") || name.includes("23_and_me")) {
      return "23andme";
    }
    if (name.includes("ancestry")) {
      return "ancestrydna";
    }
    if (name.includes("myheritage")) {
      return "myheritage";
    }
    if (name.includes("ftdna") || name.includes("familytreedna")) {
      return "ftdna";
    }

    // Try to detect from content if available
    if (fileContent) {
      if (fileContent.includes("23andMe") || fileContent.includes("# rsid")) {
        return "23andme";
      }
      if (fileContent.includes("AncestryDNA")) {
        return "ancestrydna";
      }
      if (fileContent.includes("MyHeritage")) {
        return "myheritage";
      }
    }

    return "other";
  };

  const handleFileSelect = (file: File) => {
    setError("");
    setSuccess("");

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    const provider = detectProvider(file.name);

    setUploadedFile({
      file,
      provider,
      progress: 0,
      status: "uploading",
    });

    // Simulate file reading for provider detection
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const detectedProvider = detectProvider(
        file.name,
        content?.substring(0, 1000),
      );

      setUploadedFile((prev) =>
        prev
          ? {
              ...prev,
              provider: detectedProvider,
            }
          : null,
      );
    };
    reader.readAsText(file.slice(0, 1000)); // Read first 1KB for provider detection
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async () => {
    if (!uploadedFile || !processingConsent || !privacyAccepted) {
      setError("Please complete all required fields");
      return;
    }

    if (!isAuthenticated) {
      setError("Please login to upload DNA files");
      navigate("/login");
      return;
    }

    setError("");
    setUploadedFile((prev) =>
      prev ? { ...prev, status: "processing" } : null,
    );

    try {
      const token = localStorage.getItem("auth_token");
      const uploadData: DNAUpload = {
        fileName: uploadedFile.file.name,
        fileSize: uploadedFile.file.size,
        provider: uploadedFile.provider as any,
        processingConsent,
        deleteAfterProcessing,
      };

      const response = await fetch("/api/dna/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(uploadData),
      });

      const data: DNAProcessingResponse = await response.json();

      if (data.success) {
        setUploadedFile((prev) =>
          prev
            ? {
                ...prev,
                status: "complete",
                processingId: data.processingId,
              }
            : null,
        );

        setSuccess(
          `File uploaded successfully! Analysis will be ready in approximately ${Math.floor(data.estimatedTime / 60)} minutes.`,
        );

        // Simulate progress updates
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          }
          setUploadedFile((prev) => (prev ? { ...prev, progress } : null));
        }, 1000);
      } else {
        setError(data.message || "Upload failed");
        setUploadedFile((prev) => (prev ? { ...prev, status: "error" } : null));
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setUploadedFile((prev) => (prev ? { ...prev, status: "error" } : null));
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setError("");
    setSuccess("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
            <div className="flex items-center space-x-4">
              {!isAuthenticated && (
                <Link to="/login">
                  <Button variant="outline">Login First</Button>
                </Link>
              )}
              <Link to="/">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-wellness-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="text-wellness-600 font-medium">Upload DNA</span>
            </div>
            <div
              className={`flex items-center space-x-2 ${
                uploadedFile?.status === "processing"
                  ? "text-wellness-600"
                  : "opacity-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  uploadedFile?.status === "processing"
                    ? "bg-wellness-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                2
              </div>
              <span>Analysis</span>
            </div>
            <div
              className={`flex items-center space-x-2 ${
                uploadedFile?.status === "complete"
                  ? "text-wellness-600"
                  : "opacity-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  uploadedFile?.status === "complete"
                    ? "bg-wellness-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                3
              </div>
              <span>Results</span>
            </div>
          </div>
          <Progress
            value={
              !uploadedFile
                ? 10
                : uploadedFile.status === "uploading"
                  ? 33
                  : uploadedFile.status === "processing"
                    ? 33 + uploadedFile.progress * 0.6
                    : 100
            }
            className="h-2"
          />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-wellness-900 mb-4">
            Upload Your DNA Data
          </h1>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Zero-knowledge processing ensures your genetic data never leaves
            your control
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-wellness-200 bg-wellness-50">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-wellness-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="border-wellness-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-wellness-600" />
                <span>Upload DNA File</span>
              </CardTitle>
              <CardDescription>
                Drag and drop your genetic data file or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area */}
              {!uploadedFile ? (
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                    dragActive
                      ? "border-wellness-400 bg-wellness-50"
                      : "border-wellness-300 hover:border-wellness-400"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDrag}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-wellness-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-wellness-900 mb-2">
                    Drop your DNA file here
                  </h3>
                  <p className="text-foreground/70 mb-4">
                    Or click to select a file from your computer
                  </p>
                  <Button className="bg-wellness-gradient">Choose File</Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.tsv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-wellness-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-wellness-600" />
                      <div>
                        <h4 className="font-medium text-wellness-900">
                          {uploadedFile.file.name}
                        </h4>
                        <p className="text-sm text-foreground/70">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                          •{" "}
                          {uploadedFile.provider === "23andme"
                            ? "23andMe"
                            : uploadedFile.provider === "ancestrydna"
                              ? "AncestryDNA"
                              : uploadedFile.provider === "myheritage"
                                ? "MyHeritage"
                                : uploadedFile.provider === "ftdna"
                                  ? "FTDNA"
                                  : "Unknown Provider"}
                        </p>
                      </div>
                    </div>
                    {uploadedFile.status !== "processing" && (
                      <Button variant="ghost" size="sm" onClick={removeFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {uploadedFile.status === "processing" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing...</span>
                        <span>{Math.floor(uploadedFile.progress)}%</span>
                      </div>
                      <Progress value={uploadedFile.progress} className="h-2" />
                    </div>
                  )}

                  {uploadedFile.status === "complete" && (
                    <div className="flex items-center space-x-2 text-wellness-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Upload Complete</span>
                    </div>
                  )}
                </div>
              )}

              {/* Supported Formats */}
              <div className="space-y-3">
                <h4 className="font-medium text-wellness-900">
                  Supported formats:
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Badge
                    variant="outline"
                    className="justify-center border-wellness-200"
                  >
                    23andMe (.txt)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="justify-center border-wellness-200"
                  >
                    AncestryDNA (.txt)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="justify-center border-wellness-200"
                  >
                    MyHeritage (.csv)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="justify-center border-wellness-200"
                  >
                    FTDNA (.csv)
                  </Badge>
                </div>
              </div>

              {/* Privacy Controls */}
              <div className="space-y-4 p-4 bg-wellness-50 rounded-lg">
                <h4 className="font-medium text-wellness-900 flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Zero-Knowledge Processing</span>
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="processing-consent"
                      checked={processingConsent}
                      onCheckedChange={(checked) =>
                        setProcessingConsent(checked as boolean)
                      }
                    />
                    <Label htmlFor="processing-consent" className="text-sm">
                      I consent to genetic analysis for personalized
                      recommendations
                    </Label>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="delete-toggle"
                      className="text-sm font-medium"
                    >
                      Delete file after processing
                    </Label>
                    <Switch
                      id="delete-toggle"
                      checked={deleteAfterProcessing}
                      onCheckedChange={setDeleteAfterProcessing}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="privacy-policy"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) =>
                        setPrivacyAccepted(checked as boolean)
                      }
                    />
                    <Label htmlFor="privacy-policy" className="text-sm">
                      I agree to the{" "}
                      <Link
                        to="/privacy"
                        className="text-wellness-600 hover:underline"
                      >
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Info */}
          <div className="space-y-6">
            <Card className="border-wellness-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-wellness-600" />
                  <span>Your DNA, Your Control</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-wellness-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-wellness-900">
                      Zero-knowledge processing
                    </h4>
                    <p className="text-sm text-foreground/70">
                      Your raw DNA data is processed locally and never stored on
                      our servers
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-wellness-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-wellness-900">
                      End-to-end encryption
                    </h4>
                    <p className="text-sm text-foreground/70">
                      All data transmission uses military-grade encryption
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-wellness-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-wellness-900">
                      GDPR & DPDP compliant
                    </h4>
                    <p className="text-sm text-foreground/70">
                      Full compliance with global data protection regulations
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-wellness-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-wellness-900">
                      Never shared or sold
                    </h4>
                    <p className="text-sm text-foreground/70">
                      Your genetic data is never shared with third parties
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-wellness-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-wellness-600" />
                  <span>What Happens Next?</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-wellness-100 text-wellness-600 rounded-full flex items-center justify-center text-xs font-medium">
                    1
                  </div>
                  <span className="text-sm">
                    Secure analysis of 500+ genetic markers
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-wellness-100 text-wellness-600 rounded-full flex items-center justify-center text-xs font-medium">
                    2
                  </div>
                  <span className="text-sm">
                    AI generates personalized recommendations
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-wellness-100 text-wellness-600 rounded-full flex items-center justify-center text-xs font-medium">
                    3
                  </div>
                  <span className="text-sm">
                    Download your wellness dashboard and reports
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sample Report Preview */}
            <Card className="border-wellness-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-wellness-600" />
                  <span>Sample Report Preview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/70 mb-3">
                  See what your personalized wellness report will look like
                </p>
                <Link to="/demo">
                  <Button variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    View Sample Report
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Continue Button */}
        <div className="text-center mt-12">
          <Button
            size="lg"
            className="bg-wellness-gradient px-8 py-6 text-lg"
            onClick={processFile}
            disabled={
              !uploadedFile ||
              !processingConsent ||
              !privacyAccepted ||
              uploadedFile.status === "processing"
            }
          >
            {uploadedFile?.status === "processing" ? (
              <>
                <Lock className="mr-2 h-5 w-5 animate-pulse" />
                Processing DNA Data...
              </>
            ) : uploadedFile?.status === "complete" ? (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Continue to Dashboard
              </>
            ) : (
              <>
                <Lock className="mr-2 h-5 w-5" />
                Start Secure Analysis
              </>
            )}
          </Button>

          {(!processingConsent || !privacyAccepted || !uploadedFile) && (
            <p className="text-sm text-foreground/70 mt-2">
              Please complete all requirements above
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
