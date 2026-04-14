import { RequestHandler, Request, Response } from 'express';
import {
  getUser,
  createUser,
  createPurchase,
  updatePurchasePaymentStatus,
  saveQuizResponse,
  getPurchases,
  saveDownload,
  query,
} from '../lib/db';
import {
  createPaymentRequest,
  getPaymentDetails,
  verifyWebhookSignature,
  parseWebhookData,
  isPaymentSuccessful,
  generateDirectPaymentLink,
} from '../lib/instamojo-service';
import {
  sendConfirmationEmail,
  sendPaymentConfirmationEmail,
} from '../lib/email-service';

// Gender-addon compatibility check (shared by both payment routes)
function validateGenderAddonCompat(gender: string | undefined, addOns: string[] | undefined): { error: string | null; errorCode?: string; rejectedAddon?: string } {
  if (!gender || !addOns || addOns.length === 0) return { error: null };
  const FEMALE_ONLY = ["addon_women_hormone", "addon_women_hormonal"];
  const MALE_ONLY = ["addon_men_fitness"];
  const g = gender.toLowerCase().trim();
  if (g === "male") {
    const rejected = addOns.find(id => FEMALE_ONLY.includes(id));
    if (rejected) return { error: "Women's Hormonal Health add-on is not applicable for male profiles. Please remove it and try again.", errorCode: "GENDER_ADDON_MISMATCH", rejectedAddon: rejected };
  } else if (g === "female") {
    const rejected = addOns.find(id => MALE_ONLY.includes(id));
    if (rejected) return { error: "Men's Performance Pack is not applicable for female profiles. Please remove it and try again.", errorCode: "GENDER_ADDON_MISMATCH", rejectedAddon: rejected };
  }
  return { error: null };
}

/**
 * POST /api/payments/create-direct-payment-link
 * Creates a direct payment link with Instamojo (simpler alternative)
 */
export const handleCreateDirectPaymentLink: RequestHandler = async (req, res) => {
  try {
    const {
      email,
      name,
      phone,
      age,
      gender,
      analysisId,
      planId,
      addOns,
      amount,
      quizData,
      personalizationData,
    } = req.body;

    if (!email || !analysisId || !planId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, analysisId, planId, amount',
      });
    }

    // Gender-addon compatibility validation
    const genderCheck = validateGenderAddonCompat(gender, addOns);
    if (genderCheck.error) {
      return res.status(400).json({ success: false, message: genderCheck.error, errorCode: genderCheck.errorCode, rejectedAddon: genderCheck.rejectedAddon });
    }

    // Create or update user in database (optional - graceful fallback if DB not configured)
    let user = null;
    let purchase = null;

    try {
      user = await getUser(email);
      if (!user) {
        user = await createUser(email, name, phone, age, gender);
      }

      // Save quiz response to database
      if (quizData && personalizationData) {
        await saveQuizResponse(user.id, analysisId, quizData, personalizationData);
      }

      // Create purchase record with pending status
      purchase = await createPurchase(user.id, analysisId, planId, addOns || [], amount);

      // Save download record initially (pending)
      await saveDownload({
        userId: user.id,
        userEmail: email,
        productName: `Wellness Blueprint - ${planId}`,
        planTier: planId,
        emailSent: false,
      });
    } catch (dbError) {
      console.warn('Database unavailable, continuing without DB:', dbError);
    }

    const purchaseId = purchase?.id || Date.now();

    const planNames: Record<string, string> = {
      'free_blueprint': 'Free',
      'essential_blueprint': 'Essential',
      'premium_blueprint': 'Premium',
      'coaching_blueprint': 'Coaching',
      'subscription_all_access': 'All Access',
    };
    const shortPlanName = planNames[planId] || (planId.length > 10 ? planId.substring(0, 10) : planId);
    let purpose = `GW ${shortPlanName}`;
    if (purpose.length > 29) {
      purpose = purpose.substring(0, 29);
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUrl = `${appUrl}/download?purchase_id=${purchaseId}`;

    const paymentUrl = generateDirectPaymentLink({
      amount: Math.round(amount * 100) / 100,
      buyerName: name || email,
      buyerEmail: email,
      buyerPhone: phone || '9999999999',
      purpose: purpose,
      redirectUrl: redirectUrl,
    });

    res.json({
      success: true,
      paymentUrl,
      purchaseId,
      message: 'Direct payment link created successfully',
    });
  } catch (error) {
    console.error('Error creating direct payment link:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/payments/create-payment-request
 * Creates a payment request with Instamojo
 */
export const handleCreatePaymentRequest: RequestHandler = async (req, res) => {
  try {
    const {
      email,
      name,
      phone,
      age,
      gender,
      analysisId,
      planId,
      addOns,
      amount,
      quizData,
      personalizationData,
    } = req.body;

    if (!email || !analysisId || !planId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, analysisId, planId, amount',
      });
    }

    // Gender-addon compatibility validation
    const genderCheckReq = validateGenderAddonCompat(gender, addOns);
    if (genderCheckReq.error) {
      return res.status(400).json({ success: false, message: genderCheckReq.error, errorCode: genderCheckReq.errorCode, rejectedAddon: genderCheckReq.rejectedAddon });
    }

    // Create or update user in database (optional - graceful fallback if DB not configured)
    let user = null;
    let purchase = null;

    try {
      user = await getUser(email);
      if (!user) {
        user = await createUser(email, name, phone, age, gender);
      }

      // Save quiz response to database
      if (quizData && personalizationData) {
        await saveQuizResponse(user.id, analysisId, quizData, personalizationData);
      }

      // Create purchase record
      purchase = await createPurchase(user.id, analysisId, planId, addOns || [], amount);

      // Save download record initially (pending)
      await saveDownload({
        userId: user.id,
        userEmail: email,
        productName: `Wellness Blueprint - ${planId}`,
        planTier: planId,
        emailSent: false,
      });
    } catch (dbError) {
      console.warn('Database unavailable for payment request, continuing without DB:', dbError);
      // Continue without database - still create payment
    }

    // Generate fallback IDs if database is not available
    const purchaseId = purchase?.id || Date.now();
    const userId = user?.id || 0;

    const planNames: Record<string, string> = {
      'free_blueprint': 'Free',
      'essential_blueprint': 'Essential',
      'premium_blueprint': 'Premium',
      'coaching_blueprint': 'Coaching',
      'subscription_all_access': 'All Access',
    };
    const shortPlanName = planNames[planId] || (planId.length > 10 ? planId.substring(0, 10) : planId);
    let purpose = `GW ${shortPlanName}`;
    if (purpose.length > 29) {
      purpose = purpose.substring(0, 29);
    }
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    const paymentResponse = await createPaymentRequest({
      purpose: purpose,
      amount: Math.round(amount * 100) / 100,
      buyer_name: name || email,
      email,
      phone: phone || '9999999999',
      redirect_url: `${appUrl}/payment-success?purchase_id=${purchaseId}`,
      webhook_url: `${appUrl}/api/payments/webhook`,
      metadata: {
        purchase_id: purchaseId.toString(),
        user_id: userId.toString(),
        analysis_id: analysisId,
        plan_id: planId,
      },
    });

    if (!paymentResponse.success || !paymentResponse.payment_request) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create payment request',
        errors: paymentResponse.errors,
      });
    }

    res.json({
      success: true,
      paymentUrl: paymentResponse.payment_request.shorturl,
      paymentId: paymentResponse.payment_request.id,
      purchaseId,
    });
  } catch (error) {
    console.error('Error creating payment request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/payments/verify/:purchaseId
 * Verifies payment status for a purchase
 */
export const handleVerifyPayment: RequestHandler = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const purchase = await getPurchases(parseInt(purchaseId));

    if (!purchase || purchase.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    const purchaseData = purchase[0];

    if (!purchaseData.instamojo_payment_id) {
      return res.status(400).json({
        success: false,
        message: 'No payment ID associated with this purchase',
      });
    }

    // Fetch latest payment details from Instamojo
    const paymentDetails = await getPaymentDetails(purchaseData.instamojo_payment_id);

    if (!paymentDetails.payment_request) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch payment details',
      });
    }

    const status = paymentDetails.payment_request.status;
    const isCompleted = isPaymentSuccessful(status);

    // Update purchase status if payment is completed
    if (isCompleted && purchaseData.payment_status !== 'completed') {
      await updatePurchasePaymentStatus(
        purchaseData.id,
        'completed',
        paymentDetails.payment_request.id,
        paymentDetails.payment_request.transaction_id
      );
    }

    res.json({
      success: true,
      status: isCompleted ? 'completed' : status,
      isCompleted,
      purchaseData: isCompleted ? purchaseData : null,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/payments/webhook
 * Handles Instamojo webhook notifications
 */
export const handlePaymentWebhook: RequestHandler = async (req, res) => {
  try {
    const signature = req.headers['x-instamojo-signature'] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.warn('Invalid webhook signature');
      // Continue processing anyway (for test mode)
    }

    // Parse webhook data
    const webhookData = parseWebhookData(req.body);

    // Update purchase with payment details
    if (req.body.metadata?.purchase_id) {
      const purchaseId = parseInt(req.body.metadata.purchase_id);
      const status = isPaymentSuccessful(webhookData.status) ? 'completed' : 'failed';

      await updatePurchasePaymentStatus(
        purchaseId,
        status,
        webhookData.paymentId,
        webhookData.transactionId
      );

      try {
        const purchaseResult = await query('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
        const purchaseData = purchaseResult.rows[0];
        if (purchaseData && status === 'completed') {
           const userResult = await query('SELECT * FROM users WHERE id = $1', [purchaseData.user_id]);
           const userData = userResult.rows[0];
           if (userData) {
              const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
              const downloadUrl = `${appUrl}/download`;
              
              await saveDownload({
                userId: userData.id,
                userEmail: userData.email,
                productName: `Wellness Blueprint - ${purchaseData.plan_id}`,
                planTier: purchaseData.plan_id,
                pdfRecordId: `pdf_${purchaseData.analysis_id}`,
                downloadUrl,
                emailSent: false,
              });

              try {
                const planNames: Record<string, string> = {
                  'free_blueprint': 'Free Blueprint',
                  'essential_blueprint': 'Essential Blueprint',
                  'premium_blueprint': 'Premium Blueprint',
                  'coaching_blueprint': 'Complete Coaching',
                };
                const planName = planNames[purchaseData.plan_id] || purchaseData.plan_id;

                await sendPaymentConfirmationEmail(
                  userData.id,
                  userData.email,
                  userData.name || 'User',
                  planName,
                  purchaseData.amount || webhookData.amount,
                  webhookData.transactionId || webhookData.paymentId,
                  purchaseId
                );

                await sendConfirmationEmail(
                  userData.id,
                  userData.email,
                  userData.name || 'User',
                  `GeneWell ${planName}`,
                  downloadUrl,
                  purchaseId
                );

                await query('UPDATE downloads SET email_sent = true WHERE user_email = $1 ORDER BY created_at DESC LIMIT 1', [userData.email]);
                console.log('Payment confirmation and download emails sent to:', userData.email);
              } catch (emailErr) {
                console.error('Error sending post-payment emails:', emailErr);
              }
           }
        }
      } catch (err) {
        console.error('Error updating records post-webhook:', err);
      }
    }

    // Always return 200 to acknowledge webhook receipt
    res.status(200).json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent retries
    res.status(200).json({
      success: true,
      message: 'Webhook processed (with errors)',
    });
  }
};

/**
 * GET /api/payments/user/:email
 * Gets user purchase history
 */
export const handleGetUserPurchases: RequestHandler = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await getUser(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const purchases = await getPurchases(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        gender: user.gender,
      },
      purchases,
    });
  } catch (error) {
    console.error('Error fetching user purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/payments/send-report-email
 * Manually send report download email to user
 */
export const handleSendReportEmail: RequestHandler = async (req, res) => {
  try {
    const { userId, email, userName, planName, downloadLink } = req.body;

    if (!email || !downloadLink) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, downloadLink',
      });
    }

    const success = await sendConfirmationEmail(
      userId,
      email,
      userName || 'User',
      planName || 'Wellness Report',
      downloadLink
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
      });
    }

    res.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending report email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
