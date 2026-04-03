/**
 * SellerCloudX Shared Utilities v4.0
 * Barcha content scriptlar uchun umumiy funksiyalar
 */

const SCX_CONFIG = {
  SUPABASE_URL: 'https://idcshubgqrzdvkttnslz.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8',
  VERSION: '4.0.0',
};

// ===== Utilities =====
const scxSleep = (ms) => new Promise(r => setTimeout(r, ms));

function scxFormatNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

function scxFormatPrice(n, currency = "so'm") {
  if (n == null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' ' + currency;
}

function scxFillInput(input, value) {
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function scxClickEl(el) {
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.click();
  return true;
}

// ===== Toast =====
function scxShowToast(message, type = 'info') {
  document.querySelectorAll('.scx-toast').forEach(t => t.remove());
  const colors = { success: '#059669', info: '#7c3aed', error: '#dc2626', warning: '#d97706' };
  const toast = document.createElement('div');
  toast.className = 'scx-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 999999;
    background: ${colors[type] || colors.info}; color: white;
    padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 3000);
  setTimeout(() => toast.remove(), 3300);
}

// ===== Supabase REST API Helper =====
async function scxFetch(path, options = {}) {
  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) return null;
  try {
    const resp = await fetch(`${SCX_CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        'apikey': SCX_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return text ? JSON.parse(text) : true;
  } catch { return null; }
}

// ===== Save scraped data to Supabase =====
async function scxSaveScrapedData(marketplace, dataType, data, sourceUrl) {
  const config = await chrome.storage.local.get(['userId']);
  if (!config.userId) return;
  
  return scxFetch('marketplace_scraped_data', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: {
      user_id: config.userId,
      marketplace,
      data_type: dataType,
      scraped_data: data,
      source_url: sourceUrl || window.location.href,
    },
  });
}

// ===== Toolbar creator (universal) =====
function scxCreateToolbar(siteName, siteEmoji) {
  if (document.getElementById('scx-toolbar')) return;

  const toolbar = document.createElement('div');
  toolbar.id = 'scx-toolbar';
  toolbar.innerHTML = `
    <div class="scx-toolbar-inner">
      <div class="scx-toolbar-brand" title="SellerCloudX Pro v4.0 — ${siteName}">
        <span class="scx-logo">${siteEmoji}</span>
        <span class="scx-brand-text">SCX</span>
        <span class="scx-status-dot" id="scx-conn-dot"></span>
      </div>
      <div class="scx-toolbar-actions">
        <button class="scx-tb-btn" id="scx-btn-scrape" title="Ma'lumotlarni yig'ish">🔍</button>
        <button class="scx-tb-btn" id="scx-btn-panel" title="Analitika paneli">📊</button>
        <button class="scx-tb-btn" id="scx-btn-dashboard" title="Dashboard ochish">🌐</button>
        <button class="scx-tb-btn scx-tb-close" id="scx-btn-minimize" title="Yashirish">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(toolbar);

  document.getElementById('scx-btn-dashboard')?.addEventListener('click', () => {
    window.open('https://sellercloudx.com/seller-cloud', '_blank');
  });
  document.getElementById('scx-btn-minimize')?.addEventListener('click', () => {
    toolbar.classList.toggle('scx-minimized');
  });

  // Connection check
  chrome.runtime.sendMessage({ type: 'SCX_STATUS' }, (r) => {
    const dot = document.getElementById('scx-conn-dot');
    if (dot) {
      dot.style.background = r?.isConnected ? '#22c55e' : '#ef4444';
      dot.style.boxShadow = r?.isConnected ? '0 0 6px #22c55e88' : '0 0 6px #ef444488';
    }
  });

  return toolbar;
}

// ===== DOM Scraping Helpers =====
function scxGetTextBySelector(selector) {
  const el = document.querySelector(selector);
  return el ? el.textContent.trim() : null;
}

function scxGetAllBySelector(selector) {
  return [...document.querySelectorAll(selector)];
}

function scxParseNumber(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.,\-]/g, '').replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function scxParseTableRows(tableSelector, headerMap) {
  const rows = [];
  const table = document.querySelector(tableSelector);
  if (!table) return rows;
  
  const headers = [...table.querySelectorAll('thead th, thead td')].map(h => h.textContent.trim());
  const bodyRows = table.querySelectorAll('tbody tr');
  
  for (const tr of bodyRows) {
    const cells = [...tr.querySelectorAll('td')];
    const row = {};
    headers.forEach((h, i) => {
      const key = headerMap?.[h] || h;
      row[key] = cells[i]?.textContent?.trim() || '';
    });
    rows.push(row);
  }
  return rows;
}

// ===== SPA Navigation Observer =====
function scxObserveNavigation(callback) {
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(callback, 1500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

console.log(`[SCX v${SCX_CONFIG.VERSION}] Shared utilities loaded`);
