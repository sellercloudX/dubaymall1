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

// ===== AI: Generate fix for a product =====
async function generateFix(product: any, marketplace: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY sozlanmagan");

  const prompt = `Sen ${marketplace === 'yandex' ? 'Yandex Market' : 'Wildberries'} kartochka sifat ekspertisan.

MAHSULOT:
- Nom: "${product.name}"
- Kategoriya: ${product.category || 'Noma\'lum'}
- Muammolar: ${product.issues?.join(', ') || 'yo\'q'}
- Rasmlar soni: ${product.imageCount || 0}
- Tavsif: ${product.hasDescription ? 'bor' : 'yo\'q/qisqa'}
- Brend: ${product.hasVendor ? 'bor' : 'yo\'q'}

VAZIFA: Sifat balini 90+ ga ko'tarish uchun tuzatishlar yarat.

QOIDALAR:
1. NOM: Ruscha, 60-100 belgi. Brend + Tur + Model + Asosiy xususiyat
2. TAVSIF: Ruscha, 1000-2000 belgi. Batafsil, SEO-optimallashtirilgan
3. Agar ma'lumot yetarli bo'lmasa, mahsulot nomidan taxmin qil
4. name_uz: O'zbekcha lotin alifbosida nom

FAQAT JSON javob ber:
{
  "name": "yangilangan nom (ruscha, 60-100 belgi)",
  "name_uz": "o'zbekcha nom",
  "description": "batafsil tavsif (ruscha, 1000+ belgi)",
  "vendor": "brend nomi (agar topilsa)",
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
        { role: "system", content: "Sen marketplace kartochka sifat ekspertisan. Faqat JSON javob ber." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!aiResp.ok) {
    if (aiResp.status === 429) throw new Error("AI rate limit. Keyinroq urinib ko'ring.");
    if (aiResp.status === 402) throw new Error("AI kredit tugadi. Balansni to'ldiring.");
    throw new Error(`AI xatolik: ${aiResp.status}`);
  }

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("AI javobini tahlil qilib bo'lmadi");

  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

// ===== YANDEX: Apply fix =====
async function applyYandexFix(credentials: any, offerId: string, fix: any): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key;
  const campaignId = credentials.campaignId || credentials.campaign_id;
  let businessId = credentials.businessId || credentials.business_id;
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
    return { success: false, message: `Yandex API xatosi: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  const respData = await resp.json();
  const errors = respData.results?.[0]?.errors || respData.result?.errors || [];
  if (errors.length > 0) {
    return { success: false, message: `Yandex xatoliklar: ${errors.map((e: any) => e.message).join(', ')}` };
  }

  return { success: true, message: 'Yandex kartochka yangilandi' };
}

// ===== WILDBERRIES: Apply fix =====
async function applyWildberriesFix(credentials: any, product: any, fix: any): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  const nmID = product.nmID;

  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  // Update card via v2 API
  const updatePayload: any = {
    nmID,
    vendorCode: product.offerId,
  };

  // Add title and description via characteristics
  const charcs: any[] = [];
  if (fix.name) charcs.push({ id: 9, value: [fix.name] });
  if (fix.description) charcs.push({ id: 14, value: [fix.description] });
  if (charcs.length > 0) updatePayload.characteristics = charcs;

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v2/cards/update`,
    { method: 'POST', headers, body: JSON.stringify([updatePayload]) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB API xatosi: ${resp.status} - ${errText.substring(0, 200)}` };
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

    // Admin check
    const { data: adminPerm } = await supabase
      .from('admin_permissions')
      .select('is_super_admin, can_manage_users')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
      return new Response(JSON.stringify({ error: 'Admin ruxsati yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { partnerId, marketplace, products, action } = body;

    if (!partnerId || !marketplace || !products?.length) {
      return new Response(JSON.stringify({ error: 'partnerId, marketplace, products kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get partner credentials
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

    for (const product of products.slice(0, 10)) { // Max 10 products per request
      try {
        console.log(`Fixing ${product.offerId} on ${marketplace}...`);
        
        // Generate AI fix
        const fix = await generateFix(product, marketplace);
        console.log(`AI fix generated for ${product.offerId}: ${fix.summary}`);

        // Apply fix to marketplace
        let applyResult;
        if (marketplace === 'yandex') {
          applyResult = await applyYandexFix(creds, product.offerId, fix);
        } else if (marketplace === 'wildberries') {
          applyResult = await applyWildberriesFix(creds, product, fix);
        } else {
          applyResult = { success: false, message: `${marketplace} qo'llab-quvvatlanmaydi` };
        }

        fixResults.push({
          offerId: product.offerId,
          name: product.name,
          ...applyResult,
          fix: { name: fix.name, summary: fix.summary },
        });

        // Rate limit protection
        await sleep(500);
      } catch (e) {
        console.error(`Fix error for ${product.offerId}:`, e);
        fixResults.push({
          offerId: product.offerId,
          name: product.name,
          success: false,
          message: e.message || 'Xatolik yuz berdi',
        });
      }
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
