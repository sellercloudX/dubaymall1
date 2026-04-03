/**
 * SellerCloudX Content Script — Uzum Market v5.0
 * uzum.uz uchun — DOM Scraping (GraphQL API ga o'tgani uchun eski REST ishlamaydi)
 */

console.log('[SCX v5.0] Uzum Market content script loaded (DOM Scraping)');

const DASHBOARD_BASE = 'https://sellercloudx.lovable.app';

function getPageType() {
  const path = window.location.pathname;
  if (path.match(/\/product\//)) return 'product';
  if (path.match(/\/shop\//)) return 'shop';
  if (path.match(/\/category\/|\/search|\/catalogues/)) return 'catalog';
  if (path === '/' || path.match(/^\/(ru|uz)\/?$/)) return 'home';
  return 'other';
}

function getProductIdFromUrl(url) {
  const m = url.match(/product\/[^?]*?-(\d+)/);
  return m ? m[1] : null;
}

// ===== DOM Scraping =====
function scrapeProductPage() {
  const d = { _source: 'dom_scraping', _ts: new Date().toISOString() };
  const txt = document.body.innerText;
  const h1 = document.querySelector('h1');
  if (h1) d.title = h1.textContent.trim();

  // Price
  const pEls = document.querySelectorAll('[class*="rice"], [class*="cost"]');
  for (const el of pEls) {
    const m = el.textContent.match(/([\d\s]{3,})\s*сум/);
    if (m) { d.sellPrice = parseInt(m[1].replace(/\s/g, '')); break; }
  }
  if (!d.sellPrice) { const m = txt.match(/([\d\s]{4,})\s*сум/); if (m) d.sellPrice = parseInt(m[1].replace(/\s/g, '')); }

  // Orders
  const om = txt.match(/([\d\s]+)\+?\s*заказ/i);
  if (om) d.ordersAmount = parseInt(om[1].replace(/[\s+]/g, ''));

  // Rating & reviews
  const rm = txt.match(/(\d[.,]\d)\s*\([\d\s]+отзыв/i);
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

  // Old price
  for (const el of document.querySelectorAll('del, s, [class*="old"], [class*="cross"]')) {
    const m = el.textContent.match(/([\d\s]+)\s*сум?/);
    if (m) { const op = parseInt(m[1].replace(/\s/g, '')); if (op > (d.sellPrice||0)) { d.fullPrice = op; break; } }
  }

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
  const dm = txt.match(/Продавец на Uzum с\s*(.+?)\s*г?\./i);
  if (dm) d.registrationText = dm[1].trim();
  return d;
}

// ===== Formatters =====
function fN(n) { if(n==null||isNaN(n)) return '—'; if(n>=1e9) return (n/1e9).toFixed(1)+' млрд'; if(n>=1e6) return (n/1e6).toFixed(1)+' млн'; if(n>=1e3) return (n/1e3).toFixed(1)+' тыс'; return String(Math.round(n)); }
function fP(n) { if(n==null) return '—'; return new Intl.NumberFormat('uz-UZ').format(Math.round(n))+' сум'; }

// ===== Product Page Analytics =====
function injectProductPageAnalytics() {
  if (getPageType() !== 'product') return;
  if (document.getElementById('scx-product-analytics-btn')) return;
  const productId = getProductIdFromUrl(window.location.href);
  if (!productId) return;

  const wait = () => {
    const h1 = document.querySelector('h1');
    if (!h1) { setTimeout(wait, 500); return; }

    const btn = document.createElement('div');
    btn.id = 'scx-product-analytics-btn';
    btn.style.cssText = 'margin:10px 0;';
    btn.innerHTML = '<div class="scx-analytics-trigger"><span class="scx-analytics-trigger-logo">📊</span><span class="scx-analytics-trigger-brand">SellerCloudX</span><span class="scx-analytics-trigger-text">Analitika</span><span class="scx-analytics-trigger-arrow" id="scx-analytics-arrow">▼</span></div>';

    const bc = document.querySelector('nav[aria-label], [class*="breadcrumb"]');
    const target = bc || h1;
    if (target && target.parentElement) target.parentElement.insertBefore(btn, target.nextSibling);

    let open = false;
    btn.querySelector('.scx-analytics-trigger').addEventListener('click', () => {
      open = !open;
      const arrow = document.getElementById('scx-analytics-arrow');
      if (arrow) arrow.textContent = open ? '▲' : '▼';
      if (open) showProductPanel(productId, btn);
      else document.getElementById('scx-product-panel')?.remove();
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
    <div class="scx-pp-source-badge"><span>📡 Manba: uzum.uz (DOM Scraping)</span><span class="scx-pp-source-verified">✅ Haqiqiy</span></div>
    <div class="scx-pp-summary">
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Narx</div><div class="scx-pp-stat-value scx-val-green">${fP(price)}</div><div class="scx-pp-stat-note">${disc > 0 ? '🏷 -'+disc+'%' : '✅ Sahifadan'}</div></div>
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Buyurtmalar</div><div class="scx-pp-stat-value">${orders > 0 ? fN(orders) : '—'}</div><div class="scx-pp-stat-note">${orders > 0 ? '⚠️ Umrbod' : '—'}</div></div>
      <div class="scx-pp-stat"><div class="scx-pp-stat-label">Reyting</div><div class="scx-pp-stat-value">⭐ ${s.rating?.toFixed(1)||'—'}</div><div class="scx-pp-stat-note">${s.reviewsAmount ? fN(s.reviewsAmount)+' sharh' : '—'}</div></div>
      ${s.availableStock != null ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">Qoldiq</div><div class="scx-pp-stat-value scx-val-${s.availableStock>0?'green':'red'}">${s.availableStock} шт</div><div class="scx-pp-stat-note">✅ Sahifadan</div></div>` : ''}
      ${s.weeklyBuyers ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">Haftalik</div><div class="scx-pp-stat-value">${fN(s.weeklyBuyers)}</div><div class="scx-pp-stat-note">✅ Sahifadan</div></div>` : ''}
      ${rev > 0 ? `<div class="scx-pp-stat"><div class="scx-pp-stat-label">≈ Daromad</div><div class="scx-pp-stat-value">${fN(rev)}</div><div class="scx-pp-stat-note">⚠️ Taxminiy</div></div>` : ''}
    </div>
    ${s.seller ? `<div style="padding:8px 14px;font-size:12px;border-top:1px solid #f3f4f6">🏪 <strong>Do'kon:</strong> <a href="${s.sellerUrl||'#'}" style="color:#7c3aed;font-weight:600;text-decoration:none">${s.seller}</a></div>` : ''}
    <div class="scx-pp-disclaimer"><strong>ℹ️ Ma'lumotlar haqida:</strong><br>• Narx, reyting, qoldiq — <strong>haqiqiy</strong> (sahifadan)<br>• Buyurtmalar — <strong>umrbod jami</strong><br>${rev > 0 ? '• Daromad — <strong>taxminiy</strong><br>' : ''}</div>
    <div class="scx-pp-actions">
      <button class="scx-pp-action-btn" id="scx-save-btn">💾 Saqlash</button>
      <button class="scx-pp-action-btn scx-primary" id="scx-dashboard-btn">🌐 Dashboard</button>
    </div>
  </div>`;
  anchor.appendChild(panel);

  panel.querySelector('#scx-save-btn')?.addEventListener('click', async () => {
    await scxSaveScrapedData('uzum_market', 'product_analysis', { productId, ...s, estimatedRevenue: rev }, window.location.href);
    scxShowToast('✅ Saqlandi!', 'success');
  });
  panel.querySelector('#scx-dashboard-btn')?.addEventListener('click', () => {
    window.open(DASHBOARD_BASE + '/seller-cloud#clone', '_blank');
  });
}

// ===== Shop Page Analytics =====
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
          <div class="scx-shop-stat-card"><div class="scx-shop-stat-label">Buyurtmalar</div><div class="scx-shop-stat-value">${fN(s.ordersCount||0)}</div><div class="scx-shop-stat-source">✅ Sahifadan</div></div>
          <div class="scx-shop-stat-card"><div class="scx-shop-stat-label">⭐ Reyting</div><div class="scx-shop-stat-value">${s.rating?.toFixed(1)||'N/A'}</div><div class="scx-shop-stat-source">${fN(s.reviewsCount||0)} sharh</div></div>
          ${s.registrationText ? `<div class="scx-shop-stat-card"><div class="scx-shop-stat-label">📅 Uzumda</div><div class="scx-shop-stat-value" style="font-size:12px">${s.registrationText}</div><div class="scx-shop-stat-source">✅ Sahifadan</div></div>` : ''}
        </div>
        <div class="scx-pp-disclaimer" style="margin-top:8px">ℹ️ Ma'lumotlar sahifadan o'qilgan.</div>
        <div class="scx-shop-actions"><button class="scx-pp-action-btn scx-primary" id="scx-shop-dash-btn">📊 Dashboard</button></div>
      </div>
    </div>`;
    if (h1.parentElement) h1.parentElement.insertBefore(panel, h1.nextSibling);
    panel.querySelector('#scx-shop-dash-btn')?.addEventListener('click', () => { window.open(DASHBOARD_BASE + '/seller-cloud', '_blank'); });
    scxSaveScrapedData('uzum_market', 'shop_analysis', s, window.location.href).catch(() => {});
  };
  wait();
}

// ===== Catalog — Minimal badges =====
function injectCatalogBadges() {
  const links = document.querySelectorAll('a[href*="/product/"]');
  const done = new Set();
  links.forEach(link => {
    if (done.has(link.href)) return;
    done.add(link.href);
    let card = link.closest('[class*="Card"], [class*="card"], [class*="product"]') || link.parentElement;
    if (!card || card.querySelector('.scx-card-mini')) return;
    const txt = card.innerText || '';
    const rm = txt.match(/(\d[.,]\d)\s*\(/);
    const rvm = txt.match(/\(([\d\s]+)\s*отзыв/i);
    if (!rm && !rvm) return;
    const b = document.createElement('div');
    b.className = 'scx-card-mini';
    b.style.cssText = 'display:flex!important;align-items:center!important;gap:3px!important;padding:3px 6px!important;font-size:10px!important;background:rgba(124,58,237,0.06)!important;border-top:1px solid rgba(124,58,237,0.12)!important;font-family:-apple-system,system-ui,sans-serif!important;';
    b.innerHTML = `<span style="font-size:10px">📊</span><span style="flex:1;color:#374151;font-weight:500">${rm ? '⭐'+parseFloat(rm[1].replace(',','.')).toFixed(1) : ''} ${rvm ? '('+fN(parseInt(rvm[1].replace(/\s/g,'')))+')' : ''}</span><span style="font-size:8px;font-weight:800;color:#7c3aed;background:rgba(124,58,237,0.08);padding:1px 4px;border-radius:3px">SCX</span>`;
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
  console.log('[SCX v5] Page:', pt);
  if (pt === 'product') injectProductPageAnalytics();
  if (pt === 'shop') injectShopPageAnalytics();
  injectCatalogBadges();
}

function init() {
  initToolbar();
  setTimeout(initPage, 2500);
  scxObserveNavigation(() => {
    document.querySelectorAll('#scx-product-analytics-btn, #scx-shop-analytics, #scx-product-panel, .scx-card-mini').forEach(e => e.remove());
    setTimeout(initPage, 2000);
  });
  let t = null;
  new MutationObserver(() => { if (t) clearTimeout(t); t = setTimeout(injectCatalogBadges, 800); }).observe(document.body, { childList: true, subtree: true });
}

setTimeout(init, 1500);
