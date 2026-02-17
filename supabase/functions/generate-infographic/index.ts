import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate product images:
 * - Image 1: Strong infographic explaining product function/features
 * - Images 2-5: Product on #efefef background from different angles
 * 
 * Uses Gemini 3 Pro image generation for highest quality
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { productImage, productName, category, style, count = 1 } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "productName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🎨 Generating image for: "${productName}" (style: ${style || 'auto'})`);

    const images: Array<{ url: string; style: string }> = [];
    const isInfographic = style === 'professional' || style === 'infographic';

    // Category-specific design style
    const categoryStyle = getCategoryDesignStyle(category || '');

    let prompt: string;

    if (isInfographic) {
      prompt = `Create a PREMIUM e-commerce product card infographic for "${productName}" (category: ${category || 'general'}).

DESIGN STYLE: ${categoryStyle}

STRICT REQUIREMENTS:
- Clean, minimalist gradient background (soft tones matching product aesthetic)
- Product rendered LARGE and crisp in center (photorealistic, studio quality)
- 3-5 KEY FEATURES shown with thin elegant lines pointing to product parts
- Feature labels in RUSSIAN language, modern sans-serif font (Montserrat/Gilroy style)
- Each feature has a small flat ICON matching color scheme
- Bottom strip: brand logo area, "✓ Сертифицировано" badge, rating stars
- Color scheme: premium, brand-appropriate
- NO watermarks, NO stock photo feel
- Aspect ratio: 1:1 square (1024x1024)
- Ultra high resolution, photorealistic product
- Typography: bold headlines, thin body text, excellent hierarchy
- The product must look EXACTLY like a real "${productName}"

DO NOT make it look like a cheap template. PREMIUM and PROFESSIONAL only.`;
    } else {
      const angleMap: Record<string, string> = {
        'minimalist': 'front view, perfectly centered, symmetrical composition',
        'vibrant': '45-degree angle, three-quarter view showing depth and texture',
        'luxury': 'close-up detail shot showing material quality and craftsmanship',
        'tech': 'lifestyle context shot — product in elegant real-world setting',
      };
      const angle = angleMap[style] || 'slightly angled professional studio view';

      prompt = `Professional product photography of "${productName}" (${category || 'product'}).

REQUIREMENTS:
- ${angle}
- Clean, solid #EFEFEF (light gray) background — NO patterns, NO shadows on background
- Soft diffused studio lighting from top-left, subtle reflection below product
- Product fills 65-75% of frame — not too small, not cropped
- NO text, NO labels, NO watermarks, NO props, NO hands
- Photorealistic, high-end marketplace product photography
- Match quality of Apple Store or Sephora product images
- Aspect ratio: 1:1 square (1024x1024)
- Ultra high resolution, every detail sharp and clear
- The product must look EXACTLY like a real "${productName}" — accurate shape, proportions, color, surface texture
- ${categoryStyle}`;
    }

    try {
      // Use Gemini 3 Pro for highest quality images
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: productImage ? [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: productImage } },
              ] : prompt,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`AI image gen error: ${response.status} ${errText.substring(0, 200)}`);
        
        // Fallback to flash model if pro fails
        if (response.status !== 429 && response.status !== 402) {
          console.log("⚡ Trying fallback model: gemini-2.5-flash-image...");
          const fallbackResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [
                {
                  role: "user",
                  content: productImage ? [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: productImage } },
                  ] : prompt,
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (fallbackResp.ok) {
            const fbData = await fallbackResp.json();
            const fbImages = fbData.choices?.[0]?.message?.images || [];
            if (fbImages.length > 0) {
              const imageUrl = fbImages[0]?.image_url?.url;
              if (imageUrl) {
                const uploadedUrl = await uploadBase64ToStorage(imageUrl, productName, style);
                images.push({ url: uploadedUrl || imageUrl, style: style || 'professional' });
                console.log(`✅ Fallback model generated ${isInfographic ? 'infographic' : 'photo'}`);
              }
            }
          }
        }
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited", images: [] }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required", images: [] }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (images.length === 0) {
          return new Response(JSON.stringify({ images: [], error: "Image generation failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const data = await response.json();
        const generatedImages = data.choices?.[0]?.message?.images || [];

        if (generatedImages.length > 0) {
          const imageUrl = generatedImages[0]?.image_url?.url;
          if (imageUrl) {
            const uploadedUrl = await uploadBase64ToStorage(imageUrl, productName, style);
            if (uploadedUrl) {
              images.push({ url: uploadedUrl, style: style || 'professional' });
              console.log(`✅ Pro model generated ${isInfographic ? 'infographic' : 'photo'} for "${productName}"`);
            } else {
              images.push({ url: imageUrl, style: style || 'professional' });
            }
          }
        }
      }
    } catch (e) {
      console.error(`Image generation error for "${productName}":`, e);
    }

    return new Response(JSON.stringify({ 
      success: images.length > 0,
      images,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate infographic error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      images: [],
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Category-specific design guidance
function getCategoryDesignStyle(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('kosmetik') || cat.includes('go\'zallik') || cat.includes('parfyum') || cat.includes('soch') || cat.includes('teri')) {
    return 'Style: Sephora/Glossier aesthetic — soft pinks, clean whites, luxurious feel, beauty product photography';
  }
  if (cat.includes('elektron') || cat.includes('smartfon') || cat.includes('kompyuter') || cat.includes('audio') || cat.includes('televizor') || cat.includes('noutbuk')) {
    return 'Style: Apple Store aesthetic — minimal, dark/white contrast, tech-forward, precision lighting';
  }
  if (cat.includes('kiyim') || cat.includes('oyoq') || cat.includes('moda') || cat.includes('erkak') || cat.includes('ayol')) {
    return 'Style: ZARA/H&M aesthetic — fashion-forward, editorial feel, neutral backgrounds';
  }
  if (cat.includes('sport') || cat.includes('fitnes') || cat.includes('velosiped')) {
    return 'Style: Nike/Adidas aesthetic — dynamic, energetic, bold colors, action-oriented';
  }
  if (cat.includes('bola') || cat.includes('o\'yinchoq')) {
    return 'Style: Bright, playful, safe-feeling — warm colors, friendly design, child-appropriate';
  }
  if (cat.includes('uy') || cat.includes('mebel') || cat.includes('oshxona')) {
    return 'Style: IKEA aesthetic — Scandinavian clean design, warm tones, home-comfort feel';
  }
  if (cat.includes('oziq') || cat.includes('ichimlik') || cat.includes('shirinlik')) {
    return 'Style: Food photography — appetizing, warm lighting, vibrant colors, close-up textures';
  }
  return 'Style: Premium marketplace aesthetic — clean, professional, high-trust design';
}

// Upload base64 image to Supabase storage
async function uploadBase64ToStorage(base64Url: string, productName: string, style: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;

    let base64Data: string;
    let contentType = "image/png";
    
    if (base64Url.startsWith("data:")) {
      const match = base64Url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      contentType = match[1];
      base64Data = match[2];
    } else {
      base64Data = base64Url;
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `infographics/${Date.now()}-${style}-${Math.random().toString(36).substring(7)}.${ext}`;

    const uploadResp = await fetch(
      `${supabaseUrl}/storage/v1/object/product-images/${fileName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: bytes,
      }
    );

    if (!uploadResp.ok) {
      console.warn(`Storage upload failed: ${uploadResp.status}`);
      return null;
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`;
    console.log(`📦 Uploaded: ${fileName}`);
    return publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}
