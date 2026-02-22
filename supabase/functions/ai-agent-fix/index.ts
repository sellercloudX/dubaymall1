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

// ===== AI: Generate fix with self-healing context =====
async function generateFix(product: any, marketplace: string, previousAttempt?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY sozlanmagan");

  const mpName = marketplace === 'yandex' ? 'Yandex Market' : 'Wildberries';
  
  let retryContext = '';
  if (previousAttempt) {
    retryContext = `
MUHIM: Oldingi urinish muvaffaqiyatsiz bo'ldi:
- Xatolik: ${previousAttempt.error || 'Noma\'lum'}
- Oldingi nom: "${previousAttempt.fix?.name || ''}"
- Oldingi tavsif uzunligi: ${previousAttempt.fix?.description?.length || 0}

Bu xatoni tuzat va boshqa yondashuv qo'lla.
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
- TAVSIF: Ruscha, 1000-2000 belgi, SEO-optimallashtirilgan
- name_uz: O'zbekcha lotin alifbosida nom
`;

  const issuesDetail = (product.issueDetails || []).map((d: any) => `[${d.type}] ${d.field}: ${d.msg}`).join('\n');

  const prompt = `Sen ${mpName} kartochka sifat ekspertisan. MAQSAD: Sifat balini 90+ ga ko'tarish.

MAHSULOT:
- Nom: "${product.name}"
- offerId: ${product.offerId}
- Kategoriya: ${product.category || 'Noma\'lum'}
- Hozirgi ball: ${product.score || '?'}
- Rasmlar: ${product.imageCount || 0} ta
- Tavsif: ${product.descriptionLength || 0} belgi
- Brend: ${product.hasVendor ? 'bor' : 'yo\'q'}
- Async xatolar: ${product.asyncErrors || 0} ta

MUAMMOLAR:
${issuesDetail || product.issues?.join(', ') || 'yo\'q'}
${retryContext}
${wbRules}

VAZIFA: Sifat balini 90+ ga ko'tarish uchun tuzatishlar yarat.
Tavsif kamida 1000 belgi, nom uzunligi marketplace qoidalariga mos bo'lsin.
Agar brend yo'q bo'lsa, mahsulot kategoriyasiga qarab mantiqiy brend tavsiya qil.

FAQAT JSON javob ber (boshqa hech narsa yozma):
{
  "name": "yangilangan nom (ruscha)",
  "name_uz": "o'zbekcha nom (lotin)",
  "description": "batafsil tavsif (ruscha, 1000+ belgi, SEO kalit so'zlar bilan)",
  "vendor": "brend nomi",
  "summary": "qisqa xulosa nima tuzatildi",
  "needsImage": true/false
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
        { role: "system", content: "Sen marketplace kartochka sifat ekspertisan. FAQAT JSON javob ber, hech qanday qo'shimcha matn yo'q." },
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
  if (marketplace === 'yandex' && fix.name && fix.name.length < 60) {
    const category = product.category || '';
    if (category && fix.name.length + category.length + 3 <= 100) {
      fix.name = `${fix.name} — ${category}`;
    }
  }

  // Check if images are needed
  if (fix.needsImage === undefined) {
    fix.needsImage = (product.imageCount || 0) < 3;
  }
  
  return fix;
}

// ===== Generate and upload image using REFERENCE =====
async function generateAndUploadImage(supabase: any, partnerId: string, product: any, marketplace: string, credentials: any): Promise<{ success: boolean; message: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { success: false, message: 'AI key yo\'q' };

  try {
    // Find existing reference image from the product
    const existingImages = product.pictures || [];
    const referenceUrl = existingImages.find((p: string) => p && p.startsWith('http')) || null;
    console.log(`Generating image for: "${product.name}", ref: ${referenceUrl ? 'YES' : 'NO'}`);
    
    let imageUrl: string | null = null;

    // Use reference image if available for product-specific generation
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
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: referenceUrl } }
            ]
          }],
          modalities: ["image", "text"],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
      }
    }

    // Fallback: text-only generation
    if (!imageUrl) {
      const prompt = `Generate a professional e-commerce product photo of "${product.name}" (category: ${product.category || ''}). 
Clean white background, product centered, large, studio lighting, sharp focus, 3:4 aspect ratio, no text, no watermarks, photorealistic.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) return { success: false, message: `Rasm yaratish: ${resp.status}` };
      const data = await resp.json();
      imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    }

    if (!imageUrl) return { success: false, message: 'Rasm generatsiya qilinmadi' };

    // Upload to storage
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
    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });
    if (uploadErr) return { success: false, message: `Storage: ${uploadErr.message}` };

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) return { success: false, message: 'Public URL olinmadi' };

    // Upload to marketplace
    if (marketplace === 'yandex') {
      const apiKey = credentials.apiKey || credentials.api_key;
      const headers: Record<string, string> = { "Api-Key": apiKey, "Content-Type": "application/json" };
      const businessId = await resolveBusinessId(credentials, headers);
      if (!businessId) return { success: false, message: 'Business ID topilmadi' };

      const getResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
        { method: 'POST', headers: { ...headers }, body: JSON.stringify({ offerIds: [product.offerId] }) }
      );
      let existingPictures: string[] = [];
      if (getResp.ok) {
        const getData = await getResp.json();
        existingPictures = getData.result?.offerMappings?.[0]?.offer?.pictures || [];
      }

      const allPictures = [publicUrl, ...existingPictures];
      const updateResp = await fetchWithRetry(
        `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
        { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: { offerId: product.offerId, pictures: allPictures } }] }) }
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

// ===== YANDEX: Apply fix with verification =====
async function applyYandexFix(credentials: any, offerId: string, fix: any): Promise<{ success: boolean; message: string; newScore?: number }> {
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
    console.warn('Could not fetch existing offer, proceeding with partial update:', e);
  }

  // Merge: start with existing offer, override only fix fields
  const offerUpdate: any = { ...existingOffer, offerId };
  // Only override fields that AI actually provided
  if (fix.name) offerUpdate.name = fix.name;
  if (fix.description) offerUpdate.description = fix.description;
  if (fix.vendor) offerUpdate.vendor = fix.vendor;
  
  // Remove internal/read-only fields that Yandex won't accept in update
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
    return { success: false, message: `Yandex API: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  const respData = await resp.json();
  const errors = respData.results?.[0]?.errors || respData.result?.errors || [];
  if (errors.length > 0) {
    return { success: false, message: `Yandex: ${errors.map((e: any) => e.message).join(', ')}` };
  }

  // Verify score
  await sleep(2000);
  let newScore: number | undefined;
  try {
    const verifyResp = await fetchWithRetry(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-cards`,
      { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId], withRecommendations: true }) }
    );
    if (verifyResp.ok) {
      const verifyData = await verifyResp.json();
      const card = verifyData.result?.offerCards?.[0];
      if (card) {
        newScore = typeof card.contentRating === 'number' ? card.contentRating : card.contentRating?.rating ?? undefined;
      }
    }
  } catch (e) { /* optional */ }

  return { success: true, message: 'Yandex kartochka yangilandi', newScore };
}

// ===== WILDBERRIES: Apply fix =====
async function applyWildberriesFix(credentials: any, product: any, fix: any): Promise<{ success: boolean; message: string; newScore?: number }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const nmID = product.nmID;
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

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
    return { success: false, message: `WB API: ${resp.status} - ${errText.substring(0, 200)}` };
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
        return { success: false, message: `WB async: ${errors.map((e: any) => e.message || e.error).join('; ').substring(0, 200)}` };
      }
    }
  } catch (e) { /* optional */ }

  return { success: true, message: 'WB kartochka yangilandi' };
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
    const { partnerId, marketplace, products, maxRetries = 2 } = body;

    if (!partnerId || !marketplace || !products?.length) {
      return new Response(JSON.stringify({ error: 'partnerId, marketplace, products kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    let creds: any;
    if (conn.encrypted_credentials) {
      const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
      creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    } else {
      creds = conn.credentials || {};
    }

    const fixResults: any[] = [];

    for (const product of products.slice(0, 15)) {
      let lastResult: any = null;
      let lastFix: any = null;
      let succeeded = false;

      for (let round = 0; round <= maxRetries; round++) {
        try {
          console.log(`[Round ${round + 1}] Fixing ${product.offerId} on ${marketplace}...`);
          
          const previousAttempt = round > 0 ? { error: lastResult?.message, fix: lastFix } : undefined;
          const fix = await generateFix(product, marketplace, previousAttempt);
          lastFix = fix;
          console.log(`AI fix (round ${round + 1}): ${fix.summary}`);

          // Step 1: Apply text fixes (name, description, vendor)
          let applyResult;
          if (marketplace === 'yandex') {
            applyResult = await applyYandexFix(creds, product.offerId, fix);
          } else if (marketplace === 'wildberries') {
            applyResult = await applyWildberriesFix(creds, product, fix);
          } else {
            applyResult = { success: false, message: `${marketplace} qo'llab-quvvatlanmaydi` };
          }

          lastResult = applyResult;

          if (applyResult.success) {
            // Step 2: Generate and upload image if needed
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
              message: applyResult.message + (imageResult?.success ? ` + ${imageResult.message}` : ''),
              rounds: round + 1,
              newScore: applyResult.newScore,
              imageGenerated: imageResult?.success || false,
              fix: { name: fix.name, summary: fix.summary },
            });
            break;
          }

          console.log(`Round ${round + 1} failed: ${applyResult.message}. ${round < maxRetries ? 'Retrying...' : 'Giving up.'}`);
          await sleep(1000);

        } catch (e) {
          console.error(`Fix error round ${round + 1} for ${product.offerId}:`, e);
          lastResult = { success: false, message: (e as any).message || 'Xatolik' };
          if (round >= maxRetries) break;
          await sleep(1000);
        }
      }

      if (!succeeded) {
        fixResults.push({
          offerId: product.offerId,
          name: product.name,
          success: false,
          message: lastResult?.message || 'Barcha urinishlar muvaffaqiyatsiz',
          rounds: maxRetries + 1,
        });
      }

      await sleep(500);
    }

    const successCount = fixResults.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: true,
      totalFixed: successCount,
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
