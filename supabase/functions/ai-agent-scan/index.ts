import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 420) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
        continue;
      }
      return response;
    } catch (e) {
      if (attempt < maxRetries - 1) { await sleep(1000 * (attempt + 1)); continue; }
      throw e;
    }
  }
  return fetch(url, options);
}

// ===== YANDEX: Deep scan =====
async function scanYandexProducts(credentials: any): Promise<any> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  if (!apiKey) throw new Error("Yandex API key topilmadi");
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) throw new Error("Business ID topilmadi");

  let allMappings: any[] = [];
  const seenOfferIds = new Set<string>();
  let nextPageToken: string | undefined;
  for (let page = 0; page < 50; page++) {
    const body: any = {};
    if (nextPageToken) body.page_token = nextPageToken;
    const resp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`,
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    if (!resp.ok) break;
    const data = await resp.json();
    const mappings = data.result?.offerMappings || [];
    for (const m of mappings) {
      const oid = m.offer?.offerId;
      if (oid && !seenOfferIds.has(oid)) {
        seenOfferIds.add(oid);
        allMappings.push(m);
      }
    }
    nextPageToken = data.result?.paging?.nextPageToken;
    if (!nextPageToken) break;
    await sleep(300);
  }

  const offers = allMappings.map((entry: any) => {
    const offer = entry.offer || {};
    const mapping = entry.mapping || {};
    return {
      offerId: offer.offerId || '',
      name: offer.name || '',
      description: offer.description || '',
      pictures: offer.pictures || [],
      vendor: offer.vendor || '',
      barcodes: offer.barcodes || [],
      category: mapping.marketCategoryName || '',
      categoryId: mapping.marketCategoryId || 0,
      cardStatus: mapping.cardStatus || '',
      weightDimensions: offer.weightDimensions || null,
      parameterValues: offer.parameterValues || [],
    };
  });

  // Fetch quality scores in batches of 200
  const offerIds = offers.map((o: any) => o.offerId).filter(Boolean);
  const qualityMap = new Map<string, any>();
  
  for (let i = 0; i < offerIds.length; i += 200) {
    const batch = offerIds.slice(i, i + 200);
    try {
      const qualResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
        { method: 'POST', headers, body: JSON.stringify({ offerIds: batch, withRecommendations: true }) }
      );
      if (qualResp.ok) {
        const qualData = await qualResp.json();
        for (const card of (qualData.result?.offerCards || [])) {
          const rating = typeof card.contentRating === 'number' ? card.contentRating : card.contentRating?.rating ?? null;
          qualityMap.set(card.offerId, {
            score: rating,
            errors: card.errors || [],
            warnings: card.warnings || [],
            recommendations: card.recommendations || [],
          });
        }
      }
      if (i + 200 < offerIds.length) await sleep(300);
    } catch (e) { console.error('Quality fetch error:', e); }
  }

  const products = offers.map((offer: any) => {
    const quality = qualityMap.get(offer.offerId);
    const issues: string[] = [];
    const issueDetails: any[] = [];
    let score = quality?.score ?? -1;

    if (!offer.name || offer.name.length < 40) {
      issues.push('Nom juda qisqa');
      issueDetails.push({ type: 'critical', field: 'name', msg: `Nom ${offer.name?.length || 0} belgi (min 60)` });
    } else if (offer.name.length < 60) {
      issues.push('Nom qisqa (<60)');
      issueDetails.push({ type: 'warning', field: 'name', msg: `Nom ${offer.name.length} belgi` });
    }

    if (!offer.description || offer.description.length < 300) {
      issues.push('Tavsif yo\'q/juda qisqa');
      issueDetails.push({ type: 'critical', field: 'description', msg: `Tavsif ${offer.description?.length || 0} belgi (min 1000)` });
    } else if (offer.description.length < 1000) {
      issues.push('Tavsif qisqa (<1000)');
      issueDetails.push({ type: 'warning', field: 'description', msg: `Tavsif ${offer.description.length} belgi` });
    }

    const imgCount = offer.pictures?.length || 0;
    if (imgCount === 0) {
      issues.push('Rasmlar yo\'q');
      issueDetails.push({ type: 'critical', field: 'images', msg: 'Hech qanday rasm yo\'q' });
    } else if (imgCount < 3) {
      issues.push(`Kam rasm (${imgCount}/3)`);
      issueDetails.push({ type: 'warning', field: 'images', msg: `${imgCount} ta rasm (min 3)` });
    }

    if (!offer.vendor) {
      issues.push('Brend yo\'q');
      issueDetails.push({ type: 'warning', field: 'vendor', msg: 'Brend ko\'rsatilmagan' });
    }

    if (!offer.barcodes?.length) {
      issues.push('Shtrix-kod yo\'q');
      issueDetails.push({ type: 'warning', field: 'barcode', msg: 'Shtrix-kod kiritilmagan' });
    }

    if (!offer.weightDimensions) {
      issues.push('O\'lchamlar yo\'q');
      issueDetails.push({ type: 'warning', field: 'dimensions', msg: 'Og\'irlik/o\'lcham kiritilmagan' });
    }

    if (quality?.errors?.length > 0) {
      for (const e of quality.errors) {
        issues.push(e.message || `Xatolik: ${e.code || 'unknown'}`);
        issueDetails.push({ type: 'critical', field: 'api', msg: e.message || e.code });
      }
    }
    if (quality?.warnings?.length > 0) {
      for (const w of quality.warnings) {
        issueDetails.push({ type: 'warning', field: 'api', msg: w.message || w.code });
      }
      if (quality.warnings.length > 0) issues.push(`${quality.warnings.length} ta ogohlantirish`);
    }
    if (quality?.recommendations?.length > 0) {
      issues.push(`${quality.recommendations.length} ta tavsiya`);
    }

    if (score < 0) {
      const criticalCount = issueDetails.filter(i => i.type === 'critical').length;
      const warningCount = issueDetails.filter(i => i.type === 'warning').length;
      score = Math.max(5, 100 - (criticalCount * 20) - (warningCount * 8));
    }

    return {
      offerId: offer.offerId, name: offer.name || offer.offerId, category: offer.category,
      score: Math.round(score), issueCount: issues.length, issues, issueDetails,
      imageCount: imgCount, descriptionLength: offer.description?.length || 0,
      hasDescription: (offer.description?.length || 0) >= 1000, hasVendor: !!offer.vendor,
      hasBarcodes: (offer.barcodes?.length || 0) > 0, hasDimensions: !!offer.weightDimensions,
      apiErrors: quality?.errors?.length || 0, apiWarnings: quality?.warnings?.length || 0,
      pictures: offer.pictures || [],
    };
  });

  return {
    marketplace: 'yandex', totalProducts: products.length,
    avgScore: products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.score, 0) / products.length) : 0,
    criticalCount: products.filter((p: any) => p.score < 50).length,
    warningCount: products.filter((p: any) => p.score >= 50 && p.score < 80).length,
    goodCount: products.filter((p: any) => p.score >= 80).length,
    products: products.sort((a: any, b: any) => a.score - b.score),
  };
}

// ===== WILDBERRIES: Deep scan =====
async function scanWildberriesProducts(credentials: any): Promise<any> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  if (!apiKey) throw new Error("WB API key topilmadi");
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  let allCards: any[] = [];
  const seenNmIDs = new Set<number>();
  let cursor: any = { limit: 100 };
  for (let page = 0; page < 50; page++) {
    const listResp = await fetchWithRetry(
      `https://content-api.wildberries.ru/content/v2/get/cards/list`,
      { method: 'POST', headers, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) }
    );
    if (!listResp.ok) break;
    const listData = await listResp.json();
    const cards = listData.cards || [];
    for (const card of cards) {
      if (card.nmID && !seenNmIDs.has(card.nmID)) {
        seenNmIDs.add(card.nmID);
        allCards.push(card);
      }
    }
    if (cards.length < 100) break;
    const lastCard = cards[cards.length - 1];
    cursor = { limit: 100, updatedAt: lastCard.updatedAt, nmID: lastCard.nmID };
    await sleep(300);
  }

  let errorMap = new Map<number, string[]>();
  try {
    const errResp = await fetchWithRetry(
      `https://content-api.wildberries.ru/content/v2/cards/error/list`,
      { method: 'GET', headers }
    );
    if (errResp.ok) {
      const errData = await errResp.json();
      for (const err of (errData.data || errData.errors || [])) {
        const nmID = err.nmID || err.nmId;
        if (nmID) {
          if (!errorMap.has(nmID)) errorMap.set(nmID, []);
          errorMap.get(nmID)!.push(err.message || err.error || 'Noma\'lum xatolik');
        }
      }
    }
  } catch (e) { console.error('WB error list fetch:', e); }

  const products = allCards.map((card: any) => {
    const issues: string[] = [];
    const issueDetails: any[] = [];
    const title = card.title || '';
    const description = card.description || '';
    const photos = card.photos || card.mediaFiles || [];
    const asyncErrors = errorMap.get(card.nmID) || [];

    if (!title || title.length < 20) {
      issues.push('Nom juda qisqa');
      issueDetails.push({ type: 'critical', field: 'name', msg: `Nom ${title.length} belgi` });
    } else if (title.length > 60) {
      issues.push('Nom uzun (>60)');
      issueDetails.push({ type: 'warning', field: 'name', msg: `Nom ${title.length} belgi (max 60)` });
    }

    if (!description || description.length < 300) {
      issues.push('Tavsif yo\'q/juda qisqa');
      issueDetails.push({ type: 'critical', field: 'description', msg: `Tavsif ${description.length} belgi (min 1000)` });
    } else if (description.length < 1000) {
      issues.push('Tavsif qisqa (<1000)');
      issueDetails.push({ type: 'warning', field: 'description', msg: `Tavsif ${description.length} belgi` });
    }

    if (photos.length === 0) {
      issues.push('Rasmlar yo\'q');
      issueDetails.push({ type: 'critical', field: 'images', msg: 'Hech qanday rasm yo\'q' });
    } else if (photos.length < 3) {
      issues.push(`Kam rasm (${photos.length}/3)`);
      issueDetails.push({ type: 'warning', field: 'images', msg: `${photos.length} ta rasm (min 3)` });
    }

    if (!card.brand) {
      issues.push('Brend yo\'q');
      issueDetails.push({ type: 'warning', field: 'vendor', msg: 'Brend belgilanmagan' });
    }

    const charcs = card.characteristics || [];
    if (charcs.length < 3) {
      issues.push('Kam xususiyatlar');
      issueDetails.push({ type: 'warning', field: 'characteristics', msg: `${charcs.length} ta xususiyat (min 3)` });
    }

    for (const errMsg of asyncErrors) {
      issues.push(`WB xato: ${errMsg.substring(0, 50)}`);
      issueDetails.push({ type: 'critical', field: 'async_error', msg: errMsg });
    }

    const criticalCount = issueDetails.filter(i => i.type === 'critical').length;
    const warningCount = issueDetails.filter(i => i.type === 'warning').length;
    const score = Math.max(5, 100 - (criticalCount * 20) - (warningCount * 8));

    // Extract photo URLs for WB
    const photoUrls = photos.map((p: any) => {
      if (typeof p === 'string') return p;
      if (p?.big) return p.big;
      if (p?.c246x328) return p.c246x328;
      return p?.tm || '';
    }).filter(Boolean);

    return {
      offerId: card.vendorCode || card.nmID?.toString() || '', nmID: card.nmID, subjectID: card.subjectID,
      name: title || card.vendorCode || '', category: card.subjectName || '',
      score, issueCount: issues.length, issues, issueDetails,
      imageCount: photos.length, descriptionLength: description.length,
      hasDescription: description.length >= 1000, hasVendor: !!card.brand, asyncErrors: asyncErrors.length,
      pictures: photoUrls,
    };
  });

  return {
    marketplace: 'wildberries', totalProducts: products.length,
    avgScore: products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.score, 0) / products.length) : 0,
    criticalCount: products.filter((p: any) => p.score < 50).length,
    warningCount: products.filter((p: any) => p.score >= 50 && p.score < 80).length,
    goodCount: products.filter((p: any) => p.score >= 80).length,
    products: products.sort((a: any, b: any) => a.score - b.score),
  };
}

// ===== UZUM MARKET: Deep scan =====
async function scanUzumProducts(credentials: any, supabase: any, userId: string): Promise<any> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  if (!apiKey) throw new Error("Uzum API key topilmadi");
  const baseUrl = "https://api-seller.uzum.uz/api/seller-openapi";
  const headers: Record<string, string> = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Discover shopId from credentials or API
  let shopId: string | null = credentials.sellerId || credentials.shopId || null;
  const allShopIds: string[] = [];

  try {
    console.log(`[UZUM SCAN] Discovering shops...`);
    const shopsResp = await fetchWithRetry(`${baseUrl}/v1/shops`, { headers });
    if (shopsResp.ok) {
      const shopsData = await shopsResp.json();
      console.log(`[UZUM SCAN] Shops response keys: ${Object.keys(shopsData || {}).join(', ')}`);
      const shops = Array.isArray(shopsData) ? shopsData : (shopsData.payload || shopsData.data || shopsData.shopList || []);
      const shopList = Array.isArray(shops) ? shops : [shops];
      for (const s of shopList) {
        const sid = String(s.shopId || s.id || '');
        if (sid) allShopIds.push(sid);
      }
      if (allShopIds.length > 0 && !shopId) shopId = allShopIds[0];
      console.log(`[UZUM SCAN] Found ${allShopIds.length} shops: ${allShopIds.join(', ')}`);
    } else {
      console.error(`[UZUM SCAN] Shops API ${shopsResp.status}: ${(await shopsResp.text()).substring(0, 200)}`);
    }
  } catch (e) { console.error('[UZUM SCAN] Shops discovery error:', e); }

  if (!shopId) throw new Error("Uzum shopId topilmadi");

  // Fetch products from all shops with multiple API endpoint fallbacks
  const seenIds = new Set<string>();
  const allProducts: any[] = [];
  const shopsToScan = allShopIds.length > 0 ? allShopIds : [shopId];
  
  for (const currentShopId of shopsToScan) {
    console.log(`[UZUM SCAN] Scanning shop ${currentShopId}...`);
    let shopSuccess = false;

    // Try multiple API endpoints
    const endpoints = [
      (page: number) => `${baseUrl}/v1/product/shop/${currentShopId}?size=100&pageNumber=${page}`,
      (page: number) => `${baseUrl}/v2/product?shopId=${currentShopId}&size=100&page=${page}`,
      (page: number) => `${baseUrl}/v1/product-card?shopId=${currentShopId}&size=100&page=${page}`,
    ];

    for (const makeUrl of endpoints) {
      if (shopSuccess) break;
      
      for (let page = 0; page < 50; page++) {
        try {
          const url = makeUrl(page);
          const resp = await fetchWithRetry(url, { headers });
          
          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`[UZUM SCAN] ${url} => ${resp.status}: ${errText.substring(0, 150)}`);
            if (resp.status === 403 || resp.status === 401) break;
            if (resp.status === 404) break; // endpoint not found, try next
            break;
          }
          
          shopSuccess = true;
          const data = await resp.json();
          
          // Parse response - Uzum uses various response structures
          let items: any[] = [];
          if (Array.isArray(data)) {
            items = data;
          } else {
            items = data.payload || data.productCards || data.data || data.content || data.productList || data.items || [];
            if (!Array.isArray(items)) {
              // Maybe it's paginated with totalElements
              if (data.payload?.productCards) items = data.payload.productCards;
              else if (data.payload?.content) items = data.payload.content;
              else items = [];
            }
          }
          
          console.log(`[UZUM SCAN] Shop ${currentShopId} page ${page}: ${items.length} items`);
          if (items.length === 0) break;

          for (const item of items) {
            const skus = item.skuList || item.skus || [];
            const firstSku = skus[0] || {};
            const productId = String(item.productId || item.id || item.cardId || firstSku.skuId || '');
            const offerId = firstSku.skuTitle || firstSku.barCode || firstSku.barcode || productId;
            
            if (!offerId || seenIds.has(offerId)) continue;
            seenIds.add(offerId);

            const title = item.title || item.name || item.productName || '';
            const description = item.description || '';
            
            // Extract photos from various structures
            let photos: any[] = [];
            if (item.photos) photos = item.photos;
            else if (item.photoList) photos = item.photoList;
            else if (item.photo?.photo) {
              // Nested photo structure
              const photoObj = item.photo.photo;
              const sizes = Object.keys(photoObj).sort((a, b) => Number(b) - Number(a));
              if (sizes.length > 0) {
                const bigSize = photoObj[sizes[0]];
                if (bigSize?.high) photos = [bigSize.high];
              }
            }
            
            const characteristics = item.characteristics || item.attributes || item.charList || [];

            allProducts.push({
              offerId,
              productId,
              name: title,
              description,
              pictures: photos,
              characteristics,
              category: item.categoryTitle || item.category?.title || item.categoryName || '',
              price: firstSku.purchasePrice || firstSku.fullPrice || item.price || 0,
            });
          }

          await sleep(500);
        } catch (e) {
          console.error(`[UZUM SCAN] Shop ${currentShopId} page error:`, e);
          break;
        }
      }
    }
    
    if (!shopSuccess) {
      console.warn(`[UZUM SCAN] Could not fetch products from shop ${currentShopId}`);
    }
    await sleep(300);
  }

  console.log(`[UZUM SCAN] Total unique products: ${allProducts.length}`);

  // Analyze quality
  const products = allProducts.map(item => {
    const issues: string[] = [];
    const issueDetails: any[] = [];
    const title = item.name || '';
    const desc = item.description || '';
    const imgCount = Array.isArray(item.pictures) ? item.pictures.length : 0;

    // Title
    if (!title || title.length < 20) {
      issues.push('Nom juda qisqa');
      issueDetails.push({ type: 'critical', field: 'name', msg: `Nom ${title.length} belgi (min 40)` });
    } else if (title.length < 40) {
      issues.push('Nom qisqa (<40)');
      issueDetails.push({ type: 'warning', field: 'name', msg: `Nom ${title.length} belgi` });
    }

    // Description
    if (!desc || desc.length < 100) {
      issues.push('Tavsif yo\'q/juda qisqa');
      issueDetails.push({ type: 'critical', field: 'description', msg: `Tavsif ${desc.length} belgi (min 500)` });
    } else if (desc.length < 500) {
      issues.push('Tavsif qisqa (<500)');
      issueDetails.push({ type: 'warning', field: 'description', msg: `Tavsif ${desc.length} belgi` });
    }

    // Images
    if (imgCount === 0) {
      issues.push('Rasmlar yo\'q');
      issueDetails.push({ type: 'critical', field: 'images', msg: 'Hech qanday rasm yo\'q' });
    } else if (imgCount < 3) {
      issues.push(`Kam rasm (${imgCount}/3)`);
      issueDetails.push({ type: 'warning', field: 'images', msg: `${imgCount} ta rasm (min 3)` });
    }

    // Characteristics
    const charcCount = Array.isArray(item.characteristics) ? item.characteristics.length : 0;
    if (charcCount < 3) {
      issues.push('Kam xususiyatlar');
      issueDetails.push({ type: 'warning', field: 'characteristics', msg: `${charcCount} ta xususiyat (min 3)` });
    }

    const criticalCount = issueDetails.filter(i => i.type === 'critical').length;
    const warningCount = issueDetails.filter(i => i.type === 'warning').length;
    const score = Math.max(5, 100 - (criticalCount * 20) - (warningCount * 8));

    // Extract Uzum photo URLs
    const pictureUrls = (Array.isArray(item.pictures) ? item.pictures : []).map((p: any) => {
      if (typeof p === 'string') return p;
      if (p?.photo) {
        const sizes = Object.keys(p.photo).sort((a, b) => Number(b) - Number(a));
        return sizes.length > 0 ? p.photo[sizes[0]]?.high || p.photo[sizes[0]] : '';
      }
      return p?.url || p?.high || '';
    }).filter(Boolean);

    return {
      offerId: item.offerId, productId: item.productId,
      name: title || item.offerId, category: item.category,
      score, issueCount: issues.length, issues, issueDetails,
      imageCount: imgCount, descriptionLength: desc.length,
      hasDescription: desc.length >= 500, hasVendor: true,
      pictures: pictureUrls,
    };
  });

  return {
    marketplace: 'uzum', totalProducts: products.length,
    avgScore: products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.score, 0) / products.length) : 0,
    criticalCount: products.filter((p: any) => p.score < 50).length,
    warningCount: products.filter((p: any) => p.score >= 50 && p.score < 80).length,
    goodCount: products.filter((p: any) => p.score >= 80).length,
    products: products.sort((a: any, b: any) => a.score - b.score),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminPerm } = await supabase
      .from('admin_permissions')
      .select('is_super_admin, can_manage_users')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
      return new Response(JSON.stringify({ error: 'Admin ruxsati yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { partnerId, marketplace } = body;

    if (!partnerId) {
      return new Response(JSON.stringify({ error: 'partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: connections, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', partnerId)
      .eq('is_active', true);

    if (connError || !connections?.length) {
      return new Response(JSON.stringify({ error: 'Hamkorning marketplace ulanishlari topilmadi' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const conn of connections) {
      if (marketplace && conn.marketplace !== marketplace) continue;
      try {
        let creds: any;
        if (conn.encrypted_credentials) {
          const { data: decrypted, error: decErr } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
          if (decErr || !decrypted) {
            results.push({ marketplace: conn.marketplace, error: 'API kalitlarni deshifrlash xatosi', totalProducts: 0, products: [] });
            continue;
          }
          creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        } else {
          creds = conn.credentials || {};
        }

        if (conn.marketplace === 'yandex') {
          results.push(await scanYandexProducts(creds));
        } else if (conn.marketplace === 'wildberries') {
          results.push(await scanWildberriesProducts(creds));
        } else if (conn.marketplace === 'uzum') {
          results.push(await scanUzumProducts(creds, supabase, partnerId));
        }
      } catch (e) {
        console.error(`Scan error for ${conn.marketplace}:`, e);
        results.push({ marketplace: conn.marketplace, error: (e as any).message, totalProducts: 0, avgScore: 0, criticalCount: 0, warningCount: 0, goodCount: 0, products: [] });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent scan error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
