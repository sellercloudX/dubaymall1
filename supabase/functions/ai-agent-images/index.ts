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

// ===== OpenAI GPT-image-1: reference-based editing =====
async function editWithOpenAI(referenceImageUrl: string, editPrompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Calling OpenAI gpt-image-1 with reference image...");
    
    const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        image: [{ type: "url", url: referenceImageUrl }],
        prompt: editPrompt,
        size: "1024x1536",
        quality: "high",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`OpenAI edit failed (${resp.status}): ${errText.substring(0, 500)}`);
      return null;
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    
    const url = data.data?.[0]?.url;
    if (url) return url;
    
    console.error("No image in OpenAI response");
    return null;
  } catch (e) {
    console.error("OpenAI edit error:", e);
    return null;
  }
}

// ===== OpenAI DALL-E 3: text-to-image =====
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Calling OpenAI DALL-E 3 text-to-image...");
    
    const resp = await fetchWithRetry("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        response_format: "b64_json",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`DALL-E 3 generation failed (${resp.status}): ${errText.substring(0, 500)}`);
      return null;
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    
    const url = data.data?.[0]?.url;
    if (url) return url;
    
    return null;
  } catch (e) {
    console.error("DALL-E 3 error:", e);
    return null;
  }
}

// ===== Fallback: Gemini image model =====
async function generateWithGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (e) {
    console.error("Gemini fallback error:", e);
    return null;
  }
}

// ===== Generate product image =====
async function generateProductImage(productName: string, category: string, referenceImageUrl?: string): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  console.log(`Generating image for: "${productName}" (${category}), ref: ${referenceImageUrl ? 'YES' : 'NO'}, OpenAI: ${OPENAI_API_KEY ? 'YES' : 'NO'}`);

  // Method 1: OpenAI with reference image
  if (OPENAI_API_KEY && referenceImageUrl) {
    const editPrompt = `Take this EXACT product photo and place it on a clean, pure white studio background. 
Keep the product PIXEL-PERFECT: same shape, colors, labels, cap, brand text - change NOTHING about the product itself.
Add professional studio lighting with soft natural shadows. Center the product. Portrait orientation.
Do NOT add any text, watermarks, badges or extra elements.`;

    const result = await editWithOpenAI(referenceImageUrl, editPrompt, OPENAI_API_KEY);
    if (result) {
      console.log("✅ Product image generated via OpenAI gpt-image-1");
      return result;
    }
  }

  // Method 2: OpenAI DALL-E 3 text-to-image
  if (OPENAI_API_KEY) {
    const prompt = `Professional e-commerce product photo of "${productName}" (category: ${category}). 
Clean white background, product centered, professional studio lighting, soft shadows.
Portrait orientation 3:4, photorealistic, high resolution. No text or watermarks.`;

    const result = await generateWithOpenAI(prompt, OPENAI_API_KEY);
    if (result) {
      console.log("✅ Product image generated via DALL-E 3");
      return result;
    }
  }

  // Method 3: Gemini fallback
  if (LOVABLE_API_KEY) {
    const prompt = `Professional e-commerce product photo of "${productName}" (${category}). Clean white background, centered, studio lighting. No text. Portrait 3:4.`;
    const result = await generateWithGemini(prompt, LOVABLE_API_KEY);
    if (result) {
      console.log("✅ Product image generated via Gemini fallback");
      return result;
    }
  }

  console.error("❌ All image generation methods failed");
  return null;
}

// ===== Generate INFOGRAPHIC image =====
async function generateInfographicImage(productName: string, category: string, referenceImageUrl?: string, features?: string[]): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const featureText = features?.length ? features.slice(0, 5).join(', ') : 'Premium sifat, Tez yetkazib berish, Eng yaxshi narx';

  // Method 1: OpenAI with reference
  if (OPENAI_API_KEY && referenceImageUrl) {
    const infographicPrompt = `Create a professional MARKETPLACE INFOGRAPHIC for selling this product online.

DESIGN RULES (Pinterest/Behance quality):
1. Keep the EXACT same product from this photo - do NOT change the product appearance at all
2. Add a premium stylish gradient background (soft pastels or elegant dark tones)
3. Add 2-4 feature icons/badges around the product highlighting: ${featureText}
4. Add a catchy sales headline at the top in RUSSIAN or UZBEK language
5. Add a selling point banner at the bottom
6. Product "${productName}" must be the visual center and largest element
7. Use bold, modern typography with high contrast
8. Portrait orientation, marketplace-ready design
9. Make it look like a top-selling product listing on Wildberries or Ozon`;

    const result = await editWithOpenAI(referenceImageUrl, infographicPrompt, OPENAI_API_KEY);
    if (result) {
      console.log("✅ Infographic generated via OpenAI");
      return result;
    }
  }

  // Method 2: DALL-E text-only
  if (OPENAI_API_KEY) {
    const prompt = `Professional marketplace product infographic for "${productName}" (${category}).
Premium gradient background, product centered, 2-4 feature badges: ${featureText}.
Catchy headline in Russian at top, selling banner at bottom.
Portrait 3:4, Pinterest/Behance quality, bold typography, modern marketplace design.`;

    const result = await generateWithOpenAI(prompt, OPENAI_API_KEY);
    if (result) return result;
  }

  // Method 3: Gemini fallback
  if (LOVABLE_API_KEY) {
    const prompt = `Marketplace infographic: "${productName}" (${category}). Gradient background, feature badges: ${featureText}. Russian text. Portrait 3:4. Professional.`;
    return await generateWithGemini(prompt, LOVABLE_API_KEY);
  }

  return null;
}

// ===== Upload to Supabase Storage =====
async function uploadToStorage(supabase: any, imageSource: string, partnerId: string, productId: string): Promise<string | null> {
  try {
    let bytes: Uint8Array;
    
    if (imageSource.startsWith('http')) {
      const resp = await fetch(imageSource);
      if (!resp.ok) return null;
      bytes = new Uint8Array(await resp.arrayBuffer());
    } else if (imageSource.startsWith('data:')) {
      const base64Content = imageSource.replace(/^data:image\/\w+;base64,/, '');
      bytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    } else {
      bytes = Uint8Array.from(atob(imageSource), c => c.charCodeAt(0));
    }

    const fileName = `ai-agent/${partnerId}/${productId}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

    if (error) { console.error("Storage upload error:", error); return null; }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

// ===== Upload to Yandex Market =====
async function uploadToYandex(credentials: any, offerId: string, newImageUrl: string): Promise<{ success: boolean; message: string }> {
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

  const getResp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`,
    { method: 'POST', headers, body: JSON.stringify({ offerIds: [offerId] }) }
  );
  
  let existingPictures: string[] = [];
  if (getResp.ok) {
    const getData = await getResp.json();
    existingPictures = getData.result?.offerMappings?.[0]?.offer?.pictures || [];
  }

  const allPictures = [newImageUrl, ...existingPictures];
  const resp = await fetchWithRetry(
    `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings/update`,
    { method: 'POST', headers, body: JSON.stringify({ offerMappings: [{ offer: { offerId, pictures: allPictures } }] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `Yandex: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: `Yangi rasm 1-chi o'ringa qo'yildi (jami ${allPictures.length} ta)` };
}

// ===== Upload to Wildberries =====
async function uploadToWildberries(credentials: any, nmID: number, newImageUrl: string): Promise<{ success: boolean; message: string }> {
  const apiKey = credentials.apiKey || credentials.api_key || credentials.token;
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  if (!nmID) return { success: false, message: 'nmID topilmadi' };

  const resp = await fetchWithRetry(
    `https://content-api.wildberries.ru/content/v3/media/save`,
    { method: 'POST', headers, body: JSON.stringify({ nmId: nmID, data: [newImageUrl] }) }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return { success: false, message: `WB: ${resp.status} - ${errText.substring(0, 200)}` };
  }

  return { success: true, message: 'Yangi rasm 1-chi o\'ringa yuklandi' };
}

// ===== MAIN =====
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
    const { action, partnerId, productName, category, offerId, nmID, marketplace, referenceImageUrl, features } = body;

    // ===== GENERATE-AND-UPLOAD =====
    if (action === 'generate-and-upload') {
      if (!productName || !partnerId) {
        return new Response(JSON.stringify({ error: 'productName va partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Step 1: Generate product image
      const imageSource = await generateProductImage(productName, category || '', referenceImageUrl);
      if (!imageSource) {
        return new Response(JSON.stringify({ success: false, error: 'Rasm yaratib bo\'lmadi. Barcha usullar xato berdi.' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Upload to storage
      const publicUrl = await uploadToStorage(supabase, imageSource, partnerId, offerId || 'unknown');
      if (!publicUrl) {
        return new Response(JSON.stringify({ success: false, error: 'Storage saqlash xatosi' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2.5: Generate infographic
      let infographicUrl: string | null = null;
      if (body.generateInfographic) {
        const infographicSource = await generateInfographicImage(productName, category || '', referenceImageUrl, features);
        if (infographicSource) {
          infographicUrl = await uploadToStorage(supabase, infographicSource, partnerId, `${offerId || 'unknown'}-infographic`);
        }
      }

      // Step 3: Upload to marketplace
      let mpResult: { success: boolean; message: string } = { success: false, message: 'Marketplace aniqlanmadi' };
      
      if (marketplace && offerId) {
        const { data: conns } = await supabase
          .from('marketplace_connections')
          .select('*')
          .eq('user_id', partnerId)
          .eq('marketplace', marketplace)
          .eq('is_active', true)
          .limit(1);

        if (conns?.length) {
          const conn = conns[0];
          let creds: any;
          if (conn.encrypted_credentials) {
            const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_encrypted: conn.encrypted_credentials });
            creds = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          } else {
            creds = conn.credentials || {};
          }

          if (marketplace === 'yandex') {
            mpResult = await uploadToYandex(creds, offerId, publicUrl);
            if (infographicUrl) await uploadToYandex(creds, offerId, infographicUrl);
          } else if (marketplace === 'wildberries' && nmID) {
            mpResult = await uploadToWildberries(creds, nmID, publicUrl);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true, imageUrl: publicUrl, infographicUrl,
        marketplaceUpload: mpResult,
        message: mpResult.success ? `✅ Rasm yaratildi va 1-chi o'ringa qo'yildi` : `⚠️ Rasm yaratildi. MP: ${mpResult.message}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'action kerak: generate-and-upload' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent images error:', e);
    return new Response(JSON.stringify({ error: (e as any).message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
