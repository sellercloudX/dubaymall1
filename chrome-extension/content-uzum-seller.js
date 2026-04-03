/**
 * SellerCloudX Content Script — Uzum Seller Panel
 * seller.uzum.uz uchun maxsus funksiyalar
 */

console.log('[SCX v4.0] Uzum Seller content script loaded');

// ===== Settings =====
const uzumSettings = { overlayEnabled: true, profitEnabled: true };
chrome.storage.local.get(['setting_overlay', 'setting_profit'], (r) => {
  if (r.setting_overlay === false) uzumSettings.overlayEnabled = false;
  if (r.setting_profit === false) uzumSettings.profitEnabled = false;
});

// ===== Init =====
function initUzumSeller() {
  scxCreateToolbar('Uzum Seller', '🟣');
  
  // Add Uzum-specific buttons
  const scrapeBtn = document.getElementById('scx-btn-scrape');
  scrapeBtn?.addEventListener('click', scrapeUzumFinance);
  
  const panelBtn = document.getElementById('scx-btn-panel');
  panelBtn?.addEventListener('click', toggleUzumPanel);
  
  // Add profit calculator button
  const actionsDiv = document.querySelector('.scx-toolbar-actions');
  if (actionsDiv) {
    const profitBtn = document.createElement('button');
    profitBtn.className = 'scx-tb-btn';
    profitBtn.title = 'Foyda kalkulyator';
    profitBtn.textContent = '💰';
    profitBtn.addEventListener('click', toggleUzumProfitCalc);
    actionsDiv.insertBefore(profitBtn, actionsDiv.lastElementChild);
  }
  
  // Observe navigation for SPA
  scxObserveNavigation(() => {
    injectUzumOverlays();
  });
  
  // Initial overlays
  setTimeout(injectUzumOverlays, 2000);
}

// ===== Finance Scraping =====
async function scrapeUzumFinance() {
  scxShowToast('🔍 Moliya ma\'lumotlari yig\'ilmoqda...', 'info');
  
  const url = window.location.href;
  const data = {};
  
  try {
    // Komissiya sahifasi
    if (url.includes('/finance') || url.includes('/settlements') || url.includes('/billing')) {
      data.type = 'finance_settlement';
      
      // Jadval ma'lumotlarini yig'ish
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const headers = [...table.querySelectorAll('thead th')].map(h => h.textContent.trim());
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
          if (cells.length > 0) rows.push(cells);
        });
        if (rows.length > 0) {
          data.tables = data.tables || [];
          data.tables.push({ headers, rows });
        }
      }
      
      // Yig'indi kartochkalarni yig'ish
      const summaryCards = document.querySelectorAll('[class*="summary"], [class*="card"], [class*="stat"], [class*="total"]');
      data.summaryValues = [];
      summaryCards.forEach(card => {
        const text = card.textContent.trim();
        if (text && text.length < 200) {
          data.summaryValues.push(text);
        }
      });
    }
    
    // Buyurtmalar sahifasi
    if (url.includes('/orders') || url.includes('/fbs') || url.includes('/fbo')) {
      data.type = 'orders';
      data.orderRows = scxParseTableRows('table', {});
      
      // Pending buyurtmalar soni
      const badges = document.querySelectorAll('[class*="badge"], [class*="count"]');
      data.pendingCounts = [];
      badges.forEach(b => {
        const num = scxParseNumber(b.textContent);
        if (num > 0) data.pendingCounts.push(num);
      });
    }
    
    // Mahsulotlar sahifasi
    if (url.includes('/products') || url.includes('/goods') || url.includes('/catalog')) {
      data.type = 'products';
      const productCards = document.querySelectorAll('[class*="product"], [class*="item"], tr');
      data.productCount = productCards.length;
    }
    
    // Save to DB
    if (Object.keys(data).length > 1) {
      await scxSaveScrapedData('uzum', data.type || 'general', data, url);
      scxShowToast(`✅ ${data.type || 'Ma\'lumotlar'} saqlandi (${JSON.stringify(data).length} bayt)`, 'success');
    } else {
      scxShowToast('⚠️ Bu sahifada yig\'iladigan ma\'lumot topilmadi', 'warning');
    }
  } catch (err) {
    console.error('[SCX] Uzum scrape error:', err);
    scxShowToast('❌ Xatolik: ' + err.message, 'error');
  }
}

// ===== Analytics Panel =====
let uzumPanelVisible = false;

async function toggleUzumPanel() {
  if (uzumPanelVisible) {
    document.getElementById('scx-analytics-panel')?.remove();
    uzumPanelVisible = false;
    return;
  }

  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    scxShowToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }

  const [connData, products] = await Promise.all([
    scxFetch(`marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.uzum&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`),
    scxFetch(`marketplace_products_cache?user_id=eq.${config.userId}&marketplace=eq.uzum&select=offer_id,data&order=synced_at.desc&limit=10`),
  ]);

  const conn = Array.isArray(connData) ? connData[0] : null;
  
  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>🟣 Uzum Analitika</span>
      <button id="scx-panel-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div class="scx-panel-body">
      <div class="scx-metric-grid">
        <div class="scx-metric-card">
          <div class="scx-metric-value purple">${scxFormatNum(conn?.products_count || 0)}</div>
          <div class="scx-metric-label">Mahsulotlar</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value green">${scxFormatNum(conn?.orders_count || 0)}</div>
          <div class="scx-metric-label">Buyurtmalar</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value blue">${scxFormatNum(conn?.total_revenue || 0)}</div>
          <div class="scx-metric-label">Daromad</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value orange">${conn?.total_revenue > 0 && conn?.orders_count > 0 ? scxFormatNum(conn.total_revenue / conn.orders_count) : '—'}</div>
          <div class="scx-metric-label">O'rtacha chek</div>
        </div>
      </div>
      ${Array.isArray(products) && products.length > 0 ? `
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Top mahsulotlar:</div>
        ${products.slice(0, 5).map(p => {
          const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
          return `<div class="scx-product-item">
            <div class="scx-product-info">
              <div class="scx-product-name">${d?.title || d?.name || p.offer_id}</div>
              <div class="scx-product-sku">SKU: ${p.offer_id}</div>
            </div>
            <div class="scx-product-stats">
              <div class="scx-product-price">${scxFormatPrice(d?.price || d?.sellPrice || 0)}</div>
            </div>
          </div>`;
        }).join('')}
      ` : ''}
    </div>
  `;
  document.body.appendChild(panel);
  uzumPanelVisible = true;

  document.getElementById('scx-panel-close')?.addEventListener('click', () => {
    panel.remove();
    uzumPanelVisible = false;
  });
}

// ===== Profit Calculator =====
let profitCalcVisible = false;

function toggleUzumProfitCalc() {
  if (profitCalcVisible) {
    document.getElementById('scx-profit-calc')?.remove();
    profitCalcVisible = false;
    return;
  }
  
  const calc = document.createElement('div');
  calc.id = 'scx-profit-calc';
  calc.innerHTML = `
    <div class="scx-calc-header">
      <span>💰 Foyda kalkulyator</span>
      <button id="scx-calc-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;">✕</button>
    </div>
    <div class="scx-calc-body">
      <div class="scx-calc-row">
        <label>Sotuv narxi (so'm)</label>
        <input type="number" id="scx-sell-price" placeholder="150000">
      </div>
      <div class="scx-calc-row">
        <label>Tannarx (so'm)</label>
        <input type="number" id="scx-cost-price" placeholder="80000">
      </div>
      <div class="scx-calc-row">
        <label>Komissiya (%)</label>
        <input type="number" id="scx-commission" value="15" placeholder="15">
      </div>
      <div class="scx-calc-row">
        <label>Logistika (so'm)</label>
        <input type="number" id="scx-logistics" value="15000" placeholder="15000">
      </div>
      <div class="scx-calc-result" id="scx-calc-results">
        <div class="scx-result-row"><span>Komissiya</span><span class="scx-result-value" id="scx-r-comm">—</span></div>
        <div class="scx-result-row"><span>Sof foyda</span><span class="scx-result-value" id="scx-r-profit">—</span></div>
        <div class="scx-result-row"><span>Marja</span><span class="scx-result-value" id="scx-r-margin">—</span></div>
        <div class="scx-result-row"><span>ROI</span><span class="scx-result-value" id="scx-r-roi">—</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(calc);
  profitCalcVisible = true;
  
  document.getElementById('scx-calc-close')?.addEventListener('click', () => {
    calc.remove();
    profitCalcVisible = false;
  });

  const recalc = () => {
    const sell = parseFloat(document.getElementById('scx-sell-price')?.value) || 0;
    const cost = parseFloat(document.getElementById('scx-cost-price')?.value) || 0;
    const comm = parseFloat(document.getElementById('scx-commission')?.value) || 0;
    const logi = parseFloat(document.getElementById('scx-logistics')?.value) || 0;
    
    const commAmount = sell * comm / 100;
    const profit = sell - cost - commAmount - logi;
    const margin = sell > 0 ? (profit / sell * 100) : 0;
    const roi = cost > 0 ? (profit / cost * 100) : 0;
    
    document.getElementById('scx-r-comm').textContent = scxFormatPrice(commAmount);
    const profitEl = document.getElementById('scx-r-profit');
    profitEl.textContent = scxFormatPrice(profit);
    profitEl.style.color = profit >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('scx-r-margin').textContent = margin.toFixed(1) + '%';
    document.getElementById('scx-r-roi').textContent = roi.toFixed(1) + '%';
  };
  
  ['scx-sell-price', 'scx-cost-price', 'scx-commission', 'scx-logistics'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', recalc);
  });
}

// ===== Inline Overlays =====
function injectUzumOverlays() {
  if (!uzumSettings.overlayEnabled) return;
  // Inject profit badges on product rows
  const rows = document.querySelectorAll('tr[class*="row"], [class*="product-card"], [class*="ProductItem"]');
  rows.forEach(row => {
    if (row.querySelector('.scx-badge')) return;
    const priceEl = row.querySelector('[class*="price"], [class*="Price"]');
    if (priceEl) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '⚡ SCX';
      badge.title = 'SellerCloudX bilan boshqaring';
      priceEl.appendChild(badge);
    }
  });
}

// ===== Command Handler (from background) =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_COMMAND') {
    handleUzumCommand(msg).then(sendResponse);
    return true;
  }
  if (msg.type === 'SCX_SETTING') {
    if (msg.setting === 'overlay') uzumSettings.overlayEnabled = msg.value;
    if (msg.setting === 'profit') uzumSettings.profitEnabled = msg.value;
  }
});

async function handleUzumCommand(msg) {
  const { command_type, payload } = msg;
  console.log('[SCX] Uzum command:', command_type);
  
  try {
    switch (command_type) {
      case 'create_product':
        return await handleCreateProduct(payload);
      case 'update_price':
        return await handleUpdatePrice(payload);
      case 'update_stock':
        return await handleUpdateStock(payload);
      case 'toggle_boost':
        return { success: true, result: { message: 'Boost sahifasiga o\'ting' } };
      case 'generate_label':
        return { success: true, result: { message: 'Etiketka buyurtmalar sahifasida' } };
      default:
        return { success: false, error: 'Noma\'lum buyruq: ' + command_type };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== Create Product (DOM Automation) =====
async function handleCreateProduct(payload) {
  scxShowToast('📦 Kartochka yaratish boshlanmoqda...', 'info');
  
  // Navigate to product creation if not there
  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    window.location.href = 'https://seller.uzum.uz/products/create';
    await scxSleep(3000);
  }
  
  await scxSleep(2000);
  
  // Fill title
  if (payload.title_uz || payload.title) {
    const titleInputs = document.querySelectorAll('input[type="text"], input[name*="title"], input[name*="name"]');
    for (const inp of titleInputs) {
      const label = inp.closest('[class*="field"], [class*="form"]')?.querySelector('label');
      if (label && (label.textContent.includes('назван') || label.textContent.includes('nomi') || label.textContent.includes('Номи'))) {
        scxFillInput(inp, payload.title_uz || payload.title);
        break;
      }
    }
  }
  
  // Fill description
  if (payload.description_uz || payload.description) {
    const descAreas = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (const area of descAreas) {
      const label = area.closest('[class*="field"], [class*="form"]')?.querySelector('label');
      if (label && (label.textContent.includes('описан') || label.textContent.includes('tavsif') || label.textContent.includes('Tavsif'))) {
        if (area.contentEditable === 'true') {
          area.innerHTML = payload.description_uz || payload.description;
          area.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          scxFillInput(area, payload.description_uz || payload.description);
        }
        break;
      }
    }
  }
  
  // Fill MXIK code
  if (payload.mxik_code) {
    const allInputs = document.querySelectorAll('input');
    for (const inp of allInputs) {
      const nearby = inp.closest('[class*="field"], [class*="form"], [class*="row"]');
      const text = nearby?.textContent || '';
      if (text.includes('МХИК') || text.includes('MXIK') || text.includes('IKPU') || text.includes('mxik')) {
        scxFillInput(inp, payload.mxik_code);
        await scxSleep(500);
        break;
      }
    }
  }
  
  // Upload images
  if (payload.images && payload.images.length > 0) {
    const imgInput = document.querySelector('input[type="file"][accept*="image"]');
    if (imgInput) {
      try {
        const dt = new DataTransfer();
        for (const imgUrl of payload.images.slice(0, 10)) {
          const resp = await fetch(imgUrl);
          const blob = await resp.blob();
          const file = new File([blob], `product_${Date.now()}.jpg`, { type: 'image/jpeg' });
          dt.items.add(file);
        }
        imgInput.files = dt.files;
        imgInput.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        console.warn('[SCX] Image upload error:', e);
      }
    }
  }
  
  scxShowToast('✅ Ma\'lumotlar to\'ldirildi. Iltimos, tekshirib saqlang!', 'success');
  return { success: true, result: { filled: true } };
}

async function handleUpdatePrice(payload) {
  scxShowToast('💰 Narx yangilash...', 'info');
  return { success: true, result: { message: 'Narx yangilash API orqali amalga oshiriladi' } };
}

async function handleUpdateStock(payload) {
  scxShowToast('📊 Zaxira yangilash...', 'info');
  return { success: true, result: { message: 'Zaxira yangilash API orqali amalga oshiriladi' } };
}

// ===== Start =====
setTimeout(initUzumSeller, 1000);
