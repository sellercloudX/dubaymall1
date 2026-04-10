/**
 * SellerCloudX Content Script — Uzum Seller Panel
 * seller.uzum.uz uchun AI Scanner + Klonlash + Qidiruv
 * v9.0 — Full 3-Step Wizard Automation (based on real Uzum UI flow)
 * 
 * Uzum kartochka yaratish 3 bosqichli wizard:
 *   Step 1: Kategoriya, Nom (UZ+RU), Brend, Qisqa tavsif, Rich tavsif, Foto, Xususiyatlar, Svoystvalar
 *   Step 2: SKU, MXIK, O'lchamlar (mm), Og'irlik (g), Narx (so'm)
 *   Step 3: Yangi atributlar (kategoriyaga qarab), Zavershit
 */

if (window.__SCX_UZUM_SELLER_LOADED) {
  console.log('[SCX] Content script already loaded, skipping duplicate');
} else {
  window.__SCX_UZUM_SELLER_LOADED = true;

const SCX_VERSION = '9.0.0';
const SCX_SUPABASE_URL = 'https://idcshubgqrzdvkttnslz.supabase.co';
const SCX_CURRENT_DOMAIN = window.location.hostname;
const SCX_CREATE_URL = `https://${SCX_CURRENT_DOMAIN}/products/create`;

console.log(`[SCX v${SCX_VERSION}] Uzum Seller content script loaded on ${SCX_CURRENT_DOMAIN}`);

// ===== DOM Utility Helpers =====
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

function waitForAnySelector(selectors, timeout = 15000) {
  return new Promise((resolve, reject) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
    }
    const observer = new MutationObserver(() => {
      for (const sel of selectors) {
        const found = document.querySelector(sel);
        if (found) { observer.disconnect(); resolve(found); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error('timeout: ' + selectors.join(', '))); }, timeout);
  });
}

// Native React input setter — bypasses React controlled components
function fillReactInput(el, value) {
  if (!el || !value) return false;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
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

// Find input by nearby label text (supports multiple label patterns)
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

// Find inputs by placeholder text
function findInputByPlaceholder(placeholderTexts) {
  const inputs = document.querySelectorAll('input, textarea');
  for (const inp of inputs) {
    const ph = (inp.placeholder || '').toLowerCase();
    for (const t of placeholderTexts) {
      if (ph.includes(t.toLowerCase())) return inp;
    }
  }
  return null;
}

// Find ALL text inputs on page
function findAllInputs() {
  return document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea');
}

// Click a button by matching text
function clickButtonByText(texts) {
  const buttons = document.querySelectorAll('button, [role="button"], a.btn, [class*="Button"], [class*="button"]');
  for (const btn of buttons) {
    if (btn.closest('#scx-main-panel, #scx-fab, #scx-toolbar, #scx-auto-status')) continue;
    if (btn.disabled || btn.offsetParent === null) continue;
    const btnText = btn.textContent.trim().toLowerCase();
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase())) { btn.click(); return true; }
    }
  }
  return false;
}

// Click a checkbox by nearby text
function clickCheckboxByText(texts) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const container = cb.closest('label, [class*="checkbox"], [class*="Checkbox"]') || cb.parentElement;
    if (!container) continue;
    const text = container.textContent.trim().toLowerCase();
    for (const t of texts) {
      if (text.includes(t.toLowerCase())) {
        if (!cb.checked) { cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); }
        return true;
      }
    }
  }
  return false;
}

// Find input fields by examining the text near them (within parent containers)
function findInputNearText(searchTexts, inputType = 'input, textarea') {
  // Walk through all visible text nodes and find inputs near matching text
  const allContainers = document.querySelectorAll('[class*="field"], [class*="form"], [class*="Field"], [class*="Form"], [class*="row"], [class*="group"]');
  for (const container of allContainers) {
    const text = container.textContent.trim().toLowerCase();
    for (const st of searchTexts) {
      if (text.includes(st.toLowerCase())) {
        const inp = container.querySelector(inputType);
        if (inp && inp.offsetParent !== null) return inp;
      }
    }
  }
  return null;
}

// ===== Auth Helper =====
async function getAuthToken() {
  const config = await chrome.storage.local.get(['accessToken']);
  return config.accessToken || null;
}

// ===== FLOATING STATUS PANEL =====
function showStatus(message, type = 'info') {
  let panel = document.getElementById('scx-auto-status');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'scx-auto-status';
    panel.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 999999; padding: 16px 28px; border-radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 14px; font-weight: 600; color: white;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 12px;
      transition: all 0.3s ease; min-width: 300px; max-width: 600px;
    `;
    document.body.appendChild(panel);
  }
  const colors = { info: '#7c3aed', success: '#059669', error: '#dc2626', warning: '#d97706' };
  panel.style.background = colors[type] || colors.info;
  panel.innerHTML = `
    ${type === 'info' ? '<div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid white;border-radius:50%;animation:scx-spin 0.8s linear infinite;flex-shrink:0;"></div>' : ''}
    <span>${message}</span>
  `;
  if (!document.getElementById('scx-auto-style')) {
    const style = document.createElement('style');
    style.id = 'scx-auto-style';
    style.textContent = '@keyframes scx-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  if (type === 'success' || type === 'error') {
    setTimeout(() => panel?.remove(), 5000);
  }
}

// ===== MAIN PANEL (Sidebar UI) =====
let panelVisible = false;

function createMainPanel() {
  if (document.getElementById('scx-main-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'scx-main-panel';
  panel.innerHTML = `
    <style>
      #scx-main-panel {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 420px; max-width: 90vw;
        background: #ffffff; z-index: 999998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        box-shadow: -4px 0 30px rgba(0,0,0,0.12);
        display: flex; flex-direction: column;
        transition: transform 0.3s ease; overflow: hidden;
      }
      .scx-panel-header {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
      }
      .scx-panel-header-left { display: flex; align-items: center; gap: 10px; }
      .scx-panel-logo { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .scx-panel-title { color: white; font-size: 15px; font-weight: 700; }
      .scx-panel-subtitle { color: rgba(255,255,255,0.7); font-size: 11px; }
      .scx-panel-close { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
      .scx-panel-close:hover { background: rgba(255,255,255,0.25); }
      .scx-panel-nav { display: flex; gap: 2px; padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; overflow-x: auto; }
      .scx-panel-nav-btn { flex-shrink: 0; padding: 8px 12px; font-size: 11px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; background: transparent; color: #6b7280; transition: all 0.2s; white-space: nowrap; }
      .scx-panel-nav-btn.active { background: #7c3aed; color: white; }
      .scx-panel-nav-btn:hover:not(.active) { background: #f3f0ff; color: #7c3aed; }
      .scx-panel-body { flex: 1; overflow-y: auto; padding: 16px; }
      .scx-panel-section { display: none; }
      .scx-panel-section.active { display: block; }
      .scx-input-group { margin-bottom: 12px; }
      .scx-label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; display: block; }
      .scx-input { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; outline: none; box-sizing: border-box; transition: border 0.2s; }
      .scx-input:focus { border-color: #7c3aed; }
      .scx-textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; outline: none; resize: vertical; min-height: 60px; box-sizing: border-box; }
      .scx-textarea:focus { border-color: #7c3aed; }
      .scx-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
      .scx-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .scx-btn-primary { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; }
      .scx-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
      .scx-btn-green { background: linear-gradient(135deg, #059669, #047857); color: white; }
      .scx-btn-green:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
      .scx-btn-outline { background: white; color: #7c3aed; border: 1.5px solid #7c3aed; }
      .scx-btn-sm { width: auto; padding: 6px 12px; font-size: 11px; }
      .scx-result { margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; }
      .scx-result-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px; }
      .scx-error { margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; color: #dc2626; font-size: 12px; }
      .scx-status { text-align: center; padding: 20px; color: #6b7280; font-size: 13px; }
      .scx-spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top: 3px solid #7c3aed; border-radius: 50%; animation: scx-spin 0.8s linear infinite; margin-bottom: 8px; }
      @keyframes scx-spin { to { transform: rotate(360deg); } }
      .scx-preview-field { padding: 4px 0; font-size: 12px; display: flex; gap: 4px; }
      .scx-preview-label { color: #6b7280; font-weight: 500; flex-shrink: 0; }
      .scx-preview-value { color: #111827; font-weight: 600; word-break: break-word; }
      .scx-file-drop { border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; }
      .scx-file-drop:hover, .scx-file-drop.dragover { border-color: #7c3aed; background: #f5f3ff; }
      .scx-file-drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .scx-file-preview { margin-top: 8px; max-width: 100%; max-height: 120px; border-radius: 8px; object-fit: contain; }
      .scx-search-results { margin-top: 12px; }
      .scx-search-card { display: flex; gap: 10px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
      .scx-search-card:hover { border-color: #7c3aed; background: #faf5ff; }
      .scx-search-card-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; }
      .scx-search-card-info { flex: 1; min-width: 0; }
      .scx-search-card-title { font-size: 12px; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .scx-search-card-price { font-size: 12px; color: #059669; font-weight: 700; margin-top: 2px; }
      .scx-search-card-seller { font-size: 10px; color: #9ca3af; margin-top: 2px; }
      .scx-search-card-clone { padding: 4px 10px; font-size: 10px; font-weight: 700; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; flex-shrink: 0; align-self: center; }
      .scx-search-card-clone:hover { background: #047857; }
      .scx-divider { height: 1px; background: #e5e7eb; margin: 16px 0; }
      .scx-calc-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .scx-calc-row label { font-size: 12px; color: #374151; flex: 1; }
      .scx-calc-row input { width: 100px; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; text-align: right; }
      .scx-calc-result { background: #f8f9fa; border-radius: 10px; padding: 12px; margin-top: 8px; }
      .scx-calc-result-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
      .scx-calc-result-value { font-weight: 700; }
    </style>
    
    <div class="scx-panel-header">
      <div class="scx-panel-header-left">
        <div class="scx-panel-logo">🚀</div>
        <div>
          <div class="scx-panel-title">SellerCloudX</div>
          <div class="scx-panel-subtitle">AI Auto v${SCX_VERSION}</div>
        </div>
      </div>
      <button class="scx-panel-close" id="scx-panel-close">✕</button>
    </div>
    
    <div class="scx-panel-nav">
      <button class="scx-panel-nav-btn active" data-section="ai">🤖 AI Scanner</button>
      <button class="scx-panel-nav-btn" data-section="search">🔍 Qidiruv</button>
      <button class="scx-panel-nav-btn" data-section="clone">📋 Klonlash</button>
      <button class="scx-panel-nav-btn" data-section="calc">💰 Kalkulyator</button>
    </div>
    
    <div class="scx-panel-body">
      <!-- AI SCANNER SECTION -->
      <div class="scx-panel-section active" id="scx-section-ai">
        <div class="scx-file-drop" id="scx-image-drop">
          <div style="font-size:32px;margin-bottom:8px;">📷</div>
          <div style="font-size:13px;color:#6b7280;">Rasm yuklang yoki tashlang</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">AI mahsulotni rasmdan taniydi va kartochkani 3 bosqichda AVTOMATIK yaratadi</div>
          <input type="file" accept="image/*" id="scx-image-input" />
        </div>
        <img id="scx-image-preview" class="scx-file-preview" style="display:none;" />
        <div id="scx-image-result"></div>
        <div class="scx-divider"></div>
        <div class="scx-input-group">
          <label class="scx-label">yoki mahsulot nomini yozing</label>
          <input class="scx-input" id="scx-ai-name" placeholder="Masalan: iPhone 15 Pro uchun silikon chexol" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="scx-input-group">
            <label class="scx-label">Kategoriya</label>
            <input class="scx-input" id="scx-ai-cat" placeholder="Aksessuarlar" />
          </div>
          <div class="scx-input-group">
            <label class="scx-label">Brend</label>
            <input class="scx-input" id="scx-ai-brand" placeholder="Samsung" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="scx-input-group">
            <label class="scx-label">Narx (so'm)</label>
            <input class="scx-input" id="scx-ai-price" type="number" placeholder="150000" />
          </div>
          <div class="scx-input-group">
            <label class="scx-label">Soni</label>
            <input class="scx-input" id="scx-ai-qty" type="number" placeholder="100" value="100" />
          </div>
        </div>
        <div class="scx-input-group">
          <label class="scx-label">Qo'shimcha</label>
          <textarea class="scx-textarea" id="scx-ai-desc" placeholder="Mahsulot haqida qo'shimcha..."></textarea>
        </div>
        <button class="scx-btn scx-btn-primary" id="scx-ai-generate">🤖 AI kartochka yaratish (3 bosqich AVTO)</button>
        <div style="font-size:10px;color:#9ca3af;text-align:center;margin-top:4px;">
          Tugma bosilgandan so'ng 3 bosqichda avtomatik to'ldiriladi:<br>
          1️⃣ Nom, tavsif, foto → 2️⃣ SKU, narx, o'lcham → 3️⃣ Atributlar → Tayyor!
        </div>
        <div id="scx-ai-result"></div>
      </div>
      
      <!-- SEARCH SECTION -->
      <div class="scx-panel-section" id="scx-section-search">
        <div class="scx-input-group">
          <label class="scx-label">Uzum Market'dan mahsulot qidiring</label>
          <div style="display:flex;gap:8px;">
            <input class="scx-input" id="scx-search-query" placeholder="Mahsulot nomini yozing..." style="flex:1;" />
            <button class="scx-btn scx-btn-primary scx-btn-sm" id="scx-search-btn" style="width:auto;padding:10px 16px;">🔍</button>
          </div>
        </div>
        <div id="scx-search-results" class="scx-search-results"></div>
      </div>
      
      <!-- CLONE SECTION -->
      <div class="scx-panel-section" id="scx-section-clone">
        <div class="scx-input-group">
          <label class="scx-label">Mahsulot URL (Uzum, Wildberries, Yandex)</label>
          <input class="scx-input" id="scx-clone-url" placeholder="https://uzum.uz/product/... yoki wildberries.ru/..." />
        </div>
        <button class="scx-btn scx-btn-green" id="scx-clone-fetch">📋 Klonlash (3 bosqich AVTO)</button>
        <div style="font-size:10px;color:#9ca3af;text-align:center;margin-top:4px;">URL kiriting — 3 bosqichda avtomatik yaratiladi</div>
        <div id="scx-clone-result"></div>
        <div class="scx-divider"></div>
        <p style="font-size:11px;color:#9ca3af;text-align:center;">
          ✅ Uzum Market, Wildberries, Yandex Market URL qo'llab-quvvatlanadi
        </p>
      </div>
      
      <!-- CALCULATOR SECTION -->
      <div class="scx-panel-section" id="scx-section-calc">
        <div class="scx-calc-row"><label>Sotuv narxi (so'm)</label><input type="number" id="scx-c-sell" placeholder="150000" class="scx-input" style="width:120px;"></div>
        <div class="scx-calc-row"><label>Tannarx (so'm)</label><input type="number" id="scx-c-cost" placeholder="80000" class="scx-input" style="width:120px;"></div>
        <div class="scx-calc-row"><label>Komissiya (%)</label><input type="number" id="scx-c-comm" value="15" class="scx-input" style="width:120px;"></div>
        <div class="scx-calc-row"><label>Logistika (so'm)</label><input type="number" id="scx-c-logi" value="15000" class="scx-input" style="width:120px;"></div>
        <div class="scx-calc-result" id="scx-calc-out">
          <div class="scx-calc-result-row"><span>Komissiya</span><span class="scx-calc-result-value" id="scx-co-comm">—</span></div>
          <div class="scx-calc-result-row"><span>Sof foyda</span><span class="scx-calc-result-value" id="scx-co-profit">—</span></div>
          <div class="scx-calc-result-row"><span>Marja</span><span class="scx-calc-result-value" id="scx-co-margin">—</span></div>
          <div class="scx-calc-result-row"><span>ROI</span><span class="scx-calc-result-value" id="scx-co-roi">—</span></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  panelVisible = true;

  // Nav switching
  panel.querySelectorAll('.scx-panel-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
      panel.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('scx-section-' + btn.dataset.section)?.classList.add('active');
    });
  });

  panel.querySelector('#scx-panel-close').addEventListener('click', () => { panel.remove(); panelVisible = false; });

  // Image upload
  const imageInput = panel.querySelector('#scx-image-input');
  const imageDrop = panel.querySelector('#scx-image-drop');
  imageDrop.addEventListener('dragover', (e) => { e.preventDefault(); imageDrop.classList.add('dragover'); });
  imageDrop.addEventListener('dragleave', () => imageDrop.classList.remove('dragover'));
  imageDrop.addEventListener('drop', (e) => { e.preventDefault(); imageDrop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); });
  imageInput.addEventListener('change', () => { if (imageInput.files[0]) handleImageFile(imageInput.files[0]); });

  panel.querySelector('#scx-ai-generate').addEventListener('click', handleAIGenerateAuto);
  panel.querySelector('#scx-search-btn').addEventListener('click', handleSearch);
  panel.querySelector('#scx-search-query').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
  panel.querySelector('#scx-clone-fetch').addEventListener('click', handleCloneAuto);
  ['scx-c-sell', 'scx-c-cost', 'scx-c-comm', 'scx-c-logi'].forEach(id => {
    panel.querySelector('#' + id)?.addEventListener('input', recalcProfit);
  });
}

// ===== IMAGE RECOGNITION =====
let currentImageBase64 = null;

async function handleImageFile(file) {
  if (!file.type.startsWith('image/')) { scxShowToast('❌ Faqat rasm fayllar', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { scxShowToast('❌ Rasm 10MB dan kichik bo\'lishi kerak', 'error'); return; }

  const preview = document.getElementById('scx-image-preview');
  const resultArea = document.getElementById('scx-image-result');

  const reader = new FileReader();
  reader.onload = (e) => { currentImageBase64 = e.target.result; preview.src = currentImageBase64; preview.style.display = 'block'; };
  reader.readAsDataURL(file);

  resultArea.innerHTML = '<div class="scx-status"><div class="scx-spinner"></div><div>AI mahsulotni tahlil qilmoqda...</div></div>';
  
  const token = await getAuthToken();
  if (!token) { resultArea.innerHTML = '<div class="scx-error">❌ Avval SellerCloudX\'ga kiring</div>'; return; }

  try {
    const base64 = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
    const resp = await fetch(`${SCX_SUPABASE_URL}/functions/v1/analyze-product-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    if (!resp.ok) throw new Error('Server xatosi: ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    if (data.name) document.getElementById('scx-ai-name').value = data.name;
    if (data.category) document.getElementById('scx-ai-cat').value = data.category;
    if (data.brand) document.getElementById('scx-ai-brand').value = data.brand;
    if (data.suggestedPrice) document.getElementById('scx-ai-price').value = data.suggestedPrice;
    if (data.description) document.getElementById('scx-ai-desc').value = data.description;

    resultArea.innerHTML = `
      <div class="scx-result">
        <div class="scx-result-title">✅ Mahsulot aniqlandi! (${data.confidence || 0}%)</div>
        <div class="scx-preview-field"><span class="scx-preview-label">Nomi:</span><span class="scx-preview-value">${data.name}</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">Kategoriya:</span><span class="scx-preview-value">${data.category}</span></div>
        <div style="margin-top:8px;font-size:11px;color:#059669;font-weight:600;">👆 Endi "AI kartochka yaratish" tugmasini bosing — 3 bosqichda avtomatik!</div>
      </div>
    `;
  } catch (err) {
    console.error('[SCX] Image analysis error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
  }
}

// ========================================================================
// ===== AI GENERATE — FULL 3-STEP AUTO =====
// ========================================================================
async function handleAIGenerateAuto() {
  const productName = document.getElementById('scx-ai-name')?.value?.trim();
  if (!productName) { scxShowToast('❌ Mahsulot nomini kiriting yoki rasm yuklang', 'error'); return; }

  const btn = document.getElementById('scx-ai-generate');
  const resultArea = document.getElementById('scx-ai-result');
  btn.disabled = true;
  showStatus('🤖 AI kartochka tayyorlayapti...');

  const token = await getAuthToken();
  if (!token) { 
    resultArea.innerHTML = '<div class="scx-error">❌ Avval SellerCloudX\'ga kiring</div>'; 
    btn.disabled = false; showStatus('❌ Login talab qilinadi', 'error'); return; 
  }

  try {
    showStatus('🤖 AI generatsiya qilmoqda...');
    const resp = await fetch(`${SCX_SUPABASE_URL}/functions/v1/prepare-uzum-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        productName,
        category: document.getElementById('scx-ai-cat')?.value?.trim(),
        brand: document.getElementById('scx-ai-brand')?.value?.trim(),
        price: parseFloat(document.getElementById('scx-ai-price')?.value) || undefined,
        description: document.getElementById('scx-ai-desc')?.value?.trim(),
      }),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Server xatosi: ' + resp.status); }
    const data = await resp.json();
    if (!data.success || !data.card) throw new Error('AI javob bermadi');
    const card = data.card;
    const price = parseFloat(document.getElementById('scx-ai-price')?.value) || 0;

    resultArea.innerHTML = `<div class="scx-result"><div class="scx-result-title">✅ AI kartochka tayyor — 3 bosqichda to'ldirilmoqda...</div></div>`;
    document.getElementById('scx-main-panel')?.remove();
    panelVisible = false;

    // Build full payload for 3-step wizard
    await startWizardAutomation({
      name_uz: card.name_uz || productName,
      name_ru: card.name_ru || productName,
      short_desc_uz: card.short_description_uz || '',
      short_desc_ru: card.short_description_ru || '',
      full_desc_uz: card.full_description_uz || '',
      full_desc_ru: card.full_description_ru || '',
      brand: card.brand || document.getElementById('scx-ai-brand')?.value?.trim() || '',
      images: [],
      properties: card.properties || [],
      seo_keywords: card.seo_keywords || [],
      price,
      sku: (card.name_uz || productName).substring(0, 20).replace(/\s+/g, '-').toUpperCase(),
    });
  } catch (err) {
    console.error('[SCX] AI generate error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
    showStatus('❌ ' + err.message, 'error');
  }
  btn.disabled = false;
}

// ========================================================================
// ===== CLONE — FULL 3-STEP AUTO =====
// ========================================================================
async function handleCloneAuto() {
  const url = document.getElementById('scx-clone-url')?.value?.trim();
  if (!url) { scxShowToast('❌ Mahsulot URL kiriting', 'error'); return; }
  const btn = document.getElementById('scx-clone-fetch');
  const resultArea = document.getElementById('scx-clone-result');
  btn.disabled = true;

  let marketplace = 'unknown';
  if (url.includes('uzum.uz')) marketplace = 'uzum';
  else if (url.includes('wildberries.ru') || url.includes('wb.ru')) marketplace = 'wildberries';
  else if (url.includes('market.yandex.ru') || url.includes('ya.cc')) marketplace = 'yandex';
  if (marketplace === 'unknown') { resultArea.innerHTML = '<div class="scx-error">❌ Faqat Uzum, Wildberries yoki Yandex Market URL</div>'; btn.disabled = false; return; }

  showStatus(`📋 ${marketplace.toUpperCase()} dan ma'lumotlar olinmoqda...`);

  try {
    let scraped = null;
    if (marketplace === 'uzum') scraped = await scrapeUzumProduct(url);
    else if (marketplace === 'wildberries') scraped = await scrapeWildberriesProduct(url);
    else if (marketplace === 'yandex') scraped = await scrapeYandexProduct(url);
    if (!scraped || !scraped.title) throw new Error('Mahsulot ma\'lumotlari topilmadi');

    resultArea.innerHTML = `<div class="scx-result"><div class="scx-result-title">✅ Ma'lumotlar olindi — 3 bosqichda to'ldirilmoqda...</div></div>`;

    const token = await getAuthToken();
    if (token) scxSaveScrapedData(marketplace, 'competitor_product', scraped, url);

    document.getElementById('scx-main-panel')?.remove();
    panelVisible = false;

    await startWizardAutomation({
      name_uz: scraped.title,
      name_ru: scraped.title,
      short_desc_uz: (scraped.description || '').substring(0, 390),
      short_desc_ru: (scraped.description || '').substring(0, 390),
      full_desc_uz: scraped.description || '',
      full_desc_ru: scraped.description || '',
      brand: scraped.brand || '',
      images: scraped.images || [],
      properties: (scraped.characteristics || []).map(c => ({ name_uz: c.name, name_ru: c.name, value_uz: c.value, value_ru: c.value })),
      seo_keywords: [],
      price: scraped.price || 0,
      sku: scraped.title.substring(0, 20).replace(/\s+/g, '-').toUpperCase(),
    });
  } catch (err) {
    console.error('[SCX] Clone error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
    showStatus('❌ ' + err.message, 'error');
  }
  btn.disabled = false;
}

// ========================================================================
// ===== 3-STEP WIZARD AUTOMATION =====
// ========================================================================

/**
 * Main entry: Navigate to create page if needed, then run wizard steps
 * Payload: { name_uz, name_ru, short_desc_uz, short_desc_ru, full_desc_uz, full_desc_ru,
 *            brand, images[], properties[], seo_keywords[], price, sku }
 */
async function startWizardAutomation(payload) {
  const isOnCreatePage = /\/(products|goods|product)\/(create|add|new)/.test(window.location.pathname);

  if (!isOnCreatePage) {
    showStatus('📄 Yaratish sahifasiga o\'tilmoqda...');
    
    // Try SPA navigation first
    const spaOk = await tryClickAddProduct();
    if (spaOk) {
      await sleep(3000);
      if (/\/(products|goods|product)\/(create|add|new)/.test(window.location.pathname)) {
        return await runWizardStep1(payload);
      }
    }
    
    // Fallback: hard navigate (save payload for after reload)
    console.log('[SCX] Using URL redirect to:', SCX_CREATE_URL);
    await chrome.storage.local.set({ scx_pending_autofill: JSON.parse(JSON.stringify(payload)) });
    window.location.href = SCX_CREATE_URL;
    return;
  }

  return await runWizardStep1(payload);
}

// ===== SPA Navigation: Try to click "Add product" =====
async function tryClickAddProduct() {
  const addTexts = ['добавить товар', 'добавить', 'создать товар', 'tovar qo\'shish', 'yangi tovar', 'создать', 'добавить продукт'];
  const allClickable = document.querySelectorAll('a, button, [role="button"]');
  for (const el of allClickable) {
    if (el.closest('#scx-main-panel, #scx-fab, #scx-toolbar, #scx-auto-status')) continue;
    const text = el.textContent.trim().toLowerCase();
    const href = (el.getAttribute('href') || '').toLowerCase();
    for (const t of addTexts) {
      if (text.includes(t) || href.includes('/create') || href.includes('/add')) {
        console.log('[SCX] Found add product button:', text);
        el.click();
        await sleep(2000);
        return true;
      }
    }
  }
  return false;
}

// ===== STEP 1: Category, Names, Descriptions, Photos, Characteristics =====
async function runWizardStep1(payload) {
  showStatus('📝 1-bosqich: Asosiy ma\'lumotlar...');
  
  // Wait for form to appear
  let formReady = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const inputs = findAllInputs();
    if (inputs.length > 0 || document.querySelector('form') || document.querySelector('[contenteditable="true"]')) {
      formReady = true; break;
    }
    showStatus(`📝 Forma kutilmoqda... (${i + 1}s)`);
  }
  if (!formReady) {
    showStatus('⚠️ Forma topilmadi', 'warning');
    return;
  }
  await sleep(1000);

  const filled = [];

  // --- 1.1 Category selection ---
  // Category is a nested dropdown wizard. We skip auto-selecting for now as it requires 
  // knowing exact category path. User should select category first, then we fill the rest.
  // We check if category is already selected (Принять button was clicked)
  showStatus('📝 Kategoriyani tekshirmoqda...');
  const categoryReady = !!document.querySelector('[class*="name"], [class*="title"]');
  // If we see "Категория товара" and no name fields yet, we might be on category step
  const nameFieldExists = findInputByLabel(['название товара на узбекском', 'название', 'nomi', 'name'], 'input');
  if (!nameFieldExists) {
    showStatus('⚠️ Avval kategoriyani tanlang va "Принять" bosing, keyin qayta urinib ko\'ring', 'warning');
    // Re-save payload so user can retry after selecting category
    await chrome.storage.local.set({ scx_pending_autofill: JSON.parse(JSON.stringify(payload)) });
    return;
  }

  // --- 1.2 Product Name (UZ) ---
  showStatus('📝 Mahsulot nomi (UZ)...');
  const nameUzInput = findInputByLabel(['на узбекском', 'узбекском', 'o\'zbekcha'], 'input') 
    || findInputByPlaceholder(['точное название'])
    || findInputNearText(['на узбекском'], 'input');
  if (nameUzInput) {
    fillReactInput(nameUzInput, payload.name_uz.substring(0, 90));
    filled.push('nom_uz');
    await sleep(500);
  }

  // --- 1.3 Product Name (RU) ---
  showStatus('📝 Mahsulot nomi (RU)...');
  // The RU field is the second "Точное название товара" input
  const allNameInputs = [...document.querySelectorAll('input')].filter(inp => {
    const ph = (inp.placeholder || '').toLowerCase();
    const nearText = (inp.closest('[class*="field"], [class*="form"]')?.textContent || '').toLowerCase();
    return ph.includes('точное название') || ph.includes('название товара') || nearText.includes('на русском');
  });
  const nameRuInput = findInputByLabel(['на русском', 'русском', 'ruscha'], 'input')
    || (allNameInputs.length >= 2 ? allNameInputs[1] : null);
  if (nameRuInput && nameRuInput !== nameUzInput) {
    fillReactInput(nameRuInput, payload.name_ru.substring(0, 90));
    filled.push('nom_ru');
    await sleep(500);
  }

  // --- 1.4 Brand: check "Отсутствует бренд" checkbox ---
  showStatus('🏷️ Brend...');
  if (!payload.brand || payload.brand.toLowerCase() === 'нет' || payload.brand.toLowerCase() === 'yo\'q') {
    clickCheckboxByText(['отсутствует бренд', 'бренд отсутствует']);
    filled.push('brend_skip');
  } else {
    // Try to select brand from dropdown
    const brandInput = findInputByLabel(['бренд', 'brand'], 'input, select, [role="combobox"]');
    if (brandInput) {
      brandInput.click();
      await sleep(500);
      // Search in dropdown
      const search = brandInput.closest('[class*="field"], [class*="form"]')?.querySelector('input[type="text"]') || brandInput;
      fillReactInput(search, payload.brand);
      await sleep(1000);
      const opts = document.querySelectorAll('[role="option"], [class*="option"], [class*="menu-item"]');
      let found = false;
      for (const opt of opts) {
        if (opt.textContent.trim().toLowerCase().includes(payload.brand.toLowerCase())) {
          opt.click(); found = true; break;
        }
      }
      if (!found) {
        // Brand not found — check "Отсутствует бренд"
        clickCheckboxByText(['отсутствует бренд']);
      }
      filled.push('brend');
    } else {
      clickCheckboxByText(['отсутствует бренд']);
    }
  }
  await sleep(500);

  // --- 1.5 Short Description (UZ + RU) — max 390 chars, keywords ---
  showStatus('📝 Qisqa tavsif...');
  const shortDescFields = findAllFieldsByLabel(['краткое описание']);
  if (shortDescFields.length >= 2) {
    // First is UZ, second is RU
    fillReactInput(shortDescFields[0], payload.short_desc_uz.substring(0, 390));
    await sleep(300);
    fillReactInput(shortDescFields[1], payload.short_desc_ru.substring(0, 390));
    filled.push('qisqa_tavsif');
  } else if (shortDescFields.length === 1) {
    fillReactInput(shortDescFields[0], payload.short_desc_uz.substring(0, 390));
    filled.push('qisqa_tavsif_uz');
  }
  await sleep(500);

  // --- 1.6 Full Description (Rich Text Editor, UZ + RU) ---
  showStatus('📄 To\'liq tavsif (rich kontent)...');
  const richEditors = document.querySelectorAll('[contenteditable="true"], .ql-editor, .ProseMirror, .tox-edit-area__iframe');
  if (richEditors.length >= 2) {
    fillContentEditable(richEditors[0], payload.full_desc_uz);
    await sleep(300);
    fillContentEditable(richEditors[1], payload.full_desc_ru);
    filled.push('rich_tavsif');
  } else if (richEditors.length === 1) {
    fillContentEditable(richEditors[0], payload.full_desc_uz);
    filled.push('rich_tavsif_uz');
  }
  await sleep(500);

  // --- 1.7 Photos ---
  if (payload.images.length > 0) {
    showStatus(`📷 ${payload.images.length} ta rasm yuklanmoqda...`);
    const imgInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
    if (imgInput) {
      try {
        const dt = new DataTransfer();
        let uploaded = 0;
        for (const imgUrl of payload.images.slice(0, 10)) {
          try {
            let r = null;
            try { r = await fetch(imgUrl, { mode: 'cors', credentials: 'omit' }); } catch {}
            if (!r?.ok) try { r = await fetch(imgUrl); } catch {}
            if (!r?.ok) continue;
            const blob = await r.blob();
            if (blob.size < 1000) continue;
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            dt.items.add(new File([blob], `product_${Date.now()}_${uploaded}.${ext}`, { type: blob.type || 'image/jpeg' }));
            uploaded++;
          } catch {}
        }
        if (uploaded > 0) {
          imgInput.files = dt.files;
          imgInput.dispatchEvent(new Event('change', { bubbles: true }));
          imgInput.dispatchEvent(new Event('input', { bubbles: true }));
          filled.push(`rasmlar(${uploaded})`);
          await sleep(3000);
        }
      } catch {}
    }
  }

  // --- 1.8 Свойства товара (Key properties UZ + RU) ---
  showStatus('📋 Svoystvalar to\'ldirilmoqda...');
  const propUzInput = findInputByLabel(['ключевое свойство на узбекском', 'свойство на узбекском', 'kalit xususiyat'], 'input, textarea');
  const propRuInput = findInputByLabel(['ключевое свойство на русском', 'свойство на русском'], 'input, textarea');
  if (propUzInput && payload.properties.length > 0) {
    const propText = payload.properties.map(p => `${p.name_uz || p.name_ru}: ${p.value_uz || p.value_ru}`).join(', ');
    fillReactInput(propUzInput, propText.substring(0, 255));
    filled.push('svoystvo_uz');
  }
  if (propRuInput && payload.properties.length > 0) {
    const propText = payload.properties.map(p => `${p.name_ru || p.name_uz}: ${p.value_ru || p.value_uz}`).join(', ');
    fillReactInput(propRuInput, propText.substring(0, 255));
    filled.push('svoystvo_ru');
  }
  await sleep(500);

  // --- 1.9 Click "Сохранить и продолжить" → Go to Step 2 ---
  showStatus('💾 1-bosqich saqlanmoqda... → 2-bosqichga o\'tilmoqda');
  await sleep(1000);
  
  const step1Saved = clickButtonByText(['сохранить и продолжить', 'сохранить', 'save and continue', 'saqlash va davom']);
  if (step1Saved) {
    console.log('[SCX] Step 1 saved, waiting for Step 2...');
    filled.push('step1_saved');
    
    // Save payload for Step 2 (in case page reloads)
    await chrome.storage.local.set({ 
      scx_wizard_step: 2, 
      scx_wizard_payload: JSON.parse(JSON.stringify(payload)),
      scx_wizard_filled: filled,
    });
    
    // Wait for Step 2 to load
    await sleep(4000);
    await runWizardStep2(payload, filled);
  } else {
    showStatus('⚠️ "Сохранить и продолжить" tugmasi topilmadi. Qo\'lda bosing.', 'warning');
    // Save state so user can trigger Step 2 manually
    await chrome.storage.local.set({ 
      scx_wizard_step: 2, 
      scx_wizard_payload: JSON.parse(JSON.stringify(payload)),
      scx_wizard_filled: filled,
    });
  }
}

// Helper: find all inputs/textareas near a label text (returns array)
function findAllFieldsByLabel(labelTexts) {
  const results = [];
  const allLabels = document.querySelectorAll('label, [class*="label"], [class*="Label"]');
  for (const label of allLabels) {
    const text = label.textContent.trim().toLowerCase();
    for (const st of labelTexts) {
      if (text.includes(st.toLowerCase())) {
        const container = label.closest('[class*="field"], [class*="form-group"], [class*="FormField"]') || label.parentElement;
        if (container) {
          const inp = container.querySelector('textarea, input[type="text"], input:not([type])');
          if (inp) results.push(inp);
        }
      }
    }
  }
  return results;
}

// ===== STEP 2: SKU, MXIK, Dimensions, Price =====
async function runWizardStep2(payload, filled = []) {
  showStatus('📝 2-bosqich: SKU va narx...');
  
  // Wait for SKU fields
  await sleep(2000);
  let skuReady = false;
  for (let i = 0; i < 15; i++) {
    const skuField = findInputByLabel(['sku'], 'input') || findInputByPlaceholder(['sku']);
    if (skuField) { skuReady = true; break; }
    await sleep(1000);
    showStatus(`📝 SKU formasini kutmoqda... (${i + 1}s)`);
  }

  // --- 2.1 SKU ---
  showStatus('🔖 SKU yozilmoqda...');
  const skuInput = findInputByLabel(['sku'], 'input') || findInputByPlaceholder(['sku']);
  if (skuInput) {
    fillReactInput(skuInput, payload.sku || 'SCX-' + Date.now().toString(36).toUpperCase());
    filled.push('sku');
    await sleep(1000);
  }

  // --- 2.2 Table fields: MXIK (ИКП/У), dimensions, weight, price ---
  showStatus('📏 O\'lchamlar va narx...');
  await sleep(1000);

  // Find table cells by header text
  const tableHeaders = document.querySelectorAll('th, thead td');
  const headerMap = {};
  tableHeaders.forEach((th, i) => {
    headerMap[th.textContent.trim().toLowerCase()] = i;
  });

  // Try to find editable cells in the table row
  const tableRow = document.querySelector('tbody tr, [class*="table"] [class*="row"]:not(:first-child)');
  if (tableRow) {
    const cells = tableRow.querySelectorAll('td, [class*="cell"]');
    const editableInputs = tableRow.querySelectorAll('input');
    
    // Fill dimensions (width, length, height in mm)
    for (const inp of editableInputs) {
      const nearText = (inp.closest('td')?.textContent || '').toLowerCase() + ' ' + (inp.placeholder || '').toLowerCase();
      const headerCell = inp.closest('td');
      const colIndex = headerCell ? [...headerCell.parentElement.children].indexOf(headerCell) : -1;
      const headerText = colIndex >= 0 ? (tableHeaders[colIndex]?.textContent || '').toLowerCase() : '';
      
      if (headerText.includes('ширина') || nearText.includes('ширина') || headerText.includes('width')) {
        fillReactInput(inp, '100'); filled.push('width');
      } else if (headerText.includes('длина') || nearText.includes('длина') || headerText.includes('length')) {
        fillReactInput(inp, '100'); filled.push('length');
      } else if (headerText.includes('высота') || nearText.includes('высота') || headerText.includes('height')) {
        fillReactInput(inp, '50'); filled.push('height');
      } else if (headerText.includes('вес') || nearText.includes('вес') || headerText.includes('weight')) {
        fillReactInput(inp, '200'); filled.push('weight');
      } else if (headerText.includes('цена') || nearText.includes('цена') || headerText.includes('price')) {
        if (payload.price > 0) {
          fillReactInput(inp, String(Math.round(payload.price)));
          filled.push('price');
        }
      }
      await sleep(200);
    }
  }

  // Also try standalone price/dimension inputs
  if (!filled.includes('price') && payload.price > 0) {
    const priceInput = findInputByLabel(['цена', 'narx', 'price', 'стоимость'], 'input[type="number"], input');
    if (priceInput) { fillReactInput(priceInput, String(Math.round(payload.price))); filled.push('price'); }
  }

  // Fill dimension inputs if they exist as standalone fields
  const dimFields = [
    { labels: ['ширина', 'width', 'kenglik'], value: '100', key: 'width' },
    { labels: ['длина', 'length', 'uzunlik'], value: '100', key: 'length' },
    { labels: ['высота', 'height', 'balandlik'], value: '50', key: 'height' },
    { labels: ['вес', 'weight', 'og\'irlik'], value: '200', key: 'weight' },
  ];
  for (const dim of dimFields) {
    if (!filled.includes(dim.key)) {
      const inp = findInputByLabel(dim.labels, 'input');
      if (inp) { fillReactInput(inp, dim.value); filled.push(dim.key); await sleep(200); }
    }
  }

  await sleep(500);

  // --- 2.3 Click "Сохранить и продолжить" → Go to Step 3 ---
  showStatus('💾 2-bosqich saqlanmoqda... → 3-bosqichga o\'tilmoqda');
  await sleep(1000);

  const step2Saved = clickButtonByText(['сохранить и продолжить', 'сохранить', 'save and continue']);
  if (step2Saved) {
    console.log('[SCX] Step 2 saved, waiting for Step 3...');
    filled.push('step2_saved');
    
    await chrome.storage.local.set({
      scx_wizard_step: 3,
      scx_wizard_payload: JSON.parse(JSON.stringify(payload)),
      scx_wizard_filled: filled,
    });

    await sleep(4000);
    await runWizardStep3(payload, filled);
  } else {
    showStatus('⚠️ 2-bosqich: Saqlash tugmasini qo\'lda bosing', 'warning');
    await chrome.storage.local.set({ scx_wizard_step: 3, scx_wizard_payload: JSON.parse(JSON.stringify(payload)), scx_wizard_filled: filled });
  }
}

// ===== STEP 3: Final Attributes + Завершить =====
async function runWizardStep3(payload, filled = []) {
  showStatus('📝 3-bosqich: Yakuniy atributlar...');
  
  await sleep(2000);

  // --- 3.1 Fill mandatory attribute fields (varies by category) ---
  // These appear as dropdowns/selects in a table: Бренд, Тип, Страна, etc.
  // Try to check "Отсутствует бренд" if brand field appears again
  clickCheckboxByText(['отсутствует бренд']);
  await sleep(300);

  // Try to fill any visible select/combobox fields with reasonable defaults
  const selectFields = document.querySelectorAll('select, [role="combobox"]');
  for (const sel of selectFields) {
    if (sel.closest('#scx-main-panel, #scx-fab, #scx-toolbar')) continue;
    if (sel.value || sel.textContent.trim() !== '') continue; // Already has value
    
    // Click to open and select first option
    sel.click();
    await sleep(300);
    const opts = document.querySelectorAll('[role="option"], option');
    if (opts.length > 1) {
      opts[1].click(); // Skip first (usually placeholder)
      await sleep(200);
    }
  }
  
  filled.push('step3_attrs');
  await sleep(1000);

  // --- 3.2 Click "Завершить" ---
  showStatus('🏁 Kartochka yakunlanmoqda...');
  await sleep(500);

  const finished = clickButtonByText(['завершить', 'yakunlash', 'finish', 'готово', 'tayyor', 'done', 'complete', 'сохранить']);
  if (finished) {
    filled.push('finished');
    await chrome.storage.local.remove(['scx_wizard_step', 'scx_wizard_payload', 'scx_wizard_filled', 'scx_pending_autofill']);
    showStatus('✅ Kartochka muvaffaqiyatli yaratildi! 🎉', 'success');
    console.log('[SCX] ✅ 3-step wizard complete:', filled);
  } else {
    showStatus('⚠️ "Завершить" tugmasini qo\'lda bosing', 'warning');
  }
}

// ========================================================================
// ===== SEARCH =====
// ========================================================================
async function handleSearch() {
  const query = document.getElementById('scx-search-query')?.value?.trim();
  if (!query) { scxShowToast('❌ Qidiruv so\'zini kiriting', 'error'); return; }
  const btn = document.getElementById('scx-search-btn');
  const resultsArea = document.getElementById('scx-search-results');
  btn.disabled = true;
  resultsArea.innerHTML = '<div class="scx-status"><div class="scx-spinner"></div><div>Qidirilmoqda...</div></div>';

  try {
    const searchResp = await fetch('https://graphql.uzum.uz/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'uz-UZ' },
      body: JSON.stringify({
        operationName: 'getMakeSearch',
        variables: { queryInput: { text: query, showAdultContent: 'NONE', sort: 'BY_RELEVANCE_DESC', pagination: { offset: 0, limit: 20 } } },
        query: `query getMakeSearch($queryInput: MakeSearchQueryInput!) { makeSearch(query: $queryInput) { items { catalogCard { productId title { full } ordersQuantity reviewsQuantity photos { original { high } } badges { ... on BottomTextBadge { text backgroundColor } } } } } }`
      }),
    });

    let products = [];
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const items = searchData?.data?.makeSearch?.items || [];
      products = items.map(item => {
        const card = item.catalogCard;
        if (!card) return null;
        return { id: card.productId, title: card.title?.full || '', image: card.photos?.[0]?.original?.high || '', orders: card.ordersQuantity || 0, reviews: card.reviewsQuantity || 0, price: card.badges?.find(b => b.text)?.text || '' };
      }).filter(Boolean);
    }

    if (products.length === 0) {
      resultsArea.innerHTML = '<div class="scx-status">Hech narsa topilmadi</div>';
      btn.disabled = false; return;
    }

    resultsArea.innerHTML = products.map(p => `
      <div class="scx-search-card" data-id="${p.id}">
        ${p.image ? `<img class="scx-search-card-img" src="${p.image}" onerror="this.style.display='none'" />` : '<div class="scx-search-card-img" style="display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>'}
        <div class="scx-search-card-info">
          <div class="scx-search-card-title">${p.title}</div>
          ${p.price ? `<div class="scx-search-card-price">${p.price}</div>` : ''}
          ${p.orders > 0 ? `<div class="scx-search-card-seller">📦 ${p.orders} buyurtma • ⭐ ${p.reviews} sharh</div>` : ''}
        </div>
        <button class="scx-search-card-clone" data-url="https://uzum.uz/product/-${p.id}">📋 Klon</button>
      </div>
    `).join('');

    resultsArea.querySelectorAll('.scx-search-card-clone').forEach(cloneBtn => {
      cloneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('scx-clone-url').value = cloneBtn.dataset.url;
        document.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-section="clone"]')?.classList.add('active');
        document.getElementById('scx-section-clone')?.classList.add('active');
        handleCloneAuto();
      });
    });
  } catch (err) {
    console.error('[SCX] Search error:', err);
    resultsArea.innerHTML = `<div class="scx-error">❌ Qidiruv xatosi: ${err.message}</div>`;
  }
  btn.disabled = false;
}

// ========================================================================
// ===== MARKETPLACE SCRAPERS =====
// ========================================================================

async function scrapeUzumProduct(url) {
  showStatus('🔍 Uzum sahifasi yuklanmoqda...');
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) throw new Error('Sahifa yuklanmadi: ' + resp.status);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  showStatus('📊 Ma\'lumotlar ajratilmoqda...');
  const scraped = { _source: 'uzum_clone', sourceUrl: url, images: [], characteristics: [], breadcrumbs: [] };
  const h1 = doc.querySelector('h1');
  if (h1) scraped.title = h1.textContent.trim();

  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const ld = JSON.parse(script.textContent);
      const graph = ld['@graph'] || [ld];
      for (const item of graph) {
        if (item['@type'] === 'Product' || item['@type'] === 'ProductGroup') {
          if (!scraped.title && item.name) scraped.title = String(item.name).trim();
          if (item.description) scraped.description = String(item.description).replace(/<[^>]*>/g, ' ').trim().substring(0, 2000);
          const imgs = Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []);
          imgs.forEach(u => {
            const hq = String(u).replace('/t_product_low.jpg', '/t_product_540_high.jpg');
            if (hq.includes('images.uzum.uz') && scraped.images.length < 15) scraped.images.push(hq);
          });
        }
      }
    } catch {}
  }

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

  doc.querySelectorAll('nav[aria-label] a, [class*="breadcrumb"] a').forEach(a => {
    const text = a.textContent.trim();
    if (text && text !== 'Главная' && text !== 'Bosh sahifa') scraped.breadcrumbs.push(text);
  });

  return scraped;
}

async function scrapeWildberriesProduct(url) {
  showStatus('🔍 Wildberries sahifasi yuklanmoqda...');
  const artMatch = url.match(/catalog\/(\d+)/);
  if (!artMatch) throw new Error('WB mahsulot ID topilmadi');
  const article = artMatch[1];
  const basketNum = Math.ceil(parseInt(article) / 1e5);
  const vol = Math.floor(parseInt(article) / 1e5);
  const part = Math.floor(parseInt(article) / 1e3);
  let basketHost = `basket-${String(basketNum).padStart(2, '0')}`;

  showStatus('📊 WB API dan ma\'lumotlar olinmoqda...');
  try {
    const cardResp = await fetch(`https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&nm=${article}`);
    const cardData = await cardResp.json();
    const product = cardData?.data?.products?.[0];
    if (!product) throw new Error('WB mahsulot topilmadi');
    const scraped = { _source: 'wb_clone', sourceUrl: url, title: product.name || '', brand: product.brand || '', description: '', images: [], characteristics: [] };
    for (let i = 1; i <= 10; i++) {
      scraped.images.push(`https://${basketHost}.wbbasket.ru/vol${vol}/part${part}/${article}/images/big/${i}.webp`);
    }
    try {
      const descResp = await fetch(`https://${basketHost}.wbbasket.ru/vol${vol}/part${part}/${article}/info/ru/card.json`);
      if (descResp.ok) {
        const descData = await descResp.json();
        scraped.description = descData.description || '';
        if (descData.options) descData.options.forEach(opt => scraped.characteristics.push({ name: opt.name, value: opt.value }));
      }
    } catch {}
    scraped.price = product.salePriceU ? Math.round(product.salePriceU / 100) : 0;
    return scraped;
  } catch (err) {
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (resp.ok) {
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return { _source: 'wb_clone_html', sourceUrl: url, title: doc.querySelector('h1')?.textContent?.trim() || 'WB Mahsulot', images: [], characteristics: [] };
      }
    } catch {}
    throw err;
  }
}

async function scrapeYandexProduct(url) {
  showStatus('🔍 Yandex Market sahifasi yuklanmoqda...');
  try {
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error('Sahifa yuklanmadi');
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    showStatus('📊 Ma\'lumotlar ajratilmoqda...');
    const scraped = { _source: 'yandex_clone', sourceUrl: url, title: doc.querySelector('h1')?.textContent?.trim() || '', description: '', images: [], characteristics: [] };
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const ld = JSON.parse(script.textContent);
        if (ld['@type'] === 'Product') {
          if (!scraped.title && ld.name) scraped.title = ld.name;
          if (ld.description) scraped.description = ld.description;
          if (ld.image) scraped.images.push(...(Array.isArray(ld.image) ? ld.image : [ld.image]));
          if (ld.brand?.name) scraped.brand = ld.brand.name;
        }
      } catch {}
    }
    return scraped;
  } catch (err) {
    throw new Error('Yandex ma\'lumotlari olib bo\'lmadi: ' + err.message);
  }
}

// ===== CALCULATOR =====
function recalcProfit() {
  const sell = parseFloat(document.getElementById('scx-c-sell')?.value) || 0;
  const cost = parseFloat(document.getElementById('scx-c-cost')?.value) || 0;
  const comm = parseFloat(document.getElementById('scx-c-comm')?.value) || 0;
  const logi = parseFloat(document.getElementById('scx-c-logi')?.value) || 0;
  const commAmount = sell * comm / 100;
  const profit = sell - cost - commAmount - logi;
  const margin = sell > 0 ? (profit / sell * 100) : 0;
  const roi = cost > 0 ? (profit / cost * 100) : 0;
  document.getElementById('scx-co-comm').textContent = scxFormatPrice(commAmount);
  const profitEl = document.getElementById('scx-co-profit');
  profitEl.textContent = scxFormatPrice(profit);
  profitEl.style.color = profit >= 0 ? '#22c55e' : '#ef4444';
  document.getElementById('scx-co-margin').textContent = margin.toFixed(1) + '%';
  document.getElementById('scx-co-roi').textContent = roi.toFixed(1) + '%';
}

// ===== FAB =====
function createFAB() {
  if (document.getElementById('scx-fab')) return;
  const fab = document.createElement('div');
  fab.id = 'scx-fab';
  fab.innerHTML = `
    <style>
      #scx-fab { position: fixed; bottom: 24px; right: 24px; z-index: 999997; width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #7c3aed, #6d28d9); box-shadow: 0 4px 20px rgba(124,58,237,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 24px; }
      #scx-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(124,58,237,0.5); }
    </style>
    <span>🚀</span>
  `;
  document.body.appendChild(fab);
  fab.addEventListener('click', () => {
    if (panelVisible) { document.getElementById('scx-main-panel')?.remove(); panelVisible = false; }
    else createMainPanel();
  });
}

// ===== Toolbar =====
function initToolbar() {
  if (document.getElementById('scx-toolbar')) return;
  scxCreateToolbar('Uzum Seller', '🟣');
  document.getElementById('scx-btn-scrape')?.addEventListener('click', () => {
    if (panelVisible) { document.getElementById('scx-main-panel')?.remove(); panelVisible = false; }
    else createMainPanel();
  });
  document.getElementById('scx-btn-panel')?.addEventListener('click', () => {
    if (!panelVisible) createMainPanel();
    setTimeout(() => {
      document.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
      document.querySelector('[data-section="calc"]')?.classList.add('active');
      document.getElementById('scx-section-calc')?.classList.add('active');
    }, 100);
  });
  const scrapeBtn = document.getElementById('scx-btn-scrape');
  if (scrapeBtn) { scrapeBtn.textContent = '🤖'; scrapeBtn.title = 'AI Scanner'; }
  const panelBtn = document.getElementById('scx-btn-panel');
  if (panelBtn) { panelBtn.textContent = '💰'; panelBtn.title = 'Foyda kalkulyator'; }
}

// ===== Command Handler =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_PING') { sendResponse({ pong: true, page: 'uzum-seller', version: SCX_VERSION }); return true; }
  if (msg.type === 'SCX_COMMAND') { handleCommand(msg).then(sendResponse); return true; }
});

async function handleCommand(msg) {
  const { command_type, payload } = msg;
  console.log('[SCX] Command:', command_type);
  try {
    if (command_type === 'create_product') return await runWizardStep1(payload);
    return { success: false, error: 'Noma\'lum buyruq: ' + command_type };
  } catch (err) { return { success: false, error: err.message }; }
}

// ===== Pending auto-fill check (after page navigation/reload) =====
async function checkPendingAutoFill() {
  try {
    const data = await chrome.storage.local.get(['scx_pending_autofill', 'scx_wizard_step', 'scx_wizard_payload', 'scx_wizard_filled']);
    
    // Check for wizard continuation (step 2 or 3)
    if (data.scx_wizard_step && data.scx_wizard_payload) {
      const step = data.scx_wizard_step;
      const payload = data.scx_wizard_payload;
      const filled = data.scx_wizard_filled || [];
      
      console.log(`[SCX] Resuming wizard at step ${step}`);
      showStatus(`📝 ${step}-bosqich davom ettirilmoqda...`);
      await sleep(3000);
      
      if (step === 2) await runWizardStep2(payload, filled);
      else if (step === 3) await runWizardStep3(payload, filled);
      return;
    }
    
    // Check for initial pending autofill (after redirect to create page)
    if (data.scx_pending_autofill) {
      console.log('[SCX] Found pending autofill data, starting wizard...');
      await chrome.storage.local.remove('scx_pending_autofill');
      showStatus('📝 Avvalgi so\'rov davom ettirilmoqda...');
      await sleep(3000);
      await runWizardStep1(data.scx_pending_autofill);
    }
  } catch (err) {
    console.error('[SCX] checkPendingAutoFill error:', err);
  }
}

// ===== Init =====
function initUzumSeller() {
  console.log(`[SCX] Initializing on ${SCX_CURRENT_DOMAIN}, path: ${window.location.pathname}`);
  initToolbar();
  createFAB();
  checkPendingAutoFill();

  // Watch for SPA navigations
  let lastPath = window.location.pathname;
  const navObserver = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      const newPath = window.location.pathname;
      console.log('[SCX] SPA navigation:', lastPath, '->', newPath);
      lastPath = newPath;
      // Check for pending wizard steps on any product-related navigation
      setTimeout(() => checkPendingAutoFill(), 3000);
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });
}

setTimeout(initUzumSeller, 1500);

} // end of duplicate guard
