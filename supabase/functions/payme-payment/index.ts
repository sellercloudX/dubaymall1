import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Payme Payment Integration
 * 
 * Uses direct checkout URL (no receipts.create API needed).
 * Payme checkout page handles the payment form.
 * 
 * Actions:
 *   - "topup"    — generate checkout URL for balance top-up
 *   - "prepare"  — generate checkout URL for subscription payment
 *   - "check"    — check payment status via receipts.check API
 *   - "status"   — check payment status from our DB
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function respond(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PM-${date}-${rand}`;
}

// TODO: Realga o'tganda false qiling
const IS_TEST = true;

function getPaymeBaseUrl(): string {
  return IS_TEST
    ? "https://checkout.test.paycom.uz"
    : "https://checkout.paycom.uz";
}

// ==================== Auth helper ====================

async function authenticateUser(
  req: Request
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return respond({ error: "Missing or invalid Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return respond({ error: "Invalid or expired token" }, 401);
  }

  return { userId: user.id };
}

// ==================== Direct Checkout URL ====================

/**
 * Generates Payme checkout URL using direct URL format.
 * Format: https://checkout.paycom.uz/{base64_encoded_params}
 * 
 * This does NOT require receipts.create API — Payme's checkout page
 * handles receipt creation automatically when user pays.
 */
function generateCheckoutUrl(orderNumber: string, amountTiyin: number): string {
  const merchantId = Deno.env.get("PAYME_MERCHANT_ID") || "";
  const baseUrl = getPaymeBaseUrl();

  // Payme direct checkout URL with query params
  const params = new URLSearchParams({
    "m": merchantId,
    "ac.order_id": orderNumber,
    "a": String(amountTiyin),
    "l": "uz",
    "c": `${baseUrl}`, // callback
  });

  return `${baseUrl}/${btoa(`m=${merchantId};ac.order_id=${orderNumber};a=${amountTiyin}`)}`;
}

// ==================== Payme API (for checking status) ====================

function getPaymeAuth(): string {
  const merchantId = Deno.env.get("PAYME_MERCHANT_ID") || "";
  const key = Deno.env.get("PAYME_KEY") || "";
  return `${merchantId}:${key}`;
}

async function paymeRequest(method: string, params: Record<string, unknown>) {
  const baseUrl = getPaymeBaseUrl();
  const body = {
    id: Date.now(),
    method,
    params,
  };

  const res = await fetch(`${baseUrl}/api`, {
    method: "POST",
    headers: {
      "X-Auth": getPaymeAuth(),
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    console.error(`Payme ${method} error:`, data.error);
    throw new Error(data.error.message || `Payme ${method} failed`);
  }

  return data.result;
}

// ==================== Handlers ====================

async function handlePrepare(
  body: Record<string, unknown>,
  userId: string
) {
  const { plan_type, amount_uzs } = body;
  if (!plan_type || !amount_uzs) {
    return respond({ error: "Missing required fields: plan_type, amount_uzs" }, 400);
  }

  const merchantId = Deno.env.get("PAYME_MERCHANT_ID");
  if (!merchantId) {
    return respond({ error: "Payme credentials not configured" }, 500);
  }

  const supabase = getServiceSupabase();
  const orderNumber = generateOrderNumber();
  const amountTiyin = Number(amount_uzs) * 100;

  // Generate direct checkout URL (no API call needed)
  const checkoutUrl = generateCheckoutUrl(orderNumber, amountTiyin);

  // Save payment in DB
  const { data: payment, error: payErr } = await supabase
    .from("sellercloud_payments")
    .insert({
      user_id: userId,
      amount: Number(amount_uzs),
      payment_method: "payme",
      payment_reference: orderNumber,
      status: "pending",
      notes: JSON.stringify({
        plan_type,
        order_number: orderNumber,
        amount_tiyin: amountTiyin,
      }),
    })
    .select()
    .single();

  if (payErr) {
    console.error("Payment insert error:", payErr);
    return respond({ error: "Failed to create payment" }, 500);
  }

  return respond({
    success: true,
    payment_url: checkoutUrl,
    order_number: orderNumber,
    payment_id: payment.id,
  });
}

async function handleTopup(
  body: Record<string, unknown>,
  userId: string
) {
  const { amount_uzs } = body;
  if (!amount_uzs || Number(amount_uzs) < 300000) {
    return respond({ error: "Minimal summa: 300,000 so'm" }, 400);
  }

  const merchantId = Deno.env.get("PAYME_MERCHANT_ID");
  if (!merchantId) {
    return respond({ error: "Payme credentials not configured" }, 500);
  }

  const supabase = getServiceSupabase();
  const orderNumber = "TOP-" + generateOrderNumber().slice(3);
  const amountTiyin = Number(amount_uzs) * 100;

  // Generate direct checkout URL
  const checkoutUrl = generateCheckoutUrl(orderNumber, amountTiyin);

  const { data: payment, error: payErr } = await supabase
    .from("sellercloud_payments")
    .insert({
      user_id: userId,
      amount: Number(amount_uzs),
      payment_method: "payme",
      payment_reference: orderNumber,
      status: "pending",
      notes: JSON.stringify({
        type: "balance_topup",
        amount: amount_uzs,
        amount_tiyin: amountTiyin,
      }),
    })
    .select()
    .single();

  if (payErr) {
    console.error("Payment insert error:", payErr);
    return respond({ error: "Failed to create payment" }, 500);
  }

  return respond({
    success: true,
    payment_url: checkoutUrl,
    order_number: orderNumber,
    payment_id: payment.id,
  });
}

async function handleCheck(
  body: Record<string, unknown>,
  userId: string
) {
  const { order_number } = body;
  if (!order_number) {
    return respond({ error: "Missing order_number" }, 400);
  }

  const supabase = getServiceSupabase();

  // Find payment in our DB
  const { data: payment } = await supabase
    .from("sellercloud_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("payment_method", "payme")
    .eq("payment_reference", String(order_number))
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!payment) {
    return respond({ error: "Payment not found" }, 404);
  }

  // Already completed
  if (payment.status === "completed") {
    return respond({ success: true, status: "completed", paid: true });
  }

  return respond({
    success: true,
    status: payment.status,
    paid: false,
  });
}

async function handleStatus(
  body: Record<string, unknown>,
  userId: string
) {
  const { order_number } = body;
  const supabase = getServiceSupabase();

  const { data: payment } = await supabase
    .from("sellercloud_payments")
    .select("*")
    .eq("payment_reference", String(order_number))
    .eq("user_id", userId)
    .single();

  return respond({
    success: true,
    status: payment?.status || "not_found",
    payment,
  });
}

// ==================== Main Handler ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "prepare";

    // All actions require JWT authentication
    const authResult = await authenticateUser(req);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    if (body.user_id && body.user_id !== userId) {
      return respond({ error: "user_id does not match authenticated user" }, 401);
    }

    switch (action) {
      case "prepare":
        return await handlePrepare(body, userId);
      case "topup":
        return await handleTopup(body, userId);
      case "check":
        return await handleCheck(body, userId);
      case "status":
        return await handleStatus(body, userId);
      default:
        return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("Payme payment error:", err);
    return respond({ error: "Internal server error" }, 500);
  }
});
