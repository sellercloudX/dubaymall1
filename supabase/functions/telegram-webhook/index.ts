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

const MINI_APP_URL = 'https://sellercloudx.com/telegram-admin';

// ==================== TELEGRAM API ====================

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

function answerCallback(callbackQueryId: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

function editMessage(chatId: number | bigint, messageId: number, text: string, opts: any = {}) {
  return tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...opts });
}

// ==================== DB HELPERS ====================

async function isAdminChat(chatId: number): Promise<any> {
  const { data } = await supabase
    .from('telegram_chat_links')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('is_admin', true)
    .maybeSingle();
  return data;
}

async function getAdminChatIds(): Promise<bigint[]> {
  const { data } = await supabase
    .from('telegram_chat_links')
    .select('telegram_chat_id')
    .eq('is_admin', true);
  return data?.map((d: any) => d.telegram_chat_id) || [];
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

// ==================== KEYBOARDS ====================

function adminMainMenu() {
  return { inline_keyboard: [
    [{ text: '📱 Admin Panel', web_app: { url: MINI_APP_URL } }],
    [
      { text: '👥 Hamkorlar', callback_data: 'admin_users' },
      { text: '📊 Statistika', callback_data: 'admin_stats' },
    ],
    [
      { text: '📢 Ommaviy xabar', callback_data: 'broadcast_start' },
      { text: '🔴 Javobsiz', callback_data: 'admin_unread' },
    ],
    [
      { text: '💰 Obunalar', callback_data: 'admin_subs' },
      { text: '🔄 Yangilash', callback_data: 'admin_refresh' },
    ],
  ]};
}

function userDetailKb(userId: string) {
  return { inline_keyboard: [
    [
      { text: '💬 Xabar yozish', callback_data: `msg_${userId}` },
      { text: '📋 Chat tarixi', callback_data: `hist_${userId}` },
    ],
    [
      { text: '✅ Aktivlashtirish', callback_data: `actv_${userId}` },
      { text: '❌ Deaktivlashtirish', callback_data: `deac_${userId}` },
    ],
    [{ text: '◀️ Orqaga', callback_data: 'admin_users' }],
  ]};
}

// ==================== SETUP ====================

async function setupWebhookAndMenu() {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
  
  // Set webhook
  const whRes = await tg('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  });

  // Set menu button with Mini App
  await tg('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '📱 Admin Panel',
      web_app: { url: MINI_APP_URL },
    },
  });

  // Set bot commands (admin only)
  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Botni ishga tushirish' },
      { command: 'menu', description: 'Admin menyu' },
      { command: 'link', description: 'Akkaunt bog\'lash: /link email' },
      { command: 'admin', description: 'Admin rejimini yoqish' },
      { command: 'users', description: 'Hamkorlar ro\'yxati' },
      { command: 'stats', description: 'Statistika' },
      { command: 'broadcast', description: 'Ommaviy xabar' },
      { command: 'help', description: 'Yordam' },
    ],
  });

  return whRes;
}

// ==================== COMMAND HANDLERS ====================

async function cmdStart(chatId: number, firstName: string) {
  const admin = await isAdminChat(chatId);
  if (admin) {
    const profile = await getUserProfile(admin.user_id);
    await send(chatId,
      `👋 Xush kelibsiz, <b>${profile?.full_name || firstName}</b>!\n\n` +
      `🛡️ <b>SellerCloudX Admin Panel</b>\n\n` +
      `📱 Mini App orqali to'liq boshqarish uchun quyidagi tugmani bosing yoki menyu tugmalaridan foydalaning:`,
      { reply_markup: adminMainMenu() }
    );
  } else {
    await send(chatId,
      `👋 <b>${firstName}</b>, bu SellerCloudX admin botidir.\n\n` +
      `🔗 Admin sifatida ro'yxatdan o'tish:\n` +
      `1. <code>/link email@example.com</code>\n` +
      `2. <code>/admin</code>\n\n` +
      `⚠️ Bu bot faqat adminlar uchun. Hamkorlar <b>sellercloudx.com</b> ilovasi orqali murojaat qiladi.`
    );
  }
}

async function cmdLink(chatId: number, email: string, username: string, firstName: string) {
  if (!email || !email.includes('@')) {
    await send(chatId, '❌ Email noto\'g\'ri.\nNamuna: <code>/link admin@example.com</code>');
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, email')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    await send(chatId, `❌ <b>${email}</b> topilmadi. Avval sellercloudx.com da ro'yxatdan o'ting.`);
    return;
  }

  // Upsert
  const { data: existing } = await supabase
    .from('telegram_chat_links')
    .select('id')
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (existing) {
    await supabase.from('telegram_chat_links')
      .update({ telegram_chat_id: chatId, telegram_username: username, telegram_first_name: firstName })
      .eq('id', existing.id);
  } else {
    await supabase.from('telegram_chat_links')
      .insert({ user_id: profile.user_id, telegram_chat_id: chatId, telegram_username: username, telegram_first_name: firstName });
  }

  // Check if admin
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
      `👤 ${profile.full_name}\n📧 ${profile.email}\n📱 ${profile.phone || 'N/A'}\n\n` +
      `Hamkorlar xabarlari shu chatga keladi.`,
      { reply_markup: adminMainMenu() }
    );
  } else {
    await send(chatId,
      `✅ Akkaunt bog'landi: <b>${profile.full_name}</b>\n\n` +
      `⚠️ Admin huquqi yo'q. Admin paneldan huquq berilishi kerak.\n` +
      `Admin bo'lganingizdan so'ng /admin buyrug'ini bering.`
    );
  }
}

async function cmdAdmin(chatId: number) {
  const { data: link } = await supabase
    .from('telegram_chat_links')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!link) {
    await send(chatId, '❌ Avval <code>/link email</code> bilan akkauntingizni bog\'lang.');
    return;
  }
  if (link.is_admin) {
    await send(chatId, '✅ Siz allaqachon adminsiz!', { reply_markup: adminMainMenu() });
    return;
  }

  const { data: perm } = await supabase
    .from('admin_permissions')
    .select('id')
    .eq('user_id', link.user_id)
    .maybeSingle();

  if (perm) {
    await supabase.from('telegram_chat_links').update({ is_admin: true }).eq('id', link.id);
    await send(chatId, '✅ <b>Admin rejimi yoqildi!</b>', { reply_markup: adminMainMenu() });
  } else {
    await send(chatId, '❌ Admin huquqi topilmadi. Admin paneldan huquq berilishi kerak.');
  }
}

// ==================== CALLBACK HANDLERS ====================

async function handleCallback(cq: any) {
  const chatId = cq.message.chat.id;
  const msgId = cq.message.message_id;
  const data = cq.data;

  const admin = await isAdminChat(chatId);
  await answerCallback(cq.id);

  if (!admin) {
    await send(chatId, '❌ Bu bot faqat adminlar uchun. Avval /link va /admin buyruqlarini bering.');
    return;
  }

  // Main menu
  if (data === 'admin_refresh' || data === 'main_menu') {
    await editMessage(chatId, msgId,
      `🛡️ <b>SellerCloudX Admin Panel</b>\n\nTanlang:`,
      { reply_markup: adminMainMenu() }
    );
    return;
  }

  // Users list
  if (data === 'admin_users') {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, email, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!profiles?.length) {
      await editMessage(chatId, msgId, '👥 Hali foydalanuvchi yo\'q.', { reply_markup: adminMainMenu() });
      return;
    }

    const buttons: any[][] = [];
    let text = `👥 <b>Hamkorlar</b> (${profiles.length} ta)\n\n`;
    
    for (const p of profiles) {
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', p.user_id)
        .eq('direction', 'partner_to_admin')
        .eq('is_read', false);
      
      const badge = (count || 0) > 0 ? ` 🔴${count}` : '';
      const name = p.full_name || p.email || 'Nomsiz';
      buttons.push([{ text: `👤 ${name}${badge}`, callback_data: `usr_${p.user_id}` }]);
    }
    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);

    await editMessage(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  // User detail
  if (data.startsWith('usr_')) {
    const userId = data.replace('usr_', '');
    const profile = await getUserProfile(userId);
    const sub = await getUserSubscription(userId);
    
    const { data: tgLink } = await supabase
      .from('telegram_chat_links')
      .select('telegram_username, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    const { count: connCount } = await supabase
      .from('marketplace_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    const subStatus = sub?.is_active ? '✅ Faol' : '❌ Faol emas';
    const until = sub?.activated_until ? new Date(sub.activated_until).toLocaleDateString('uz-UZ') : 'N/A';

    await editMessage(chatId, msgId,
      `👤 <b>${profile?.full_name || 'Nomsiz'}</b>\n\n` +
      `📧 ${profile?.email || 'N/A'}\n` +
      `📱 ${profile?.phone || 'N/A'}\n` +
      `🆔 @${tgLink?.telegram_username || 'bog\'lanmagan'}\n\n` +
      `━━━ <b>Obuna</b> ━━━\n` +
      `${subStatus} | ${sub?.plan_type || 'N/A'} | $${sub?.monthly_fee || 0}/oy\n` +
      `📅 Muddat: ${until}\n\n` +
      `━━━ <b>Marketplace</b> ━━━\n` +
      `🔌 Faol ulanishlar: ${connCount || 0}`,
      { reply_markup: userDetailKb(userId) }
    );
    return;
  }

  // Send message to user (set reply target)
  if (data.startsWith('msg_')) {
    const userId = data.replace('msg_', '');
    const profile = await getUserProfile(userId);
    
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: userId })
      .eq('telegram_chat_id', chatId);

    await editMessage(chatId, msgId,
      `💬 <b>Xabar yozish</b>\n\nQabul qiluvchi: <b>${profile?.full_name || 'Nomsiz'}</b>\n` +
      `📧 ${profile?.email || ''}\n\n` +
      `Xabaringizni oddiy matn sifatida yozing:`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_reply' }]] } }
    );
    return;
  }

  if (data === 'cancel_reply') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: null })
      .eq('telegram_chat_id', chatId);
    await editMessage(chatId, msgId, '❌ Bekor qilindi.', { reply_markup: adminMainMenu() });
    return;
  }

  // Chat history
  if (data.startsWith('hist_')) {
    const userId = data.replace('hist_', '');
    const profile = await getUserProfile(userId);
    const { data: msgs } = await supabase
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

    let text = `📋 <b>${profile?.full_name || 'Nomsiz'}</b> — Chat tarixi\n\n`;
    if (!msgs?.length) {
      text += '<i>Xabar yo\'q</i>';
    } else {
      for (const m of msgs.reverse()) {
        const t = new Date(m.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const icon = m.direction === 'partner_to_admin' ? '👤' : m.direction === 'broadcast' ? '📢' : m.direction === 'system' ? '⚙️' : '🛡️';
        text += `${icon} [${t}] ${m.message.substring(0, 80)}${m.message.length > 80 ? '...' : ''}\n`;
      }
    }

    await editMessage(chatId, msgId, text, {
      reply_markup: { inline_keyboard: [
        [{ text: '💬 Xabar yozish', callback_data: `msg_${userId}` }],
        [{ text: '◀️ Orqaga', callback_data: `usr_${userId}` }],
      ]}
    });
    return;
  }

  // Activate subscription
  if (data.startsWith('actv_')) {
    const userId = data.replace('actv_', '');
    const { data: sub } = await supabase
      .from('sellercloud_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      await editMessage(chatId, msgId, '❌ Obuna topilmadi.', { reply_markup: { inline_keyboard: [[{ text: '◀️', callback_data: `usr_${userId}` }]] } });
      return;
    }

    await supabase.from('sellercloud_subscriptions')
      .update({ is_active: true, admin_override: true, activated_until: new Date(Date.now() + 30 * 86400000).toISOString() })
      .eq('id', sub.id);

    // Notify in app via support message
    await supabase.from('support_messages').insert({
      user_id: userId, message: '✅ Admin tomonidan 1 oylik obuna aktivlashtirildi', direction: 'system',
    });

    await editMessage(chatId, msgId, '✅ <b>1 oyga aktivlashtirildi!</b>',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: `usr_${userId}` }]] } });
    return;
  }

  // Deactivate
  if (data.startsWith('deac_')) {
    const userId = data.replace('deac_', '');
    await supabase.from('sellercloud_subscriptions')
      .update({ is_active: false, admin_override: false })
      .eq('user_id', userId);

    await supabase.from('support_messages').insert({
      user_id: userId, message: '❌ Admin tomonidan obuna deaktivlashtirildi', direction: 'system',
    });

    await editMessage(chatId, msgId, '❌ <b>Deaktivlashtirildi.</b>',
      { reply_markup: { inline_keyboard: [[{ text: '◀️ Orqaga', callback_data: `usr_${userId}` }]] } });
    return;
  }

  // Stats
  if (data === 'admin_stats') {
    const [users, subs, msgs, unread, conns, today] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('sellercloud_subscriptions').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('support_messages').select('*', { count: 'exact', head: true }),
      supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('direction', 'partner_to_admin').eq('is_read', false),
      supabase.from('marketplace_connections').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    ]);

    await editMessage(chatId, msgId,
      `📊 <b>SellerCloudX Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${users.count || 0}</b>\n` +
      `📱 Bugungi ro'yxat: <b>${today.count || 0}</b>\n\n` +
      `━━━ Obunalar ━━━\n` +
      `✅ Faol: <b>${subs.count || 0}</b>\n\n` +
      `━━━ Xabarlar ━━━\n` +
      `💬 Jami: <b>${msgs.count || 0}</b>\n` +
      `🔴 Javobsiz: <b>${unread.count || 0}</b>\n\n` +
      `━━━ Marketplace ━━━\n` +
      `🔌 Faol ulanishlar: <b>${conns.count || 0}</b>`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🔄 Yangilash', callback_data: 'admin_stats' }],
        [{ text: '◀️ Orqaga', callback_data: 'main_menu' }],
      ]} }
    );
    return;
  }

  // Unread messages
  if (data === 'admin_unread') {
    const { data: unread } = await supabase
      .from('support_messages')
      .select('user_id, message, created_at')
      .eq('direction', 'partner_to_admin')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!unread?.length) {
      await editMessage(chatId, msgId, '✅ Barcha xabarlarga javob berilgan!', { reply_markup: adminMainMenu() });
      return;
    }

    const userMap = new Map<string, any[]>();
    for (const m of unread) {
      if (!userMap.has(m.user_id)) userMap.set(m.user_id, []);
      userMap.get(m.user_id)!.push(m);
    }

    let text = `🔴 <b>Javobsiz xabarlar</b> (${unread.length})\n\n`;
    const buttons: any[][] = [];

    for (const [uid, msgs] of userMap) {
      const p = await getUserProfile(uid);
      text += `👤 <b>${p?.full_name || 'Nomsiz'}</b> — ${msgs.length} xabar\n`;
      text += `   └ ${msgs[0].message.substring(0, 50)}...\n\n`;
      buttons.push([{ text: `💬 ${p?.full_name || 'Nomsiz'} (${msgs.length})`, callback_data: `hist_${uid}` }]);
    }
    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);
    await editMessage(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  // Subscriptions
  if (data === 'admin_subs') {
    const { data: subs } = await supabase
      .from('sellercloud_subscriptions')
      .select('user_id, plan_type, is_active, activated_until, monthly_fee')
      .order('created_at', { ascending: false })
      .limit(15);

    let text = `💰 <b>Obunalar</b>\n\n`;
    const buttons: any[][] = [];

    for (const s of subs || []) {
      const p = await getUserProfile(s.user_id);
      const st = s.is_active ? '✅' : '❌';
      text += `${st} ${p?.full_name || 'Nomsiz'} — ${s.plan_type || 'Standard'}\n`;
      buttons.push([{ text: `${st} ${p?.full_name || 'Nomsiz'}`, callback_data: `usr_${s.user_id}` }]);
    }
    buttons.push([{ text: '◀️ Orqaga', callback_data: 'main_menu' }]);
    await editMessage(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  // Broadcast start
  if (data === 'broadcast_start') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: 'broadcast' })
      .eq('telegram_chat_id', chatId);
    
    await editMessage(chatId, msgId,
      `📢 <b>Ommaviy xabar</b>\n\nBarcha hamkorlarga yuboriladigan xabar matnini yozing:`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_reply' }]] } }
    );
    return;
  }
}

// ==================== TEXT MESSAGE HANDLER ====================

async function handleText(chatId: number, text: string, username: string, firstName: string, replyTo: any) {
  const admin = await isAdminChat(chatId);

  if (!admin) {
    // Not admin — reject politely
    await send(chatId,
      `⚠️ Bu bot faqat adminlar uchun.\n\n` +
      `Hamkor bo'lsangiz, <b>sellercloudx.com</b> ilovasi orqali adminga murojaat qiling.\n\n` +
      `Admin bo'lsangiz:\n1. <code>/link email@example.com</code>\n2. <code>/admin</code>`,
      { reply_markup: { inline_keyboard: [[
        { text: '🌐 sellercloudx.com', url: 'https://sellercloudx.com' },
      ]]} }
    );
    return;
  }

  // Check reply target
  const { data: freshLink } = await supabase
    .from('telegram_chat_links')
    .select('reply_target_user_id, user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  const target = freshLink?.reply_target_user_id;

  // Broadcast mode
  if (target === 'broadcast') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: null })
      .eq('telegram_chat_id', chatId);

    // Get all users (not just telegram-linked ones, save to DB for all)
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(500);

    let sentTg = 0;
    for (const p of allProfiles || []) {
      // Save broadcast message for every user (visible in app)
      await supabase.from('support_messages').insert({
        user_id: p.user_id, message: text, direction: 'broadcast', admin_user_id: admin.user_id,
      });

      // Also send via Telegram if linked
      const { data: tgLink } = await supabase
        .from('telegram_chat_links')
        .select('telegram_chat_id')
        .eq('user_id', p.user_id)
        .eq('is_admin', false)
        .maybeSingle();

      if (tgLink) {
        try {
          await send(tgLink.telegram_chat_id, `📢 <b>SellerCloudX:</b>\n\n${text}`);
          sentTg++;
        } catch (e) { console.error('Broadcast TG error:', e); }
      }
    }

    await send(chatId,
      `✅ Ommaviy xabar yuborildi!\n\n` +
      `📱 Ilovada: <b>${allProfiles?.length || 0}</b> ta hamkor\n` +
      `📲 Telegramda: <b>${sentTg}</b> ta`,
      { reply_markup: adminMainMenu() }
    );
    return;
  }

  // Direct reply to specific user
  if (target && target !== 'null') {
    await supabase.from('telegram_chat_links')
      .update({ reply_target_user_id: null })
      .eq('telegram_chat_id', chatId);

    await supabase.from('support_messages').insert({
      user_id: target, message: text, direction: 'admin_to_partner', admin_user_id: admin.user_id,
    });

    const profile = await getUserProfile(target);
    await send(chatId,
      `✅ Javob yuborildi: <b>${profile?.full_name || 'Nomsiz'}</b>`,
      { reply_markup: adminMainMenu() }
    );
    return;
  }

  // Reply to forwarded message (UID match)
  if (replyTo?.text) {
    const uidMatch = replyTo.text.match(/\[UID:([a-f0-9-]+)\]/);
    if (uidMatch) {
      const userId = uidMatch[1];
      await supabase.from('support_messages').insert({
        user_id: userId, message: text, direction: 'admin_to_partner', admin_user_id: admin.user_id,
      });
      await send(chatId, '✅ Javob yuborildi.');
      return;
    }
  }

  // No target
  await send(chatId, 'ℹ️ Kimga xabar yuborishni tanlang:', { reply_markup: adminMainMenu() });
}

// ==================== MAIN ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('setup') === 'true') {
      const res = await setupWebhookAndMenu();
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    const update = await req.json();

    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return new Response('OK', { headers: corsHeaders });
    }

    const msg = update.message;
    if (!msg?.text) return new Response('OK', { headers: corsHeaders });

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const username = msg.from?.username || '';
    const firstName = msg.from?.first_name || '';

    if (text === '/start' || text === '/menu') {
      await cmdStart(chatId, firstName);
    } else if (text.startsWith('/link ')) {
      await cmdLink(chatId, text.replace('/link ', '').trim().toLowerCase(), username, firstName);
    } else if (text === '/admin') {
      await cmdAdmin(chatId);
    } else if (text === '/users') {
      // Quick users command
      const admin = await isAdminChat(chatId);
      if (!admin) { await send(chatId, '❌ Faqat admin.'); return new Response('OK', { headers: corsHeaders }); }
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      let text2 = `👥 <b>Hamkorlar</b> (${profiles?.length || 0})\n\n`;
      for (const p of profiles || []) {
        const sub = await getUserSubscription(p.user_id);
        const st = sub?.is_active ? '✅' : '❌';
        text2 += `${st} ${p.full_name || p.email || 'Nomsiz'}\n   📧 ${p.email}\n\n`;
      }
      await send(chatId, text2, { reply_markup: adminMainMenu() });
    } else if (text === '/stats') {
      const admin = await isAdminChat(chatId);
      if (!admin) { await send(chatId, '❌ Faqat admin.'); return new Response('OK', { headers: corsHeaders }); }
      // Trigger stats via callback simulation
      await send(chatId, '📊 Statistika yuklanmoqda...', { reply_markup: { inline_keyboard: [[{ text: '📊 Ko\'rish', callback_data: 'admin_stats' }]] } });
    } else if (text.startsWith('/broadcast ')) {
      const admin = await isAdminChat(chatId);
      if (!admin) { await send(chatId, '❌ Faqat admin.'); return new Response('OK', { headers: corsHeaders }); }
      const broadcastText = text.replace('/broadcast ', '').trim();
      if (!broadcastText) { await send(chatId, '❌ Matn kiriting: /broadcast Salom!'); return new Response('OK', { headers: corsHeaders }); }
      
      // Directly broadcast
      const { data: allProfiles } = await supabase.from('profiles').select('user_id').limit(500);
      let cnt = 0;
      for (const p of allProfiles || []) {
        await supabase.from('support_messages').insert({
          user_id: p.user_id, message: broadcastText, direction: 'broadcast', admin_user_id: admin.user_id,
        });
        const { data: tl } = await supabase.from('telegram_chat_links').select('telegram_chat_id').eq('user_id', p.user_id).eq('is_admin', false).maybeSingle();
        if (tl) { try { await send(tl.telegram_chat_id, `📢 <b>SellerCloudX:</b>\n\n${broadcastText}`); cnt++; } catch {} }
      }
      await send(chatId, `✅ ${allProfiles?.length || 0} hamkorga (${cnt} Telegram) yuborildi!`, { reply_markup: adminMainMenu() });
    } else if (text === '/help') {
      await send(chatId,
        `📌 <b>Admin buyruqlar:</b>\n\n` +
        `/start — Bosh sahifa\n` +
        `/menu — Admin menyu\n` +
        `/users — Hamkorlar ro'yxati\n` +
        `/stats — Statistika\n` +
        `/broadcast [xabar] — Ommaviy xabar\n` +
        `/link [email] — Akkaunt bog'lash\n` +
        `/admin — Admin rejimi\n\n` +
        `📱 To'liq boshqaruv uchun <b>Admin Panel</b> tugmasini bosing.`
      );
    } else {
      await handleText(chatId, text, username, firstName, msg.reply_to_message);
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { headers: corsHeaders });
  }
});
