import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== GEMINI IMAGE EDITING - PRIMARY (when source image available) ====================
async function generateFromSourceImage(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log("🎨 GEMINI IMAGE EDIT: Creating professional photo from scanned product...");
    
    const categoryHints: Record<string, string> = {
      "elektronika": "on a sleek dark gradient surface with subtle blue tech glow accents, premium tech product showcase",
      "kiyim": "on a clean white fashion lookbook background with soft natural lighting, fashion editorial style",
      "oziq-ovqat": "on a warm rustic wooden surface with appetizing garnishes, food magazine quality",
      "go'zallik": "on a soft pink-peach gradient with ethereal bokeh and golden hour lighting, luxury beauty ad",
      "sport": "on a dynamic gradient background with energy-suggesting lighting, sports catalog style",
      "uy": "in a cozy Scandinavian interior setting with natural daylight, IKEA catalog style",
    };

    let envHint = "on a clean white-to-light-gray gradient studio background with professional three-point lighting";
    const catLower = category.toLowerCase();
    for (const [key, value] of Object.entries(categoryHints)) {
      if (catLower.includes(key)) {
        envHint = value;
        break;
      }
    }

    const editPrompt = `Transform this product photo into a PREMIUM E-COMMERCE MARKETPLACE listing image.

CRITICAL RULES:
1. Keep the EXACT SAME PRODUCT from the original photo - do NOT change the product itself, its shape, color, brand, or design
2. The product must be the HERO ELEMENT - centered, filling 70-80% of the frame
3. Place the product ${envHint}
4. Add subtle complementary elements around the product that enhance its appeal and encourage purchase (soft shadows, light reflections, category-appropriate props)
5. Use professional studio lighting: key light, fill light, rim light for premium depth
6. Make it look like a high-end marketplace listing photo (Amazon, Uzum Market quality)

PRODUCT: "${productName}"
CATEGORY: ${category || "General"}

ABSOLUTE RESTRICTIONS:
- NO text, watermarks, logos, labels, prices, or written words anywhere
- NO people, hands, or body parts
- The product appearance must remain IDENTICAL to the original
- Output must be photorealistic, not illustrated or cartoonish
- Portrait 3:4 aspect ratio

OUTPUT: One stunning, marketplace-ready product photograph that makes customers want to buy immediately.`;

    const messages: any[] = [
      {
        role: "user",
        content: [
          { type: "text", text: editPrompt },
          {
            type: "image_url",
            image_url: { url: sourceImage }
          }
        ]
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages,
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Image Edit error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageData) {
      console.log("✅ Gemini Image Edit: Professional product photo created from source!");
      return imageData;
    }

    return null;
  } catch (err) {
    console.error("Gemini Image Edit error:", err);
    return null;
  }
}

// ==================== FLUX PRO - TEXT-TO-IMAGE (when no source image) ====================
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
    
    const categoryStyles: Record<string, string> = {
      "electronics": `sleek dark gradient background with subtle blue tech glow, dramatic side lighting, premium flagship device presentation, Apple-style product photography, 8K ultra sharp details`,
      "cosmetics": `soft pink-peach gradient background with ethereal bokeh, golden hour warm lighting, luxury beauty advertisement quality, Sephora-style presentation`,
      "clothing": `clean minimalist studio background, soft natural window lighting, fashion editorial feel, Zara/H&M lookbook style, professional fashion photography`,
      "food": `warm appetizing rustic wooden surface, natural soft window lighting with steam effects, food magazine cover quality`,
      "home": `cozy Scandinavian interior lifestyle setting, natural daylight, IKEA catalog style presentation`,
      "default": `clean white-to-light-gray gradient studio background, professional three-point lighting, premium e-commerce marketplace ready presentation`
    };

    const categoryLower = category.toLowerCase();
    let stylePrompt = categoryStyles["default"];
    
    for (const [key, value] of Object.entries(categoryStyles)) {
      if (categoryLower.includes(key) || key.includes(categoryLower)) {
        stylePrompt = value;
        break;
      }
    }

    const fluxPrompt = `PROFESSIONAL E-COMMERCE PRODUCT PHOTOGRAPHY.

PRODUCT: "${productName}"
CATEGORY: ${category || "General"}

VISUAL REQUIREMENTS:
${stylePrompt}

COMPOSITION:
- Product centered, fills 70-80% of frame
- Professional studio lighting with soft shadows
- Premium marketplace quality (Uzum, Amazon)
- Ultra high resolution, 8K quality
- Portrait 3:4 ratio

RESTRICTIONS:
- NO text, watermarks, logos, prices
- NO people or hands
- Product must look 100% realistic and purchasable`;

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
      console.error("Flux Pro create error:", createResponse.status);
      return null;
    }

    const prediction = await createResponse.json();
    console.log("📤 Flux Pro started:", prediction.id);

    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` },
      });
      if (pollResponse.ok) {
        result = await pollResponse.json();
        console.log(`⏳ Flux Pro: ${result.status} (${attempts + 1}/${maxAttempts})`);
      }
      attempts++;
    }

    if (result.status === "succeeded" && result.output) {
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      console.log("✅ Flux Pro completed");
      return imageUrl;
    }

    console.error("Flux Pro failed:", result.error);
    return null;
  } catch (err) {
    console.error("Flux Pro error:", err);
    return null;
  }
}

// ==================== GEMINI TEXT-TO-IMAGE - FALLBACK ====================
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
    console.log("🎨 GEMINI TEXT-TO-IMAGE: Fallback generation...");
    
    const prompt = `Create a professional e-commerce product photograph of "${productName}".
${category ? `Product category: ${category}.` : ""}
Clean white studio background, professional lighting, high resolution, no text or watermarks, 3:4 portrait ratio, marketplace listing quality.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      console.error("Gemini fallback error:", response.status);
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageData) {
      console.log("✅ Gemini text-to-image fallback successful");
      return imageData;
    }

    return null;
  } catch (err) {
    console.error("Gemini fallback error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, category, style, sourceImage } = body;

    if (!productName || typeof productName !== 'string') {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Generating product image for: ${productName}`);
    console.log(`📦 Category: ${category || 'General'}`);
    console.log(`📸 Source image provided: ${!!sourceImage}`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (sourceImage) {
      // PRIMARY: When we have a scanned photo, use Gemini to create professional version
      console.log("🤖 Strategy: Source image → Gemini Edit → Flux Pro fallback → Gemini Text fallback");
      
      imageUrl = await generateFromSourceImage(sourceImage, productName, category || "");
      if (imageUrl) usedModel = "gemini-image-edit";
    }

    if (!imageUrl) {
      // FALLBACK 1: Flux Pro text-to-image
      console.log("🤖 Strategy: Text → Flux Pro → Gemini Text fallback");
      imageUrl = await generateWithFluxPro(productName, category || "", style || "marketplace");
      if (imageUrl) usedModel = "flux-pro";
    }

    if (!imageUrl) {
      // FALLBACK 2: Gemini text-to-image
      imageUrl = await generateWithGemini(productName, category || "");
      if (imageUrl) usedModel = "gemini-text-to-image";
    }

    if (!imageUrl) {
      console.error("All AI models failed");
      return new Response(
        JSON.stringify({ 
          error: "Image generation failed. Please try again later.",
          suggestion: "You can manually upload an image instead."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Image generated with ${usedModel}`);

    return new Response(
      JSON.stringify({ imageUrl, aiModel: usedModel, message: "Image generated successfully" }),
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
