import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sendTelegram(chatId: number | bigint, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, target_user_id, message, user_ids } = body;

    if (!action || !message || typeof message !== 'string' || message.length > 5000) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: partner sends message to admin
    if (action === 'send_to_admin') {
      // Save message
      await adminSupabase.from('support_messages').insert({
        user_id: user.id,
        message,
        direction: 'partner_to_admin',
      });

      // Get user profile
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('user_id', user.id)
        .maybeSingle();

      // Forward to admin Telegram chats
      const { data: adminLinks } = await adminSupabase
        .from('telegram_chat_links')
        .select('telegram_chat_id')
        .eq('is_admin', true);

      const partnerInfo = `👤 <b>${profile?.full_name || 'Unknown'}</b>\n📱 ${profile?.phone || 'N/A'}\n📧 ${profile?.email || 'N/A'}\n[UID:${user.id}]`;

      for (const link of adminLinks || []) {
        await sendTelegram(link.telegram_chat_id,
          `📩 <b>Yangi xabar (ilovadan):</b>\n\n${partnerInfo}\n\n💬 ${message}\n\n<i>Javob: /reply ${user.id} [xabar]</i>`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: admin sends to specific partner
    if (action === 'send_to_partner') {
      // Verify admin
      const { data: adminPerm } = await adminSupabase
        .from('admin_permissions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminPerm) {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: 'target_user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save message
      await adminSupabase.from('support_messages').insert({
        user_id: target_user_id,
        message,
        direction: 'admin_to_partner',
        admin_user_id: user.id,
      });

      // Send to Telegram if linked
      const { data: partnerLink } = await adminSupabase
        .from('telegram_chat_links')
        .select('telegram_chat_id')
        .eq('user_id', target_user_id)
        .maybeSingle();

      if (partnerLink) {
        await sendTelegram(partnerLink.telegram_chat_id,
          `💬 <b>Admin javobi:</b>\n\n${message}`
        );
      }

      return new Response(JSON.stringify({ success: true, telegram_sent: !!partnerLink }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: admin broadcast
    if (action === 'broadcast') {
      const { data: adminPerm } = await adminSupabase
        .from('admin_permissions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminPerm) {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get target users (all or specific list)
      let targetUsers: any[] = [];
      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const { data } = await adminSupabase
          .from('telegram_chat_links')
          .select('telegram_chat_id, user_id')
          .in('user_id', user_ids)
          .eq('is_admin', false);
        targetUsers = data || [];
      } else {
        const { data } = await adminSupabase
          .from('telegram_chat_links')
          .select('telegram_chat_id, user_id')
          .eq('is_admin', false);
        targetUsers = data || [];
      }

      let sentCount = 0;
      for (const link of targetUsers) {
        try {
          await sendTelegram(link.telegram_chat_id, `📢 <b>SellerCloudX:</b>\n\n${message}`);
          await adminSupabase.from('support_messages').insert({
            user_id: link.user_id,
            message,
            direction: 'broadcast',
            admin_user_id: user.id,
          });
          sentCount++;
        } catch (e) {
          console.error('Broadcast err:', e);
        }
      }

      return new Response(JSON.stringify({ success: true, sent_count: sentCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Send error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
