import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== Input Validation ====================

function validateString(val: unknown, name: string, maxLen = 500): string {
  if (typeof val !== 'string' || val.length === 0 || val.length > maxLen) {
    throw new Error(`Invalid ${name}: must be a non-empty string (max ${maxLen} chars)`);
  }
  return val;
}

function validateNumber(val: unknown, name: string): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`Invalid ${name}: must be a finite number`);
  }
  return val;
}

function validatePositiveNumber(val: unknown, name: string): number {
  const n = validateNumber(val, name);
  if (n <= 0) throw new Error(`Invalid ${name}: must be positive`);
  return n;
}

function validateAccountParams(params: any): { orderId: string } {
  if (!params || typeof params !== 'object') throw new Error('Invalid params');
  if (!params.account || typeof params.account !== 'object') throw new Error('Invalid account');
  const orderId = validateString(params.account.order_id, 'account.order_id', 200);
  return { orderId };
}

// ==================== Main Handler ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Basic Auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Basic ")) {
      return jsonRpcError(-32504, "Unauthorized", null);
    }

    const credentials = atob(authHeader.replace("Basic ", ""));
    const [login, password] = credentials.split(":");

    const expectedLogin = Deno.env.get("UZUM_MERCHANT_LOGIN");
    const expectedPassword = Deno.env.get("UZUM_MERCHANT_PASSWORD");

    if (!expectedLogin || !expectedPassword) {
      console.error("UZUM_MERCHANT_LOGIN or UZUM_MERCHANT_PASSWORD not configured");
      return jsonRpcError(-32400, "Service not configured", null);
    }

    if (login !== expectedLogin || password !== expectedPassword) {
      return jsonRpcError(-32504, "Authentication failed", null);
    }

    const body = await req.json();
    
    if (!body || typeof body !== 'object') {
      return jsonRpcError(-32600, "Invalid request", null);
    }
    
    const { method, params, id: requestId } = body;

    if (typeof method !== 'string' || method.length === 0 || method.length > 100) {
      return jsonRpcError(-32600, "Invalid method", requestId);
    }

    console.log(`Uzum Merchant API: method=${method}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: any;

    switch (method) {
      case "CheckPerformTransaction":
        result = await checkPerformTransaction(supabase, params);
        break;
      case "CreateTransaction":
        result = await createTransaction(supabase, params);
        break;
      case "PerformTransaction":
        result = await performTransaction(supabase, params);
        break;
      case "CancelTransaction":
        result = await cancelTransaction(supabase, params);
        break;
      case "CheckTransaction":
        result = await checkTransaction(supabase, params);
        break;
      case "GetStatement":
        result = await getStatement(supabase, params);
        break;
      default:
        return jsonRpcResponse({ error: { code: -32601, message: "Method not found" } }, requestId);
    }

    return jsonRpcResponse(result, requestId);
  } catch (err) {
    console.error("Uzum Merchant webhook error:", err);
    return jsonRpcError(-32400, "Internal error", null);
  }
});

// ==================== Methods ====================

async function checkPerformTransaction(supabase: any, params: any) {
  const { orderId } = validateAccountParams(params);
  const amount = validatePositiveNumber(params.amount, 'amount');

  const { data: sub, error } = await supabase
    .from("sellercloud_subscriptions")
    .select("id, is_active, monthly_fee")
    .eq("id", orderId)
    .single();

  if (error || !sub) {
    return { error: { code: -31050, message: "Order not found" } };
  }

  return { result: { allow: true } };
}

async function createTransaction(supabase: any, params: any) {
  if (!params || typeof params !== 'object') {
    return { error: { code: -31050, message: "Invalid params" } };
  }
  
  const transId = validateString(String(params.id), 'id', 200);
  const time = validateNumber(params.time, 'time');
  const amount = validatePositiveNumber(params.amount, 'amount');
  const { orderId } = validateAccountParams(params);

  // Check for existing transaction
  const { data: existing } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (existing) {
    if (existing.status === "created") {
      return {
        result: {
          create_time: new Date(existing.created_at).getTime(),
          transaction: existing.id,
          state: 1,
        },
      };
    }
    return { error: { code: -31008, message: "Transaction already exists with different state" } };
  }

  const { data: txn, error } = await supabase
    .from("uzum_transactions")
    .insert({
      trans_id: transId,
      order_number: orderId,
      amount: amount,
      status: "created",
      payment_method: "uzum_merchant",
      metadata: { account: { order_id: orderId }, create_time: time },
    })
    .select()
    .single();

  if (error) {
    console.error("Create transaction error:", error);
    return { error: { code: -31001, message: "Database error" } };
  }

  return {
    result: {
      create_time: new Date(txn.created_at).getTime(),
      transaction: txn.id,
      state: 1,
    },
  };
}

async function performTransaction(supabase: any, params: any) {
  if (!params || typeof params !== 'object') {
    return { error: { code: -31003, message: "Invalid params" } };
  }
  const transId = validateString(String(params.id), 'id', 200);

  const { data: txn, error: findErr } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (findErr || !txn) {
    return { error: { code: -31003, message: "Transaction not found" } };
  }

  if (txn.status === "paid") {
    return {
      result: {
        perform_time: new Date(txn.paid_at).getTime(),
        transaction: txn.id,
        state: 2,
      },
    };
  }

  if (txn.status !== "created") {
    return { error: { code: -31008, message: "Invalid transaction state" } };
  }

  const now = new Date();

  const { error: updateErr } = await supabase
    .from("uzum_transactions")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
    })
    .eq("id", txn.id);

  if (updateErr) {
    return { error: { code: -31001, message: "Database error" } };
  }

  // Activate subscription
  try {
    const months = Math.max(1, Math.round(txn.amount / (499 * 12800 * 100)));
    await supabase.rpc("activate_subscription_by_payment", {
      p_subscription_id: txn.order_number,
      p_months: months,
    });
    console.log(`Subscription ${txn.order_number} activated for ${months} months via Uzum`);
  } catch (activateErr) {
    console.error("Subscription activation error:", activateErr);
  }

  return {
    result: {
      perform_time: now.getTime(),
      transaction: txn.id,
      state: 2,
    },
  };
}

async function cancelTransaction(supabase: any, params: any) {
  if (!params || typeof params !== 'object') {
    return { error: { code: -31003, message: "Invalid params" } };
  }
  const transId = validateString(String(params.id), 'id', 200);
  const reason = params.reason != null ? validateNumber(params.reason, 'reason') : null;

  const { data: txn, error: findErr } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (findErr || !txn) {
    return { error: { code: -31003, message: "Transaction not found" } };
  }

  if (txn.status === "cancelled") {
    return {
      result: {
        cancel_time: new Date(txn.updated_at).getTime(),
        transaction: txn.id,
        state: -1,
      },
    };
  }

  const { error: updateErr } = await supabase
    .from("uzum_transactions")
    .update({
      status: "cancelled",
      metadata: { ...((txn.metadata as any) || {}), cancel_reason: reason },
    })
    .eq("id", txn.id);

  if (updateErr) {
    return { error: { code: -31001, message: "Database error" } };
  }

  return {
    result: {
      cancel_time: Date.now(),
      transaction: txn.id,
      state: -1,
    },
  };
}

async function checkTransaction(supabase: any, params: any) {
  if (!params || typeof params !== 'object') {
    return { error: { code: -31003, message: "Invalid params" } };
  }
  const transId = validateString(String(params.id), 'id', 200);

  const { data: txn, error } = await supabase
    .from("uzum_transactions")
    .select("*")
    .eq("trans_id", transId)
    .single();

  if (error || !txn) {
    return { error: { code: -31003, message: "Transaction not found" } };
  }

  const stateMap: Record<string, number> = {
    created: 1,
    paid: 2,
    cancelled: -1,
  };

  return {
    result: {
      create_time: new Date(txn.created_at).getTime(),
      perform_time: txn.paid_at ? new Date(txn.paid_at).getTime() : 0,
      cancel_time: txn.status === "cancelled" ? new Date(txn.updated_at).getTime() : 0,
      transaction: txn.id,
      state: stateMap[txn.status] || 0,
      reason: (txn.metadata as any)?.cancel_reason || null,
    },
  };
}

async function getStatement(supabase: any, params: any) {
  if (!params || typeof params !== 'object') {
    return { error: { code: -31001, message: "Invalid params" } };
  }
  const from = validateNumber(params.from, 'from');
  const to = validateNumber(params.to, 'to');

  const fromDate = new Date(from).toISOString();
  const toDate = new Date(to).toISOString();

  const { data: txns, error } = await supabase
    .from("uzum_transactions")
    .select("*")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .eq("payment_method", "uzum_merchant")
    .order("created_at", { ascending: true });

  if (error) {
    return { error: { code: -31001, message: "Database error" } };
  }

  const transactions = (txns || []).map((t: any) => ({
    id: t.trans_id,
    time: new Date(t.created_at).getTime(),
    amount: t.amount,
    account: { order_id: t.order_number },
    create_time: new Date(t.created_at).getTime(),
    perform_time: t.paid_at ? new Date(t.paid_at).getTime() : 0,
    cancel_time: t.status === "cancelled" ? new Date(t.updated_at).getTime() : 0,
    transaction: t.id,
    state: t.status === "paid" ? 2 : t.status === "cancelled" ? -1 : 1,
    reason: (t.metadata as any)?.cancel_reason || null,
  }));

  return { result: { transactions } };
}

// ==================== Helpers ====================

function jsonRpcResponse(data: any, id: any = null) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, ...data }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function jsonRpcError(code: number, message: string, id: any) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
