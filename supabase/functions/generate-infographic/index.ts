import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * HYBRID ARCHITECTURE: Gemini (image) + Code (text overlay)
 * 
 * Stage 1: Gemini generates TEXT-FREE product images with proper negative space
 * Stage 2: Frontend renders infographic text overlay via Canvas API
 * 
 * Cost: $0.00 (Gemini via Lovable AI is free)
 * Speed: 5-10 seconds per image
 * Text quality: 100% accurate (rendered by code, not AI)
 */

// Category → Design Matrix (Pinterest/Behance quality)
const CATEGORY_DESIGN_MATRIX: Record<string, {
  background: string;
  lighting: string;
  colorScheme: string;
  composition: string;
}> = {
  'kosmetika': {
    background: 'marble surface with soft silk curtains, water reflections, rose petals, bokeh effect',
    lighting: 'soft glow, diffused warm beauty lighting, premium aura',
    colorScheme: 'soft pinks, cream whites, gold metallic',
    composition: 'product centered with generous space on sides and bottom for text overlay',
  },
  'parfyumeriya': {
    background: 'marble surface with soft silk curtains, sunlight shadows, elegant podium',
    lighting: 'soft golden hour backlight, cinematic, premium feel',
    colorScheme: 'gold, white, deep navy or burgundy',
    composition: 'product on podium centered, space around edges for text overlay',
  },
  'elektronika': {
    background: 'dark gradient surface, subtle tech grid pattern, floating reflections',
    lighting: 'dramatic rim lighting, tech-forward, precision shadows',
    colorScheme: 'deep black, white, electric blue or silver',
    composition: 'product centered with clean space on left and right for feature callouts',
  },
  'kiyim': {
    background: 'neutral studio backdrop, clean concrete or soft fabric texture',
    lighting: 'bright editorial, sharp shadows, fashion-forward',
    colorScheme: 'neutral tones, black and white with single accent color',
    composition: 'product centered vertically, space on sides for text',
  },
  'oshxona': {
    background: 'Scandinavian minimalist kitchen, light wood surface, natural setting',
    lighting: 'natural sunlight from window, warm and inviting',
    colorScheme: 'warm whites, light wood tones, fresh green accents',
    composition: 'product centered with kitchen context, space for overlay text',
  },
  'sport': {
    background: 'dynamic gradient, subtle motion blur elements, energetic backdrop',
    lighting: 'energetic bright, dramatic contrast, action-oriented',
    colorScheme: 'bold primary colors, black, energetic contrasts',
    composition: 'product large in center, dynamic angle, space for feature badges',
  },
  'bolalar': {
    background: 'soft pastel gradient, playful subtle elements, stars or clouds',
    lighting: 'warm, soft, safe-feeling, no harsh shadows',
    colorScheme: 'bright pastels, sky blue, warm yellow, soft pink',
    composition: 'product centered with cheerful space around for kid-friendly text',
  },
  'oziq-ovqat': {
    background: 'rustic wood table, fresh ingredients nearby, appetizing arrangement',
    lighting: 'warm food photography lighting, appetizing glow',
    colorScheme: 'warm earth tones, vibrant food colors, green freshness',
    composition: 'product centered with appetizing context, space for text overlay',
  },
  'aksessuarlar': {
    background: 'clean gradient surface, lifestyle composition, travel vibes',
    lighting: 'bright natural daylight, soft studio fill',
    colorScheme: 'earthy tones, warm grays, subtle accent colors',
    composition: 'product centered with lifestyle context, space for text badges',
  },
  'default': {
    background: 'clean gradient surface, subtle professional texture',
    lighting: 'soft studio lighting, professional product photography',
    colorScheme: 'professional blues, clean whites, subtle gradients',
    composition: 'product centered (60% of frame), generous negative space around edges for text',
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

// Generate TEXT-FREE image using Gemini
async function generateTextFreeImage(
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
      console.error(`Gemini error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageUrl) console.log("✅ Gemini text-free image generated (FREE)");
    return imageUrl || null;
  } catch (e) {
    console.error("Gemini image error:", e);
    return null;
  }
}

// Upload to Supabase storage
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

    const { productImage, productName, category, style, features, brand } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "productName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🎨 Generating TEXT-FREE image: "${productName}" | style: ${style || 'professional'}`);

    const categoryKey = getCategoryKey(category || '');
    const designMatrix = CATEGORY_DESIGN_MATRIX[categoryKey];
    const isInfographic = style === 'professional' || style === 'infographic';

    // ALL images are generated WITHOUT text — text is added by frontend Canvas overlay
    let prompt: string;

    if (isInfographic) {
      // For infographic style: beautiful background + product + NEGATIVE SPACE for text overlay
      prompt = `You are an elite product photographer. Create a PREMIUM product photo for a marketplace listing.

PRODUCT: "${productName}" (Category: ${category || 'General'})

CRITICAL RULES:
1. DO NOT write ANY text, letters, words, labels, or watermarks on the image
2. DO NOT add any typography, fonts, numbers, or characters
3. The image must be PURELY visual — only the product and its background/environment

VISUAL DESIGN:
- Background: ${designMatrix.background}
- Lighting: ${designMatrix.lighting}
- Color palette: ${designMatrix.colorScheme}
- Composition: ${designMatrix.composition}
- Product fills about 55-65% of the frame, centered
- Leave generous EMPTY SPACE around the product edges (especially top, bottom, and sides) — this space will be used for text overlay later by code
- The empty space should feel natural and aesthetically pleasing, not awkward

TECHNICAL:
- VERTICAL 3:4 aspect ratio (1080x1440 pixels)
- Ultra high resolution, photorealistic
- Pinterest/Behance trending quality
- The product must look EXACTLY like a real "${productName}"

Generate this premium text-free product image now.`;
    } else {
      // Clean product shots on neutral background
      const angleMap: Record<string, string> = {
        'minimalist': 'perfectly centered front view, symmetrical composition',
        'vibrant': '45-degree three-quarter angle showing depth and dimension',
        'luxury': 'artistic close-up highlighting material texture and craftsmanship',
      };
      const angle = angleMap[style] || 'professional studio angle';

      prompt = `You are an elite product photographer. Create a CLEAN marketplace product photo.

PRODUCT: "${productName}" (Category: ${category || 'General'})

CRITICAL RULES:
1. DO NOT write ANY text, letters, words, labels, or watermarks
2. PURELY visual — only the product
3. Background: Clean, solid light gray (#EFEFEF) — NO patterns, NO props

SPECIFICATIONS:
- Camera angle: ${angle}
- Lighting: ${designMatrix.lighting}, soft diffused studio fill, subtle reflection below
- Product fills 65-75% of frame
- NO text, NO labels, NO watermarks, NO human hands
- VERTICAL 3:4 aspect ratio (1080x1440 pixels)
- Ultra high resolution, razor sharp
- Quality: Apple Store / Sephora product photography

Generate this clean product photo now.`;
    }

    let generatedUrl: string | null = null;

    if (productImage) {
      const refPrompt = `${prompt}\n\nCRITICAL: Use the attached product image as EXACT visual reference. Match shape, color, brand, proportions exactly. Only change angle, background, and lighting. ABSOLUTELY NO TEXT on the image.`;
      generatedUrl = await generateTextFreeImage(refPrompt, LOVABLE_API_KEY, productImage);
    }

    if (!generatedUrl) {
      generatedUrl = await generateTextFreeImage(prompt, LOVABLE_API_KEY);
    }

    const images: Array<{ url: string; style: string; isTextFree: boolean }> = [];

    if (generatedUrl) {
      const storedUrl = await uploadToStorage(generatedUrl, style || 'professional');
      if (storedUrl) {
        images.push({ url: storedUrl, style: style || 'professional', isTextFree: true });
      }
    }

    // Return overlay metadata for frontend Canvas rendering
    return new Response(JSON.stringify({
      success: images.length > 0,
      images,
      engine: 'gemini-hybrid',
      cost: '$0.00',
      // Pass design info for frontend overlay
      overlayConfig: isInfographic ? {
        categoryKey,
        colorScheme: designMatrix.colorScheme,
        features: features || [],
        brand: brand || '',
        productName,
      } : null,
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
