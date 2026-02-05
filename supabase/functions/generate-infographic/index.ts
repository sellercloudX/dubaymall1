import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InfographicRequest {
  productImage: string;
  productName: string;
  category?: string;
  style?: "professional" | "minimalist" | "vibrant" | "luxury" | "tech";
  backgroundColor?: string;
  count?: number;
}

// ==================== FLUX PRO - PRIMARY AI ====================
// Using Replicate API with black-forest-labs/flux-1.1-pro
async function generateWithFluxPro(
  productImage: string,
  productName: string,
  category: string,
  style: string,
  variationConfig: { composition: string; focus: string; cameraAngle: string }
): Promise<{ url: string; id: string; style: string; variation: string; composition: string } | null> {
  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!REPLICATE_API_TOKEN) {
    console.log("⚠️ REPLICATE_API_TOKEN not configured");
    return null;
  }

  try {
    console.log("🎨 PRIMARY: Using Flux Pro for infographic generation...");
    
    // Category-specific styling for Flux Pro
    const categoryStyles: Record<string, string> = {
      "Elektronika": "sleek dark gradient background, subtle blue tech glow, premium studio lighting, high-end product photography",
      "Smartfonlar": "elegant dark gradient, soft blue purple ambient lighting, floating reflections, flagship device presentation",
      "Kiyim-kechak": "soft neutral fabric texture background, fashion editorial lighting, soft shadows, lookbook style",
      "Go'zallik": "luxurious soft pink gold bokeh background, beauty photography lighting, soft glow, cosmetic advertisement style",
      "Sport": "dynamic gradient with energy vibes, athletic mood lighting, action feel, sports equipment showcase",
      "Uy-ro'zg'or": "warm cozy home interior blur background, natural window lighting, lifestyle photography",
      "Bolalar uchun": "playful soft pastel gradient background, cheerful mood, bright colors, child-safe product display",
      "Kompyuterlar": "professional dark tech background with subtle grid patterns, RGB accents, gaming setup aesthetic",
      "Audio": "premium dark background with subtle sound wave effects, studio quality, audiophile presentation",
    };

    const styleDescriptions: Record<string, string> = {
      professional: "clean white light gray gradient studio background, professional product photography lighting, soft shadows, commercial quality",
      minimalist: "pure white background, minimal composition, elegant simplicity, premium feel, Apple-style presentation",
      vibrant: "colorful dynamic gradient background, eye-catching energy, bold modern feel, pop art influence",
      luxury: "dark elegant background with golden warm accents, premium sophisticated lighting, high-end boutique style",
      tech: "futuristic dark gradient with blue cyan tech accents, modern digital aesthetic, sci-fi inspired"
    };

    const bgStyle = categoryStyles[category] || styleDescriptions[style] || styleDescriptions.professional;

    // ULTRA-PROFESSIONAL FLUX PRO PROMPT
    const fluxPrompt = `PROFESSIONAL E-COMMERCE PRODUCT PHOTOGRAPHY for marketplace listing.

PRODUCT: "${productName}"
STYLE: ${style} ${category ? `for ${category} category` : ""}

COMPOSITION REQUIREMENTS:
- ${variationConfig.composition}
- ${variationConfig.focus}
- Camera angle: ${variationConfig.cameraAngle}

BACKGROUND & ATMOSPHERE:
${bgStyle}

TECHNICAL SPECIFICATIONS:
- Ultra high resolution, 8K quality details
- Professional studio lighting setup with key light, fill light, and rim light
- Soft natural shadows for depth and grounding
- Subtle reflections to enhance premium feel
- Clean crisp product edges
- Perfect color accuracy and white balance
- Ready for Uzum Market / Yandex Market listing
- 3:4 portrait aspect ratio (1080x1440 pixels)

ABSOLUTE RESTRICTIONS:
- NO text, watermarks, logos, labels, or prices anywhere on image
- NO people, hands, or body parts
- NO cluttered or busy backgrounds
- NO unrealistic colors or artificial looking elements

OUTPUT: Professional product photograph that would sell on premium marketplaces.`;

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
    console.log("📤 Flux Pro prediction started:", prediction.id);

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
      console.log("✅ Flux Pro infographic generated successfully");
      return {
        url: imageUrl,
        id: `flux-pro-${Date.now()}`,
        style: style,
        variation: variationConfig.focus,
        composition: variationConfig.cameraAngle
      };
    }

    console.error("Flux Pro generation failed:", result.error || "Unknown error");
    return null;
  } catch (err) {
    console.error("Flux Pro error:", err);
    return null;
  }
}

// ==================== FLUX REDUX - IMAGE-TO-IMAGE ====================
// For transforming existing product images
async function generateWithFluxRedux(
  productImage: string,
  productName: string,
  style: string,
  variationConfig: { composition: string; focus: string; cameraAngle: string }
): Promise<{ url: string; id: string; style: string; variation: string; composition: string } | null> {
  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!REPLICATE_API_TOKEN) {
    return null;
  }

  try {
    console.log("🖼️ Using Flux Redux for image-to-image transformation...");

    // Upload image first if it's base64
    let imageUrl = productImage;
    if (productImage.startsWith('data:')) {
      // For base64, we need to use the image directly in the prompt
      // Flux Redux accepts image URLs, so we'll use text-to-image with detailed description
      console.log("📸 Base64 image detected, using Flux Pro with detailed prompt instead");
      return null; // Fall through to Flux Pro text-to-image
    }

    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-redux-dev",
        input: {
          redux_image: imageUrl,
          aspect_ratio: "3:4",
          output_format: "webp",
          output_quality: 95,
          megapixels: "1"
        }
      }),
    });

    if (!createResponse.ok) {
      console.error("Flux Redux error:", await createResponse.text());
      return null;
    }

    const prediction = await createResponse.json();
    
    // Poll for completion
    let result = prediction;
    let attempts = 0;
    while (result.status !== "succeeded" && result.status !== "failed" && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` },
      });
      if (pollResponse.ok) result = await pollResponse.json();
      attempts++;
    }

    if (result.status === "succeeded" && result.output) {
      const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      return {
        url: outputUrl,
        id: `flux-redux-${Date.now()}`,
        style,
        variation: variationConfig.focus,
        composition: variationConfig.cameraAngle
      };
    }

    return null;
  } catch (err) {
    console.error("Flux Redux error:", err);
    return null;
  }
}

// ==================== DALL-E 3 - FALLBACK ====================
async function generateWithOpenAI(
  productName: string,
  category: string,
  style: string
): Promise<{ url: string; id: string; style: string; variation: string; composition: string } | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.log("⚠️ OPENAI_API_KEY not configured for fallback");
    return null;
  }

  try {
    console.log("🎨 FALLBACK: Using OpenAI DALL-E 3...");
    
    const dallePrompt = `Professional e-commerce product photography of "${productName}".
${style} style, ${category ? `${category} category,` : ""} clean studio background, premium lighting, 
high resolution product photography, marketplace listing quality, no text or watermarks, 3:4 portrait ratio.
Ultra realistic, commercial photography quality, ready for Uzum/Yandex marketplace.`;

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
        style: style === "vibrant" ? "vivid" : "natural"
      }),
    });

    if (!response.ok) {
      console.error("DALL-E API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (imageUrl) {
      console.log("✅ DALL-E 3 fallback successful");
      return {
        url: imageUrl,
        id: `dalle-${Date.now()}`,
        style,
        variation: "DALL-E generated",
        composition: "AI-enhanced"
      };
    }

    return null;
  } catch (err) {
    console.error("DALL-E fallback error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: InfographicRequest = await req.json();
    const { productImage, productName, category = "", style = "professional", count = 1 } = request;

    if (!productImage) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎨 Generating ${count} infographic(s) for: ${productName}`);
    console.log(`📐 Target: 1080x1440 (3:4 marketplace format)`);
    console.log(`🎯 Style: ${style}, Category: ${category || "general"}`);
    console.log(`🤖 AI Priority: Flux Pro → DALL-E 3`);

    // Professional variation configs for different compositions
    const variationConfigs = [
      {
        composition: "centered hero composition, product fills 80% of frame, dramatic overhead lighting",
        focus: "overall product showcase, full visibility, hero shot",
        cameraAngle: "straight-on frontal view"
      },
      {
        composition: "dynamic 15-degree angle, product fills 70% of frame, depth emphasis",
        focus: "product depth and three-dimensionality",
        cameraAngle: "three-quarter perspective view"
      },
      {
        composition: "close-up macro shot, product details fill 90% of frame, texture focus",
        focus: "highlight textures, materials, craftsmanship details",
        cameraAngle: "macro detail photography"
      },
      {
        composition: "elegant offset layout, product right of center, premium negative space",
        focus: "premium catalog style, editorial magazine feel",
        cameraAngle: "eye-level elegant angle"
      },
      {
        composition: "dramatic low angle, product appears powerful and prominent",
        focus: "create impression of quality, importance, premium value",
        cameraAngle: "slight upward hero perspective"
      },
      {
        composition: "clean symmetrical centered layout, perfectly balanced composition",
        focus: "professional product photography standard, catalog ready",
        cameraAngle: "direct frontal catalog view"
      }
    ];

    const results = [];
    let usedModel = "flux-pro";

    for (let i = 0; i < Math.min(count, 6); i++) {
      const config = variationConfigs[i % variationConfigs.length];
      console.log(`📸 Generating infographic ${i + 1}/${count} - ${config.focus}...`);

      // PRIMARY: Try Flux Pro first
      let result = await generateWithFluxPro(productImage, productName, category, style, config);

      // FALLBACK 1: Try Flux Redux for image-to-image
      if (!result && !productImage.startsWith('data:')) {
        result = await generateWithFluxRedux(productImage, productName, style, config);
        if (result) usedModel = "flux-redux";
      }

      // FALLBACK 2: Try DALL-E 3
      if (!result) {
        result = await generateWithOpenAI(productName, category, style);
        if (result) usedModel = "dall-e-3";
      }

      if (result) {
        results.push(result);
        console.log(`✅ Infographic ${i + 1} generated with ${usedModel}`);
      }

      // Delay between requests to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (results.length === 0) {
      console.log("⚠️ No infographics generated");
      return new Response(
        JSON.stringify({ 
          images: [],
          aiModel: "none",
          style,
          count: 0,
          dimensions: "1080x1440",
          format: "marketplace-optimized",
          message: "Infografika generatsiyasi vaqtinchalik mavjud emas. Keyinroq urinib ko'ring."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎉 Generated ${results.length}/${count} infographics with ${usedModel}`);

    return new Response(
      JSON.stringify({ 
        images: results,
        aiModel: usedModel,
        style,
        count: results.length,
        dimensions: "1080x1440",
        format: "marketplace-optimized"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
