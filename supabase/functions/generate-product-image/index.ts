import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== FLUX PRO - PRIMARY IMAGE GENERATION ====================
async function generateWithFluxPro(
  productName: string,
  category: string,
  style: string
): Promise<string | null> {
  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!REPLICATE_API_TOKEN) {
    console.log("⚠️ REPLICATE_API_TOKEN not configured");
    return null;
  }

  try {
    console.log("🎨 FLUX PRO: Generating professional product image...");
    
    // Category-specific professional styling for marketplace
    const categoryStyles: Record<string, string> = {
      "electronics": `sleek dark gradient background with subtle blue tech glow, 
        dramatic side lighting, light trails and digital particle effects,
        premium flagship device presentation, Apple-style product photography,
        8K ultra sharp details, circuit board pattern reflections`,
      
      "cosmetics": `soft pink-peach gradient background with ethereal bokeh,
        scattered rose petals and water droplets for freshness,
        golden hour warm lighting with soft glow particles,
        luxury beauty advertisement quality, Sephora-style presentation,
        soft shadows and premium glass reflections`,
      
      "clothing": `clean minimalist studio background, soft natural window lighting,
        fashion editorial feel with elegant fabric textures visible,
        Zara/H&M lookbook style presentation, runway quality lighting,
        professional fashion photography with depth of field`,
      
      "food": `warm appetizing rustic wooden surface setting,
        natural soft window lighting with steam effects,
        fresh ingredient garnishes around product,
        food magazine cover quality, appetizing warm color grading`,
      
      "home": `cozy Scandinavian interior lifestyle setting,
        natural daylight from window, complementary decor elements,
        IKEA catalog style presentation, warm inviting atmosphere`,
      
      "default": `clean white-to-light-gray gradient studio background,
        professional three-point lighting setup,
        soft natural shadows beneath product for grounding,
        premium e-commerce marketplace ready presentation,
        Amazon/eBay listing quality photography`
    };

    const categoryLower = category.toLowerCase();
    let stylePrompt = categoryStyles["default"];
    
    for (const [key, value] of Object.entries(categoryStyles)) {
      if (categoryLower.includes(key) || key.includes(categoryLower)) {
        stylePrompt = value;
        break;
      }
    }

    // ULTRA-PROFESSIONAL FLUX PRO PROMPT
    const fluxPrompt = `PROFESSIONAL E-COMMERCE PRODUCT PHOTOGRAPHY.

PRODUCT: "${productName}"
CATEGORY: ${category || "General"}

VISUAL REQUIREMENTS:
${stylePrompt}

COMPOSITION RULES:
- Product centered and prominent, fills 70-80% of frame
- Professional studio lighting: key light, fill light, rim light
- Soft natural shadows for depth and product grounding
- Clean crisp product edges with perfect focus
- Premium marketplace presentation quality (Uzum, Yandex Market)

TECHNICAL SPECIFICATIONS:
- Ultra high resolution, 8K quality details
- Perfect color accuracy and white balance
- Portrait aspect ratio 3:4 (1080x1440 pixels)
- Commercial advertising photography quality
- Ready for immediate marketplace listing

ABSOLUTE RESTRICTIONS:
- NO text, watermarks, logos, labels, or prices anywhere
- NO people, hands, or body parts visible
- NO cluttered or distracting background elements
- NO unrealistic colors or over-saturation
- Product must look 100% realistic and purchasable

OUTPUT: One stunning, marketplace-ready product photograph that sells.`;

    // Create prediction with Flux 1.1 Pro
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-1.1-pro",
        input: {
          prompt: fluxPrompt,
          aspect_ratio: "3:4",
          output_format: "webp",
          output_quality: 95,
          safety_tolerance: 2,
          prompt_upsampling: true
        }
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Flux Pro create error:", createResponse.status, errorText);
      return null;
    }

    const prediction = await createResponse.json();
    console.log("📤 Flux Pro generation started:", prediction.id);

    // Poll for completion (max 120 seconds)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        },
      });
      
      if (pollResponse.ok) {
        result = await pollResponse.json();
        console.log(`⏳ Flux Pro status: ${result.status} (attempt ${attempts + 1}/${maxAttempts})`);
      }
      attempts++;
    }

    if (result.status === "succeeded" && result.output) {
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      console.log("✅ Flux Pro generation completed successfully");
      return imageUrl;
    }

    console.error("Flux Pro generation failed:", result.error || "Unknown error");
    return null;
  } catch (err) {
    console.error("Flux Pro generation error:", err);
    return null;
  }
}

// ==================== DALL-E 3 - FALLBACK ====================
async function generateWithDallE(
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.log("⚠️ OPENAI_API_KEY not configured for fallback");
    return null;
  }

  try {
    console.log("🎨 DALL-E 3 FALLBACK: Generating product image...");
    
    const dallePrompt = `Professional e-commerce product photography of "${productName}".
${category ? `Category: ${category}.` : ""}
Clean studio background, premium three-point lighting, high resolution product photography, 
marketplace listing quality (Amazon, Uzum Market), no text or watermarks, 3:4 portrait ratio.
Ultra realistic, commercial photography quality, ready for premium marketplace listing.
The product should look exactly like a real purchasable item.`;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        style: "natural"
      }),
    });

    if (!response.ok) {
      console.error("DALL-E API error:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (imageUrl) {
      console.log("✅ DALL-E 3 fallback successful");
      return imageUrl;
    }

    return null;
  } catch (err) {
    console.error("DALL-E fallback error:", err);
    return null;
  }
}

// ==================== GEMINI IMAGE - LAST RESORT ====================
async function generateWithGemini(
  productName: string,
  category: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log("🎨 GEMINI IMAGE: Generating as last resort...");
    
    const prompt = `Create a professional e-commerce product photograph of "${productName}".
${category ? `Product category: ${category}.` : ""}
Requirements:
- Clean white/light gray studio background
- Professional product lighting
- High resolution, sharp details
- No text, watermarks, or logos
- Ready for marketplace listing
- 3:4 portrait aspect ratio`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      console.error("Gemini Image API error:", response.status);
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageData) {
      console.log("✅ Gemini Image generation successful");
      return imageData;
    }

    return null;
  } catch (err) {
    console.error("Gemini Image error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, category, style } = body;

    // Input validation
    if (!productName || typeof productName !== 'string') {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Generating product image for: ${productName}`);
    console.log(`📦 Category: ${category || 'General'}`);
    console.log(`🤖 AI Priority: Flux Pro → DALL-E 3 → Gemini`);

    let imageUrl: string | null = null;
    let usedModel = "flux-pro";

    // PRIMARY: Try Flux Pro first (best quality)
    imageUrl = await generateWithFluxPro(productName, category || "", style || "marketplace");

    // FALLBACK 1: Try DALL-E 3 if Flux Pro fails
    if (!imageUrl) {
      imageUrl = await generateWithDallE(productName, category || "");
      if (imageUrl) usedModel = "dall-e-3";
    }

    // FALLBACK 2: Try Gemini Image as last resort
    if (!imageUrl) {
      imageUrl = await generateWithGemini(productName, category || "");
      if (imageUrl) usedModel = "gemini-image";
    }

    if (!imageUrl) {
      console.error("All AI models failed for image generation");
      return new Response(
        JSON.stringify({ 
          error: "Image generation failed. Please try again later.",
          suggestion: "You can manually upload an image instead."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Image generated successfully with ${usedModel}`);

    return new Response(
      JSON.stringify({ 
        imageUrl: imageUrl,
        aiModel: usedModel,
        message: "Image generated successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Image generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
