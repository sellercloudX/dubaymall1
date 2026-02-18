import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Multi-stage product image pipeline:
 * Stage 1: Gemini analyzes product → category-specific design params
 * Stage 2: Fal.ai Flux Pro generates high-quality marketplace images
 * 
 * Image types:
 * - "infographic": Professional product card with features/text
 * - "angle": Clean product photo on #efefef background
 */

// Category → Design Matrix (from PDF spec)
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
    background: 'marble surface with soft silk curtains, sunlight shadows, 8k professional photography',
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
  return 'default';
}

// Stage 1: Use Gemini to create a detailed design brief
async function createDesignBrief(
  productName: string,
  category: string,
  style: string,
  designMatrix: typeof CATEGORY_DESIGN_MATRIX[string],
  lovableKey: string
): Promise<{ prompt: string; negativePrompt: string } | null> {
  try {
    const isInfographic = style === 'professional' || style === 'infographic';

    const systemPrompt = `You are a WORLD-CLASS marketplace product photographer and graphic designer. 
You create prompts for AI image generation that produce PREMIUM, photorealistic product images.
Your prompts ALWAYS result in images that look like they belong on Apple Store, Sephora, or Nike's website.
Output ONLY a JSON object with "prompt" and "negativePrompt" fields.`;

    let userPrompt: string;

    if (isInfographic) {
      userPrompt = `Create an AI image generation prompt for a PREMIUM e-commerce infographic card for "${productName}" (category: ${category}).

Design Matrix:
- Background: ${designMatrix.background}
- Lighting: ${designMatrix.lighting}  
- Typography style: ${designMatrix.infographicStyle}
- Color scheme: ${designMatrix.colorScheme}

REQUIREMENTS for the prompt:
1. Product rendered LARGE and photorealistic in center (65-75% of frame)
2. 3-5 KEY FEATURES shown with elegant thin lines pointing to product parts
3. Feature labels in RUSSIAN language (Cyrillic), modern sans-serif font
4. Each feature has a small flat icon matching color scheme
5. Bottom: certification badge, rating stars, brand area
6. Premium gradient background matching product aesthetic
7. 1080x1440 vertical aspect ratio
8. Ultra high resolution, no watermarks, no stock photo feel
9. The product must look EXACTLY like a real "${productName}"

Return JSON: {"prompt": "...", "negativePrompt": "..."}`;
    } else {
      const angleMap: Record<string, string> = {
        'minimalist': 'front view, perfectly centered, symmetrical',
        'vibrant': '45-degree three-quarter view showing depth and texture',
        'luxury': 'close-up detail shot showing material quality and craftsmanship',
      };
      const angle = angleMap[style] || 'slightly angled professional studio view';

      userPrompt = `Create an AI image generation prompt for a PREMIUM product photograph of "${productName}" (category: ${category}).

Design Matrix:
- Lighting: ${designMatrix.lighting}

REQUIREMENTS for the prompt:
1. Camera angle: ${angle}
2. Clean, solid #EFEFEF (light gray) background — NO patterns, NO text, NO props
3. Soft diffused studio lighting, subtle reflection below product
4. Product fills 65-75% of frame — not too small, not cropped
5. NO text, NO labels, NO watermarks, NO hands
6. Match quality of Apple Store or Sephora product images
7. 1080x1440 vertical aspect ratio
8. Ultra high resolution, every detail sharp
9. The product must look EXACTLY like a real "${productName}" — accurate shape, proportions, color

Return JSON: {"prompt": "...", "negativePrompt": "..."}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`Gemini design brief error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]);
  } catch (e) {
    console.error("Design brief error:", e);
    return null;
  }
}

// Stage 2: Generate image with Fal.ai Flux Pro (SYNCHRONOUS endpoint)
async function generateWithFlux(
  prompt: string,
  negativePrompt: string,
  falKey: string,
  aspectRatio: string = "3:4"
): Promise<string | null> {
  try {
    console.log("🎨 Fal.ai Flux Pro generating (sync mode)...");

    // Use synchronous endpoint (fal.run) — no polling needed
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000); // 50s timeout

    const resp = await fetch("https://fal.run/fal-ai/flux-pro/v1.1-ultra", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: aspectRatio === "3:4"
          ? { width: 1080, height: 1440 }
          : { width: 1024, height: 1024 },
        num_images: 1,
        safety_tolerance: "5",
        output_format: "jpeg",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Fal.ai sync error: ${resp.status} ${errText.substring(0, 300)}`);
      return null;
    }

    const data = await resp.json();
    const imageUrl = data.images?.[0]?.url;

    if (imageUrl) {
      console.log("✅ Fal.ai Flux Pro image generated successfully");
      return imageUrl;
    }

    console.error("Fal.ai: no image in response", JSON.stringify(data).substring(0, 200));
    return null;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error("Fal.ai timeout (50s exceeded)");
    } else {
      console.error("Fal.ai Flux error:", e);
    }
    return null;
  }
}

// Fallback: Gemini image generation (if Fal.ai fails)
async function generateWithGemini(
  prompt: string,
  lovableKey: string,
  productImage?: string
): Promise<string | null> {
  try {
    console.log("⚡ Fallback: Gemini image generation...");
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

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imageUrl || null;
  } catch (e) {
    console.error("Gemini fallback error:", e);
    return null;
  }
}

// Upload image from URL to Supabase storage
async function uploadUrlToStorage(imageUrl: string, productName: string, style: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authKey = serviceKey || anonKey;
    if (!supabaseUrl || !authKey) {
      console.warn("No storage auth key available");
      return imageUrl;
    }

    // Download from URL (or handle base64)
    let imgBytes: Uint8Array;
    let contentType = "image/jpeg";

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return imageUrl;
      contentType = match[1];
      const binaryString = atob(match[2]);
      imgBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imgBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) return imageUrl;
      imgBytes = new Uint8Array(await imgResp.arrayBuffer());
      contentType = imgResp.headers.get("content-type") || "image/jpeg";
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `infographics/${Date.now()}-${style}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Use createClient for storage upload
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, authKey);

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, imgBytes, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn(`Storage upload error: ${error.message}`);
      return imageUrl;
    }

    const { data: publicData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    console.log(`📦 Uploaded: ${fileName}`);
    return publicData.publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return imageUrl;
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
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");

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

    console.log(`🎨 Pipeline for: "${productName}" | style: ${style || 'auto'} | engine: ${FAL_API_KEY ? 'Fal.ai Flux Pro' : 'Gemini fallback'}`);

    const images: Array<{ url: string; style: string }> = [];
    const categoryKey = getCategoryKey(category || '');
    const designMatrix = CATEGORY_DESIGN_MATRIX[categoryKey];

    // Stage 1: Create design brief with Gemini
    const designBrief = await createDesignBrief(
      productName, category || '', style || 'professional', designMatrix, LOVABLE_API_KEY
    );

    let prompt = designBrief?.prompt || `Professional marketplace product photo of "${productName}", ${designMatrix.background}, ${designMatrix.lighting}, ultra high resolution, 1080x1440`;
    let negativePrompt = designBrief?.negativePrompt || "blurry, low quality, watermark, text errors, distorted, amateur, stock photo feel, ugly, deformed";

    console.log(`📝 Prompt (${prompt.length} chars): ${prompt.substring(0, 100)}...`);

    // Stage 2: Generate with Fal.ai Flux Pro (primary) or Gemini (fallback)
    let generatedUrl: string | null = null;

    if (FAL_API_KEY) {
      generatedUrl = await generateWithFlux(prompt, negativePrompt, FAL_API_KEY, "3:4");
    }

    if (!generatedUrl && LOVABLE_API_KEY) {
      // Fallback to Gemini
      generatedUrl = await generateWithGemini(prompt, LOVABLE_API_KEY, productImage);
    }

    if (generatedUrl) {
      // Upload to our storage for permanence
      const storedUrl = await uploadUrlToStorage(generatedUrl, productName, style || 'professional');
      if (storedUrl) {
        images.push({ url: storedUrl, style: style || 'professional' });
      }
    }

    return new Response(JSON.stringify({
      success: images.length > 0,
      images,
      engine: FAL_API_KEY ? 'flux-pro' : 'gemini-fallback',
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
