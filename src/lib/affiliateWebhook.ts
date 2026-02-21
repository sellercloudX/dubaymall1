import { supabase } from "@/integrations/supabase/client";

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

    const { data, error } = await supabase.functions.invoke('affiliate-webhook', {
      body,
    });

    if (error) {
      console.error('Affiliate webhook error:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err: any) {
    console.error('Affiliate webhook error:', err);
    return { success: false, error: err.message };
  }
}
