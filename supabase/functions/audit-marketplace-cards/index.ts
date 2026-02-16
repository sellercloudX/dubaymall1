import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 420 || response.status === 429) {
      await sleep(Math.min(1000 * Math.pow(2, attempt), 5000));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

// ============ YANDEX QUALITY AUDIT ============

interface QualityIssue {
  offerId: string;
  productName: string;
  marketplace: string;
  qualityScore: number;
  issues: Array<{
    type: string; // missing_param, bad_description, no_images, low_quality_image, missing_barcode, etc.
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    currentValue?: string;
    suggestedFix?: string;
  }>;
  fixable: boolean;
  category?: string;
  categoryId?: number;
}

async function auditYandexCards(
  credentials: any,
  offerIds?: string[] // if empty, audit all
): Promise<QualityIssue[]> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  const businessId = credentials.businessId || credentials.business_id;

  if (!apiKey || !campaignId) throw new Error("Missing Yandex API credentials");

  const headers: Record<string, string> = {
    "Api-Key": apiKey,
    "Content-Type": "application/json",
  };

  // Get businessId if not provided
  let effectiveBusinessId = businessId;
  if (!effectiveBusinessId) {
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
        { headers }
      );
      if (resp.ok) {
        const data = await resp.json();
        effectiveBusinessId = data.campaign?.business?.id;
      }
    } catch (e) { console.error("Error getting businessId:", e); }
  }

  // Step 1: Get quality ratings for offers
  const qualityIssues: QualityIssue[] = [];

  // Fetch offer mappings to get full card data
  const allOffers: any[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    let apiPath: string;
    let method = 'POST';
    let body: any = {};

    if (effectiveBusinessId) {
      apiPath = `https://api.partner.market.yandex.ru/v2/businesses/${effectiveBusinessId}/offer-mappings?limit=100`;
      if (pageToken) apiPath += `&page_token=${encodeURIComponent(pageToken)}`;
    } else {
      apiPath = `https://api.partner.market.yandex.ru/campaigns/${campaignId}/offers`;
      body = { limit: 100 };
      if (pageToken) body.page_token = pageToken;
    }

    const resp = await fetchWithRetry(apiPath, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) break;
    const data = await resp.json();

    const mappings = data.result?.offerMappings || [];
    const offers = data.result?.offers || [];
    const items = mappings.length > 0 ? mappings : offers;

    items.forEach((entry: any) => {
      const offer = entry.offer || entry;
      const mapping = entry.mapping || {};
      allOffers.push({ offer, mapping });
    });

    pageToken = data.result?.paging?.nextPageToken;
    page++;
    if (pageToken) await sleep(500);
  } while (pageToken && page < 20);

  console.log(`Fetched ${allOffers.length} offers for audit`);

  // Step 2: Try to get quality ratings from Yandex API
  const qualityMap = new Map<string, any>();
  if (effectiveBusinessId) {
    try {
      await sleep(300);
      const qualityResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/businesses/${effectiveBusinessId}/offer-cards`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            offerIds: offerIds && offerIds.length > 0
              ? offerIds
              : allOffers.slice(0, 200).map((o: any) => o.offer.offerId).filter(Boolean),
            cardStatuses: ["HAS_CARD_CAN_NOT_BE_IMPROVED", "HAS_CARD_CAN_BE_IMPROVED", "NO_CARD_NEED_CONTENT"],
          }),
        }
      );
      if (qualityResp.ok) {
        const qualityData = await qualityResp.json();
        const cards = qualityData.result?.offerCards || [];
        cards.forEach((card: any) => {
          qualityMap.set(card.offerId, card);
        });
        console.log(`Got quality data for ${qualityMap.size} cards`);
      }
    } catch (e) {
      console.error("Error fetching quality ratings:", e);
    }
  }

  // Step 3: Get recommendations from Yandex for each card
  const recommendationsMap = new Map<string, any[]>();
  if (effectiveBusinessId) {
    try {
      await sleep(300);
      const recResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/businesses/${effectiveBusinessId}/offer-cards`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            offerIds: offerIds && offerIds.length > 0
              ? offerIds
              : allOffers.slice(0, 200).map((o: any) => o.offer.offerId).filter(Boolean),
          }),
        }
      );
      if (recResp.ok) {
        const recData = await recResp.json();
        const cards = recData.result?.offerCards || [];
        cards.forEach((card: any) => {
          const recs = card.cardRecommendations || card.recommendations || [];
          if (recs.length > 0) recommendationsMap.set(card.offerId, recs);
          // Also get content rating
          if (card.contentRating) {
            const existing = qualityMap.get(card.offerId) || {};
            qualityMap.set(card.offerId, { ...existing, contentRating: card.contentRating });
          }
        });
        console.log(`Got recommendations for ${recommendationsMap.size} cards`);
      }
    } catch (e) {
      console.error("Error fetching recommendations:", e);
    }
  }

  // Step 4: Analyze each offer for quality issues
  for (const { offer, mapping } of allOffers) {
    const offerId = offer.offerId || '';
    if (!offerId) continue;
    if (offerIds && offerIds.length > 0 && !offerIds.includes(offerId)) continue;

    const issues: QualityIssue['issues'] = [];
    const name = offer.name || mapping.marketSkuName || '';
    const description = offer.description || '';
    const pictures = offer.pictures || offer.urls || [];
    const barcode = offer.barcodes?.[0] || '';
    const category = mapping.marketCategoryName || offer.category?.name || '';
    const categoryId = mapping.marketCategoryId || offer.marketCategoryId || 0;
    const qualityCard = qualityMap.get(offerId);
    const recommendations = recommendationsMap.get(offerId) || [];

    // Content rating score
    let qualityScore = 0;
    if (qualityCard?.contentRating?.rating) {
      qualityScore = qualityCard.contentRating.rating;
    } else if (qualityCard?.cardStatus === 'HAS_CARD_CAN_NOT_BE_IMPROVED') {
      qualityScore = 100;
    } else if (qualityCard?.cardStatus === 'HAS_CARD_CAN_BE_IMPROVED') {
      qualityScore = 70;
    } else if (qualityCard?.cardStatus === 'NO_CARD_NEED_CONTENT') {
      qualityScore = 30;
    } else {
      qualityScore = 50; // Unknown
    }

    // Check missing/short name
    if (!name || name.length < 10) {
      issues.push({ type: 'missing_param', severity: 'error', field: 'name',
        message: 'Mahsulot nomi juda qisqa yoki yo\'q', currentValue: name || '(bo\'sh)',
        suggestedFix: 'AI yordamida to\'liq SEO-optimallashtirilgan nom yaratish' });
    }

    // Check description
    if (!description || description.length < 50) {
      issues.push({ type: 'bad_description', severity: 'error', field: 'description',
        message: 'Tavsif juda qisqa yoki yo\'q', currentValue: description ? `${description.length} belgi` : '(bo\'sh)',
        suggestedFix: 'AI yordamida batafsil tavsif yaratish (min 300 belgi)' });
    } else if (description.length < 200) {
      issues.push({ type: 'bad_description', severity: 'warning', field: 'description',
        message: 'Tavsif yetarlicha batafsil emas', currentValue: `${description.length} belgi`,
        suggestedFix: 'Tavsifni 300+ belgigacha kengaytirish' });
    }

    // Check images
    if (!pictures || pictures.length === 0) {
      issues.push({ type: 'no_images', severity: 'error', field: 'pictures',
        message: 'Rasmlar mavjud emas', currentValue: '0 ta',
        suggestedFix: 'Mahsulot rasmlari qo\'shish (min 3 ta)' });
    } else if (pictures.length < 3) {
      issues.push({ type: 'no_images', severity: 'warning', field: 'pictures',
        message: `Faqat ${pictures.length} ta rasm (min 3 tavsiya)`,
        currentValue: `${pictures.length} ta`,
        suggestedFix: 'Qo\'shimcha burchak va detail rasmlarini qo\'shish' });
    }

    // Check barcode
    if (!barcode) {
      issues.push({ type: 'missing_barcode', severity: 'warning', field: 'barcode',
        message: 'Shtrix-kod mavjud emas', currentValue: '(bo\'sh)',
        suggestedFix: 'EAN-13 shtrix-kod generatsiya qilish' });
    }

    // Check category
    if (!category && categoryId === 0) {
      issues.push({ type: 'missing_param', severity: 'error', field: 'category',
        message: 'Kategoriya belgilanmagan', currentValue: '(bo\'sh)',
        suggestedFix: 'AI yordamida mos kategoriyani aniqlash' });
    }

    // Process Yandex-specific recommendations
    for (const rec of recommendations) {
      const paramName = rec.parameterName || rec.parameter || rec.name || '';
      const recType = rec.type || 'REQUIRED';
      
      if (recType === 'REQUIRED' || recType === 'MAIN') {
        issues.push({ type: 'missing_param', severity: 'error', field: paramName,
          message: `Majburiy parametr to'ldirilmagan: ${paramName}`,
          currentValue: '(bo\'sh)',
          suggestedFix: `AI yordamida "${paramName}" qiymatini aniqlash` });
      } else if (recType === 'ADDITIONAL' || recType === 'DISTINCTIVE') {
        issues.push({ type: 'missing_param', severity: 'warning', field: paramName,
          message: `Qo'shimcha parametr: ${paramName}`,
          currentValue: '(bo\'sh)',
          suggestedFix: `"${paramName}" ni to'ldirish sifat indeksini oshiradi` });
      }
    }

    // Only add if there are issues or score < 90
    if (issues.length > 0 || qualityScore < 90) {
      qualityIssues.push({
        offerId,
        productName: name,
        marketplace: 'yandex',
        qualityScore,
        issues,
        fixable: issues.some(i => i.severity === 'error' || i.severity === 'warning'),
        category,
        categoryId,
      });
    }
  }

  // Sort by score ascending (worst first)
  qualityIssues.sort((a, b) => a.qualityScore - b.qualityScore);

  return qualityIssues;
}

// ============ AI FIX GENERATION ============

async function generateAIFixes(
  issue: QualityIssue,
  credentials: any,
): Promise<Record<string, any>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const fixableIssues = issue.issues.filter(i => i.severity === 'error' || i.severity === 'warning');
  if (fixableIssues.length === 0) return {};

  const issuesList = fixableIssues.map(i => 
    `- ${i.field}: ${i.message} (hozirgi: ${i.currentValue || 'bo\'sh'})`
  ).join('\n');

  const prompt = `Sen Yandex Market kartochka sifat ekspertisan. Quyidagi mahsulot kartochkasida xatoliklar topildi.

Mahsulot: "${issue.productName}"
Kategoriya: ${issue.category || 'Noma\'lum'}
Sifat indeksi: ${issue.qualityScore}/100

Topilgan xatoliklar:
${issuesList}

Har bir xatolik uchun tuzatish qiymatini yoz. Javobni FAQAT JSON formatda ber, boshqa matn yozma.
JSON tuzilishi:
{
  "fixes": {
    "name": "To'liq SEO-optimallashtirilgan nom (agar nom xatosi bo'lsa)",
    "description": "Batafsil tavsif 300+ belgi (agar tavsif xatosi bo'lsa)",
    "barcode": "EAN-13 (agar barcode xatosi bo'lsa)",
    "params": { "paramName": "value" }
  },
  "expectedScore": 95,
  "summary": "Qisqa tuzatish xulosa"
}

MUHIM: Faqat xatolikka ega maydonlar uchun tuzatish ber. O'zbek va rus tillarida yoz.`;

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sen marketplace kartochka optimizatsiya ekspertisan. Faqat JSON formatda javob ber." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) throw new Error("AI rate limit. Biroz kuting.");
      if (aiResp.status === 402) throw new Error("AI krediti tugagan.");
      throw new Error(`AI xatolik: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: "AI javobini parse qilib bo'lmadi" };
  } catch (e) {
    console.error("AI fix generation error:", e);
    throw e;
  }
}

// ============ APPLY FIXES ============

async function applyYandexFixes(
  credentials: any,
  offerId: string,
  fixes: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const businessId = credentials.businessId || credentials.business_id;
  const campaignId = credentials.campaignId || credentials.campaign_id;

  if (!apiKey) return { success: false, message: "API key yo'q" };

  const headers: Record<string, string> = {
    "Api-Key": apiKey,
    "Content-Type": "application/json",
  };

  // Get businessId if needed
  let effectiveBusinessId = businessId;
  if (!effectiveBusinessId && campaignId) {
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
        { headers }
      );
      if (resp.ok) {
        const data = await resp.json();
        effectiveBusinessId = data.campaign?.business?.id;
      }
    } catch (e) { /* ignore */ }
  }

  if (!effectiveBusinessId) {
    return { success: false, message: "Business ID topilmadi" };
  }

  const fixData = fixes.fixes || fixes;
  const updateBody: any = {
    offerIds: [offerId],
  };

  // Build update payload for offer-cards/update
  const cardUpdate: any = {};

  if (fixData.name) cardUpdate.name = fixData.name;
  if (fixData.description) cardUpdate.description = fixData.description;
  if (fixData.barcode) cardUpdate.barcodes = [fixData.barcode];
  if (fixData.params) {
    cardUpdate.parameterValues = Object.entries(fixData.params).map(([name, value]) => ({
      parameterName: name,
      value: String(value),
    }));
  }

  // Use update-offer-mappings endpoint
  try {
    const updateResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${effectiveBusinessId}/offer-mappings/update`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          offerMappings: [{
            offer: {
              offerId,
              ...cardUpdate,
            },
          }],
        }),
      }
    );

    if (updateResp.ok) {
      return { success: true, message: `Kartochka yangilandi. Kutilayotgan sifat: ${fixes.expectedScore || '95+'}` };
    } else {
      const errorText = await updateResp.text();
      console.error("Update error:", errorText);
      return { success: false, message: `Yangilash xatolik: ${updateResp.status}` };
    }
  } catch (e) {
    return { success: false, message: `Tarmoq xatolik: ${e instanceof Error ? e.message : 'unknown'}` };
  }
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Avtorizatsiya kerak");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Avtorizatsiya xatosi");

    const body = await req.json();
    const { action, marketplace, offerIds } = body;

    // Get marketplace connection
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", marketplace || 'yandex')
      .eq("is_active", true)
      .limit(1);

    if (!connections || connections.length === 0) {
      throw new Error(`${marketplace || 'yandex'} marketplace ulanmagan`);
    }

    const connection = connections[0];
    const credentials = connection.credentials as any;

    switch (action) {
      case 'audit': {
        // Audit cards and return quality issues
        const issues = await auditYandexCards(credentials, offerIds);
        return new Response(JSON.stringify({
          success: true,
          data: issues,
          summary: {
            total: issues.length,
            critical: issues.filter(i => i.issues.some(ii => ii.severity === 'error')).length,
            warning: issues.filter(i => i.issues.some(ii => ii.severity === 'warning') && !i.issues.some(ii => ii.severity === 'error')).length,
            avgScore: issues.length > 0 ? Math.round(issues.reduce((s, i) => s + i.qualityScore, 0) / issues.length) : 100,
            fixable: issues.filter(i => i.fixable).length,
          },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'generate-fix': {
        // Generate AI fix for a specific card
        const { offerId: targetOfferId } = body;
        if (!targetOfferId) throw new Error("offerId kerak");

        // First audit this specific card
        const issues = await auditYandexCards(credentials, [targetOfferId]);
        if (issues.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            data: { message: "Bu kartochkada xatolik topilmadi", fixes: null },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const fixes = await generateAIFixes(issues[0], credentials);
        return new Response(JSON.stringify({
          success: true,
          data: { issue: issues[0], fixes },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'apply-fix': {
        // Apply AI-generated fix to a card
        const { offerId: fixOfferId, fixes } = body;
        if (!fixOfferId || !fixes) throw new Error("offerId va fixes kerak");

        const result = await applyYandexFixes(credentials, fixOfferId, fixes);
        return new Response(JSON.stringify({
          success: true,
          data: result,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'auto-fix': {
        // Full auto: audit + generate fix + apply — for single card
        const { offerId: autoOfferId } = body;
        if (!autoOfferId) throw new Error("offerId kerak");

        const issues = await auditYandexCards(credentials, [autoOfferId]);
        if (issues.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            data: { message: "Xatolik topilmadi", applied: false },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const fixes = await generateAIFixes(issues[0], credentials);
        if (fixes.error) {
          return new Response(JSON.stringify({
            success: false,
            error: fixes.error,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const result = await applyYandexFixes(credentials, autoOfferId, fixes);
        return new Response(JSON.stringify({
          success: true,
          data: {
            ...result,
            issue: issues[0],
            fixes,
          },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Noma'lum action: ${action}`);
    }
  } catch (e) {
    console.error("Audit error:", e);
    const status = e instanceof Error && e.message.includes("rate limit") ? 429
      : e instanceof Error && e.message.includes("kredit") ? 402 : 500;
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Noma'lum xatolik",
    }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
