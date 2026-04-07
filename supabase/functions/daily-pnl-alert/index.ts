import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');

    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all users with active Telegram links and notification preferences
    const { data: telegramUsers, error: linkErr } = await supabase
      .from('telegram_chat_links')
      .select('user_id, chat_id')
      .eq('is_active', true);

    if (linkErr || !telegramUsers?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'No telegram users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check notification preferences
    const userIds = telegramUsers.map(u => u.user_id);
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_subscription')
      .in('user_id', userIds)
      .eq('channel', 'telegram')
      .eq('is_enabled', true);

    const allowedUserIds = new Set(prefs?.map(p => p.user_id) || []);

    let sentCount = 0;

    for (const tgUser of telegramUsers) {
      if (!allowedUserIds.has(tgUser.user_id)) continue;

      try {
        // Get today's orders for this user
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

        // Get orders from marketplace_orders_cache
        const { data: todayOrders } = await supabase
          .from('marketplace_orders_cache')
          .select('data, marketplace')
          .eq('user_id', tgUser.user_id)
          .gte('updated_at', todayStr);

        const { data: yesterdayOrders } = await supabase
          .from('marketplace_orders_cache')
          .select('data, marketplace')
          .eq('user_id', tgUser.user_id)
          .gte('updated_at', yesterdayStr)
          .lt('updated_at', todayStr);

        // Calculate basic metrics
        const todayCount = todayOrders?.length || 0;
        const yesterdayCount = yesterdayOrders?.length || 0;

        // Get balance info
        const { data: balance } = await supabase
          .from('user_balances')
          .select('balance_uzs')
          .eq('user_id', tgUser.user_id)
          .maybeSingle();

        // Get subscription info
        const { data: sub } = await supabase
          .from('sellercloud_subscriptions')
          .select('plan_type, activated_until')
          .eq('user_id', tgUser.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get low stock products
        const { data: products } = await supabase
          .from('marketplace_products_cache')
          .select('data')
          .eq('user_id', tgUser.user_id);

        const lowStockCount = products?.filter(p => {
          const d = p.data as any;
          return (d?.stock ?? d?.quantity ?? d?.fbs_quantity ?? 999) <= 5;
        }).length || 0;

        // Build message
        const orderTrend = todayCount > yesterdayCount ? '📈' : todayCount < yesterdayCount ? '📉' : '➡️';
        const balanceUzs = balance?.balance_uzs || 0;

        let msg = `📊 <b>Kunlik hisobot — ${todayStr}</b>\n\n`;
        msg += `🛒 Bugungi buyurtmalar: <b>${todayCount}</b> ${orderTrend}\n`;
        msg += `📦 Kechagi: ${yesterdayCount}\n`;

        if (lowStockCount > 0) {
          msg += `\n⚠️ <b>${lowStockCount} ta mahsulot kam qoldi!</b>\n`;
          msg += `Zaxirani tekshiring, sotuvdan chiqib qolishingiz mumkin.\n`;
        }

        msg += `\n💰 Balans: <b>${formatNum(balanceUzs)} so'm</b>\n`;

        if (balanceUzs < 50000) {
          msg += `⚠️ Balans kam! AI xizmatlar ishlamay qolishi mumkin.\n`;
        }

        // Subscription warning
        if (sub?.activated_until) {
          const expiresAt = new Date(sub.activated_until);
          const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
          if (daysLeft <= 5 && daysLeft > 0) {
            msg += `\n🔔 Obuna muddati: <b>${daysLeft} kun</b> qoldi\n`;
          }
        }

        // Upgrade hint for free users
        if (sub?.plan_type === 'starter') {
          msg += `\n💡 <i>P&L dashboard bilan foydangizni bilib oling → Starter tarifga o'ting</i>`;
        }

        msg += `\n\n🔗 <a href="https://sellercloudx.lovable.app/seller-cloud">Dashboard ochish</a>`;

        // Send via Telegram
        const tgResponse = await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TELEGRAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: tgUser.chat_id,
            text: msg,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });

        if (tgResponse.ok) {
          sentCount++;
        } else {
          console.error(`Failed to send to ${tgUser.chat_id}:`, await tgResponse.text());
        }
      } catch (userErr) {
        console.error(`Error processing user ${tgUser.user_id}:`, userErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Daily P&L alert error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatNum(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n));
}
