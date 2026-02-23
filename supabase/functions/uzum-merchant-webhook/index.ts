import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Uzum Bank Merchant API v1.0.0
 * Webhook handler for: check, create, confirm, reverse, status
 * Docs: https://developer.uzumbank.uz/merchant-api/
 * 
 * Uzum Bank sends POST requests to this endpoint.
 * Auth: Basic Auth (login:password base64)
 * Format: application/json
 * Amounts: in tiyin (1 UZS = 100 tiyin)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== Input Validation ====================

function validateString(val: unknown, name: string, maxLen = 500): string {
  if (typeof val !== 'string' || val.length === 0 || val.length > maxLen) {
    throw new Error(`Invalid ${name}`);
  }
  return val;
}

function validateInteger(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val)) {
    throw new Error(`Invalid ${name}`);
  }
  return val;
}

function validatePositiveInteger(val: unknown, name: string): number {
  const n = validateInteger(val, name);
  if (n <= 0) throw new Error(`Invalid ${name}: must be positive`);
  return n;
}

// ==================== Error Responses ====================

function errorResponse(serviceId: number | null, code: number, message: string, httpStatus = 400) {
  return new Response(
    JSON.stringify({
      serviceId,
      status: "FAILED",
      errorCode: code,
      errorMessage: message,
      timestamp: Date.now(),
    }),
    { status: httpStatus, headers: { "Content-Type": "application/json" } }
  );
}

// ==================== Main Handler ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Basic Auth verification ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Basic ")) {
      return errorResponse(null, 401, "Unauthorized", 401);
    }

    const credentials = atob(authHeader.replace("Basic ", ""));
    const colonIdx = credentials.indexOf(":");
    if (colonIdx < 0) {
      return errorResponse(null, 401, "Invalid credentials", 401);
    }
    const login = credentials.slice(0, colonIdx);
    const password = credentials.slice(colonIdx + 1);

    const expectedLogin = Deno.env.get("UZUM_MERCHANT_LOGIN");
    const expectedPassword = Deno.env.get("UZUM_MERCHANT_PASSWORD");

    if (!expectedLogin || !expectedPassword) {
      console.error("UZUM_MERCHANT_LOGIN or UZUM_MERCHANT_PASSWORD not configured");
      return errorResponse(null, 500, "Service not configured", 500);
    }

    if (login !== expectedLogin || password !== expectedPassword) {
      return errorResponse(null, 401, "Authentication failed", 401);
    }

    // ---- Parse request body ----
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return errorResponse(null, 400, "Invalid request body");
    }

    const serviceId = typeof body.serviceId === 'number' ? body.serviceId : null;
    
    // Validate serviceId against our configured service
    const expectedServiceId = Deno.env.get("UZUM_MERCHANT_SERVICE_ID");
    if (expectedServiceId && serviceId !== null && String(serviceId) !== expectedServiceId) {
      console.error(`ServiceId mismatch: got ${serviceId}, expected ${expectedServiceId}`);
      return errorResponse(serviceId, 400, "Invalid serviceId");
    }

    // ---- Determine webhook type from URL path ----
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Last segment after function name is the webhook type
    // e.g., /functions/v1/uzum-merchant-webhook/check → "check"
    const webhookType = pathSegments[pathSegments.length - 1];

    console.log(`Uzum Merchant API webhook: type=${webhookType}, serviceId=${serviceId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (webhookType) {
      case "check":
        return await handleCheck(supabase, body, serviceId);
      case "create":
        return await handleCreate(supabase, body, serviceId);
      case "confirm":
        return await handleConfirm(supabase, body, serviceId);
      case "reverse":
        return await handleReverse(supabase, body, serviceId);
      case "status":
        return await handleStatus(supabase, body, serviceId);
      default:
        // If no sub-path, try to route by checking body fields
        // Fallback: if transId + paymentSource exist → confirm
        // if transId + amount exist → create
        // if only params → check
        if (body.paymentSource) return await handleConfirm(supabase, body, serviceId);
        if (body.transId && body.amount) return await handleCreate(supabase, body, serviceId);
        if (body.transId && !body.amount) return await handleStatus(supabase, body, serviceId);
        if (body.params) return await handleCheck(supabase, body, serviceId);
        return errorResponse(serviceId, 400, "Unknown webhook type");
    }
  } catch (err) {
    console.error("Uzum Merchant webhook error:", err);
    return errorResponse(null, 500, "Internal error", 500);
  }
});

// ==================== /check — Verify payment possibility ====================

async function handleCheck(supabase: any, body: any, serviceId: number | null) {
  const params = body.params;
  if (!params || typeof params !== 'object') {
    return errorResponse(serviceId, 400, "Missing params");
  }

  // Extract account identifier (subscription ID or order number)
  const account = params.account;
  if (account === undefined || account === null || String(account).length === 0) {
    return errorResponse(serviceId, 400, "Missing account");
  }
  const accountStr = String(account);

  // Look up subscription by ID
  const { data: sub, error } = await supabase
    .from("sellercloud_subscriptions")
    .select("id, user_id, plan_type, monthly_fee, is_active")
    .eq("id", accountStr)
    .single();

  if (error || !sub) {
    return errorResponse(serviceId, 400, "Account not found");
  }

  // Get user profile for FIO
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", sub.user_id)
    .single();

  const fio = profile?.full_name || "SellerCloudX User";

  return new Response(
    JSON.stringify({
      serviceId,
      timestamp: Date.now(),
      status: "OK",
      data: {
        account: { value: accountStr },
        fio: { value: fio },
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ==================== /create — Create payment transaction ====================

async function handleCreate(supabase: any, body: any, serviceId: number | null) {
  const transId = validateString(body.transId, 'transId', 200);
  const amount = validatePositiveInteger(body.amount, 'amount');
  const params = body.params;

  if (!params || typeof params !== 'object') {
    return errorResponse(serviceId, 400, "Missing params");
  }

  const account = String(params.account || '');
  if (!account) {
    return errorResponse(serviceId, 400, "Missing account");
  }

  // Check for existing transaction with same transId
  const { data: existing } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (existing) {
    if (existing.status === "created") {
      return new Response(
        JSON.stringify({
          serviceId,
          transId,
          status: "CREATED",
          transTime: new Date(existing.created_at).getTime(),
          data: {
            account: { value: account },
          },
          amount: existing.amount,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    return errorResponse(serviceId, 400, "Transaction already exists with different state");
  }

  // Verify subscription exists
  const { data: sub } = await supabase
    .from("sellercloud_subscriptions")
    .select("id, monthly_fee")
    .eq("id", account)
    .single();

  if (!sub) {
    return errorResponse(serviceId, 400, "Account not found");
  }

  // Calculate months from amount
  const monthlyAmountTiyin = Math.round(sub.monthly_fee * 12800 * 100);
  const months = Math.max(1, Math.round(amount / monthlyAmountTiyin));

  // Create transaction record
  const { data: txn, error: createErr } = await supabase
    .from("uzum_transactions")
    .insert({
      trans_id: transId,
      order_number: account,
      amount: amount,
      status: "created",
      payment_method: "uzum_merchant",
      metadata: {
        service_id: serviceId,
        months,
        account,
        create_timestamp: body.timestamp,
      },
    })
    .select()
    .single();

  if (createErr) {
    console.error("Create transaction error:", createErr);
    return errorResponse(serviceId, 500, "Database error", 500);
  }

  const transTime = new Date(txn.created_at).getTime();

  return new Response(
    JSON.stringify({
      serviceId,
      transId,
      status: "CREATED",
      transTime,
      data: {
        account: { value: account },
      },
      amount,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ==================== /confirm — Confirm payment transaction ====================

async function handleConfirm(supabase: any, body: any, serviceId: number | null) {
  const transId = validateString(body.transId, 'transId', 200);
  const paymentSource = typeof body.paymentSource === 'string' ? body.paymentSource : null;
  const phone = typeof body.phone === 'string' ? body.phone.slice(0, 20) : null;

  const { data: txn, error: findErr } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (findErr || !txn) {
    return errorResponse(serviceId, 400, "Transaction not found");
  }

  // Already confirmed
  if (txn.status === "paid") {
    return new Response(
      JSON.stringify({
        serviceId,
        transId,
        status: "CONFIRMED",
        confirmTime: new Date(txn.paid_at).getTime(),
        data: {
          account: { value: txn.order_number },
        },
        amount: txn.amount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (txn.status !== "created") {
    return errorResponse(serviceId, 400, "Invalid transaction state for confirm");
  }

  const now = new Date();
  const confirmTime = now.getTime();

  // Update transaction to paid
  const { error: updateErr } = await supabase
    .from("uzum_transactions")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
      metadata: {
        ...(txn.metadata || {}),
        payment_source: paymentSource,
        phone,
        tariff: body.tariff || null,
        card_type: body.cardType || null,
        processing_ref: body.processingReferenceNumber || null,
        confirm_timestamp: body.timestamp,
      },
    })
    .eq("id", txn.id);

  if (updateErr) {
    console.error("Confirm transaction error:", updateErr);
    return errorResponse(serviceId, 500, "Database error", 500);
  }

  // Activate subscription
  const months = (txn.metadata as any)?.months || 1;
  try {
    await supabase.rpc("activate_subscription_by_payment", {
      p_subscription_id: txn.order_number,
      p_months: months,
    });
    console.log(`Subscription ${txn.order_number} activated for ${months} months via Uzum Merchant API`);
  } catch (activateErr) {
    console.error("Subscription activation error:", activateErr);
  }

  return new Response(
    JSON.stringify({
      serviceId,
      transId,
      status: "CONFIRMED",
      confirmTime,
      data: {
        account: { value: txn.order_number },
      },
      amount: txn.amount,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ==================== /reverse — Cancel/reverse transaction ====================

async function handleReverse(supabase: any, body: any, serviceId: number | null) {
  const transId = validateString(body.transId, 'transId', 200);

  const { data: txn, error: findErr } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (findErr || !txn) {
    return errorResponse(serviceId, 400, "Transaction not found");
  }

  // Already reversed
  if (txn.status === "cancelled") {
    return new Response(
      JSON.stringify({
        serviceId,
        transId,
        status: "REVERSED",
        reverseTime: new Date(txn.updated_at).getTime(),
        data: {
          account: { value: txn.order_number },
        },
        amount: txn.amount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const reverseTime = Date.now();

  const { error: updateErr } = await supabase
    .from("uzum_transactions")
    .update({
      status: "cancelled",
      metadata: {
        ...(txn.metadata || {}),
        reverse_timestamp: body.timestamp,
        reversed_from_status: txn.status,
      },
    })
    .eq("id", txn.id);

  if (updateErr) {
    console.error("Reverse transaction error:", updateErr);
    return errorResponse(serviceId, 500, "Database error", 500);
  }

  return new Response(
    JSON.stringify({
      serviceId,
      transId,
      status: "REVERSED",
      reverseTime,
      data: {
        account: { value: txn.order_number },
      },
      amount: txn.amount,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ==================== /status — Check transaction status ====================

async function handleStatus(supabase: any, body: any, serviceId: number | null) {
  const transId = validateString(body.transId, 'transId', 200);

  const { data: txn, error } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (error || !txn) {
    return errorResponse(serviceId, 400, "Transaction not found");
  }

  const statusMap: Record<string, string> = {
    created: "CREATED",
    paid: "CONFIRMED",
    cancelled: "REVERSED",
    failed: "FAILED",
  };

  return new Response(
    JSON.stringify({
      serviceId,
      transId,
      status: statusMap[txn.status] || "FAILED",
      transTime: new Date(txn.created_at).getTime(),
      confirmTime: txn.paid_at ? new Date(txn.paid_at).getTime() : null,
      reverseTime: txn.status === "cancelled" ? new Date(txn.updated_at).getTime() : null,
      data: {
        account: { value: txn.order_number },
      },
      amount: txn.amount,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
