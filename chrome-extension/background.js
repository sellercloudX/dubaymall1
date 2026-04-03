/**
 * SellerCloudX Chrome Extension — Background Service Worker v3.0
 * chrome.alarms bilan barqaror ulanish
 */

const SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8';

let ws = null;
let userId = null;
let websocketHeartbeatTimer = null;

// ===== Storage =====
const getConfig = () => chrome.storage.local.get(['userId', 'accessToken', 'isConnected', 'tokenExpiry']);
const setConfig = (data) => chrome.storage.local.set(data);

// ===== Token helpers =====
function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp || 0) * 1000;
  } catch { return 0; }
}

async function refreshToken() {
  const { accessToken } = await getConfig();
  if (!accessToken) return null;
  try {
    // Supabase doesn't have a standalone refresh in anon mode without refresh_token
    // We just check if token is still valid
    const exp = decodeJwtExp(accessToken);
    if (exp > Date.now() + 60000) return accessToken; // still valid
    console.log('[SCX] Token expired, user needs to re-login');
    setConfig({ isConnected: false });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#eab308' });
    return null;
  } catch { return null; }
}

// ===== WebSocket Realtime =====
function connectRealtime(accessToken, uid) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[SCX] WebSocket already connected');
    return;
  }

  userId = uid;
  const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_ANON_KEY + '&vsn=1.0.0';
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[SCX] WebSocket connected');
    ws.send(JSON.stringify({
      topic: `realtime:public:uzum_extension_commands:user_id=eq.${userId}`,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          postgres_changes: [{
            event: 'INSERT', schema: 'public',
            table: 'uzum_extension_commands',
            filter: `user_id=eq.${userId}`,
          }],
        },
        access_token: accessToken,
      },
      ref: '1',
    }));

    setConfig({ isConnected: true, tokenExpiry: decodeJwtExp(accessToken) });
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

    // WebSocket-level heartbeat
    if (websocketHeartbeatTimer) clearInterval(websocketHeartbeatTimer);
    websocketHeartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(Date.now()) }));
      }
    }, 25000);
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'postgres_changes' && msg.payload?.data?.record) {
        await handleCommand(msg.payload.data.record);
      }
      if (msg.event === 'INSERT' && msg.payload?.record) {
        await handleCommand(msg.payload.record);
      }
    } catch {}
  };

  ws.onclose = () => {
    console.log('[SCX] WebSocket disconnected');
    setConfig({ isConnected: false });
    chrome.action.setBadgeText({ text: '✕' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    if (websocketHeartbeatTimer) clearInterval(websocketHeartbeatTimer);
    // Reconnect via alarm
  };

  ws.onerror = (err) => console.error('[SCX] WebSocket error:', err);
}

// ===== chrome.alarms — keeps SW alive =====
chrome.alarms.create('scx-keepalive', { periodInMinutes: 1 });
chrome.alarms.create('scx-heartbeat', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'scx-keepalive') {
    // Ensure WebSocket is connected
    const config = await getConfig();
    if (config.accessToken && config.userId) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const validToken = await refreshToken();
        if (validToken) connectRealtime(validToken, config.userId);
      }
    }
  }

  if (alarm.name === 'scx-heartbeat') {
    const config = await getConfig();
    if (config.accessToken && config.userId) {
      await sendHeartbeat(config.accessToken, config.userId);
    }
  }
});

// ===== Command Handler =====
async function handleCommand(command) {
  const { id, command_type, payload, status } = command;
  if (status !== 'pending') return;

  console.log('[SCX] Processing command:', id, command_type);
  await updateCommandStatus(id, 'processing');

  try {
    const tabs = await chrome.tabs.query({ url: 'https://seller.uzum.uz/*' });
    if (tabs.length === 0) {
      console.log('[SCX] No Uzum seller tab open, creating one...');
      const tab = await chrome.tabs.create({ url: 'https://seller.uzum.uz/products' });
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      // Wait extra for content script to load
      await new Promise(r => setTimeout(r, 3000));
      tabs.push(tab);
    }

    console.log('[SCX] Sending command to tab:', tabs[0].id);
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SCX_COMMAND', command_type, payload, commandId: id,
    });

    console.log('[SCX] Content script response:', JSON.stringify(response));

    if (response?.success) {
      // Pass the full result object so dashboard can check saved/submitted flags
      await updateCommandStatus(id, 'completed', response.result || { saved: false, message: 'No result details' });
      chrome.notifications.create({
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: 'SellerCloudX',
        message: getSuccessMessage(command_type),
      });
    } else {
      await updateCommandStatus(id, 'failed', null, response?.error || 'Content script error');
    }
  } catch (err) {
    console.error('[SCX] Command error:', err);
    await updateCommandStatus(id, 'failed', null, err.message);
  }
}

function getSuccessMessage(type) {
  const m = {
    create_product: 'Mahsulot kartochkasi yaratildi ✅',
    toggle_boost: 'Boost holati o\'zgartirildi ⚡',
    generate_label: 'Etiketka yaratildi 🏷️',
    batch_labels: 'Barcha etiketkalar yaratildi 📦',
    update_price: 'Narx yangilandi 💰',
    update_stock: 'Zaxira yangilandi 📊',
  };
  return m[type] || 'Buyruq bajarildi ✅';
}

// ===== REST API helpers =====
async function updateCommandStatus(id, status, result = null, error = null) {
  const { accessToken } = await getConfig();
  if (!accessToken) return;
  const body = { status, processed_at: new Date().toISOString() };
  if (status === 'completed') body.completed_at = new Date().toISOString();
  if (result !== null && result !== undefined) body.result = typeof result === 'object' ? result : { value: result };
  if (error) body.error_message = String(error);
  console.log('[SCX] Updating command', id, 'to', status, 'result:', JSON.stringify(result));
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) console.error('[SCX] Status update HTTP error:', resp.status, await resp.text());
    else console.log('[SCX] Command status updated successfully');
  } catch (e) { console.error('[SCX] Status update error:', e); }
}

async function sendHeartbeat(accessToken, uid) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: uid, command_type: 'heartbeat', status: 'completed',
        payload: { source: 'extension', version: '3.0' },
        processed_at: new Date().toISOString(),
      }),
    });
    console.log('[SCX] Heartbeat sent');
  } catch (e) { console.error('[SCX] Heartbeat error:', e); }
}

async function fetchPendingCommands() {
  const { accessToken } = await getConfig();
  if (!accessToken || !userId) return;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${userId}&status=eq.pending&order=created_at.asc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } }
    );
    const commands = await resp.json();
    if (Array.isArray(commands)) {
      for (const cmd of commands) await handleCommand(cmd);
    }
  } catch (e) { console.error('[SCX] Fetch pending error:', e); }
}

// ===== Message Listeners =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_LOGIN') {
    const { accessToken, userId: uid } = msg;
    setConfig({ accessToken, userId: uid, isConnected: false, tokenExpiry: decodeJwtExp(accessToken) });
    connectRealtime(accessToken, uid);
    fetchPendingCommands();
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === 'SCX_LOGOUT') {
    if (ws) ws.close();
    setConfig({ accessToken: null, userId: null, isConnected: false, tokenExpiry: 0 });
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === 'SCX_STATUS') {
    getConfig().then(config => {
      sendResponse({
        isConnected: config.isConnected || false,
        userId: config.userId || null,
        wsState: ws ? ws.readyState : -1,
      });
    });
    return true;
  }
  if (msg.type === 'SCX_PING') {
    sendResponse({ pong: true, timestamp: Date.now() });
    return true;
  }
});

// ===== Auto-connect =====
chrome.runtime.onStartup?.addListener(async () => {
  const config = await getConfig();
  if (config.accessToken && config.userId) {
    connectRealtime(config.accessToken, config.userId);
    setTimeout(fetchPendingCommands, 3000);
  }
});

chrome.runtime.onInstalled?.addListener(async () => {
  const config = await getConfig();
  if (config.accessToken && config.userId) {
    connectRealtime(config.accessToken, config.userId);
  }
});
