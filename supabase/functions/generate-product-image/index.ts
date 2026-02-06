import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== HELPER: Extract base64 ====================
function extractBase64(img: string): { base64Data: string; mimeType: string } {
  let base64Data = img;
  let mimeType = "image/jpeg";
  if (img.startsWith("data:")) {
    const match = img.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }
  return { base64Data, mimeType };
}

// ==================== HELPER: Build edit prompt ====================
function buildEditPrompt(productName: string, category: string): string {
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
    if (catLower.includes(key)) { envHint = value; break; }
  }

  return `Transform this product photo into a PREMIUM E-COMMERCE listing image.

RULES:
1. Keep the EXACT SAME PRODUCT - do NOT change shape, color, brand or design
2. Product must be centered, filling 70-80% of frame
3. Place the product ${envHint}
4. Professional studio lighting for premium depth
5. High-end marketplace quality (Amazon, Uzum Market)

PRODUCT: "${productName}" | CATEGORY: ${category || "General"}

RESTRICTIONS: NO text, NO watermarks, NO people, NO hands. Product appearance IDENTICAL to original. Photorealistic. Portrait 3:4 ratio.`;
}

// ==================== 1. GOOGLE AI STUDIO - Gemini Image Edit ====================
async function tryGoogleAIStudio(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) return null;

  const { base64Data, mimeType } = extractBase64(sourceImage);
  const editPrompt = buildEditPrompt(productName, category);

  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-exp"];

  for (const model of models) {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🎨 GOOGLE AI STUDIO [${model}] attempt ${attempt}/${MAX_RETRIES}...`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`,
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
                responseModalities: ["IMAGE", "TEXT"]
              }
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Google [${model}] error (${attempt}):`, response.status, errText);
          if (response.status === 429) {
            await new Promise(r => setTimeout(r, attempt * 5000));
            continue;
          }
          break; // other errors → try next model
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const finishReason = data.candidates?.[0]?.finishReason;
        
        console.log(`📋 [${model}] finishReason: ${finishReason}, parts: ${parts.length}`);

        for (const part of parts) {
          if (part.inlineData) {
            console.log(`✅ Google AI Studio [${model}]: Image created (attempt ${attempt})!`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }

        // Log text response for debugging
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join(" ");
        if (textParts) {
          console.log(`📝 [${model}] returned text instead: ${textParts.substring(0, 200)}`);
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      } catch (err) {
        console.error(`Google [${model}] error (${attempt}):`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  console.log("❌ Google AI Studio: All models/attempts failed");
  return null;
}

// ==================== 2. OPENAI - GPT-4o Vision + DALL-E 3 ====================
async function tryOpenAIImageEdit(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return null;

  try {
    console.log("🎨 OPENAI: Analyzing product with GPT-4o then generating with DALL-E 3...");

    // Step 1: Use GPT-4o Vision to get detailed product description
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Describe this product in extreme detail for image generation. Include: exact color, shape, material, brand markings, size proportions, texture. Product name: "${productName}". Category: ${category}. Return ONLY a detailed visual description, nothing else.` },
            { type: "image_url", image_url: { url: sourceImage, detail: "high" } }
          ]
        }],
        max_tokens: 500
      }),
    });

    if (!visionRes.ok) {
      console.error("GPT-4o Vision error:", visionRes.status);
      return null;
    }

    const visionData = await visionRes.json();
    const productDescription = visionData.choices?.[0]?.message?.content;
    if (!productDescription) return null;

    console.log("📝 GPT-4o described product:", productDescription.substring(0, 100));

    // Step 2: Generate with DALL-E 3
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Professional e-commerce product photograph. ${productDescription}. Clean studio background, professional three-point lighting, premium marketplace listing quality. NO text, NO watermarks, NO logos, NO people. Photorealistic. Portrait 3:4 ratio.`,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        style: "natural"
      }),
    });

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      console.error("DALL-E 3 error:", dalleRes.status, errText);
      return null;
    }

    const dalleData = await dalleRes.json();
    const imageUrl = dalleData.data?.[0]?.url;
    if (imageUrl) {
      console.log("✅ OpenAI DALL-E 3: Image generated!");
      return imageUrl;
    }
  } catch (err) {
    console.error("OpenAI pipeline error:", err);
  }

  return null;
}

// ==================== 3. FLUX PRO - TEXT-TO-IMAGE ====================
async function tryFluxPro(
  productName: string,
  category: string
): Promise<string | null> {
  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  if (!REPLICATE_API_TOKEN) return null;

  try {
    console.log("🎨 FLUX PRO: Generating product image...");

    const fluxPrompt = `Professional e-commerce product photography of "${productName}". Category: ${category || "General"}. Clean white studio background, professional three-point lighting, premium marketplace quality, ultra high resolution. NO text, NO watermarks, NO people. Photorealistic.`;

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
      console.error("Flux Pro error:", createResponse.status);
      return null;
    }

    const prediction = await createResponse.json();
    console.log("📤 Flux Pro started:", prediction.id);

    let result = prediction;
    let attempts = 0;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` },
      });
      if (pollResponse.ok) {
        result = await pollResponse.json();
      }
      attempts++;
    }

    if (result.status === "succeeded" && result.output) {
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      console.log("✅ Flux Pro completed");
      return imageUrl;
    }

    console.error("Flux Pro failed:", result.error);
  } catch (err) {
    console.error("Flux Pro error:", err);
  }
  return null;
}

// ==================== 4. GOOGLE AI STUDIO - TEXT-TO-IMAGE ====================
async function tryGoogleTextToImage(
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) return null;

  const prompt = `Create a professional e-commerce product photograph of "${productName}". Category: ${category || "General"}. Clean white studio background, professional lighting, high resolution, no text, no watermarks. Portrait 3:4 ratio.`;

  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-exp"];

  for (const model of models) {
    try {
      console.log(`🎨 GOOGLE TEXT-TO-IMAGE [${model}]...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            console.log(`✅ Google text-to-image [${model}] success`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      } else {
        console.error(`Google text-to-image [${model}] error:`, response.status);
      }
    } catch (err) {
      console.error(`Google text-to-image [${model}] error:`, err);
    }
  }

  return null;
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, category, style, sourceImage } = body;

    if (!productName || typeof productName !== "string") {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Image generation for: ${productName}`);
    console.log(`📦 Category: ${category || "General"} | Source image: ${!!sourceImage}`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (sourceImage) {
      // SOURCE IMAGE → Try image editing with all available providers
      console.log("🤖 Strategy: Google Gemini Edit → OpenAI (GPT-4o+DALL-E) → Original");

      // 1. Google AI Studio (Gemini image edit) - 2 models × 2 retries
      imageUrl = await tryGoogleAIStudio(sourceImage, productName, category || "");
      if (imageUrl) { usedModel = "gemini-image-edit"; }

      // 2. OpenAI GPT-4o Vision + DALL-E 3
      if (!imageUrl) {
        imageUrl = await tryOpenAIImageEdit(sourceImage, productName, category || "");
        if (imageUrl) { usedModel = "openai-dalle3"; }
      }

      // 3. All AI failed → return original image
      if (!imageUrl) {
        console.log("⚠️ All AI failed. Returning ORIGINAL source image.");
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
      // NO SOURCE IMAGE → Text-to-image
      console.log("🤖 Strategy: Flux Pro → Google Gemini Text → DALL-E 3");

      // 1. Flux Pro
      imageUrl = await tryFluxPro(productName, category || "");
      if (imageUrl) { usedModel = "flux-pro"; }

      // 2. Google AI Studio text-to-image
      if (!imageUrl) {
        imageUrl = await tryGoogleTextToImage(productName, category || "");
        if (imageUrl) { usedModel = "gemini-text-to-image"; }
      }

      // 3. DALL-E 3 (without source image, just from name)
      if (!imageUrl) {
        const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
        if (OPENAI_KEY) {
          try {
            console.log("🎨 DALL-E 3 TEXT-TO-IMAGE...");
            const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: `Professional e-commerce product photo of "${productName}". Category: ${category || "General"}. Clean studio background, professional lighting, no text, no watermarks. Photorealistic.`,
                n: 1,
                size: "1024x1792",
                quality: "hd",
                style: "natural"
              }),
            });
            if (dalleRes.ok) {
              const dalleData = await dalleRes.json();
              imageUrl = dalleData.data?.[0]?.url;
              if (imageUrl) { usedModel = "dalle-3"; }
            }
          } catch (err) {
            console.error("DALL-E 3 error:", err);
          }
        }
      }
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Rasm yaratib bo'lmadi. Qayta urinib ko'ring.", suggestion: "Rasmni qo'lda yuklashingiz mumkin." }),
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
      JSON.stringify({ error: "Rasm yaratish xatoligi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
