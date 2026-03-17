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

async function resolveConnectionCredentials(adminClient: any, conn: any): Promise<any> {
  if (!conn?.encrypted_credentials) return conn?.credentials || {};

  try {
    const { data: decrypted, error: decErr } = await adminClient.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
    if (!decErr && decrypted) return typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    console.warn(`[${conn.marketplace}] decrypt failed, trying base64/plain fallback:`, decErr?.message);
  } catch (e) {
    console.warn(`[${conn.marketplace}] decrypt exception, trying fallback:`, (e as Error)?.message || e);
  }

  try {
    const decoded = atob(conn.encrypted_credentials);
    return JSON.parse(decoded);
  } catch {
    return conn?.credentials || {};
  }
}

// ===== AI: Generate fix with EXACT moderation errors =====
async function generateFix(product: any, marketplace: string, previousAttempt?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY sozlanmagan");

  const mpName = marketplace === 'yandex' ? 'Yandex Market' : 'Wildberries';
  
  let retryContext = '';
  if (previousAttempt) {
    retryContext = `
MUHIM: Oldingi urinish muvaffaqiyatsiz bo'ldi:
- Yandex qaytargan xatolik: ${previousAttempt.error || 'Noma\'lum'}
- Oldingi nom: "${previousAttempt.fix?.name || ''}"
- Oldingi tavsif uzunligi: ${previousAttempt.fix?.description?.length || 0}

Bu Yandex xatosini ANIQ tuzat. Nima noto'g'ri bo'lganini tahlil qil va boshqa yondashuv qo'lla.
Masalan: agar "Значение параметра не найдено" bo'lsa, parametr qiymatini o'zgartir.
Agar "Слишком длинное название" bo'lsa, nomni qisqartir.
`;
  }

  // Build EXACT moderation errors section
  let moderationSection = '';
  const apiErrors = product.apiErrorMessages || [];
  const issueDetails = product.issueDetails || [];
  const apiIssues = issueDetails.filter((d: any) => d.field === 'api');
  
  if (apiErrors.length > 0 || apiIssues.length > 0) {
    const allErrors = [...new Set([...apiErrors, ...apiIssues.map((i: any) => `[${i.type}] ${i.msg} (parametr: ${i.parameter || '?'})`)])];
    moderationSection = `
⚠️ YANDEX MODERATSIYA XATOLIKLARI (BU XATOLARNI ANIQ TUZATISH KERAK):
${allErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Bu xatolar Yandex moderatsiyasidan qaytgan HAQIQIY xatolar. Har birini MAQSADLI tuzat:
- "Значение параметра не найдено" → parametr qiymatini to'g'ri ko'rsat
- "Слишком длинное/короткое название" → nom uzunligini qoidaga mosla
- "Описание не соответствует" → tavsifni qayta yoz
- "Изображение не прошло модерацию" → rasm kerak (needsImage=true)
- "Не указан бренд" → vendor maydonini to'ldir
`;
  }

  const wbRules = marketplace === 'wildberries' ? `
WB MAXSUS QOIDALAR:
- NOM: Ruscha, QATIIY 40-60 belgi. Oshmasligi SHART!
- TAVSIF: Ruscha, 1000-2000 belgi
- Maxsus belgilar ishlatma
- Brend nomini nomga qo'shma
` : `
YANDEX MAXSUS QOIDALAR:
- NOM: Ruscha, 60-100 belgi. Brend + Tur + Model + Asosiy xususiyat
- TAVSIF: Ruscha, 1000-2000 belgi, SEO-optimallashtirilgan, batafsil texnik xususiyatlar
- name_uz: O'zbekcha lotin alifbosida nom
- TAVSIFDA taqiqlangan: emoji, HTML teglar, ortiqcha bosh harflar, telefon raqamlar, URL
`;

  const otherIssues = issueDetails.filter((d: any) => d.field !== 'api').map((d: any) => `[${d.type}] ${d.field}: ${d.msg}`).join('\n');

  const prompt = `Sen ${mpName} kartochka sifat ekspertisan. ASOSIY MAQSAD: Yandex moderatsiya xatolarini to'liq tuzatish.

MAHSULOT:
- Nom: "${product.name}"
- offerId: ${product.offerId}
- Kategoriya: ${product.category || 'Noma\'lum'}
- Hozirgi ball: ${product.score || '?'}
- Rasmlar: ${product.imageCount || 0} ta
- Tavsif uzunligi: ${product.descriptionLength || 0} belgi
- Brend: ${product.hasVendor ? 'bor' : 'yo\'q'}
- API xatolar: ${product.apiErrors || 0} ta
- API ogohlantirishlar: ${product.apiWarnings || 0} ta
${moderationSection}
BOSHQA MUAMMOLAR:
${otherIssues || 'yo\'q'}
${retryContext}
${wbRules}

VAZIFA: 
1. BIRINCHI NAVBATDA moderatsiya xatolarini to'liq tuzat
2. Keyin sifat balini 90+ ga ko'tar
3. Tavsif kamida 1000 belgi, professional ruscha, SEO kalit so'zlar bilan
4. Nom marketplace qoidalariga mos uzunlikda
5. Agar brend yo'q bo'lsa, mahsulot turiga mos brend qo'y

FAQAT JSON javob ber (boshqa hech narsa yozma):
{
  "name": "yangilangan nom (ruscha, Yandex uchun 60-100 belgi)",
  "name_uz": "o'zbekcha nom (lotin)",
  "description": "batafsil tavsif (ruscha, 1000+ belgi, SEO kalit so'zlar, texnik xususiyatlar)",
  "vendor": "brend nomi",
  "summary": "qisqa xulosa: qaysi moderatsiya xatosi qanday tuzatildi",
  "needsImage": true/false,
  "fixedErrors": ["tuzatilgan xato 1", "tuzatilgan xato 2"]
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
        { role: "system", content: "Sen marketplace kartochka sifat ekspertisan. FAQAT JSON javob ber, hech qanday qo'shimcha matn yo'q. Yandex moderatsiya xatolarini ANIQ tuzatishga ixtisoslashgansan." },
        { role: "user", content: prompt },
      ],
      temperature: previousAttempt ? 0.4 : 0.2,
    }),
  });

  if (!aiResp.ok) {
    if (aiResp.status === 429) throw new Error("AI rate limit. Keyinroq urinib ko'ring.");
    if (aiResp.status === 402) throw new Error("AI kredit tugadi.");
    throw new Error(`AI xatolik: ${aiResp.status}`);
  }

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("AI javobini tahlil qilib bo'lmadi");

  const fix = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  
  // Post-process validation
  if (marketplace === 'wildberries' && fix.name && fix.name.length > 60) {
    fix.name = fix.name.substring(0, 57) + '...';
  }
  if (marketplace === 'yandex' && fix.name) {
    // Ensure name is between 60-100 chars
    if (fix.name.length > 100) fix.name = fix.name.substring(0, 97) + '...';
    if (fix.name.length < 60) {
      const category = product.category || '';
      if (category && fix.name.length + category.length + 3 <= 100) {
        fix.name = `${fix.name} — ${category}`;
      }
    }
  }

  if (fix.needsImage === undefined) {
    fix.needsImage = (product.imageCount || 0) < 3;
  }
  
  return fix;
}

// ===== Generate and upload image using REFERENCE =====
async function generateAndUploadImage(adminClient: any, partnerId: string, product: any, marketplace: string, credentials: any): Promise<{ success: boolean; message: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { success: false, message: 'AI key yo\'q' };

  try {
    const existingImages = product.pictures || [];
    const referenceUrl = existingImages.find((p: string) => p && p.startsWith('http')) || null;
    console.log(`Generating image for: "${product.name}", ref: ${referenceUrl ? 'YES' : 'NO'}`);
    
    let imageUrl: string | null = null;

    if (referenceUrl) {
      const editPrompt = `Create a professional e-commerce product photo based on this exact product.
Requirements:
- Keep the SAME product, same shape, same design, same colors
- Clean white or light gradient background
- Professional studio lighting, high resolution, sharp focus
- Product centered, large, with negative space around edges for text overlays
- Aspect ratio 3:4, portrait orientation, 1080x1440 pixels
- Remove any existing text, watermarks, logos from background
- Photorealistic commercial marketplace quality`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: [{ type: "text", text: editPrompt }, { type: "image_url", image_url: { url: referenceUrl } }] }],
          modalities: ["image", "text"],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
      }
    }

    if (!imageUrl) {
      const prompt = `Generate a professional e-commerce product photo of "${product.name}" (category: ${product.category || ''}). 
Clean white background, product centered, large, studio lighting, sharp focus, 3:4 aspect ratio, no text, no watermarks, photorealistic.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
      });

      if (!resp.ok) return { success: false, message: `Rasm yaratish: ${resp.status}` };
      const data = await resp.json();
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    }

    if (!imageUrl) return { success: false, message: 'Rasm generatsiya qilinmadi' };

    let bytes: Uint8Array;
    if (imageUrl.startsWith('data:')) {
      const base64Content = imageUrl.replace(/^data:image\/\w+;base64,/, '');
      bytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    } else {
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) return { success: false, message: 'Rasm yuklab bo\'lmadi' };
      bytes = new Uint8Array(await imgResp.arrayBuffer());
    }

    const fileName = `ai-agent/${partnerId}/${product.offerId}-${Date.now()}.png`;
    const { error: uploadErr } = await adminClient.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });
    if (uploadErr) return { success: false, message: `Storage: ${uploadErr.message}` };

    const { data: urlData } = adminClient.storage.from('product-images').getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) return { success: false, message: 'Public URL olinmadi' };

    if (marketplace === 'yandex') {
      const apiKey = credentials.apiKey || credentials.api_key;
      const headers: Record<string, string> = { "Api-Key": apiKey, "Content-Type": "application/json" };
      const businessId = await resolveBusinessId(credentials, headers);
      if (!businessId) return { success: false, message: 'Business ID topilmadi' };

      let existingOffer: any = {};
      const getResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
        { method: 'POST', headers, body: JSON.stringify({ offerIds: [product.offerId] }) }
      );
      if (getResp.ok) {
        const getData = await getResp.json();
        existingOffer = getData.result?.offerMappings?.[0]?.offer || {};
      }

      const existingPictures = existingOffer.pictures || [];
      const allPictures = [publicUrl, ...existingPictures];
      
      const offerUpdate: any = { ...existingOffer, offerId: product.offerId, pictures: allPictures };
      delete offerUpdate.archived; delete offerUpdate.cardStatus; delete offerUpdate.mapping;
      delete offerUpdate.awaitingModerationMapping; delete offerUpdate.rejectedMapping;

      const updateResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
        { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: offerUpdate }] }) }
      );
      if (!updateResp.ok) return { success: false, message: 'Yandex rasm yuklash xatosi' };
      return { success: true, message: `Rasm yaratildi va 1-chi o'ringa qo'yildi (jami ${allPictures.length})` };
    } else if (marketplace === 'wildberries' && product.nmID) {
      const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
      const wbResp = await fetchWithRetry(
        `https://content-api.wildberries.ru/content/v3/media/save`,
        { method: 'POST', headers: { Authorization: apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ nmId: product.nmID, data: [publicUrl] }) }
      );
      if (!wbResp.ok) return { success: false, message: 'WB rasm yuklash xatosi' };
      return { success: true, message: 'Rasm yaratildi va WB ga yuklandi' };
    }

    return { success: true, message: 'Rasm yaratildi (storage)' };
  } catch (e) {
    console.error('Image gen error:', e);
    return { success: false, message: (e as any).message || 'Rasm xatosi' };
  }
}

async function resolveBusinessId(credentials: any, headers: Record<string, string>): Promise<string | null> {
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
  if (!businessId && campaignId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/campaigns/${campaignId}`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.campaign?.business?.id; }
  }
  if (!businessId) {
    const resp = await fetchWithRetry(`https://api.partner.market.yandex.ru/businesses`, { headers });
    if (resp.ok) { const d = await resp.json(); businessId = d.businesses?.[0]?.id; }
  }
  return businessId || null;
}

// ===== YANDEX: Apply fix with REAL verification =====
async function applyYandexFix(credentials: any, offerId: string, fix: any): Promise<{ success: boolean; message: string; newScore?: number; remainingErrors?: string[]; verified: boolean }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const headers = { "Api-Key": apiKey, "Content-Type": "application/json" };
  const businessId = await resolveBusinessId(credentials, headers);
  if (!businessId) throw new Error("Business ID topilmadi");

  // CRITICAL: Fetch existing offer data first to preserve all fields
  let existingOffer: any = {};
  try {
    const getResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
      { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId] }) }
    );
    if (getResp.ok) {
      const getData = await getResp.json();
      existingOffer = getData.result?.offerMappings?.[0]?.offer || {};
      console.log(`Fetched existing offer: price=${existingOffer.basicPrice?.value}, pictures=${existingOffer.pictures?.length}, vendor=${existingOffer.vendor}`);
    }
  } catch (e) {
    console.warn('Could not fetch existing offer:', e);
  }

  // Merge: start with existing offer, override only fix fields
  const offerUpdate: any = { ...existingOffer, offerId };
  if (fix.name) offerUpdate.name = fix.name;
  if (fix.description) offerUpdate.description = fix.description;
  if (fix.vendor) offerUpdate.vendor = fix.vendor;
  
  // Remove read-only fields
  delete offerUpdate.archived;
  delete offerUpdate.cardStatus;
  delete offerUpdate.mapping;
  delete offerUpdate.awaitingModerationMapping;
  delete offerUpdate.rejectedMapping;

  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
    { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: offerUpdate }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex API: ${resp.status} - ${errText.substring(0, 200)}`, verified: false };
  }

  const respData = await resp.json();
  const apiErrors = respData.results?.[0]?.errors || respData.result?.errors || [];
  if (apiErrors.length > 0) {
    const errorMsgs = apiErrors.map((e: any) => e.message || e.code || 'unknown');
    return { success: false, message: `Yandex rad etdi: ${errorMsgs.join('; ').substring(0, 300)}`, verified: true, remainingErrors: errorMsgs };
  }

  // Real verification: wait and check quality score + errors
  console.log(`[Verification] Waiting 8 seconds for Yandex to process ${offerId}...`);
  await sleep(8000);
  
  let newScore: number | undefined;
  let remainingErrors: string[] = [];
  let verified = false;
  
  try {
    const verifyResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
      { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId], withRecommendations: true }) }
    );
    if (verifyResp.ok) {
      const verifyData = await verifyResp.json();
      const card = verifyData.result?.offerCards?.[0];
      if (card) {
        verified = true;
        newScore = typeof card.contentRating === 'number' ? card.contentRating : card.contentRating?.rating ?? undefined;
        if (typeof newScore !== 'number' || isNaN(newScore)) newScore = undefined;
        
        // Check remaining errors
        const cardErrors = card.errors || [];
        const cardWarnings = card.warnings || [];
        remainingErrors = [
          ...cardErrors.map((e: any) => `❌ ${e.message || e.description || e.code}`),
          ...cardWarnings.map((w: any) => `⚠️ ${w.message || w.description || w.code}`),
        ];
        
        console.log(`[Verification] ${offerId}: score=${newScore}, errors=${cardErrors.length}, warnings=${cardWarnings.length}`);
        
        if (cardErrors.length > 0) {
          // Fix was applied but moderation errors STILL exist
          return { 
            success: false, 
            verified: true,
            newScore,
            remainingErrors,
            message: `Yandex qabul qildi, lekin moderatsiya xatoliklari saqlanmoqda: ${remainingErrors.slice(0, 3).join('; ')}` 
          };
        }
      }
    }
  } catch (e) { 
    console.warn('Verification failed:', e);
  }

  // If we verified and no errors found, it's truly successful
  if (verified && remainingErrors.length === 0) {
    return { success: true, verified: true, newScore, remainingErrors: [], message: `✅ Yandex kartochka tuzatildi va moderatsiyadan o'tdi${newScore ? ` (ball: ${newScore})` : ''}` };
  }
  
  // If we couldn't verify (API issue), mark as pending
  if (!verified) {
    return { success: true, verified: false, newScore: undefined, remainingErrors: [], message: '⏳ Yandex qabul qildi, moderatsiya tekshirilmoqda (qayta skanerlang)' };
  }

  return { success: true, verified, newScore, remainingErrors, message: 'Yandex kartochka yangilandi' };
}

// ===== WILDBERRIES: Apply fix =====
async function applyWildberriesFix(credentials: any, product: any, fix: any): Promise<{ success: boolean; message: string; newScore?: number; verified: boolean }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const nmID = product.nmID;
  if (!nmID) return { success: false, message: 'nmID topilmadi', verified: false };

  let descCharcId: number | null = null;
  let nameCharcId: number | null = null;

  if (product.subjectID) {
    try {
      const charcResp = await fetchWithRetry(
        `https://content-api.wildberries.ru/content/v2/object/charcs/${product.subjectID}`,
        { headers }
      );
      if (charcResp.ok) {
        const charcData = await charcResp.json();
        for (const c of (charcData.data || [])) {
          const name = (c.name || '').toLowerCase();
          if (name.includes('описание')) descCharcId = c.charcID || c.id;
          if (name.includes('наименование')) nameCharcId = c.charcID || c.id;
        }
      }
    } catch (e) { console.error('WB charcs fetch error:', e); }
  }

  const updatePayload: any = { nmID, vendorCode: product.offerId };
  const charcs: any[] = [];
  
  if (fix.name) charcs.push({ id: nameCharcId || 9, value: [fix.name] });
  if (fix.description) charcs.push({ id: descCharcId || 14, value: [fix.description] });
  if (charcs.length > 0) updatePayload.characteristics = charcs;

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v2/cards/update`,
    { method: 'POST', headers, body: JSON.stringify([updatePayload]) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB API: ${resp.status} - ${errText.substring(0, 200)}`, verified: false };
  }

  // Check for async errors
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
        return { success: false, verified: true, message: `WB async: ${errors.map((e: any) => e.message || e.error).join('; ').substring(0, 200)}` };
      }
    }
  } catch (e) { /* optional */ }

  return { success: true, verified: true, message: 'WB kartochka yangilandi' };
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

    // Rate limit: 10 fix operations per hour
    const adminSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCount } = await adminSupabase
      .from('ai_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action_type', 'ai-agent-fix')
      .gte('created_at', oneHourAgo);

    if ((recentCount || 0) >= 10) {
      return new Response(JSON.stringify({ error: 'Soatiga 10 ta tuzatish limiti. Keyinroq urinib ko\'ring.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminSupabase.from('ai_usage_log').insert({
      user_id: user.id, action_type: 'ai-agent-fix', model_used: 'gemini-2.5-flash',
    });

    // ═══ BILLING pre-check (will deduct per successful fix below) ═══

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const partnerId = typeof body.partnerId === 'string' && body.partnerId.length <= 100 ? body.partnerId : null;
    const marketplace = typeof body.marketplace === 'string' && ['yandex', 'wildberries', 'uzum', 'ozon'].includes(body.marketplace) ? body.marketplace : null;
    const products = Array.isArray(body.products) ? body.products.slice(0, 100) : null;
    const maxRetries = typeof body.maxRetries === 'number' && body.maxRetries >= 0 && body.maxRetries <= 5 ? body.maxRetries : 2;
    const action = typeof body.action === 'string' && body.action.length <= 50 ? body.action : undefined;

    if (!partnerId || !marketplace || !products?.length) {
      return new Response(JSON.stringify({ error: 'partnerId, marketplace, products kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== DIMENSION ESTIMATION =====
    if (action === 'estimate-dimensions') {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'AI kalit sozlanmagan' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const productList = products.map((p: any) => `- "${p.name}" (${p.category || 'unknown'})`).join('\n');
      
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: `Estimate realistic PACKAGING dimensions (cm) and weight (kg) for each product. WB logistics fees depend on volume (L*W*H/5000), so accurate dimensions save money. Return ONLY a JSON array: [{"offerId":"...","length":N,"width":N,"height":N,"weightBrutto":N}]. Be realistic - don't oversize. Consider product IN its shipping packaging.` },
              { role: "user", content: `Products:\n${productList}\n\nOfferIDs: ${products.map((p: any) => p.offerId).join(', ')}` },
            ],
            temperature: 0.1,
          }),
        });
        
        if (aiResp.ok) {
          const data = await aiResp.json();
          const content = data.choices?.[0]?.message?.content || '';
          const match = content.match(/\[[\s\S]*?\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const dimensions = parsed.map((d: any, i: number) => ({
              offerId: d.offerId || products[i]?.offerId,
              length: Math.max(1, Math.min(120, Math.round(d.length || 15))),
              width: Math.max(1, Math.min(80, Math.round(d.width || 10))),
              height: Math.max(1, Math.min(60, Math.round(d.height || 5))),
              weightBrutto: Math.max(0.01, Math.min(50, parseFloat((d.weightBrutto || d.weight || 0.3).toFixed(2)))),
            }));
            return new Response(JSON.stringify({ success: true, dimensions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (e) {
        console.error('AI dimension estimate error:', e);
      }
      
      return new Response(JSON.stringify({ error: 'AI baholash muvaffaqiyatsiz' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== DIMENSION UPDATE VIA WB API =====
    if (action === 'update-dimensions') {
      // Get WB credentials
      const { data: connections } = await supabase
        .from('marketplace_connections')
        .select('*')
        .eq('user_id', partnerId)
        .eq('marketplace', 'wildberries')
        .eq('is_active', true)
        .limit(1);

      if (!connections?.length) {
        return new Response(JSON.stringify({ error: 'WB ulanishi topilmadi' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const conn = connections[0];
      const creds = await resolveConnectionCredentials(adminSupabase, conn);
      
      const apiKey = creds?.apiKey || creds?.api_key;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'WB API kaliti yo\'q' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let updated = 0;
      const results: any[] = [];

      for (const product of products) {
        if (!product.nmID || !product.dimensions) continue;
        try {
          const resp = await fetchWithRetry(
            'https://content-api.wildberries.ru/content/v2/cards/update',
            {
              method: 'POST',
              headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify([{
                nmID: product.nmID,
                dimensions: product.dimensions,
              }]),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (!data.error) {
              updated++;
              results.push({ offerId: product.offerId, success: true });
              console.log(`✅ Dimensions updated for nmID ${product.nmID}: ${JSON.stringify(product.dimensions)}`);
            } else {
              results.push({ offerId: product.offerId, success: false, error: data.errorText || data.error });
            }
          } else {
            results.push({ offerId: product.offerId, success: false, error: `HTTP ${resp.status}` });
          }
          await sleep(300); // Rate limit
        } catch (e: any) {
          results.push({ offerId: product.offerId, success: false, error: e.message });
        }
      }

      return new Response(JSON.stringify({ success: true, updated, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get credentials
    const { data: connections } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', partnerId)
      .eq('marketplace', marketplace)
      .eq('is_active', true)
      .limit(1);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: `${marketplace} ulanishi topilmadi` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const conn = connections[0];
    const creds = await resolveConnectionCredentials(adminSupabase, conn);

    const fixResults: any[] = [];

    for (const product of products.slice(0, 15)) {
      let lastResult: any = null;
      let lastFix: any = null;
      let succeeded = false;

      for (let round = 0; round <= maxRetries; round++) {
        try {
          console.log(`[Round ${round + 1}/${maxRetries + 1}] Fixing ${product.offerId} on ${marketplace}...`);
          
          // For retry rounds, pass the EXACT remaining errors from Yandex
          const previousAttempt = round > 0 ? { 
            error: lastResult?.remainingErrors?.join('; ') || lastResult?.message, 
            fix: lastFix 
          } : undefined;
          
          const fix = await generateFix(product, marketplace, previousAttempt);
          lastFix = fix;
          console.log(`AI fix (round ${round + 1}): ${fix.summary}`);

          let applyResult;
          if (marketplace === 'yandex') {
            applyResult = await applyYandexFix(creds, product.offerId, fix);
          } else if (marketplace === 'wildberries') {
            applyResult = await applyWildberriesFix(creds, product, fix);
          } else {
            applyResult = { success: false, message: `${marketplace} qo'llab-quvvatlanmaydi`, verified: false };
          }

          lastResult = applyResult;

          if (applyResult.success) {
            // Generate image if needed
            let imageResult: any = null;
            if (fix.needsImage && (product.imageCount || 0) < 3) {
              console.log(`Generating image for ${product.offerId}...`);
              imageResult = await generateAndUploadImage(supabase, partnerId, product, marketplace, creds);
              console.log(`Image result: ${imageResult.message}`);
            }

            succeeded = true;
            fixResults.push({
              offerId: product.offerId,
              name: product.name,
              success: true,
              verified: applyResult.verified,
              message: applyResult.message + (imageResult?.success ? ` + ${imageResult.message}` : ''),
              rounds: round + 1,
              newScore: applyResult.newScore,
              remainingErrors: applyResult.remainingErrors || [],
              imageGenerated: imageResult?.success || false,
              fix: { name: fix.name, summary: fix.summary, fixedErrors: fix.fixedErrors || [] },
            });
            break;
          }

          // If Yandex returned remaining errors, feed them back for self-healing
          if (applyResult.remainingErrors?.length > 0) {
            console.log(`Round ${round + 1}: Yandex still has ${applyResult.remainingErrors.length} errors. ${round < maxRetries ? 'Self-healing...' : 'Giving up.'}`);
          } else {
            console.log(`Round ${round + 1} failed: ${applyResult.message}. ${round < maxRetries ? 'Retrying...' : 'Giving up.'}`);
          }
          await sleep(1500);

        } catch (e) {
          console.error(`Fix error round ${round + 1} for ${product.offerId}:`, e);
          lastResult = { success: false, message: (e as any).message || 'Xatolik', verified: false };
          if (round >= maxRetries) break;
          await sleep(1000);
        }
      }

      if (!succeeded) {
        fixResults.push({
          offerId: product.offerId,
          name: product.name,
          success: false,
          verified: lastResult?.verified || false,
          message: lastResult?.message || 'Barcha urinishlar muvaffaqiyatsiz',
          remainingErrors: lastResult?.remainingErrors || [],
          rounds: maxRetries + 1,
        });
      }

      await sleep(500);
    }

    const successCount = fixResults.filter(r => r.success).length;
    const verifiedCount = fixResults.filter(r => r.success && r.verified).length;
    const pendingCount = fixResults.filter(r => r.success && !r.verified).length;

    // ═══ BILLING DEDUCT per successful fix ═══
    if (successCount > 0 && partnerId) {
      const fixFeatureKey = 'ai-card-fix';
      for (let i = 0; i < successCount; i++) {
        const { data: fixAccess } = await adminSupabase.rpc('check_feature_access', {
          p_user_id: partnerId, p_feature_key: fixFeatureKey,
        });
        if (fixAccess?.allowed && fixAccess.price > 0) {
          await adminSupabase.rpc('deduct_balance', {
            p_user_id: partnerId, p_amount: fixAccess.price, p_feature_key: fixFeatureKey,
            p_description: `AI Fix: ${fixResults.filter(r => r.success)[i]?.name?.substring(0, 50) || 'N/A'}`,
          });
        } else if (fixAccess?.tier === 'elegant') {
          await adminSupabase.from('elegant_usage').upsert(
            { user_id: partnerId, feature_key: fixFeatureKey, usage_month: new Date().toISOString().slice(0, 7) + '-01', usage_count: (fixAccess.used || 0) + i + 1 },
            { onConflict: 'user_id,feature_key,usage_month' }
          );
        }
      }
      console.log(`💰 Billed ${successCount} fixes to partner ${partnerId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      totalFixed: successCount,
      totalVerified: verifiedCount,
      totalPending: pendingCount,
      totalFailed: fixResults.length - successCount,
      results: fixResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent fix error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
