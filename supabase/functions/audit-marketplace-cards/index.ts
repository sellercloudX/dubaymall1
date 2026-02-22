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
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/campaigns/${campaignId}`,
        { headers }
      );
      const data = await resp.json();
      if (resp.ok) {
        businessId = data.campaign?.business?.id;
        console.log(`Resolved businessId: ${businessId} from campaignId: ${campaignId}`);
      }
    } catch (e) {
      console.log(`Campaign API error:`, e.message);
    }
  }

  if (!businessId) {
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/businesses`,
        { headers }
      );
      const data = await resp.json();
      if (resp.ok && data.businesses?.length > 0) {
        businessId = data.businesses[0].id;
      }
    } catch (e) {
      console.log(`Businesses API error:`, e.message);
    }
  }

  if (!businessId) throw new Error("Business ID topilmadi");

  return { apiKey, businessId: String(businessId), campaignId: String(campaignId || '') };
}

// ===== FETCH ALL OFFERS =====
async function fetchAllOffers(apiKey: string, businessId: string, filterOfferIds?: string[]): Promise<any[]> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const allOffers: any[] = [];
  let pageToken: string | undefined;
  let page = 0;

  // If filtering by specific offerIds, use the filter in the request body
  const requestBody = filterOfferIds?.length 
    ? JSON.stringify({ offerIds: filterOfferIds })
    : '{}';

  do {
    let url = `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings?limit=200`;
    if (pageToken) url += `&page_token=${encodeURIComponent(pageToken)}`;

    const resp = await fetchWithRetry(url, { method: 'POST', headers, body: requestBody });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Offer fetch error: ${resp.status} ${errText.substring(0, 200)}`);
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

  console.log(`Fetched ${allOffers.length} offers from Yandex${filterOfferIds ? ` (filtered: ${filterOfferIds.length})` : ''}`);
  return allOffers;
}

// ===== FETCH CARD QUALITY =====
async function fetchCardQuality(
  apiKey: string, businessId: string, offerIds: string[]
): Promise<Map<string, any>> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const cardMap = new Map<string, any>();

  for (let i = 0; i < offerIds.length; i += 200) {
    const batch = offerIds.slice(i, i + 200);
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
        {
          method: 'POST', headers,
          body: JSON.stringify({ offerIds: batch, withRecommendations: true }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const cards = data.result?.offerCards || [];

        for (const card of cards) {
          const rating = typeof card.contentRating === 'number' 
            ? card.contentRating 
            : card.contentRating?.rating ?? card.contentRating?.score ?? null;

          cardMap.set(card.offerId, {
            contentRating: rating != null ? { rating } : null,
            averageContentRating: card.averageContentRating || null,
            recommendations: card.recommendations || card.cardRecommendations || [],
            cardStatus: card.cardStatus || '',
            errors: card.errors || [],
            warnings: card.warnings || [],
            parameterValues: card.parameterValues || [],
          });
        }
      }
    } catch (e) {
      console.error(`Card quality fetch error:`, e);
    }
    if (i + 200 < offerIds.length) await sleep(500);
  }

  return cardMap;
}

// ===== FETCH REAL CATEGORY PARAMETERS FROM YANDEX =====
async function fetchCategoryParameters(
  apiKey: string, categoryId: number, businessId: string
): Promise<any[]> {
  if (!categoryId || categoryId === 0) return [];

  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  try {
    const resp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/category/${categoryId}/parameters?businessId=${businessId}`,
      { method: 'POST', headers, body: '{}' }
    );
    if (resp.ok) {
      const data = await resp.json();
      const params = data.result?.parameters || [];
      console.log(`Category ${categoryId}: ${params.length} parameters available`);
      return params;
    } else {
      const errText = await resp.text();
      console.error(`Category params error: ${resp.status} ${errText.substring(0, 200)}`);
    }
  } catch (e) {
    console.error(`Category params fetch error:`, e);
  }
  return [];
}

// ===== LOOKUP MXIK CODE =====
async function lookupMxikCode(
  _supabase: any, productName: string, category: string, authToken?: string
): Promise<{ code: string; name: string } | null> {
  if (!productName || productName.length < 3) return null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    const resp = await fetch(`${supabaseUrl}/functions/v1/lookup-mxik-code`, {
      method: "POST",
      headers: {
        "Authorization": authToken || `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productName,
        category: category || '',
        description: '',
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data?.mxik_code) {
      console.log(`[MXIK] Found: ${data.mxik_code} (${data.mxik_name}) confidence: ${data.confidence}%`);
      return { code: data.mxik_code, name: data.mxik_name || data.name_ru || '' };
    }
    return null;
  } catch (e) {
    console.warn(`[MXIK] Error:`, e);
    return null;
  }
}

// ===== ANALYZE OFFERS =====
function analyzeOffers(
  offers: any[], cardQualityMap: Map<string, any>, filterOfferIds?: string[]
): QualityIssue[] {
  const results: QualityIssue[] = [];

  for (const offer of offers) {
    if (!offer.offerId) continue;
    if (filterOfferIds?.length && !filterOfferIds.includes(offer.offerId)) continue;

    const quality = cardQualityMap.get(offer.offerId);
    const issues: QualityIssue['issues'] = [];

    let qualityScore = -1;
    let hasApiScore = false;
    if (quality?.contentRating?.rating != null) {
      qualityScore = Math.round(quality.contentRating.rating);
      hasApiScore = true;
    } else if (quality?.averageContentRating != null) {
      qualityScore = Math.round(quality.averageContentRating);
      hasApiScore = true;
    }

    // === Name check ===
    if (!offer.name || offer.name.trim().length < 5) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'name',
        message: 'Mahsulot nomi yo\'q yoki juda qisqa',
        currentValue: offer.name || '(bo\'sh)',
        suggestedFix: 'AI yordamida to\'liq SEO nom yaratish (60+ belgi)',
      });
    } else if (offer.name.length < 60) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'name',
        message: `Nom qisqa (${offer.name.length} belgi), 60+ tavsiya`,
        currentValue: offer.name,
        suggestedFix: 'Nomga brend, model, asosiy xususiyat, hajm qo\'shish',
      });
    }

    // === Description check ===
    if (!offer.description || offer.description.trim().length < 10) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'description',
        message: 'Tavsif yo\'q yoki juda qisqa',
        currentValue: offer.description ? `${offer.description.length} belgi` : '(bo\'sh)',
        suggestedFix: 'AI yordamida batafsil tavsif yaratish (1000+ belgi)',
      });
    } else if (offer.description.length < 1000) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'description',
        message: `Tavsif qisqa (${offer.description.length} belgi), 1000+ tavsiya`,
        currentValue: `${offer.description.length} belgi`,
        suggestedFix: 'Tavsifni 1000+ belgigacha kengaytirish',
      });
    }

    // === Images check ===
    const totalImages = (offer.pictures?.length || 0) + (offer.urls?.length || 0);
    if (totalImages === 0) {
      issues.push({
        type: 'missing_content', severity: 'error', field: 'pictures',
        message: 'Rasmlar mavjud emas', currentValue: '0 ta',
        suggestedFix: 'Kamida 3 ta sifatli rasm qo\'shish',
      });
    } else if (totalImages < 3) {
      issues.push({
        type: 'low_quality', severity: 'warning', field: 'pictures',
        message: `Faqat ${totalImages} ta rasm (3+ tavsiya)`, currentValue: `${totalImages} ta`,
        suggestedFix: 'Qo\'shimcha rasmlar qo\'shish',
      });
    }

    // === Barcode check ===
    if (!offer.barcodes || offer.barcodes.length === 0) {
      issues.push({
        type: 'missing_content', severity: 'warning', field: 'barcode',
        message: 'Shtrix-kod mavjud emas', currentValue: '(bo\'sh)',
        suggestedFix: 'EAN-13 shtrix-kod qo\'shish',
      });
    }

    // === Vendor check ===
    if (!offer.vendor) {
      issues.push({
        type: 'missing_content', severity: 'warning', field: 'vendor',
        message: 'Brend/ishlab chiqaruvchi ko\'rsatilmagan', currentValue: '(bo\'sh)',
        suggestedFix: 'Brend nomini qo\'shish',
      });
    }

    // === Weight/dimensions ===
    if (!offer.weightDimensions) {
      issues.push({
        type: 'missing_content', severity: 'info', field: 'weightDimensions',
        message: 'Og\'irlik va o\'lchamlar ko\'rsatilmagan', currentValue: '(bo\'sh)',
        suggestedFix: 'Og\'irlik (kg), uzunlik, kenglik, balandlik qo\'shish',
      });
    }

    // === Yandex API recommendations ===
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

    if (!hasApiScore) {
      if (quality?.cardStatus === 'HAS_CARD_CAN_NOT_BE_IMPROVED') {
        qualityScore = 100;
      } else {
        const errorCount = issues.filter(i => i.severity === 'error').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;
        qualityScore = Math.max(10, 100 - (errorCount * 15) - (warningCount * 5));
      }
    }

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
          name: offer.name, description: offer.description,
          vendor: offer.vendor, vendorCode: offer.vendorCode,
          barcodes: offer.barcodes, pictures: offer.pictures,
          params: offer.params, weightDimensions: offer.weightDimensions,
        },
      });
    }
  }

  results.sort((a, b) => a.qualityScore - b.qualityScore);
  return results;
}

// ===== AI FIX GENERATION (with strict validation) =====
async function generateAIFixes(
  issue: QualityIssue,
  categoryParams: any[],
  mxikCode: { code: string; name: string } | null
): Promise<Record<string, any>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI xizmati sozlanmagan");

  const fixableIssues = issue.issues.filter(i => i.severity !== 'info');
  if (fixableIssues.length === 0) return { fixes: {}, summary: "Tuzatish kerak emas" };

  const currentData = issue.currentData || {};
  const issuesList = fixableIssues.map(i =>
    `- [${i.severity.toUpperCase()}] ${i.field}: ${i.message} (hozirgi: ${i.currentValue || 'bo\'sh'})`
  ).join('\n');

  // Build REAL parameter list with allowed values info
  const allParams = categoryParams.slice(0, 40);
  const paramTypeMap = new Map<number, any>();
  
  // Build enum values map for strict validation later
  const enumParamValues = new Map<number, Set<string>>();
  
  const requiredParamsList = allParams
    .map(p => {
      paramTypeMap.set(p.id, p);
      const allowedValues = p.values?.map((v: any) => v.value || v.name).slice(0, 15) || [];
      if (allowedValues.length > 0) {
        enumParamValues.set(p.id, new Set(allowedValues));
      }
      const isRequired = p.required ? ' [REQUIRED]' : '';
      const unitInfo = p.unit ? `, unit: "${p.unit.name || p.unit}" (unitId: ${p.unit.id || ''})` : '';
      const valuesStr = allowedValues.length > 0 ? `, FAQAT_MUMKIN_QIYMATLAR: [${allowedValues.join(', ')}]` : '';
      return `  - parameterId: ${p.id}, name: "${p.name}", type: ${p.type || 'string'}${isRequired}${unitInfo}${valuesStr}`;
    }).join('\n');

  const existingParams = (currentData.params || [])
    .map((p: any) => `  ${p.name || p.parameterName || p.parameterId}: ${p.value || JSON.stringify(p.values)}`)
    .join('\n');

  const mxikInfo = mxikCode
    ? `\nMXIK/IKPU kod topildi: ${mxikCode.code} (${mxikCode.name})`
    : '\nMXIK/IKPU kod topilmadi';

  const prompt = `Sen Yandex Market kartochka sifat ekspertisan. Mavjud kartochkani tahlil qil va SIFATINI OSHIR.

MAHSULOT:
- Nom: "${currentData.name || '(bo\'sh)'}"
- Tavsif: "${(currentData.description || '').substring(0, 500)}"
- Kategoriya: ${issue.category || 'Noma\'lum'} (ID: ${issue.categoryId})
- Brend: ${currentData.vendor || '(bo\'sh)'}
- Shtrixkod: ${currentData.barcodes?.join(', ') || '(bo\'sh)'}
- Rasmlar: ${currentData.pictures?.length || 0}
- Mavjud parametrlar:
${existingParams || '  (yo\'q)'}
${mxikInfo}

XATOLIKLAR:
${issuesList}

KATEGORIYA PARAMETRLARI (Yandex API):
${requiredParamsList || '  (mavjud emas)'}

QOIDALAR:
1. NOM: 60+ belgi SHART. Agar hozirgi 60+ va sifatli — O'ZGARTIRMA (null ber).
   Format: Brend + Tur + Model + Xususiyat + Hajm. Ruscha.
2. TAVSIF: 1000+ belgi SHART. Agar hozirgi 1000+ — O'ZGARTIRMA (null ber).
   Hozirgi tavsifni QISQARTIRMA — faqat kengaytir!
3. BREND: Agar bor — AYNAN QAYTARING. Yo'q bo'lsa tavsif/nomdan aniqlang.
4. parameterValues: FAQAT yuqoridagi HAQIQIY parameterId'lardan foydalan!
5. FAQAT_MUMKIN_QIYMATLAR berilgan parametrlar — FAQAT o'sha qiymatlardan birini tanlang (harf-baharf).
6. RAQAMLI parametrlar: faqat raqam ber, birlik QOSHMA. unitId bilan alohida ber.
   TO'G'RI: {"parameterId": 123, "value": "12", "unitId": 6}
   NOTO'G'RI: {"parameterId": 123, "value": "12 мм"}
7. [REQUIRED] parametrlarni ALBATTA to'ldir.
8. O'zing to'qib chiqargan parameterId ishlatma!

JSON:
{
  "fixes": {
    "name": "yangi nom yoki null (hozirgi yaxshi bo'lsa)",
    "description": "yangi tavsif yoki null",
    "vendor": "brend yoki null",
    "barcode": "EAN-13 yoki null",
    "weightDimensions": {"weight": 0.5, "length": 20, "width": 15, "height": 10},
    "parameterValues": [
      {"parameterId": HAQIQIY_ID, "value": "FAQAT_QIYMAT", "unitId": ID_AGAR_BOR}
    ]
  },
  "expectedScore": 90,
  "summary": "qisqa xulosa"
}`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Sen Yandex Market kartochka sifat ekspertisan. Faqat JSON formatda javob ber. Hech qachon parameterId to\'qib chiqarma." },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error(`AI error ${aiResp.status}: ${errText.substring(0, 200)}`);
    throw new Error(`AI xatolik: ${aiResp.status}`);
  }

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      
      // STRICT VALIDATION of parameterValues
      if (parsed.fixes?.parameterValues) {
        const validParamIds = new Set(categoryParams.map(p => p.id));
        const validParams: any[] = [];
        
        for (const p of parsed.fixes.parameterValues) {
          // 1. Must have valid parameterId from category
          if (!validParamIds.has(p.parameterId)) {
            console.log(`❌ Removing fake parameterId ${p.parameterId}`);
            continue;
          }
          
          // 2. Must have a value
          if (!p.value && p.value !== 0 && p.value !== false) {
            console.log(`❌ Skipping empty value for parameterId ${p.parameterId}`);
            continue;
          }
          
          // 3. For enum parameters, value MUST be in allowed list
          const allowedSet = enumParamValues.get(p.parameterId);
          if (allowedSet && allowedSet.size > 0) {
            const strVal = String(p.value);
            if (!allowedSet.has(strVal)) {
              // Try case-insensitive match
              const match = Array.from(allowedSet).find(v => v.toLowerCase() === strVal.toLowerCase());
              if (match) {
                p.value = match; // Use exact casing from allowed values
                console.log(`✅ Fixed enum case: "${strVal}" → "${match}" for param ${p.parameterId}`);
              } else {
                console.log(`❌ Invalid enum value "${strVal}" for parameterId ${p.parameterId}. Allowed: ${Array.from(allowedSet).slice(0, 5).join(', ')}`);
                continue;
              }
            }
          }
          
          // 4. Strip unit suffixes from numeric values
          if (typeof p.value === 'string') {
            const cleaned = p.value.replace(/\s*(мм|см|м|г|кг|мл|л|шт|мин|ч|дн|мес|год|%|°|℃|мА·ч|мАч|Вт|В|А|Гц|дБ|МБ|ГБ|ТБ|пикс|мп)\.?\s*$/i, '').trim();
            if (cleaned !== p.value) {
              console.log(`✅ Cleaned unit: "${p.value}" → "${cleaned}"`);
              p.value = cleaned;
            }
          }
          
          validParams.push(p);
        }

        parsed.fixes.parameterValues = validParams;
        console.log(`Validated params: ${validParams.length}/${parsed.fixes.parameterValues?.length || 0} valid`);
      }

      // Validate name length
      if (parsed.fixes?.name && parsed.fixes.name !== 'null' && parsed.fixes.name !== 'NULL') {
        if (parsed.fixes.name.length < 60) {
          console.log(`❌ AI name too short (${parsed.fixes.name.length}), discarding`);
          parsed.fixes.name = null;
        }
      }

      // Validate description length  
      if (parsed.fixes?.description && parsed.fixes.description !== 'null' && parsed.fixes.description !== 'NULL') {
        if (parsed.fixes.description.length < 500) {
          console.log(`❌ AI description too short (${parsed.fixes.description.length}), discarding`);
          parsed.fixes.description = null;
        }
        // Don't allow shorter than current
        if (currentData.description && parsed.fixes.description && 
            parsed.fixes.description.length < currentData.description.length) {
          console.log(`❌ AI description shorter than current, discarding`);
          parsed.fixes.description = null;
        }
      }

      return parsed;
    } catch (e) {
      console.error("JSON parse error:", e, "Content:", content.substring(0, 300));
    }
  }

  throw new Error("AI javobini tahlil qilib bo'lmadi");
}

// ===== APPLY FIXES VIA YANDEX API =====
async function applyFixes(
  apiKey: string, businessId: string, offerId: string,
  fixes: Record<string, any>, currentData?: Record<string, any>
): Promise<{ success: boolean; message: string; details?: string }> {
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const fixData = fixes.fixes || fixes;
  const results: string[] = [];
  let hasError = false;

  // === Step 1: Update offer base data ===
  const offerUpdate: any = { offerId };
  let needsBaseUpdate = false;

  if (fixData.name && fixData.name !== 'NULL' && fixData.name !== 'null' && fixData.name !== currentData?.name) {
    if (fixData.name.length >= 60 && (!currentData?.name || currentData.name.length < 60 || fixData.name.length >= currentData.name.length)) {
      offerUpdate.name = fixData.name;
      needsBaseUpdate = true;
    }
  }
  if (fixData.description && fixData.description !== 'NULL' && fixData.description !== 'null' && fixData.description !== currentData?.description) {
    if (fixData.description.length >= 500 && (!currentData?.description || currentData.description.length < 1000 || fixData.description.length >= currentData.description.length)) {
      offerUpdate.description = fixData.description;
      needsBaseUpdate = true;
    }
  }
  if (fixData.vendor && fixData.vendor !== 'NULL' && fixData.vendor !== 'null') { offerUpdate.vendor = fixData.vendor; needsBaseUpdate = true; }
  if (fixData.vendorCode) { offerUpdate.vendorCode = fixData.vendorCode; needsBaseUpdate = true; }
  if (fixData.barcode && !currentData?.barcodes?.length) { offerUpdate.barcodes = [fixData.barcode]; needsBaseUpdate = true; }
  if (fixData.weightDimensions && !currentData?.weightDimensions) { offerUpdate.weightDimensions = fixData.weightDimensions; needsBaseUpdate = true; }

  if (needsBaseUpdate) {
    console.log(`Updating base data for ${offerId}`);
    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
        { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: offerUpdate }] }) }
      );
      if (resp.ok) {
        const respData = await resp.json();
        const errs = respData.results?.[0]?.errors || respData.result?.errors || [];
        if (errs.length > 0) {
          const errMsgs = errs.map((e: any) => e.message || e.code).join(', ');
          results.push(`⚠️ Asosiy: ${errMsgs}`);
          console.error(`Base update errors: ${errMsgs}`);
          hasError = true;
        } else {
          results.push('✅ Nom, tavsif, brend yangilandi');
        }
      } else {
        const errText = await resp.text();
        results.push(`❌ Asosiy yangilash xatosi: ${resp.status}`);
        console.error(`Base update failed: ${resp.status} ${errText.substring(0, 200)}`);
        hasError = true;
      }
    } catch (e) {
      results.push(`❌ Tarmoq xatosi`);
      hasError = true;
    }
  }

  // === Step 2: Update card params ===
  const validParams = (fixData.parameterValues || []).filter((p: any) => p.parameterId && p.parameterId > 0 && p.value !== undefined && p.value !== null && p.value !== '');
  
  if (validParams.length > 0) {
    await sleep(600);

    const cardUpdate = {
      offerId,
      parameterValues: validParams.map((p: any) => {
        const unitId = p.unitId ? String(p.unitId) : undefined;
        
        if (Array.isArray(p.value)) {
          const fixedValues = p.value.map((v: any) => {
            const entry: any = { value: String(v.value || v) };
            if (unitId && !v.unitId) entry.unitId = unitId;
            else if (v.unitId) entry.unitId = String(v.unitId);
            return entry;
          });
          return { parameterId: p.parameterId, value: fixedValues };
        }
        
        const valueEntry: any = { value: String(p.value) };
        if (unitId) valueEntry.unitId = unitId;
        return { parameterId: p.parameterId, value: [valueEntry] };
      }),
    };

    console.log(`Updating ${validParams.length} card params for ${offerId}`);

    try {
      const resp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards/update`,
        { method: 'POST', headers, body: JSON.stringify({ offersContent: [cardUpdate] }) }
      );
      if (resp.ok) {
        const respData = await resp.json();
        const errs = respData.results?.[0]?.errors || respData.result?.errors || [];
        if (errs.length > 0) {
          const errMsgs = errs.map((e: any) => e.message || e.code).join(', ');
          results.push(`⚠️ Parametrlar: ${errMsgs}`);
          console.error(`Card update errors: ${errMsgs}`);
        } else {
          results.push(`✅ ${validParams.length} ta parametr yangilandi`);
        }
      } else {
        const errText = await resp.text();
        results.push(`⚠️ Parametr yangilash: ${resp.status}`);
        console.error(`Card update failed: ${resp.status} ${errText.substring(0, 200)}`);
      }
    } catch (e) {
      results.push(`⚠️ Parametr tarmoq xatosi`);
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

// ===== WILDBERRIES AUDIT HANDLER =====
const WB_CONTENT_API = "https://content-api.wildberries.ru";

async function wbFetchCards(apiKey: string): Promise<any[]> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const allCards: any[] = [];
  let cursor = { limit: 100, updatedAt: "", nmID: 0 };
  let page = 0;
  
  do {
    const body: any = { cursor, filter: { withPhoto: -1 } };
    const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/get/cards/list`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!resp.ok) { const t = await resp.text(); console.error(`WB cards list error: ${resp.status} ${t.substring(0, 200)}`); break; }
    const data = await resp.json();
    const cards = data.cards || data.data?.cards || [];
    if (cards.length === 0) break;
    allCards.push(...cards);
    const lastCard = cards[cards.length - 1];
    cursor = { limit: 100, updatedAt: lastCard.updatedAt || "", nmID: lastCard.nmID || 0 };
    page++;
    if (cards.length < 100) break;
    await sleep(300);
  } while (page < 50);

  console.log(`WB: fetched ${allCards.length} cards`);
  return allCards;
}

function analyzeWbCard(card: any): QualityIssue | null {
  const issues: QualityIssue['issues'] = [];
  const vendorCode = card.vendorCode || '';
  const title = card.title || '';
  const description = card.description || '';
  const photos = card.photos || card.mediaFiles || [];
  const characteristics = card.characteristics || [];
  const sizes = card.sizes || [];

  if (!title || title.length < 5) {
    issues.push({ type: 'missing_content', severity: 'error', field: 'title', message: 'Nom yo\'q yoki juda qisqa', currentValue: title || '(bo\'sh)', suggestedFix: 'SEO-optimallashtirilgan nom yaratish (60+ belgi)' });
  } else if (title.length < 60) {
    issues.push({ type: 'low_quality', severity: 'warning', field: 'title', message: `Nom qisqa (${title.length} belgi), 60+ tavsiya`, currentValue: title, suggestedFix: 'Nomga brend, model, xususiyatlarni qo\'shish' });
  }

  if (!description || description.length < 10) {
    issues.push({ type: 'missing_content', severity: 'error', field: 'description', message: 'Tavsif yo\'q', currentValue: '(bo\'sh)', suggestedFix: '1000+ belgili batafsil tavsif yaratish' });
  } else if (description.length < 300) {
    issues.push({ type: 'low_quality', severity: 'warning', field: 'description', message: `Tavsif qisqa (${description.length} belgi)`, currentValue: `${description.length} belgi`, suggestedFix: 'Tavsifni boyitish' });
  }

  if (photos.length === 0) {
    issues.push({ type: 'missing_content', severity: 'error', field: 'photos', message: 'Rasmlar yo\'q', currentValue: '0', suggestedFix: 'Kamida 3 ta sifatli rasm qo\'shish' });
  } else if (photos.length < 3) {
    issues.push({ type: 'low_quality', severity: 'warning', field: 'photos', message: `Faqat ${photos.length} ta rasm (3+ tavsiya)`, currentValue: `${photos.length}`, suggestedFix: 'Qo\'shimcha rasmlar qo\'shish' });
  }

  const filledCharcs = characteristics.filter((c: any) => {
    const vals = Object.values(c);
    return vals.some(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));
  });
  if (filledCharcs.length < 3) {
    issues.push({ type: 'missing_content', severity: 'warning', field: 'characteristics', message: `Faqat ${filledCharcs.length} ta xususiyat to'ldirilgan`, currentValue: `${filledCharcs.length}`, suggestedFix: 'Barcha xususiyatlarni to\'ldirish sifatni oshiradi' });
  }

  const video = card.video || card.videos || [];
  if ((!Array.isArray(video) || video.length === 0) && photos.length >= 3) {
    issues.push({ type: 'rich_content', severity: 'info', field: 'video', message: 'Video kontent yo\'q', currentValue: '0', suggestedFix: 'Video qo\'shish konversiyani 30% oshiradi' });
  }

  const hasBarcodes = sizes.some((s: any) => s.skus?.length > 0 || s.barcode);
  if (!hasBarcodes) {
    issues.push({ type: 'missing_content', severity: 'warning', field: 'barcode', message: 'Shtrix-kod yo\'q', currentValue: '(bo\'sh)', suggestedFix: 'EAN-13 shtrix-kod qo\'shish' });
  }

  if (issues.length === 0) return null;

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const qualityScore = Math.max(10, 100 - (errorCount * 15) - (warningCount * 5));

  return {
    offerId: vendorCode || String(card.nmID || ''),
    productName: title || vendorCode || `nmID: ${card.nmID}`,
    marketplace: 'wildberries',
    qualityScore,
    issues,
    fixable: issues.some(i => i.severity === 'error' || i.severity === 'warning'),
    category: card.subjectName || '',
    categoryId: card.subjectID || 0,
    currentData: { name: title, description, vendor: card.brand, photos, characteristics, sizes, nmID: card.nmID, vendorCode },
  };
}

async function wbAutoFix(apiKey: string, vendorCode: string): Promise<any> {
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI xizmati sozlanmagan");

  const resp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/get/cards/list`, {
    method: "POST", headers,
    body: JSON.stringify({ cursor: { limit: 100, updatedAt: "", nmID: 0 }, filter: { withPhoto: -1, textSearch: vendorCode } }),
  });
  if (!resp.ok) throw new Error(`WB cards fetch error: ${resp.status}`);
  const data = await resp.json();
  const cards = data.cards || data.data?.cards || [];
  const card = cards.find((c: any) => c.vendorCode === vendorCode || String(c.nmID) === vendorCode);
  if (!card) throw new Error(`Kartochka topilmadi: ${vendorCode}`);

  const issue = analyzeWbCard(card);
  if (!issue || issue.qualityScore >= 90) return { success: true, message: "Kartochka sifati yaxshi ✅" };

  const subjectID = card.subjectID;
  let charcs: any[] = [];
  let descCharcId: number | null = null;
  let nameCharcId: number | null = null;
  if (subjectID) {
    const chResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/object/charcs/${subjectID}`, { headers });
    if (chResp.ok) {
      const chData = await chResp.json();
      charcs = chData.data || [];
      // Find name and description charcIDs
      for (const c of charcs) {
        const name = (c.name || '').toLowerCase();
        if (name.includes('описание')) descCharcId = c.charcID || c.id;
        if (name.includes('наименование')) nameCharcId = c.charcID || c.id;
      }
    }
  }

  const issuesList = issue.issues.filter(i => i.severity !== 'info').map(i => `- [${i.severity}] ${i.field}: ${i.message}`).join('\n');
  const charcsList = charcs.slice(0, 30).map((c: any) => {
    const dict = c.dictionary?.length ? ` [${c.dictionary.slice(0, 8).map((d: any) => d.value || d.title || d).join(', ')}]` : '';
    const req = c.required ? ' [REQUIRED]' : '';
    return `- "${c.name}" (charcID: ${c.charcID}, type: ${c.type || 'string'})${req}${dict}`;
  }).join('\n');

  const prompt = `Fix this Wildberries product card. Return JSON.
PRODUCT:
- Title: "${card.title || ''}"
- Description: "${(card.description || '').substring(0, 500)}"
- Brand: "${card.brand || ''}"
- Subject: "${card.subjectName || ''}" (ID: ${subjectID})
- Photos: ${(card.photos || []).length}
- Characteristics: ${(card.characteristics || []).length}
ISSUES:
${issuesList}
CHARACTERISTICS (use charcID for updates):
${charcsList || '(none)'}
RULES:
- Title MUST be 40-60 chars in Russian. NEVER exceed 60!
- Description MUST be 1000+ chars in Russian
- Keep existing brand name
Return JSON: {"title": "new 40-60 char title or null", "description": "new 1000+ char description or null", "vendor": "brand or null", "summary": "brief"}`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", temperature: 0.15,
      messages: [
        { role: "system", content: "Wildberries kartochka sifat ekspertisan. Faqat JSON javob ber." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!aiResp.ok) throw new Error(`AI xatolik: ${aiResp.status}`);
  const aiData = await aiResp.json();
  const aiContent = aiData.choices?.[0]?.message?.content || '';
  const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/) || aiContent.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("AI javobini tahlil qilib bo'lmadi");

  const fixes = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const results: string[] = [];

  const nmID = card.nmID;
  if (nmID) {
    // Build update using characteristics format (charcID-based) — same as admin ai-agent-fix
    const updatePayload: any = { nmID, vendorCode: card.vendorCode };
    const updateCharcs: any[] = [];

    // Title via characteristics (naименование charcID)
    if (fixes.title && fixes.title.length >= 40 && fixes.title.length <= 60) {
      updateCharcs.push({ id: nameCharcId || 9, value: [fixes.title] });
    } else if (fixes.title && fixes.title.length > 60) {
      // Truncate to 57 + ...
      updateCharcs.push({ id: nameCharcId || 9, value: [fixes.title.substring(0, 57) + '...'] });
    }

    // Description via characteristics (описание charcID)
    if (fixes.description && fixes.description.length >= 300) {
      updateCharcs.push({ id: descCharcId || 14, value: [fixes.description] });
    }

    if (updateCharcs.length > 0) {
      updatePayload.characteristics = updateCharcs;
    }

    if (updateCharcs.length > 0) {
      console.log(`WB fix: updating ${updateCharcs.length} characteristics for nmID ${nmID} (nameCharcId: ${nameCharcId}, descCharcId: ${descCharcId})`);
      const updateResp = await fetchWithRetry(`${WB_CONTENT_API}/content/v2/cards/update`, {
        method: "POST", headers, body: JSON.stringify([updatePayload]),
      });
      if (updateResp.ok) {
        const updateData = await updateResp.json();
        if (!updateData.error) {
          if (fixes.title) results.push('✅ Nom yangilandi');
          if (fixes.description) results.push('✅ Tavsif yangilandi');
        } else {
          results.push(`⚠️ WB: ${updateData.errorText || 'Xatolik'}`);
        }
      } else {
        const errText = await updateResp.text();
        console.error(`WB update error: ${updateResp.status} ${errText.substring(0, 200)}`);
        results.push(`❌ Yangilash xatosi: ${updateResp.status}`);
      }

      // Check for async errors after update
      await sleep(3000);
      try {
        const errResp = await fetchWithRetry(
          `https://content-api.wildberries.ru/content/v2/cards/error/list`,
          { method: 'GET', headers }
        );
        if (errResp.ok) {
          const errData = await errResp.json();
          const errors = (errData.data || errData.errors || []).filter((e: any) => (e.nmID || e.nmId) === nmID);
          if (errors.length > 0) {
            results.push(`⚠️ WB async xatolik: ${errors.map((e: any) => e.message || e.error).join('; ').substring(0, 200)}`);
          }
        }
      } catch (e) { /* optional */ }
    }

    // Generate and upload image if photos < 3
    const photos = card.photos || card.mediaFiles || [];
    if (photos.length < 3) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          // Use existing photo as reference if available
          const refUrl = photos.length > 0 ? (typeof photos[0] === 'string' ? photos[0] : photos[0]?.big || photos[0]?.tm || '') : null;
          const content: any[] = [
            { type: "text", text: `Create a professional e-commerce product photo of "${card.title || card.vendorCode}". Clean white background, product centered, studio lighting, 3:4 aspect ratio, no text/watermarks, photorealistic.` }
          ];
          if (refUrl && refUrl.startsWith('http')) {
            content.push({ type: "image_url", image_url: { url: refUrl } });
            content[0].text = `Create a professional e-commerce photo based on this exact product. Keep the SAME product. Clean white background, centered, studio lighting, 3:4 aspect, no text/watermarks.`;
          }

          const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content }],
              modalities: ["image", "text"],
            }),
          });

          if (imgResp.ok) {
            const imgData = await imgResp.json();
            const genUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (genUrl) {
              // Upload to storage
              let bytes: Uint8Array;
              if (genUrl.startsWith('data:')) {
                const b64 = genUrl.replace(/^data:image\/\w+;base64,/, '');
                bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              } else {
                const dl = await fetch(genUrl);
                bytes = new Uint8Array(await dl.arrayBuffer());
              }

              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              const storageClient = createClient(supabaseUrl, supabaseKey);
              
              const fileName = `ai-audit/${vendorCode}-${Date.now()}.png`;
              const { error: uploadErr } = await storageClient.storage
                .from('product-images')
                .upload(fileName, bytes, { contentType: 'image/png', upsert: true });
              
              if (!uploadErr) {
                const { data: pubData } = storageClient.storage.from('product-images').getPublicUrl(fileName);
                if (pubData?.publicUrl) {
                  const mediaResp = await fetchWithRetry(
                    `https://content-api.wildberries.ru/content/v3/media/save`,
                    { method: 'POST', headers, body: JSON.stringify({ nmId: nmID, data: [pubData.publicUrl] }) }
                  );
                  if (mediaResp.ok) {
                    results.push('✅ AI rasm yaratildi va yuklandi');
                  } else {
                    results.push('⚠️ Rasm yaratildi, WB yuklash xatosi');
                  }
                }
              }
            }
          }
        } catch (imgErr) {
          console.error('WB audit image gen error:', imgErr);
          results.push('⚠️ Rasm generatsiya xatosi');
        }
      }
    }
  }

  return { success: results.some(r => r.startsWith('✅')), message: results.join('\n') || 'Tuzatish kerak bo\'lgan narsa yo\'q', fixes };
}

async function handleWildberriesAudit(action: string, apiKey: string, offerId?: string, offerIds?: string[]): Promise<Response> {
  switch (action) {
    case 'audit': {
      const cards = await wbFetchCards(apiKey);
      if (cards.length === 0) {
        return new Response(JSON.stringify({ success: true, data: [], summary: { total: 0, critical: 0, warning: 0, avgScore: 100, fixable: 0 } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const issues: QualityIssue[] = [];
      for (const card of cards) {
        if (offerIds?.length && !offerIds.includes(card.vendorCode) && !offerIds.includes(String(card.nmID))) continue;
        const issue = analyzeWbCard(card);
        if (issue) issues.push(issue);
      }
      issues.sort((a, b) => a.qualityScore - b.qualityScore);
      const summary = {
        total: issues.length,
        critical: issues.filter(i => i.issues.some(ii => ii.severity === 'error')).length,
        warning: issues.filter(i => i.issues.some(ii => ii.severity === 'warning') && !i.issues.some(ii => ii.severity === 'error')).length,
        avgScore: issues.length > 0 ? Math.round(issues.reduce((s, i) => s + i.qualityScore, 0) / issues.length) : 100,
        fixable: issues.filter(i => i.fixable).length,
      };
      return new Response(JSON.stringify({ success: true, data: issues, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    case 'auto-fix': {
      if (!offerId) throw new Error("offerId kerak");
      const result = await wbAutoFix(apiKey, offerId);
      return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    default:
      throw new Error(`Noma'lum action: ${action}`);
  }
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

    if (!connections?.length) throw new Error(`${mp} marketplace ulanmagan`);

    let credentials: any = connections[0].credentials;
    
    if (connections[0].encrypted_credentials) {
      const { data: decrypted, error: decryptErr } = await supabase
        .rpc('decrypt_credentials', { p_encrypted: connections[0].encrypted_credentials });
      
      if (!decryptErr && decrypted) {
        credentials = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
      }
    }

    // ===== WILDBERRIES AUDIT =====
    if (mp === 'wildberries') {
      const wbApiKey = credentials.apiKey || credentials.api_key || '';
      if (!wbApiKey) throw new Error("Wildberries API kaliti topilmadi");
      
      return await handleWildberriesAudit(action, wbApiKey, offerId, offerIds);
    }
    
    // ===== YANDEX AUDIT =====
    if (mp !== 'yandex') {
      return new Response(JSON.stringify({
        success: false,
        error: `${mp} uchun audit hozircha qo'llab-quvvatlanmaydi. Yandex yoki Wildberries tanlang.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { apiKey, businessId } = await getBusinessId(credentials);

    switch (action) {
      case 'audit': {
        const offers = await fetchAllOffers(apiKey, businessId);
        if (offers.length === 0) {
          return new Response(JSON.stringify({
            success: true, data: [],
            summary: { total: 0, critical: 0, warning: 0, avgScore: 100, fixable: 0 },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const offerIdList = offerIds?.length ? offerIds : offers.map(o => o.offerId).filter(Boolean);
        const cardQuality = await fetchCardQuality(apiKey, businessId, offerIdList);
        const issues = analyzeOffers(offers, cardQuality, offerIds);

        const summary = {
          total: issues.length,
          critical: issues.filter(i => i.issues.some(ii => ii.severity === 'error')).length,
          warning: issues.filter(i => i.issues.some(ii => ii.severity === 'warning') && !i.issues.some(ii => ii.severity === 'error')).length,
          avgScore: issues.length > 0 ? Math.round(issues.reduce((s, i) => s + i.qualityScore, 0) / issues.length) : 100,
          fixable: issues.filter(i => i.fixable).length,
        };

        return new Response(JSON.stringify({
          success: true, data: issues, summary,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'auto-fix': {
        const targetId = offerId || body.offerId;
        if (!targetId) throw new Error("offerId kerak");

        const maxRetries = 2;
        let lastResult: any = null;
        let totalFixes: string[] = [];

        for (let round = 0; round < maxRetries; round++) {
          console.log(`=== Fix round ${round + 1} for ${targetId} ===`);

          const offers = await fetchAllOffers(apiKey, businessId, [targetId]);
          const cardQuality = await fetchCardQuality(apiKey, businessId, [targetId]);
          const issues = analyzeOffers(offers, cardQuality, [targetId]);

          if (issues.length === 0) {
            return new Response(JSON.stringify({
              success: true, data: { 
                message: totalFixes.length > 0 
                  ? `✅ Kartochka tuzatildi (${round} bosqich)\n${totalFixes.join('\n')}`
                  : "Bu kartochkada xatolik topilmadi ✅", 
                applied: totalFixes.length > 0 
              },
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          const issue = issues[0];
          if (issue.qualityScore >= 90 && round > 0) { console.log(`Score >= 90, stopping.`); break; }

          const categoryParams = await fetchCategoryParameters(apiKey, issue.categoryId || 0, businessId);
          const mxikCode = await lookupMxikCode(supabase, issue.productName, issue.category || '', authHeader);

          let aiResult: any;
          try {
            aiResult = await generateAIFixes(issue, categoryParams, mxikCode);
            if (aiResult.error) throw new Error(aiResult.error);
          } catch (e: any) {
            totalFixes.push(`❌ AI xatosi: ${e.message}`);
            lastResult = { success: false, message: e.message };
            break;
          }

          const result = await applyFixes(apiKey, businessId, targetId, aiResult, issue.currentData);
          lastResult = { ...result, issue: { ...issue, currentData: undefined }, fixes: aiResult };
          totalFixes.push(`Bosqich ${round + 1}: ${result.message}`);

          if (round < maxRetries - 1 && issue.qualityScore < 90) {
            await sleep(3000);
          } else { break; }
        }

        return new Response(JSON.stringify({
          success: true, data: { ...lastResult, message: totalFixes.join('\n') },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Noma'lum action: ${action}`);
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
