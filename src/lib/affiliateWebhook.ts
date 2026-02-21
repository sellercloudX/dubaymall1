const AFFILIATE_API_BASE = 'https://xewgwvsljdhjvxtmqeuy.supabase.co/functions/v1';

interface ProcessPaymentParams {
  eventType: 'FIRST_PAYMENT' | 'RENEWAL';
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  currency: string;
  promoCode?: string;
  providerPaymentId: string;
}

interface ProcessPaymentResponse {
  success: boolean;
  conversion_id?: string;
  type?: string;
  amount?: number;
  hold_until?: string;
  error?: string;
}

export async function notifyAffiliatePayment(params: ProcessPaymentParams): Promise<ProcessPaymentResponse> {
  try {
    const body: Record<string, any> = {
      event_type: params.eventType,
      customer_email: params.customerEmail,
      amount: params.amount,
      currency: params.currency,
      provider_payment_id: params.providerPaymentId,
    };

    if (params.eventType === 'FIRST_PAYMENT') {
      body.customer_name = params.customerName || '';
      body.customer_phone = params.customerPhone || '';
      if (params.promoCode) {
        body.promo_code = params.promoCode;
      }
    }

    const response = await fetch(`${AFFILIATE_API_BASE}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error('Affiliate webhook error:', err);
    // Don't block payment flow if webhook fails
    return { success: false, error: err.message };
  }
}
