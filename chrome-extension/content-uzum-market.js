/**
 * SellerCloudX Content Script — Uzum Market (Front/Marketplace)
 * uzum.uz uchun — FAQAT haqiqiy (verified) ma'lumotlar
 * 
 * MA'LUMOT MANBALARI:
 * ✅ api.uzum.uz/api/product/{id} — narx, qoldiq, buyurtmalar soni (umrbod), reyting, sharhlar
 * ✅ api.uzum.uz/api/seller?url={slug} — do'kon nomi, ro'yxatdan o'tish sanasi, mahsulotlar soni
 * ⚠️ ordersAmount — bu UMRBOD buyurtmalar soni, davr bo'yicha emas!
 * ⚠️ Daromad = ordersAmount × sellPrice — TAXMINIY (narx o'zgargan bo'lishi mumkin)
 * 
 * QOIDALAR:
 * 1. Haqiqiy emas ma'lumotni "30 kunlik" deb ko'rsatma
 * 2. Taxminiy bo'lsa — "≈" va "(taxminiy)" yoz
 * 3. Soxta grafiklar yasama — faqat haqiqiy data bo'lsa ko'rsat
 * 4. SKU bo'yicha sotuvlarni teng bo'lma — ma'lumot yo'q deb yoz
 */

console.log('[SCX v4.0] Uzum Market content script loaded');

// ===== Uzum Market API helpers =====
const UZUM_API = 'https://api.uzum.uz/api';

async function uzumApiFetch(path) {
  try {
    const resp = await fetch(`${UZUM_API}${path}`, {
      headers: { 'Accept': 'application/json', 'Accept-Language': 'ru-RU' },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

function getProductIdFromUrl(url) {
  const match = url.match(/product\/[^?]*?-(\d+)/);
  return match ? match[1] : null;
}

function getShopSlugFromUrl(url) {
  const match = url.match(/\/shop\/([^/?#]+)/);
  return match ? match[1] : null;
}

function getPageType() {
  const path = window.location.pathname;
  if (path.match(/\/product\//)) return 'product';
  if (path.match(/\/shop\//)) return 'shop';
  if (path.match(/\/category\/|\/search|\/catalogues/)) return 'catalog';
  if (path === '/' || path === '/ru' || path === '/uz' || path.match(/^\/[a-z]{2}\/?$/)) return 'home';
  return 'other';
}

// ===== Data fetching — REAL API =====
async function fetchProductStats(productId) {
  const data = await uzumApiFetch(`/product/${productId}`);
  if (!data?.payload) return null;
  
  const p = data.payload;
  return {
    title: p.title,
    sellPrice: p.skuList?.[0]?.sellPrice || p.skuList?.[0]?.purchasePrice,
    fullPrice: p.skuList?.[0]?.fullPrice,
    reviewsAmount: p.reviewsAmount || 0,
    ordersAmount: p.ordersAmount || 0, // ⚠️ UMRBOD — lifetime, not 30-day!
    rating: p.rating || 0,
    seller: p.seller?.title,
    sellerId: p.seller?.id,
    sellerLink: p.seller?.link,
    categoryTitle: p.category?.title,
    categoryId: p.category?.id,
    photos: (p.photos || []).map(ph => ph.photo?.['800']?.high || ph.photo?.['240']?.high),
    skuList: (p.skuList || []).map(sku => ({
      id: sku.id,
      barcode: sku.barcode,
      sellPrice: sku.sellPrice,
      fullPrice: sku.fullPrice,
      availableAmount: sku.availableAmount,
      characteristics: (sku.characteristics || []).map(c => ({
        title: c.title,
        value: c.values?.[0]?.title || c.values?.[0]?.value,
      })),
    })),
    characteristics: (p.characteristics || []).map(c => ({
      title: c.title,
      values: (c.values || []).map(v => v.title || v.value),
    })),
  };
}

async function fetchShopStats(shopSlug) {
  const data = await uzumApiFetch(`/seller?url=${shopSlug}`);
  if (!data?.payload) return null;
  
  const s = data.payload;
  return {
    title: s.title,
    description: s.description,
    registrationDate: s.registrationDate,
    rating: s.rating,
    reviewsCount: s.reviewsCount,
    ordersCount: s.ordersCount,
    productsCount: s.productsCount,
    hasAvatar: !!s.avatar,
  };
}

// ===== Catalog Page — Product Card Overlays =====
function injectCatalogOverlays() {
  const cards = document.querySelectorAll('[data-test-id="product-card"], [class*="product-card"], a[href*="/product/"]');
  
  cards.forEach(card => {
    if (card.querySelector('.scx-card-stats')) return;
    if (card.closest('.scx-card-stats')) return;
    
    let cardEl = card;
    if (card.tagName === 'A') {
      cardEl = card.closest('[class*="Card"], [class*="card"]') || card.parentElement || card;
    }
    if (cardEl.querySelector('.scx-card-stats')) return;
    
    const link = cardEl.tagName === 'A' ? cardEl : cardEl.querySelector('a[href*="/product/"]');
    if (!link) return;
    const productId = getProductIdFromUrl(link.href);
    if (!productId) return;
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'scx-card-stats';
    statsDiv.innerHTML = `
      <div class="scx-card-stats-header">
        <span class="scx-card-stats-logo">📊</span>
        <span class="scx-card-stats-title">Uzum API ma'lumotlari</span>
        <span class="scx-card-stats-brand">SCX</span>
      </div>
      <div class="scx-card-stats-body scx-loading" id="scx-stats-${productId}">
        <div class="scx-card-stats-loading">⏳ Yuklanmoqda...</div>
      </div>
    `;
    
    cardEl.style.position = 'relative';
    cardEl.appendChild(statsDiv);
    
    loadProductCardStats(productId, statsDiv);
  });
}

async function loadProductCardStats(productId, container) {
  const bodyEl = container.querySelector('.scx-card-stats-body');
  
  const stats = await fetchProductStats(productId);
  if (!stats) {
    bodyEl.innerHTML = `<div class="scx-card-stats-row"><span>Ma'lumot topilmadi</span></div>`;
    bodyEl.classList.remove('scx-loading');
    return;
  }
  
  const price = stats.sellPrice || 0;
  const orders = stats.ordersAmount || 0;
  const totalStock = stats.skuList.reduce((sum, sku) => sum + (sku.availableAmount || 0), 0);
  // ⚠️ Taxminiy — ordersAmount UMRBOD, narx o'zgargan bo'lishi mumkin
  const estimatedRevenue = price * orders;
  
  bodyEl.classList.remove('scx-loading');
  bodyEl.innerHTML = `
    <div class="scx-card-stats-row">
      <span class="scx-card-stats-icon">💰</span>
      <span class="scx-card-stats-label">≈ Выручка (общая)</span>
      <span class="scx-card-stats-value scx-val-green">${formatUzumNum(estimatedRevenue)}</span>
    </div>
    <div class="scx-card-stats-row">
      <span class="scx-card-stats-icon">📦</span>
      <span class="scx-card-stats-label">Заказы (всего)</span>
      <span class="scx-card-stats-value">${formatUzumNum(orders)}</span>
    </div>
    <div class="scx-card-stats-row">
      <span class="scx-card-stats-icon">📊</span>
      <span class="scx-card-stats-label">Остатки (сейчас)</span>
      <span class="scx-card-stats-value">${formatUzumNum(totalStock)}</span>
    </div>
    <div class="scx-card-stats-row">
      <span class="scx-card-stats-icon">🏪</span>
      <span class="scx-card-stats-label">Магазин</span>
      <span class="scx-card-stats-value scx-val-link">${stats.seller || '—'}</span>
    </div>
    <div class="scx-card-stats-row">
      <span class="scx-card-stats-icon">⭐</span>
      <span class="scx-card-stats-label">Рейтинг</span>
      <span class="scx-card-stats-value">${stats.rating?.toFixed(1) || '—'} (${formatUzumNum(stats.reviewsAmount)} отзывов)</span>
    </div>
    <div class="scx-card-stats-note">
      ℹ️ Заказы и выручка — за всё время (Uzum API)
    </div>
  `;
  
  scxSaveScrapedData('uzum_market', 'product_card_stats', {
    productId,
    title: stats.title,
    price,
    orders,
    estimatedRevenue,
    totalStock,
    seller: stats.seller,
    rating: stats.rating,
    reviewsAmount: stats.reviewsAmount,
    _source: 'api.uzum.uz',
    _note: 'ordersAmount is lifetime, revenue is estimated',
  }, window.location.href).catch(() => {});
}

// ===== Product Page — Detailed Analytics =====
function injectProductPageAnalytics() {
  if (getPageType() !== 'product') return;
  if (document.getElementById('scx-product-analytics-btn')) return;
  
  const productId = getProductIdFromUrl(window.location.href);
  if (!productId) return;
  
  const btnContainer = document.createElement('div');
  btnContainer.id = 'scx-product-analytics-btn';
  btnContainer.innerHTML = `
    <div class="scx-analytics-trigger">
      <span class="scx-analytics-trigger-logo">📊</span>
      <span class="scx-analytics-trigger-brand">SellerCloudX</span>
      <span class="scx-analytics-trigger-text">Показать аналитику</span>
      <span class="scx-analytics-trigger-arrow" id="scx-analytics-arrow">▼</span>
    </div>
  `;
  
  const breadcrumb = document.querySelector('[class*="breadcrumb"], [class*="Breadcrumb"], nav[aria-label]');
  const h1 = document.querySelector('h1');
  const insertTarget = breadcrumb || h1;
  
  if (insertTarget) {
    insertTarget.parentElement.insertBefore(btnContainer, insertTarget.nextSibling);
  } else {
    document.body.prepend(btnContainer);
  }
  
  let panelOpen = false;
  btnContainer.addEventListener('click', () => {
    panelOpen = !panelOpen;
    const arrow = document.getElementById('scx-analytics-arrow');
    if (arrow) arrow.textContent = panelOpen ? '▲' : '▼';
    
    if (panelOpen) {
      showProductAnalyticsPanel(productId, btnContainer);
    } else {
      document.getElementById('scx-product-panel')?.remove();
    }
  });
}

async function showProductAnalyticsPanel(productId, anchorEl) {
  document.getElementById('scx-product-panel')?.remove();
  
  const panel = document.createElement('div');
  panel.id = 'scx-product-panel';
  panel.innerHTML = `
    <div class="scx-pp-loading">
      <div class="scx-spinner"></div>
      <span>Analitika yuklanmoqda...</span>
    </div>
  `;
  anchorEl.appendChild(panel);
  
  const stats = await fetchProductStats(productId);
  if (!stats) {
    panel.innerHTML = `<div class="scx-pp-error">❌ Ma'lumot yuklanmadi</div>`;
    return;
  }
  
  const totalStock = stats.skuList.reduce((sum, sku) => sum + (sku.availableAmount || 0), 0);
  const totalOrders = stats.ordersAmount || 0;
  const sellPrice = stats.sellPrice || 0;
  const fullPrice = stats.fullPrice || sellPrice;
  const estimatedRevenue = sellPrice * totalOrders;
  const discount = fullPrice > sellPrice ? Math.round((1 - sellPrice / fullPrice) * 100) : 0;
  
  // SKU table — faqat haqiqiy ma'lumotlar
  const skuRows = stats.skuList.map(sku => {
    const skuName = sku.characteristics.map(c => c.value).join(', ') || `SKU ${sku.id}`;
    const skuPrice = sku.sellPrice || 0;
    const skuFullPrice = sku.fullPrice || skuPrice;
    const skuDiscount = skuFullPrice > skuPrice ? Math.round((1 - skuPrice / skuFullPrice) * 100) : 0;
    
    return `
      <tr class="scx-sku-row">
        <td class="scx-sku-name">${skuName}</td>
        <td class="scx-sku-val">${formatUzumPrice(skuPrice)}</td>
        <td class="scx-sku-val">${skuFullPrice > skuPrice ? formatUzumPrice(skuFullPrice) : '—'}</td>
        <td class="scx-sku-val">${skuDiscount > 0 ? '-' + skuDiscount + '%' : '—'}</td>
        <td class="scx-sku-val scx-val-${sku.availableAmount > 0 ? 'green' : 'red'}">${sku.availableAmount ?? 0}</td>
        <td class="scx-sku-val" style="font-size:10px;color:#94a3b8">${sku.barcode || '—'}</td>
      </tr>
    `;
  }).join('');
  
  panel.innerHTML = `
    <div class="scx-pp-content">
      <!-- Data source badge -->
      <div class="scx-pp-source-badge">
        <span>📡 Manba: api.uzum.uz (rasmiy API)</span>
        <span class="scx-pp-source-verified">✅ Tasdiqlangan</span>
      </div>
      
      <!-- Summary cards — faqat haqiqiy ma'lumotlar -->
      <div class="scx-pp-summary">
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">Joriy narx</div>
          <div class="scx-pp-stat-value scx-val-green">${formatUzumPrice(sellPrice)}</div>
          <div class="scx-pp-stat-note">✅ API dan</div>
        </div>
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">Buyurtmalar (jami)</div>
          <div class="scx-pp-stat-value">${formatUzumNum(totalOrders)}</div>
          <div class="scx-pp-stat-note">⚠️ Umrbod — davr emas</div>
        </div>
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">Qoldiq (hozir)</div>
          <div class="scx-pp-stat-value scx-val-${totalStock > 0 ? 'green' : 'red'}">${formatUzumNum(totalStock)} шт</div>
          <div class="scx-pp-stat-note">✅ API dan</div>
        </div>
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">≈ Umumiy daromad</div>
          <div class="scx-pp-stat-value">${formatUzumNum(estimatedRevenue)}</div>
          <div class="scx-pp-stat-note">⚠️ Taxminiy (narx×buyurtma)</div>
        </div>
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">Reyting</div>
          <div class="scx-pp-stat-value">⭐ ${stats.rating?.toFixed(1) || '—'}</div>
          <div class="scx-pp-stat-note">✅ ${formatUzumNum(stats.reviewsAmount)} sharh</div>
        </div>
        <div class="scx-pp-stat">
          <div class="scx-pp-stat-label">Chegirma</div>
          <div class="scx-pp-stat-value">${discount > 0 ? '-' + discount + '%' : 'Yo\'q'}</div>
          <div class="scx-pp-stat-note">${discount > 0 ? formatUzumPrice(fullPrice) + ' → ' + formatUzumPrice(sellPrice) : '—'}</div>
        </div>
      </div>

      <!-- SKU Table — faqat API dagi ma'lumotlar -->
      <div class="scx-pp-table-wrap">
        <div class="scx-pp-table-title">📦 SKU tafsilotlari (${stats.skuList.length} ta)</div>
        <table class="scx-pp-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Narx</th>
              <th>Eski narx</th>
              <th>Chegirma</th>
              <th>Qoldiq</th>
              <th>Barcode</th>
            </tr>
          </thead>
          <tbody>
            ${skuRows}
          </tbody>
        </table>
      </div>

      <!-- Xususiyatlar -->
      ${stats.characteristics.length > 0 ? `
      <div class="scx-pp-chars">
        <div class="scx-pp-table-title">📋 Xususiyatlar</div>
        ${stats.characteristics.slice(0, 8).map(c => `
          <div class="scx-pp-char-row">
            <span class="scx-pp-char-label">${c.title}</span>
            <span class="scx-pp-char-value">${c.values.slice(0, 5).join(', ')}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- Ma'lumot ishonchliligi haqida ogohlantirish -->
      <div class="scx-pp-disclaimer">
        <strong>ℹ️ Ma'lumotlar haqida:</strong><br>
        • Narx, qoldiq, reyting, sharhlar — <strong>haqiqiy</strong> (Uzum API)<br>
        • Buyurtmalar soni — <strong>umrbod jami</strong> (30 kunlik emas!)<br>
        • Daromad — <strong>taxminiy</strong> (joriy narx × umumiy buyurtmalar)
      </div>
      
      <!-- Quick Actions -->
      <div class="scx-pp-actions">
        <button class="scx-pp-action-btn" id="scx-clone-btn">📋 Klonlash</button>
        <button class="scx-pp-action-btn" id="scx-save-btn">💾 Saqlash</button>
        <button class="scx-pp-action-btn scx-primary" id="scx-dashboard-btn">🌐 Dashboard</button>
      </div>
    </div>
  `;
  
  panel.querySelector('#scx-clone-btn')?.addEventListener('click', () => {
    window.open(`https://sellercloudx.com/seller-cloud?clone_source=uzum_market&clone_url=${encodeURIComponent(window.location.href)}`, '_blank');
  });
  panel.querySelector('#scx-save-btn')?.addEventListener('click', async () => {
    await scxSaveScrapedData('uzum_market', 'product_analysis', stats, window.location.href);
    scxShowToast('✅ Saqlandi!', 'success');
  });
  panel.querySelector('#scx-dashboard-btn')?.addEventListener('click', () => {
    window.open('https://sellercloudx.com/seller-cloud', '_blank');
  });
}

// ===== Shop Page — Seller Analytics =====
function injectShopPageAnalytics() {
  if (getPageType() !== 'shop') return;
  if (document.getElementById('scx-shop-analytics')) return;
  
  const shopSlug = getShopSlugFromUrl(window.location.href);
  if (!shopSlug) return;
  
  const panel = document.createElement('div');
  panel.id = 'scx-shop-analytics';
  panel.innerHTML = `
    <div class="scx-shop-panel">
      <div class="scx-shop-panel-header">
        <span class="scx-shop-panel-logo">📊</span>
        <span class="scx-shop-panel-brand">SellerCloudX</span>
        <span class="scx-shop-panel-period">Uzum API</span>
      </div>
      <div class="scx-shop-panel-body" id="scx-shop-body">
        <div class="scx-pp-loading">
          <div class="scx-spinner"></div>
          <span>Do'kon analitikasi yuklanmoqda...</span>
        </div>
      </div>
    </div>
  `;
  
  const sellerInfo = document.querySelector('[class*="seller-info"], [class*="SellerInfo"], [class*="shop-info"], [class*="ShopInfo"]');
  const h1 = document.querySelector('h1');
  const insertTarget = sellerInfo || h1;
  
  if (insertTarget) {
    insertTarget.parentElement.insertBefore(panel, insertTarget.nextSibling);
  } else {
    const mainContent = document.querySelector('main, [class*="content"], [class*="Content"]');
    if (mainContent) mainContent.prepend(panel);
  }
  
  loadShopAnalytics(shopSlug);
}

async function loadShopAnalytics(shopSlug) {
  const body = document.getElementById('scx-shop-body');
  if (!body) return;
  
  const stats = await fetchShopStats(shopSlug);
  const scrapedStats = scrapeShopPageData();
  const merged = { ...scrapedStats, ...(stats || {}) };
  
  body.innerHTML = `
    <div class="scx-shop-stats-grid">
      <div class="scx-shop-stat-card">
        <div class="scx-shop-stat-label">Buyurtmalar (jami)</div>
        <div class="scx-shop-stat-value">${formatUzumNum(merged.ordersCount || 0)} шт.</div>
        <div class="scx-shop-stat-source">✅ API</div>
      </div>
      <div class="scx-shop-stat-card">
        <div class="scx-shop-stat-label">Mahsulotlar soni</div>
        <div class="scx-shop-stat-value">${formatUzumNum(merged.productsCount || 0)}</div>
        <div class="scx-shop-stat-source">✅ API</div>
      </div>
      <div class="scx-shop-stat-card">
        <div class="scx-shop-stat-label">⭐ Reyting</div>
        <div class="scx-shop-stat-value">${merged.rating?.toFixed(1) || 'N/A'}</div>
        <div class="scx-shop-stat-source">${formatUzumNum(merged.reviewsCount || 0)} sharh</div>
      </div>
      <div class="scx-shop-stat-card">
        <div class="scx-shop-stat-label">📅 Uzumda</div>
        <div class="scx-shop-stat-value">${merged.registrationDate ? new Date(merged.registrationDate).toLocaleDateString('ru-RU') : 'N/A'}</div>
        <div class="scx-shop-stat-source">✅ API</div>
      </div>
    </div>
    <div class="scx-pp-disclaimer" style="margin-top:8px">
      ℹ️ Barcha ma'lumotlar Uzum rasmiy API-dan olingan. Daromad ko'rsatilmaydi — aniq ma'lumot mavjud emas.
    </div>
    <div class="scx-shop-actions">
      <button class="scx-pp-action-btn scx-primary" onclick="window.open('https://sellercloudx.com/seller-cloud','_blank')">
        📊 Dashboardda batafsil
      </button>
    </div>
  `;
  
  scxSaveScrapedData('uzum_market', 'shop_analysis', merged, window.location.href).catch(() => {});
}

function scrapeShopPageData() {
  const data = {};
  const allText = document.body.innerText;
  
  const ordersMatch = allText.match(/([\d\s]+)\s*заказ/i);
  if (ordersMatch) data.ordersCount = parseInt(ordersMatch[1].replace(/\s/g, ''));
  
  const ratingMatch = allText.match(/(\d[.,]\d)\s*\(/);
  if (ratingMatch) data.rating = parseFloat(ratingMatch[1].replace(',', '.'));
  
  const reviewsMatch = allText.match(/\(([\d\s]+)\s*отзыв/i);
  if (reviewsMatch) data.reviewsCount = parseInt(reviewsMatch[1].replace(/\s/g, ''));
  
  return data;
}

// ===== Formatters =====
function formatUzumNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' млрд';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' млн';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' тыс';
  return String(Math.round(n));
}

function formatUzumPrice(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' сум';
}

// ===== Toolbar =====
function initToolbar() {
  if (document.getElementById('scx-toolbar')) return;
  
  const toolbar = document.createElement('div');
  toolbar.id = 'scx-toolbar';
  toolbar.innerHTML = `
    <div class="scx-toolbar-inner">
      <div class="scx-toolbar-brand" title="SellerCloudX — Uzum Market (Haqiqiy ma'lumotlar)">
        <span class="scx-logo">🟣</span>
        <span class="scx-brand-text">SCX</span>
        <span class="scx-status-dot" id="scx-conn-dot"></span>
      </div>
      <div class="scx-toolbar-actions">
        <button class="scx-tb-btn" id="scx-btn-refresh" title="Yangilash">🔄</button>
        <button class="scx-tb-btn" id="scx-btn-dashboard" title="Dashboard">🌐</button>
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
  document.getElementById('scx-btn-refresh')?.addEventListener('click', () => {
    document.querySelectorAll('.scx-card-stats, #scx-product-analytics-btn, #scx-shop-analytics, #scx-product-panel').forEach(el => el.remove());
    initPage();
    scxShowToast('🔄 Yangilandi', 'info');
  });
  
  chrome.runtime.sendMessage({ type: 'SCX_STATUS' }, (r) => {
    const dot = document.getElementById('scx-conn-dot');
    if (dot) {
      dot.style.background = r?.isConnected ? '#22c55e' : '#ef4444';
      dot.style.boxShadow = r?.isConnected ? '0 0 6px #22c55e88' : '0 0 6px #ef444488';
    }
  });
}

// ===== Main Init =====
function initPage() {
  const pageType = getPageType();
  console.log(`[SCX] Page type: ${pageType}`);
  
  if (pageType === 'home' || pageType === 'catalog' || pageType === 'other') {
    injectCatalogOverlays();
  }
  if (pageType === 'product') {
    injectProductPageAnalytics();
    injectCatalogOverlays();
  }
  if (pageType === 'shop') {
    injectShopPageAnalytics();
    injectCatalogOverlays();
  }
}

function init() {
  initToolbar();
  setTimeout(initPage, 2000);
  
  scxObserveNavigation(() => {
    setTimeout(initPage, 1500);
  });
  
  const scrollObserver = new MutationObserver(() => {
    const pageType = getPageType();
    if (pageType === 'home' || pageType === 'catalog' || pageType === 'other') {
      injectCatalogOverlays();
    }
  });
  scrollObserver.observe(document.body, { childList: true, subtree: true });
}

setTimeout(init, 1500);
