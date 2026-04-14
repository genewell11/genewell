import crypto from 'crypto';

// Instamojo API configuration
const INSTAMOJO_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.instamojo.com/api/1.1/'
  : 'https://test.instamojo.com/api/1.1/';

const INSTAMOJO_AUTH_KEY = process.env.INSTAMOJO_AUTH_KEY;
const INSTAMOJO_AUTH_TOKEN = process.env.INSTAMOJO_AUTH_TOKEN;
const INSTAMOJO_WEBHOOK_SECRET = process.env.INSTAMOJO_WEBHOOK_SECRET;
const INSTAMOJO_PAYMENT_LINK = 'https://www.instamojo.com/@famechase';

export interface InstelloPaymentRequest {
  purpose: string;
  amount: number;
  buyer_name: string;
  email: string;
  phone: string;
  redirect_url: string;
  webhook_url: string;
  metadata?: {
    [key: string]: string;
  };
}

export interface InstelloPaymentResponse {
  success: boolean;
  payment_request?: {
    id: string;
    shorturl: string;
    longurl: string;
    user_id: number;
    status: string;
    amount: number;
    purpose: string;
    buyer_name: string;
    email: string;
    phone: string;
    notes: string;
    redirect_url: string;
    webhook_url: string;
    created_at: string;
    modified_at: string;
  };
  errors?: {
    [key: string]: string[];
  };
}

export async function createPaymentRequest(data: InstelloPaymentRequest): Promise<InstelloPaymentResponse> {
  if (!INSTAMOJO_AUTH_KEY || !INSTAMOJO_AUTH_TOKEN) {
    console.error('Instamojo credentials not configured');
    return {
      success: false,
      errors: {
        general: ['Instamojo is not configured. Please add INSTAMOJO_AUTH_KEY and INSTAMOJO_AUTH_TOKEN environment variables.'],
      },
    };
  }

  try {
    const payload = new URLSearchParams();
    payload.append('purpose', data.purpose);
    payload.append('amount', data.amount.toString());
    payload.append('buyer_name', data.buyer_name);
    payload.append('email', data.email);
    payload.append('phone', data.phone);
    payload.append('redirect_url', data.redirect_url);
    payload.append('webhook_url', data.webhook_url);
    
    // Add metadata if provided
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        payload.append(`metadata[${key}]`, value);
      });
    }

    const response = await fetch(`${INSTAMOJO_API_URL}payment-requests/`, {
      method: 'POST',
      headers: {
        'X-Api-Key': INSTAMOJO_AUTH_KEY,
        'X-Auth-Token': INSTAMOJO_AUTH_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    const result = (await response.json()) as InstelloPaymentResponse;

    if (!response.ok) {
      console.error('Instamojo API error:', result);
      return {
        success: false,
        errors: result.errors || { general: ['Payment request creation failed'] },
      };
    }

    return result;
  } catch (error) {
    console.error('Error creating Instamojo payment request:', error);
    return {
      success: false,
      errors: {
        general: [error instanceof Error ? error.message : 'Unknown error'],
      },
    };
  }
}

export async function getPaymentDetails(paymentId: string): Promise<any> {
  if (!INSTAMOJO_AUTH_KEY || !INSTAMOJO_AUTH_TOKEN) {
    throw new Error('Instamojo credentials not configured');
  }

  try {
    const response = await fetch(
      `${INSTAMOJO_API_URL}payment-requests/${paymentId}/`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': INSTAMOJO_AUTH_KEY,
          'X-Auth-Token': INSTAMOJO_AUTH_TOKEN,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch payment details: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw error;
  }
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (!INSTAMOJO_WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured - skipping verification');
    return true;
  }

  try {
    const computed = crypto
      .createHmac('sha256', INSTAMOJO_WEBHOOK_SECRET)
      .update(body)
      .digest('base64');

    return computed === signature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

export function parseWebhookData(data: any): {
  paymentId: string;
  transactionId: string;
  status: string;
  amount: number;
  email: string;
  buyerName: string;
  metadata?: any;
} {
  return {
    paymentId: data.payment_request_id || data.id,
    transactionId: data.transaction_id,
    status: data.status,
    amount: parseFloat(data.amount),
    email: data.email,
    buyerName: data.buyer_name,
    metadata: data.metadata,
  };
}

export function isPaymentSuccessful(status: string): boolean {
  return status === 'completed' || status === 'Completed';
}

/**
 * Generate a direct Instamojo payment link with pre-filled information
 * This is an alternative to creating payment requests via API
 */
export function generateDirectPaymentLink(params: {
  amount: number;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  purpose?: string;
  purchaseId?: string;
}): string {
  const queryParams = new URLSearchParams();

  if (params.amount) {
    queryParams.append('amount', params.amount.toString());
  }
  if (params.buyerName) {
    queryParams.append('name', params.buyerName);
  }
  if (params.buyerEmail) {
    queryParams.append('email', params.buyerEmail);
  }
  if (params.buyerPhone) {
    queryParams.append('phone', params.buyerPhone);
  }
  if (params.purpose) {
    queryParams.append('purpose', params.purpose);
  }

  return `${INSTAMOJO_PAYMENT_LINK}/?${queryParams.toString()}`;
}
