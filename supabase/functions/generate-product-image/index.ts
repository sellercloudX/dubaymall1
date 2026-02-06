import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== GEMINI IMAGE EDITING via Google AI Studio - PRIMARY ====================
async function generateFromSourceImage(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  // Try Google AI Studio key first, then Lovable AI as fallback
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!GOOGLE_KEY && !LOVABLE_KEY) {
    console.log("⚠️ No API keys configured for image editing");
    return null;
  }

  const categoryHints: Record<string, string> = {
    "elektronika": "on a sleek dark gradient surface with subtle blue tech glow accents, premium tech product showcase",
    "kiyim": "on a clean white fashion lookbook background with soft natural lighting, fashion editorial style",
    "oziq-ovqat": "on a warm rustic wooden surface with appetizing garnishes, food magazine quality",
    "go'zallik": "on a soft pink-peach gradient with ethereal bokeh and golden hour lighting, luxury beauty ad",
    "sport": "on a dynamic gradient background with energy-suggesting lighting, sports catalog style",
    "uy": "in a cozy Scandinavian interior setting with natural daylight, IKEA catalog style",
    "kompyuter": "on a sleek dark gradient surface with subtle blue tech glow accents, premium tech product showcase",
    "smartfon": "on a sleek dark gradient surface with subtle blue tech glow accents, premium tech product showcase",
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
4. Add subtle complementary elements around the product that enhance its appeal
5. Use professional studio lighting: key light, fill light, rim light for premium depth
6. Make it look like a high-end marketplace listing photo (Amazon, Uzum Market quality)

PRODUCT: "${productName}"
CATEGORY: ${category || "General"}

ABSOLUTE RESTRICTIONS:
- NO text, watermarks, logos, labels, prices, or written words anywhere
- NO people, hands, or body parts
- The product appearance must remain IDENTICAL to the original
- Output must be photorealistic
- Portrait 3:4 aspect ratio

OUTPUT: One stunning, marketplace-ready product photograph.`;

  // Extract base64 data from source image
  let base64Data = sourceImage;
  let mimeType = "image/jpeg";
  if (sourceImage.startsWith("data:")) {
    const match = sourceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  // Google AI Studio with RETRY (up to 3 attempts, no Lovable AI fallback)
  if (GOOGLE_KEY) {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🎨 GOOGLE AI STUDIO: Image editing attempt ${attempt}/${MAX_RETRIES}...`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: editPrompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } }
                ]
              }],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"]
              }
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Google AI Studio error (attempt ${attempt}):`, response.status, errText);
          if (response.status === 429 && attempt < MAX_RETRIES) {
            console.log(`⏳ Rate limited, waiting ${attempt * 5}s...`);
            await new Promise(r => setTimeout(r, attempt * 5000));
            continue;
          }
        } else {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          
          for (const part of parts) {
            if (part.inlineData) {
              const imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              console.log(`✅ Google AI Studio: Photo created (attempt ${attempt})!`);
              return imageBase64;
            }
          }
          console.log(`⚠️ Google AI Studio: No image in response (attempt ${attempt})`);
        }

        if (attempt < MAX_RETRIES) {
          console.log(`⏳ Retrying in ${attempt * 2}s...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      } catch (err) {
        console.error(`Google AI Studio error (attempt ${attempt}):`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      }
    }
    console.log("❌ Google AI Studio: All 3 attempts failed");
  }

  return null;
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

// ==================== GEMINI TEXT-TO-IMAGE via Google AI Studio - FALLBACK ====================
async function generateWithGemini(
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!GOOGLE_KEY && !LOVABLE_KEY) {
    console.log("⚠️ No keys for text-to-image");
    return null;
  }

  const prompt = `Create a professional e-commerce product photograph of "${productName}".
${category ? `Product category: ${category}.` : ""}
Clean white studio background, professional lighting, high resolution, no text or watermarks, 3:4 portrait ratio, marketplace listing quality.`;

  // Google AI Studio with RETRY (up to 3 attempts)
  if (GOOGLE_KEY) {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🎨 GOOGLE AI STUDIO TEXT-TO-IMAGE attempt ${attempt}/${MAX_RETRIES}...`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData) {
              console.log(`✅ Google AI Studio text-to-image success (attempt ${attempt})`);
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
          console.log(`⚠️ No image in response (attempt ${attempt})`);
        } else {
          const errText = await response.text();
          console.error(`Google AI Studio text-to-image error (attempt ${attempt}):`, response.status, errText);
          if (response.status === 429 && attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 5000));
            continue;
          }
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      } catch (err) {
        console.error(`Google AI Studio text-to-image error (attempt ${attempt}):`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      }
    }
  }

  return null;
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
      // When source image exists, try Gemini edit ONLY
      // DO NOT fall back to text-to-image because it will generate a COMPLETELY DIFFERENT product
      console.log("🤖 Strategy: Source image → Gemini Edit ONLY (no text-to-image fallback)");
      
      imageUrl = await generateFromSourceImage(sourceImage, productName, category || "");
      if (imageUrl) {
        usedModel = "gemini-image-edit";
      } else {
        // Gemini edit failed - return original source image instead of generating a fake one
        console.log("⚠️ Gemini edit failed. Returning ORIGINAL source image to preserve product accuracy.");
        return new Response(
          JSON.stringify({ 
            imageUrl: sourceImage, 
            aiModel: "original-preserved", 
            message: "Original image preserved (AI enhancement unavailable)" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // No source image - text-to-image is fine since there's nothing to preserve
      console.log("🤖 Strategy: Text → Flux Pro → Gemini Text fallback");
      
      imageUrl = await generateWithFluxPro(productName, category || "", style || "marketplace");
      if (imageUrl) usedModel = "flux-pro";

      if (!imageUrl) {
        imageUrl = await generateWithGemini(productName, category || "");
        if (imageUrl) usedModel = "gemini-text-to-image";
      }
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
