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

Bu xatoni tuzat va boshqa yondashuv qo'lla. Masalan:
- Agar nom xatosi bo'lsa, qat'iy ${marketplace === 'wildberries' ? '40-60' : '60-100'} belgi ichida yoz
- Agar tavsif xatosi bo'lsa, aniq 1000-1500 belgi orasida yoz
- Agar API xatosi bo'lsa, maxsus belgilarni olib tashla
`;
  }

  const wbRules = marketplace === 'wildberries' ? `
WB MAXSUS QOIDALAR:
- NOM: Ruscha, QATIIY 40-60 belgi. Oshmasligi SHART!
- TAVSIF: Ruscha, 1000-2000 belgi
- Maxsus belgilar ishlatma: faqat harflar, raqamlar, probel, tire, vergul
- Brend nomini nomga qo'shma
` : `
YANDEX MAXSUS QOIDALAR:
- NOM: Ruscha, 60-100 belgi. Brend + Tur + Model + Asosiy xususiyat
- TAVSIF: Ruscha, 1000-2000 belgi, SEO-optimallashtirilgan
- name_uz: O'zbekcha lotin alifbosida nom
`;

  const prompt = `Sen ${mpName} kartochka sifat ekspertisan. MAQSAD: Sifat balini 90+ ga ko'tarish.

MAHSULOT:
- Nom: "${product.name}"
- Kategoriya: ${product.category || 'Noma\'lum'}
- Hozirgi ball: ${product.score || '?'}
- Muammolar: ${product.issues?.join(', ') || 'yo\'q'}
- Rasmlar: ${product.imageCount || 0} ta
- Tavsif: ${product.descriptionLength || 0} belgi
- Brend: ${product.hasVendor ? 'bor' : 'yo\'q'}
- Async xatolar: ${product.asyncErrors || 0} ta
${retryContext}
${wbRules}

VAZIFA: Sifat balini 90+ ga ko'tarish uchun tuzatishlar yarat.

FAQAT JSON javob ber (boshqa hech narsa yozma):
{
  "name": "yangilangan nom (ruscha)",
  "name_uz": "o'zbekcha nom (lotin)",
  "description": "batafsil tavsif (ruscha, 1000+ belgi)",
  "vendor": "brend nomi (agar topilsa yoki taxmin qil)",
  "summary": "qisqa xulosa nima tuzatildi"
}`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
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
    // Pad short names for Yandex
    const category = product.category || '';
    if (category && fix.name.length + category.length + 3 <= 100) {
      fix.name = `${fix.name} — ${category}`;
    }
  }
  
  return fix;
}

// ===== YANDEX: Apply fix with verification =====
async function applyYandexFix(credentials: any, offerId: string, fix: any): Promise<{ success: boolean; message: string; newScore?: number }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
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

  // Step 1: Update offer-mappings (name, description, vendor)
  const offerUpdate: any = { offerId };
  if (fix.name) offerUpdate.name = fix.name;
  if (fix.description) offerUpdate.description = fix.description;
  if (fix.vendor) offerUpdate.vendor = fix.vendor;

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

  // Step 2: Verify score after update (delayed)
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
  } catch (e) { /* verification optional */ }

  return { success: true, message: 'Yandex kartochka yangilandi', newScore };
}

// ===== WILDBERRIES: Apply fix with dynamic characteristics =====
async function applyWildberriesFix(credentials: any, product: any, fix: any): Promise<{ success: boolean; message: string; newScore?: number }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const nmID = product.nmID;
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  // Get subject characteristics to find correct IDs
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
        const charcs = charcData.data || [];
        for (const c of charcs) {
          const name = (c.name || '').toLowerCase();
          if (name.includes('описание') || name === 'описание товара' || name === 'description') {
            descCharcId = c.charcID || c.id;
          }
          if (name.includes('наименование') || name === 'наименование товара' || name === 'name') {
            nameCharcId = c.charcID || c.id;
          }
        }
      }
    } catch (e) { console.error('WB charcs fetch error:', e); }
  }

  const updatePayload: any = { nmID, vendorCode: product.offerId };
  const charcs: any[] = [];
  
  if (fix.name) {
    const id = nameCharcId || 9;
    charcs.push({ id, value: [fix.name] });
  }
  if (fix.description) {
    const id = descCharcId || 14;
    charcs.push({ id, value: [fix.description] });
  }
  if (charcs.length > 0) updatePayload.characteristics = charcs;

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v2/cards/update`,
    { method: 'POST', headers, body: JSON.stringify([updatePayload]) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB API: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  // Check for async errors after update
  await sleep(3000);
  let asyncError: string | null = null;
  try {
    const errResp = await fetchWithRetry(
      `https://content-api.wildberries.ru/content/v2/cards/error/list`,
      { method: 'GET', headers }
    );
    if (errResp.ok) {
      const errData = await errResp.json();
      const errors = (errData.data || errData.errors || []).filter((e: any) => (e.nmID || e.nmId) === nmID);
      if (errors.length > 0) {
        asyncError = errors.map((e: any) => e.message || e.error).join('; ');
      }
    }
  } catch (e) { /* optional */ }

  if (asyncError) {
    return { success: false, message: `WB async xatolik: ${asyncError}` };
  }

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

      // Self-healing loop: try up to maxRetries+1 times
      for (let round = 0; round <= maxRetries; round++) {
        try {
          console.log(`[Round ${round + 1}] Fixing ${product.offerId} on ${marketplace}...`);
          
          const previousAttempt = round > 0 ? { error: lastResult?.message, fix: lastFix } : undefined;
          const fix = await generateFix(product, marketplace, previousAttempt);
          lastFix = fix;
          console.log(`AI fix (round ${round + 1}): ${fix.summary}`);

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
            succeeded = true;
            fixResults.push({
              offerId: product.offerId,
              name: product.name,
              success: true,
              message: applyResult.message,
              rounds: round + 1,
              newScore: applyResult.newScore,
              fix: { name: fix.name, summary: fix.summary },
            });
            break;
          }

          // If failed and more retries available, continue loop (self-healing)
          console.log(`Round ${round + 1} failed: ${applyResult.message}. ${round < maxRetries ? 'Retrying...' : 'Giving up.'}`);
          await sleep(1000);

        } catch (e) {
          console.error(`Fix error round ${round + 1} for ${product.offerId}:`, e);
          lastResult = { success: false, message: e.message || 'Xatolik' };
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
    return new Response(JSON.stringify({ error: e.message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
