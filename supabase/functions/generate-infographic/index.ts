import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * HYBRID ARCHITECTURE: SellZen AI (primary) + Gemini (fallback)
 * 
 * Stage 1: SellZen AI generates professional infographic/product images
 * Stage 2: If SellZen fails → Gemini fallback generates text-free images
 * Stage 3: Frontend renders text overlay via Canvas API (for Gemini results)
 */

// Category mapping for SellZen API
const SELLZEN_CATEGORY_MAP: Record<string, string> = {
  'kosmetika': 'cosmetics',
  'parfyumeriya': 'cosmetics',
  'elektronika': 'electronics',
  'kiyim': 'clothing',
  'oshxona': 'home',
  'sport': 'clothing',
  'bolalar': 'clothing',
  'oziq-ovqat': 'home',
  'aksessuarlar': 'clothing',
  'default': 'home',
};

// Style mapping for SellZen API
const SELLZEN_STYLE_MAP: Record<string, string> = {
  'professional': 'infografika',
  'infographic': 'infografika',
  'minimalist': 'tabiiy',
  'vibrant': 'lifestyle',
  'luxury': 'infografika',
};

// Scene mapping
const SELLZEN_SCENE_MAP: Record<string, string> = {
  'professional': 'studiya',
  'infographic': 'premium',
  'minimalist': 'minimalist',
  'vibrant': 'tabiat',
  'luxury': 'premium',
};

// Category → Design Matrix for Gemini fallback
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
  if (cat.includes('auto') || cat.includes('mashina') || cat.includes('avto')) return 'default'; // SellZen has 'auto' category
  return 'default';
}

function getSellZenCategory(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('auto') || cat.includes('mashina') || cat.includes('avto')) return 'auto';
  const key = getCategoryKey(category);
  return SELLZEN_CATEGORY_MAP[key] || 'home';
}

// ─── SellZen AI Provider (PRIMARY) ───
async function generateWithSellZen(
  productImage: string,
  productName: string,
  category: string,
  style: string,
  apiKey: string
): Promise<{ url: string; isTextFree: boolean } | null> {
  try {
    const sellzenStyle = SELLZEN_STYLE_MAP[style] || 'infografika';
    const sellzenScene = SELLZEN_SCENE_MAP[style] || 'studiya';
    const sellzenCategory = getSellZenCategory(category);

    console.log(`🎨 SellZen: style=${sellzenStyle}, scene=${sellzenScene}, category=${sellzenCategory}`);

    const body: Record<string, string> = {
      imageBase64: productImage,
      mode: 'modelsiz',
      style: sellzenStyle,
      scene: sellzenScene,
      language: 'uz',
      category: sellzenCategory,
      productDetails: productName.substring(0, 500),
    };

    const response = await fetch(
      'https://qqqzkrldaaqogwjvfgcg.supabase.co/functions/v1/api-generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`SellZen error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'success') {
      const imageResult = data.imageUrl || data.generatedImage;
      if (imageResult) {
        console.log('✅ SellZen image generated successfully');
        return { url: imageResult, isTextFree: false }; // SellZen includes text/infographic
      }
    }

    console.warn('SellZen returned unexpected response:', data.status);
    return null;
  } catch (e) {
    console.error('SellZen error:', e);
    return null;
  }
}

// ─── Gemini Fallback Provider ───
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
      console.error(`Gemini error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageUrl) console.log("✅ Gemini fallback image generated");
    return imageUrl || null;
  } catch (e) {
    console.error("Gemini fallback error:", e);
    return null;
  }
}

// ─── Upload to Supabase Storage ───
async function uploadToStorage(imageData: string, style: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authKey = serviceKey || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !authKey) return imageData;

    // If already a public URL, no need to re-upload
    if (imageData.startsWith("http") && !imageData.startsWith("data:")) {
      return imageData;
    }

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

// ─── Build Gemini Fallback Prompt ───
function buildGeminiPrompt(productName: string, category: string, style: string, categoryKey: string): string {
  const designMatrix = CATEGORY_DESIGN_MATRIX[categoryKey];
  const isInfographic = style === 'professional' || style === 'infographic';

  if (isInfographic) {
    return `You are an award-winning product infographic photographer creating TOP-SELLER marketplace cards.

PRODUCT: "${productName}" (Category: ${category || 'General'})

ABSOLUTE RULES:
1. DO NOT write ANY text, letters, words, labels, numbers, or watermarks
2. PURELY VISUAL — only product and styled environment
3. Leave generous EMPTY SPACE around edges for text overlay

VISUAL DESIGN:
🎨 Background: ${designMatrix.background}
💡 Lighting: ${designMatrix.lighting}
🎨 Colors: ${designMatrix.colorScheme}
📐 Composition: ${designMatrix.composition}

Product fills 50-60% of frame, photorealistic, premium marketplace quality.
VERTICAL 3:4 aspect ratio (1080x1440 pixels). Generate now.`;
  }

  const angleMap: Record<string, string> = {
    'minimalist': 'perfectly centered front view, symmetrical zen composition',
    'vibrant': '45-degree three-quarter angle, vibrant colored backdrop',
    'luxury': 'artistic macro close-up highlighting texture and premium finish',
  };
  const angle = angleMap[style] || 'professional studio angle with depth';

  return `Elite product photographer. PRODUCT: "${productName}"

RULES: NO text/letters/watermarks. Clean background. 
Camera: ${angle}. Lighting: ${designMatrix.lighting}.
Product fills 60-75% of frame. Photorealistic. VERTICAL 3:4 (1080x1440). Generate now.`;
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

    // Rate limit: 15 requests per hour per user
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const rateLimitSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: rateLimitUser } } = await rateLimitSupabase.auth.getUser(token);
    if (rateLimitUser) {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count: recentCount } = await rateLimitSupabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', rateLimitUser.id)
        .eq('action_type', 'generate-infographic')
        .gte('created_at', oneHourAgo);

      if ((recentCount || 0) >= 15) {
        return new Response(
          JSON.stringify({ error: 'Soatiga 15 ta infografika limiti tugadi. Biroz kuting.' }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await rateLimitSupabase.from('ai_usage_log').insert({
        user_id: rateLimitUser.id, action_type: 'generate-infographic', model_used: 'sellzen-primary',
      });
    }

    const { productImage, productName, category, style, features, brand } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "productName majburiy" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🎨 Generating: "${productName}" | style: ${style || 'professional'}`);

    const categoryKey = getCategoryKey(category || '');
    const designMatrix = CATEGORY_DESIGN_MATRIX[categoryKey];
    const isInfographic = style === 'professional' || style === 'infographic';

    let resultImage: { url: string; isTextFree: boolean } | null = null;
    let engine = 'unknown';

    // ═══ STAGE 1: Try SellZen AI (primary) ═══
    const SELLZEN_API_KEY = Deno.env.get("SELLZEN_API_KEY");
    if (SELLZEN_API_KEY && productImage) {
      console.log("🚀 Trying SellZen AI (primary)...");
      const sellzenResult = await generateWithSellZen(
        productImage, productName, category || '', style || 'professional', SELLZEN_API_KEY
      );
      if (sellzenResult) {
        // Upload to our storage if it's base64
        const storedUrl = await uploadToStorage(sellzenResult.url, style || 'professional');
        if (storedUrl) {
          resultImage = { url: storedUrl, isTextFree: sellzenResult.isTextFree };
          engine = 'sellzen';
        }
      }
    }

    // ═══ STAGE 2: Gemini Fallback ═══
    if (!resultImage) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI xizmati sozlanmagan" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("🔄 SellZen unavailable, using Gemini fallback...");
      const prompt = buildGeminiPrompt(productName, category || '', style || 'professional', categoryKey);

      let generatedUrl: string | null = null;

      if (productImage) {
        const refPrompt = `${prompt}\n\nCRITICAL: Use the attached product image as EXACT visual reference. Match shape, color, brand exactly. ABSOLUTELY NO TEXT.`;
        generatedUrl = await generateWithGemini(refPrompt, LOVABLE_API_KEY, productImage);
      }
      if (!generatedUrl) {
        generatedUrl = await generateWithGemini(prompt, LOVABLE_API_KEY);
      }

      if (generatedUrl) {
        const storedUrl = await uploadToStorage(generatedUrl, style || 'professional');
        if (storedUrl) {
          resultImage = { url: storedUrl, isTextFree: true };
          engine = 'gemini-fallback';
        }
      }
    }

    const images: Array<{ url: string; style: string; isTextFree: boolean }> = [];
    if (resultImage) {
      images.push({ url: resultImage.url, style: style || 'professional', isTextFree: resultImage.isTextFree });
    }

    return new Response(JSON.stringify({
      success: images.length > 0,
      images,
      engine,
      cost: engine === 'sellzen' ? 'sellzen-credit' : '$0.00',
      overlayConfig: (isInfographic && resultImage?.isTextFree) ? {
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
      error: "Rasm yaratishda xatolik yuz berdi",
      images: [],
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
