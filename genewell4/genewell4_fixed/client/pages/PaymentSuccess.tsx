import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  AlertCircle,
  Loader,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LegalFooter from '@/components/LegalFooter';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const purchaseId = searchParams.get('purchase_id');
        const paymentRequestId = searchParams.get('payment_request_id');
        const paymentStatus = searchParams.get('payment_status');

        const configuration = JSON.parse(localStorage.getItem('planConfiguration') || '{}');

        if (paymentStatus === 'Credit' || paymentStatus === 'completed') {
          localStorage.setItem('paymentVerified', 'true');
          if (purchaseId) localStorage.setItem('lastPurchaseId', purchaseId);
          setStatus('success');
          setTimeout(() => {
            navigate('/download', {
              state: {
                planId: configuration.planId,
                addOns: configuration.selectedAddOns,
              },
            });
          }, 2000);
          return;
        }

        if (!purchaseId) {
          if (configuration.planId) {
            localStorage.setItem('paymentVerified', 'true');
            setStatus('success');
            setTimeout(() => {
              navigate('/download', {
                state: {
                  planId: configuration.planId,
                  addOns: configuration.selectedAddOns,
                },
              });
            }, 2000);
            return;
          }
          throw new Error('No purchase information found');
        }

        const response = await fetch(`/api/payments/verify/${purchaseId}`);
        
        if (!response.ok) {
          throw new Error('Failed to verify payment');
        }

        const result = await response.json();

        if (!result.isCompleted) {
          throw new Error(`Payment status: ${result.status}`);
        }

        localStorage.setItem('paymentVerified', 'true');
        localStorage.setItem('lastPurchaseId', purchaseId);
        
        setStatus('success');

        setTimeout(() => {
          navigate('/download', {
            state: {
              planId: configuration.planId,
              addOns: configuration.selectedAddOns,
            },
          });
        }, 2000);
      } catch (err) {
        console.error('Payment verification error:', err);
        setError(err instanceof Error ? err.message : 'Payment verification failed');
        setStatus('error');
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-blue-900">Genewell</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md w-full px-4 sm:px-6 lg:px-8">
          {status === 'verifying' && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin mb-6">
                  <Loader className="h-16 w-16 text-blue-600 mx-auto" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Verifying Payment
                </h1>
                <p className="text-slate-600">
                  Please wait while we confirm your payment...
                </p>
              </CardContent>
            </Card>
          )}

          {status === 'success' && (
            <Card className="border-2 border-green-500">
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Payment Successful! ✓
                </h1>
                <p className="text-slate-600 mb-4">
                  Thank you for your purchase. Your personalized wellness report is being prepared.
                </p>
                <Alert className="bg-green-50 border-green-200 mb-6">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 ml-2">
                    A confirmation email has been sent to your registered email address.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-slate-500">
                  Redirecting to your report in a moment...
                </p>
              </CardContent>
            </Card>
          )}

          {status === 'error' && (
            <Card className="border-2 border-red-500">
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Payment Verification Failed
                </h1>
                <Alert className="bg-red-50 border-red-200 mb-6">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 ml-2">
                    {error || 'We were unable to verify your payment. Please try again.'}
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Button
                    onClick={() => navigate('/checkout')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={() => navigate('/pricing')}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Plans
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-6">
                  If you were charged but still see this error, please contact our support team at support@genewell.com
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <LegalFooter />
    </div>
  );
}
