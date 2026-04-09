/**
 * SellerCloudX Content Script — Uzum Market v7.0
 * uzum.uz — Faqat Klonlash (Clone Only)
 * Statistika va analitika olib tashlandi
 */

console.log('[SCX v7.0] Uzum Market content script loaded — Clone Only');

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
  const match = normalizedText.match(/\b(\d{1,3}(?:[\s,]\d{3}){1,3}|\d{4,9})\s*(?:сум|so[''`]?m)\b/i);
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
    lower.includes('/baner/') || lower.includes('/banner') || lower.includes('/banners/') ||
    lower.includes('badge-icon') || lower.includes('placeholder') || lower.includes('/icons/') ||
    lower.includes('static.uzum.uz') || lower.includes('/promo/') || lower.includes('/logo') ||
    lower.includes('favicon') || lower.includes('/user-avatar') || lower.includes('/seller-logo') ||
    lower.includes('/category-icon')
  ) return false;
  return lower.includes('images.uzum.uz') && (lower.includes('/t_product_') || lower.includes('/original'));
}

// ===== Page Detection =====
function getPageType() {
  const path = window.location.pathname;
  if (path.match(/\/product\//)) return 'product';
  if (path.match(/\/category\/|\/search|\/catalogues/)) return 'catalog';
  return 'other';
}

function getProductIdFromUrl(url) {
  const m = (url || window.location.href).match(/product\/[^?]*?-(\d+)/);
  return m ? m[1] : null;
}

// ===== DOM Scraping (for clone data) =====
function scrapeProductPage() {
  const d = { _source: 'dom_scraping', _ts: new Date().toISOString() };
  const txt = document.body.innerText;

  const h1 = document.querySelector('h1');
  if (h1) d.title = h1.textContent.trim();

  // Price
  const priceEls = document.querySelectorAll('[class*="rice"], [class*="cost"], [class*="Price"]');
  for (const el of priceEls) {
    const candidate = parseUzumPrice(el.textContent || '');
    if (candidate) { d.sellPrice = candidate; break; }
  }
  if (!d.sellPrice) { const c = parseUzumPrice(txt); if (c) d.sellPrice = c; }
  if (d.sellPrice) d.price = d.sellPrice;

  // Old price
  for (const el of document.querySelectorAll('del, s, [class*="old"], [class*="cross"]')) {
    const op = parseUzumPrice(el.textContent || '');
    if (op > (d.sellPrice || 0)) { d.fullPrice = op; break; }
  }

  // Seller
  const sl = document.querySelector('a[href*="/shop/"]');
  if (sl) { d.seller = sl.textContent.trim(); d.sellerUrl = sl.href; }

  // Images
  d.images = [];
  const pushImage = (src) => {
    const normalized = normalizeProductImageUrl(src);
    if (isLikelyProductImageUrl(normalized) && !d.images.includes(normalized) && d.images.length < 15) {
      d.images.push(normalized);
    }
  };

  // JSON-LD
  try {
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldScripts) {
      try {
        const ld = JSON.parse(script.textContent);
        const graph = ld['@graph'] || [ld];
        for (const item of graph) {
          if (item['@type'] === 'Product' || item['@type'] === 'ProductGroup') {
            const ldImages = Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []);
            ldImages.forEach(url => {
              const hq = String(url).replace('/t_product_low.jpg', '/t_product_540_high.jpg').replace('/original.jpg', '/t_product_540_high.jpg');
              pushImage(hq);
            });
            if (!d.title && item.name) d.title = String(item.name).trim();
            if (!d.description && item.description) d.description = String(item.description).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim().substring(0, 2000);
          }
        }
      } catch {}
    }
  } catch {}

  // Gallery fallback
  if (d.images.length === 0) {
    const gallerySelectors = ['.slider img', '.swiper img', '[class*="gallery"] img', '[class*="Gallery"] img', '[class*="slider"] img', '[class*="carousel"] img', '[class*="product-image"] img'];
    for (const sel of gallerySelectors) {
      document.querySelectorAll(sel).forEach(img => pushImage(img.currentSrc || img.src || img.dataset.src));
      if (d.images.length > 0) break;
    }
  }
  if (d.images.length === 0) {
    document.querySelectorAll('img[src], img[data-src]').forEach(img => pushImage(img.currentSrc || img.src || img.dataset.src));
  }

  // Description
  if (!d.description) {
    const descEl = document.querySelector('[class*="escription"], [class*="detail-text"], [class*="product-info"]');
    if (descEl) d.description = descEl.textContent.trim().substring(0, 2000);
  }

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

  // Brand
  const brandChar = d.characteristics.find(c => /бренд|brand|торговая\s*марка/i.test(c.name));
  if (brandChar) d.brand = brandChar.value;

  // Breadcrumbs
  d.breadcrumbs = [];
  document.querySelectorAll('nav[aria-label] a, [class*="breadcrumb"] a').forEach(a => {
    const text = a.textContent.trim();
    if (text && text !== 'Главная' && text !== 'Bosh sahifa') d.breadcrumbs.push(text);
  });
  if (d.breadcrumbs.length > 0) d.category = d.breadcrumbs[d.breadcrumbs.length - 1];

  return d;
}

// ===== Product Page — Clone Button Only =====
function injectCloneButton() {
  if (getPageType() !== 'product') return;
  if (document.getElementById('scx-clone-btn-container')) return;
  const productId = getProductIdFromUrl();
  if (!productId) return;

  const wait = () => {
    const h1 = document.querySelector('h1');
    if (!h1) { setTimeout(wait, 500); return; }

    const container = document.createElement('div');
    container.id = 'scx-clone-btn-container';
    container.style.cssText = 'margin:10px 0;';
    container.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:linear-gradient(135deg,#059669,#047857);border-radius:10px;cursor:pointer;box-shadow:0 2px 8px rgba(5,150,105,0.3);transition:all 0.2s;" id="scx-clone-main-btn">
        <span style="font-size:16px;">📋</span>
        <span style="color:white;font-size:13px;font-weight:700;">Klonlash</span>
        <span style="color:rgba(255,255,255,0.7);font-size:11px;">— O'z do'konimga nusxalash</span>
      </div>
    `;

    const bc = document.querySelector('nav[aria-label], [class*="breadcrumb"]');
    const target = bc || h1;
    if (target && target.parentElement) target.parentElement.insertBefore(container, target.nextSibling);

    const btn = container.querySelector('#scx-clone-main-btn');
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.02)'; btn.style.boxShadow = '0 4px 16px rgba(5,150,105,0.4)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 2px 8px rgba(5,150,105,0.3)'; });

    btn.addEventListener('click', async () => {
      btn.innerHTML = '<span style="color:white;font-size:13px;">⏳ Ma\'lumotlar yig\'ilmoqda...</span>';
      const scraped = scrapeProductPage();
      scraped.productId = productId;
      scraped.sourceUrl = window.location.href;

      await scxSaveScrapedData('uzum_market', 'competitor_product', scraped, window.location.href);
      btn.innerHTML = '<span style="color:white;font-size:13px;">✅ Saqlandi! Dashboard ochilmoqda...</span>';

      setTimeout(() => {
        window.open(`${DASHBOARD_BASE}/seller-cloud#clone?source=uzum_market&productId=${productId}`, '_blank');
        btn.innerHTML = '<span style="font-size:16px;">📋</span><span style="color:white;font-size:13px;font-weight:700;">Klonlash</span><span style="color:rgba(255,255,255,0.7);font-size:11px;">— O\'z do\'konimga nusxalash</span>';
      }, 800);
    });
  };
  wait();
}

// ===== Catalog — Clone badges on product cards =====
function injectCatalogCloneBadges() {
  const links = document.querySelectorAll('a[href*="/product/"]');
  const done = new Set();
  links.forEach(link => {
    if (done.has(link.href)) return;
    done.add(link.href);
    let card = link.closest('[class*="Card"], [class*="card"], [class*="product"]') || link.parentElement;
    if (!card || card.querySelector('.scx-clone-mini')) return;
    const b = document.createElement('div');
    b.className = 'scx-clone-mini';
    b.style.cssText = 'display:flex!important;align-items:center!important;gap:4px!important;padding:4px 8px!important;font-size:11px!important;background:rgba(5,150,105,0.08)!important;border-top:1px solid rgba(5,150,105,0.15)!important;cursor:pointer!important;transition:background 0.2s!important;';
    b.innerHTML = '<span style="font-size:11px">📋</span><span style="flex:1;color:#059669;font-weight:600;font-family:-apple-system,system-ui,sans-serif!important;">Klonlash</span><span style="font-size:8px;font-weight:800;color:#059669;background:rgba(5,150,105,0.1);padding:1px 4px;border-radius:3px">SCX</span>';
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(5,150,105,0.15)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(5,150,105,0.08)'; });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, '_blank');
    });
    card.appendChild(b);
  });
}

// ===== Main =====
function initPage() {
  const pt = getPageType();
  console.log('[SCX v7] Page:', pt);
  if (pt === 'product') injectCloneButton();
  injectCatalogCloneBadges();
}

function init() {
  setTimeout(initPage, 1500);
  scxObserveNavigation(() => {
    document.querySelectorAll('#scx-clone-btn-container, .scx-clone-mini').forEach(e => e.remove());
    setTimeout(initPage, 1500);
  });
  let t = null;
  new MutationObserver(() => { if (t) clearTimeout(t); t = setTimeout(injectCatalogCloneBadges, 800); }).observe(document.body, { childList: true, subtree: true });
}

setTimeout(init, 1500);
