/**
 * SellerCloudX Content Script — Uzum Seller Panel
 * seller.uzum.uz uchun AI Scanner + Klonlash
 * v6.0 — In-page AI Scanner & Form Automation
 */

// Prevent duplicate injection
if (window.__SCX_UZUM_SELLER_LOADED) {
  console.log('[SCX] Content script already loaded, skipping duplicate');
} else {
  window.__SCX_UZUM_SELLER_LOADED = true;

const SCX_VERSION = '6.0.0';
const SCX_SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';

console.log(`[SCX v${SCX_VERSION}] Uzum Seller content script loaded`);

// ===== DOM Utility Helpers =====
function waitForSelector(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
  });
}

function findInputByLabel(labelTexts, inputSelector = 'input, textarea, [contenteditable="true"]') {
  const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"], .field-label, .form-label');
  for (const label of labels) {
    const text = label.textContent.trim().toLowerCase();
    for (const searchText of labelTexts) {
      if (text.includes(searchText.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) { const input = document.getElementById(forId); if (input) return input; }
        const container = label.closest('[class*="field"], [class*="form-group"], [class*="FormField"], [class*="row"], [class*="item"]') || label.parentElement;
        if (container) { const input = container.querySelector(inputSelector); if (input) return input; }
      }
    }
  }
  return null;
}

function fillReactInput(el, value) {
  if (!el || !value) return false;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

function fillContentEditable(el, html) {
  if (!el) return false;
  el.focus();
  el.innerHTML = html;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

function clickButtonByText(texts) {
  const buttons = document.querySelectorAll('button, [role="button"], a.btn, [class*="Button"], [class*="button"]');
  for (const btn of buttons) {
    const btnText = btn.textContent.trim().toLowerCase();
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase()) && !btn.disabled) { btn.click(); return true; }
    }
  }
  return false;
}

async function selectDropdownOption(triggerTexts, optionText) {
  const trigger = findInputByLabel(triggerTexts, 'select, [class*="select"], [role="combobox"], [class*="dropdown"], button');
  if (trigger) {
    trigger.click();
    await scxSleep(500);
    const options = document.querySelectorAll('[role="option"], [class*="option"], [class*="menu-item"], li');
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase().includes(optionText.toLowerCase())) { opt.click(); return true; }
    }
  }
  return false;
}

// ===== AI Scanner Panel =====
let scannerPanelVisible = false;

function createScannerPanel() {
  if (document.getElementById('scx-ai-scanner-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'scx-ai-scanner-panel';
  panel.innerHTML = `
    <style>
      #scx-ai-scanner-panel {
        position: fixed; top: 50%; right: 16px; transform: translateY(-50%);
        width: 380px; max-height: 85vh; overflow-y: auto;
        background: #ffffff; border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        z-index: 999998; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      }
      .scx-scanner-header {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        padding: 16px 20px; border-radius: 16px 16px 0 0;
        display: flex; align-items: center; justify-content: space-between;
      }
      .scx-scanner-header-title { color: white; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
      .scx-scanner-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 14px; }
      .scx-scanner-close:hover { background: rgba(255,255,255,0.3); }
      .scx-scanner-body { padding: 16px 20px; }
      .scx-scanner-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #f3f4f6; border-radius: 10px; padding: 4px; }
      .scx-scanner-tab { flex: 1; padding: 8px; text-align: center; font-size: 12px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; background: transparent; color: #6b7280; transition: all 0.2s; }
      .scx-scanner-tab.active { background: white; color: #7c3aed; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .scx-scanner-input-group { margin-bottom: 12px; }
      .scx-scanner-label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
      .scx-scanner-input { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; outline: none; transition: border 0.2s; box-sizing: border-box; }
      .scx-scanner-input:focus { border-color: #7c3aed; }
      .scx-scanner-textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; outline: none; resize: vertical; min-height: 60px; box-sizing: border-box; }
      .scx-scanner-textarea:focus { border-color: #7c3aed; }
      .scx-scanner-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
      .scx-scanner-btn-primary { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; }
      .scx-scanner-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
      .scx-scanner-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .scx-scanner-btn-green { background: linear-gradient(135deg, #059669, #047857); color: white; }
      .scx-scanner-btn-green:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
      .scx-scanner-result { margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; }
      .scx-scanner-result-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px; }
      .scx-scanner-result-item { font-size: 12px; color: #374151; padding: 4px 0; border-bottom: 1px solid #e5e7eb; }
      .scx-scanner-result-item:last-child { border: none; }
      .scx-scanner-error { margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; color: #dc2626; font-size: 12px; }
      .scx-scanner-status { text-align: center; padding: 20px; color: #6b7280; font-size: 13px; }
      .scx-scanner-status .spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top: 3px solid #7c3aed; border-radius: 50%; animation: scx-spin 0.8s linear infinite; margin-bottom: 8px; }
      @keyframes scx-spin { to { transform: rotate(360deg); } }
      .scx-scanner-preview { margin-top: 12px; }
      .scx-scanner-preview-field { padding: 6px 0; font-size: 12px; }
      .scx-scanner-preview-label { color: #6b7280; font-weight: 500; }
      .scx-scanner-preview-value { color: #111827; font-weight: 600; }
    </style>
    <div class="scx-scanner-header">
      <div class="scx-scanner-header-title">🤖 AI Scanner Pro</div>
      <button class="scx-scanner-close" id="scx-scanner-close">✕</button>
    </div>
    <div class="scx-scanner-body">
      <div class="scx-scanner-tabs">
        <button class="scx-scanner-tab active" data-tab="create">🆕 Yaratish</button>
        <button class="scx-scanner-tab" data-tab="clone">📋 Klonlash</button>
      </div>

      <!-- CREATE TAB -->
      <div id="scx-tab-create">
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Mahsulot nomi *</label>
          <input class="scx-scanner-input" id="scx-ai-product-name" placeholder="Masalan: iPhone 15 uchun chexol" />
        </div>
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Kategoriya</label>
          <input class="scx-scanner-input" id="scx-ai-category" placeholder="Masalan: Aksessuarlar" />
        </div>
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Brend</label>
          <input class="scx-scanner-input" id="scx-ai-brand" placeholder="Masalan: Samsung" />
        </div>
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Narx (so'm)</label>
          <input class="scx-scanner-input" id="scx-ai-price" type="number" placeholder="150000" />
        </div>
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Qo'shimcha ma'lumot</label>
          <textarea class="scx-scanner-textarea" id="scx-ai-description" placeholder="Mahsulot haqida qo'shimcha ma'lumot..."></textarea>
        </div>
        <button class="scx-scanner-btn scx-scanner-btn-primary" id="scx-ai-generate-btn">🤖 AI bilan generatsiya qilish</button>
        <div id="scx-ai-result-area"></div>
      </div>

      <!-- CLONE TAB -->
      <div id="scx-tab-clone" style="display:none;">
        <div class="scx-scanner-input-group">
          <label class="scx-scanner-label">Uzum Market mahsulot URL</label>
          <input class="scx-scanner-input" id="scx-clone-url" placeholder="https://uzum.uz/product/..." />
        </div>
        <button class="scx-scanner-btn scx-scanner-btn-green" id="scx-clone-fetch-btn">📋 Ma'lumotlarni olish va to'ldirish</button>
        <div id="scx-clone-result-area"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  scannerPanelVisible = true;

  // Tab switching
  panel.querySelectorAll('.scx-scanner-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.scx-scanner-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('scx-tab-create').style.display = tab.dataset.tab === 'create' ? 'block' : 'none';
      document.getElementById('scx-tab-clone').style.display = tab.dataset.tab === 'clone' ? 'block' : 'none';
    });
  });

  // Close
  panel.querySelector('#scx-scanner-close').addEventListener('click', () => {
    panel.remove();
    scannerPanelVisible = false;
  });

  // AI Generate
  panel.querySelector('#scx-ai-generate-btn').addEventListener('click', handleAIGenerate);

  // Clone fetch
  panel.querySelector('#scx-clone-fetch-btn').addEventListener('click', handleCloneFetch);
}

// ===== AI Generate Handler =====
async function handleAIGenerate() {
  const productName = document.getElementById('scx-ai-product-name')?.value?.trim();
  if (!productName) { scxShowToast('❌ Mahsulot nomini kiriting', 'error'); return; }

  const btn = document.getElementById('scx-ai-generate-btn');
  const resultArea = document.getElementById('scx-ai-result-area');

  btn.disabled = true;
  btn.textContent = '⏳ AI generatsiya qilmoqda...';
  resultArea.innerHTML = '<div class="scx-scanner-status"><div class="spinner"></div><div>AI kartochka tayyorlayapti...</div></div>';

  const config = await chrome.storage.local.get(['accessToken']);
  if (!config.accessToken) {
    resultArea.innerHTML = '<div class="scx-scanner-error">❌ Avval SellerCloudX\'ga kiring (popup orqali)</div>';
    btn.disabled = false; btn.textContent = '🤖 AI bilan generatsiya qilish';
    return;
  }

  try {
    const category = document.getElementById('scx-ai-category')?.value?.trim();
    const brand = document.getElementById('scx-ai-brand')?.value?.trim();
    const price = parseFloat(document.getElementById('scx-ai-price')?.value) || undefined;
    const description = document.getElementById('scx-ai-description')?.value?.trim();

    const resp = await fetch(`${SCX_SUPABASE_URL}/functions/v1/prepare-uzum-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ productName, category, brand, price, description }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Server xatosi: ${resp.status}`);
    }

    const data = await resp.json();
    if (!data.success || !data.card) throw new Error('AI javob bermadi');

    const card = data.card;

    // Show result preview
    resultArea.innerHTML = `
      <div class="scx-scanner-result">
        <div class="scx-scanner-result-title">✅ Kartochka tayyor!</div>
        <div class="scx-scanner-preview">
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Nomi (UZ):</span> <span class="scx-scanner-preview-value">${card.name_uz || '—'}</span></div>
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Nomi (RU):</span> <span class="scx-scanner-preview-value">${card.name_ru || '—'}</span></div>
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Tavsif (UZ):</span> <span class="scx-scanner-preview-value">${(card.short_description_uz || '—').substring(0, 80)}...</span></div>
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Xususiyatlar:</span> <span class="scx-scanner-preview-value">${card.properties?.length || 0} ta</span></div>
        </div>
        <button class="scx-scanner-btn scx-scanner-btn-primary" id="scx-fill-form-btn" style="margin-top:12px;">📝 Formani to'ldirish</button>
      </div>
    `;

    document.getElementById('scx-fill-form-btn').addEventListener('click', () => {
      fillUzumFormFromAI(card, price);
    });

  } catch (err) {
    console.error('[SCX] AI generate error:', err);
    resultArea.innerHTML = `<div class="scx-scanner-error">❌ ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = '🤖 AI bilan generatsiya qilish';
}

// ===== Clone Fetch Handler =====
async function handleCloneFetch() {
  const url = document.getElementById('scx-clone-url')?.value?.trim();
  if (!url || !url.includes('uzum.uz/product/')) {
    scxShowToast('❌ Uzum Market mahsulot URL kiriting', 'error');
    return;
  }

  const btn = document.getElementById('scx-clone-fetch-btn');
  const resultArea = document.getElementById('scx-clone-result-area');

  btn.disabled = true;
  btn.textContent = '⏳ Ma\'lumotlar olinmoqda...';
  resultArea.innerHTML = '<div class="scx-scanner-status"><div class="spinner"></div><div>Sahifadan ma\'lumotlar yig\'ilmoqda...</div></div>';

  try {
    // Fetch the product page HTML
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error('Sahifani yuklash imkonsiz: ' + resp.status);
    const html = await resp.text();

    // Parse in a temporary DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const scraped = { _source: 'clone_fetch', _ts: new Date().toISOString(), sourceUrl: url };

    // Title
    const h1 = doc.querySelector('h1');
    if (h1) scraped.title = h1.textContent.trim();

    // JSON-LD
    scraped.images = [];
    try {
      const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldScripts) {
        try {
          const ld = JSON.parse(script.textContent);
          const graph = ld['@graph'] || [ld];
          for (const item of graph) {
            if (item['@type'] === 'Product' || item['@type'] === 'ProductGroup') {
              if (!scraped.title && item.name) scraped.title = String(item.name).trim();
              if (item.description) scraped.description = String(item.description).replace(/<[^>]*>/g, ' ').trim().substring(0, 2000);
              const ldImages = Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []);
              ldImages.forEach(u => {
                const hq = String(u).replace('/t_product_low.jpg', '/t_product_540_high.jpg');
                if (hq.includes('images.uzum.uz') && scraped.images.length < 15) scraped.images.push(hq);
              });
            }
          }
        } catch {}
      }
    } catch {}

    // Characteristics
    scraped.characteristics = [];
    doc.querySelectorAll('[class*="haracter"] tr, [class*="spec"] tr').forEach(row => {
      const cells = row.querySelectorAll('td, span, div');
      if (cells.length >= 2) {
        const name = cells[0].textContent.trim();
        const value = cells[1].textContent.trim();
        if (name && value && name.length < 100) scraped.characteristics.push({ name, value });
      }
    });

    const brandChar = scraped.characteristics.find(c => /бренд|brand/i.test(c.name));
    if (brandChar) scraped.brand = brandChar.value;

    // Breadcrumbs
    scraped.breadcrumbs = [];
    doc.querySelectorAll('nav[aria-label] a, [class*="breadcrumb"] a').forEach(a => {
      const text = a.textContent.trim();
      if (text && text !== 'Главная' && text !== 'Bosh sahifa') scraped.breadcrumbs.push(text);
    });

    if (!scraped.title) throw new Error('Mahsulot ma\'lumotlari topilmadi');

    resultArea.innerHTML = `
      <div class="scx-scanner-result">
        <div class="scx-scanner-result-title">✅ Ma'lumotlar topildi!</div>
        <div class="scx-scanner-preview">
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Nomi:</span> <span class="scx-scanner-preview-value">${scraped.title}</span></div>
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Rasmlar:</span> <span class="scx-scanner-preview-value">${scraped.images.length} ta</span></div>
          <div class="scx-scanner-preview-field"><span class="scx-scanner-preview-label">Xususiyatlar:</span> <span class="scx-scanner-preview-value">${scraped.characteristics.length} ta</span></div>
        </div>
        <button class="scx-scanner-btn scx-scanner-btn-green" id="scx-clone-fill-btn" style="margin-top:12px;">📝 Formani to'ldirish</button>
      </div>
    `;

    document.getElementById('scx-clone-fill-btn').addEventListener('click', () => {
      fillUzumFormFromClone(scraped);
    });

  } catch (err) {
    console.error('[SCX] Clone fetch error:', err);
    resultArea.innerHTML = `<div class="scx-scanner-error">❌ ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.textContent = '📋 Ma\'lumotlarni olish va to\'ldirish';
}

// ===== Fill Form from AI data =====
async function fillUzumFormFromAI(card, price) {
  scxShowToast('📝 Forma to\'ldirilmoqda...', 'info');

  // Navigate to create page if needed
  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    window.location.href = 'https://seller.uzum.uz/products/create';
    // Store data for after navigation
    chrome.storage.local.set({ scx_pending_fill: { type: 'ai', card, price } });
    return;
  }

  await scxSleep(2000);

  const filled = [];
  const failed = [];

  // Title
  const title = card.name_uz || card.name_ru || '';
  if (title) {
    const r = fillField(['название', 'nomi', 'номи', 'наименование', 'mahsulot nomi', 'name', 'title'], title, 'input[type="text"], input:not([type])');
    r ? filled.push('title') : failed.push('title');
    await scxSleep(400);
  }

  // Description
  const desc = card.full_description_uz || card.full_description_ru || card.short_description_uz || '';
  if (desc) {
    const descArea = findInputByLabel(['описание', 'tavsif', 'description', 'подробное'], 'textarea, [contenteditable="true"], .ql-editor, .ProseMirror');
    if (descArea) {
      if (descArea.contentEditable === 'true' || descArea.classList.contains('ql-editor') || descArea.classList.contains('ProseMirror')) {
        fillContentEditable(descArea, desc);
      } else {
        fillReactInput(descArea, desc);
      }
      filled.push('description');
    } else {
      const tas = document.querySelectorAll('textarea');
      if (tas.length > 0) { fillReactInput(tas[0], desc); filled.push('description'); }
      else failed.push('description');
    }
    await scxSleep(400);
  }

  // Brand
  if (card.brand) {
    const r = fillField(['бренд', 'brand', 'brend', 'торговая марка'], card.brand, 'input, select, [role="combobox"]');
    r ? filled.push('brand') : failed.push('brand');
    await scxSleep(400);
  }

  // Price
  if (price > 0) {
    const r = fillField(['цена', 'narx', 'price', 'стоимость', 'sotuv narxi'], String(price), 'input[type="number"], input');
    r ? filled.push('price') : failed.push('price');
  }

  // Properties
  if (card.properties?.length > 0) {
    let count = 0;
    for (const prop of card.properties) {
      const nameKey = prop.name_uz || prop.name_ru;
      const valueKey = prop.value_uz || prop.value_ru;
      if (nameKey && valueKey) {
        const r = fillField([nameKey, nameKey.toLowerCase()], valueKey, 'input, select');
        if (r) count++;
        await scxSleep(250);
      }
    }
    if (count > 0) filled.push(`properties(${count})`);
  }

  const msg = `✅ To'ldirildi: ${filled.join(', ')}${failed.length > 0 ? '\n⚠️ Topilmadi: ' + failed.join(', ') : ''}`;
  scxShowToast(msg, filled.length > 0 ? 'success' : 'warning');
  console.log('[SCX] Form fill result:', { filled, failed });
}

// ===== Fill Form from Clone data =====
async function fillUzumFormFromClone(scraped) {
  scxShowToast('📝 Klonlash — forma to\'ldirilmoqda...', 'info');

  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    window.location.href = 'https://seller.uzum.uz/products/create';
    chrome.storage.local.set({ scx_pending_fill: { type: 'clone', scraped } });
    return;
  }

  await scxSleep(2000);
  await handleCreateProduct({
    title: scraped.title,
    description: scraped.description,
    brand: scraped.brand,
    images: scraped.images,
    characteristics: scraped.characteristics,
    categoryPath: scraped.breadcrumbs,
  });
}

// ===== Generic field fill helper =====
function fillField(labelTexts, value, inputSelector) {
  const input = findInputByLabel(labelTexts, inputSelector || 'input, textarea');
  if (input) {
    fillReactInput(input, value);
    return true;
  }
  return false;
}

// ===== Create Product (full DOM automation) =====
async function handleCreateProduct(payload) {
  console.log('[SCX] === CREATE PRODUCT START ===');

  const title = payload.title || payload.title_uz || payload.titleUz || payload.title_ru || '';
  const description = payload.description || payload.description_uz || payload.descriptionUz || '';
  const brand = payload.brand || '';
  const barcode = payload.barcode || '';
  const mxikCode = payload.mxik_code || payload.mxikCode || '';
  const price = payload.price || 0;
  const weight = Number(payload.weight ?? 0);
  const height = Number(payload.height ?? 0);
  const length = Number(payload.length ?? 0);
  const width = Number(payload.width ?? 0);
  const color = payload.color || '';
  const material = payload.material || '';
  const country = payload.country || '';
  const images = payload.images || payload.pictures || [];
  const characteristics = payload.characteristics || [];

  scxShowToast('📦 Mahsulot yaratish boshlanmoqda...', 'info');

  // Navigate to create page if needed
  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create') && !window.location.href.includes('/product/create')) {
    const createBtnClicked = clickButtonByText(['добавить товар', 'tovar qo\'shish', 'yangi tovar', 'создать товар', 'создать карточку']);
    if (!createBtnClicked) window.location.href = 'https://seller.uzum.uz/products/create';
    await scxSleep(4000);
  }

  await scxSleep(2000);

  let filledFields = [];
  let failedFields = [];

  // Title
  if (title) {
    const titleInput = findInputByLabel(['название', 'nomi', 'номи', 'наименование', 'mahsulot nomi', 'товар', 'name', 'title'], 'input[type="text"], input:not([type])');
    if (titleInput) { fillReactInput(titleInput, title); filledFields.push('title'); }
    else {
      const allInputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="number"])');
      if (allInputs.length > 0) { fillReactInput(allInputs[0], title); filledFields.push('title(fallback)'); }
      else failedFields.push('title');
    }
    await scxSleep(500);
  }

  // MXIK
  if (mxikCode) {
    const mxikInput = findInputByLabel(['мхик', 'mxik', 'ikpu', 'ИК', 'код товара'], 'input');
    if (mxikInput) {
      fillReactInput(mxikInput, mxikCode);
      filledFields.push('mxik');
      await scxSleep(1000);
      const mxikOptions = document.querySelectorAll('[class*="option"], [class*="suggestion"], [role="option"]');
      if (mxikOptions.length > 0) { mxikOptions[0].click(); await scxSleep(500); }
    }
  }

  // Brand
  if (brand) {
    const brandInput = findInputByLabel(['бренд', 'brand', 'brend', 'торговая марка'], 'input, select, [role="combobox"]');
    if (brandInput) {
      if (brandInput.tagName === 'SELECT' || brandInput.getAttribute('role') === 'combobox') {
        brandInput.click();
        await scxSleep(500);
        const searchInput = document.querySelector('[class*="search"] input, input[placeholder*="поиск"]');
        if (searchInput) {
          fillReactInput(searchInput, brand);
          await scxSleep(800);
          const opts = document.querySelectorAll('[role="option"], [class*="option"]');
          if (opts.length > 0) { opts[0].click(); filledFields.push('brand'); }
        }
      } else {
        fillReactInput(brandInput, brand);
        filledFields.push('brand');
      }
      await scxSleep(500);
    }
  }

  // Description
  if (description) {
    const descArea = findInputByLabel(['описание', 'tavsif', 'тавсиф', 'description', 'подробное'], 'textarea, [contenteditable="true"], .ql-editor, .ProseMirror');
    if (descArea) {
      if (descArea.contentEditable === 'true' || descArea.classList.contains('ql-editor') || descArea.classList.contains('ProseMirror')) fillContentEditable(descArea, description);
      else fillReactInput(descArea, description);
      filledFields.push('description');
    } else {
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length > 0) { fillReactInput(textareas[0], description); filledFields.push('description(fallback)'); }
      else failedFields.push('description');
    }
    await scxSleep(500);
  }

  // Price
  if (price > 0) {
    const priceInput = findInputByLabel(['цена', 'narx', 'нарх', 'стоимость', 'price', 'sotuv narxi'], 'input[type="number"], input');
    if (priceInput) { fillReactInput(priceInput, String(price)); filledFields.push('price'); }
    else failedFields.push('price');
    await scxSleep(300);
  }

  // Barcode
  if (barcode) {
    const barcodeInput = findInputByLabel(['штрихкод', 'barcode', 'shtrix', 'ean'], 'input');
    if (barcodeInput) { fillReactInput(barcodeInput, barcode); filledFields.push('barcode'); }
    await scxSleep(300);
  }

  // Characteristics
  if (characteristics.length > 0) {
    let charsFilled = 0;
    for (const char of characteristics) {
      const charInput = findInputByLabel([char.name, char.name.toLowerCase()], 'input, select, [role="combobox"]');
      if (charInput) {
        if (charInput.tagName === 'SELECT') {
          for (const opt of charInput.querySelectorAll('option')) {
            if (opt.textContent.trim().toLowerCase().includes(char.value.toLowerCase())) {
              charInput.value = opt.value;
              charInput.dispatchEvent(new Event('change', { bubbles: true }));
              charsFilled++;
              break;
            }
          }
        } else { fillReactInput(charInput, char.value); charsFilled++; }
        await scxSleep(300);
      }
    }
    if (charsFilled > 0) filledFields.push(`characteristics(${charsFilled}/${characteristics.length})`);
  }

  // Extra metadata
  const textMetaFields = [
    { key: 'color', value: color, labels: ['цвет', 'rang', 'color'] },
    { key: 'material', value: material, labels: ['материал', 'material'] },
    { key: 'country', value: country, labels: ['страна производства', 'country', 'mamlakat'] },
  ];
  for (const field of textMetaFields) {
    if (!field.value) continue;
    const input = findInputByLabel(field.labels, 'input, textarea, select');
    let filled = false;
    if (input) {
      if (input.tagName === 'SELECT') {
        for (const opt of input.querySelectorAll('option')) {
          if (opt.textContent.trim().toLowerCase().includes(String(field.value).toLowerCase())) {
            input.value = opt.value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filled = true;
            break;
          }
        }
      } else filled = fillReactInput(input, String(field.value));
    }
    if (!filled) filled = await selectDropdownOption(field.labels, String(field.value));
    if (filled) { filledFields.push(field.key); await scxSleep(250); }
  }

  const numericMetaFields = [
    { key: 'weight', value: weight, labels: ['вес', 'og\'irlik', 'weight'] },
    { key: 'height', value: height, labels: ['высота', 'balandlik', 'height'] },
    { key: 'length', value: length, labels: ['длина', 'uzunlik', 'length'] },
    { key: 'width', value: width, labels: ['ширина', 'kenglik', 'width'] },
  ];
  for (const field of numericMetaFields) {
    if (!field.value || Number.isNaN(field.value)) continue;
    const input = findInputByLabel(field.labels, 'input[type="number"], input');
    if (input) { fillReactInput(input, String(field.value)); filledFields.push(field.key); await scxSleep(250); }
  }

  // Images
  if (images.length > 0) {
    const imgInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
    if (imgInput) {
      try {
        scxShowToast(`📷 ${images.length} ta rasm yuklanmoqda...`, 'info');
        const dt = new DataTransfer();
        let uploadedCount = 0;
        for (const imgUrl of images.slice(0, 10)) {
          try {
            let actualResp = null;
            try { const c = await fetch(imgUrl); if (c?.ok) actualResp = c; } catch {}
            if (!actualResp) { try { const c = await fetch(imgUrl, { mode: 'cors', credentials: 'omit' }); if (c?.ok) actualResp = c; } catch {} }
            if (!actualResp?.ok) continue;
            const blob = await actualResp.blob();
            if (blob.size < 1000) continue;
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const file = new File([blob], `product_${Date.now()}_${uploadedCount}.${ext}`, { type: blob.type || 'image/jpeg' });
            dt.items.add(file);
            uploadedCount++;
          } catch {}
        }
        if (uploadedCount > 0) {
          imgInput.files = dt.files;
          imgInput.dispatchEvent(new Event('change', { bubbles: true }));
          imgInput.dispatchEvent(new Event('input', { bubbles: true }));
          filledFields.push(`images(${uploadedCount})`);
          await scxSleep(2000);
        }
      } catch { failedFields.push('images'); }
    } else failedFields.push('images');
  }

  console.log('[SCX] Filled:', filledFields.join(', '));
  console.log('[SCX] Failed:', failedFields.join(', '));

  scxShowToast(`✅ To'ldirildi: ${filledFields.join(', ')}${failedFields.length > 0 ? ' | ⚠️ Topilmadi: ' + failedFields.join(', ') : ''}`, filledFields.length > 0 ? 'success' : 'warning');

  return { success: true, result: { filledFields, failedFields, saved: false, submitted: false, message: 'Forma to\'ldirildi. Iltimos, tekshirib saqlang.' } };
}

// ===== Floating Action Button =====
function createFAB() {
  if (document.getElementById('scx-fab')) return;

  const fab = document.createElement('div');
  fab.id = 'scx-fab';
  fab.innerHTML = `
    <style>
      #scx-fab {
        position: fixed; bottom: 24px; right: 24px; z-index: 999997;
        width: 56px; height: 56px; border-radius: 16px;
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        box-shadow: 0 4px 20px rgba(124,58,237,0.4);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.3s; font-size: 24px;
      }
      #scx-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(124,58,237,0.5); }
    </style>
    <span>🤖</span>
  `;
  document.body.appendChild(fab);

  fab.addEventListener('click', () => {
    if (scannerPanelVisible) {
      document.getElementById('scx-ai-scanner-panel')?.remove();
      scannerPanelVisible = false;
    } else {
      createScannerPanel();
    }
  });
}

// ===== Profit Calculator =====
let profitCalcVisible = false;

function toggleProfitCalc() {
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
      <div class="scx-calc-row"><label>Sotuv narxi (so'm)</label><input type="number" id="scx-sell-price" placeholder="150000"></div>
      <div class="scx-calc-row"><label>Tannarx (so'm)</label><input type="number" id="scx-cost-price" placeholder="80000"></div>
      <div class="scx-calc-row"><label>Komissiya (%)</label><input type="number" id="scx-commission" value="15" placeholder="15"></div>
      <div class="scx-calc-row"><label>Logistika (so'm)</label><input type="number" id="scx-logistics" value="15000" placeholder="15000"></div>
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

  document.getElementById('scx-calc-close')?.addEventListener('click', () => { calc.remove(); profitCalcVisible = false; });

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

// ===== Toolbar =====
function initToolbar() {
  if (document.getElementById('scx-toolbar')) return;
  scxCreateToolbar('Uzum Seller', '🟣');

  const actionsDiv = document.querySelector('.scx-toolbar-actions');
  if (actionsDiv) {
    // Replace scrape button with AI Scanner
    const scrapeBtn = document.getElementById('scx-btn-scrape');
    if (scrapeBtn) { scrapeBtn.textContent = '🤖'; scrapeBtn.title = 'AI Scanner'; }

    // Replace panel button with profit calc
    const panelBtn = document.getElementById('scx-btn-panel');
    if (panelBtn) { panelBtn.textContent = '💰'; panelBtn.title = 'Foyda kalkulyator'; }
  }

  document.getElementById('scx-btn-scrape')?.addEventListener('click', () => {
    if (scannerPanelVisible) { document.getElementById('scx-ai-scanner-panel')?.remove(); scannerPanelVisible = false; }
    else createScannerPanel();
  });
  document.getElementById('scx-btn-panel')?.addEventListener('click', toggleProfitCalc);
}

// ===== Command Handler (from background/dashboard) =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_PING') {
    sendResponse({ pong: true, page: 'uzum-seller', version: SCX_VERSION });
    return true;
  }
  if (msg.type === 'SCX_COMMAND') {
    handleCommand(msg).then(sendResponse);
    return true;
  }
  if (msg.type === 'SCX_SETTING') {
    // Settings handling if needed
  }
});

async function handleCommand(msg) {
  const { command_type, payload } = msg;
  console.log('[SCX] Command:', command_type);
  try {
    switch (command_type) {
      case 'create_product': return await handleCreateProduct(payload);
      case 'update_price': return { success: true, result: { message: 'Narx yangilash API orqali' } };
      case 'update_stock': return { success: true, result: { message: 'Zaxira yangilash API orqali' } };
      default: return { success: false, error: 'Noma\'lum buyruq: ' + command_type };
    }
  } catch (err) {
    console.error('[SCX] Command error:', err);
    return { success: false, error: err.message };
  }
}

// ===== Check for pending fill after navigation =====
async function checkPendingFill() {
  const data = await chrome.storage.local.get(['scx_pending_fill']);
  if (data.scx_pending_fill) {
    await chrome.storage.local.remove('scx_pending_fill');
    const pending = data.scx_pending_fill;
    await scxSleep(3000); // Wait for page to load

    if (pending.type === 'ai') {
      await fillUzumFormFromAI(pending.card, pending.price);
    } else if (pending.type === 'clone') {
      await handleCreateProduct({
        title: pending.scraped.title,
        description: pending.scraped.description,
        brand: pending.scraped.brand,
        images: pending.scraped.images,
        characteristics: pending.scraped.characteristics,
      });
    }
  }
}

// ===== Init =====
function initUzumSeller() {
  initToolbar();
  createFAB();
  checkPendingFill();
}

setTimeout(initUzumSeller, 1000);

} // end of duplicate guard
