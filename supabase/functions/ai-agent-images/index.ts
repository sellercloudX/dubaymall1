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

// ===== Generate product image using REFERENCE IMAGE (existing product photo) =====
async function generateProductImage(productName: string, category: string, referenceImageUrl?: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    console.log(`Generating image for: "${productName}" (${category}), ref: ${referenceImageUrl ? 'YES' : 'NO'}`);

    const model = "google/gemini-3-pro-image-preview";

    if (referenceImageUrl) {
      // Send the image TWICE for maximum context retention + ultra-strict prompt
      const editPrompt = `Look at this product photo carefully. This is the ONLY product that must appear in your output.

YOUR TASK: Take this EXACT product and place it on a clean white studio background.

STRICT RULES:
- The output must contain the SAME PHYSICAL OBJECT from the input photo
- Same bottle/box shape, same colors, same labels, same text, same cap, same everything
- Do NOT generate a different product even if you know what "${productName}" looks like
- Do NOT add any text, watermarks, or labels that aren't already on the product
- ONLY change the background to pure white/light gray
- Add professional studio lighting (soft shadows, even illumination)
- Center the product with negative space on all sides
- Output: portrait 3:4 ratio, high resolution, e-commerce quality

Think of this as: cut out the product from the photo → paste onto white background → add studio lighting. Nothing else.`;

      // Send image twice to reinforce visual context
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: referenceImageUrl } },
                { type: "text", text: editPrompt },
                { type: "image_url", image_url: { url: referenceImageUrl } },
              ]
            }
          ],
          modalities: ["image", "text"],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageUrl) {
          console.log(`Image generated from reference (${model}). Type: ${imageUrl.startsWith('data:') ? 'base64' : 'URL'}`);
          return imageUrl;
        }
      }
      const errText = await resp.text();
      console.log(`Reference image generation failed (${resp.status}): ${errText.substring(0, 200)}, falling back to text-only`);
    }

    // Fallback: text-only generation (only when NO reference image exists)
    const prompt = `Generate a professional e-commerce product photo of "${productName}" (category: ${category}). 
Clean white background, product centered with negative space, professional studio lighting.
Portrait 3:4 aspect ratio, 1080x1440, no text/watermarks, photorealistic marketplace quality.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      console.error(`Image generation failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageUrl) {
      console.log(`Image generated via text prompt. Type: ${imageUrl.startsWith('data:') ? 'base64' : 'URL'}`);
      return imageUrl;
    }

    console.error("No image in response");
    return null;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

// ===== Generate INFOGRAPHIC image with sales-boosting overlays =====
async function generateInfographicImage(productName: string, category: string, referenceImageUrl?: string, features?: string[]): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const featureText = features?.length ? features.slice(0, 5).join(', ') : 'Premium quality, Fast delivery, Best price';
    
    const content: any[] = [];

    if (referenceImageUrl) {
      content.push({ type: "image_url", image_url: { url: referenceImageUrl } });
    }

    content.push({ type: "text", text: `Look at the product photo above. Keep this EXACT product unchanged — same shape, colors, labels, cap.

Create a sales-boosting INFOGRAPHIC layout:
1. Keep the product EXACTLY as shown in the photo — do NOT redraw it
2. Add a stylish gradient/pattern background behind the product
3. Add 2-3 small badges or icons AROUND the product highlighting: ${featureText}
4. Add a banner at top or bottom with a selling point
5. Portrait 3:4, 1080x1440, marketplace style
6. Product must be the visual center` });

    // Send image again after text for reinforcement
    if (referenceImageUrl) {
      content.push({ type: "image_url", image_url: { url: referenceImageUrl } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (e) {
    console.error("Infographic generation error:", e);
    return null;
  }
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

      // Step 1: Generate product-specific image using reference
      const imageSource = await generateProductImage(productName, category || '', referenceImageUrl);
      if (!imageSource) {
        return new Response(JSON.stringify({ success: false, error: 'Rasm yaratib bo\'lmadi' }), {
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

      // Step 2.5: Also generate infographic if requested
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
            // Also upload infographic if available
            if (infographicUrl) {
              await uploadToYandex(creds, offerId, infographicUrl);
            }
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
