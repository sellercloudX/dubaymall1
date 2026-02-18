import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Product image generation pipeline using FREE Lovable AI (Gemini).
 * NO Fal.ai costs — all images generated via Lovable AI gateway.
 * 
 * Image types:
 * - "professional": Infographic card with features/specs overlay
 * - "minimalist/vibrant/luxury": Clean product angles on #efefef background
 * 
 * Output: 1080x1440 (3:4) vertical marketplace images
 */

// Category → Design Matrix
const CATEGORY_DESIGN_MATRIX: Record<string, {
  background: string;
  lighting: string;
  infographicStyle: string;
  colorScheme: string;
}> = {
  'kosmetika': {
    background: 'marble surface with soft silk curtains, water reflections, rose petals',
    lighting: 'soft glow, diffused warm light, beauty lighting',
    infographicStyle: 'elegant thin serif fonts, gold accents, luxurious feel',
    colorScheme: 'soft pinks, cream whites, gold metallic',
  },
  'parfyumeriya': {
    background: 'marble surface with soft silk curtains, sunlight shadows',
    lighting: 'soft glow, golden hour backlight, premium feel',
    infographicStyle: 'elegant thin fonts, gold/silver accents, Sephora-style',
    colorScheme: 'gold, white, deep navy or burgundy',
  },
  'elektronika': {
    background: 'dark gradient surface, subtle tech grid pattern, floating reflections',
    lighting: 'dramatic rim lighting, tech-forward, precision shadows',
    infographicStyle: 'modern sans-serif, neon accents, Apple Store aesthetic',
    colorScheme: 'deep black, white, electric blue or silver',
  },
  'kiyim': {
    background: 'neutral studio backdrop, clean concrete or fabric texture',
    lighting: 'bright editorial, sharp shadows, fashion-forward',
    infographicStyle: 'trendy bold fonts, ZARA/H&M aesthetic, minimal text',
    colorScheme: 'neutral tones, black and white with single accent color',
  },
  'oshxona': {
    background: 'Scandinavian kitchen, light wood surface, fresh herbs',
    lighting: 'natural sunlight from window, warm and inviting',
    infographicStyle: 'minimalist bold fonts, clean icons, IKEA style',
    colorScheme: 'warm whites, light wood tones, fresh green accents',
  },
  'sport': {
    background: 'dynamic gradient, motion blur elements, gym/outdoor',
    lighting: 'energetic bright, dramatic contrast, action-oriented',
    infographicStyle: 'bold impact fonts, Nike/Adidas aesthetic, dynamic angles',
    colorScheme: 'bold primary colors, black, energetic contrasts',
  },
  'bolalar': {
    background: 'soft pastel gradient, playful elements, stars/clouds',
    lighting: 'warm, soft, safe-feeling, no harsh shadows',
    infographicStyle: 'rounded friendly fonts, colorful icons, child-appropriate',
    colorScheme: 'bright pastels, sky blue, warm yellow, soft pink',
  },
  'oziq-ovqat': {
    background: 'rustic wood table, fresh ingredients, appetizing arrangement',
    lighting: 'warm food photography lighting, appetizing glow',
    infographicStyle: 'organic handwritten-style fonts, natural icons',
    colorScheme: 'warm earth tones, vibrant food colors, green freshness',
  },
  'aksessuarlar': {
    background: 'clean gradient surface, lifestyle composition, travel vibes',
    lighting: 'bright natural daylight, soft studio fill',
    infographicStyle: 'modern clean fonts, minimal icons, lifestyle brand feel',
    colorScheme: 'earthy tones, warm grays, subtle accent colors',
  },
  'default': {
    background: 'clean gradient surface, subtle professional texture',
    lighting: 'soft studio lighting, professional product photography',
    infographicStyle: 'modern clean fonts, professional icons, premium feel',
    colorScheme: 'professional blues, clean whites, subtle gradients',
  },
};

function getCategoryKey(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('kosmetik') || cat.includes('go\'zallik') || cat.includes('soch') || cat.includes('teri')) return 'kosmetika';
  if (cat.includes('parfyum') || cat.includes('atir')) return 'parfyumeriya';
  if (cat.includes('elektron') || cat.includes('smartfon') || cat.includes('kompyuter') || cat.includes('audio') || cat.includes('televizor') || cat.includes('noutbuk')) return 'elektronika';
  if (cat.includes('kiyim') || cat.includes('oyoq') || cat.includes('moda') || cat.includes('erkak') || cat.includes('ayol')) return 'kiyim';
  if (cat.includes('oshxona') || cat.includes('uy') || cat.includes('mebel')) return 'oshxona';
  if (cat.includes('sport') || cat.includes('fitnes')) return 'sport';
  if (cat.includes('bola') || cat.includes('o\'yinchoq')) return 'bolalar';
  if (cat.includes('oziq') || cat.includes('ichimlik') || cat.includes('shirinlik')) return 'oziq-ovqat';
  if (cat.includes('aksessuar') || cat.includes('sumka') || cat.includes('chamad') || cat.includes('bag')) return 'aksessuarlar';
  return 'default';
}

// Generate image using FREE Lovable AI (Gemini image generation)
async function generateWithGemini(
  prompt: string,
  lovableKey: string,
  productImage?: string
): Promise<string | null> {
  try {
    const messages: any[] = [{
      role: "user",
      content: productImage
        ? [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: productImage } },
          ]
        : prompt,
    }];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error(`Gemini image gen error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageUrl) {
      console.log("✅ Gemini image generated (FREE)");
    }
    return imageUrl || null;
  } catch (e) {
    console.error("Gemini image error:", e);
    return null;
  }
}

// Upload image to Supabase storage
async function uploadToStorage(imageData: string, style: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authKey = serviceKey || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !authKey) return imageData;

    let imgBytes: Uint8Array;
    let contentType = "image/png";

    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return imageData;
      contentType = match[1];
      const binaryString = atob(match[2]);
      imgBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imgBytes[i] = binaryString.charCodeAt(i);
      }
    } else if (imageData.startsWith("http")) {
      const imgResp = await fetch(imageData);
      if (!imgResp.ok) return imageData;
      imgBytes = new Uint8Array(await imgResp.arrayBuffer());
      contentType = imgResp.headers.get("content-type") || "image/jpeg";
    } else {
      return imageData;
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `infographics/${Date.now()}-${style}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, authKey);

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, imgBytes, { contentType, upsert: true });

    if (error) {
      console.warn(`Storage upload error: ${error.message}`);
      return imageData;
    }

    const { data: publicData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    console.log(`📦 Uploaded: ${fileName}`);
    return publicData.publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return imageData;
  }
}

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

    const { productImage, productName, category, style } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "productName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🎨 Generating image: "${productName}" | style: ${style || 'professional'} | engine: Gemini (FREE)`);

    const categoryKey = getCategoryKey(category || '');
    const designMatrix = CATEGORY_DESIGN_MATRIX[categoryKey];
    const isInfographic = style === 'professional' || style === 'infographic';

    // Build targeted prompt based on style
    let prompt: string;

    if (isInfographic) {
      prompt = `You are an elite product photographer creating a PREMIUM MARKETPLACE INFOGRAPHIC CARD.

PRODUCT: "${productName}" (Category: ${category || 'General'})

DESIGN REQUIREMENTS:
- Background: ${designMatrix.background}
- Lighting: ${designMatrix.lighting}
- Typography: ${designMatrix.infographicStyle}
- Color scheme: ${designMatrix.colorScheme}

IMAGE SPECIFICATIONS:
1. Product rendered LARGE and photorealistic in center (65-75% of frame)
2. 3-5 KEY FEATURES shown with elegant thin lines pointing to product parts
3. Feature labels in RUSSIAN language (Cyrillic text), modern sans-serif font
4. Each feature has a small flat icon matching the color scheme
5. Bottom area: brand badge, quality/rating indicators
6. Premium gradient background matching product category aesthetic
7. VERTICAL 3:4 aspect ratio (1080x1440 pixels)
8. Ultra high resolution, photorealistic, NO watermarks
9. The product must look EXACTLY like a real "${productName}"
10. Professional marketplace listing quality (Ozon/Wildberries level)

Create this premium infographic product card image now.`;
    } else {
      const angleMap: Record<string, string> = {
        'minimalist': 'perfectly centered front view, symmetrical composition',
        'vibrant': '45-degree three-quarter angle showing depth and dimension',
        'luxury': 'artistic close-up highlighting material texture and craftsmanship',
      };
      const angle = angleMap[style] || 'professional studio angle';

      prompt = `You are an elite product photographer creating a PREMIUM MARKETPLACE PRODUCT PHOTO.

PRODUCT: "${productName}" (Category: ${category || 'General'})

IMAGE SPECIFICATIONS:
1. Camera angle: ${angle}
2. Background: Clean, solid light gray (#EFEFEF) — NO patterns, NO props, NO text
3. Lighting: ${designMatrix.lighting}, soft diffused studio fill, subtle reflection below
4. Product fills 65-75% of frame — properly sized, not too small, not cropped
5. NO text, NO labels, NO watermarks, NO human hands
6. VERTICAL 3:4 aspect ratio (1080x1440 pixels)
7. Ultra high resolution, every detail razor sharp
8. The product must look EXACTLY like a real "${productName}" — accurate shape, color, proportions, brand details
9. Quality level: Apple Store / Sephora product photography
10. Clean, professional marketplace listing image

Create this premium product photo now.`;
    }

    // Add product reference image if available
    let generatedUrl: string | null = null;

    if (productImage) {
      // With reference image — better accuracy
      const refPrompt = `${prompt}\n\nCRITICAL: Use the attached product image as EXACT visual reference. The generated product must be 100% identical in shape, color, brand, and every detail. ONLY change the angle, background, and lighting as specified above. Do NOT add any text overlays unless this is an infographic style.`;
      generatedUrl = await generateWithGemini(refPrompt, LOVABLE_API_KEY, productImage);
    }

    if (!generatedUrl) {
      // Without reference or retry without reference
      generatedUrl = await generateWithGemini(prompt, LOVABLE_API_KEY);
    }

    const images: Array<{ url: string; style: string }> = [];

    if (generatedUrl) {
      const storedUrl = await uploadToStorage(generatedUrl, style || 'professional');
      if (storedUrl) {
        images.push({ url: storedUrl, style: style || 'professional' });
      }
    }

    return new Response(JSON.stringify({
      success: images.length > 0,
      images,
      engine: 'gemini-free',
      cost: '$0.00',
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
