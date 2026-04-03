/**
 * SellerCloudX Content Script — Uzum Market (Front/Marketplace)
 * uzum.uz uchun — har bir mahsulot sahifasida statistika overlay
 * 
 * Funksiyalar:
 * 1. Mahsulot sahifasida narx tarixini ko'rsatish
 * 2. Raqobatchi tahlili
 * 3. Tezkor klonlash tugmasi
 * 4. Sotuvchi reytingi
 */

console.log('[SCX v4.0] Uzum Market (front) content script loaded');

function initUzumMarket() {
  // Minimal toolbar — faqat marketplace uchun
  if (document.getElementById('scx-toolbar')) return;
  
  const toolbar = document.createElement('div');
  toolbar.id = 'scx-toolbar';
  toolbar.innerHTML = `
    <div class="scx-toolbar-inner">
      <div class="scx-toolbar-brand" title="SellerCloudX — Uzum Market Analitika">
        <span class="scx-logo">🟣</span>
        <span class="scx-brand-text">SCX</span>
      </div>
      <div class="scx-toolbar-actions">
        <button class="scx-tb-btn" id="scx-btn-analyze" title="Mahsulotni tahlil qilish">🔍</button>
        <button class="scx-tb-btn" id="scx-btn-clone" title="Klonlash">📋</button>
        <button class="scx-tb-btn" id="scx-btn-dashboard" title="Dashboard">🌐</button>
        <button class="scx-tb-btn scx-tb-close" id="scx-btn-minimize" title="Yashirish">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(toolbar);
  
  document.getElementById('scx-btn-dashboard')?.addEventListener('click', () => {
    window.open('https://sellercloudx.lovable.app/seller-cloud-x', '_blank');
  });
  document.getElementById('scx-btn-minimize')?.addEventListener('click', () => {
    toolbar.classList.toggle('scx-minimized');
  });
  document.getElementById('scx-btn-analyze')?.addEventListener('click', analyzeCurrentProduct);
  document.getElementById('scx-btn-clone')?.addEventListener('click', cloneCurrentProduct);
  
  // Observe navigation
  scxObserveNavigation(injectMarketOverlays);
  setTimeout(injectMarketOverlays, 2000);
}

// ===== Analyze current product page =====
async function analyzeCurrentProduct() {
  const url = window.location.href;
  
  // Mahsulot sahifasini tekshirish
  if (!url.includes('/product/') && !url.includes('/p/')) {
    scxShowToast('⚠️ Mahsulot sahifasiga o\'ting', 'warning');
    return;
  }
  
  scxShowToast('🔍 Mahsulot tahlil qilinmoqda...', 'info');
  
  const data = {
    url,
    title: document.querySelector('h1, [class*="title"], [class*="ProductTitle"]')?.textContent?.trim(),
    price: null,
    originalPrice: null,
    rating: null,
    reviewCount: null,
    seller: null,
    images: [],
    characteristics: [],
  };
  
  // Narx
  const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
  priceEls.forEach(el => {
    const num = scxParseNumber(el.textContent);
    if (num > 100) {
      if (!data.price) data.price = num;
      else if (!data.originalPrice && num > data.price) data.originalPrice = num;
    }
  });
  
  // Reyting
  const ratingEl = document.querySelector('[class*="rating"], [class*="Rating"], [class*="star"]');
  if (ratingEl) data.rating = scxParseNumber(ratingEl.textContent);
  
  // Sharhlar soni
  const reviewEl = document.querySelector('[class*="review"], [class*="Review"], [class*="отзыв"]');
  if (reviewEl) data.reviewCount = scxParseNumber(reviewEl.textContent);
  
  // Sotuvchi
  const sellerEl = document.querySelector('[class*="seller"], [class*="Seller"], [class*="shop"]');
  if (sellerEl) data.seller = sellerEl.textContent.trim();
  
  // Rasmlar
  document.querySelectorAll('[class*="gallery"] img, [class*="slider"] img, [class*="image"] img').forEach(img => {
    if (img.src && img.src.includes('http')) data.images.push(img.src);
  });
  
  // Xususiyatlar
  document.querySelectorAll('[class*="characteristic"] tr, [class*="spec"] tr, [class*="param"] tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td, th')].map(c => c.textContent.trim());
    if (cells.length >= 2) data.characteristics.push({ key: cells[0], value: cells[1] });
  });
  
  await scxSaveScrapedData('uzum', 'product_analysis', data, url);
  
  // Show overlay with results
  showProductAnalysisOverlay(data);
}

function showProductAnalysisOverlay(data) {
  document.getElementById('scx-product-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'scx-product-overlay';
  overlay.style.cssText = `
    position: fixed; top: 80px; right: 16px; z-index: 999997; width: 280px;
    background: linear-gradient(135deg, #0f0a2a, #1a1040);
    border: 1px solid rgba(124, 58, 237, 0.35); border-radius: 16px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5); font-family: -apple-system, sans-serif;
    overflow: hidden;
  `;
  overlay.innerHTML = `
    <div class="scx-panel-header">
      <span>📊 Mahsulot tahlili</span>
      <button id="scx-overlay-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="padding:12px;">
      <div style="font-size:12px;color:#e2e8f0;font-weight:600;margin-bottom:8px;">${data.title || 'Nomsiz'}</div>
      <div class="scx-metric-grid">
        <div class="scx-metric-card">
          <div class="scx-metric-value green">${data.price ? scxFormatPrice(data.price) : '—'}</div>
          <div class="scx-metric-label">Narx</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value orange">${data.rating || '—'} ⭐</div>
          <div class="scx-metric-label">Reyting</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value blue">${data.reviewCount || '—'}</div>
          <div class="scx-metric-label">Sharhlar</div>
        </div>
        <div class="scx-metric-card">
          <div class="scx-metric-value purple">${data.images?.length || 0}</div>
          <div class="scx-metric-label">Rasmlar</div>
        </div>
      </div>
      ${data.seller ? `<div style="font-size:10px;color:#94a3b8;margin-top:6px;">Sotuvchi: ${data.seller}</div>` : ''}
      ${data.characteristics.length > 0 ? `
        <div style="font-size:10px;color:#94a3b8;margin-top:8px;">Xususiyatlar: ${data.characteristics.length} ta</div>
      ` : ''}
      <button id="scx-clone-from-overlay" style="
        width:100%;margin-top:10px;padding:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);
        color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
      ">📋 Klonlash uchun dashboard'ga o'tish</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('scx-overlay-close')?.addEventListener('click', () => overlay.remove());
  document.getElementById('scx-clone-from-overlay')?.addEventListener('click', () => {
    window.open('https://sellercloudx.lovable.app/seller-cloud-mobile', '_blank');
  });
}

// ===== Clone current product =====
function cloneCurrentProduct() {
  const url = window.location.href;
  if (!url.includes('/product/') && !url.includes('/p/')) {
    scxShowToast('⚠️ Mahsulot sahifasiga o\'ting', 'warning');
    return;
  }
  // Open dashboard with clone intent
  window.open(`https://sellercloudx.lovable.app/seller-cloud-mobile?clone_url=${encodeURIComponent(url)}`, '_blank');
  scxShowToast('📋 Klonlash uchun dashboard ochilmoqda...', 'info');
}

// ===== Inject marketplace overlays =====
function injectMarketOverlays() {
  // Mahsulotlar ro'yxatida (katalog sahifasida) narx tagiga SCX badge qo'shish
  document.querySelectorAll('[class*="product-card"], [class*="ProductCard"], [class*="goods-card"]').forEach(card => {
    if (card.querySelector('.scx-badge')) return;
    
    const priceEl = card.querySelector('[class*="price"], [class*="Price"]');
    if (priceEl) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '📊 Tahlil';
      badge.style.cssText = 'cursor:pointer;';
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Get product link
        const link = card.querySelector('a[href*="/product/"], a[href*="/p/"]');
        if (link) {
          window.open(link.href, '_blank');
        }
      });
      priceEl.parentElement?.appendChild(badge);
    }
  });
}

setTimeout(initUzumMarket, 1500);
