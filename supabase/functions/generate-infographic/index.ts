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
 * Uses Gemini image generation (Nano banana) via Lovable AI Gateway
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

    console.log(`🎨 Generating ${count} image(s) for: "${productName}" (style: ${style || 'auto'})`);

    const images: Array<{ url: string; style: string }> = [];

    // Determine which type of image to generate based on style/index
    // "professional" = infographic (1st image)
    // others = product angle shots on #efefef background
    const isInfographic = style === 'professional' || style === 'infographic';

    let prompt: string;

    if (isInfographic) {
      // FIRST IMAGE: Professional marketplace infographic card
      // Inspired by top Wildberries/Ozon sellers and Pinterest marketplace card designs
      prompt = `Create a PREMIUM e-commerce product card infographic for "${productName}" (category: ${category || 'general'}).

STRICT REQUIREMENTS — follow exactly like top Wildberries and Ozon bestseller cards:
- Clean, minimalist gradient background (soft blue-to-white, or warm beige-to-cream, or mint-to-white)
- Product rendered LARGE and crisp in center (photorealistic, studio quality)
- 3-5 KEY FEATURES shown with thin elegant lines/arrows pointing to product parts
- Feature labels in RUSSIAN language, modern sans-serif font (like Montserrat or Gilroy)
- Each feature has a small ICON (flat style, matching color scheme)
- Bottom strip with: brand logo area, "✓ Сертифицировано" badge, rating stars
- Color scheme: premium, NOT generic — use brand-appropriate colors
- NO watermarks, NO stock photo feel
- Aspect ratio: 1:1 square
- Ultra high resolution, photorealistic product, magazine-quality layout
- Style reference: like Sephora product cards or Apple product pages
- Typography: clean, bold headlines, thin body text, excellent hierarchy

DO NOT make it look like a cheap template. Make it PREMIUM and PROFESSIONAL.`;
    } else {
      // REMAINING IMAGES: Product on clean background from different angles
      const angleMap: Record<string, string> = {
        'minimalist': 'front view, perfectly centered, symmetrical',
        'vibrant': '45-degree angle, three-quarter view showing depth and texture',
        'luxury': 'close-up detail shot showing material quality and craftsmanship',
        'tech': 'lifestyle context shot — product in use, elegant setting',
      };
      const angle = angleMap[style] || 'slightly angled professional view';

      prompt = `Professional product photography of "${productName}" (${category || 'product'}).

STRICT REQUIREMENTS:
- ${angle}
- Clean, solid #EFEFEF (light gray) background — NO shadows on background
- Soft diffused studio lighting from top-left, subtle reflection below product
- Product fills 65-75% of frame — not too small, not cropped
- NO text, NO labels, NO watermarks, NO props
- Photorealistic, high-end marketplace product photo
- Match quality of Apple Store or Sephora product images
- Aspect ratio: 1:1 square
- Ultra high resolution, every detail sharp and clear

The product must look EXACTLY like a real "${productName}" — accurate shape, proportions, color, and surface texture.`;
    }

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

      if (!response.ok) {
        const errText = await response.text();
        console.error(`AI image gen error: ${response.status} ${errText.substring(0, 200)}`);
        
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
        
        return new Response(JSON.stringify({ images: [], error: "Image generation failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const generatedImages = data.choices?.[0]?.message?.images || [];

      if (generatedImages.length > 0) {
        const imageUrl = generatedImages[0]?.image_url?.url;
        if (imageUrl) {
          // Upload to Supabase storage
          const uploadedUrl = await uploadBase64ToStorage(imageUrl, productName, style);
          if (uploadedUrl) {
            images.push({ url: uploadedUrl, style: style || 'professional' });
            console.log(`✅ Generated ${isInfographic ? 'infographic' : 'angle shot'} for "${productName}"`);
          } else {
            // If upload fails, return base64 directly (large but works)
            images.push({ url: imageUrl, style: style || 'professional' });
          }
        }
      } else {
        console.warn(`No images returned by AI for "${productName}"`);
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

// Upload base64 image to Supabase storage
async function uploadBase64ToStorage(base64Url: string, productName: string, style: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;

    // Extract base64 data
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

    // Decode base64 to binary
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
    console.log(`📦 Uploaded to storage: ${fileName}`);
    return publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}
