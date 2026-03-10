import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Click Payment Integration
 * Handles two flows:
 * 1. "prepare" - Frontend calls to create a payment URL
 * 2. "complete" - Click callback after payment
 * 
 * Click Merchant API: https://docs.click.uz/
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SCX-${date}-${rand}`;
}

// Generate Click payment URL
function buildClickUrl(params: {
  merchantId: string;
  serviceId: string;
  amount: number;
  transactionParam: string;
  returnUrl: string;
}) {
  const url = new URL("https://my.click.uz/services/pay");
  url.searchParams.set("service_id", params.serviceId);
  url.searchParams.set("merchant_id", params.merchantId);
  url.searchParams.set("amount", params.amount.toString());
  url.searchParams.set("transaction_param", params.transactionParam);
  url.searchParams.set("return_url", params.returnUrl);
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "prepare";

    const supabase = getSupabase();

    // ==================== PREPARE: Create payment and return Click URL ====================
    if (action === "prepare") {
      const { user_id, plan_type, amount_uzs, return_url } = body;

      if (!user_id || !plan_type || !amount_uzs) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const merchantId = Deno.env.get("CLICK_MERCHANT_ID");
      const serviceId = Deno.env.get("CLICK_SERVICE_ID");

      if (!merchantId || !serviceId) {
        return new Response(JSON.stringify({ error: "Click credentials not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderNumber = generateOrderNumber();

      // Store payment record
      const { data: payment, error: payErr } = await supabase
        .from("sellercloud_payments")
        .insert({
          user_id,
          amount: amount_uzs,
          payment_method: "click",
          payment_reference: orderNumber,
          status: "pending",
          notes: JSON.stringify({ plan_type, order_number: orderNumber }),
        })
        .select()
        .single();

      if (payErr) {
        console.error("Payment insert error:", payErr);
        return new Response(JSON.stringify({ error: "Failed to create payment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clickUrl = buildClickUrl({
        merchantId,
        serviceId,
        amount: amount_uzs,
        transactionParam: orderNumber,
        returnUrl: return_url || "https://sellercloudx.lovable.app/seller-cloud?tab=subscription",
      });

      return new Response(JSON.stringify({
        success: true,
        payment_url: clickUrl,
        order_number: orderNumber,
        payment_id: payment.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== TOPUP: Create balance top-up payment ====================
    if (action === "topup") {
      const { user_id, amount_uzs, return_url } = body;

      if (!user_id || !amount_uzs || amount_uzs < 300000) {
        return new Response(JSON.stringify({ error: "Minimal summa: 300,000 so'm" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const merchantId = Deno.env.get("CLICK_MERCHANT_ID");
      const serviceId = Deno.env.get("CLICK_SERVICE_ID");

      if (!merchantId || !serviceId) {
        return new Response(JSON.stringify({ error: "Click credentials not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderNumber = "TOP-" + generateOrderNumber().slice(4);

      const { data: payment, error: payErr } = await supabase
        .from("sellercloud_payments")
        .insert({
          user_id,
          amount: amount_uzs,
          payment_method: "click",
          payment_reference: orderNumber,
          status: "pending",
          notes: JSON.stringify({ type: "balance_topup", amount: amount_uzs }),
        })
        .select()
        .single();

      if (payErr) {
        console.error("Payment insert error:", payErr);
        return new Response(JSON.stringify({ error: "Failed to create payment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clickUrl = buildClickUrl({
        merchantId,
        serviceId,
        amount: amount_uzs,
        transactionParam: orderNumber,
        returnUrl: return_url || "https://sellercloudx.lovable.app/seller-cloud?tab=balance",
      });

      return new Response(JSON.stringify({
        success: true,
        payment_url: clickUrl,
        order_number: orderNumber,
        payment_id: payment.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== CONFIRM: Called after Click payment success ====================
    if (action === "confirm") {
      const { order_number, click_trans_id } = body;

      if (!order_number) {
        return new Response(JSON.stringify({ error: "Missing order_number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find pending payment
      const { data: payment, error: findErr } = await supabase
        .from("sellercloud_payments")
        .select("*")
        .eq("payment_reference", order_number)
        .eq("status", "pending")
        .single();

      if (findErr || !payment) {
        return new Response(JSON.stringify({ error: "Payment not found or already processed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const notes = JSON.parse(payment.notes || "{}");

      // Mark payment as completed
      await supabase
        .from("sellercloud_payments")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          notes: JSON.stringify({ ...notes, click_trans_id }),
        })
        .eq("id", payment.id);

      // ===== BALANCE TOP-UP =====
      if (notes.type === "balance_topup") {
        await supabase.rpc("add_balance", {
          p_user_id: payment.user_id,
          p_amount: payment.amount,
          p_type: "deposit",
          p_description: `Click orqali balans to'ldirish - ${order_number}`,
          p_metadata: { click_trans_id, order_number },
        });

        await supabase.from("platform_revenue").insert({
          source_type: "balance_topup",
          source_id: payment.id,
          amount: payment.amount,
          description: `Balans to'ldirish - ${order_number}`,
        });

        return new Response(JSON.stringify({
          success: true,
          message: "Balans muvaffaqiyatli to'ldirildi",
          type: "balance_topup",
          amount: payment.amount,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== SUBSCRIPTION PAYMENT =====
      const planType = notes.plan_type;
      let months = 1;
      if (planType === "premium") months = 1;
      if (planType === "enterprise" || planType === "elegant") months = 1;

      const { data: existingSub } = await supabase
        .from("sellercloud_subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingSub) {
        const currentUntil = existingSub.activated_until && new Date(existingSub.activated_until) > new Date()
          ? new Date(existingSub.activated_until)
          : new Date();

        const newUntil = new Date(currentUntil);
        newUntil.setMonth(newUntil.getMonth() + months);

        await supabase
          .from("sellercloud_subscriptions")
          .update({
            plan_type: planType === "elegant" ? "enterprise" : planType,
            is_active: true,
            activated_until: newUntil.toISOString(),
            initial_payment_completed: true,
            initial_payment_at: existingSub.initial_payment_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);
      } else {
        const activatedUntil = new Date();
        activatedUntil.setMonth(activatedUntil.getMonth() + months);

        await supabase
          .from("sellercloud_subscriptions")
          .insert({
            user_id: payment.user_id,
            plan_type: planType === "elegant" ? "enterprise" : planType,
            is_active: true,
            activated_until: activatedUntil.toISOString(),
            initial_payment_completed: true,
            initial_payment_at: new Date().toISOString(),
          });
      }

      await supabase.from("platform_revenue").insert({
        source_type: "subscription",
        source_id: payment.id,
        amount: payment.amount,
        description: `${planType} tarif to'lovi - ${order_number}`,
      });

      return new Response(JSON.stringify({
        success: true,
        message: "To'lov muvaffaqiyatli qabul qilindi",
        plan_type: planType,
        months,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== STATUS: Check payment status ====================
    if (action === "status") {
      const { order_number } = body;

      const { data: payment } = await supabase
        .from("sellercloud_payments")
        .select("*")
        .eq("payment_reference", order_number)
        .single();

      return new Response(JSON.stringify({
        success: true,
        status: payment?.status || "not_found",
        payment,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Click payment error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
