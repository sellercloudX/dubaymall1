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

// ===== Generate product image using image generation endpoint =====
async function generateProductImage(productName: string, category: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log(`Generating image for: "${productName}" (${category})`);
    
    const prompt = `Professional e-commerce product photography of "${productName}" (category: ${category}). Clean white background, professional studio lighting, high resolution, sharp focus. Product centered, commercial quality. No text, no watermarks, no logos.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Image generation failed: ${resp.status} - ${errText.substring(0, 300)}`);
      
      if (resp.status === 429) throw new Error("AI rate limit. Keyinroq urinib ko'ring.");
      if (resp.status === 402) throw new Error("AI kredit tugadi.");
      return null;
    }

    const data = await resp.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
    
    if (!imageUrl) {
      console.error("No image URL in response:", JSON.stringify(data).substring(0, 500));
      return null;
    }

    console.log(`Image generated successfully. URL type: ${imageUrl.startsWith('http') ? 'URL' : 'base64'}`);
    return imageUrl;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

// ===== Analyze image quality with Gemini Vision =====
async function analyzeImageQuality(imageUrl: string, productName: string): Promise<{ score: number; issues: string[]; suggestions: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { score: 50, issues: ["AI tahlil mavjud emas"], suggestions: [] };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Sen marketplace rasm sifat ekspertisan. Rasmni 0-100 ball bilan baholagin. FAQAT JSON javob ber."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Marketplace mahsulot rasmi sifatini baholagin. Mahsulot: "${productName}". Baholash mezonlari: fon tozaligi (oq fon yaxshi), yoritilganlik, aniqliq (focus), kompozitsiya, professional ko'rinish. FAQAT JSON: {"score": 75, "issues": ["muammo1"], "suggestions": ["tavsiya1"]}` },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error(`Image analysis failed: ${resp.status}`);
      return { score: 50, issues: ["Tahlil qilib bo'lmadi"], suggestions: [] };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) return { score: 50, issues: ["Javob tahlil qilib bo'lmadi"], suggestions: [] };

    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch (e) {
    console.error("Image analysis error:", e);
    return { score: 50, issues: ["Tahlil xatosi"], suggestions: [] };
  }
}

// ===== Upload image URL to Supabase Storage (download first if needed) =====
async function uploadToStorage(supabase: any, imageSource: string, partnerId: string, productId: string): Promise<string | null> {
  try {
    let bytes: Uint8Array;
    
    if (imageSource.startsWith('http')) {
      // Download from URL
      const resp = await fetch(imageSource);
      if (!resp.ok) { console.error("Failed to download image:", resp.status); return null; }
      const arrayBuf = await resp.arrayBuffer();
      bytes = new Uint8Array(arrayBuf);
    } else if (imageSource.startsWith('data:')) {
      // Base64 data URI
      const base64Content = imageSource.replace(/^data:image\/\w+;base64,/, '');
      bytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    } else {
      // Raw base64
      bytes = Uint8Array.from(atob(imageSource), c => c.charCodeAt(0));
    }

    const fileName = `ai-agent/${partnerId}/${productId}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

    if (error) { console.error("Storage upload error:", error); return null; }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    console.log(`Uploaded to storage: ${urlData?.publicUrl}`);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

// ===== Upload to Yandex Market =====
async function uploadToYandex(credentials: any, offerId: string, imageUrl: string): Promise<{ success: boolean; message: string }> {
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
  if (!businessId) return { success: false, message: 'Business ID topilmadi' };

  // Get existing pictures
  const getResp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
    { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId] }) }
  );
  
  let existingPictures: string[] = [];
  if (getResp.ok) {
    const getData = await getResp.json();
    const offer = getData.result?.offerMappings?.[0]?.offer;
    existingPictures = offer?.pictures || [];
  }

  const allPictures = [...existingPictures, imageUrl];

  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
    { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: { offerId, pictures: allPictures } }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: `Rasm Yandex'ga yuklandi (jami ${allPictures.length} ta)` };
}

// ===== Upload to Wildberries =====
async function uploadToWildberries(credentials: any, nmID: number, imageUrl: string): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v3/media/save`,
    { method: 'POST', headers, body: JSON.stringify({ nmId: nmID, data: [imageUrl] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: 'Rasm WB\'ga yuklandi' };
}

// ===== MAIN HANDLER =====
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
    const { action, partnerId, productName, category, offerId, nmID, marketplace, imageUrl: existingImageUrl } = body;

    console.log(`AI Agent Images: action=${action}, partner=${partnerId}, product=${productName}`);

    // ===== ANALYZE: Real AI image quality analysis =====
    if (action === 'analyze') {
      const { products } = body;
      if (!products?.length) {
        return new Response(JSON.stringify({ error: 'products kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Analyzing ${products.length} products...`);
      const results: any[] = [];

      for (const p of products.slice(0, 20)) {
        // If product has images, analyze first one with AI
        if (p.imageUrl || (p.pictures && p.pictures.length > 0)) {
          const imgUrl = p.imageUrl || p.pictures[0];
          try {
            const analysis = await analyzeImageQuality(imgUrl, p.name || '');
            results.push({
              offerId: p.offerId,
              nmID: p.nmID,
              name: p.name,
              marketplace: p.marketplace,
              category: p.category,
              imageCount: p.imageCount || p.pictures?.length || 0,
              avgScore: analysis.score,
              issues: analysis.issues,
              suggestions: analysis.suggestions,
              needsReplacement: analysis.score < 50 || (p.imageCount || 0) < 3,
            });
          } catch (e) {
            console.error(`Analysis error for ${p.offerId}:`, e);
            results.push({
              ...p,
              avgScore: p.imageCount >= 3 ? 60 : p.imageCount >= 1 ? 30 : 0,
              issues: p.imageCount < 3 ? [`Kam rasm (${p.imageCount}/3)`] : [],
              suggestions: [],
              needsReplacement: (p.imageCount || 0) < 3,
            });
          }
          await sleep(500); // Rate limit
        } else {
          // No images at all
          results.push({
            offerId: p.offerId,
            nmID: p.nmID,
            name: p.name,
            marketplace: p.marketplace,
            category: p.category,
            imageCount: 0,
            avgScore: 0,
            issues: ['Rasmlar yo\'q'],
            suggestions: ['Professional mahsulot rasmi qo\'shing'],
            needsReplacement: true,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== GENERATE-AND-UPLOAD: Full pipeline =====
    if (action === 'generate-and-upload') {
      if (!productName || !partnerId) {
        return new Response(JSON.stringify({ error: 'productName va partnerId kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`=== FULL PIPELINE: Generate + Upload for "${productName}" ===`);

      // Step 1: Generate image
      const imageSource = await generateProductImage(productName, category || '');
      if (!imageSource) {
        return new Response(JSON.stringify({ success: false, error: 'Rasm yaratib bo\'lmadi. AI xizmati javob bermadi.' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Upload to Supabase storage
      const publicUrl = await uploadToStorage(supabase, imageSource, partnerId, offerId || 'unknown');
      if (!publicUrl) {
        return new Response(JSON.stringify({ success: false, error: 'Rasmni storage\'ga saqlash xatosi' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 3: Upload to marketplace
      let mpResult: { success: boolean; message: string } = { success: false, message: 'Marketplace aniqlanmadi' };
      
      if (marketplace && offerId) {
        const { data: connections } = await supabase
          .from('marketplace_connections')
          .select('*')
          .eq('user_id', partnerId)
          .eq('marketplace', marketplace)
          .eq('is_active', true)
          .limit(1);

        if (connections?.length) {
          const conn = connections[0];
          let creds: any;
          if (conn.encrypted_credentials) {
            const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
            creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          } else {
            creds = conn.credentials || {};
          }

          if (marketplace === 'yandex') {
            mpResult = await uploadToYandex(creds, offerId, publicUrl);
          } else if (marketplace === 'wildberries' && nmID) {
            mpResult = await uploadToWildberries(creds, nmID, publicUrl);
          }
        } else {
          mpResult = { success: false, message: `${marketplace} ulanishi topilmadi` };
        }
      }

      console.log(`Pipeline complete. Storage: ${publicUrl}, MP: ${mpResult.success}`);

      return new Response(JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        marketplaceUpload: mpResult,
        message: mpResult.success 
          ? `✅ Rasm yaratildi va ${marketplace}'ga yuklandi` 
          : `⚠️ Rasm yaratildi (storage saqlandi). Marketplace: ${mpResult.message}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== GENERATE: Just generate, don't upload to marketplace =====
    if (action === 'generate') {
      if (!productName) {
        return new Response(JSON.stringify({ error: 'productName kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const imageSource = await generateProductImage(productName, category || '');
      if (!imageSource) {
        return new Response(JSON.stringify({ success: false, error: 'Rasm yaratib bo\'lmadi' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const publicUrl = await uploadToStorage(supabase, imageSource, partnerId || 'unknown', offerId || 'unknown');

      return new Response(JSON.stringify({
        success: true,
        imageUrl: publicUrl || imageSource,
        message: 'Rasm yaratildi'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'action kerak: analyze | generate-and-upload | generate' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent images error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
