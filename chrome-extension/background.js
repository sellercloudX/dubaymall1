/**
 * SellerCloudX Chrome Extension — Background Service Worker
 * 
 * Supabase Realtime orqali SellerCloudX dashboard'dan kelgan
 * buyruqlarni qabul qiladi va content script'ga uzatadi.
 */

const SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8';

let realtimeChannel = null;
let userId = null;
let ws = null;
let reconnectTimer = null;
const HEARTBEAT_INTERVAL = 25000;

// ===== Storage Helpers =====
async function getConfig() {
  const result = await chrome.storage.local.get(['userId', 'accessToken', 'isConnected']);
  return result;
}

async function setConfig(data) {
  await chrome.storage.local.set(data);
}

// ===== Supabase Realtime via WebSocket =====
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
    
    // Join channel for user's extension commands
    const joinMsg = JSON.stringify({
      topic: `realtime:public:uzum_extension_commands:user_id=eq.${userId}`,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          postgres_changes: [{
            event: 'INSERT',
            schema: 'public',
            table: 'uzum_extension_commands',
            filter: `user_id=eq.${userId}`,
          }],
        },
        access_token: accessToken,
      },
      ref: '1',
    });
    ws.send(joinMsg);
    
    setConfig({ isConnected: true });
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

    // Heartbeat to keep connection alive
    if (reconnectTimer) clearInterval(reconnectTimer);
    reconnectTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: Date.now().toString(),
        }));
      }
    }, HEARTBEAT_INTERVAL);
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      
      // Handle postgres_changes event
      if (msg.event === 'postgres_changes') {
        const payload = msg.payload;
        if (payload?.data?.record) {
          const command = payload.data.record;
          console.log('[SCX] New command:', command.command_type);
          await handleCommand(command);
        }
      }
      
      // Handle INSERT event directly
      if (msg.event === 'INSERT' && msg.payload?.record) {
        const command = msg.payload.record;
        console.log('[SCX] New command (INSERT):', command.command_type);
        await handleCommand(command);
      }
    } catch (e) {
      // Heartbeat responses, etc.
    }
  };

  ws.onclose = () => {
    console.log('[SCX] WebSocket disconnected, reconnecting in 5s...');
    setConfig({ isConnected: false });
    chrome.action.setBadgeText({ text: '✕' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    
    if (reconnectTimer) clearInterval(reconnectTimer);
    setTimeout(() => connectRealtime(accessToken, uid), 5000);
  };

  ws.onerror = (err) => {
    console.error('[SCX] WebSocket error:', err);
  };
}

// ===== Command Handler =====
async function handleCommand(command) {
  const { id, command_type, payload, status } = command;
  
  if (status !== 'pending') return;
  
  // Update status to 'processing'
  await updateCommandStatus(id, 'processing');
  
  try {
    // Send command to content script on seller.uzum.uz
    const tabs = await chrome.tabs.query({ url: 'https://seller.uzum.uz/*' });
    
    if (tabs.length === 0) {
      // Open seller panel if not open
      const tab = await chrome.tabs.create({ url: 'https://seller.uzum.uz/' });
      // Wait for tab to load
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      tabs.push(tab);
    }
    
    // Send to content script
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SCX_COMMAND',
      command_type,
      payload,
      commandId: id,
    });
    
    if (response?.success) {
      await updateCommandStatus(id, 'completed', response.result);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
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
  const messages = {
    create_product: 'Mahsulot kartochkasi yaratildi ✅',
    toggle_boost: 'Boost holati o\'zgartirildi ⚡',
    generate_label: 'Etiketka yaratildi 🏷️',
    batch_labels: 'Barcha etiketkalar yaratildi 📦',
    update_price: 'Narx yangilandi 💰',
    update_stock: 'Zaxira yangilandi 📊',
  };
  return messages[type] || 'Buyruq bajarildi ✅';
}

// ===== Supabase REST API =====
async function updateCommandStatus(id, status, result = null, error = null) {
  const { accessToken } = await getConfig();
  if (!accessToken) return;
  
  const body = { 
    status,
    processed_at: new Date().toISOString(),
  };
  if (result) body.result = result;
  if (error) body.error_message = error;
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('[SCX] Status update error:', e);
  }
}

// Fetch pending commands on startup
async function fetchPendingCommands() {
  const { accessToken } = await getConfig();
  if (!accessToken || !userId) return;
  
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${userId}&status=eq.pending&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    const commands = await resp.json();
    if (Array.isArray(commands)) {
      for (const cmd of commands) {
        await handleCommand(cmd);
      }
    }
  } catch (e) {
    console.error('[SCX] Fetch pending error:', e);
  }
}

// ===== Message Listeners =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_LOGIN') {
    const { accessToken, userId: uid } = msg;
    setConfig({ accessToken, userId: uid, isConnected: false });
    connectRealtime(accessToken, uid);
    fetchPendingCommands();
    sendResponse({ success: true });
    return true;
  }
  
  if (msg.type === 'SCX_LOGOUT') {
    if (ws) ws.close();
    setConfig({ accessToken: null, userId: null, isConnected: false });
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

// Auto-connect on startup
chrome.runtime.onStartup?.addListener(async () => {
  const config = await getConfig();
  if (config.accessToken && config.userId) {
    connectRealtime(config.accessToken, config.userId);
    setTimeout(fetchPendingCommands, 3000);
  }
});

// Also try connecting when installed/updated
chrome.runtime.onInstalled?.addListener(async () => {
  const config = await getConfig();
  if (config.accessToken && config.userId) {
    connectRealtime(config.accessToken, config.userId);
  }
});
