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

// ===== YANDEX: Scan partner's products =====
async function scanYandexProducts(credentials: any): Promise<any> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;

  if (!apiKey) throw new Error("Yandex API key topilmadi");
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  // Resolve businessId
  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  if (!businessId) throw new Error("Business ID topilmadi");

  // Fetch offers (first 200)
  const offersResp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`,
    { method: 'POST', headers, body: '{}' }
  );
  if (!offersResp.ok) throw new Error(`Offers fetch error: ${offersResp.status}`);
  const offersData = await offersResp.json();
  const mappings = offersData.result?.offerMappings || [];

  const offers = mappings.map((entry: any) => {
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

  // Fetch quality scores
  const offerIds = offers.map((o: any) => o.offerId).filter(Boolean);
  let qualityMap = new Map<string, any>();
  
  if (offerIds.length > 0) {
    const qualResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
      { method: 'POST', headers, body: JSON.stringify({ offerIds: offerIds.slice(0, 200), withRecommendations: true }) }
    );
    if (qualResp.ok) {
      const qualData = await qualResp.json();
      for (const card of (qualData.result?.offerCards || [])) {
        const rating = typeof card.contentRating === 'number' ? card.contentRating : card.contentRating?.rating ?? null;
        qualityMap.set(card.offerId, {
          score: rating,
          errors: card.errors?.length || 0,
          warnings: card.warnings?.length || 0,
          recommendations: card.recommendations?.length || 0,
        });
      }
    }
  }

  // Analyze each product
  const products = offers.map((offer: any) => {
    const quality = qualityMap.get(offer.offerId);
    const issues: string[] = [];
    let score = quality?.score ?? -1;

    if (!offer.name || offer.name.length < 60) issues.push('Nom qisqa (<60 belgi)');
    if (!offer.description || offer.description.length < 1000) issues.push('Tavsif qisqa (<1000 belgi)');
    if ((offer.pictures?.length || 0) < 3) issues.push(`Kam rasm (${offer.pictures?.length || 0}/3)`);
    if (!offer.vendor) issues.push('Brend yo\'q');
    if (!offer.barcodes?.length) issues.push('Shtrix-kod yo\'q');
    if (!offer.weightDimensions) issues.push('O\'lchamlar yo\'q');
    if (quality?.errors > 0) issues.push(`${quality.errors} ta xatolik`);
    if (quality?.warnings > 0) issues.push(`${quality.warnings} ta ogohlantirish`);
    if (quality?.recommendations > 0) issues.push(`${quality.recommendations} ta tavsiya`);

    if (score < 0) {
      score = Math.max(10, 100 - (issues.filter(i => i.includes('xatolik') || i.includes('yo\'q') || i.includes('qisqa')).length * 15));
    }

    return {
      offerId: offer.offerId,
      name: offer.name || offer.offerId,
      category: offer.category,
      score: Math.round(score),
      issueCount: issues.length,
      issues,
      imageCount: offer.pictures?.length || 0,
      hasDescription: (offer.description?.length || 0) >= 1000,
      hasVendor: !!offer.vendor,
    };
  });

  return {
    marketplace: 'yandex',
    totalProducts: products.length,
    avgScore: products.length > 0 ? Math.round(products.reduce((s: number, p: any) => s + p.score, 0) / products.length) : 0,
    criticalCount: products.filter((p: any) => p.score < 50).length,
    warningCount: products.filter((p: any) => p.score >= 50 && p.score < 80).length,
    goodCount: products.filter((p: any) => p.score >= 80).length,
    products: products.sort((a: any, b: any) => a.score - b.score),
  };
}

// ===== WILDBERRIES: Scan partner's products =====
async function scanWildberriesProducts(credentials: any): Promise<any> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  if (!apiKey) throw new Error("WB API key topilmadi");

  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  // Fetch cards
  const listResp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v2/get/cards/list`,
    { method: 'POST', headers, body: JSON.stringify({ settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }) }
  );
  if (!listResp.ok) throw new Error(`WB cards fetch error: ${listResp.status}`);
  const listData = await listResp.json();
  const cards = listData.cards || [];

  const products = cards.map((card: any) => {
    const issues: string[] = [];
    const title = card.title || '';
    const description = card.description || '';
    const photos = card.photos || card.mediaFiles || [];

    if (!title || title.length < 30) issues.push('Nom qisqa');
    if (!description || description.length < 500) issues.push('Tavsif qisqa');
    if (photos.length < 3) issues.push(`Kam rasm (${photos.length}/3)`);
    if (!card.brand) issues.push('Brend yo\'q');

    // Check characteristics
    const charcs = card.characteristics || [];
    if (charcs.length < 3) issues.push('Kam xususiyatlar');

    const score = Math.max(10, 100 - (issues.length * 15));

    return {
      offerId: card.vendorCode || card.nmID?.toString() || '',
      nmID: card.nmID,
      name: title || card.vendorCode || '',
      category: card.subjectName || '',
      score,
      issueCount: issues.length,
      issues,
      imageCount: photos.length,
      hasDescription: description.length >= 500,
      hasVendor: !!card.brand,
    };
  });

  return {
    marketplace: 'wildberries',
    totalProducts: products.length,
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
    // Auth check - admin only
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

    // Check admin permission
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

    // Get partner's marketplace connections
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
        // Decrypt credentials
        let creds: any;
        if (conn.encrypted_credentials) {
          const { data: decrypted, error: decErr } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
          if (decErr || !decrypted) {
            console.error(`Decrypt error for ${conn.marketplace}:`, decErr);
            results.push({ marketplace: conn.marketplace, error: 'API kalitlarni deshifrlash xatosi', totalProducts: 0, products: [] });
            continue;
          }
          creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        } else {
          creds = conn.credentials || {};
        }

        if (conn.marketplace === 'yandex') {
          const result = await scanYandexProducts(creds);
          results.push(result);
        } else if (conn.marketplace === 'wildberries') {
          const result = await scanWildberriesProducts(creds);
          results.push(result);
        }
      } catch (e) {
        console.error(`Scan error for ${conn.marketplace}:`, e);
        results.push({ marketplace: conn.marketplace, error: e.message, totalProducts: 0, products: [] });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent scan error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
