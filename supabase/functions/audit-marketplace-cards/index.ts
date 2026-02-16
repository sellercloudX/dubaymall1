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
      if (response.status === 420 || response.status === 429) {
        const wait = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.log(`Rate limited (${response.status}), waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      return response;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  return fetch(url, options);
}

// ===== TYPES =====
interface QualityIssue {
  offerId: string;
  productName: string;
  marketplace: string;
  qualityScore: number;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    currentValue?: string;
    suggestedFix?: string;
  }>;
  fixable: boolean;
  category?: string;
  categoryId?: number;
  currentData?: Record<string, any>;
}

// ===== GET BUSINESS ID =====
async function getBusinessId(credentials: any): Promise<{ apiKey: string; businessId: string; campaignId: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;

  if (!apiKey) throw new Error("Yandex API key topilmadi");

  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };

  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
      { headers }
    );
    if (resp.ok) {
      const data = await resp.json();
      businessId = data.campaign?.business?.id;
      console.log(`Resolved businessId: ${businessId} from campaignId: ${campaignId}`);
    } else {
      const errText = await resp.text();
      console.error(`Failed to get businessId: ${resp.status} ${errText}`);
    }
  }

  if (!businessId) throw new Error("Business ID topilmadi. Kampaniya sozlamalarini tekshiring.");

  return { apiKey, businessId: String(businessId), campaignId: String(campaignId || '') };
}

// ===== FETCH ALL OFFERS WITH FULL DATA =====
async function fetchAllOffers(apiKey: string, businessId: string): Promise<any[]> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const allOffers: any[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    let url = `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`;
    if (pageToken) url += `&page_token=${encodeURIComponent(pageToken)}`;

    const resp = await fetchWithRetry(url, { method: 'POST', headers, body: '{}' });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Offer mappings error: ${resp.status} ${errText}`);
      break;
    }

    const data = await resp.json();
    const mappings = data.result?.offerMappings || [];

    for (const entry of mappings) {
      const offer = entry.offer || {};
      const mapping = entry.mapping || {};
      allOffers.push({
        offerId: offer.offerId || '',
        name: offer.name || '',
        description: offer.description || '',
        pictures: offer.pictures || [],
        barcodes: offer.barcodes || [],
        vendor: offer.vendor || '',
        vendorCode: offer.vendorCode || '',
        category: mapping.marketCategoryName || '',
        categoryId: mapping.marketCategoryId || 0,
        cardStatus: mapping.cardStatus || '',
        params: offer.parameterValues || [],
        weightDimensions: offer.weightDimensions || null,
        urls: offer.urls || [],
        rawOffer: offer,
      });
    }

    pageToken = data.result?.paging?.nextPageToken;
    page++;
    if (pageToken) await sleep(400);
  } while (pageToken && page < 30);

  console.log(`Fetched ${allOffers.length} offers from Yandex`);
  return allOffers;
}

// ===== FETCH CARD QUALITY & RECOMMENDATIONS =====
async function fetchCardQuality(
  apiKey: string,
  businessId: string,
  offerIds: string[]
): Promise<Map<string, any>> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const cardMap = new Map<string, any>();

  // Process in batches of 200
  for (let i = 0; i < offerIds.length; i += 200) {
    const batch = offerIds.slice(i, i + 200);

    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            offerIds: batch,
            // CRITICAL: this flag enables recommendations and content rating
            withRecommendations: true,
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const cards = data.result?.offerCards || [];
        console.log(`Batch ${i}: got ${cards.length} cards with quality data`);

        for (const card of cards) {
          cardMap.set(card.offerId, {
            contentRating: card.contentRating || null,
            averageContentRating: card.averageContentRating || null,
            recommendations: card.recommendations || card.cardRecommendations || [],
            cardStatus: card.cardStatus || '',
            errors: card.errors || [],
            warnings: card.warnings || [],
            parameterValues: card.parameterValues || [],
          });
        }
      } else {
        const errText = await resp.text();
        console.error(`Card quality API error: ${resp.status} ${errText}`);
      }
    } catch (e) {
      console.error(`Card quality fetch error:`, e);
    }

    if (i + 200 < offerIds.length) await sleep(500);
  }

  console.log(`Total card quality data: ${cardMap.size} cards`);
  return cardMap;
}

// ===== ANALYZE OFFERS =====
function analyzeOffers(
  offers: any[],
  cardQualityMap: Map<string, any>,
  filterOfferIds?: string[]
): QualityIssue[] {
  const results: QualityIssue[] = [];

  for (const offer of offers) {
    if (!offer.offerId) continue;
    if (filterOfferIds?.length && !filterOfferIds.includes(offer.offerId)) continue;

    const quality = cardQualityMap.get(offer.offerId);
    const issues: QualityIssue['issues'] = [];

    // === Quality score ===
    let qualityScore = 50;
    if (quality?.contentRating?.rating != null) {
      qualityScore = quality.contentRating.rating;
    } else if (quality?.averageContentRating != null) {
      qualityScore = quality.averageContentRating;
    } else if (quality?.cardStatus === 'HAS_CARD_CAN_NOT_BE_IMPROVED') {
      qualityScore = 100;
    } else if (quality?.cardStatus === 'HAS_CARD_CAN_BE_IMPROVED') {
      qualityScore = 65;
    } else if (quality?.cardStatus === 'NO_CARD_NEED_CONTENT') {
      qualityScore = 25;
    }

    // === Name check ===
    if (!offer.name || offer.name.trim().length < 5) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'name',
        message: 'Mahsulot nomi yo\'q yoki juda qisqa',
        currentValue: offer.name || '(bo\'sh)',
        suggestedFix: 'AI yordamida to\'liq SEO nom yaratish',
      });
    } else if (offer.name.length < 20) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'name',
        message: `Nom qisqa (${offer.name.length} belgi), 30+ tavsiya`,
        currentValue: offer.name,
        suggestedFix: 'Nomga brend, model, asosiy xususiyat qo\'shish',
      });
    }

    // === Description check ===
    if (!offer.description || offer.description.trim().length < 10) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'description',
        message: 'Tavsif yo\'q yoki juda qisqa',
        currentValue: offer.description ? `${offer.description.length} belgi` : '(bo\'sh)',
        suggestedFix: 'AI yordamida batafsil tavsif yaratish (300+ belgi)',
      });
    } else if (offer.description.length < 150) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'description',
        message: `Tavsif qisqa (${offer.description.length} belgi)`,
        currentValue: `${offer.description.length} belgi`,
        suggestedFix: 'Tavsifni 300+ belgigacha kengaytirish',
      });
    }

    // === Images check ===
    const totalImages = (offer.pictures?.length || 0) + (offer.urls?.length || 0);
    if (totalImages === 0) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'pictures',
        message: 'Rasmlar mavjud emas',
        currentValue: '0 ta',
        suggestedFix: 'Kamida 3 ta sifatli rasm qo\'shish',
      });
    } else if (totalImages < 3) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'pictures',
        message: `Faqat ${totalImages} ta rasm (3+ tavsiya)`,
        currentValue: `${totalImages} ta`,
        suggestedFix: 'Qo\'shimcha rasmlar qo\'shish',
      });
    }

    // === Barcode check ===
    if (!offer.barcodes || offer.barcodes.length === 0) {
      issues.push({
        type: 'missing_content', severity: 'warning', field: 'barcode',
        message: 'Shtrix-kod mavjud emas',
        currentValue: '(bo\'sh)',
        suggestedFix: 'EAN-13 shtrix-kod qo\'shish',
      });
    }

    // === Vendor check ===
    if (!offer.vendor) {
      issues.push({
        type: 'missing_content', severity: 'warning', field: 'vendor',
        message: 'Brend/ishlab chiqaruvchi ko\'rsatilmagan',
        currentValue: '(bo\'sh)',
        suggestedFix: 'Brend nomini qo\'shish',
      });
    }

    // === Weight/dimensions ===
    if (!offer.weightDimensions) {
      issues.push({
        type: 'missing_content', severity: 'info', field: 'weightDimensions',
        message: 'Og\'irlik va o\'lchamlar ko\'rsatilmagan',
        currentValue: '(bo\'sh)',
        suggestedFix: 'Og\'irlik (kg), uzunlik, kenglik, balandlik qo\'shish',
      });
    }

    // === Yandex API recommendations (CRITICAL - real missing params) ===
    if (quality?.recommendations) {
      for (const rec of quality.recommendations) {
        const paramName = rec.parameterName || rec.parameter || rec.name || 'unknown';
        const recType = rec.type || 'REQUIRED';

        if (recType === 'REQUIRED' || recType === 'MAIN') {
          issues.push({
            type: 'yandex_required', severity: 'error', field: paramName,
            message: `Majburiy parametr: "${paramName}"`,
            currentValue: '(to\'ldirilmagan)',
            suggestedFix: `AI "${paramName}" qiymatini aniqlaydi va to\'ldiradi`,
          });
        } else if (recType === 'ADDITIONAL' || recType === 'DISTINCTIVE') {
          issues.push({
            type: 'yandex_recommended', severity: 'warning', field: paramName,
            message: `Tavsiya etiladigan parametr: "${paramName}"`,
            currentValue: '(to\'ldirilmagan)',
            suggestedFix: `"${paramName}" sifat indeksini oshiradi`,
          });
        }
      }
    }

    // === Yandex errors ===
    if (quality?.errors?.length) {
      for (const err of quality.errors) {
        issues.push({
          type: 'yandex_error', severity: 'error', field: err.parameter || 'unknown',
          message: err.message || err.description || 'Yandex xatolik',
          currentValue: err.currentValue || '',
          suggestedFix: err.recommendation || 'Xatolikni tuzatish kerak',
        });
      }
    }

    // === Yandex warnings ===
    if (quality?.warnings?.length) {
      for (const warn of quality.warnings) {
        issues.push({
          type: 'yandex_warning', severity: 'warning', field: warn.parameter || 'unknown',
          message: warn.message || warn.description || 'Yandex ogohlantirish',
          currentValue: warn.currentValue || '',
          suggestedFix: warn.recommendation || '',
        });
      }
    }

    // Only include cards with issues or low score
    if (issues.length > 0 || qualityScore < 85) {
      results.push({
        offerId: offer.offerId,
        productName: offer.name || offer.offerId,
        marketplace: 'yandex',
        qualityScore,
        issues,
        fixable: issues.some(i => i.severity === 'error' || i.severity === 'warning'),
        category: offer.category,
        categoryId: offer.categoryId,
        currentData: {
          name: offer.name,
          description: offer.description,
          vendor: offer.vendor,
          vendorCode: offer.vendorCode,
          barcodes: offer.barcodes,
          pictures: offer.pictures,
          params: offer.params,
          weightDimensions: offer.weightDimensions,
        },
      });
    }
  }

  results.sort((a, b) => a.qualityScore - b.qualityScore);
  return results;
}

// ===== AI FIX GENERATION =====
async function generateAIFixes(issue: QualityIssue): Promise<Record<string, any>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI xizmati sozlanmagan");

  const fixableIssues = issue.issues.filter(i => i.severity !== 'info');
  if (fixableIssues.length === 0) return { fixes: {}, summary: "Tuzatish kerak emas" };

  const currentData = issue.currentData || {};
  const issuesList = fixableIssues.map(i =>
    `- [${i.severity.toUpperCase()}] ${i.field}: ${i.message} (hozirgi: ${i.currentValue || 'bo\'sh'})`
  ).join('\n');

  const existingParams = (currentData.params || [])
    .map((p: any) => `  ${p.name || p.parameterName}: ${p.value || JSON.stringify(p.values)}`)
    .join('\n');

  const prompt = `Sen Yandex Market kartochka sifat ekspertisan. Mavjud kartochkani tahlil qil va xatoliklarni tuzat.

MAHSULOT MA'LUMOTLARI:
- Nom: "${currentData.name || '(bo\'sh)'}"
- Tavsif: "${(currentData.description || '').substring(0, 500)}"
- Kategoriya: ${issue.category || 'Noma\'lum'}
- Brend: ${currentData.vendor || '(bo\'sh)'}
- Shtrixkod: ${currentData.barcodes?.join(', ') || '(bo\'sh)'}
- Rasmlar soni: ${currentData.pictures?.length || 0}
- Mavjud parametrlar:
${existingParams || '  (yo\'q)'}

TOPILGAN XATOLIKLAR:
${issuesList}

VAZIFA: Har bir xatolik uchun aniq tuzatish qiymatini ber.

JAVOBNI FAQAT JSON formatda ber:
{
  "fixes": {
    "name": "To'liq SEO nom: Brend + Mahsulot turi + Asosiy xususiyat + Model (agar nom xatosi bo'lsa)",
    "description": "Batafsil HTML-siz tavsif 300+ belgi, foyda va xususiyatlarni yoz (agar tavsif xatosi bo'lsa)",
    "vendor": "Brend nomi (agar brend xatosi bo'lsa)",
    "vendorCode": "Model raqami (agar kerak bo'lsa)",
    "barcode": "460XXXXXXXXXX formatda EAN-13 (agar barcode xatosi bo'lsa)",
    "weightDimensions": { "weight": 0.5, "length": 20, "width": 15, "height": 10 },
    "parameterValues": [
      { "parameterId": 0, "name": "param_nomi", "value": "qiymati" }
    ]
  },
  "expectedScore": 90,
  "summary": "Qisqa xulosa"
}

MUHIM QOIDALAR:
1. Faqat xatolikka ega bo'lgan maydonlarni tuzat, to'g'ri maydonlarni o'zgartirma
2. Nom: brend + mahsulot turi + asosiy xususiyat, 50-100 belgi
3. Tavsif: foyda, xususiyat, material, qo'llanilishi haqida 300-500 belgi
4. parameterValues: Yandex tavsiya qilgan REQUIRED parametrlarni AI bilan bashorat qilib to'ldir
5. Og'irlik kg da, o'lchamlar sm da
6. Barcode: haqiqiy EAN-13 format (13 raqam, 460 bilan boshlansin)
7. Ruscha va o'zbekcha aralash yozma, faqat ruscha yoz (Yandex Market uchun)`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Sen Yandex Market kartochka sifat ekspertisan. Faqat JSON formatda javob ber, boshqa hech narsa yozma." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error(`AI error ${aiResp.status}: ${errText}`);
    throw new Error(`AI xatolik: ${aiResp.status}`);
  }

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  // Extract JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      console.log(`AI fixes generated for ${issue.offerId}:`, JSON.stringify(parsed).substring(0, 200));
      return parsed;
    } catch (e) {
      console.error("JSON parse error:", e, "Content:", content.substring(0, 300));
    }
  }

  throw new Error("AI javobini tahlil qilib bo'lmadi");
}

// ===== APPLY FIXES VIA YANDEX API =====
async function applyFixes(
  apiKey: string,
  businessId: string,
  offerId: string,
  fixes: Record<string, any>,
  currentData?: Record<string, any>
): Promise<{ success: boolean; message: string; details?: string }> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const fixData = fixes.fixes || fixes;
  const results: string[] = [];
  let hasError = false;

  // === Step 1: Update offer base data via offer-mappings/update ===
  const offerUpdate: any = { offerId };
  let needsBaseUpdate = false;

  if (fixData.name && fixData.name !== currentData?.name) {
    offerUpdate.name = fixData.name;
    needsBaseUpdate = true;
  }
  if (fixData.description && fixData.description !== currentData?.description) {
    offerUpdate.description = fixData.description;
    needsBaseUpdate = true;
  }
  if (fixData.vendor) {
    offerUpdate.vendor = fixData.vendor;
    needsBaseUpdate = true;
  }
  if (fixData.vendorCode) {
    offerUpdate.vendorCode = fixData.vendorCode;
    needsBaseUpdate = true;
  }
  if (fixData.barcode) {
    offerUpdate.barcodes = [fixData.barcode];
    needsBaseUpdate = true;
  }
  if (fixData.weightDimensions) {
    offerUpdate.weightDimensions = fixData.weightDimensions;
    needsBaseUpdate = true;
  }

  if (needsBaseUpdate) {
    console.log(`Updating base data for ${offerId}:`, JSON.stringify(offerUpdate).substring(0, 300));

    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            offerMappings: [{ offer: offerUpdate }],
          }),
        }
      );

      if (resp.ok) {
        const respData = await resp.json();
        const errs = respData.results?.[0]?.errors || respData.result?.errors || [];
        if (errs.length > 0) {
          results.push(`⚠️ Asosiy ma'lumotlar: ${errs.map((e: any) => e.message || e.code).join(', ')}`);
          console.error(`Base update errors:`, JSON.stringify(errs));
          hasError = true;
        } else {
          results.push('✅ Nom, tavsif, brend yangilandi');
        }
      } else {
        const errText = await resp.text();
        results.push(`❌ Asosiy yangilash xatosi: ${resp.status}`);
        console.error(`Base update failed: ${resp.status} ${errText}`);
        hasError = true;
      }
    } catch (e) {
      results.push(`❌ Tarmoq xatosi (base update)`);
      console.error("Base update network error:", e);
      hasError = true;
    }
  }

  // === Step 2: Update card content (parameterValues) via offer-cards/update ===
  if (fixData.parameterValues && fixData.parameterValues.length > 0) {
    await sleep(600);

    const cardUpdate: any = {
      offerId,
      parameterValues: fixData.parameterValues.map((p: any) => {
        // Yandex expects specific format
        if (p.parameterId && p.parameterId > 0) {
          return { parameterId: p.parameterId, value: p.value ? [{ value: String(p.value) }] : undefined };
        }
        // If we only have name, try name-based approach
        return { parameterId: p.parameterId || 0, name: p.name, value: [{ value: String(p.value) }] };
      }).filter((p: any) => p.value),
    };

    console.log(`Updating card params for ${offerId}:`, JSON.stringify(cardUpdate).substring(0, 300));

    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards/update`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            offerCards: [cardUpdate],
          }),
        }
      );

      if (resp.ok) {
        const respData = await resp.json();
        const errs = respData.results?.[0]?.errors || respData.result?.errors || [];
        if (errs.length > 0) {
          results.push(`⚠️ Parametrlar: ${errs.map((e: any) => e.message || e.code).join(', ')}`);
          console.error(`Card update errors:`, JSON.stringify(errs));
        } else {
          results.push(`✅ ${fixData.parameterValues.length} ta parametr yangilandi`);
        }
      } else {
        const errText = await resp.text();
        results.push(`⚠️ Parametr yangilash: ${resp.status}`);
        console.error(`Card update failed: ${resp.status} ${errText}`);
      }
    } catch (e) {
      results.push(`⚠️ Parametr yangilash tarmoq xatosi`);
      console.error("Card update network error:", e);
    }
  }

  if (results.length === 0) {
    return { success: true, message: "Tuzatish kerak bo'lgan narsa yo'q" };
  }

  return {
    success: !hasError,
    message: results.join('\n'),
    details: `Kutilayotgan sifat: ${fixes.expectedScore || '85+'}. ${fixes.summary || ''}`,
  };
}

// ===== MAIN HANDLER =====
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
    const { action, marketplace, offerIds, offerId } = body;
    const mp = marketplace || 'yandex';

    console.log(`Audit action: ${action}, marketplace: ${mp}, user: ${user.id}`);

    // Get marketplace connection
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", mp)
      .eq("is_active", true)
      .limit(1);

    if (!connections?.length) {
      throw new Error(`${mp} marketplace ulanmagan`);
    }

    const credentials = connections[0].credentials as any;
    const { apiKey, businessId, campaignId } = await getBusinessId(credentials);
    const apiHeaders = { "Api-Key": apiKey, "Content-Type": "application/json" };

    switch (action) {
      case 'audit': {
        // 1. Fetch all offers
        const offers = await fetchAllOffers(apiKey, businessId);
        if (offers.length === 0) {
          return new Response(JSON.stringify({
            success: true, data: [], summary: { total: 0, critical: 0, warning: 0, avgScore: 100, fixable: 0 },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Fetch quality data with recommendations
        const offerIdList = offerIds?.length ? offerIds : offers.map(o => o.offerId).filter(Boolean);
        const cardQuality = await fetchCardQuality(apiKey, businessId, offerIdList);

        // 3. Analyze
        const issues = analyzeOffers(offers, cardQuality, offerIds);

        const summary = {
          total: issues.length,
          critical: issues.filter(i => i.issues.some(ii => ii.severity === 'error')).length,
          warning: issues.filter(i => i.issues.some(ii => ii.severity === 'warning') && !i.issues.some(ii => ii.severity === 'error')).length,
          avgScore: issues.length > 0 ? Math.round(issues.reduce((s, i) => s + i.qualityScore, 0) / issues.length) : 100,
          fixable: issues.filter(i => i.fixable).length,
        };

        console.log(`Audit complete: ${summary.total} cards, ${summary.critical} critical, ${summary.fixable} fixable`);

        return new Response(JSON.stringify({
          success: true, data: issues, summary,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'auto-fix': {
        const targetId = offerId || body.offerId;
        if (!targetId) throw new Error("offerId kerak");

        // 1. Get current card data
        const offers = await fetchAllOffers(apiKey, businessId);
        const cardQuality = await fetchCardQuality(apiKey, businessId, [targetId]);
        const issues = analyzeOffers(offers, cardQuality, [targetId]);

        if (issues.length === 0) {
          return new Response(JSON.stringify({
            success: true, data: { message: "Bu kartochkada xatolik topilmadi ✅", applied: false },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Generate AI fixes
        const aiResult = await generateAIFixes(issues[0]);
        if (aiResult.error) throw new Error(aiResult.error);

        // 3. Apply fixes via API
        const result = await applyFixes(apiKey, businessId, targetId, aiResult, issues[0].currentData);

        return new Response(JSON.stringify({
          success: true,
          data: {
            ...result,
            issue: { ...issues[0], currentData: undefined },
            fixes: aiResult,
          },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Noma'lum action: ${action}. Foydalaning: audit, auto-fix`);
    }
  } catch (e) {
    console.error("Audit handler error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Noma'lum xatolik",
    }), {
      status: e instanceof Error && e.message.includes("rate limit") ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
