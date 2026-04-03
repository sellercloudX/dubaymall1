/**
 * SellerCloudX Content Script — Yandex Market Partner Panel
 * partner.market.yandex.ru uchun maxsus funksiyalar
 * 
 * Funksiyalar:
 * 1. Moliya hisobotlari scraping (komissiya, logistika, to'lovlar)
 * 2. Buyurtmalar monitoring
 * 3. Kontent sifati tekshirish
 * 4. Analitika overlay
 */

console.log('[SCX v4.0] Yandex Market Partner content script loaded');

function initYandexSeller() {
  scxCreateToolbar('Yandex Market', '🔴');
  
  document.getElementById('scx-btn-scrape')?.addEventListener('click', scrapeYandexData);
  document.getElementById('scx-btn-panel')?.addEventListener('click', toggleYandexPanel);
  
  scxObserveNavigation(() => {
    injectYandexOverlays();
  });
  
  setTimeout(injectYandexOverlays, 2000);
}

// ===== Data Scraping =====
async function scrapeYandexData() {
  scxShowToast('🔍 Yandex moliya ma\'lumotlari yig\'ilmoqda...', 'info');
  const url = window.location.href;
  const data = { marketplace: 'yandex', url };
  
  try {
    // Moliya sahifasi
    if (url.includes('/finance') || url.includes('/billing') || url.includes('/balance') || url.includes('/payment')) {
      data.type = 'finance';
      
      // Jadvallarni yig'ish
      data.tables = [];
      document.querySelectorAll('table').forEach(table => {
        const headers = [...table.querySelectorAll('th')].map(h => h.textContent.trim());
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
          if (cells.some(c => c.length > 0)) rows.push(cells);
        });
        if (rows.length > 0) data.tables.push({ headers, rows });
      });
      
      // Yig'indi summalar
      data.totals = [];
      document.querySelectorAll('[class*="total"], [class*="summary"], [class*="amount"]').forEach(el => {
        const text = el.textContent.trim();
        if (text.length < 200 && text.length > 0) data.totals.push(text);
      });
    }
    
    // Buyurtmalar
    if (url.includes('/orders') || url.includes('/shipments')) {
      data.type = 'orders';
      data.orderRows = scxParseTableRows('table', {});
      
      // Status tabs
      data.statusTabs = [];
      document.querySelectorAll('[class*="tab"], [role="tab"]').forEach(tab => {
        data.statusTabs.push(tab.textContent.trim());
      });
    }
    
    // Assortiment / Mahsulotlar
    if (url.includes('/assortment') || url.includes('/offers') || url.includes('/catalog')) {
      data.type = 'products';
      data.productRows = scxParseTableRows('table', {});
      
      // Kontent sifati (content score)
      data.contentScores = [];
      document.querySelectorAll('[class*="quality"], [class*="score"], [class*="rating"]').forEach(el => {
        const num = scxParseNumber(el.textContent);
        if (num > 0 && num <= 100) data.contentScores.push(num);
      });
    }
    
    // Narxlar
    if (url.includes('/prices')) {
      data.type = 'pricing';
      data.priceRows = scxParseTableRows('table', {});
    }
    
    // Analitika
    if (url.includes('/analytics') || url.includes('/statistics')) {
      data.type = 'analytics';
      
      // KPI kartochkalar
      data.kpis = [];
      document.querySelectorAll('[class*="kpi"], [class*="metric"], [class*="stat"]').forEach(el => {
        data.kpis.push(el.textContent.trim());
      });
    }
    
    if (data.type) {
      await scxSaveScrapedData('yandex', data.type, data, url);
      scxShowToast(`✅ Yandex ${data.type} ma'lumotlari saqlandi`, 'success');
    } else {
      scxShowToast('⚠️ Bu sahifada yig\'iladigan ma\'lumot topilmadi', 'warning');
    }
  } catch (err) {
    console.error('[SCX] Yandex scrape error:', err);
    scxShowToast('❌ Xatolik: ' + err.message, 'error');
  }
}

// ===== Analytics Panel =====
let yandexPanelVisible = false;

async function toggleYandexPanel() {
  if (yandexPanelVisible) {
    document.getElementById('scx-analytics-panel')?.remove();
    yandexPanelVisible = false;
    return;
  }

  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    scxShowToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }

  const connData = await scxFetch(`marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.yandex_market&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`);
  const conn = Array.isArray(connData) ? connData[0] : null;

  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>🔴 Yandex Analitika</span>
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
      <div style="font-size:10px;color:#64748b;text-align:center;margin-top:8px;">
        💡 Moliya sahifasida 🔍 tugmasini bosib real ma'lumotlarni yig'ing
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  yandexPanelVisible = true;

  document.getElementById('scx-panel-close')?.addEventListener('click', () => {
    panel.remove();
    yandexPanelVisible = false;
  });
}

// ===== Inline Overlays =====
function injectYandexOverlays() {
  document.querySelectorAll('tr, [class*="offer-card"], [class*="OfferCard"]').forEach(row => {
    if (row.querySelector('.scx-badge')) return;
    const nameEl = row.querySelector('[class*="name"], [class*="title"]');
    if (nameEl && nameEl.textContent.trim().length > 3) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '⚡ SCX';
      nameEl.appendChild(badge);
    }
  });
}

// ===== Command Handler =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_COMMAND') {
    sendResponse({ success: true, result: { message: 'Yandex buyruq qabul qilindi' } });
    return true;
  }
});

setTimeout(initYandexSeller, 1000);
