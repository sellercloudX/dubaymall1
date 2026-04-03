/**
 * SellerCloudX Content Script — Wildberries Seller Panel
 * seller.wildberries.ru uchun maxsus funksiyalar
 * 
 * Funksiyalar:
 * 1. Moliya hisobotlari scraping (komissiya, logistika, qaytarishlar)
 * 2. Buyurtmalarni qayta ishlash
 * 3. Narx monitoring
 * 4. Analitika overlay
 */

console.log('[SCX v4.0] Wildberries Seller content script loaded');

function initWBSeller() {
  scxCreateToolbar('Wildberries Seller', '🟪');
  
  document.getElementById('scx-btn-scrape')?.addEventListener('click', scrapeWBData);
  document.getElementById('scx-btn-panel')?.addEventListener('click', toggleWBPanel);
  
  scxObserveNavigation(() => {
    injectWBOverlays();
  });
  
  setTimeout(injectWBOverlays, 2000);
}

// ===== Finance Scraping =====
async function scrapeWBData() {
  scxShowToast('🔍 WB moliya ma\'lumotlari yig\'ilmoqda...', 'info');
  const url = window.location.href;
  const data = { marketplace: 'wildberries', url };
  
  try {
    // Moliya/To'lovlar sahifasi
    if (url.includes('/finance') || url.includes('/payment') || url.includes('/analytics') || url.includes('/money')) {
      data.type = 'finance';
      
      // Barcha jadvallarni yig'ish
      const tables = document.querySelectorAll('table');
      data.tables = [];
      tables.forEach(table => {
        const headers = [...table.querySelectorAll('th')].map(h => h.textContent.trim());
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = [...tr.querySelectorAll('td')].map(td => {
            const text = td.textContent.trim();
            return text;
          });
          if (cells.some(c => c.length > 0)) rows.push(cells);
        });
        if (rows.length > 0) data.tables.push({ headers, rows });
      });

      // Umumiy summalar
      data.summaries = [];
      document.querySelectorAll('[class*="total"], [class*="sum"], [class*="amount"], [class*="Итого"]').forEach(el => {
        const text = el.textContent.trim();
        if (text.length < 200 && text.length > 0) data.summaries.push(text);
      });
      
      // Kartochkalar (stat cards)
      data.statCards = [];
      document.querySelectorAll('[class*="card"], [class*="stat"], [class*="kpi"]').forEach(card => {
        const text = card.textContent.trim();
        if (text.length < 300 && text.length > 3) data.statCards.push(text);
      });
    }
    
    // Buyurtmalar
    if (url.includes('/orders') || url.includes('/supply') || url.includes('/delivers')) {
      data.type = 'orders';
      data.orderRows = scxParseTableRows('table', {});
      
      // Tab-lar sonini yig'ish (yangi, yig'ilmoqda va h.k.)
      data.tabs = [];
      document.querySelectorAll('[class*="tab"], [role="tab"]').forEach(tab => {
        const text = tab.textContent.trim();
        if (text.length < 50) data.tabs.push(text);
      });
    }
    
    // Mahsulotlar
    if (url.includes('/catalog') || url.includes('/cards') || url.includes('/goods')) {
      data.type = 'products';
      data.productRows = scxParseTableRows('table', {});
    }
    
    // Narxlar sahifasi
    if (url.includes('/price') || url.includes('/discount')) {
      data.type = 'pricing';
      data.priceRows = scxParseTableRows('table', {});
    }
    
    // Raqobatchilar / Analitika
    if (url.includes('/analytics') || url.includes('/competitor')) {
      data.type = 'analytics';
      
      // Grafiklar ichidagi sonlarni yig'ish
      data.chartValues = [];
      document.querySelectorAll('[class*="chart"] text, svg text').forEach(t => {
        const num = scxParseNumber(t.textContent);
        if (num > 0) data.chartValues.push(num);
      });
    }
    
    if (data.type) {
      await scxSaveScrapedData('wildberries', data.type, data, url);
      scxShowToast(`✅ WB ${data.type} ma'lumotlari saqlandi`, 'success');
    } else {
      scxShowToast('⚠️ Ma\'lumot topilmadi. Finance yoki Orders sahifasiga o\'ting', 'warning');
    }
  } catch (err) {
    console.error('[SCX] WB scrape error:', err);
    scxShowToast('❌ Xatolik: ' + err.message, 'error');
  }
}

// ===== Analytics Panel =====
let wbPanelVisible = false;

async function toggleWBPanel() {
  if (wbPanelVisible) {
    document.getElementById('scx-analytics-panel')?.remove();
    wbPanelVisible = false;
    return;
  }

  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    scxShowToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }

  const connData = await scxFetch(`marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.wildberries&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`);
  const conn = Array.isArray(connData) ? connData[0] : null;
  
  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>🟪 WB Analitika</span>
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
  wbPanelVisible = true;

  document.getElementById('scx-panel-close')?.addEventListener('click', () => {
    panel.remove();
    wbPanelVisible = false;
  });
}

// ===== Inline Overlays =====
function injectWBOverlays() {
  // Mahsulot ro'yxatida SCX badge qo'shish
  document.querySelectorAll('tr, [class*="product-card"], [class*="Card"]').forEach(row => {
    if (row.querySelector('.scx-badge')) return;
    const nameEl = row.querySelector('[class*="name"], [class*="title"], [class*="Name"]');
    if (nameEl && nameEl.textContent.trim().length > 3) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '⚡ SCX';
      badge.title = 'SellerCloudX bilan boshqaring';
      nameEl.appendChild(badge);
    }
  });
}

// ===== Command Handler =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_COMMAND') {
    sendResponse({ success: true, result: { message: 'WB buyruq qabul qilindi' } });
    return true;
  }
});

// ===== Start =====
setTimeout(initWBSeller, 1000);
