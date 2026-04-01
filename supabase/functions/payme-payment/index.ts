import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Payme Subscribe API Integration
 * 
 * Actions (all require JWT auth):
 *   - "topup"    — create receipt for balance top-up, return checkout URL
 *   - "prepare"  — create receipt for subscription payment, return checkout URL
 *   - "check"    — poll receipt status (state=4 → paid)
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

// ==================== Auth helper ====================

async function authenticateUser(
  req: Request
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return respond({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return respond({ error: "Invalid or expired token" }, 401);
  }

  return { userId: data.claims.sub as string };
}

// ==================== Payme API helper ====================

function getPaymeAuth(): string {
  const merchantId = Deno.env.get("PAYME_MERCHANT_ID") || "";
  const key = Deno.env.get("PAYME_KEY") || "";
  // X-Auth header: merchant_id:key (base64 is NOT used — raw colon-separated)
  return `${merchantId}:${key}`;
}

function getPaymeBaseUrl(): string {
  // TODO: Realga o'tganda "true" ni "false" ga o'zgartiring
  const isTest = true;
  return isTest
    ? "https://checkout.test.paycom.uz"
    : "https://checkout.paycom.uz";
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
  const amountTiyin = Number(amount_uzs) * 100; // so'm → tiyin

  // Create receipt via Payme API
  const receipt = await paymeRequest("receipts.create", {
    amount: amountTiyin,
    account: { order_id: orderNumber },
    description: `SellerCloudX ${plan_type} tarif to'lovi`,
  });

  const receiptId = receipt.receipt._id;

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
        receipt_id: receiptId,
      }),
    })
    .select()
    .single();

  if (payErr) {
    console.error("Payment insert error:", payErr);
    return respond({ error: "Failed to create payment" }, 500);
  }

  const checkoutUrl = `${getPaymeBaseUrl()}/${receiptId}`;

  return respond({
    success: true,
    payment_url: checkoutUrl,
    order_number: orderNumber,
    receipt_id: receiptId,
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

  const receipt = await paymeRequest("receipts.create", {
    amount: amountTiyin,
    account: { order_id: orderNumber },
    description: `SellerCloudX balans to'ldirish`,
  });

  const receiptId = receipt.receipt._id;

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
        receipt_id: receiptId,
      }),
    })
    .select()
    .single();

  if (payErr) {
    console.error("Payment insert error:", payErr);
    return respond({ error: "Failed to create payment" }, 500);
  }

  const checkoutUrl = `${getPaymeBaseUrl()}/${receiptId}`;

  return respond({
    success: true,
    payment_url: checkoutUrl,
    order_number: orderNumber,
    receipt_id: receiptId,
    payment_id: payment.id,
  });
}

async function handleCheck(
  body: Record<string, unknown>,
  userId: string
) {
  const { receipt_id, order_number } = body;
  if (!receipt_id && !order_number) {
    return respond({ error: "Missing receipt_id or order_number" }, 400);
  }

  const supabase = getServiceSupabase();

  // Find payment in our DB
  let paymentQuery = supabase
    .from("sellercloud_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("payment_method", "payme");

  if (order_number) {
    paymentQuery = paymentQuery.eq("payment_reference", String(order_number));
  }

  const { data: payment } = await paymentQuery.order("created_at", { ascending: false }).limit(1).single();

  if (!payment) {
    return respond({ error: "Payment not found" }, 404);
  }

  // Already completed
  if (payment.status === "completed") {
    return respond({ success: true, status: "completed", paid: true });
  }

  // Get receipt_id from notes
  const notes = JSON.parse(payment.notes || "{}");
  const rId = (receipt_id as string) || notes.receipt_id;

  if (!rId) {
    return respond({ success: true, status: payment.status, paid: false });
  }

  // Check with Payme API
  try {
    const result = await paymeRequest("receipts.check", { id: rId });
    const state = result.state;

    // state=4 means paid
    if (state === 4) {
      // Mark payment as completed
      await supabase
        .from("sellercloud_payments")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          notes: JSON.stringify({ ...notes, payme_state: state }),
        })
        .eq("id", payment.id);

      // Process the payment (balance topup or subscription)
      if (notes.type === "balance_topup") {
        await supabase.rpc("add_balance", {
          p_user_id: payment.user_id,
          p_amount: payment.amount,
          p_type: "deposit",
          p_description: `Payme orqali balans to'ldirish - ${payment.payment_reference}`,
          p_metadata: { receipt_id: rId, order_number: payment.payment_reference },
        });

        await supabase.from("platform_revenue").insert({
          source_type: "balance_topup",
          source_id: payment.id,
          amount: payment.amount,
          description: `Balans to'ldirish (Payme) - ${payment.payment_reference}`,
        });
      } else {
        // Subscription payment
        const planType = notes.plan_type;
        const { data: existingSub } = await supabase
          .from("sellercloud_subscriptions")
          .select("*")
          .eq("user_id", payment.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingSub) {
          const currentUntil =
            existingSub.activated_until &&
            new Date(existingSub.activated_until) > new Date()
              ? new Date(existingSub.activated_until)
              : new Date();
          const newUntil = new Date(currentUntil);
          newUntil.setMonth(newUntil.getMonth() + 1);

          await supabase
            .from("sellercloud_subscriptions")
            .update({
              plan_type: planType === "elegant" ? "enterprise" : planType,
              is_active: true,
              activated_until: newUntil.toISOString(),
              initial_payment_completed: true,
              initial_payment_at:
                existingSub.initial_payment_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id);
        } else {
          const activatedUntil = new Date();
          activatedUntil.setMonth(activatedUntil.getMonth() + 1);

          await supabase.from("sellercloud_subscriptions").insert({
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
          description: `${planType} tarif to'lovi (Payme) - ${payment.payment_reference}`,
        });
      }

      return respond({ success: true, status: "completed", paid: true });
    }

    // Not yet paid
    return respond({
      success: true,
      status: payment.status,
      paid: false,
      payme_state: state,
    });
  } catch (err) {
    console.error("Payme check error:", err);
    return respond({ success: true, status: payment.status, paid: false });
  }
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
