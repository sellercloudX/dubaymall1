import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USD_TO_UZS = 12800;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine billing month: previous calendar month
    const now = new Date();
    const billingYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const billingMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1; // 0-indexed
    const periodStart = new Date(billingYear, billingMonth, 1);
    const periodEnd = new Date(billingYear, billingMonth + 1, 0, 23, 59, 59, 999);

    const periodLabel = `${billingYear}-${String(billingMonth + 1).padStart(2, '0')}`;
    console.log(`Generating monthly billing for period: ${periodLabel} (${periodStart.toISOString()} - ${periodEnd.toISOString()})`);

    // 1. Get all active subscriptions
    const { data: subscriptions, error: subErr } = await supabase
      .from('sellercloud_subscriptions')
      .select('*')
      .eq('is_active', true);

    if (subErr) throw subErr;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active subscriptions", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} active subscriptions`);

    // 2. Check existing billing for this period (avoid duplicates)
    const { data: existingBilling } = await supabase
      .from('sellercloud_billing')
      .select('user_id')
      .gte('billing_period_start', periodStart.toISOString())
      .lte('billing_period_start', periodEnd.toISOString());

    const alreadyBilled = new Set((existingBilling || []).map(b => b.user_id));

    // 3. Mark previous unpaid billings as overdue
    const { data: unpaidBillings } = await supabase
      .from('sellercloud_billing')
      .select('id, status')
      .eq('status', 'pending')
      .lt('billing_period_end', periodStart.toISOString());

    if (unpaidBillings && unpaidBillings.length > 0) {
      const unpaidIds = unpaidBillings.map(b => b.id);
      await supabase
        .from('sellercloud_billing')
        .update({ status: 'overdue' })
        .in('id', unpaidIds);
      console.log(`Marked ${unpaidIds.length} old billings as overdue`);
    }

    let generated = 0;
    const results: any[] = [];

    for (const sub of subscriptions) {
      // Skip if already billed for this period
      if (alreadyBilled.has(sub.user_id)) {
        console.log(`User ${sub.user_id} already billed for ${periodLabel}, skipping`);
        continue;
      }

      // Skip free access users
      if (sub.free_access) {
        console.log(`User ${sub.user_id} has free access, skipping`);
        continue;
      }

      // 4. Calculate billing amounts — NO sales commission, only monthly fee
      const monthlyFeeUZS = (sub.monthly_fee || 0) * USD_TO_UZS;
      const totalDue = monthlyFeeUZS;

      // 6. Create billing record
      const { error: billErr } = await supabase
        .from('sellercloud_billing')
        .insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          billing_period_start: periodStart.toISOString(),
          billing_period_end: periodEnd.toISOString(),
          monthly_fee_amount: monthlyFeeUZS,
          sales_commission_amount: 0,
          total_sales_volume: 0,
          commission_percent: 0,
          total_due: totalDue,
          total_paid: 0,
          balance_due: totalDue,
          status: 'pending',
        });

      if (billErr) {
        console.error(`Error creating billing for user ${sub.user_id}:`, billErr);
        results.push({ userId: sub.user_id, error: billErr.message });
      } else {
        generated++;
        results.push({
          userId: sub.user_id,
          period: periodLabel,
          monthlyFee: monthlyFeeUZS,
          totalDue,
        });
        console.log(`Billing created for user ${sub.user_id}: monthlyFee=${monthlyFeeUZS}, total=${totalDue}`);

        // 7. Record platform revenue from subscription
        if (monthlyFeeUZS > 0) {
          await supabase
            .from('platform_revenue')
            .insert({
              amount: monthlyFeeUZS,
              source_type: 'subscription',
              source_id: sub.id,
              description: `Obuna to'lovi ${periodLabel}: $${sub.monthly_fee}`,
            });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: periodLabel,
        generated,
        total_subscriptions: subscriptions.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Monthly billing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
