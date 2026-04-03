/**
 * SellerCloudX Content Script v2.0 — Uzum Seller Panel Enhancement
 *
 * Raqobatchilar (Helium 10, MPStats, SellerBoard) darajasida:
 * 1. Floating Toolbar — tez harakatlar, ulanish holati
 * 2. Inline Analytics Overlay — mahsulot ro'yxatida foyda, sotuvlar
 * 3. Real-time Profit Calculator — sahifa ichida ROI, marja
 * 4. Analytics Side Panel — umumiy statistika paneli
 * 5. Automated Form Filling — dashboard buyruqlari
 * 6. SPA Navigation Tracking — sahifa o'zgarganda qayta yuklash
 */

console.log('[SCX v2.0] Content script loaded on', window.location.href);

// ===== Config =====
const SCX = {
  overlayEnabled: true,
  profitEnabled: true,
  darkOverlay: false,
  SUPABASE_URL: 'https://idcshubgqrzdvkttnslz.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkY3NodWJncXJ6ZHZrdHRuc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzE4NjksImV4cCI6MjA4NTcwNzg2OX0.7am0dzPKSQXLXhOwNHRZbHqxi8pRQLkwO-XQDt-_DI8',
};

// Load saved settings
chrome.storage.local.get(['setting_overlay', 'setting_profit', 'setting_dark-overlay'], (r) => {
  if (r.setting_overlay === false) SCX.overlayEnabled = false;
  if (r.setting_profit === false) SCX.profitEnabled = false;
  if (r['setting_dark-overlay'] === true) SCX.darkOverlay = true;
});

// ===== Utilities =====
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function formatNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

function formatPrice(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

function fillInput(input, value) {
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function clickEl(el) {
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.click();
  return true;
}

// ===== Toast =====
function showToast(message, type = 'info') {
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

// ===== API Helper =====
async function fetchSCX(path) {
  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) return null;
  try {
    const resp = await fetch(`${SCX.SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': SCX.ANON_KEY,
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

// ===== 1. Floating Toolbar =====
function createToolbar() {
  if (document.getElementById('scx-toolbar')) return;

  const toolbar = document.createElement('div');
  toolbar.id = 'scx-toolbar';
  toolbar.innerHTML = `
    <div class="scx-toolbar-inner">
      <div class="scx-toolbar-brand" title="SellerCloudX Pro v2.0">
        <span class="scx-logo">⚡</span>
        <span class="scx-brand-text">SCX</span>
        <span class="scx-status-dot" id="scx-conn-dot"></span>
      </div>
      <div class="scx-toolbar-actions">
        <button class="scx-tb-btn" id="scx-btn-panel" title="Analitika paneli">📊</button>
        <button class="scx-tb-btn" id="scx-btn-profit" title="Foyda kalkulyator">💰</button>
        <button class="scx-tb-btn" id="scx-btn-dashboard" title="Dashboard ochish">🌐</button>
        <button class="scx-tb-btn" id="scx-btn-refresh" title="Yangilash">🔄</button>
        <button class="scx-tb-btn scx-tb-close" id="scx-btn-minimize" title="Yashirish">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(toolbar);

  document.getElementById('scx-btn-panel').addEventListener('click', toggleAnalyticsPanel);
  document.getElementById('scx-btn-profit').addEventListener('click', toggleProfitCalculator);
  document.getElementById('scx-btn-dashboard').addEventListener('click', () => {
    window.open('https://sellercloudx.lovable.app/seller-cloud-x', '_blank');
  });
  document.getElementById('scx-btn-refresh').addEventListener('click', () => {
    injectProductOverlays();
    showToast('🔄 Ma\'lumotlar yangilandi', 'success');
  });
  document.getElementById('scx-btn-minimize').addEventListener('click', () => {
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
}

// ===== 2. Analytics Side Panel =====
let panelVisible = false;

async function toggleAnalyticsPanel() {
  if (panelVisible) {
    document.getElementById('scx-analytics-panel')?.remove();
    panelVisible = false;
    return;
  }

  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    showToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }

  // Fetch real data
  const [connData, products, orders] = await Promise.all([
    fetchSCX(`marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.uzum&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`),
    fetchSCX(`marketplace_products_cache?user_id=eq.${config.userId}&marketplace=eq.uzum&select=offer_id,data&order=synced_at.desc&limit=10`),
    fetchSCX(`marketplace_orders_cache?user_id=eq.${config.userId}&marketplace=eq.uzum&select=order_id,data,status&order=synced_at.desc&limit=5`),
  ]);

  const conn = Array.isArray(connData) ? connData[0] : null;
  const totalProducts = conn?.products_count || 0;
  const totalOrders = conn?.orders_count || 0;
  const totalRevenue = conn?.total_revenue || 0;

  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>📊 SellerCloudX Analitika</span>
      <button id="scx-panel-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div class="scx-panel-body">
      <div class="scx-metric-grid">
        <div class="scx-metric-card">
          <div class="scx-metric-value purple">${formatNum(totalProducts)}</div>
          <div class="scx-metric-label">Mahsulotlar</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value green">${formatNum(totalOrders)}</div>
          <div class="scx-metric-label">Buyurtmalar</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value blue">${formatNum(totalRevenue)}</div>
          <div class="scx-metric-label">Daromad (so'm)</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value orange">${totalRevenue > 0 && totalOrders > 0 ? formatNum(totalRevenue / totalOrders) : '—'}</div>
          <div class="scx-metric-label">O'rtacha chek</div>
        </div>
      </div>

      <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin:12px 0 6px;font-weight:700;">Top mahsulotlar</div>
      ${Array.isArray(products) && products.length > 0
        ? products.slice(0, 5).map(p => {
          const d = p.data || {};
          const name = d.title || d.name || d.productName || p.offer_id;
          const price = d.price || d.currentPrice || 0;
          const stock = d.stock ?? d.fbs_stock ?? d.quantity ?? '—';
          const img = d.image || d.photoUrl || d.images?.[0] || '';
          return `
            <div class="scx-product-item">
              ${img ? `<img class="scx-product-img" src="${img}" alt="" />` : '<div class="scx-product-img"></div>'}
              <div class="scx-product-info">
                <div class="scx-product-name" title="${name}">${name.substring(0, 35)}</div>
                <div class="scx-product-sku">${p.offer_id}</div>
              </div>
              <div class="scx-product-stats">
                <div class="scx-product-price">${formatNum(price)}</div>
                <div class="scx-product-stock">Zaxira: ${stock}</div>
              </div>
            </div>`;
        }).join('')
        : '<div style="text-align:center;color:#475569;padding:16px;font-size:11px;">Ma\'lumot topilmadi</div>'
      }

      <div style="margin-top:12px;">
        <button id="scx-panel-dashboard" style="
          width:100%;padding:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
        ">📊 To'liq Dashboard ochish</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  panelVisible = true;

  document.getElementById('scx-panel-close').addEventListener('click', toggleAnalyticsPanel);
  document.getElementById('scx-panel-dashboard').addEventListener('click', () => {
    window.open('https://sellercloudx.lovable.app/seller-cloud-x', '_blank');
  });
}

// ===== 3. Profit Calculator =====
let profitCalcVisible = false;

function toggleProfitCalculator() {
  if (profitCalcVisible) {
    document.getElementById('scx-profit-calc')?.remove();
    profitCalcVisible = false;
    return;
  }

  const calc = document.createElement('div');
  calc.id = 'scx-profit-calc';
  calc.innerHTML = `
    <div class="scx-calc-header">
      <span>💰 Foyda Kalkulyator</span>
      <button id="scx-calc-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div class="scx-calc-body">
      <div class="scx-calc-row">
        <label>Sotish narxi (so'm)</label>
        <input type="number" id="scx-calc-price" placeholder="0" />
      </div>
      <div class="scx-calc-row">
        <label>Tannarx (so'm)</label>
        <input type="number" id="scx-calc-cost" placeholder="0" />
      </div>
      <div class="scx-calc-row">
        <label>Komissiya (%)</label>
        <input type="number" id="scx-calc-commission" value="12" />
      </div>
      <div class="scx-calc-row">
        <label>Logistika (so'm)</label>
        <input type="number" id="scx-calc-logistics" value="8000" />
      </div>
      <div class="scx-calc-result">
        <div class="scx-result-row">
          <span>Sof foyda:</span>
          <span id="scx-res-profit" class="scx-result-value">—</span>
        </div>
        <div class="scx-result-row">
          <span>Marja:</span>
          <span id="scx-res-margin" class="scx-result-value">—</span>
        </div>
        <div class="scx-result-row">
          <span>ROI:</span>
          <span id="scx-res-roi" class="scx-result-value">—</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(calc);
  profitCalcVisible = true;

  const calculate = () => {
    const price = parseFloat(document.getElementById('scx-calc-price').value) || 0;
    const cost = parseFloat(document.getElementById('scx-calc-cost').value) || 0;
    const commPct = parseFloat(document.getElementById('scx-calc-commission').value) || 0;
    const logistics = parseFloat(document.getElementById('scx-calc-logistics').value) || 0;

    const comm = price * (commPct / 100);
    const profit = price - cost - comm - logistics;
    const margin = price > 0 ? (profit / price * 100) : 0;
    const roi = cost > 0 ? (profit / cost * 100) : 0;

    const pEl = document.getElementById('scx-res-profit');
    const mEl = document.getElementById('scx-res-margin');
    const rEl = document.getElementById('scx-res-roi');

    pEl.textContent = formatPrice(profit);
    pEl.style.color = profit >= 0 ? '#4ade80' : '#f87171';
    mEl.textContent = margin.toFixed(1) + '%';
    mEl.style.color = margin >= 20 ? '#4ade80' : margin >= 10 ? '#fbbf24' : '#f87171';
    rEl.textContent = roi.toFixed(0) + '%';
    rEl.style.color = roi >= 30 ? '#4ade80' : roi >= 15 ? '#fbbf24' : '#f87171';
  };

  calc.querySelectorAll('input').forEach(i => i.addEventListener('input', calculate));
  document.getElementById('scx-calc-close').addEventListener('click', toggleProfitCalculator);

  // Auto-fill price from page
  const priceEl = document.querySelector('[class*="price"] [class*="value"], [class*="Price"], [data-testid*="price"]');
  if (priceEl) {
    const val = priceEl.textContent?.replace(/[^\d]/g, '');
    if (val && parseInt(val) > 100) {
      document.getElementById('scx-calc-price').value = val;
      calculate();
    }
  }
}

// ===== 4. Inline Product Overlays =====
let overlaysInjected = false;

async function injectProductOverlays() {
  if (!SCX.overlayEnabled) return;

  const url = window.location.href;
  if (url.includes('/goods') || url.includes('/products')) {
    await enhanceProductList();
  }
  if (url.includes('/orders') || url.includes('/fbs')) {
    await enhanceOrders();
  }
}

async function enhanceProductList() {
  await sleep(1500);

  // Get cost prices from SCX
  const config = await chrome.storage.local.get(['userId']);
  let costPrices = {};
  if (config.userId) {
    const data = await fetchSCX(`marketplace_cost_prices?user_id=eq.${config.userId}&marketplace=eq.uzum&select=offer_id,cost_price`);
    if (Array.isArray(data)) {
      data.forEach(d => { costPrices[d.offer_id] = d.cost_price; });
    }
  }

  // Find product rows/cards in Uzum seller panel
  const rows = document.querySelectorAll('tr, [class*="product-card"], [class*="goods-item"], [class*="ProductCard"], [class*="product-row"]');
  if (rows.length === 0) return;

  let injected = 0;
  rows.forEach(row => {
    if (row.querySelector('.scx-badge')) return;

    // Extract price
    const priceEl = row.querySelector('[class*="price"], [class*="Price"], td:nth-child(3), td:nth-child(4)');
    const priceText = priceEl?.textContent?.replace(/[^\d]/g, '');
    const price = priceText ? parseInt(priceText) : null;

    if (price && price > 100) {
      const commission = price * 0.12;
      const logistics = 8000;
      const profit = price - commission - logistics;

      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.innerHTML = `<span>📊</span> <span title="Taxminiy foyda (12% komissiya + 8K logistika)">≈${formatNum(profit)} foyda</span>`;
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        // Open profit calc with this price
        if (profitCalcVisible) toggleProfitCalculator();
        toggleProfitCalculator();
        setTimeout(() => {
          const inp = document.getElementById('scx-calc-price');
          if (inp) { inp.value = price; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        }, 100);
      });

      if (priceEl) {
        priceEl.style.display = 'inline-flex';
        priceEl.style.alignItems = 'center';
        priceEl.style.gap = '4px';
        priceEl.style.flexWrap = 'wrap';
        priceEl.appendChild(badge);
        injected++;
      }
    }
  });

  if (injected > 0 && !overlaysInjected) {
    overlaysInjected = true;
    showToast(`📊 SCX: ${injected} ta mahsulotga analitika qo'shildi`, 'success');
  }
}

async function enhanceOrders() {
  await sleep(1500);
  const rows = document.querySelectorAll('tr, [class*="order-card"], [class*="OrderCard"], [class*="order-row"]');
  rows.forEach(row => {
    if (row.querySelector('.scx-quick-btn')) return;
    const actionCell = row.querySelector('td:last-child, [class*="action"]');
    if (!actionCell) return;

    const btn = document.createElement('button');
    btn.className = 'scx-quick-btn';
    btn.textContent = '🏷️';
    btn.title = 'SCX: Tez etiketka chop etish';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('🏷️ Etiketka tayyorlanmoqda...', 'info');
    });
    actionCell.appendChild(btn);
  });
}

// ===== 5. Command Handlers =====

// Helper: wait for selector to appear
function waitFor(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

// Helper: find input by nearby label text
function findFieldByLabel(labelText, tag = 'input') {
  const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"], [class*="field-name"], [class*="FieldName"]');
  for (const label of labels) {
    const text = label.textContent?.toLowerCase().trim() || '';
    if (text.includes(labelText.toLowerCase())) {
      // Try: label's for attribute, or nearby input
      const forId = label.getAttribute('for');
      if (forId) {
        const el = document.getElementById(forId);
        if (el) return el;
      }
      // Sibling or child input
      const parent = label.closest('[class*="field"], [class*="Field"], [class*="form-group"], [class*="FormGroup"], [class*="row"], [class*="Row"]') || label.parentElement;
      if (parent) {
        const el = parent.querySelector(`${tag}, [contenteditable="true"]`);
        if (el) return el;
      }
    }
  }
  return null;
}

// Helper: find and click dropdown option
async function selectDropdownOption(text) {
  await sleep(500);
  const options = document.querySelectorAll('[class*="option"], [class*="Option"], [class*="menu-item"], [class*="MenuItem"], [role="option"], li');
  for (const opt of options) {
    if (opt.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
      clickEl(opt);
      return true;
    }
  }
  return false;
}

// Helper: fill contenteditable (rich text editors)
function fillContentEditable(el, text) {
  if (!el) return false;
  el.focus();
  el.innerHTML = text.replace(/\n/g, '<br>');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

async function handleCreateProduct(payload) {
  console.log('[SCX v3] Creating product with FULL data:', Object.keys(payload));
  showToast('📦 Kartochka yaratilmoqda — to\'liq rejim...', 'info');

  // Step 1: Navigate to create page
  if (!window.location.href.includes('/goods/create') && !window.location.href.includes('/product/create')) {
    window.location.href = 'https://seller.uzum.uz/goods/create';
    await sleep(4000);
    await waitFor('[class*="create"], [class*="Create"], form', 8000);
    await sleep(2000);
  } else {
    await sleep(1500);
  }

  let filledFields = 0;
  let totalFields = 0;

  // Step 2: Category selection (navigate tree)
  totalFields++;
  if (payload.categoryPath?.length > 0) {
    showToast('📂 Kategoriya tanlanmoqda...', 'info');
    const categoryBtn = document.querySelector('[class*="category"], [class*="Category"], button[class*="select"]');
    if (categoryBtn) {
      clickEl(categoryBtn);
      await sleep(1000);

      for (const cat of payload.categoryPath) {
        const found = await selectDropdownOption(cat);
        if (found) {
          await sleep(800);
          filledFields++;
        }
      }
      // Close category dialog if still open
      await sleep(500);
    }
  }

  // Step 3: Product name (UZ + RU)
  totalFields += 2;
  // Try to find UZ name field
  const nameFields = document.querySelectorAll('input[type="text"]');
  for (const input of nameFields) {
    const ctx = ((input.placeholder || '') + ' ' + (input.closest('[class*="field"], label, [class*="Field"]')?.textContent || '')).toLowerCase();
    if (ctx.includes('назван') || ctx.includes('nomi') || ctx.includes('название') || ctx.includes('наименование')) {
      // Check if it's UZ or RU field
      if (ctx.includes('узб') || ctx.includes("o'zbek") || ctx.includes('uz')) {
        if (fillInput(input, payload.titleUz || payload.titleRu || payload.title)) filledFields++;
      } else {
        if (fillInput(input, payload.titleRu || payload.title)) filledFields++;
      }
    }
  }

  // Alternative: fill name by finding first text input in form
  if (filledFields < 1) {
    const firstInput = document.querySelector('form input[type="text"], [class*="create"] input[type="text"]');
    if (firstInput && fillInput(firstInput, payload.titleRu || payload.titleUz || payload.title)) {
      filledFields++;
    }
  }

  await sleep(500);

  // Step 4: Description (UZ + RU)
  totalFields += 2;
  const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
  let descFilled = 0;
  for (const ta of textareas) {
    const ctx = (ta.closest('[class*="field"], label, [class*="Field"]')?.textContent || '').toLowerCase();
    if (ctx.includes('описан') || ctx.includes('tavsif') || ctx.includes('description')) {
      const isUz = ctx.includes('узб') || ctx.includes("o'zbek") || ctx.includes('uz');
      const text = isUz ? (payload.descriptionUz || payload.descriptionRu) : (payload.descriptionRu || payload.descriptionUz);
      if (ta.contentEditable === 'true') {
        if (fillContentEditable(ta, text)) { filledFields++; descFilled++; }
      } else {
        if (fillInput(ta, text)) { filledFields++; descFilled++; }
      }
    }
  }
  // Fallback: fill all textareas if none matched
  if (descFilled === 0 && textareas.length > 0) {
    for (const ta of textareas) {
      if (ta.closest('[class*="description"], [class*="Description"]')) {
        const text = payload.descriptionRu || payload.descriptionUz || payload.description || '';
        if (ta.contentEditable === 'true') {
          fillContentEditable(ta, text);
        } else {
          fillInput(ta, text);
        }
        filledFields++;
        break;
      }
    }
  }

  await sleep(500);

  // Step 5: Brand
  totalFields++;
  const brandField = findFieldByLabel('бренд') || findFieldByLabel('brand') || findFieldByLabel('Бренд');
  if (brandField && payload.brand) {
    fillInput(brandField, payload.brand);
    filledFields++;
    await sleep(300);
    // If dropdown appears, select matching option
    await selectDropdownOption(payload.brand);
  }

  // Step 6: Price
  totalFields++;
  const priceInputs = document.querySelectorAll('input[type="number"], input[inputmode="numeric"]');
  for (const input of priceInputs) {
    const ctx = ((input.placeholder || '') + ' ' + (input.closest('[class*="field"], label')?.textContent || '')).toLowerCase();
    if (ctx.includes('цена') || ctx.includes('narx') || ctx.includes('price') || ctx.includes('стоимость')) {
      if (fillInput(input, String(payload.price || 0))) { filledFields++; break; }
    }
  }

  // Step 7: SKU / Article
  totalFields++;
  if (payload.sku) {
    const skuField = findFieldByLabel('артикул') || findFieldByLabel('sku') || findFieldByLabel('SKU');
    if (skuField) {
      fillInput(skuField, payload.sku);
      filledFields++;
    }
  }

  // Step 8: Barcode
  totalFields++;
  if (payload.barcode) {
    const barcodeField = findFieldByLabel('штрих') || findFieldByLabel('barcode') || findFieldByLabel('EAN');
    if (barcodeField) {
      fillInput(barcodeField, payload.barcode);
      filledFields++;
    }
  }

  // Step 9: MXIK (IKPU) code
  totalFields++;
  if (payload.mxikCode) {
    showToast('🏷️ MXIK kodi kiritilmoqda...', 'info');
    const mxikField = findFieldByLabel('МХИК') || findFieldByLabel('IKPU') || findFieldByLabel('ТНВЭД') || findFieldByLabel('mxik') || findFieldByLabel('икпу');
    if (mxikField) {
      fillInput(mxikField, payload.mxikCode);
      filledFields++;
      await sleep(500);
      // Auto-select from dropdown if appears
      if (payload.mxikName) {
        await selectDropdownOption(payload.mxikCode);
      }
    }
  }

  // Step 10: VGH — Weight, Height, Length, Width
  totalFields += 4;
  const vghMap = [
    { labels: ['вес', 'og\'irlik', 'weight', 'масса'], value: payload.weight },
    { labels: ['высот', 'balandlik', 'height'], value: payload.height },
    { labels: ['длин', 'uzunlik', 'length'], value: payload.length },
    { labels: ['ширин', 'kenglik', 'width'], value: payload.width },
  ];
  for (const vgh of vghMap) {
    if (!vgh.value) continue;
    for (const label of vgh.labels) {
      const field = findFieldByLabel(label);
      if (field) {
        fillInput(field, String(vgh.value));
        filledFields++;
        break;
      }
    }
  }

  // Step 11: Characteristics / Attributes
  totalFields++;
  if (payload.characteristics?.length > 0) {
    showToast(`📋 ${payload.characteristics.length} ta xususiyat kiritilmoqda...`, 'info');
    for (const attr of payload.characteristics) {
      // Try to find matching field by characteristic name
      const field = findFieldByLabel(attr.name) || findFieldByLabel(attr.name.toLowerCase());
      if (field) {
        if (field.tagName === 'SELECT') {
          // Try to select option
          const options = field.querySelectorAll('option');
          for (const opt of options) {
            if (opt.textContent?.toLowerCase().includes(attr.value.toLowerCase())) {
              field.value = opt.value;
              field.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        } else {
          fillInput(field, attr.value);
        }
        await sleep(200);
        // If dropdown appears, try to select
        await selectDropdownOption(attr.value);
      }
    }
    filledFields++;
  }

  // Step 12: Color
  if (payload.color) {
    const colorField = findFieldByLabel('цвет') || findFieldByLabel('rang') || findFieldByLabel('color');
    if (colorField) {
      fillInput(colorField, payload.color);
      await sleep(300);
      await selectDropdownOption(payload.color);
    }
  }

  // Step 13: Images upload
  totalFields++;
  if (payload.images?.length > 0) {
    showToast(`🖼️ ${payload.images.length} ta rasm yuklanmoqda...`, 'info');
    
    // Find file input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const imgInput = Array.from(fileInputs).find(fi => {
      const accept = fi.getAttribute('accept') || '';
      return accept.includes('image') || accept === '' || accept.includes('*');
    }) || fileInputs[0];

    if (imgInput) {
      const dt = new DataTransfer();
      let uploaded = 0;
      
      for (const url of payload.images.slice(0, 10)) {
        try {
          const resp = await fetch(url, { mode: 'cors' });
          if (!resp.ok) continue;
          const blob = await resp.blob();
          if (blob.size < 1000) continue;
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          const file = new File([blob], `product-${Date.now()}-${uploaded}.${ext}`, { type: blob.type || 'image/jpeg' });
          dt.items.add(file);
          uploaded++;
          await sleep(300);
        } catch (e) {
          console.warn('[SCX] Image fetch failed:', url, e);
        }
      }
      
      if (uploaded > 0) {
        imgInput.files = dt.files;
        imgInput.dispatchEvent(new Event('change', { bubbles: true }));
        imgInput.dispatchEvent(new Event('input', { bubbles: true }));
        filledFields++;
        showToast(`✅ ${uploaded} ta rasm yuklandi`, 'success');
        await sleep(2000);
      }
    } else {
      // Alternative: try drag-and-drop zone
      const dropZone = document.querySelector('[class*="upload"], [class*="Upload"], [class*="dropzone"], [class*="DropZone"]');
      if (dropZone) {
        for (const url of payload.images.slice(0, 5)) {
          try {
            const resp = await fetch(url, { mode: 'cors' });
            const blob = await resp.blob();
            const file = new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const dt = new DataTransfer();
            dt.items.add(file);
            const dropEvent = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
            dropZone.dispatchEvent(dropEvent);
            await sleep(1500);
          } catch {}
        }
        filledFields++;
      }
    }
  }

  // Step 14: Country of origin
  if (payload.country) {
    const countryField = findFieldByLabel('страна') || findFieldByLabel('mamlakat') || findFieldByLabel('country');
    if (countryField) {
      fillInput(countryField, payload.country);
      await sleep(300);
      await selectDropdownOption(payload.country);
    }
  }

  const quality = Math.round((filledFields / Math.max(totalFields, 1)) * 100);
  console.log(`[SCX v3] Filled ${filledFields}/${totalFields} fields (${quality}%)`);
  showToast(`✅ Kartochka to'ldirildi: ${filledFields}/${totalFields} maydon (${quality}%)`, 'success');
  
  return { 
    success: true, 
    result: `Product form filled: ${filledFields}/${totalFields} fields (${quality}%)`,
    filledFields,
    totalFields,
    quality,
  };
}

async function handleToggleBoost(payload) {
  if (!window.location.href.includes('/advertising')) {
    window.location.href = 'https://seller.uzum.uz/advertising';
    await sleep(3000);
  }
  for (const el of document.querySelectorAll('[class*="product"], tr')) {
    if (el.textContent.includes(payload.sku || payload.productId)) {
      const toggle = el.querySelector('input[type="checkbox"], [class*="switch"]');
      if (toggle) { clickEl(toggle); showToast('⚡ Boost o\'zgartirildi', 'success'); return { success: true }; }
    }
  }
  return { success: false, error: 'Product not found' };
}

async function handleGenerateLabel(payload) {
  if (!window.location.href.includes('/orders')) {
    window.location.href = 'https://seller.uzum.uz/orders';
    await sleep(3000);
  }
  for (const el of document.querySelectorAll('[class*="order"], tr')) {
    if (el.textContent.includes(payload.orderId)) {
      const btn = el.querySelector('button[class*="print"], button[class*="label"]');
      if (btn) { clickEl(btn); showToast('🏷️ Etiketka chop etilmoqda', 'success'); return { success: true }; }
    }
  }
  return { success: false, error: 'Order not found' };
}

// ===== Message Listener =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_SETTING') {
    if (msg.setting === 'overlay') SCX.overlayEnabled = msg.value;
    if (msg.setting === 'profit') SCX.profitEnabled = msg.value;
    if (msg.setting === 'overlay' && msg.value) injectProductOverlays();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type !== 'SCX_COMMAND') return;
  console.log('[SCX] Command:', msg.command_type);
  showToast(`⏳ ${msg.command_type.replace(/_/g, ' ')} bajarilmoqda...`, 'info');

  (async () => {
    try {
      let result;
      switch (msg.command_type) {
        case 'create_product': result = await handleCreateProduct(msg.payload); break;
        case 'toggle_boost': result = await handleToggleBoost(msg.payload); break;
        case 'generate_label': result = await handleGenerateLabel(msg.payload); break;
        case 'batch_labels':
          for (const o of (msg.payload.orders || [])) { await handleGenerateLabel(o); await sleep(1000); }
          result = { success: true, result: 'Batch done' };
          break;
        case 'update_price': result = { success: true, result: 'Price update received' }; break;
        case 'update_stock': result = { success: true, result: 'Stock update received' }; break;
        default: result = { success: false, error: `Unknown: ${msg.command_type}` };
      }
      sendResponse(result);
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});

// ===== 6. SPA Navigation & Init =====
function initSCX() {
  if (window.location.hostname !== 'seller.uzum.uz') return;

  createToolbar();
  setTimeout(() => injectProductOverlays(), 2000);

  // SPA navigation detection
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      overlaysInjected = false;
      setTimeout(() => injectProductOverlays(), 1500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.sendMessage({ type: 'SCX_PING' }, (r) => {
    if (r?.pong) console.log('[SCX] Background worker active');
  });
}

initSCX();
