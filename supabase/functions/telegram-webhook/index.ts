import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegram(chatId: number | bigint, text: string, opts: any = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts }),
  });
  return res.json();
}

async function getAdminChatIds(): Promise<bigint[]> {
  const { data } = await supabase
    .from('telegram_chat_links')
    .select('telegram_chat_id')
    .eq('is_admin', true);
  return data?.map((d: any) => d.telegram_chat_id) || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request = setup webhook
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('setup') === 'true') {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text) {
      return new Response('OK', { headers: corsHeaders });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username || '';
    const firstName = message.from?.first_name || '';

    // Command: /start
    if (text === '/start') {
      await sendTelegram(chatId,
        `👋 Assalomu alaykum, ${firstName}!\n\n` +
        `Bu <b>SellerCloudX</b> support botidir.\n\n` +
        `📌 Buyruqlar:\n` +
        `/link [email] — Akkauntingizni bog'lash\n` +
        `/admin — Admin sifatida ro'yxatdan o'tish\n\n` +
        `Savolingizni to'g'ridan-to'g'ri yozing — admin javob beradi! 💬`
      );
      return new Response('OK', { headers: corsHeaders });
    }

    // Command: /admin [secret]
    if (text.startsWith('/admin')) {
      // Check if this chat is already linked to an admin user
      const { data: existingLink } = await supabase
        .from('telegram_chat_links')
        .select('*')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

      if (existingLink?.is_admin) {
        await sendTelegram(chatId, '✅ Siz allaqachon admin sifatida ro\'yxatdan o\'tgansiz.');
        return new Response('OK', { headers: corsHeaders });
      }

      // Check if linked to a user who is an admin
      if (existingLink?.user_id) {
        const { data: adminPerm } = await supabase
          .from('admin_permissions')
          .select('id')
          .eq('user_id', existingLink.user_id)
          .maybeSingle();

        if (adminPerm) {
          await supabase
            .from('telegram_chat_links')
            .update({ is_admin: true })
            .eq('id', existingLink.id);
          await sendTelegram(chatId, '✅ Admin rejimi yoqildi! Endi hamkorlar xabarlari shu yerga keladi.');
          return new Response('OK', { headers: corsHeaders });
        }
      }

      await sendTelegram(chatId, '❌ Avval /link [email] bilan akkauntingizni bog\'lang. Admin huquqi kerak.');
      return new Response('OK', { headers: corsHeaders });
    }

    // Command: /link [email]
    if (text.startsWith('/link ')) {
      const email = text.replace('/link ', '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        await sendTelegram(chatId, '❌ Email noto\'g\'ri. Namuna: /link user@example.com');
        return new Response('OK', { headers: corsHeaders });
      }

      // Find user by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .eq('email', email)
        .maybeSingle();

      if (!profile) {
        await sendTelegram(chatId, `❌ ${email} bilan ro'yxatdan o'tgan foydalanuvchi topilmadi.`);
        return new Response('OK', { headers: corsHeaders });
      }

      // Check if user already linked
      const { data: existingLink } = await supabase
        .from('telegram_chat_links')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (existingLink) {
        await supabase
          .from('telegram_chat_links')
          .update({ telegram_chat_id: chatId, telegram_username: username, telegram_first_name: firstName })
          .eq('id', existingLink.id);
      } else {
        await supabase
          .from('telegram_chat_links')
          .insert({
            user_id: profile.user_id,
            telegram_chat_id: chatId,
            telegram_username: username,
            telegram_first_name: firstName,
          });
      }

      // Check if admin
      const { data: adminPerm } = await supabase
        .from('admin_permissions')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (adminPerm) {
        await supabase
          .from('telegram_chat_links')
          .update({ is_admin: true })
          .eq('user_id', profile.user_id);
        await sendTelegram(chatId, `✅ Admin sifatida bog'landingiz: ${profile.full_name || email}\nHamkorlar xabarlari shu chatga keladi.`);
      } else {
        await sendTelegram(chatId, `✅ Akkaunt bog'landi: ${profile.full_name || email}\nEndi savol va takliflaringizni yozing — admin javob beradi!`);
      }

      return new Response('OK', { headers: corsHeaders });
    }

    // Command: /broadcast [message] - admin only
    if (text.startsWith('/broadcast ')) {
      const { data: senderLink } = await supabase
        .from('telegram_chat_links')
        .select('*')
        .eq('telegram_chat_id', chatId)
        .eq('is_admin', true)
        .maybeSingle();

      if (!senderLink) {
        await sendTelegram(chatId, '❌ Bu buyruq faqat adminlar uchun.');
        return new Response('OK', { headers: corsHeaders });
      }

      const broadcastText = text.replace('/broadcast ', '').trim();
      if (!broadcastText) {
        await sendTelegram(chatId, '❌ Xabar matnini kiriting: /broadcast Salom hamkorlar!');
        return new Response('OK', { headers: corsHeaders });
      }

      // Get all non-admin linked users
      const { data: allLinks } = await supabase
        .from('telegram_chat_links')
        .select('telegram_chat_id, user_id')
        .eq('is_admin', false);

      let sentCount = 0;
      for (const link of allLinks || []) {
        try {
          await sendTelegram(link.telegram_chat_id, `📢 <b>SellerCloudX xabari:</b>\n\n${broadcastText}`);
          sentCount++;

          // Save broadcast message
          await supabase.from('support_messages').insert({
            user_id: link.user_id,
            message: broadcastText,
            direction: 'broadcast',
            admin_user_id: senderLink.user_id,
          });
        } catch (e) {
          console.error('Broadcast error for', link.telegram_chat_id, e);
        }
      }

      await sendTelegram(chatId, `✅ Xabar ${sentCount} ta hamkorga yuborildi.`);
      return new Response('OK', { headers: corsHeaders });
    }

    // Check if sender is admin — if replying to a forwarded message
    const { data: senderLink } = await supabase
      .from('telegram_chat_links')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (senderLink?.is_admin) {
      // Admin reply: check if replying to a message
      if (message.reply_to_message?.text) {
        // Extract user_id from the original forwarded message metadata
        const replyText = message.reply_to_message.text;
        const userIdMatch = replyText.match(/\[UID:([a-f0-9-]+)\]/);

        if (userIdMatch) {
          const targetUserId = userIdMatch[1];

          // Find partner's telegram chat
          const { data: partnerLink } = await supabase
            .from('telegram_chat_links')
            .select('telegram_chat_id')
            .eq('user_id', targetUserId)
            .maybeSingle();

          if (partnerLink) {
            await sendTelegram(partnerLink.telegram_chat_id,
              `💬 <b>Admin javobi:</b>\n\n${text}`
            );

            // Save to DB
            await supabase.from('support_messages').insert({
              user_id: targetUserId,
              message: text,
              direction: 'admin_to_partner',
              admin_user_id: senderLink.user_id,
            });

            await sendTelegram(chatId, '✅ Javob yuborildi.');
            return new Response('OK', { headers: corsHeaders });
          }
        }
      }

      // Admin typed /reply [user_id] [message]
      if (text.startsWith('/reply ')) {
        const parts = text.replace('/reply ', '').trim();
        const spaceIdx = parts.indexOf(' ');
        if (spaceIdx > 0) {
          const targetUserId = parts.substring(0, spaceIdx);
          const replyMsg = parts.substring(spaceIdx + 1);

          const { data: partnerLink } = await supabase
            .from('telegram_chat_links')
            .select('telegram_chat_id')
            .eq('user_id', targetUserId)
            .maybeSingle();

          if (partnerLink) {
            await sendTelegram(partnerLink.telegram_chat_id,
              `💬 <b>Admin javobi:</b>\n\n${replyMsg}`
            );

            await supabase.from('support_messages').insert({
              user_id: targetUserId,
              message: replyMsg,
              direction: 'admin_to_partner',
              admin_user_id: senderLink.user_id,
            });

            await sendTelegram(chatId, '✅ Javob yuborildi.');
          } else {
            await sendTelegram(chatId, '❌ Foydalanuvchi topilmadi yoki Telegram bog\'lanmagan.');
          }
          return new Response('OK', { headers: corsHeaders });
        }
      }

      await sendTelegram(chatId,
        `ℹ️ Javob berish uchun hamkor xabariga reply qiling yoki:\n/reply [user_id] [xabar]\n/broadcast [xabar] — ommaviy xabar`
      );
      return new Response('OK', { headers: corsHeaders });
    }

    // Regular user (partner) message
    if (senderLink?.user_id) {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('user_id', senderLink.user_id)
        .maybeSingle();

      // Save message to DB
      await supabase.from('support_messages').insert({
        user_id: senderLink.user_id,
        message: text,
        direction: 'partner_to_admin',
      });

      // Forward to all admin telegram chats
      const adminChatIds = await getAdminChatIds();
      const partnerInfo = `👤 <b>${profile?.full_name || firstName}</b>\n📱 ${profile?.phone || 'N/A'}\n📧 ${profile?.email || 'N/A'}\n🆔 @${username || 'N/A'}\n[UID:${senderLink.user_id}]`;

      for (const adminChatId of adminChatIds) {
        await sendTelegram(adminChatId,
          `📩 <b>Yangi xabar:</b>\n\n${partnerInfo}\n\n💬 ${text}\n\n<i>Javob berish uchun bu xabarga reply qiling</i>`
        );
      }

      await sendTelegram(chatId, '✅ Xabaringiz adminga yuborildi. Tez orada javob olasiz!');
    } else {
      // Not linked
      await sendTelegram(chatId,
        `⚠️ Akkauntingiz bog'lanmagan.\n\nAvval /link [email] buyrug'i bilan SellerCloudX akkauntingizni bog'lang.\n\nMasalan: /link user@example.com`
      );
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { headers: corsHeaders });
  }
});
