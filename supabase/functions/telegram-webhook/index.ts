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

// ==================== TELEGRAM API HELPERS ====================

async function tg(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function send(chatId: number | bigint, text: string, opts: any = {}) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...opts });
}

function editMessage(chatId: number | bigint, messageId: number, text: string, opts: any = {}) {
  return tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...opts });
}

function answerCallback(callbackQueryId: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false });
}

// ==================== DB HELPERS ====================

async function getAdminChatIds(): Promise<bigint[]> {
  const { data } = await supabase
    .from('telegram_chat_links')
    .select('telegram_chat_id')
    .eq('is_admin', true);
  return data?.map((d: any) => d.telegram_chat_id) || [];
}

async function getSenderLink(chatId: number) {
  const { data } = await supabase
    .from('telegram_chat_links')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  return data;
}

async function getUserProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, phone, email')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

async function getUserSubscription(userId: string) {
  const { data } = await supabase
    .from('sellercloud_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('support_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'partner_to_admin')
    .eq('is_read', false);
  return count || 0;
}

// ==================== INLINE KEYBOARDS ====================

function mainMenuKeyboard(isAdmin: boolean) {
  const keys: any[][] = [];
  if (isAdmin) {
    keys.push([
      { text: '👥 Hamkorlar', callback_data: 'admin_users' },
      { text: '📊 Statistika', callback_data: 'admin_stats' },
    ]);
    keys.push([
      { text: '📢 Ommaviy xabar', callback_data: 'admin_broadcast_start' },
      { text: '💬 Javobsiz xabarlar', callback_data: 'admin_unread' },
    ]);
    keys.push([
      { text: '💰 Obunalar', callback_data: 'admin_subscriptions' },
      { text: '🔄 Yangilash', callback_data: 'admin_refresh' },
    ]);
  } else {
    keys.push([
      { text: '💬 Adminga yozish', callback_data: 'partner_write' },
      { text: '📋 Xabarlarim', callback_data: 'partner_history' },
    ]);
    keys.push([
      { text: '📊 Obuna holati', callback_data: 'partner_subscription' },
      { text: '🌐 Ilovaga o\'tish', url: 'https://sellercloudx.lovable.app' },
    ]);
  }
  return { inline_keyboard: keys };
}

function userDetailKeyboard(userId: string) {
  return {
    inline_keyboard: [
      [
        { text: '💬 Xabar yozish', callback_data: `msg_${userId}` },
        { text: '📋 Chat tarixi', callback_data: `history_${userId}` },
      ],
      [
        { text: '✅ Aktivlashtirish', callback_data: `activate_${userId}` },
        { text: '❌ Deaktivlashtirish', callback_data: `deactivate_${userId}` },
      ],
      [
        { text: '◀️ Orqaga', callback_data: 'admin_users' },
      ],
    ],
  };
}

function backKeyboard(callbackData: string = 'main_menu') {
  return { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: callbackData }]] };
}

// ==================== COMMAND HANDLERS ====================

async function handleStart(chatId: number, firstName: string) {
  const link = await getSenderLink(chatId);
  if (link) {
    const profile = await getUserProfile(link.user_id);
    const name = profile?.full_name || firstName;
    await send(chatId,
      `👋 Xush kelibsiz, <b>${name}</b>!\n\n` +
      `🔗 Akkauntingiz bog'langan\n` +
      `📧 ${profile?.email || 'N/A'}\n\n` +
      `Quyidagi tugmalardan foydalaning:`,
      { reply_markup: mainMenuKeyboard(link.is_admin) }
    );
  } else {
    await send(chatId,
      `👋 Assalomu alaykum, <b>${firstName}</b>!\n\n` +
      `Bu <b>SellerCloudX</b> rasmiy support botidir.\n\n` +
      `🔗 Akkauntingizni bog'lash uchun:\n` +
      `/link email@example.com\n\n` +
      `📌 Admin bo'lish uchun:\n` +
      `/admin\n\n` +
      `❓ Bog'lanmasdan savol bermoqchimisiz? Shunchaki yozing!`,
      { reply_markup: { inline_keyboard: [[
        { text: '🌐 Ro\'yxatdan o\'tish', url: 'https://sellercloudx.lovable.app' },
      ]]} }
    );
  }
}

async function handleLink(chatId: number, email: string, username: string, firstName: string) {
  if (!email || !email.includes('@')) {
    await send(chatId, '❌ Email noto\'g\'ri.\n\nNamuna: <code>/link user@example.com</code>');
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, email')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    await send(chatId,
      `❌ <b>${email}</b> topilmadi.\n\nAvval ilovada ro'yxatdan o'ting:`,
      { reply_markup: { inline_keyboard: [[
        { text: '📱 Ro\'yxatdan o\'tish', url: 'https://sellercloudx.lovable.app' },
      ]]} }
    );
    return;
  }

  // Upsert link
  const { data: existingLink } = await supabase
    .from('telegram_chat_links')
    .select('id')
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (existingLink) {
    await supabase.from('telegram_chat_links')
      .update({ telegram_chat_id: chatId, telegram_username: username, telegram_first_name: firstName })
      .eq('id', existingLink.id);
  } else {
    await supabase.from('telegram_chat_links')
      .insert({ user_id: profile.user_id, telegram_chat_id: chatId, telegram_username: username, telegram_first_name: firstName });
  }

  // Check admin
  const { data: adminPerm } = await supabase
    .from('admin_permissions')
    .select('id')
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (adminPerm) {
    await supabase.from('telegram_chat_links')
      .update({ is_admin: true })
      .eq('user_id', profile.user_id);

    await send(chatId,
      `✅ <b>Admin sifatida bog'landingiz!</b>\n\n` +
      `👤 ${profile.full_name || email}\n` +
      `📧 ${profile.email}\n` +
      `📱 ${profile.phone || 'N/A'}\n\n` +
      `Hamkorlar xabarlari shu chatga keladi.`,
      { reply_markup: mainMenuKeyboard(true) }
    );
  } else {
    await send(chatId,
      `✅ <b>Akkaunt muvaffaqiyatli bog'landi!</b>\n\n` +
      `👤 ${profile.full_name || email}\n` +
      `📧 ${profile.email}\n` +
      `📱 ${profile.phone || 'N/A'}\n\n` +
      `Endi savollaringizni to'g'ridan-to'g'ri yozing!`,
      { reply_markup: mainMenuKeyboard(false) }
    );

    // Notify admins about new Telegram link
    const adminChatIds = await getAdminChatIds();
    for (const adminChatId of adminChatIds) {
      await send(adminChatId,
        `🔗 <b>Yangi Telegram bog'lanish:</b>\n\n` +
        `👤 ${profile.full_name || 'Nomsiz'}\n` +
        `📧 ${profile.email}\n` +
        `📱 ${profile.phone || 'N/A'}\n` +
        `🆔 @${username || 'N/A'}`,
        { reply_markup: userDetailKeyboard(profile.user_id) }
      );
    }
  }
}

async function handleAdmin(chatId: number) {
  const link = await getSenderLink(chatId);
  if (!link) {
    await send(chatId, '❌ Avval /link [email] bilan akkauntingizni bog\'lang.');
    return;
  }
  if (link.is_admin) {
    await send(chatId, '✅ Siz allaqachon admin sifatida tasdiqlangansiz!', 
      { reply_markup: mainMenuKeyboard(true) });
    return;
  }

  const { data: adminPerm } = await supabase
    .from('admin_permissions')
    .select('id')
    .eq('user_id', link.user_id)
    .maybeSingle();

  if (adminPerm) {
    await supabase.from('telegram_chat_links')
      .update({ is_admin: true })
      .eq('id', link.id);
    await send(chatId, '✅ <b>Admin rejimi yoqildi!</b>\n\nHamkorlar xabarlari shu chatga keladi.',
      { reply_markup: mainMenuKeyboard(true) });
  } else {
    await send(chatId, '❌ Sizda admin huquqi yo\'q. Admin panel orqali huquq berilishi kerak.');
  }
}

// ==================== CALLBACK QUERY HANDLERS ====================

async function handleCallback(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const link = await getSenderLink(chatId);

  await answerCallback(callbackQuery.id);

  if (!link) {
    await send(chatId, '❌ Avval /link [email] bilan bog\'laning.');
    return;
  }

  // ===== MAIN MENU =====
  if (data === 'main_menu') {
    const profile = await getUserProfile(link.user_id);
    await editMessage(chatId, messageId,
      `🏠 <b>Bosh sahifa</b>\n\n👤 ${profile?.full_name || 'Foydalanuvchi'}\nQuyidagi tugmalardan foydalaning:`,
      { reply_markup: mainMenuKeyboard(link.is_admin) }
    );
    return;
  }

  // ===== PARTNER ACTIONS =====
  if (data === 'partner_write') {
    await editMessage(chatId, messageId,
      `💬 <b>Adminga xabar</b>\n\nSavolingizni yozing — admin tez orada javob beradi!\n\n<i>Shunchaki oddiy xabar sifatida yozing...</i>`,
      { reply_markup: backKeyboard() }
    );
    return;
  }

  if (data === 'partner_history') {
    const { data: messages } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', link.user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!messages?.length) {
      await editMessage(chatId, messageId,
        '📋 <b>Xabarlar tarixi</b>\n\nHali xabar yo\'q.',
        { reply_markup: backKeyboard() }
      );
      return;
    }

    let historyText = '📋 <b>So\'nggi xabarlar:</b>\n\n';
    for (const msg of messages.reverse()) {
      const time = new Date(msg.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      const arrow = msg.direction === 'partner_to_admin' ? '➡️ Siz' : msg.direction === 'broadcast' ? '📢 Ommaviy' : '⬅️ Admin';
      historyText += `<b>${arrow}</b> [${time}]\n${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}\n\n`;
    }

    await editMessage(chatId, messageId, historyText, { reply_markup: backKeyboard() });
    return;
  }

  if (data === 'partner_subscription') {
    const sub = await getUserSubscription(link.user_id);
    if (!sub) {
      await editMessage(chatId, messageId,
        '📊 <b>Obuna holati</b>\n\n❌ Obuna mavjud emas.\n\nIlovada obuna sotib oling:',
        { reply_markup: { inline_keyboard: [
          [{ text: '📱 Ilovaga o\'tish', url: 'https://sellercloudx.lovable.app' }],
          [{ text: '◀️ Orqaga', callback_data: 'main_menu' }],
        ]} }
      );
      return;
    }

    const status = sub.is_active ? '✅ Faol' : '❌ Faol emas';
    const until = sub.activated_until ? new Date(sub.activated_until).toLocaleDateString('uz-UZ') : 'N/A';
    const plan = sub.plan_type || 'Standard';

    await editMessage(chatId, messageId,
      `📊 <b>Obuna holati</b>\n\n` +
      `📦 Tarif: <b>${plan}</b>\n` +
      `🔄 Holat: ${status}\n` +
      `📅 Muddat: ${until}\n` +
      `💵 Oylik: $${sub.monthly_fee || 0}`,
      { reply_markup: backKeyboard() }
    );
    return;
  }

  // ===== ADMIN ACTIONS =====
  if (!link.is_admin) {
    await send(chatId, '❌ Bu funksiya faqat adminlar uchun.');
    return;
  }

  if (data === 'admin_users') {
    const { data: links } = await supabase
      .from('telegram_chat_links')
      .select('user_id, telegram_username, telegram_first_name, is_admin, created_at')
      .eq('is_admin', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!links?.length) {
      await editMessage(chatId, messageId, '👥 <b>Hamkorlar</b>\n\nHali hech kim bog\'lanmagan.', { reply_markup: backKeyboard() });
      return;
    }

    const buttons: any[][] = [];
    for (const l of links) {
      const profile = await getUserProfile(l.user_id);
      const unread = await getUnreadCount(l.user_id);
      const name = profile?.full_name || l.telegram_first_name || 'Nomsiz';
      const badge = unread > 0 ? ` 🔴${unread}` : '';
      buttons.push([{ text: `👤 ${name}${badge}`, callback_data: `user_${l.user_id}` }]);
    }
    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);

    await editMessage(chatId, messageId,
      `👥 <b>Hamkorlar ro'yxati</b> (${links.length} ta)\n\nTanlang:`,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('user_')) {
    const userId = data.replace('user_', '');
    const profile = await getUserProfile(userId);
    const sub = await getUserSubscription(userId);
    const unread = await getUnreadCount(userId);
    
    const { data: tgLink } = await supabase
      .from('telegram_chat_links')
      .select('telegram_username, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    const subStatus = sub?.is_active ? '✅ Faol' : '❌ Faol emas';
    const subUntil = sub?.activated_until ? new Date(sub.activated_until).toLocaleDateString('uz-UZ') : 'N/A';

    await editMessage(chatId, messageId,
      `👤 <b>${profile?.full_name || 'Nomsiz'}</b>\n\n` +
      `📧 ${profile?.email || 'N/A'}\n` +
      `📱 ${profile?.phone || 'N/A'}\n` +
      `🆔 @${tgLink?.telegram_username || 'N/A'}\n` +
      `📅 Bog'langan: ${tgLink?.created_at ? new Date(tgLink.created_at).toLocaleDateString('uz-UZ') : 'N/A'}\n\n` +
      `━━━ Obuna ━━━\n` +
      `📦 Holat: ${subStatus}\n` +
      `📅 Muddat: ${subUntil}\n` +
      `💵 Tarif: ${sub?.plan_type || 'N/A'}\n\n` +
      `💬 Javobsiz xabarlar: ${unread}`,
      { reply_markup: userDetailKeyboard(userId) }
    );
    return;
  }

  if (data.startsWith('msg_')) {
    const userId = data.replace('msg_', '');
    const profile = await getUserProfile(userId);
    // Store the target user for the next text message from admin
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: userId } as any)
      .eq('telegram_chat_id', chatId);

    await editMessage(chatId, messageId,
      `💬 <b>Xabar yozish</b>\n\n` +
      `Qabul qiluvchi: <b>${profile?.full_name || 'Nomsiz'}</b>\n\n` +
      `Endi xabaringizni oddiy matn sifatida yozing...`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_reply' }]] } }
    );
    return;
  }

  if (data === 'cancel_reply') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: null } as any)
      .eq('telegram_chat_id', chatId);
    
    await editMessage(chatId, messageId, '❌ Xabar bekor qilindi.',
      { reply_markup: mainMenuKeyboard(true) });
    return;
  }

  if (data.startsWith('history_')) {
    const userId = data.replace('history_', '');
    const profile = await getUserProfile(userId);
    const { data: messages } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15);

    // Mark as read
    await supabase.from('support_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('direction', 'partner_to_admin')
      .eq('is_read', false);

    let historyText = `📋 <b>Chat tarixi — ${profile?.full_name || 'Nomsiz'}</b>\n\n`;
    if (!messages?.length) {
      historyText += 'Hali xabar yo\'q.';
    } else {
      for (const msg of messages.reverse()) {
        const time = new Date(msg.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const arrow = msg.direction === 'partner_to_admin' ? '👤' : msg.direction === 'broadcast' ? '📢' : '🛡️';
        historyText += `${arrow} [${time}] ${msg.message.substring(0, 80)}${msg.message.length > 80 ? '...' : ''}\n`;
      }
    }

    await editMessage(chatId, messageId, historyText,
      { reply_markup: { inline_keyboard: [
        [{ text: '💬 Xabar yozish', callback_data: `msg_${userId}` }],
        [{ text: '◀️ Orqaga', callback_data: `user_${userId}` }],
      ]} }
    );
    return;
  }

  if (data.startsWith('activate_')) {
    const userId = data.replace('activate_', '');
    // Activate subscription for 1 month
    const { data: sub } = await supabase
      .from('sellercloud_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      await supabase.from('sellercloud_subscriptions')
        .update({
          is_active: true,
          admin_override: true,
          activated_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', sub.id);

      // Notify partner
      const { data: partnerLink } = await supabase
        .from('telegram_chat_links')
        .select('telegram_chat_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (partnerLink) {
        await send(partnerLink.telegram_chat_id,
          `🎉 <b>Obuna aktivlashtirildi!</b>\n\n` +
          `Admin tomonidan 1 oylik obuna berildi.\n` +
          `Ilovadan foydalanishingiz mumkin!`,
          { reply_markup: { inline_keyboard: [[
            { text: '📱 Ilovaga o\'tish', url: 'https://sellercloudx.lovable.app' },
          ]]} }
        );
      }

      await supabase.from('support_messages').insert({
        user_id: userId,
        message: '✅ Admin tomonidan 1 oylik obuna aktivlashtirildi',
        direction: 'system',
      });

      await editMessage(chatId, messageId, '✅ Obuna 1 oyga aktivlashtirildi!',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: `user_${userId}` }]] } });
    } else {
      await editMessage(chatId, messageId, '❌ Bu foydalanuvchining obunasi yo\'q.',
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: `user_${userId}` }]] } });
    }
    return;
  }

  if (data.startsWith('deactivate_')) {
    const userId = data.replace('deactivate_', '');
    await supabase.from('sellercloud_subscriptions')
      .update({ is_active: false, admin_override: false })
      .eq('user_id', userId);

    const { data: partnerLink } = await supabase
      .from('telegram_chat_links')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (partnerLink) {
      await send(partnerLink.telegram_chat_id,
        `⚠️ <b>Obuna to'xtatildi</b>\n\nAdmin tomonidan obuna deaktivlashtirildi. Savol bo'lsa adminga yozing.`
      );
    }

    await supabase.from('support_messages').insert({
      user_id: userId,
      message: '❌ Admin tomonidan obuna deaktivlashtirildi',
      direction: 'system',
    });

    await editMessage(chatId, messageId, '❌ Obuna deaktivlashtirildi.',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: `user_${userId}` }]] } });
    return;
  }

  if (data === 'admin_stats') {
    // Get stats
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: linkedUsers } = await supabase
      .from('telegram_chat_links')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', false);

    const { count: activeSubscriptions } = await supabase
      .from('sellercloud_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalMessages } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true });

    const { count: unreadMessages } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'partner_to_admin')
      .eq('is_read', false);

    const { count: todayRegistrations } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    const { count: connections } = await supabase
      .from('marketplace_connections')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    await editMessage(chatId, messageId,
      `📊 <b>SellerCloudX Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${totalUsers || 0}</b>\n` +
      `🔗 Telegram bog'langan: <b>${linkedUsers || 0}</b>\n` +
      `📱 Bugungi ro'yxat: <b>${todayRegistrations || 0}</b>\n\n` +
      `━━━ Obunalar ━━━\n` +
      `✅ Faol obunalar: <b>${activeSubscriptions || 0}</b>\n\n` +
      `━━━ Xabarlar ━━━\n` +
      `💬 Jami xabarlar: <b>${totalMessages || 0}</b>\n` +
      `🔴 Javobsiz: <b>${unreadMessages || 0}</b>\n\n` +
      `━━━ Marketplace ━━━\n` +
      `🔌 Faol ulanishlar: <b>${connections || 0}</b>`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🔄 Yangilash', callback_data: 'admin_stats' }],
        [{ text: '◀️ Orqaga', callback_data: 'main_menu' }],
      ]} }
    );
    return;
  }

  if (data === 'admin_unread') {
    const { data: unreadMsgs } = await supabase
      .from('support_messages')
      .select('user_id, message, created_at')
      .eq('direction', 'partner_to_admin')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!unreadMsgs?.length) {
      await editMessage(chatId, messageId, '✅ <b>Barcha xabarlarga javob berilgan!</b>',
        { reply_markup: backKeyboard() });
      return;
    }

    // Group by user
    const userMap = new Map<string, any[]>();
    for (const msg of unreadMsgs) {
      if (!userMap.has(msg.user_id)) userMap.set(msg.user_id, []);
      userMap.get(msg.user_id)!.push(msg);
    }

    const buttons: any[][] = [];
    let text = `🔴 <b>Javobsiz xabarlar</b> (${unreadMsgs.length} ta)\n\n`;

    for (const [userId, msgs] of userMap) {
      const profile = await getUserProfile(userId);
      const name = profile?.full_name || 'Nomsiz';
      text += `👤 <b>${name}</b> — ${msgs.length} xabar\n`;
      text += `   └ ${msgs[0].message.substring(0, 60)}...\n\n`;
      buttons.push([{ text: `💬 ${name} (${msgs.length})`, callback_data: `history_${userId}` }]);
    }

    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);
    await editMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  if (data === 'admin_subscriptions') {
    const { data: subs } = await supabase
      .from('sellercloud_subscriptions')
      .select('user_id, plan_type, is_active, activated_until, monthly_fee')
      .order('created_at', { ascending: false })
      .limit(15);

    if (!subs?.length) {
      await editMessage(chatId, messageId, '📦 <b>Obunalar</b>\n\nHali obuna yo\'q.',
        { reply_markup: backKeyboard() });
      return;
    }

    let text = `💰 <b>Obunalar</b> (${subs.length} ta)\n\n`;
    const buttons: any[][] = [];

    for (const sub of subs) {
      const profile = await getUserProfile(sub.user_id);
      const name = profile?.full_name || 'Nomsiz';
      const status = sub.is_active ? '✅' : '❌';
      const until = sub.activated_until ? new Date(sub.activated_until).toLocaleDateString('uz-UZ') : 'N/A';
      text += `${status} <b>${name}</b> — ${sub.plan_type || 'Standard'} | ${until}\n`;
      buttons.push([{ text: `${status} ${name}`, callback_data: `user_${sub.user_id}` }]);
    }

    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);
    await editMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  if (data === 'admin_broadcast_start') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: 'broadcast' } as any)
      .eq('telegram_chat_id', chatId);

    await editMessage(chatId, messageId,
      `📢 <b>Ommaviy xabar</b>\n\nBarcha hamkorlarga yuboriladigan xabar matnini yozing:`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_reply' }]] } }
    );
    return;
  }

  if (data === 'admin_refresh') {
    const profile = await getUserProfile(link.user_id);
    await editMessage(chatId, messageId,
      `🏠 <b>Bosh sahifa</b>\n\n👤 ${profile?.full_name || 'Admin'}\nQuyidagi tugmalardan foydalaning:`,
      { reply_markup: mainMenuKeyboard(true) }
    );
    return;
  }
}

// ==================== TEXT MESSAGE HANDLER ====================

async function handleTextMessage(chatId: number, text: string, username: string, firstName: string, replyToMessage: any) {
  const link = await getSenderLink(chatId);

  // Admin with active reply target
  if (link?.is_admin) {
    // Check for reply_target_user_id (set via inline keyboard)
    const { data: freshLink } = await supabase
      .from('telegram_chat_links')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    const replyTarget = (freshLink as any)?.reply_target_user_id;

    if (replyTarget === 'broadcast') {
      // Broadcast mode
      await supabase.from('telegram_chat_links')
        .update({ reply_target_user_id: null } as any)
        .eq('telegram_chat_id', chatId);

      const { data: allLinks } = await supabase
        .from('telegram_chat_links')
        .select('telegram_chat_id, user_id')
        .eq('is_admin', false);

      let sentCount = 0;
      for (const l of allLinks || []) {
        try {
          await send(l.telegram_chat_id, `📢 <b>SellerCloudX xabari:</b>\n\n${text}`);
          await supabase.from('support_messages').insert({
            user_id: l.user_id,
            message: text,
            direction: 'broadcast',
            admin_user_id: link.user_id,
          });
          sentCount++;
        } catch (e) { console.error('Broadcast error:', e); }
      }

      await send(chatId, `✅ Xabar <b>${sentCount}</b> ta hamkorga yuborildi!`,
        { reply_markup: mainMenuKeyboard(true) });
      return;
    }

    if (replyTarget && replyTarget !== 'null') {
      // Direct reply to specific user
      await supabase.from('telegram_chat_links')
        .update({ reply_target_user_id: null } as any)
        .eq('telegram_chat_id', chatId);

      const { data: partnerLink } = await supabase
        .from('telegram_chat_links')
        .select('telegram_chat_id')
        .eq('user_id', replyTarget)
        .maybeSingle();

      if (partnerLink) {
        await send(partnerLink.telegram_chat_id,
          `💬 <b>Admin javobi:</b>\n\n${text}`,
          { reply_markup: { inline_keyboard: [[
            { text: '💬 Javob yozish', callback_data: 'partner_write' },
          ]]} }
        );
      }

      await supabase.from('support_messages').insert({
        user_id: replyTarget,
        message: text,
        direction: 'admin_to_partner',
        admin_user_id: link.user_id,
      });

      const profile = await getUserProfile(replyTarget);
      await send(chatId, `✅ Javob yuborildi: <b>${profile?.full_name || 'Nomsiz'}</b>`,
        { reply_markup: mainMenuKeyboard(true) });
      return;
    }

    // Reply to forwarded message
    if (replyToMessage?.text) {
      const uidMatch = replyToMessage.text.match(/\[UID:([a-f0-9-]+)\]/);
      if (uidMatch) {
        const targetUserId = uidMatch[1];
        const { data: partnerLink } = await supabase
          .from('telegram_chat_links')
          .select('telegram_chat_id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (partnerLink) {
          await send(partnerLink.telegram_chat_id,
            `💬 <b>Admin javobi:</b>\n\n${text}`,
            { reply_markup: { inline_keyboard: [[
              { text: '💬 Javob yozish', callback_data: 'partner_write' },
            ]]} }
          );
        }

        await supabase.from('support_messages').insert({
          user_id: targetUserId,
          message: text,
          direction: 'admin_to_partner',
          admin_user_id: link.user_id,
        });

        await send(chatId, '✅ Javob yuborildi.');
        return;
      }
    }

    // No target — show menu
    await send(chatId,
      `ℹ️ Kimga javob berishni tanlang:`,
      { reply_markup: mainMenuKeyboard(true) }
    );
    return;
  }

  // Partner message
  if (link?.user_id) {
    const profile = await getUserProfile(link.user_id);

    await supabase.from('support_messages').insert({
      user_id: link.user_id,
      message: text,
      direction: 'partner_to_admin',
    });

    const adminChatIds = await getAdminChatIds();
    const partnerInfo = 
      `👤 <b>${profile?.full_name || firstName}</b>\n` +
      `📱 ${profile?.phone || 'N/A'}\n` +
      `📧 ${profile?.email || 'N/A'}\n` +
      `🆔 @${username || 'N/A'}\n` +
      `[UID:${link.user_id}]`;

    for (const adminChatId of adminChatIds) {
      await send(adminChatId,
        `📩 <b>Yangi xabar:</b>\n\n${partnerInfo}\n\n💬 ${text}`,
        { reply_markup: { inline_keyboard: [
          [{ text: '💬 Javob yozish', callback_data: `msg_${link.user_id}` }],
          [{ text: '👤 Profil ko\'rish', callback_data: `user_${link.user_id}` }],
        ]} }
      );
    }

    await send(chatId,
      '✅ Xabaringiz adminga yuborildi!\nTez orada javob olasiz.',
      { reply_markup: { inline_keyboard: [[
        { text: '📋 Xabarlarim', callback_data: 'partner_history' },
        { text: '🏠 Bosh sahifa', callback_data: 'main_menu' },
      ]]} }
    );
  } else {
    // Not linked — still forward to admins with limited info
    const adminChatIds = await getAdminChatIds();
    for (const adminChatId of adminChatIds) {
      await send(adminChatId,
        `📩 <b>Bog'lanmagan foydalanuvchi xabari:</b>\n\n` +
        `👤 ${firstName}\n🆔 @${username || 'N/A'}\n🔢 ChatID: ${chatId}\n\n💬 ${text}`
      );
    }

    await send(chatId,
      `⚠️ Akkauntingiz bog'lanmagan, lekin xabaringiz adminga yuborildi.\n\n` +
      `🔗 Akkauntni bog'lash uchun:\n<code>/link email@example.com</code>`,
      { reply_markup: { inline_keyboard: [[
        { text: '📱 Ro\'yxatdan o\'tish', url: 'https://sellercloudx.lovable.app' },
      ]]} }
    );
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook setup
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('setup') === 'true') {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const res = await tg('setWebhook', {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      });
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    const update = await req.json();

    // Handle callback queries (inline keyboard presses)
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return new Response('OK', { headers: corsHeaders });
    }

    const message = update.message;
    if (!message) return new Response('OK', { headers: corsHeaders });

    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const username = message.from?.username || '';
    const firstName = message.from?.first_name || '';

    if (!text) return new Response('OK', { headers: corsHeaders });

    // Commands
    if (text === '/start' || text === '/menu') {
      await handleStart(chatId, firstName);
    } else if (text.startsWith('/link ')) {
      await handleLink(chatId, text.replace('/link ', '').trim().toLowerCase(), username, firstName);
    } else if (text === '/admin' || text.startsWith('/admin ')) {
      await handleAdmin(chatId);
    } else if (text === '/help') {
      await send(chatId,
        `📌 <b>Buyruqlar:</b>\n\n` +
        `/start — Bosh sahifa\n` +
        `/menu — Menyu\n` +
        `/link [email] — Akkaunt bog'lash\n` +
        `/admin — Admin rejimi\n` +
        `/help — Yordam\n\n` +
        `Savolingizni oddiy xabar sifatida yozing!`
      );
    } else {
      // Regular text message
      await handleTextMessage(chatId, text, username, firstName, message.reply_to_message);
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { headers: corsHeaders });
  }
});
