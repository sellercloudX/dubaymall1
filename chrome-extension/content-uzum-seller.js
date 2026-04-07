/**
 * SellerCloudX Content Script — Uzum Seller Panel
 * seller.uzum.uz uchun maxsus funksiyalar
 * v5.2 — Duplicate injection guard + improved reliability
 */

// Prevent duplicate injection
if (window.__SCX_UZUM_SELLER_LOADED) {
  console.log('[SCX] Content script already loaded, skipping duplicate');
} else {
  window.__SCX_UZUM_SELLER_LOADED = true;

const SCX_UZUM_SELLER_VERSION = '5.2.0';

console.log(`[SCX v${SCX_UZUM_SELLER_VERSION}] Uzum Seller content script loaded`);

// ===== Settings =====
const uzumSettings = { overlayEnabled: true, profitEnabled: true };
chrome.storage.local.get(['setting_overlay', 'setting_profit'], (r) => {
  if (r.setting_overlay === false) uzumSettings.overlayEnabled = false;
  if (r.setting_profit === false) uzumSettings.profitEnabled = false;
});

// ===== Init =====
function initUzumSeller() {
  scxCreateToolbar('Uzum Seller', '🟣');
  
  const scrapeBtn = document.getElementById('scx-btn-scrape');
  scrapeBtn?.addEventListener('click', scrapeUzumFinance);
  
  const panelBtn = document.getElementById('scx-btn-panel');
  panelBtn?.addEventListener('click', toggleUzumPanel);
  
  const actionsDiv = document.querySelector('.scx-toolbar-actions');
  if (actionsDiv) {
    const profitBtn = document.createElement('button');
    profitBtn.className = 'scx-tb-btn';
    profitBtn.title = 'Foyda kalkulyator';
    profitBtn.textContent = '💰';
    profitBtn.addEventListener('click', toggleUzumProfitCalc);
    actionsDiv.insertBefore(profitBtn, actionsDiv.lastElementChild);
  }
  
  scxObserveNavigation(() => {
    injectUzumOverlays();
  });
  
  setTimeout(injectUzumOverlays, 2000);
}

// ===== DOM Utility Helpers =====

/** Wait for a selector to appear in DOM */
function waitForSelector(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error('waitForSelector timeout: ' + selector)); }, timeout);
  });
}

/** Find input by nearby label text (case-insensitive, partial match) */
function findInputByLabel(labelTexts, inputSelector = 'input, textarea, [contenteditable="true"]') {
  const labels = document.querySelectorAll('label, [class*="label"], [class*="Label"], .field-label, .form-label');
  for (const label of labels) {
    const text = label.textContent.trim().toLowerCase();
    for (const searchText of labelTexts) {
      if (text.includes(searchText.toLowerCase())) {
        // Check if label has for="" pointing to an input
        const forId = label.getAttribute('for');
        if (forId) {
          const input = document.getElementById(forId);
          if (input) return input;
        }
        // Check parent/sibling for input
        const container = label.closest('[class*="field"], [class*="form-group"], [class*="FormField"], [class*="row"], [class*="item"]') || label.parentElement;
        if (container) {
          const input = container.querySelector(inputSelector);
          if (input) return input;
        }
      }
    }
  }
  return null;
}

/** Fill a React-controlled input */
function fillReactInput(el, value) {
  if (!el || !value) return false;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

/** Fill contentEditable div */
function fillContentEditable(el, html) {
  if (!el) return false;
  el.focus();
  el.innerHTML = html;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

/** Click a button by text content */
function clickButtonByText(texts) {
  const buttons = document.querySelectorAll('button, [role="button"], a.btn, [class*="Button"], [class*="button"]');
  for (const btn of buttons) {
    const btnText = btn.textContent.trim().toLowerCase();
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase()) && !btn.disabled) {
        btn.click();
        return true;
      }
    }
  }
  return false;
}

/** Select dropdown option by text */
async function selectDropdownOption(triggerTexts, optionText) {
  // Find and click the dropdown trigger
  const trigger = findInputByLabel(triggerTexts, 'select, [class*="select"], [role="combobox"], [class*="dropdown"], button');
  if (trigger) {
    trigger.click();
    await scxSleep(500);
    // Look for option in dropdown menu
    const options = document.querySelectorAll('[role="option"], [class*="option"], [class*="menu-item"], li');
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase().includes(optionText.toLowerCase())) {
        opt.click();
        return true;
      }
    }
  }
  return false;
}

// ===== Finance Scraping =====
async function scrapeUzumFinance() {
  scxShowToast('🔍 Moliya ma\'lumotlari yig\'ilmoqda...', 'info');
  
  const url = window.location.href;
  const data = {};
  
  try {
    if (url.includes('/finance') || url.includes('/settlements') || url.includes('/billing')) {
      data.type = 'finance_settlement';
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const headers = [...table.querySelectorAll('thead th')].map(h => h.textContent.trim());
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
          if (cells.length > 0) rows.push(cells);
        });
        if (rows.length > 0) {
          data.tables = data.tables || [];
          data.tables.push({ headers, rows });
        }
      }
      const summaryCards = document.querySelectorAll('[class*="summary"], [class*="card"], [class*="stat"], [class*="total"]');
      data.summaryValues = [];
      summaryCards.forEach(card => {
        const text = card.textContent.trim();
        if (text && text.length < 200) data.summaryValues.push(text);
      });
    }
    
    if (url.includes('/orders') || url.includes('/fbs') || url.includes('/fbo')) {
      data.type = 'orders';
      data.orderRows = scxParseTableRows('table', {});
      const badges = document.querySelectorAll('[class*="badge"], [class*="count"]');
      data.pendingCounts = [];
      badges.forEach(b => {
        const num = scxParseNumber(b.textContent);
        if (num > 0) data.pendingCounts.push(num);
      });
    }
    
    if (url.includes('/products') || url.includes('/goods') || url.includes('/catalog')) {
      data.type = 'products';
      const productCards = document.querySelectorAll('[class*="product"], [class*="item"], tr');
      data.productCount = productCards.length;
    }
    
    if (Object.keys(data).length > 1) {
      await scxSaveScrapedData('uzum', data.type || 'general', data, url);
      scxShowToast(`✅ ${data.type || 'Ma\'lumotlar'} saqlandi (${JSON.stringify(data).length} bayt)`, 'success');
    } else {
      scxShowToast('⚠️ Bu sahifada yig\'iladigan ma\'lumot topilmadi', 'warning');
    }
  } catch (err) {
    console.error('[SCX] Uzum scrape error:', err);
    scxShowToast('❌ Xatolik: ' + err.message, 'error');
  }
}

// ===== Analytics Panel =====
let uzumPanelVisible = false;

async function toggleUzumPanel() {
  if (uzumPanelVisible) {
    document.getElementById('scx-analytics-panel')?.remove();
    uzumPanelVisible = false;
    return;
  }

  const config = await chrome.storage.local.get(['accessToken', 'userId']);
  if (!config.accessToken) {
    scxShowToast('❌ Avval SellerCloudX\'ga kiring', 'error');
    return;
  }

  const [connData, products] = await Promise.all([
    scxFetch(`marketplace_connections?user_id=eq.${config.userId}&marketplace=eq.uzum&is_active=eq.true&select=products_count,orders_count,total_revenue&limit=1`),
    scxFetch(`marketplace_products_cache?user_id=eq.${config.userId}&marketplace=eq.uzum&select=offer_id,data&order=synced_at.desc&limit=10`),
  ]);

  const conn = Array.isArray(connData) ? connData[0] : null;
  
  const panel = document.createElement('div');
  panel.id = 'scx-analytics-panel';
  panel.innerHTML = `
    <div class="scx-panel-header">
      <span>🟣 Uzum Analitika</span>
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
      ${Array.isArray(products) && products.length > 0 ? `
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Top mahsulotlar:</div>
        ${products.slice(0, 5).map(p => {
          const d = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
          return `<div class="scx-product-item">
            <div class="scx-product-info">
              <div class="scx-product-name">${d?.title || d?.name || p.offer_id}</div>
              <div class="scx-product-sku">SKU: ${p.offer_id}</div>
            </div>
            <div class="scx-product-stats">
              <div class="scx-product-price">${scxFormatPrice(d?.price || d?.sellPrice || 0)}</div>
            </div>
          </div>`;
        }).join('')}
      ` : ''}
    </div>
  `;
  document.body.appendChild(panel);
  uzumPanelVisible = true;

  document.getElementById('scx-panel-close')?.addEventListener('click', () => {
    panel.remove();
    uzumPanelVisible = false;
  });
}

// ===== Profit Calculator =====
let profitCalcVisible = false;

function toggleUzumProfitCalc() {
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
      <div class="scx-calc-row">
        <label>Sotuv narxi (so'm)</label>
        <input type="number" id="scx-sell-price" placeholder="150000">
      </div>
      <div class="scx-calc-row">
        <label>Tannarx (so'm)</label>
        <input type="number" id="scx-cost-price" placeholder="80000">
      </div>
      <div class="scx-calc-row">
        <label>Komissiya (%)</label>
        <input type="number" id="scx-commission" value="15" placeholder="15">
      </div>
      <div class="scx-calc-row">
        <label>Logistika (so'm)</label>
        <input type="number" id="scx-logistics" value="15000" placeholder="15000">
      </div>
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
  
  document.getElementById('scx-calc-close')?.addEventListener('click', () => {
    calc.remove();
    profitCalcVisible = false;
  });

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

// ===== Inline Overlays =====
function injectUzumOverlays() {
  if (!uzumSettings.overlayEnabled) return;
  const rows = document.querySelectorAll('tr[class*="row"], [class*="product-card"], [class*="ProductItem"]');
  rows.forEach(row => {
    if (row.querySelector('.scx-badge')) return;
    const priceEl = row.querySelector('[class*="price"], [class*="Price"]');
    if (priceEl) {
      const badge = document.createElement('span');
      badge.className = 'scx-badge';
      badge.textContent = '⚡ SCX';
      badge.title = 'SellerCloudX bilan boshqaring';
      priceEl.appendChild(badge);
    }
  });
}

// ===== Command Handler (from background) =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCX_PING') {
    sendResponse({ pong: true, page: 'uzum-seller', version: SCX_UZUM_SELLER_VERSION });
    return true;
  }
  if (msg.type === 'SCX_COMMAND') {
    handleUzumCommand(msg).then(sendResponse);
    return true;
  }
  if (msg.type === 'SCX_SETTING') {
    if (msg.setting === 'overlay') uzumSettings.overlayEnabled = msg.value;
    if (msg.setting === 'profit') uzumSettings.profitEnabled = msg.value;
  }
});

async function handleUzumCommand(msg) {
  const { command_type, payload } = msg;
  console.log('[SCX] Uzum command:', command_type, payload);
  
  try {
    switch (command_type) {
      case 'create_product':
        return await handleCreateProduct(payload);
      case 'update_price':
        return await handleUpdatePrice(payload);
      case 'update_stock':
        return await handleUpdateStock(payload);
      case 'toggle_boost':
        return { success: true, result: { message: 'Boost sahifasiga o\'ting' } };
      case 'generate_label':
        return { success: true, result: { message: 'Etiketka buyurtmalar sahifasida' } };
      default:
        return { success: false, error: 'Noma\'lum buyruq: ' + command_type };
    }
  } catch (err) {
    console.error('[SCX] Command error:', err);
    return { success: false, error: err.message };
  }
}

// ===== Create Product — Full DOM Automation =====
async function handleCreateProduct(payload) {
  console.log('[SCX] === CREATE PRODUCT START ===');
  console.log('[SCX] Payload keys:', Object.keys(payload || {}));
  
  // Get normalized fields (support both camelCase and snake_case)
  const title = payload.title || payload.title_uz || payload.titleUz || payload.title_ru || payload.titleRu || '';
  const description = payload.description || payload.description_uz || payload.descriptionUz || payload.description_ru || payload.descriptionRu || '';
  const brand = payload.brand || '';
  const barcode = payload.barcode || '';
  const mxikCode = payload.mxik_code || payload.mxikCode || '';
  const price = payload.price || 0;
  const weight = Number(payload.weight ?? payload.weight_kg ?? 0);
  const height = Number(payload.height ?? payload.height_cm ?? 0);
  const length = Number(payload.length ?? payload.length_cm ?? 0);
  const width = Number(payload.width ?? payload.width_cm ?? 0);
  const color = payload.color || '';
  const material = payload.material || '';
  const country = payload.country || payload.originCountry || '';
  const images = payload.images || payload.pictures || [];
  const categoryPath = payload.categoryPath || payload.category_path || payload.breadcrumbs || [];
  const characteristics = payload.characteristics || [];
  const variantGroups = payload.variantGroups || payload.variant_groups || [];
  
  scxShowToast('📦 Mahsulot yaratish boshlanmoqda...', 'info');
  
  // Step 1: Navigate to create page if not there
  const currentUrl = window.location.href;
  if (!currentUrl.includes('/products/create') && !currentUrl.includes('/goods/create') && !currentUrl.includes('/product/create')) {
    console.log('[SCX] Navigating to product creation page...');
    
    // Try to find "Create product" button on current page first
    const createBtnClicked = clickButtonByText([
      'добавить товар', 'tovar qo\'shish', 'yangi tovar', 'создать товар',
      'создать карточку', 'добавить', 'create product', 'add product'
    ]);
    
    if (!createBtnClicked) {
      // Direct navigation
      window.location.href = 'https://seller.uzum.uz/products/create';
    }
    
    await scxSleep(4000);
  }
  
  await scxSleep(2000);
  console.log('[SCX] On creation page, starting form fill...');
  
  let filledFields = [];
  let failedFields = [];

  // Step 2: Fill Title/Name
  if (title) {
    const titleInput = findInputByLabel(
      ['название', 'nomi', 'номи', 'наименование', 'mahsulot nomi', 'товар', 'name', 'title'],
      'input[type="text"], input:not([type])'
    );
    if (titleInput) {
      fillReactInput(titleInput, title);
      filledFields.push('title');
      console.log('[SCX] ✅ Title filled:', title.substring(0, 50));
    } else {
      // Fallback: try first visible text input
      const allInputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="number"])');
      if (allInputs.length > 0) {
        fillReactInput(allInputs[0], title);
        filledFields.push('title(fallback)');
        console.log('[SCX] ✅ Title filled (fallback):', title.substring(0, 50));
      } else {
        failedFields.push('title');
      }
    }
    await scxSleep(500);
  }

  // Step 3: Fill MXIK/IKPU code
  if (mxikCode) {
    const mxikInput = findInputByLabel(
      ['мхик', 'mxik', 'ikpu', 'ИК', 'код товара', 'tovar kodi', 'классификатор'],
      'input'
    );
    if (mxikInput) {
      fillReactInput(mxikInput, mxikCode);
      filledFields.push('mxik');
      console.log('[SCX] ✅ MXIK filled:', mxikCode);
      await scxSleep(1000); // Wait for MXIK search results
      
      // Try to select first result from MXIK dropdown
      const mxikOptions = document.querySelectorAll('[class*="option"], [class*="suggestion"], [class*="dropdown-item"], [role="option"]');
      if (mxikOptions.length > 0) {
        mxikOptions[0].click();
        console.log('[SCX] ✅ MXIK option selected');
        await scxSleep(500);
      }
    } else {
      failedFields.push('mxik');
    }
  }

  // Step 4: Fill Brand
  if (brand) {
    const brandInput = findInputByLabel(
      ['бренд', 'brand', 'brend', 'торговая марка', 'производитель', 'ishlab chiqaruvchi'],
      'input, select, [role="combobox"]'
    );
    if (brandInput) {
      if (brandInput.tagName === 'SELECT' || brandInput.getAttribute('role') === 'combobox') {
        brandInput.click();
        await scxSleep(500);
        // Type to search
        const searchInput = document.querySelector('[class*="search"] input, [role="combobox"] input, input[placeholder*="поиск"], input[placeholder*="qidirish"]');
        if (searchInput) {
          fillReactInput(searchInput, brand);
          await scxSleep(800);
          const opts = document.querySelectorAll('[role="option"], [class*="option"]');
          if (opts.length > 0) {
            opts[0].click();
            filledFields.push('brand');
            console.log('[SCX] ✅ Brand selected:', brand);
          }
        }
      } else {
        fillReactInput(brandInput, brand);
        filledFields.push('brand');
        console.log('[SCX] ✅ Brand filled:', brand);
      }
      await scxSleep(500);
    } else {
      failedFields.push('brand');
    }
  }

  // Step 5: Fill Description
  if (description) {
    const descArea = findInputByLabel(
      ['описание', 'tavsif', 'тавсиф', 'description', 'подробное', 'to\'liq'],
      'textarea, [contenteditable="true"], .ql-editor, .ProseMirror, [class*="editor"]'
    );
    if (descArea) {
      if (descArea.contentEditable === 'true' || descArea.classList.contains('ql-editor') || descArea.classList.contains('ProseMirror')) {
        fillContentEditable(descArea, description);
      } else {
        fillReactInput(descArea, description);
      }
      filledFields.push('description');
      console.log('[SCX] ✅ Description filled');
    } else {
      // Fallback: find any textarea
      const textareas = document.querySelectorAll('textarea');
      if (textareas.length > 0) {
        fillReactInput(textareas[0], description);
        filledFields.push('description(fallback)');
        console.log('[SCX] ✅ Description filled (fallback)');
      } else {
        failedFields.push('description');
      }
    }
    await scxSleep(500);
  }

  // Step 6: Fill Price
  if (price > 0) {
    const priceInput = findInputByLabel(
      ['цена', 'narx', 'нарх', 'стоимость', 'price', 'sotuv narxi', 'розничная'],
      'input[type="number"], input'
    );
    if (priceInput) {
      fillReactInput(priceInput, String(price));
      filledFields.push('price');
      console.log('[SCX] ✅ Price filled:', price);
    } else {
      failedFields.push('price');
    }
    await scxSleep(300);
  }

  // Step 7: Fill Barcode
  if (barcode) {
    const barcodeInput = findInputByLabel(
      ['штрихкод', 'barcode', 'shtrix', 'ean', 'штрих-код', 'бар-код'],
      'input'
    );
    if (barcodeInput) {
      fillReactInput(barcodeInput, barcode);
      filledFields.push('barcode');
      console.log('[SCX] ✅ Barcode filled:', barcode);
    }
    await scxSleep(300);
  }

  // Step 8: Fill Characteristics (rang, razmer, etc.)
  if (characteristics.length > 0) {
    let charsFilled = 0;
    for (const char of characteristics) {
      const charInput = findInputByLabel(
        [char.name, char.name.toLowerCase()],
        'input, select, [role="combobox"]'
      );
      if (charInput) {
        if (charInput.tagName === 'SELECT') {
          // Try to find matching option
          const options = charInput.querySelectorAll('option');
          for (const opt of options) {
            if (opt.textContent.trim().toLowerCase().includes(char.value.toLowerCase())) {
              charInput.value = opt.value;
              charInput.dispatchEvent(new Event('change', { bubbles: true }));
              charsFilled++;
              break;
            }
          }
        } else {
          fillReactInput(charInput, char.value);
          charsFilled++;
        }
        await scxSleep(300);
      }
    }
    if (charsFilled > 0) {
      filledFields.push(`characteristics(${charsFilled}/${characteristics.length})`);
      console.log(`[SCX] ✅ ${charsFilled}/${characteristics.length} characteristics filled`);
    }
  }

  // Step 8.5: Fill extra metadata fields that AI already generated
  const textMetaFields = [
    { key: 'color', value: color, labels: ['цвет', 'rang', 'color'] },
    { key: 'material', value: material, labels: ['материал', 'material'] },
    { key: 'country', value: country, labels: ['страна производства', 'страна', 'country', 'mamlakat'] },
  ];

  for (const field of textMetaFields) {
    if (!field.value) continue;
    let filled = false;
    const input = findInputByLabel(field.labels, 'input, textarea, select');
    if (input) {
      if (input.tagName === 'SELECT') {
        const options = input.querySelectorAll('option');
        for (const opt of options) {
          if (opt.textContent.trim().toLowerCase().includes(String(field.value).toLowerCase())) {
            input.value = opt.value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filled = true;
            break;
          }
        }
      } else {
        filled = fillReactInput(input, String(field.value));
      }
    }
    if (!filled) {
      filled = await selectDropdownOption(field.labels, String(field.value));
    }
    if (filled) {
      filledFields.push(field.key);
      console.log(`[SCX] ✅ ${field.key} filled:`, field.value);
      await scxSleep(250);
    }
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
    if (input) {
      fillReactInput(input, String(field.value));
      filledFields.push(field.key);
      console.log(`[SCX] ✅ ${field.key} filled:`, field.value);
      await scxSleep(250);
    }
  }

  // Step 9: Upload Images
  if (images.length > 0) {
    const imgInput = document.querySelector('input[type="file"][accept*="image"], input[type="file"]');
    if (imgInput) {
      try {
        console.log(`[SCX] Uploading ${images.length} images...`);
        scxShowToast(`📷 ${images.length} ta rasm yuklanmoqda...`, 'info');
        
        const dt = new DataTransfer();
        let uploadedCount = 0;
        
        for (const imgUrl of images.slice(0, 10)) {
          try {
            let actualResp = null;

            try {
              const candidate = await fetch(imgUrl);
              if (candidate?.ok) actualResp = candidate;
            } catch {
              /* ignore first-pass fetch */
            }

            if (!actualResp) {
              try {
                const candidate = await fetch(imgUrl, { mode: 'cors', credentials: 'omit' });
                if (candidate?.ok) actualResp = candidate;
              } catch {
                /* ignore cors fallback */
              }
            }

            if (!actualResp?.ok) {
              console.warn('[SCX] Image fetch failed or blocked:', imgUrl.substring(0, 80));
              continue;
            }

            const blob = await actualResp.blob();
            if (blob.size < 1000) continue; // Skip tiny/broken images
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const file = new File([blob], `product_${Date.now()}_${uploadedCount}.${ext}`, { type: blob.type || 'image/jpeg' });
            dt.items.add(file);
            uploadedCount++;
          } catch (e) {
            console.warn('[SCX] Image fetch failed:', imgUrl, e.message);
          }
        }
        
        if (uploadedCount > 0) {
          imgInput.files = dt.files;
          imgInput.dispatchEvent(new Event('change', { bubbles: true }));
          imgInput.dispatchEvent(new Event('input', { bubbles: true }));
          filledFields.push(`images(${uploadedCount})`);
          console.log(`[SCX] ✅ ${uploadedCount} images uploaded`);
          await scxSleep(2000); // Wait for image upload processing
        }
      } catch (e) {
        console.warn('[SCX] Image upload error:', e);
        failedFields.push('images');
      }
    } else {
      // Try drag-and-drop zone
      const dropZone = document.querySelector('[class*="upload"], [class*="dropzone"], [class*="drop-zone"], [class*="image-upload"]');
      if (dropZone) {
        console.log('[SCX] Found drop zone, images need manual upload');
        failedFields.push('images(manual)');
      } else {
        failedFields.push('images');
      }
    }
  }

  // Step 10: Try to submit the form
  console.log('[SCX] Form fill complete. Attempting submit...');
  console.log('[SCX] Filled:', filledFields.join(', '));
  console.log('[SCX] Failed:', failedFields.join(', '));

  await scxSleep(1000);

  // Try to click the submit/save/publish button
  const submitClicked = clickButtonByText([
    'сохранить', 'saqlash', 'опубликовать', 'nashr', 'создать', 'yaratish',
    'добавить товар', 'tovar qo\'shish', 'submit', 'save', 'publish',
    'создать карточку', 'kartochka yaratish'
  ]);

  if (submitClicked) {
    console.log('[SCX] ✅ Submit button clicked');
    scxShowToast('⏳ Saqlanmoqda...', 'info');
    
    // Wait and check for success indicators
    await scxSleep(4000);
    
    // Check if we got redirected (success) or if there are errors
    const newUrl = window.location.href;
    const hasErrors = document.querySelectorAll('[class*="error"], [class*="Error"], .field-error, [class*="invalid"]');
    const visibleErrors = [...hasErrors].filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.textContent.trim().length > 0;
    });

    // Check for success toast/alert from Uzum
    const successIndicators = document.querySelectorAll('[class*="success"], [class*="Success"], [class*="toast"]');
    const hasSuccessToast = [...successIndicators].some(el => {
      const text = el.textContent.toLowerCase();
      return text.includes('успешно') || text.includes('muvaffaqiyatli') || text.includes('сохранен') || text.includes('saqlandi') || text.includes('создан');
    });

    if (hasSuccessToast || (!currentUrl.includes('/create') && newUrl !== currentUrl && !newUrl.includes('/create'))) {
      console.log('[SCX] ✅ Product saved successfully!');
      scxShowToast('✅ Mahsulot muvaffaqiyatli yaratildi!', 'success');
      return { 
        success: true, 
        result: { 
          saved: true, 
          submitted: true,
          filledFields, 
          failedFields,
          redirectedTo: newUrl !== currentUrl ? newUrl : undefined
        } 
      };
    }

    if (visibleErrors.length > 0) {
      const errorTexts = [...visibleErrors].slice(0, 3).map(el => el.textContent.trim()).join('; ');
      console.log('[SCX] ⚠️ Form has validation errors:', errorTexts);
      scxShowToast(`⚠️ Forma xatoliklari: ${errorTexts.substring(0, 100)}`, 'warning');
      return { 
        success: false, 
        result: { 
          saved: false, 
          submitted: true,
          filledFields, 
          failedFields,
          validationErrors: errorTexts,
          message: 'Forma to\'ldirildi lekin validatsiya xatoliklari bor: ' + errorTexts.substring(0, 200)
        },
        error: 'Validatsiya xatoliklari: ' + errorTexts.substring(0, 200)
      };
    }

    // Ambiguous - button was clicked but can't confirm result
    // Wait a bit more and check again
    await scxSleep(4000);
    const finalUrl = window.location.href;
    if (finalUrl !== currentUrl && !finalUrl.includes('/create')) {
      console.log('[SCX] ✅ Redirected after save — product likely created');
      return { 
        success: true, 
        result: { saved: true, submitted: true, filledFields, failedFields, redirectedTo: finalUrl } 
      };
    }

    // Still on create page — might have saved or might have errors
    // Check for success toast one more time
    const lateSuccess = document.querySelectorAll('[class*="success"], [class*="Success"], [class*="toast"], [class*="notification"]');
    const hasLateSuccess = [...lateSuccess].some(el => {
      const text = el.textContent.toLowerCase();
      return text.includes('успешно') || text.includes('muvaffaqiyatli') || text.includes('сохранен') || text.includes('saqlandi') || text.includes('создан');
    });
    if (hasLateSuccess) {
      console.log('[SCX] ✅ Late success toast detected');
      return { success: true, result: { saved: true, submitted: true, filledFields, failedFields } };
    }

    console.log('[SCX] ℹ️ Still on create page after submit');
    return { 
      success: false, 
      result: { 
        saved: false, 
        submitted: true,
        filledFields, 
        failedFields,
        message: 'Forma yuborildi, lekin saqlangan-saqlanmaganligini aniqlab bo\'lmadi. Iltimos, tekshiring.'
      },
      error: 'Saqlash natijasi aniqlanmadi — forma to\'ldirildi (' + filledFields.join(', ') + '), lekin tasdiqlash yo\'q'
    };
  } else {
    // Could not find submit button
    console.log('[SCX] ⚠️ Submit button not found');
    scxShowToast('⚠️ Ma\'lumotlar to\'ldirildi. Saqlash tugmasini topa olmadik — iltimos, qo\'lda saqlang!', 'warning');
    return { 
      success: false, 
      result: { 
        saved: false, 
        submitted: false,
        filledFields, 
        failedFields,
        message: 'Forma to\'ldirildi, lekin saqlash tugmasi topilmadi. Qo\'lda saqlang.'
      },
      error: 'Saqlash tugmasi topilmadi — forma to\'ldirildi (' + filledFields.join(', ') + '), lekin avtomatik saqlab bo\'lmadi'
    };
  }
}

async function handleUpdatePrice(payload) {
  scxShowToast('💰 Narx yangilash...', 'info');
  return { success: true, result: { saved: false, message: 'Narx yangilash API orqali amalga oshiriladi' } };
}

async function handleUpdateStock(payload) {
  scxShowToast('📊 Zaxira yangilash...', 'info');
  return { success: true, result: { saved: false, message: 'Zaxira yangilash API orqali amalga oshiriladi' } };
}

// ===== Start =====
setTimeout(initUzumSeller, 1000);

} // end of duplicate guard
