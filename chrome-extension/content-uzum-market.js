/**
 * SellerCloudX Content Script — Uzum Market v6.0
 * uzum.uz — DOM Scraping + Competitor Cloning
 */

console.log('[SCX v6.0] Uzum Market content script loaded');

const DASHBOARD_BASE = 'https://sellercloudx.com';
const MAX_REASONABLE_PRICE_UZS = 500000000;

function normalizeUzumMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 100 && rounded <= MAX_REASONABLE_PRICE_UZS ? rounded : 0;
  }

  const text = String(value || '').replace(/\u00A0/g, ' ');
  const direct = Number(text.replace(/[^\d]/g, ''));
  if (Number.isFinite(direct) && direct >= 100 && direct <= MAX_REASONABLE_PRICE_UZS) return Math.round(direct);

  return 0;
}

function parseUzumPrice(text) {
  const normalizedText = String(text || '').replace(/\u00A0/g, ' ');
  const match = normalizedText.match(/\b(\d{1,3}(?:[\s,]\d{3}){1,3}|\d{4,9})\s*(?:сум|so['’`]?m)\b/i);
  return normalizeUzumMoney(match?.[1] || '');
}

function normalizeProductImageUrl(url) {
  return String(url || '')
    .replace(/\/t_product_\d+/i, '/t_product_540')
    .replace(/\/w_\d+/i, '/w_540');
}

function isLikelyProductImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('/baner/') ||
    lower.includes('/banner') ||
    lower.includes('/banners/') ||
    lower.includes('badge-icon') ||
    lower.includes('placeholder') ||
    lower.includes('/icons/') ||
    lower.includes('static.uzum.uz')
  ) {
    return false;
  }
  return lower.includes('images.uzum.uz') || lower.includes('/t_product_') || lower.includes('/w_');
}

// ===== Page Detection =====
function getPageType() {
  const path = window.location.pathname;
  if (path.match(/\/product\//)) return 'product';
  if (path.match(/\/shop\//)) return 'shop';
  if (path.match(/\/category\/|\/search|\/catalogues/)) return 'catalog';
  return 'other';
}

function getProductIdFromUrl(url) {
  const m = (url || window.location.href).match(/product\/[^?]*?-(\d+)/);
  return m ? m[1] : null;
}

// ===== DOM Scraping =====
function scrapeProductPage() {
  const d = { _source: 'dom_scraping', _ts: new Date().toISOString() };
  const txt = document.body.innerText;

  // Title
  const h1 = document.querySelector('h1');
  if (h1) d.title = h1.textContent.trim();

  // Price — look for price elements
  const priceEls = document.querySelectorAll('[class*="rice"], [class*="cost"], [class*="Price"]');
  for (const el of priceEls) {
    const candidate = parseUzumPrice(el.textContent || '');
    if (candidate) {
      d.sellPrice = candidate;
      break;
    }
  }
  if (!d.sellPrice) {
    const candidate = parseUzumPrice(txt);
    if (candidate) d.sellPrice = candidate;
  }
  if (d.sellPrice) d.price = d.sellPrice;

  // Orders
  const om = txt.match(/([\d\s]+)\+?\s*заказ/i);
  if (om) d.ordersAmount = parseInt(om[1].replace(/[\s+]/g, ''));

  // Rating & reviews
  const rm = txt.match(/(\d[.,]\d)\s*\([\d\s]+\s*отзыв/i);
  if (rm) d.rating = parseFloat(rm[1].replace(',', '.'));
  const rvm = txt.match(/\(([\d\s]+)\s*отзыв/i);
  if (rvm) d.reviewsAmount = parseInt(rvm[1].replace(/\s/g, ''));

  // Weekly buyers
  const wm = txt.match(/([\d\s]+)\s*человек\s*купил/i);
  if (wm) d.weeklyBuyers = parseInt(wm[1].replace(/\s/g, ''));

  // Stock
  const sm = txt.match(/Можно\s*купить\s*(\d+)\s*шт/i);
  if (sm) d.availableStock = parseInt(sm[1]);

  // Seller
  const sl = document.querySelector('a[href*="/shop/"]');
  if (sl) { d.seller = sl.textContent.trim(); d.sellerUrl = sl.href; }

  // Old price (discount)
  for (const el of document.querySelectorAll('del, s, [class*="old"], [class*="cross"]')) {
    const op = parseUzumPrice(el.textContent || '');
    if (op > (d.sellPrice || 0)) { d.fullPrice = op; break; }
  }

  // Images
  d.images = [];
  const pushImage = (src) => {
    const normalized = normalizeProductImageUrl(src);
    if (isLikelyProductImageUrl(normalized) && !d.images.includes(normalized) && d.images.length < 15) {
      d.images.push(normalized);
    }
  };
  document.querySelectorAll('img[src], img[data-src]').forEach(img => {
    pushImage(img.currentSrc || img.src || img.dataset.src);
  });

  // Description
  const descEl = document.querySelector('[class*="escription"], [class*="detail-text"], [class*="product-info"]');
  if (descEl) d.description = descEl.textContent.trim().substring(0, 2000);

  // Characteristics
  d.characteristics = [];
  document.querySelectorAll('[class*="haracter"] tr, [class*="spec"] tr, [class*="attribute"] [class*="row"]').forEach(row => {
    const cells = row.querySelectorAll('td, span, div');
    if (cells.length >= 2) {
      const name = cells[0].textContent.trim();
      const value = cells[1].textContent.trim();
      if (name && value && name.length < 100) d.characteristics.push({ name, value });
    }
  });

  // Brand from characteristics
  const brandChar = d.characteristics.find(c => /бренд|brand|торговая\s*марка/i.test(c.name));
  if (brandChar) d.brand = brandChar.value;

  // Category from breadcrumbs
  d.breadcrumbs = [];
  document.querySelectorAll('nav[aria-label] a, [class*="breadcrumb"] a').forEach(a => {
    const text = a.textContent.trim();
    if (text && text !== 'Главная' && text !== 'Bosh sahifa') d.breadcrumbs.push(text);
  });
  if (d.breadcrumbs.length > 0) d.category = d.breadcrumbs[d.breadcrumbs.length - 1];

  return d;
}

function scrapeShopPage() {
  const d = { _source: 'dom_scraping' };
  const txt = document.body.innerText;
  const h1 = document.querySelector('h1');
  if (h1) d.title = h1.textContent.trim();
  const om = txt.match(/([\d\s]+)\s*заказ/i);
  if (om) d.ordersCount = parseInt(om[1].replace(/\s/g, ''));
  const rm = txt.match(/(\d[.,]\d)\s*\(/);
  if (rm) d.rating = parseFloat(rm[1].replace(',', '.'));
  const rvm = txt.match(/\(([\d\s]+)\s*отзыв/i);
  if (rvm) d.reviewsCount = parseInt(rvm[1].replace(/\s/g, ''));
  return d;
}

// ===== Formatters =====
function fN(n) { if (n == null || isNaN(n)) return '—'; if (n >= 1e9) return (n / 1e9).toFixed(1) + ' млрд'; if (n >= 1e6) return (n / 1e6).toFixed(1) + ' млн'; if (n >= 1e3) return (n / 1e3).toFixed(1) + ' тыс'; return String(Math.round(n)); }
function fP(n) { if (n == null) return '—'; return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' сум'; }

// ===== Product Page — Analytics + Clone =====
function injectProductPageAnalytics() {
  if (getPageType() !== 'product') return;
  if (document.getElementById('scx-product-analytics-btn')) return;
  const productId = getProductIdFromUrl();
  if (!productId) return;

  const wait = () => {
    const h1 = document.querySelector('h1');
    if (!h1) { setTimeout(wait, 500); return; }

    const container = document.createElement('div');
    container.id = 'scx-product-analytics-btn';
    container.style.cssText = 'margin:10px 0;';

    // Two buttons: Analytics + Clone
    container.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <div class="scx-analytics-trigger" id="scx-trigger-analytics">
          <span class="scx-analytics-trigger-logo">📊</span>
          <span class="scx-analytics-trigger-brand">SCX</span>
          <span class="scx-analytics-trigger-text">Analitika</span>
          <span class="scx-analytics-trigger-arrow" id="scx-analytics-arrow">▼</span>
        </div>
        <div class="scx-analytics-trigger" id="scx-trigger-clone" style="border-color:#059669 !important;">
          <span class="scx-analytics-trigger-logo">📋</span>
          <span style="font-size:12px!important;font-weight:800!important;color:#059669!important;">Klonlash</span>
          <span class="scx-analytics-trigger-text">O'z do'konimga</span>
        </div>
      </div>
    `;

    const bc = document.querySelector('nav[aria-label], [class*="breadcrumb"]');
    const target = bc || h1;
    if (target && target.parentElement) target.parentElement.insertBefore(container, target.nextSibling);

    // Analytics toggle
    let analyticsOpen = false;
    container.querySelector('#scx-trigger-analytics').addEventListener('click', () => {
      analyticsOpen = !analyticsOpen;
      const arrow = document.getElementById('scx-analytics-arrow');
      if (arrow) arrow.textContent = analyticsOpen ? '▲' : '▼';
      if (analyticsOpen) showProductPanel(productId, container);
      else document.getElementById('scx-product-panel')?.remove();
    });

    // Clone button
    container.querySelector('#scx-trigger-clone').addEventListener('click', async () => {
      scxShowToast('📋 Ma\'lumotlar yig\'ilmoqda...', 'info');
      const scraped = scrapeProductPage();
      scraped.productId = productId;
      scraped.sourceUrl = window.location.href;

      // Save to marketplace_scraped_data
      await scxSaveScrapedData('uzum_market', 'competitor_product', scraped, window.location.href);
      scxShowToast('✅ Saqlandi! Dashboard ochilmoqda...', 'success');

      // Open dashboard with clone params in URL search (not hash)
      setTimeout(() => {
        window.open(
          `${DASHBOARD_BASE}/seller-cloud#clone?source=uzum_market&productId=${productId}`,
          '_blank'
        );
      }, 500);
    });
  };
  wait();
}

function showProductPanel(productId, anchor) {
  document.getElementById('scx-product-panel')?.remove();
  const s = scrapeProductPage();
  const price = s.sellPrice || 0;
  const orders = s.ordersAmount || 0;
  const rev = price > 0 && orders > 0 ? price * orders : 0;
  const disc = (s.fullPrice && s.fullPrice > price) ? Math.round((1 - price / s.fullPrice) * 100) : 0;

  const panel = document.createElement('div');
  panel.id = 'scx-product-panel';
  panel.innerHTML = `<div class="scx-pp-content">
    <div class="scx-pp-source-badge"><span>📡 Manba: uzum.uz (DOM)</span><span class="scx-pp-source-verified">✅ Haqiqiy</span></div>
    <div class="scx-pp-summary">
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Narx</div><div class="scx-pp-stat-value scx-val-green">${fP(price)}</div><div class="scx-pp-stat-note">${disc > 0 ? '🏷 -' + disc + '%' : '✅ Sahifadan'}</div></div>
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Buyurtmalar</div><div class="scx-pp-stat-value">${orders > 0 ? fN(orders) : '—'}</div><div class="scx-pp-stat-note">${orders > 0 ? '⚠️ Umrbod' : '—'}</div></div>
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Reyting</div><div class="scx-pp-stat-value">⭐ ${s.rating?.toFixed(1) || '—'}</div><div class="scx-pp-stat-note">${s.reviewsAmount ? fN(s.reviewsAmount) + ' sharh' : '—'}</div></div>
      ${s.availableStock != null ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">Qoldiq</div><div class="scx-pp-stat-value scx-val-${s.availableStock > 0 ? 'green' : 'red'}">${s.availableStock} шт</div><div class="scx-pp-stat-note">✅ Sahifadan</div></div>` : ''}
      ${s.weeklyBuyers ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">Haftalik</div><div class="scx-pp-stat-value">${fN(s.weeklyBuyers)}</div><div class="scx-pp-stat-note">✅ Sahifadan</div></div>` : ''}
      ${rev > 0 ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">≈ Daromad</div><div class="scx-pp-stat-value">${fN(rev)}</div><div class="scx-pp-stat-note">⚠️ Taxminiy</div></div>` : ''}
    </div>
    ${s.images && s.images.length > 0 ? `<div style="padding:8px 14px;font-size:11px;color:#059669;border-top:1px solid #f3f4f6">📷 ${s.images.length} ta rasm topildi</div>` : ''}
    ${s.characteristics && s.characteristics.length > 0 ? `<div style="padding:8px 14px;font-size:11px;color:#6b7280;border-top:1px solid #f3f4f6">📋 ${s.characteristics.length} ta xususiyat</div>` : ''}
    ${s.seller ? `<div style="padding:8px 14px;font-size:12px;border-top:1px solid #f3f4f6">🏪 <strong>Do'kon:</strong> <a href="${s.sellerUrl || '#'}" style="color:#7c3aed;font-weight:600;text-decoration:none">${s.seller}</a></div>` : ''}
    <div class="scx-pp-disclaimer"><strong>ℹ️ Ma'lumotlar haqida:</strong><br>• Narx, reyting, qoldiq — <strong>haqiqiy</strong> (sahifadan)<br>• Buyurtmalar — <strong>umrbod jami</strong></div>
    <div class="scx-pp-actions">
      <button class="scx-pp-action-btn" id="scx-save-btn">💾 Saqlash</button>
      <button class="scx-pp-action-btn scx-primary" id="scx-clone-panel-btn">📋 Klonlash</button>
    </div>
  </div>`;
  anchor.appendChild(panel);

  panel.querySelector('#scx-save-btn')?.addEventListener('click', async () => {
    await scxSaveScrapedData('uzum_market', 'product_analysis', { productId, ...s }, window.location.href);
    scxShowToast('✅ Saqlandi!', 'success');
  });
  panel.querySelector('#scx-clone-panel-btn')?.addEventListener('click', async () => {
    const scraped = scrapeProductPage();
    scraped.productId = productId;
    scraped.sourceUrl = window.location.href;
    await scxSaveScrapedData('uzum_market', 'competitor_product', scraped, window.location.href);
    scxShowToast('✅ Dashboard ochilmoqda...', 'success');
    window.open(`${DASHBOARD_BASE}/seller-cloud#clone?source=uzum_market&productId=${productId}`, '_blank');
  });
}

// ===== Shop Page =====
function injectShopPageAnalytics() {
  if (getPageType() !== 'shop') return;
  if (document.getElementById('scx-shop-analytics')) return;

  const wait = () => {
    const h1 = document.querySelector('h1');
    if (!h1) { setTimeout(wait, 500); return; }
    const s = scrapeShopPage();
    const panel = document.createElement('div');
    panel.id = 'scx-shop-analytics';
    panel.innerHTML = `<div class="scx-shop-panel">
      <div class="scx-shop-panel-header"><span class="scx-shop-panel-logo">📊</span><span class="scx-shop-panel-brand">SellerCloudX</span><span class="scx-shop-panel-period">Sahifadan</span></div>
      <div class="scx-shop-panel-body">
        <div class="scx-shop-stats-grid">
          <div class="scx-shop-stat-card"><div class="scx-shop-stat-label">Buyurtmalar</div><div class="scx-shop-stat-value">${fN(s.ordersCount || 0)}</div><div class="scx-shop-stat-source">✅ Sahifadan</div></div>
          <div class="scx-shop-stat-card"><div class="scx-shop-stat-label">⭐ Reyting</div><div class="scx-shop-stat-value">${s.rating?.toFixed(1) || 'N/A'}</div><div class="scx-shop-stat-source">${fN(s.reviewsCount || 0)} sharh</div></div>
        </div>
        <div class="scx-pp-disclaimer" style="margin-top:8px">ℹ️ Ma'lumotlar sahifadan o'qilgan.</div>
        <div class="scx-shop-actions"><button class="scx-pp-action-btn scx-primary" id="scx-shop-dash-btn">📊 Dashboard</button></div>
      </div>
    </div>`;
    if (h1.parentElement) h1.parentElement.insertBefore(panel, h1.nextSibling);
    panel.querySelector('#scx-shop-dash-btn')?.addEventListener('click', () => { window.open(DASHBOARD_BASE + '/seller-cloud', '_blank'); });
    scxSaveScrapedData('uzum_market', 'shop_analysis', s, window.location.href).catch(() => { });
  };
  wait();
}

// ===== Catalog Badges =====
function injectCatalogBadges() {
  const links = document.querySelectorAll('a[href*="/product/"]');
  const done = new Set();
  links.forEach(link => {
    if (done.has(link.href)) return;
    done.add(link.href);
    let card = link.closest('[class*="Card"], [class*="card"], [class*="product"]') || link.parentElement;
    if (!card || card.querySelector('.scx-card-mini')) return;
    const b = document.createElement('div');
    b.className = 'scx-card-mini';
    b.style.cssText = 'display:flex!important;align-items:center!important;gap:3px!important;padding:3px 6px!important;font-size:10px!important;background:rgba(124,58,237,0.06)!important;border-top:1px solid rgba(124,58,237,0.12)!important;font-family:-apple-system,system-ui,sans-serif!important;cursor:pointer!important;';
    b.innerHTML = `<span style="font-size:10px">📋</span><span style="flex:1;color:#374151;font-weight:500">Klonlash</span><span style="font-size:8px;font-weight:800;color:#7c3aed;background:rgba(124,58,237,0.08);padding:1px 4px;border-radius:3px">SCX</span>`;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Navigate to product page where full clone flow happens
      window.open(link.href, '_blank');
    });
    card.appendChild(b);
  });
}

// ===== Toolbar =====
function initToolbar() {
  if (document.getElementById('scx-toolbar')) return;
  scxCreateToolbar('Uzum Market', '🟣');
}

// ===== Main =====
function initPage() {
  const pt = getPageType();
  console.log('[SCX v6] Page:', pt);
  if (pt === 'product') injectProductPageAnalytics();
  if (pt === 'shop') injectShopPageAnalytics();
  injectCatalogBadges();
}

function init() {
  initToolbar();
  setTimeout(initPage, 2000);
  scxObserveNavigation(() => {
    document.querySelectorAll('#scx-product-analytics-btn, #scx-shop-analytics, #scx-product-panel, .scx-card-mini').forEach(e => e.remove());
    setTimeout(initPage, 1500);
  });
  let t = null;
  new MutationObserver(() => { if (t) clearTimeout(t); t = setTimeout(injectCatalogBadges, 800); }).observe(document.body, { childList: true, subtree: true });
}

setTimeout(init, 1500);
