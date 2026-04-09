/**
 * SellerCloudX Content Script — Uzum Seller Panel
 * seller.uzum.uz uchun AI Scanner + Klonlash + Qidiruv
 * v7.0 — Full In-Page Panel with Image Recognition, Search & Cross-Marketplace Clone
 */

// Prevent duplicate injection
if (window.__SCX_UZUM_SELLER_LOADED) {
  console.log('[SCX] Content script already loaded, skipping duplicate');
} else {
  window.__SCX_UZUM_SELLER_LOADED = true;

const SCX_VERSION = '7.0.0';
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

function fillField(labelTexts, value, inputSelector) {
  const input = findInputByLabel(labelTexts, inputSelector || 'input, textarea');
  if (input) { fillReactInput(input, value); return true; }
  return false;
}

// ===== Auth Helper =====
async function getAuthToken() {
  const config = await chrome.storage.local.get(['accessToken']);
  return config.accessToken || null;
}

// ===== MAIN PANEL =====
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
        transition: transform 0.3s ease;
        overflow: hidden;
      }
      .scx-panel-header {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      .scx-panel-header-left { display: flex; align-items: center; gap: 10px; }
      .scx-panel-logo { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .scx-panel-title { color: white; font-size: 15px; font-weight: 700; }
      .scx-panel-subtitle { color: rgba(255,255,255,0.7); font-size: 11px; }
      .scx-panel-close { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
      .scx-panel-close:hover { background: rgba(255,255,255,0.25); }
      
      .scx-panel-nav {
        display: flex; gap: 2px; padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #e5e7eb;
        flex-shrink: 0; overflow-x: auto;
      }
      .scx-panel-nav-btn {
        flex-shrink: 0; padding: 8px 12px; font-size: 11px; font-weight: 600;
        border: none; border-radius: 8px; cursor: pointer;
        background: transparent; color: #6b7280; transition: all 0.2s;
        white-space: nowrap;
      }
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
      
      .scx-progress { margin-top: 12px; }
      .scx-progress-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
      .scx-progress-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 3px; transition: width 0.5s ease; }
      .scx-progress-text { font-size: 11px; color: #6b7280; }
      
      .scx-file-drop { border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; }
      .scx-file-drop:hover, .scx-file-drop.dragover { border-color: #7c3aed; background: #f5f3ff; }
      .scx-file-drop-icon { font-size: 32px; margin-bottom: 8px; }
      .scx-file-drop-text { font-size: 13px; color: #6b7280; }
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
          <div class="scx-panel-subtitle">AI Scanner Pro v${SCX_VERSION}</div>
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
          <div class="scx-file-drop-icon">📷</div>
          <div class="scx-file-drop-text">Rasm yuklang yoki tashlang</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">AI mahsulotni rasmdan taniydi</div>
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
        <button class="scx-btn scx-btn-primary" id="scx-ai-generate">🤖 AI kartochka yaratish</button>
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
        <button class="scx-btn scx-btn-green" id="scx-clone-fetch">📋 Ma'lumotlarni olish</button>
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

  // Close
  panel.querySelector('#scx-panel-close').addEventListener('click', () => { panel.remove(); panelVisible = false; });

  // Image upload
  const imageInput = panel.querySelector('#scx-image-input');
  const imageDrop = panel.querySelector('#scx-image-drop');
  
  imageDrop.addEventListener('dragover', (e) => { e.preventDefault(); imageDrop.classList.add('dragover'); });
  imageDrop.addEventListener('dragleave', () => imageDrop.classList.remove('dragover'));
  imageDrop.addEventListener('drop', (e) => { e.preventDefault(); imageDrop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]); });
  imageInput.addEventListener('change', () => { if (imageInput.files[0]) handleImageFile(imageInput.files[0]); });

  // AI Generate
  panel.querySelector('#scx-ai-generate').addEventListener('click', handleAIGenerate);

  // Search
  panel.querySelector('#scx-search-btn').addEventListener('click', handleSearch);
  panel.querySelector('#scx-search-query').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

  // Clone
  panel.querySelector('#scx-clone-fetch').addEventListener('click', handleCloneFetch);

  // Calculator
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

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result;
    preview.src = currentImageBase64;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  // Analyze
  resultArea.innerHTML = '<div class="scx-status"><div class="scx-spinner"></div><div>AI mahsulotni tahlil qilmoqda...</div></div>';
  
  const token = await getAuthToken();
  if (!token) { resultArea.innerHTML = '<div class="scx-error">❌ Avval SellerCloudX\'ga kiring</div>'; return; }

  try {
    const base64 = await fileToBase64(file);
    const resp = await fetch(`${SCX_SUPABASE_URL}/functions/v1/analyze-product-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    if (!resp.ok) throw new Error('Server xatosi: ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    // Fill AI fields
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
        <div class="scx-preview-field"><span class="scx-preview-label">Brend:</span><span class="scx-preview-value">${data.brand || '—'}</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">Narx:</span><span class="scx-preview-value">${data.suggestedPrice ? scxFormatPrice(data.suggestedPrice) : '—'}</span></div>
        <div style="margin-top:8px;font-size:11px;color:#6b7280;">Yuqoridagi maydonlar avtomatik to'ldirildi. "AI kartochka yaratish" tugmasini bosing.</div>
      </div>
    `;
  } catch (err) {
    console.error('[SCX] Image analysis error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ===== AI GENERATE =====
async function handleAIGenerate() {
  const productName = document.getElementById('scx-ai-name')?.value?.trim();
  if (!productName) { scxShowToast('❌ Mahsulot nomini kiriting yoki rasm yuklang', 'error'); return; }

  const btn = document.getElementById('scx-ai-generate');
  const resultArea = document.getElementById('scx-ai-result');
  btn.disabled = true;
  
  resultArea.innerHTML = `
    <div class="scx-progress">
      <div class="scx-progress-bar"><div class="scx-progress-fill" id="scx-ai-progress" style="width:10%"></div></div>
      <div class="scx-progress-text" id="scx-ai-progress-text">AI kartochka tayyorlayapti...</div>
    </div>
  `;

  const token = await getAuthToken();
  if (!token) { resultArea.innerHTML = '<div class="scx-error">❌ Avval SellerCloudX\'ga kiring</div>'; btn.disabled = false; return; }

  try {
    updateProgress(30, 'AI generatsiya qilmoqda...');
    
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

    updateProgress(70, 'Natija qayta ishlanmoqda...');

    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Server xatosi: ' + resp.status); }
    const data = await resp.json();
    if (!data.success || !data.card) throw new Error('AI javob bermadi');

    updateProgress(100, 'Tayyor!');

    const card = data.card;
    resultArea.innerHTML = `
      <div class="scx-result">
        <div class="scx-result-title">✅ Kartochka tayyor!</div>
        <div class="scx-preview-field"><span class="scx-preview-label">UZ:</span><span class="scx-preview-value">${card.name_uz || '—'}</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">RU:</span><span class="scx-preview-value">${card.name_ru || '—'}</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">Xususiyatlar:</span><span class="scx-preview-value">${card.properties?.length || 0} ta</span></div>
        <button class="scx-btn scx-btn-primary" id="scx-ai-fill" style="margin-top:10px;">📝 Formani to'ldirish</button>
      </div>
    `;
    document.getElementById('scx-ai-fill').addEventListener('click', () => {
      fillUzumFormFromAI(card, parseFloat(document.getElementById('scx-ai-price')?.value) || 0);
    });
  } catch (err) {
    console.error('[SCX] AI generate error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
  }
  btn.disabled = false;
}

function updateProgress(pct, text) {
  const bar = document.getElementById('scx-ai-progress');
  const txt = document.getElementById('scx-ai-progress-text');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = text;
}

// ===== SEARCH UZUM PRODUCTS =====
async function handleSearch() {
  const query = document.getElementById('scx-search-query')?.value?.trim();
  if (!query) { scxShowToast('❌ Qidiruv so\'zini kiriting', 'error'); return; }

  const btn = document.getElementById('scx-search-btn');
  const resultsArea = document.getElementById('scx-search-results');
  btn.disabled = true;
  resultsArea.innerHTML = '<div class="scx-status"><div class="scx-spinner"></div><div>Qidirilmoqda...</div></div>';

  try {
    // Use uzum.uz search API (GraphQL endpoint)
    const searchResp = await fetch('https://graphql.uzum.uz/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'uz-UZ' },
      body: JSON.stringify({
        operationName: 'getMakeSearch',
        variables: { queryInput: { text: query, showAdultContent: 'NONE', sort: 'BY_RELEVANCE_DESC', pagination: { offset: 0, limit: 20 } } },
        query: `query getMakeSearch($queryInput: MakeSearchQueryInput!) { makeSearch(query: $queryInput) { items { catalogCard { productId title { full } ordersQuantity reviewsQuantity photos { original { high } } badges { ... on BottomTextBadge { text backgroundColor } } characteristicValues { title value } } } } }`
      }),
    });

    let products = [];

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const items = searchData?.data?.makeSearch?.items || [];
      products = items.map(item => {
        const card = item.catalogCard;
        if (!card) return null;
        return {
          id: card.productId,
          title: card.title?.full || '',
          image: card.photos?.[0]?.original?.high || '',
          orders: card.ordersQuantity || 0,
          reviews: card.reviewsQuantity || 0,
          price: card.badges?.find(b => b.text)?.text || '',
        };
      }).filter(Boolean);
    }

    // Fallback: DOM scrape via fetch if GraphQL fails
    if (products.length === 0) {
      try {
        const htmlResp = await fetch(`https://uzum.uz/search?query=${encodeURIComponent(query)}`, { credentials: 'omit' });
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          // Try to extract from __NUXT__ state
          const scripts = doc.querySelectorAll('script');
          for (const s of scripts) {
            const text = s.textContent || '';
            if (text.includes('__NUXT__') || text.includes('catalogCard')) {
              const matches = [...text.matchAll(/"productId"\s*:\s*(\d+)/g)];
              const titles = [...text.matchAll(/"full"\s*:\s*"([^"]+)"/g)];
              for (let i = 0; i < Math.min(matches.length, titles.length, 20); i++) {
                products.push({ id: matches[i][1], title: titles[i]?.[1] || 'Mahsulot', image: '', orders: 0, reviews: 0, price: '' });
              }
              break;
            }
          }
        }
      } catch {}
    }

    if (products.length === 0) {
      resultsArea.innerHTML = '<div class="scx-status">Hech narsa topilmadi</div>';
      btn.disabled = false;
      return;
    }

    resultsArea.innerHTML = products.map(p => `
      <div class="scx-search-card" data-id="${p.id}">
        ${p.image ? `<img class="scx-search-card-img" src="${p.image}" onerror="this.style.display='none'" />` : '<div class="scx-search-card-img" style="display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>'}
        <div class="scx-search-card-info">
          <div class="scx-search-card-title">${p.title}</div>
          ${p.price ? `<div class="scx-search-card-price">${p.price}</div>` : ''}
          ${p.orders > 0 ? `<div class="scx-search-card-seller">📦 ${p.orders} buyurtma • ⭐ ${p.reviews} sharh</div>` : ''}
        </div>
        <button class="scx-search-card-clone" data-url="https://uzum.uz/product/-${p.id}">📋</button>
      </div>
    `).join('');

    // Add clone handlers
    resultsArea.querySelectorAll('.scx-search-card-clone').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        document.getElementById('scx-clone-url').value = url;
        // Switch to clone tab
        document.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-section="clone"]')?.classList.add('active');
        document.getElementById('scx-section-clone')?.classList.add('active');
        handleCloneFetch();
      });
    });

  } catch (err) {
    console.error('[SCX] Search error:', err);
    resultsArea.innerHTML = `<div class="scx-error">❌ Qidiruv xatosi: ${err.message}</div>`;
  }
  btn.disabled = false;
}

// ===== CLONE FETCH =====
async function handleCloneFetch() {
  const url = document.getElementById('scx-clone-url')?.value?.trim();
  if (!url) { scxShowToast('❌ Mahsulot URL kiriting', 'error'); return; }

  const btn = document.getElementById('scx-clone-fetch');
  const resultArea = document.getElementById('scx-clone-result');
  btn.disabled = true;

  // Detect marketplace
  let marketplace = 'unknown';
  if (url.includes('uzum.uz')) marketplace = 'uzum';
  else if (url.includes('wildberries.ru') || url.includes('wb.ru')) marketplace = 'wildberries';
  else if (url.includes('market.yandex.ru') || url.includes('ya.cc')) marketplace = 'yandex';
  
  if (marketplace === 'unknown') {
    resultArea.innerHTML = '<div class="scx-error">❌ Faqat Uzum, Wildberries yoki Yandex Market URL qo\'llab-quvvatlanadi</div>';
    btn.disabled = false;
    return;
  }

  resultArea.innerHTML = `
    <div class="scx-progress">
      <div class="scx-progress-bar"><div class="scx-progress-fill" id="scx-clone-progress" style="width:10%"></div></div>
      <div class="scx-progress-text" id="scx-clone-progress-text">${marketplace} sahifasidan ma'lumotlar olinmoqda...</div>
    </div>
  `;

  try {
    let scraped = null;

    if (marketplace === 'uzum') {
      scraped = await scrapeUzumProduct(url);
    } else if (marketplace === 'wildberries') {
      scraped = await scrapeWildberriesProduct(url);
    } else if (marketplace === 'yandex') {
      scraped = await scrapeYandexProduct(url);
    }

    if (!scraped || !scraped.title) throw new Error('Mahsulot ma\'lumotlari topilmadi');

    updateCloneProgress(100, 'Tayyor!');

    resultArea.innerHTML = `
      <div class="scx-result">
        <div class="scx-result-title">✅ ${marketplace.toUpperCase()} dan ma'lumotlar olindi!</div>
        <div class="scx-preview-field"><span class="scx-preview-label">Nomi:</span><span class="scx-preview-value">${scraped.title}</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">Rasmlar:</span><span class="scx-preview-value">${(scraped.images || []).length} ta</span></div>
        <div class="scx-preview-field"><span class="scx-preview-label">Xususiyatlar:</span><span class="scx-preview-value">${(scraped.characteristics || []).length} ta</span></div>
        ${scraped.brand ? `<div class="scx-preview-field"><span class="scx-preview-label">Brend:</span><span class="scx-preview-value">${scraped.brand}</span></div>` : ''}
        <button class="scx-btn scx-btn-green" id="scx-clone-fill" style="margin-top:10px;">📝 Uzum formaga to'ldirish</button>
      </div>
    `;
    document.getElementById('scx-clone-fill').addEventListener('click', () => {
      fillUzumFormFromClone(scraped);
    });

    // Save to database
    const token = await getAuthToken();
    if (token) {
      scxSaveScrapedData(marketplace, 'competitor_product', scraped, url);
    }

  } catch (err) {
    console.error('[SCX] Clone error:', err);
    resultArea.innerHTML = `<div class="scx-error">❌ ${err.message}</div>`;
  }
  btn.disabled = false;
}

function updateCloneProgress(pct, text) {
  const bar = document.getElementById('scx-clone-progress');
  const txt = document.getElementById('scx-clone-progress-text');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = text;
}

// ===== MARKETPLACE SCRAPERS =====

async function scrapeUzumProduct(url) {
  updateCloneProgress(30, 'Uzum sahifasi yuklanmoqda...');
  const resp = await fetch(url, { credentials: 'omit' });
  if (!resp.ok) throw new Error('Sahifa yuklanmadi: ' + resp.status);
  const html = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  updateCloneProgress(60, 'Ma\'lumotlar ajratilmoqda...');

  const scraped = { _source: 'uzum_clone', sourceUrl: url, images: [], characteristics: [], breadcrumbs: [] };

  // Title
  const h1 = doc.querySelector('h1');
  if (h1) scraped.title = h1.textContent.trim();

  // JSON-LD
  try {
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
  } catch {}

  // Characteristics
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
  doc.querySelectorAll('nav[aria-label] a, [class*="breadcrumb"] a').forEach(a => {
    const text = a.textContent.trim();
    if (text && text !== 'Главная' && text !== 'Bosh sahifa') scraped.breadcrumbs.push(text);
  });

  return scraped;
}

async function scrapeWildberriesProduct(url) {
  updateCloneProgress(30, 'Wildberries sahifasi yuklanmoqda...');
  
  // Extract article from URL
  const artMatch = url.match(/catalog\/(\d+)/);
  if (!artMatch) throw new Error('WB mahsulot ID topilmadi');
  const article = artMatch[1];

  // WB card API
  const basketNum = Math.ceil(parseInt(article) / 1e5);
  const vol = Math.floor(parseInt(article) / 1e5);
  const part = Math.floor(parseInt(article) / 1e3);
  
  let basketHost = '';
  if (basketNum >= 0 && basketNum <= 143) basketHost = `basket-${String(basketNum).padStart(2, '0')}`;
  else basketHost = `basket-${basketNum}`;

  updateCloneProgress(50, 'WB API dan ma\'lumotlar olinmoqda...');

  try {
    const cardResp = await fetch(`https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&nm=${article}`);
    const cardData = await cardResp.json();
    const product = cardData?.data?.products?.[0];
    
    if (!product) throw new Error('WB mahsulot topilmadi');

    const scraped = {
      _source: 'wb_clone',
      sourceUrl: url,
      title: product.name || '',
      brand: product.brand || '',
      description: '',
      images: [],
      characteristics: [],
    };

    // Images
    for (let i = 1; i <= 10; i++) {
      scraped.images.push(`https://${basketHost}.wbbasket.ru/vol${vol}/part${part}/${article}/images/big/${i}.webp`);
    }

    // Fetch description
    try {
      const descResp = await fetch(`https://${basketHost}.wbbasket.ru/vol${vol}/part${part}/${article}/info/ru/card.json`);
      if (descResp.ok) {
        const descData = await descResp.json();
        scraped.description = descData.description || '';
        if (descData.options) {
          descData.options.forEach(opt => {
            scraped.characteristics.push({ name: opt.name, value: opt.value });
          });
        }
      }
    } catch {}

    scraped.price = product.salePriceU ? Math.round(product.salePriceU / 100) : 0;
    
    return scraped;
  } catch (err) {
    // Fallback: fetch HTML
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (resp.ok) {
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return {
          _source: 'wb_clone_html',
          sourceUrl: url,
          title: doc.querySelector('h1')?.textContent?.trim() || 'WB Mahsulot',
          images: [],
          characteristics: [],
        };
      }
    } catch {}
    throw err;
  }
}

async function scrapeYandexProduct(url) {
  updateCloneProgress(30, 'Yandex Market sahifasi yuklanmoqda...');
  
  try {
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error('Sahifa yuklanmadi');
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    updateCloneProgress(60, 'Ma\'lumotlar ajratilmoqda...');

    const scraped = {
      _source: 'yandex_clone',
      sourceUrl: url,
      title: doc.querySelector('h1')?.textContent?.trim() || '',
      description: '',
      images: [],
      characteristics: [],
    };

    // JSON-LD
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const ld = JSON.parse(script.textContent);
        if (ld['@type'] === 'Product') {
          if (!scraped.title && ld.name) scraped.title = ld.name;
          if (ld.description) scraped.description = ld.description;
          if (ld.image) {
            const imgs = Array.isArray(ld.image) ? ld.image : [ld.image];
            scraped.images.push(...imgs);
          }
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

// ===== FORM FILL: AI =====
async function fillUzumFormFromAI(card, price) {
  scxShowToast('📝 Forma to\'ldirilmoqda...', 'info');

  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    chrome.storage.local.set({ scx_pending_fill: { type: 'ai', card, price } });
    window.location.href = 'https://seller.uzum.uz/products/create';
    return;
  }

  await scxSleep(2000);
  const filled = [], failed = [];

  // Title
  const title = card.name_uz || card.name_ru || '';
  if (title) {
    fillField(['название', 'nomi', 'номи', 'наименование', 'name', 'title'], title, 'input[type="text"], input:not([type])') ? filled.push('nomi') : failed.push('nomi');
    await scxSleep(400);
  }

  // Description
  const desc = card.full_description_uz || card.full_description_ru || card.short_description_uz || '';
  if (desc) {
    const descArea = findInputByLabel(['описание', 'tavsif', 'description'], 'textarea, [contenteditable="true"], .ql-editor, .ProseMirror');
    if (descArea) {
      (descArea.contentEditable === 'true' || descArea.classList.contains('ql-editor') || descArea.classList.contains('ProseMirror'))
        ? fillContentEditable(descArea, desc) : fillReactInput(descArea, desc);
      filled.push('tavsif');
    } else {
      const tas = document.querySelectorAll('textarea');
      tas.length > 0 ? (fillReactInput(tas[0], desc), filled.push('tavsif')) : failed.push('tavsif');
    }
    await scxSleep(400);
  }

  // Brand
  if (card.brand) { fillField(['бренд', 'brand', 'brend'], card.brand, 'input, select') ? filled.push('brend') : failed.push('brend'); await scxSleep(400); }

  // Price
  if (price > 0) { fillField(['цена', 'narx', 'price'], String(price), 'input[type="number"], input') ? filled.push('narx') : failed.push('narx'); }

  // Properties
  if (card.properties?.length > 0) {
    let count = 0;
    for (const prop of card.properties) {
      const k = prop.name_uz || prop.name_ru;
      const v = prop.value_uz || prop.value_ru;
      if (k && v) { if (fillField([k, k.toLowerCase()], v, 'input, select')) count++; await scxSleep(250); }
    }
    if (count > 0) filled.push(`xususiyatlar(${count})`);
  }

  scxShowToast(`✅ To'ldirildi: ${filled.join(', ')}${failed.length ? ' | ⚠️ ' + failed.join(', ') : ''}`, filled.length ? 'success' : 'warning');
}

// ===== FORM FILL: CLONE =====
async function fillUzumFormFromClone(scraped) {
  scxShowToast('📝 Klonlash — forma to\'ldirilmoqda...', 'info');

  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    chrome.storage.local.set({ scx_pending_fill: { type: 'clone', scraped } });
    window.location.href = 'https://seller.uzum.uz/products/create';
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
    price: scraped.price || 0,
  });
}

// ===== CREATE PRODUCT (Full DOM automation) =====
async function handleCreateProduct(payload) {
  console.log('[SCX] === CREATE PRODUCT START ===');

  const title = payload.title || '';
  const description = payload.description || '';
  const brand = payload.brand || '';
  const images = payload.images || [];
  const characteristics = payload.characteristics || [];
  const price = payload.price || 0;

  scxShowToast('📦 Mahsulot yaratish boshlanmoqda...', 'info');

  if (!window.location.href.includes('/products/create') && !window.location.href.includes('/goods/create')) {
    clickButtonByText(['добавить товар', 'tovar qo\'shish', 'yangi tovar', 'создать товар']);
    if (!window.location.href.includes('/products/create')) window.location.href = 'https://seller.uzum.uz/products/create';
    await scxSleep(4000);
  }

  await scxSleep(2000);
  const filled = [], failed = [];

  // Title
  if (title) {
    const inp = findInputByLabel(['название', 'nomi', 'номи', 'наименование', 'name'], 'input[type="text"], input:not([type])');
    if (inp) { fillReactInput(inp, title); filled.push('nomi'); }
    else {
      const allInputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="number"])');
      allInputs.length > 0 ? (fillReactInput(allInputs[0], title), filled.push('nomi')) : failed.push('nomi');
    }
    await scxSleep(500);
  }

  // Brand
  if (brand) {
    const brandInput = findInputByLabel(['бренд', 'brand', 'brend'], 'input, select, [role="combobox"]');
    if (brandInput) {
      if (brandInput.tagName === 'SELECT' || brandInput.getAttribute('role') === 'combobox') {
        brandInput.click(); await scxSleep(500);
        const search = document.querySelector('[class*="search"] input, input[placeholder*="поиск"]');
        if (search) { fillReactInput(search, brand); await scxSleep(800); const opts = document.querySelectorAll('[role="option"]'); if (opts.length) { opts[0].click(); filled.push('brend'); } }
      } else { fillReactInput(brandInput, brand); filled.push('brend'); }
      await scxSleep(500);
    }
  }

  // Description
  if (description) {
    const descArea = findInputByLabel(['описание', 'tavsif', 'description'], 'textarea, [contenteditable="true"], .ql-editor, .ProseMirror');
    if (descArea) {
      (descArea.contentEditable === 'true' || descArea.classList.contains('ql-editor') || descArea.classList.contains('ProseMirror'))
        ? fillContentEditable(descArea, description) : fillReactInput(descArea, description);
      filled.push('tavsif');
    } else {
      const tas = document.querySelectorAll('textarea');
      tas.length > 0 ? (fillReactInput(tas[0], description), filled.push('tavsif')) : failed.push('tavsif');
    }
    await scxSleep(500);
  }

  // Price
  if (price > 0) {
    fillField(['цена', 'narx', 'price', 'стоимость'], String(price), 'input[type="number"], input') ? filled.push('narx') : failed.push('narx');
    await scxSleep(300);
  }

  // Characteristics
  if (characteristics.length > 0) {
    let count = 0;
    for (const c of characteristics) {
      const inp = findInputByLabel([c.name, c.name.toLowerCase()], 'input, select');
      if (inp) {
        if (inp.tagName === 'SELECT') {
          for (const opt of inp.querySelectorAll('option')) {
            if (opt.textContent.trim().toLowerCase().includes(c.value.toLowerCase())) {
              inp.value = opt.value; inp.dispatchEvent(new Event('change', { bubbles: true })); count++; break;
            }
          }
        } else { fillReactInput(inp, c.value); count++; }
        await scxSleep(300);
      }
    }
    if (count > 0) filled.push(`xususiyatlar(${count})`);
  }

  // Images
  if (images.length > 0) {
    const imgInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
    if (imgInput) {
      try {
        scxShowToast(`📷 ${images.length} ta rasm yuklanmoqda...`, 'info');
        const dt = new DataTransfer();
        let uploaded = 0;
        for (const imgUrl of images.slice(0, 10)) {
          try {
            let actualResp = null;
            try { actualResp = await fetch(imgUrl); } catch {}
            if (!actualResp?.ok) try { actualResp = await fetch(imgUrl, { mode: 'cors', credentials: 'omit' }); } catch {}
            if (!actualResp?.ok) continue;
            const blob = await actualResp.blob();
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
          await scxSleep(2000);
        }
      } catch { failed.push('rasmlar'); }
    } else failed.push('rasmlar');
  }

  console.log('[SCX] Filled:', filled, 'Failed:', failed);
  scxShowToast(`✅ To'ldirildi: ${filled.join(', ')}${failed.length ? ' | ⚠️ ' + failed.join(', ') : ''}`, filled.length ? 'success' : 'warning');
  return { success: true, result: { filled, failed } };
}

// ===== FAB =====
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
    if (panelVisible) {
      // Switch to calc tab
      document.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
      document.querySelector('[data-section="calc"]')?.classList.add('active');
      document.getElementById('scx-section-calc')?.classList.add('active');
    } else {
      createMainPanel();
      setTimeout(() => {
        document.querySelectorAll('.scx-panel-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.scx-panel-section').forEach(s => s.classList.remove('active'));
        document.querySelector('[data-section="calc"]')?.classList.add('active');
        document.getElementById('scx-section-calc')?.classList.add('active');
      }, 100);
    }
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
    switch (command_type) {
      case 'create_product': return await handleCreateProduct(payload);
      default: return { success: false, error: 'Noma\'lum buyruq: ' + command_type };
    }
  } catch (err) { return { success: false, error: err.message }; }
}

// ===== Pending fill check =====
async function checkPendingFill() {
  const data = await chrome.storage.local.get(['scx_pending_fill']);
  if (data.scx_pending_fill) {
    await chrome.storage.local.remove('scx_pending_fill');
    const pending = data.scx_pending_fill;
    await scxSleep(3000);
    if (pending.type === 'ai') await fillUzumFormFromAI(pending.card, pending.price);
    else if (pending.type === 'clone') {
      await handleCreateProduct({
        title: pending.scraped.title,
        description: pending.scraped.description,
        brand: pending.scraped.brand,
        images: pending.scraped.images,
        characteristics: pending.scraped.characteristics,
        price: pending.scraped.price || 0,
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
