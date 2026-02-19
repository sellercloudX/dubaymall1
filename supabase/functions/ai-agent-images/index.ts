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

// ===== Download image as bytes =====
async function downloadImage(url: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    console.error("Download image error:", e);
    return null;
  }
}

// ===== OpenAI gpt-image-1: reference-based editing via multipart/form-data =====
async function editWithOpenAI(referenceImageUrl: string, editPrompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Downloading reference image for OpenAI edit...");
    const imageBytes = await downloadImage(referenceImageUrl);
    if (!imageBytes) {
      console.error("Failed to download reference image");
      return null;
    }

    console.log(`Reference image downloaded: ${imageBytes.length} bytes. Calling OpenAI gpt-image-1...`);

    // Build multipart/form-data
    const formData = new FormData();
    const blob = new Blob([imageBytes], { type: "image/png" });
    formData.append("image", blob, "product.png");
    formData.append("model", "gpt-image-1");
    formData.append("prompt", editPrompt);
    formData.append("size", "1024x1536");
    formData.append("quality", "high");

    const resp = await fetchWithRetry("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        // No Content-Type - browser/runtime sets it with boundary for FormData
      },
      body: formData,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`OpenAI gpt-image-1 edit failed (${resp.status}): ${errText.substring(0, 500)}`);
      return null;
    }

    const data = await resp.json();
    console.log("OpenAI edit response keys:", Object.keys(data));
    
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    
    const url = data.data?.[0]?.url;
    if (url) return url;
    
    console.error("No image in OpenAI edit response:", JSON.stringify(data).substring(0, 300));
    return null;
  } catch (e) {
    console.error("OpenAI edit error:", e);
    return null;
  }
}

// ===== OpenAI DALL-E 3: text-to-image =====
async function generateWithDallE3(prompt: string, apiKey: string): Promise<string | null> {
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
      console.error(`DALL-E 3 failed (${resp.status}): ${errText.substring(0, 500)}`);
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

// ===== Generate product image (OpenAI only) =====
async function generateProductImage(productName: string, category: string, referenceImageUrl?: string): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  console.log(`=== PRODUCT IMAGE ===`);
  console.log(`Product: "${productName}" (${category})`);
  console.log(`Reference: ${referenceImageUrl ? 'YES - ' + referenceImageUrl.substring(0, 80) : 'NO'}`);
  console.log(`OpenAI Key: ${OPENAI_API_KEY ? 'YES (' + OPENAI_API_KEY.substring(0, 8) + '...)' : 'NO'}`);

  if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY topilmadi!");
    return null;
  }

  // Method 1: gpt-image-1 with reference image
  if (referenceImageUrl) {
    const editPrompt = `Take this EXACT product photo and place it on a clean, pure white studio background. 
Keep the product PIXEL-PERFECT: same shape, colors, labels, cap, brand text - change NOTHING about the product itself.
Add professional studio lighting with soft natural shadows. Center the product. Portrait orientation.
Do NOT add any text, watermarks, badges or extra elements.`;

    const result = await editWithOpenAI(referenceImageUrl, editPrompt, OPENAI_API_KEY);
    if (result) {
      console.log("✅ Product image via OpenAI gpt-image-1 (reference edit)");
      return result;
    }
    console.log("⚠️ gpt-image-1 edit failed, falling back to DALL-E 3...");
  }

  // Method 2: DALL-E 3 text-to-image
  const prompt = `Professional e-commerce product photo of "${productName}" (category: ${category}). 
Clean white background, product centered, professional studio lighting, soft shadows.
Portrait orientation 3:4, photorealistic, high resolution. No text or watermarks.`;

  const result = await generateWithDallE3(prompt, OPENAI_API_KEY);
  if (result) {
    console.log("✅ Product image via DALL-E 3");
    return result;
  }

  console.error("❌ All OpenAI image methods failed");
  return null;
}

// ===== Generate INFOGRAPHIC image (OpenAI only) =====
async function generateInfographicImage(productName: string, category: string, referenceImageUrl?: string, features?: string[]): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return null;

  const featureText = features?.length ? features.slice(0, 5).join(', ') : 'Premium sifat, Tez yetkazib berish, Eng yaxshi narx';

  console.log(`=== INFOGRAPHIC ===`);
  console.log(`Product: "${productName}", Features: ${featureText}`);
  console.log(`Reference: ${referenceImageUrl ? 'YES' : 'NO'}`);

  // Method 1: gpt-image-1 with reference
  if (referenceImageUrl) {
    const infographicPrompt = `Create a STUNNING MARKETPLACE INFOGRAPHIC that will SELL this product. This must look like a TOP-SELLING product listing.

ABSOLUTE RULES:
1. The EXACT product from this photo must remain 100% UNCHANGED — same shape, colors, labels, cap, packaging, brand text. PIXEL-PERFECT preservation.
2. Place the product LARGE and CENTERED (50-60% of frame) with its original packaging/box visible if present.

INFOGRAPHIC DESIGN (Premium Marketplace Style):
- Background: Rich, eye-catching gradient (dark gold/bronze tones with sparkle effects, or deep elegant colors matching the product category)
- TOP: Bold catchy SELLING HEADLINE in UZBEK or RUSSIAN language (large, white/gold text with shadow). Example: "AYOLLARNI JALB QILISH UCHUN!" or "ПРЕМИУМ КАЧЕСТВО!"
- RIGHT SIDE: 2-4 feature badges/cards with icons highlighting: ${featureText}
  Each badge should have: an emoji/icon + bold title + 1-line description in Uzbek/Russian
- BOTTOM: A selling banner with urgency text like "O'ZIGA JALB ETSIN!" or "ЛУЧШАЯ ЦЕНА!"
- Add subtle sparkle/glow effects around the product for premium feel
- Typography: Bold, modern, high-contrast, easy to read on mobile
- Product "${productName}" must be the hero — everything else supports it

TECHNICAL: Portrait orientation, 1024x1536, marketplace-ready, mobile-optimized.
Make it look like the #1 bestseller listing on Wildberries/Ozon/Uzum Market.`;


    const result = await editWithOpenAI(referenceImageUrl, infographicPrompt, OPENAI_API_KEY);
    if (result) {
      console.log("✅ Infographic via OpenAI gpt-image-1 (reference)");
      return result;
    }
  }

  // Method 2: DALL-E 3 text-only infographic
  const prompt = `Create a STUNNING marketplace product infographic for "${productName}" (${category}).
Design: Rich gradient background with sparkle/glow effects. Product centered and large (50-60% of frame).
TOP: Bold catchy headline in RUSSIAN or UZBEK — selling the product emotionally.
RIGHT: 2-4 feature badges with icons: ${featureText}. Each badge has icon + title + description.
BOTTOM: Urgency selling banner.
Style: Bold modern typography, high contrast, mobile-optimized, portrait 3:4.
Quality: Must look like #1 bestseller on Wildberries/Ozon marketplace. Premium, eye-catching, trustworthy.
No real brand logos. High resolution 1024x1792.`;

  const result = await generateWithDallE3(prompt, OPENAI_API_KEY);
  if (result) {
    console.log("✅ Infographic via DALL-E 3");
    return result;
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

    console.log(`Uploading ${bytes.length} bytes to storage...`);
    const fileName = `ai-agent/${partnerId}/${productId}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

    if (error) { console.error("Storage upload error:", error); return null; }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    console.log("✅ Uploaded to storage:", urlData?.publicUrl?.substring(0, 80));
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

    console.log(`=== AI AGENT IMAGES ===`);
    console.log(`Action: ${action}, Partner: ${partnerId}, Product: ${productName}`);
    console.log(`Reference URL: ${referenceImageUrl ? referenceImageUrl.substring(0, 100) + '...' : 'NONE'}`);

    // ===== GENERATE-AND-UPLOAD =====
    if (action === 'generate-and-upload') {
      if (!productName || !partnerId) {
        return new Response(JSON.stringify({ error: 'productName va partnerId kerak' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Step 1: Generate product image
      const imageSource = await generateProductImage(productName, category || '', referenceImageUrl);
      if (!imageSource) {
        return new Response(JSON.stringify({ success: false, error: 'Rasm yaratib bo\'lmadi. OpenAI API xato berdi. Loglarni tekshiring.' }), {
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
