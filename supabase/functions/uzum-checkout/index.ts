import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Uzum Bank Checkout API
 * Docs: https://developer.uzumbank.uz/checkout
 * 
 * Actions:
 * - register: Register payment and get redirect URL
 * - callback: Handle payment result callback
 * - status: Check payment status
 */

const UZUM_CHECKOUT_BASE = "https://checkout.uzumbank.uz/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { action } = body;

    // Callback doesn't need JWT - it comes from Uzum servers
    if (action === "callback") {
      const supabase = createClient(supabaseUrl, serviceKey);
      return await handleCallback(supabase, body);
    }

    // Other actions require user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    switch (action) {
      case "register":
        return await handleRegister(adminSupabase, user, body);
      case "status":
        return await handleStatus(adminSupabase, body);
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("Uzum Checkout error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleRegister(supabase: any, user: any, body: any) {
  const { subscriptionId, amount, months = 1, returnUrl, promoCode } = body;

  const apiKey = Deno.env.get("UZUM_CHECKOUT_API_KEY");
  const terminalId = Deno.env.get("UZUM_CHECKOUT_TERMINAL_ID");

  if (!apiKey || !terminalId) {
    return new Response(
      JSON.stringify({ error: "Uzum Checkout not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create transaction record first
  const orderNumber = `SCX-UZUM-${Date.now()}`;
  const amountTiyin = amount * 100; // Convert so'm to tiyin

  const { data: txn, error: txnErr } = await supabase
    .from("uzum_transactions")
    .insert({
      trans_id: orderNumber,
      order_number: subscriptionId,
      amount: amountTiyin,
      status: "created",
      user_id: user.id,
      payment_method: "uzum_checkout",
      metadata: { months, promo: promoCode, return_url: returnUrl },
    })
    .select()
    .single();

  if (txnErr) {
    console.error("Transaction create error:", txnErr);
    return new Response(
      JSON.stringify({ error: "Failed to create transaction" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Register payment with Uzum Checkout API
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/uzum-checkout`;

  try {
    const registerResp = await fetch(`${UZUM_CHECKOUT_BASE}/payment/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        terminalId: terminalId,
        amount: amountTiyin,
        orderId: orderNumber,
        description: `SellerCloudX obuna - ${months} oy`,
        returnUrl: returnUrl || "https://sellercloudx.lovable.app/seller-cloud-mobile?tab=billing",
        callbackUrl: callbackUrl,
        language: "uz",
      }),
    });

    const registerData = await registerResp.json();

    if (!registerResp.ok || registerData.error) {
      console.error("Uzum register error:", registerData);
      // Update transaction status
      await supabase
        .from("uzum_transactions")
        .update({ status: "failed", metadata: { ...txn.metadata, register_error: registerData } })
        .eq("id", txn.id);

      return new Response(
        JSON.stringify({ error: registerData.error?.message || "Payment registration failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction with payment URL
    await supabase
      .from("uzum_transactions")
      .update({
        metadata: { ...txn.metadata, payment_id: registerData.paymentId },
      })
      .eq("id", txn.id);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: registerData.paymentUrl || registerData.redirectUrl,
        orderId: orderNumber,
        transactionId: txn.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (fetchErr) {
    console.error("Uzum API fetch error:", fetchErr);
    return new Response(
      JSON.stringify({ error: "Failed to connect to Uzum Bank" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleCallback(supabase: any, body: any) {
  const { orderId, status, paymentId, amount } = body;

  console.log(`Uzum Checkout callback: orderId=${orderId}, status=${status}, paymentId=${paymentId}`);

  if (!orderId) {
    return new Response(
      JSON.stringify({ error: "Missing orderId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Find transaction
  const { data: txn, error: findErr } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", orderId)
    .single();

  if (findErr || !txn) {
    console.error("Transaction not found for callback:", orderId);
    return new Response(
      JSON.stringify({ error: "Transaction not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (status === "SUCCESS" || status === "CONFIRMED") {
    // Mark as paid
    await supabase
      .from("uzum_transactions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        metadata: { ...(txn.metadata || {}), callback_status: status, payment_id: paymentId },
      })
      .eq("id", txn.id);

    // Activate subscription
    const months = (txn.metadata as any)?.months || 1;
    try {
      await supabase.rpc("activate_subscription_by_payment", {
        p_subscription_id: txn.order_number,
        p_months: months,
      });
      console.log(`Subscription ${txn.order_number} activated for ${months} months via Uzum Checkout`);
    } catch (activateErr) {
      console.error("Subscription activation error:", activateErr);
    }
  } else if (status === "FAILED" || status === "CANCELLED") {
    await supabase
      .from("uzum_transactions")
      .update({
        status: status === "CANCELLED" ? "cancelled" : "failed",
        metadata: { ...(txn.metadata || {}), callback_status: status },
      })
      .eq("id", txn.id);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
}

async function handleStatus(supabase: any, body: any) {
  const { transactionId } = body;

  const { data: txn, error } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (error || !txn) {
    return new Response(
      JSON.stringify({ error: "Transaction not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      status: txn.status,
      amount: txn.amount,
      paid_at: txn.paid_at,
      order_number: txn.order_number,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
