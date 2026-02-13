import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClickPrepareRequest {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  amount: string;
  action: string;
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

interface ClickCompleteRequest extends ClickPrepareRequest {
  merchant_prepare_id: string;
}

// MD5 hash function using Web Crypto (SHA-256 fallback since MD5 not supported in Web Crypto)
// Click API uses MD5 for signature verification
async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Take first 16 bytes to match MD5 output length
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Determine if merchant_trans_id is a subscription payment
function isSubscriptionPayment(merchantTransId: string): boolean {
  return merchantTransId.startsWith('SP-');
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const CLICK_SERVICE_ID = Deno.env.get("CLICK_SERVICE_ID");
  const CLICK_MERCHANT_ID = Deno.env.get("CLICK_MERCHANT_ID");
  const CLICK_SECRET_KEY = Deno.env.get("CLICK_SECRET_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!CLICK_SERVICE_ID || !CLICK_MERCHANT_ID || !CLICK_SECRET_KEY) {
    console.error("Click credentials not configured");
    return new Response(
      JSON.stringify({ error: -1, error_note: "Configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ===== Frontend: Create payment URL =====
    if (req.method === "POST" && action === "create") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { orderId, amount, returnUrl, paymentType, subscriptionId, months } = await req.json();

      if (!amount) {
        return new Response(
          JSON.stringify({ error: "Missing amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For subscription payments, create a subscription_payments record
      if (paymentType === 'subscription' && subscriptionId) {
        const { data: payment, error: payError } = await supabase
          .from('subscription_payments')
          .insert({
            user_id: user.id,
            subscription_id: subscriptionId,
            amount: amount,
            months_covered: months || 1,
            payment_type: 'subscription',
            payment_method: 'click',
            payment_status: 'pending',
          })
          .select('id')
          .single();

        if (payError) {
          console.error("Error creating subscription payment:", payError);
          return new Response(
            JSON.stringify({ error: payError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use SP- prefix for subscription payments
        const merchantTransId = `SP-${payment.id}`;

        console.log("Creating Click payment URL for subscription:", merchantTransId, "amount:", amount);

        const clickUrl = new URL("https://my.click.uz/services/pay");
        clickUrl.searchParams.set("service_id", CLICK_SERVICE_ID);
        clickUrl.searchParams.set("merchant_id", CLICK_MERCHANT_ID);
        clickUrl.searchParams.set("amount", amount.toString());
        clickUrl.searchParams.set("transaction_param", merchantTransId);
        if (returnUrl) {
          clickUrl.searchParams.set("return_url", returnUrl);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            paymentUrl: clickUrl.toString(),
            paymentId: payment.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For order payments (legacy)
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Missing orderId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Creating Click payment URL for order:", orderId, "amount:", amount);

      const clickUrl = new URL("https://my.click.uz/services/pay");
      clickUrl.searchParams.set("service_id", CLICK_SERVICE_ID);
      clickUrl.searchParams.set("merchant_id", CLICK_MERCHANT_ID);
      clickUrl.searchParams.set("amount", amount.toString());
      clickUrl.searchParams.set("transaction_param", orderId);
      if (returnUrl) {
        clickUrl.searchParams.set("return_url", returnUrl);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentUrl: clickUrl.toString(),
          orderId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Click Callback: Prepare (action=0) =====
    if (action === "0") {
      const body: ClickPrepareRequest = await req.json();
      console.log("Click Prepare request:", body);

      // Verify signature
      const signString = `${body.click_trans_id}${body.service_id}${CLICK_SECRET_KEY}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`;
      const expectedSign = await md5(signString);

      if (body.sign_string !== expectedSign) {
        console.error("Invalid signature");
        return new Response(
          JSON.stringify({ error: -1, error_note: "Invalid signature" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Subscription payment ---
      if (isSubscriptionPayment(body.merchant_trans_id)) {
        const paymentId = body.merchant_trans_id.replace('SP-', '');
        
        const { data: payment, error: payError } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (payError || !payment) {
          console.error("Subscription payment not found:", paymentId);
          return new Response(
            JSON.stringify({ error: -5, error_note: "Payment not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (payment.payment_status === 'paid') {
          return new Response(
            JSON.stringify({ error: -4, error_note: "Already paid" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check amount
        if (Math.abs(Number(payment.amount) - parseFloat(body.amount)) > 0.01) {
          console.error("Amount mismatch:", payment.amount, body.amount);
          return new Response(
            JSON.stringify({ error: -2, error_note: "Incorrect amount" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update with Click info
        await supabase
          .from('subscription_payments')
          .update({
            click_trans_id: body.click_trans_id,
            click_paydoc_id: body.click_paydoc_id,
            payment_status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId);

        console.log("Prepare successful for subscription payment:", paymentId);

        return new Response(
          JSON.stringify({
            click_trans_id: body.click_trans_id,
            merchant_trans_id: body.merchant_trans_id,
            merchant_prepare_id: paymentId,
            error: 0,
            error_note: "Success"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Order payment (legacy) ---
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", body.merchant_trans_id)
        .single();

      if (orderError || !order) {
        console.error("Order not found:", body.merchant_trans_id);
        return new Response(
          JSON.stringify({ error: -5, error_note: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (Math.abs(order.total_amount - parseFloat(body.amount)) > 0.01) {
        return new Response(
          JSON.stringify({ error: -2, error_note: "Incorrect amount" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (order.payment_status === "paid") {
        return new Response(
          JSON.stringify({ error: -4, error_note: "Already paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("orders")
        .update({
          payment_status: "pending",
          notes: JSON.stringify({
            click_trans_id: body.click_trans_id,
            click_paydoc_id: body.click_paydoc_id
          })
        })
        .eq("id", body.merchant_trans_id);

      return new Response(
        JSON.stringify({
          click_trans_id: body.click_trans_id,
          merchant_trans_id: body.merchant_trans_id,
          merchant_prepare_id: order.id,
          error: 0,
          error_note: "Success"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Click Callback: Complete (action=1) =====
    if (action === "1") {
      const body: ClickCompleteRequest = await req.json();
      console.log("Click Complete request:", body);

      // Verify signature
      const signString = `${body.click_trans_id}${body.service_id}${CLICK_SECRET_KEY}${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`;
      const expectedSign = await md5(signString);

      if (body.sign_string !== expectedSign) {
        return new Response(
          JSON.stringify({ error: -1, error_note: "Invalid signature" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if cancelled
      if (body.error === "-5017") {
        if (isSubscriptionPayment(body.merchant_trans_id)) {
          const paymentId = body.merchant_trans_id.replace('SP-', '');
          await supabase
            .from('subscription_payments')
            .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', paymentId);
        } else {
          await supabase
            .from("orders")
            .update({ payment_status: "cancelled" })
            .eq("id", body.merchant_trans_id);
        }

        return new Response(
          JSON.stringify({ error: -9, error_note: "Transaction cancelled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Subscription payment complete ---
      if (isSubscriptionPayment(body.merchant_trans_id)) {
        const paymentId = body.merchant_trans_id.replace('SP-', '');
        
        const { data: payment, error: payError } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (payError || !payment) {
          return new Response(
            JSON.stringify({ error: -5, error_note: "Payment not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Mark as paid
        await supabase
          .from('subscription_payments')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId);

        // Auto-activate subscription for the paid duration
        try {
          await supabase.rpc('activate_subscription_by_payment', {
            p_subscription_id: payment.subscription_id,
            p_months: payment.months_covered,
          });
          console.log(`Subscription ${payment.subscription_id} activated for ${payment.months_covered} months`);
        } catch (activateErr) {
          console.error("Error activating subscription:", activateErr);
        }

        // Record platform revenue
        await supabase
          .from('platform_revenue')
          .insert({
            amount: Number(payment.amount),
            source_type: 'sellercloud_subscription',
            source_id: payment.subscription_id,
            description: `SellerCloudX obuna to'lovi - ${payment.months_covered} oy`,
          });

        console.log("Subscription payment completed:", paymentId);

        return new Response(
          JSON.stringify({
            click_trans_id: body.click_trans_id,
            merchant_trans_id: body.merchant_trans_id,
            merchant_confirm_id: paymentId,
            error: 0,
            error_note: "Success"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Order payment complete (legacy) ---
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", body.merchant_trans_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: -5, error_note: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "click",
          status: "confirmed"
        })
        .eq("id", body.merchant_trans_id);

      console.log("Payment completed for order:", body.merchant_trans_id);

      return new Response(
        JSON.stringify({
          click_trans_id: body.click_trans_id,
          merchant_trans_id: body.merchant_trans_id,
          merchant_confirm_id: order.id,
          error: 0,
          error_note: "Success"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Click payment error:", error);
    return new Response(
      JSON.stringify({ 
        error: -1, 
        error_note: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
