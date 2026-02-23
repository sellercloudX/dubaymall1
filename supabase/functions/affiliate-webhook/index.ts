import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AFFILIATE_API_BASE =
  "https://xewgwvsljdhjvxtmqeuy.supabase.co/functions/v1";

// ==================== Input Validation ====================

const VALID_EVENT_TYPES = new Set(["FIRST_PAYMENT", "RENEWAL"]);

function validateAffiliateBody(body: any): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const { event_type, customer_email, amount, currency, provider_payment_id } = body;

  // Required fields
  if (typeof event_type !== 'string' || !VALID_EVENT_TYPES.has(event_type)) {
    throw new Error('Invalid event_type: must be FIRST_PAYMENT or RENEWAL');
  }
  if (typeof customer_email !== 'string' || customer_email.length === 0 || customer_email.length > 255) {
    throw new Error('Invalid customer_email');
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount: must be a positive number');
  }
  if (typeof currency !== 'string' || currency.length < 2 || currency.length > 10) {
    throw new Error('Invalid currency');
  }
  if (typeof provider_payment_id !== 'string' || provider_payment_id.length === 0 || provider_payment_id.length > 200) {
    throw new Error('Invalid provider_payment_id');
  }

  // Build validated body
  const validated: Record<string, unknown> = {
    event_type,
    customer_email: customer_email.slice(0, 255),
    amount,
    currency: currency.slice(0, 10),
    provider_payment_id: provider_payment_id.slice(0, 200),
  };

  // Optional fields for FIRST_PAYMENT
  if (event_type === 'FIRST_PAYMENT') {
    if (body.customer_name != null) {
      validated.customer_name = typeof body.customer_name === 'string' ? body.customer_name.slice(0, 200) : '';
    }
    if (body.customer_phone != null) {
      validated.customer_phone = typeof body.customer_phone === 'string' ? body.customer_phone.slice(0, 50) : '';
    }
    if (body.promo_code != null && typeof body.promo_code === 'string' && body.promo_code.length <= 50) {
      validated.promo_code = body.promo_code;
    }
  }

  return validated;
}

// ==================== Main Handler ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    
    // Validate input before forwarding
    const validatedBody = validateAffiliateBody(body);
    
    const webhookSecret = Deno.env.get("WEBHOOK_SEKRET") || "";

    // Forward validated body to affiliate API
    const response = await fetch(`${AFFILIATE_API_BASE}/process-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify(validatedBody),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Affiliate webhook proxy error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Processing error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
