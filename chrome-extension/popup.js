/**
 * SellerCloudX Extension v4.1.1 — Popup Script
 */

const SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8';
const DASHBOARD_URL = 'https://sellercloudx.com/seller-cloud';
const UZUM_SELLER_URL_PATTERNS = ['https://seller.uzum.uz/*', 'https://seller-edu.uzum.uz/*'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function renderExtensionVersion() {
  try {
    const version = chrome.runtime?.getManifest?.()?.version || '4.1.1';
    $('#extension-version').textContent = `v${version}`;
    $('#extension-version-footer').textContent = `SellerCloudX Pro v${version}`;
  } catch {}
}

// ===== Tabs =====
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(`#tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ===== Toggles =====
$$('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    const id = toggle.id.replace('toggle-', '');
    chrome.storage.local.set({ [`setting_${id}`]: toggle.classList.contains('active') });
    if (id === 'overlay' || id === 'profit') {
      notifyContent({ type: 'SCX_SETTING', setting: id, value: toggle.classList.contains('active') });
    }
  });
});

async function loadToggles() {
  const keys = ['setting_overlay', 'setting_profit', 'setting_notifications', 'setting_autoconnect', 'setting_dark-overlay'];
  const r = await chrome.storage.local.get(keys);
  keys.forEach(k => {
    const id = k.replace('setting_', '');
    const t = $(`#toggle-${id}`);
    if (t && r[k] === false) t.classList.remove('active');
  });
}

async function notifyContent(msg) {
  try {
    const tabs = await chrome.tabs.query({ url: UZUM_SELLER_URL_PATTERNS });
    for (const tab of tabs) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  } catch {}
}

// ===== Ensure background service worker is connected =====
async function ensureBackgroundConnection(config) {
  if (!config?.accessToken || !config?.userId) return;
  try {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'SCX_LOGIN', accessToken: config.accessToken, userId: config.userId },
        () => { void chrome.runtime.lastError; resolve(); }
      );
    });
  } catch {}
}

// ===== Init =====
async function init() {
  renderExtensionVersion();
  const config = await chrome.storage.local.get(['accessToken', 'userId', 'userEmail']);
  if (config.accessToken && config.userId) {
    // Always ensure background SW is alive and connected
    await ensureBackgroundConnection(config);
    showDashboard(config);
  } else {
    showLogin();
  }
  loadToggles();
}

function showLogin() {
  $('#login-section').style.display = 'block';
  $('#dashboard-section').style.display = 'none';
}

function showDashboard(config) {
  $('#login-section').style.display = 'none';
  $('#dashboard-section').style.display = 'block';
  $('#user-email').textContent = config.userEmail || '—';
  checkConnection();
  checkSellerTab();
  loadStats(config);
  loadHistory(config);
}

// ===== Login =====
$('#login-btn').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || !password) { showError('Email va parolni kiriting'); return; }

  const btn = $('#login-btn');
  btn.disabled = true; btn.textContent = '⏳ Kirilmoqda...';

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) { showError(data.error_description || data.msg || 'Login xatosi'); return; }

    await chrome.storage.local.set({ accessToken: data.access_token, userId: data.user.id, userEmail: data.user.email });
    chrome.runtime.sendMessage({ type: 'SCX_LOGIN', accessToken: data.access_token, userId: data.user.id });
    showDashboard({ accessToken: data.access_token, userId: data.user.id, userEmail: data.user.email });
  } catch (e) {
    showError('Tarmoq xatosi: ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '🚀 Kirish';
  }
});

function showError(msg) {
  const el = $('#login-error');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

$('#logout-btn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'SCX_LOGOUT' });
  await chrome.storage.local.clear();
  showLogin();
});

// ===== Status =====
function checkConnection() {
  chrome.runtime.sendMessage({ type: 'SCX_STATUS' }, (r) => {
    void chrome.runtime.lastError;
    $('#connection-status').innerHTML = r?.isConnected
      ? '<span class="dot dot-green"></span> Ulangan'
      : '<span class="dot dot-red"></span> Ulanmagan';
  });
}

async function checkSellerTab() {
  const tabs = await chrome.tabs.query({ url: UZUM_SELLER_URL_PATTERNS });
  $('#seller-status').innerHTML = tabs.length > 0
    ? '<span class="dot dot-green"></span> Ochiq'
    : '<span class="dot dot-red"></span> Yopiq';
}

// ===== Stats =====
async function loadStats(config) {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${config.accessToken}` };
  try {
    const [connResp, pendingResp, completedResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.uzum&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&status=eq.pending&select=id`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&status=eq.completed&created_at=gte.${new Date().toISOString().split('T')[0]}T00:00:00&select=id`, { headers }),
    ]);

    const conns = await connResp.json();
    if (Array.isArray(conns) && conns[0]) {
      const c = conns[0];
      $('#stat-products').textContent = c.products_count || '0';
      $('#stat-orders').textContent = c.orders_count || '0';
      const rev = c.total_revenue || 0;
      $('#stat-revenue').textContent = rev >= 1e6 ? `${(rev / 1e6).toFixed(1)}M` : rev >= 1e3 ? `${(rev / 1e3).toFixed(0)}K` : String(rev);
    }

    const pending = await pendingResp.json();
    const pCount = Array.isArray(pending) ? pending.length : 0;
    $('#stat-pending').textContent = pCount;
    const badge = $('#pending-badge');
    if (pCount > 0) { badge.textContent = pCount; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';

    const completed = await completedResp.json();
    $('#stat-completed').textContent = Array.isArray(completed) ? completed.length : '0';
  } catch {}
}

// ===== History =====
async function loadHistory(config) {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${config.accessToken}` };
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&order=created_at.desc&limit=10&select=id,command_type,status,created_at,error_message`, { headers });
    const cmds = await resp.json();
    renderCommands(cmds);
  } catch {}
}

function renderCommands(cmds) {
  const list = $('#commands-list');
  if (!Array.isArray(cmds) || cmds.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📋</div><div class="text">Hali buyruqlar yo\'q</div></div>';
    return;
  }
  const icons = { create_product: '📦', toggle_boost: '🚀', generate_label: '🏷️', batch_labels: '📋', update_price: '💰', update_stock: '📊', heartbeat: '💓' };
  const names = { create_product: 'Kartochka yaratish', toggle_boost: 'Boost', generate_label: 'Etiketka', batch_labels: 'Ommaviy etiketka', update_price: 'Narx yangilash', update_stock: 'Zaxira', heartbeat: 'Heartbeat' };
  const statusText = { pending: 'Kutilmoqda', processing: 'Bajarilmoqda', completed: 'Tayyor', failed: 'Xato' };

  list.innerHTML = cmds.map(c => `
    <div class="command-item">
      <span class="command-icon">${icons[c.command_type] || '📌'}</span>
      <div class="command-info">
        <div class="command-name">${names[c.command_type] || c.command_type}</div>
        <div class="command-time">${new Date(c.created_at).toLocaleString('uz', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}${c.error_message ? ' · ' + c.error_message.substring(0, 30) : ''}</div>
      </div>
      <span class="command-status cmd-${c.status}">${statusText[c.status] || c.status}</span>
    </div>`).join('');
}

// ===== Actions =====
$('#open-seller-btn').addEventListener('click', () => chrome.tabs.create({ url: 'https://seller.uzum.uz/' }));
$('#open-dashboard-btn').addEventListener('click', () => chrome.tabs.create({ url: DASHBOARD_URL }));

$('#refresh-btn').addEventListener('click', async () => {
  $('#refresh-btn').textContent = '⏳ Yangilanmoqda...';
  const config = await chrome.storage.local.get(['accessToken', 'userId', 'userEmail']);
  await ensureBackgroundConnection(config);
  await Promise.all([loadStats(config), loadHistory(config)]);
  checkConnection(); checkSellerTab();
  $('#refresh-btn').innerHTML = '🔄 Ma\'lumotlarni yangilash';
});

$('#action-create-product')?.addEventListener('click', () => chrome.tabs.create({ url: DASHBOARD_URL }));
$('#action-boost')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://seller.uzum.uz/advertising' }));
$('#action-labels')?.addEventListener('click', () => chrome.tabs.create({ url: 'https://seller.uzum.uz/orders' }));
$('#action-price')?.addEventListener('click', () => chrome.tabs.create({ url: DASHBOARD_URL }));
$('#action-stock')?.addEventListener('click', () => chrome.tabs.create({ url: DASHBOARD_URL }));
$('#action-analytics')?.addEventListener('click', async () => {
  await notifyContent({ type: 'SCX_SETTING', setting: 'overlay', value: true });
  const tabs = await chrome.tabs.query({ url: UZUM_SELLER_URL_PATTERNS });
  if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { active: true });
  else chrome.tabs.create({ url: 'https://seller.uzum.uz/' });
});

init();
