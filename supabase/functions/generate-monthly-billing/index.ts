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

      // 4. Calculate total marketplace sales for billing period
      // Get all marketplace connections for this user
      const { data: connections } = await supabase
        .from('marketplace_connections')
        .select('id, marketplace, total_revenue, orders_count')
        .eq('user_id', sub.user_id)
        .eq('is_active', true);

      // Sum total_revenue from all marketplace connections as the sales volume
      // This represents the total GMV across all connected marketplaces
      let totalSalesVolume = 0;

      if (connections && connections.length > 0) {
        // Use order_financials for more accurate revenue tracking
        const { data: orderFin } = await supabase
          .from('order_financials')
          .select('order_total')
          .in('shop_id', connections.map(c => c.id))
          .gte('created_at', periodStart.toISOString())
          .lte('created_at', periodEnd.toISOString());

        if (orderFin && orderFin.length > 0) {
          totalSalesVolume = orderFin.reduce((sum, f) => sum + (f.order_total || 0), 0);
        }

        // If no order_financials, fall back to marketplace_orders_cache
        if (totalSalesVolume === 0) {
          const { data: cachedOrders } = await supabase
            .from('marketplace_orders_cache')
            .select('data')
            .eq('user_id', sub.user_id)
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString());

          if (cachedOrders && cachedOrders.length > 0) {
            totalSalesVolume = cachedOrders.reduce((sum, o) => {
              const orderData = o.data as any;
              return sum + (orderData?.totalUZS || orderData?.total || 0);
            }, 0);
          }
        }

        // Last resort: use connection total_revenue as approximation
        if (totalSalesVolume === 0) {
          totalSalesVolume = connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
        }
      }

      // 5. Calculate billing amounts
      const commissionPercent = sub.commission_percent || 4;
      const monthlyFeeUZS = (sub.monthly_fee || 0) * USD_TO_UZS;
      const commissionAmount = totalSalesVolume * (commissionPercent / 100);
      const totalDue = monthlyFeeUZS + commissionAmount;

      // 6. Create billing record
      const { error: billErr } = await supabase
        .from('sellercloud_billing')
        .insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          billing_period_start: periodStart.toISOString(),
          billing_period_end: periodEnd.toISOString(),
          monthly_fee_amount: monthlyFeeUZS,
          sales_commission_amount: commissionAmount,
          total_sales_volume: totalSalesVolume,
          commission_percent: commissionPercent,
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
          totalSales: totalSalesVolume,
          commission: commissionAmount,
          monthlyFee: monthlyFeeUZS,
          totalDue,
        });
        console.log(`Billing created for user ${sub.user_id}: sales=${totalSalesVolume}, commission=${commissionAmount}, total=${totalDue}`);

        // 7. Record platform revenue from commission
        if (commissionAmount > 0) {
          await supabase
            .from('platform_revenue')
            .insert({
              amount: commissionAmount,
              source_type: 'commission',
              source_id: sub.id,
              description: `Komissiya ${periodLabel}: ${commissionPercent}% x ${totalSalesVolume}`,
            });
        }
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
