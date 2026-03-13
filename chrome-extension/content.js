/**
 * SellerCloudX Content Script — Uzum Seller Panel Automation
 * 
 * Bu script seller.uzum.uz sahifasida ishlaydi va
 * SellerCloudX dashboard'dan kelgan buyruqlarni bajaradi.
 */

console.log('[SellerCloudX] Content script loaded on', window.location.href);

// ===== Utility Functions =====

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSelector(selector, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(200);
  }
  return null;
}

async function waitForSelectorAll(selector, minCount = 1, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const els = document.querySelectorAll(selector);
    if (els.length >= minCount) return els;
    await sleep(200);
  }
  return document.querySelectorAll(selector);
}

function fillInput(input, value) {
  if (!input) return false;
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  
  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }
  
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function clickElement(el) {
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.click();
  return true;
}

// ===== Command Handlers =====

async function handleCreateProduct(payload) {
  console.log('[SCX] Creating product:', payload.title);
  
  // Navigate to product creation page
  const currentUrl = window.location.href;
  if (!currentUrl.includes('/products/create') && !currentUrl.includes('/goods/create')) {
    // Try to find "Add product" button or navigate directly
    window.location.href = 'https://seller.uzum.uz/goods/create';
    await sleep(3000);
  }
  
  // Wait for the form to load
  await sleep(2000);
  
  // Fill in title
  const titleInputs = document.querySelectorAll('input[type="text"], input[placeholder*="название"], input[placeholder*="nomi"]');
  for (const input of titleInputs) {
    const placeholder = (input.placeholder || '').toLowerCase();
    const label = input.closest('label, .form-group, [class*="field"]')?.textContent?.toLowerCase() || '';
    
    if (placeholder.includes('назван') || placeholder.includes('nomi') || label.includes('назван') || label.includes('название товара')) {
      fillInput(input, payload.titleRu || payload.title);
      console.log('[SCX] Filled title:', payload.titleRu || payload.title);
      break;
    }
  }
  
  // Fill description
  const textareas = document.querySelectorAll('textarea');
  for (const ta of textareas) {
    const label = ta.closest('label, .form-group, [class*="field"]')?.textContent?.toLowerCase() || '';
    if (label.includes('описан') || label.includes('tavsif') || label.includes('description')) {
      fillInput(ta, payload.descriptionRu || payload.description);
      console.log('[SCX] Filled description');
      break;
    }
  }
  
  // Fill price
  const priceInputs = document.querySelectorAll('input[type="number"], input[placeholder*="цена"], input[placeholder*="narx"]');
  for (const input of priceInputs) {
    const label = input.closest('label, .form-group, [class*="field"]')?.textContent?.toLowerCase() || '';
    if (label.includes('цена') || label.includes('narx') || label.includes('price')) {
      fillInput(input, String(payload.price));
      console.log('[SCX] Filled price:', payload.price);
      break;
    }
  }

  // Fill SKU
  if (payload.sku) {
    const skuInputs = document.querySelectorAll('input[placeholder*="SKU"], input[placeholder*="артикул"], input[placeholder*="sku"]');
    for (const input of skuInputs) {
      fillInput(input, payload.sku);
      console.log('[SCX] Filled SKU:', payload.sku);
      break;
    }
  }

  // Fill barcode
  if (payload.barcode) {
    const barcodeInputs = document.querySelectorAll('input[placeholder*="штрих"], input[placeholder*="barcode"], input[placeholder*="shtrix"]');
    for (const input of barcodeInputs) {
      fillInput(input, payload.barcode);
      console.log('[SCX] Filled barcode:', payload.barcode);
      break;
    }
  }

  // Fill brand
  if (payload.brandName) {
    const brandInputs = document.querySelectorAll('input[placeholder*="бренд"], input[placeholder*="brand"]');
    for (const input of brandInputs) {
      fillInput(input, payload.brandName);
      console.log('[SCX] Filled brand:', payload.brandName);
      break;
    }
  }
  
  // Upload images if URLs provided
  if (payload.images && payload.images.length > 0) {
    console.log('[SCX] Images to upload:', payload.images.length);
    // Image upload requires file input interaction — handled separately
    await handleImageUpload(payload.images);
  }

  // Fill attributes
  if (payload.attributes && payload.attributes.length > 0) {
    console.log('[SCX] Attributes to fill:', payload.attributes.length);
    for (const attr of payload.attributes) {
      // Try to find matching attribute fields
      const allInputs = document.querySelectorAll('input[type="text"]');
      for (const input of allInputs) {
        const label = input.closest('[class*="field"], [class*="attribute"], [class*="param"]')?.textContent || '';
        if (label.toLowerCase().includes(attr.name.toLowerCase())) {
          fillInput(input, attr.value);
          console.log(`[SCX] Filled attribute: ${attr.name} = ${attr.value}`);
          break;
        }
      }
    }
  }

  return { success: true, result: 'Product form filled' };
}

async function handleImageUpload(imageUrls) {
  // Download images and create File objects for upload
  for (const url of imageUrls) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `uzum-product-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Find file input
      const fileInput = document.querySelector('input[type="file"][accept*="image"]') 
                     || document.querySelector('input[type="file"]');
      
      if (fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[SCX] Image uploaded:', url.substring(0, 50));
        await sleep(1500); // Wait for upload processing
      } else {
        // Try drag-and-drop zone
        const dropZone = document.querySelector('[class*="upload"], [class*="dropzone"], [class*="drag"]');
        if (dropZone) {
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            dataTransfer: new DataTransfer(),
          });
          dropEvent.dataTransfer.items.add(file);
          dropZone.dispatchEvent(dropEvent);
          console.log('[SCX] Image dropped into zone');
          await sleep(1500);
        }
      }
    } catch (e) {
      console.error('[SCX] Image upload error:', e);
    }
  }
}

async function handleToggleBoost(payload) {
  console.log('[SCX] Toggle boost for product:', payload.productId);
  
  // Navigate to advertising/boost section
  if (!window.location.href.includes('/advertising') && !window.location.href.includes('/promotion')) {
    window.location.href = 'https://seller.uzum.uz/advertising';
    await sleep(3000);
  }
  
  // Find product in list and toggle
  const productElements = document.querySelectorAll('[class*="product"], [class*="item"], tr');
  for (const el of productElements) {
    if (el.textContent.includes(payload.sku || payload.productId)) {
      const toggle = el.querySelector('input[type="checkbox"], [class*="switch"], [class*="toggle"]');
      if (toggle) {
        clickElement(toggle);
        console.log('[SCX] Boost toggled');
        await sleep(1000);
        return { success: true, result: 'Boost toggled' };
      }
    }
  }
  
  return { success: false, error: 'Product not found for boost toggle' };
}

async function handleGenerateLabel(payload) {
  console.log('[SCX] Generate label for order:', payload.orderId);
  
  // Navigate to orders section
  if (!window.location.href.includes('/orders') && !window.location.href.includes('/fbs')) {
    window.location.href = 'https://seller.uzum.uz/orders';
    await sleep(3000);
  }
  
  // Find order and click print/label button
  const orderElements = document.querySelectorAll('[class*="order"], tr');
  for (const el of orderElements) {
    if (el.textContent.includes(payload.orderId)) {
      const labelBtn = el.querySelector('button[class*="print"], button[class*="label"], a[class*="print"]')
                    || el.querySelector('button');
      if (labelBtn && (labelBtn.textContent.toLowerCase().includes('этикет') || 
                       labelBtn.textContent.toLowerCase().includes('печат') ||
                       labelBtn.textContent.toLowerCase().includes('label'))) {
        clickElement(labelBtn);
        await sleep(2000);
        return { success: true, result: 'Label generation initiated' };
      }
    }
  }
  
  return { success: false, error: 'Order not found for label generation' };
}

async function handleUpdatePrice(payload) {
  console.log('[SCX] Update price:', payload.sku, '→', payload.newPrice);
  
  // Navigate to product edit page
  // This would need the exact product URL from Uzum
  return { success: true, result: 'Price update command received' };
}

async function handleUpdateStock(payload) {
  console.log('[SCX] Update stock:', payload.sku, '→', payload.newStock);
  return { success: true, result: 'Stock update command received' };
}

// ===== Message Listener =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'SCX_COMMAND') return;
  
  console.log('[SCX] Received command:', msg.command_type);
  
  (async () => {
    try {
      let result;
      
      switch (msg.command_type) {
        case 'create_product':
          result = await handleCreateProduct(msg.payload);
          break;
        case 'toggle_boost':
          result = await handleToggleBoost(msg.payload);
          break;
        case 'generate_label':
          result = await handleGenerateLabel(msg.payload);
          break;
        case 'batch_labels':
          // Process multiple labels sequentially
          for (const order of (msg.payload.orders || [])) {
            await handleGenerateLabel(order);
            await sleep(1000);
          }
          result = { success: true, result: 'Batch labels processed' };
          break;
        case 'update_price':
          result = await handleUpdatePrice(msg.payload);
          break;
        case 'update_stock':
          result = await handleUpdateStock(msg.payload);
          break;
        default:
          result = { success: false, error: `Unknown command: ${msg.command_type}` };
      }
      
      sendResponse(result);
    } catch (err) {
      console.error('[SCX] Command handler error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  
  return true; // Keep sendResponse alive for async
});

// ===== Status Indicator =====
function showStatusBadge() {
  const badge = document.createElement('div');
  badge.id = 'scx-status-badge';
  badge.innerHTML = `
    <div style="
      position: fixed; bottom: 16px; right: 16px; z-index: 99999;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white; border-radius: 12px; padding: 8px 14px;
      font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    " onmouseenter="this.style.transform='scale(1.05)'" 
      onmouseleave="this.style.transform='scale(1)'"
      title="SellerCloudX Extension ulangan">
      <span style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block;"></span>
      SCX Pro
    </div>
  `;
  document.body.appendChild(badge);
  
  // Auto-hide after 5 seconds, show on hover near corner
  setTimeout(() => {
    const el = badge.querySelector('div');
    if (el) el.style.opacity = '0.3';
  }, 5000);
  
  badge.addEventListener('mouseenter', () => {
    const el = badge.querySelector('div');
    if (el) el.style.opacity = '1';
  });
  badge.addEventListener('mouseleave', () => {
    const el = badge.querySelector('div');
    if (el) el.style.opacity = '0.3';
  });
}

// Show badge when on seller.uzum.uz
if (window.location.hostname === 'seller.uzum.uz') {
  showStatusBadge();
}

// Ping background on load
chrome.runtime.sendMessage({ type: 'SCX_PING' }, (response) => {
  if (response?.pong) {
    console.log('[SCX] Background worker active');
  }
});
