/**
 * SellerCloudX Extension — Popup Script
 */

const SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8';

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const openSellerBtn = document.getElementById('open-seller-btn');
const loginError = document.getElementById('login-error');

// ===== Init =====
async function init() {
  const config = await chrome.storage.local.get(['accessToken', 'userId', 'userEmail']);
  
  if (config.accessToken && config.userId) {
    showDashboard(config);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginSection.style.display = 'block';
  dashboardSection.style.display = 'none';
}

function showDashboard(config) {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  
  document.getElementById('user-email').textContent = config.userEmail || '—';
  
  checkConnectionStatus();
  checkSellerTab();
  loadCommandStats(config);
}

// ===== Login =====
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showError('Email va parolni kiriting');
    return;
  }
  
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ Kirilmoqda...';
  
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await resp.json();
    
    if (!resp.ok) {
      showError(data.error_description || data.msg || 'Login xatosi');
      return;
    }
    
    const { access_token, user } = data;
    
    await chrome.storage.local.set({
      accessToken: access_token,
      userId: user.id,
      userEmail: user.email,
    });
    
    // Notify background to connect WebSocket
    chrome.runtime.sendMessage({
      type: 'SCX_LOGIN',
      accessToken: access_token,
      userId: user.id,
    });
    
    showDashboard({ accessToken: access_token, userId: user.id, userEmail: user.email });
  } catch (e) {
    showError('Tarmoq xatosi: ' + e.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '🚀 Kirish';
  }
});

function showError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
  setTimeout(() => { loginError.style.display = 'none'; }, 5000);
}

// ===== Logout =====
logoutBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'SCX_LOGOUT' });
  await chrome.storage.local.clear();
  showLogin();
});

// ===== Connection Status =====
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'SCX_STATUS' }, (response) => {
    const statusEl = document.getElementById('connection-status');
    if (response?.isConnected) {
      statusEl.innerHTML = '<span class="status-dot dot-green"></span>Ulangan';
    } else {
      statusEl.innerHTML = '<span class="status-dot dot-red"></span>Ulanmagan';
    }
  });
}

// ===== Seller Tab Check =====
async function checkSellerTab() {
  const tabs = await chrome.tabs.query({ url: 'https://seller.uzum.uz/*' });
  const sellerStatus = document.getElementById('seller-status');
  if (tabs.length > 0) {
    sellerStatus.innerHTML = '<span class="status-dot dot-green"></span>Ochiq';
  } else {
    sellerStatus.innerHTML = '<span class="status-dot dot-red"></span>Yopiq';
  }
}

// ===== Command Stats =====
async function loadCommandStats(config) {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${config.accessToken}`,
    };
    
    // Pending count
    const pendingResp = await fetch(
      `${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&status=eq.pending&select=id`,
      { headers }
    );
    const pending = await pendingResp.json();
    document.getElementById('stat-pending').textContent = Array.isArray(pending) ? pending.length : '0';
    
    // Completed today
    const today = new Date().toISOString().split('T')[0];
    const completedResp = await fetch(
      `${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&status=eq.completed&created_at=gte.${today}T00:00:00&select=id`,
      { headers }
    );
    const completed = await completedResp.json();
    document.getElementById('stat-completed').textContent = Array.isArray(completed) ? completed.length : '0';
    
    // Recent commands
    const recentResp = await fetch(
      `${SUPABASE_URL}/rest/v1/uzum_extension_commands?user_id=eq.${config.userId}&order=created_at.desc&limit=5&select=id,command_type,status,created_at`,
      { headers }
    );
    const recent = await recentResp.json();
    renderCommands(recent);
  } catch (e) {
    console.error('[SCX] Stats error:', e);
  }
}

function renderCommands(commands) {
  const list = document.getElementById('commands-list');
  
  if (!Array.isArray(commands) || commands.length === 0) {
    list.innerHTML = '<div class="command-item" style="justify-content: center; color: #64748b;">Hali buyruqlar yo\'q</div>';
    return;
  }
  
  const icons = {
    create_product: '📦',
    toggle_boost: '⚡',
    generate_label: '🏷️',
    batch_labels: '📋',
    update_price: '💰',
    update_stock: '📊',
  };
  
  const statusColors = {
    pending: '#eab308',
    processing: '#3b82f6',
    completed: '#22c55e',
    failed: '#ef4444',
  };
  
  list.innerHTML = commands.map(cmd => {
    const icon = icons[cmd.command_type] || '📌';
    const time = new Date(cmd.created_at).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
    const statusColor = statusColors[cmd.status] || '#94a3b8';
    
    return `
      <div class="command-item">
        <span class="command-icon">${icon}</span>
        <span>${cmd.command_type.replace(/_/g, ' ')}</span>
        <span class="command-status" style="color: ${statusColor}">${cmd.status} · ${time}</span>
      </div>
    `;
  }).join('');
}

// ===== Actions =====
openSellerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://seller.uzum.uz/' });
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.textContent = '⏳ Yangilanmoqda...';
  const config = await chrome.storage.local.get(['accessToken', 'userId', 'userEmail']);
  await loadCommandStats(config);
  checkConnectionStatus();
  checkSellerTab();
  refreshBtn.innerHTML = '🔄 Ma\'lumotlarni yangilash';
});

// Init on popup open
init();
