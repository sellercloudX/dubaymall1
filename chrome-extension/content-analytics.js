/**
 * SellerCloudX Content Script — Analytics Sites
 * mpstats.io va zoomselling.io uchun — raqobatchi monitoring
 * 
 * Funksiyalar:
 * 1. Mahsulot statistikasini scraping (sotuvlar, narx, reyting)
 * 2. Kategoriya trendlarini yig'ish
 * 3. Raqobatchi narxlarini monitoring
 * 4. SellerCloudX dashboardga to'g'ridan-to'g'ri uzatish
 */

console.log('[SCX v4.0] Analytics (mpstats/zoomselling) content script loaded');

const ANALYTICS_SITE = window.location.hostname.includes('mpstats') ? 'mpstats' : 'zoomselling';

function initAnalytics() {
  scxCreateToolbar(ANALYTICS_SITE === 'mpstats' ? 'MPStats' : 'ZoomSelling', '📈');
  
  document.getElementById('scx-btn-scrape')?.addEventListener('click', scrapeAnalyticsData);
  document.getElementById('scx-btn-panel')?.addEventListener('click', showScrapedDataPanel);
  
  scxObserveNavigation(() => {
    injectAnalyticsOverlays();
  });
  
  setTimeout(injectAnalyticsOverlays, 2000);
}

// ===== Data Scraping =====
async function scrapeAnalyticsData() {
  scxShowToast(`🔍 ${ANALYTICS_SITE} ma'lumotlari yig'ilmoqda...`, 'info');
  const url = window.location.href;
  const data = { source: ANALYTICS_SITE, url, scrapedAt: new Date().toISOString() };
  
  try {
    // ===== Mahsulot sahifasi =====
    if (url.includes('/product') || url.includes('/item') || url.includes('/sku')) {
      data.type = 'product_stats';
      
      // Mahsulot nomi
      data.productName = document.querySelector('h1, [class*="title"], [class*="product-name"]')?.textContent?.trim();
      
      // Asosiy metrikalar
      data.metrics = {};
      document.querySelectorAll('[class*="metric"], [class*="stat"], [class*="kpi"], [class*="info-item"]').forEach(el => {
        const label = el.querySelector('[class*="label"], [class*="title"], small, span:first-child')?.textContent?.trim();
        const value = el.querySelector('[class*="value"], [class*="number"], strong, b, span:last-child')?.textContent?.trim();
        if (label && value) {
          data.metrics[label] = value;
        }
      });
      
      // Narx tarixi (grafik qiymatlari)
      data.priceHistory = [];
      document.querySelectorAll('[class*="chart"] text, svg text, [class*="price-point"]').forEach(el => {
        const num = scxParseNumber(el.textContent);
        if (num > 0) data.priceHistory.push(num);
      });
      
      // Jadval ma'lumotlari
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
    }
    
    // ===== Kategoriya sahifasi =====
    if (url.includes('/category') || url.includes('/niche') || url.includes('/trend')) {
      data.type = 'category_trend';
      
      data.categoryName = document.querySelector('h1, [class*="title"]')?.textContent?.trim();
      
      // Top mahsulotlar ro'yxati
      data.topProducts = [];
      document.querySelectorAll('tr, [class*="product-row"], [class*="item-row"]').forEach((row, i) => {
        if (i > 50) return; // Max 50 ta
        const cells = [...row.querySelectorAll('td')].map(c => c.textContent.trim());
        if (cells.length >= 2) {
          data.topProducts.push({
            rank: i + 1,
            cells,
          });
        }
      });
      
      // Trend summaries
      data.trendSummaries = [];
      document.querySelectorAll('[class*="summary"], [class*="insight"], [class*="trend"]').forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 5 && text.length < 500) data.trendSummaries.push(text);
      });
    }
    
    // ===== Sotuvchi sahifasi =====
    if (url.includes('/seller') || url.includes('/shop') || url.includes('/brand')) {
      data.type = 'seller_analysis';
      
      data.sellerName = document.querySelector('h1, [class*="title"]')?.textContent?.trim();
      
      // Sotuvchi statistikasi
      data.sellerStats = {};
      document.querySelectorAll('[class*="stat"], [class*="metric"], [class*="info"]').forEach(el => {
        const label = el.querySelector('[class*="label"], small')?.textContent?.trim();
        const value = el.querySelector('[class*="value"], strong, b')?.textContent?.trim();
        if (label && value) data.sellerStats[label] = value;
      });
    }
    
    // ===== Qidiruv natijalari =====
    if (url.includes('/search') || url.includes('/find') || url.includes('q=')) {
      data.type = 'search_results';
      data.query = new URL(url).searchParams.get('q') || document.querySelector('input[type="search"], input[name="q"]')?.value;
      data.resultCount = scxParseNumber(document.querySelector('[class*="count"], [class*="total"]')?.textContent);
    }
    
    // ===== Umumiy =====
    if (!data.type) {
      data.type = 'general';
      // Barcha ko'rinadigan raqamlarni yig'ish
      data.visibleNumbers = [];
      document.querySelectorAll('[class*="value"], [class*="number"], [class*="count"], strong').forEach(el => {
        const num = scxParseNumber(el.textContent);
        if (num > 0 && num < 1e12) data.visibleNumbers.push(num);
      });
    }
    
    // Save
    await scxSaveScrapedData(ANALYTICS_SITE, data.type, data, url);
    const itemCount = data.topProducts?.length || data.tables?.length || Object.keys(data.metrics || {}).length || 0;
    scxShowToast(`✅ ${data.type}: ${itemCount} element saqlandi`, 'success');
    
  } catch (err) {
    console.error('[SCX] Analytics scrape error:', err);
    scxShowToast('❌ Xatolik: ' + err.message, 'error');
  }
}

// ===== Scraped Data Panel =====
async function showScrapedDataPanel() {
  const existing = document.getElementById('scx-analytics-panel');
  if (existing) { existing.remove(); return; }
  
  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    scxShowToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }
  
  // Fetch recent scraped data
  const recent = await scxFetch(`marketplace_scraped_data?user_id=eq.${config.userId}&marketplace=eq.${ANALYTICS_SITE}&order=scraped_at.desc&limit=10&select=id,data_type,scraped_at,source_url`);
  
  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>📈 ${ANALYTICS_SITE === 'mpstats' ? 'MPStats' : 'ZoomSelling'} Ma'lumotlar</span>
      <button id="scx-panel-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div class="scx-panel-body">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">So'nggi yig'ilgan ma'lumotlar:</div>
      ${Array.isArray(recent) && recent.length > 0 ? recent.map(r => `
        <div class="scx-product-item">
          <div class="scx-product-info">
            <div class="scx-product-name">${r.data_type}</div>
            <div class="scx-product-sku">${new Date(r.scraped_at).toLocaleString('uz', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      `).join('') : '<div style="text-align:center;color:#64748b;font-size:11px;padding:16px;">Ma\'lumot yo\'q. 🔍 tugmasini bosing</div>'}
      <div style="text-align:center;margin-top:10px;">
        <button onclick="window.open('https://sellercloudx.lovable.app/seller-cloud','_blank')" style="
          padding:6px 12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;
        ">📊 Dashboard'da ko'rish</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  document.getElementById('scx-panel-close')?.addEventListener('click', () => panel.remove());
}

// ===== Inject overlays =====
function injectAnalyticsOverlays() {
  // Mahsulot kartochkalarida "SCX ga saqlash" tugmasi
  document.querySelectorAll('[class*="product"], [class*="item-card"], [class*="goods"]').forEach(card => {
    if (card.querySelector('.scx-badge')) return;
    
    const nameEl = card.querySelector('[class*="name"], [class*="title"], a');
    if (nameEl && nameEl.textContent.trim().length > 3) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '📊 SCX';
      badge.title = 'SellerCloudX ga saqlash';
      badge.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Quick save this product's visible data
        const productData = {
          name: nameEl.textContent.trim(),
          url: nameEl.href || window.location.href,
          visibleText: card.textContent.trim().substring(0, 500),
        };
        await scxSaveScrapedData(ANALYTICS_SITE, 'quick_save', productData, window.location.href);
        scxShowToast('✅ Saqlandi!', 'success');
      });
      nameEl.parentElement?.appendChild(badge);
    }
  });
}

setTimeout(initAnalytics, 1500);
