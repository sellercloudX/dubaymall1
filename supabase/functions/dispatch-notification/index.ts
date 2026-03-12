import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sendTelegram(chatId: number | bigint, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

// Map notification types to preference keys
const TYPE_TO_PREF: Record<string, string> = {
  'order': 'notify_new_orders',
  'new_order': 'notify_new_orders',
  'stock': 'notify_low_stock',
  'low_stock': 'notify_low_stock',
  'review': 'notify_reviews',
  'new_review': 'notify_reviews',
  'sync': 'notify_sync_errors',
  'sync_error': 'notify_sync_errors',
  'subscription': 'notify_subscription',
  'price': 'notify_price_changes',
  'promotion': 'notify_promotions',
};

// Emoji map for notification types
const TYPE_EMOJI: Record<string, string> = {
  'order': '🛒',
  'new_order': '🛒',
  'stock': '📦',
  'low_stock': '📦',
  'review': '⭐',
  'new_review': '⭐',
  'sync': '⚠️',
  'sync_error': '⚠️',
  'subscription': '💳',
  'price': '💰',
  'promotion': '🎉',
  'system': '⚙️',
  'info': 'ℹ️',
};

interface DispatchRequest {
  // Single notification
  user_id?: string;
  type?: string;
  title?: string;
  message?: string;
  reference_id?: string;
  
  // Batch: dispatch all unsent notifications for a user
  batch_user_id?: string;
  
  // Process pending queue (cron-style)
  process_queue?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Auth check: require valid JWT (authenticated user or service role)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const body: DispatchRequest = await req.json();
    
    // For single dispatch: caller can only notify themselves unless admin
    if (body.user_id && body.user_id !== callerId) {
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' });
      if (!isAdmin) {
        return jsonResponse({ error: 'Forbidden: cannot notify other users' }, 403);
      }
    }
    
    // batch_user_id and process_queue require admin
    if (body.batch_user_id || body.process_queue) {
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' });
      if (!isAdmin) {
        return jsonResponse({ error: 'Forbidden: admin only' }, 403);
      }
    }

    // ============ MODE 1: Single notification dispatch ============
    if (body.user_id && body.type && body.message) {
      const result = await dispatchSingle(supabase, body.user_id, body.type, body.title || '', body.message, body.reference_id);
      return jsonResponse({ success: true, ...result });
    }

    // ============ MODE 2: Batch dispatch for a user ============
    if (body.batch_user_id) {
      const result = await dispatchBatch(supabase, body.batch_user_id);
      return jsonResponse({ success: true, ...result });
    }

    // ============ MODE 3: Process notification queue ============
    if (body.process_queue) {
      const result = await processQueue(supabase);
      return jsonResponse({ success: true, ...result });
    }

    return jsonResponse({ error: 'Invalid request. Provide user_id+type+message, batch_user_id, or process_queue.' }, 400);
  } catch (err: any) {
    console.error('Dispatch error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});

async function dispatchSingle(
  supabase: any, userId: string, type: string, title: string, message: string, referenceId?: string
) {
  // 1. Save to notifications table
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title: title || message.substring(0, 50),
    message,
    reference_id: referenceId || null,
  });

  // 2. Check Telegram preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'telegram')
    .maybeSingle();

  if (!prefs?.is_enabled) return { telegram_sent: false, reason: 'telegram_disabled' };

  // Check specific type preference
  const prefKey = TYPE_TO_PREF[type];
  if (prefKey && prefs[prefKey] === false) {
    return { telegram_sent: false, reason: `${prefKey}_disabled` };
  }

  // 3. Get Telegram chat ID
  const { data: tgLink } = await supabase
    .from('telegram_chat_links')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .eq('is_admin', false)
    .maybeSingle();

  if (!tgLink) return { telegram_sent: false, reason: 'no_telegram_link' };

  // 4. Send
  const emoji = TYPE_EMOJI[type] || '📌';
  const tgText = `${emoji} <b>${title || 'Bildirishnoma'}</b>\n\n${message}`;
  const sent = await sendTelegram(tgLink.telegram_chat_id, tgText);

  return { telegram_sent: sent };
}

async function dispatchBatch(supabase: any, userId: string) {
  // Get recent unread notifications not yet sent via Telegram
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!notifications?.length) return { dispatched: 0 };

  // Check Telegram preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'telegram')
    .maybeSingle();

  if (!prefs?.is_enabled) return { dispatched: 0, reason: 'telegram_disabled' };

  const { data: tgLink } = await supabase
    .from('telegram_chat_links')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .eq('is_admin', false)
    .maybeSingle();

  if (!tgLink) return { dispatched: 0, reason: 'no_telegram_link' };

  // Group notifications into a summary
  let summaryText = `📬 <b>Yangi bildirishnomalar (${notifications.length})</b>\n\n`;
  let count = 0;
  for (const n of notifications.slice(0, 10)) {
    const emoji = TYPE_EMOJI[n.type] || '📌';
    const prefKey = TYPE_TO_PREF[n.type];
    if (prefKey && prefs[prefKey] === false) continue;
    summaryText += `${emoji} ${n.title}\n`;
    count++;
  }
  if (notifications.length > 10) {
    summaryText += `\n... va yana ${notifications.length - 10} ta`;
  }

  if (count === 0) return { dispatched: 0, reason: 'all_types_disabled' };

  const sent = await sendTelegram(tgLink.telegram_chat_id, summaryText);
  return { dispatched: count, telegram_sent: sent };
}

async function processQueue(supabase: any) {
  // Find all users with unread notifications who have Telegram linked
  const { data: links } = await supabase
    .from('telegram_chat_links')
    .select('user_id, telegram_chat_id')
    .eq('is_admin', false);

  if (!links?.length) return { processed: 0 };

  let totalSent = 0;

  for (const link of links) {
    // Get unread notifications from last 5 minutes (avoid re-sending old ones)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', link.user_id)
      .eq('is_read', false)
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!notifications?.length) continue;

    // Check preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', link.user_id)
      .eq('channel', 'telegram')
      .maybeSingle();

    if (!prefs?.is_enabled) continue;

    for (const n of notifications) {
      const prefKey = TYPE_TO_PREF[n.type];
      if (prefKey && prefs[prefKey] === false) continue;

      const emoji = TYPE_EMOJI[n.type] || '📌';
      const sent = await sendTelegram(link.telegram_chat_id, `${emoji} <b>${n.title}</b>\n\n${n.message}`);
      if (sent) totalSent++;
      
      // Small delay to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return { processed: links.length, sent: totalSent };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
