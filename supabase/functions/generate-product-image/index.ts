import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Simplified prompt to avoid IMAGE_OTHER rejections
function buildEditPrompt(productName: string, category: string): string {
  return `Edit this product photo: remove the background and place the product on a clean white studio background with professional lighting. Keep the product exactly as it is. Product: "${productName}". Output a high quality product photo.`;
}

function buildDetailedEditPrompt(productName: string, category: string): string {
  const categoryHints: Record<string, string> = {
    "elektronika": "sleek dark gradient surface with subtle blue glow",
    "kiyim": "clean white background with soft natural lighting",
    "oziq-ovqat": "warm rustic wooden surface",
    "go'zallik": "soft pink-peach gradient with golden hour lighting",
    "sport": "dynamic gradient background with energy lighting",
    "uy": "cozy interior setting with natural daylight",
    "kompyuter": "sleek dark gradient surface with blue glow",
    "smartfon": "sleek dark gradient surface with blue glow",
  };

  let bg = "clean white studio background";
  const catLower = category.toLowerCase();
  for (const [key, value] of Object.entries(categoryHints)) {
    if (catLower.includes(key)) { bg = value; break; }
  }

  return `Transform this product photo into a premium e-commerce listing image. Place the product on ${bg}. Keep the EXACT same product unchanged. Professional studio lighting. No text, no watermarks, no people. Product: "${productName}".`;
}

// ==================== 1. GOOGLE AI STUDIO - Gemini Image Edit ====================
async function tryGoogleAIStudio(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) {
    console.log("⚠️ GOOGLE_AI_STUDIO_KEY not set");
    return null;
  }

  const { base64Data, mimeType } = extractBase64(sourceImage);

  // Try multiple prompts: simple first (less likely to be rejected), then detailed
  const prompts = [
    buildEditPrompt(productName, category),
    buildDetailedEditPrompt(productName, category),
  ];

  // Working models only - gemini-2.0-flash-exp is discontinued
  const models = ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash"];

  for (const prompt of prompts) {
    for (const model of models) {
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🎨 GOOGLE [${model}] prompt=${prompts.indexOf(prompt)+1} attempt ${attempt}/${MAX_RETRIES}`);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Data } }
                  ]
                }],
                generationConfig: {
                  responseModalities: ["IMAGE", "TEXT"],
                }
              }),
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            console.error(`Google [${model}] HTTP ${response.status}: ${errText.substring(0, 200)}`);
            if (response.status === 429) {
              await new Promise(r => setTimeout(r, attempt * 5000));
              continue;
            }
            if (response.status === 404) {
              console.log(`❌ Model ${model} not found, skipping`);
              break; // skip this model entirely
            }
            break;
          }

          const data = await response.json();
          const candidates = data.candidates || [];
          const parts = candidates[0]?.content?.parts || [];
          const finishReason = candidates[0]?.finishReason;

          console.log(`📋 [${model}] finishReason: ${finishReason}, parts: ${parts.length}`);

          for (const part of parts) {
            if (part.inlineData) {
              console.log(`✅ Google [${model}]: Image created!`);
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }

          // If IMAGE_OTHER or no image, log and retry
          const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join(" ");
          if (textParts) {
            console.log(`📝 [${model}] text response: ${textParts.substring(0, 150)}`);
          }

          if (finishReason === "IMAGE_OTHER" || finishReason === "SAFETY") {
            console.log(`⚠️ [${model}] rejected (${finishReason}), will retry with delay...`);
            await new Promise(r => setTimeout(r, attempt * 3000));
            continue;
          }

          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 2000));
          }
        } catch (err) {
          console.error(`Google [${model}] exception (${attempt}):`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    }
  }

  console.log("❌ Google AI Studio: All models/prompts/attempts failed");
  return null;
}

// ==================== 2. OPENAI - GPT-4o Vision + DALL-E 3 ====================
async function tryOpenAIImageEdit(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) {
    console.log("⚠️ OPENAI_API_KEY not set");
    return null;
  }

  try {
    console.log("🎨 OPENAI: GPT-4o Vision → DALL-E 3...");

    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Describe this product in extreme visual detail for image recreation. Include: exact colors, shape, material, brand markings, proportions, texture. Product: "${productName}", Category: ${category}. Return ONLY description.` },
            { type: "image_url", image_url: { url: sourceImage, detail: "high" } }
          ]
        }],
        max_tokens: 500
      }),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error("GPT-4o Vision error:", visionRes.status, errText.substring(0, 200));
      return null;
    }

    const visionData = await visionRes.json();
    const productDescription = visionData.choices?.[0]?.message?.content;
    if (!productDescription) {
      console.error("GPT-4o returned empty description");
      return null;
    }

    console.log("📝 GPT-4o described:", productDescription.substring(0, 100));

    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Professional e-commerce product photo. ${productDescription}. Clean studio background, professional lighting, premium quality. NO text, NO watermarks, NO people. Photorealistic.`,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        style: "natural"
      }),
    });

    if (!dalleRes.ok) {
      const errText = await dalleRes.text();
      console.error("DALL-E 3 error:", dalleRes.status, errText.substring(0, 200));
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
  if (!REPLICATE_API_TOKEN) {
    console.log("⚠️ REPLICATE_API_TOKEN not set");
    return null;
  }

  try {
    console.log("🎨 FLUX PRO: Generating product image...");

    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-1.1-pro",
        input: {
          prompt: `Professional e-commerce product photo of "${productName}". Category: ${category || "General"}. Clean white studio background, professional lighting, ultra high resolution. NO text, NO watermarks, NO people. Photorealistic.`,
          aspect_ratio: "3:4",
          output_format: "webp",
          output_quality: 95,
          safety_tolerance: 2,
          prompt_upsampling: true
        }
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error("Flux Pro create error:", createResponse.status, errText.substring(0, 200));
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

    console.error("Flux Pro failed:", result.error || result.status);
  } catch (err) {
    console.error("Flux Pro error:", err);
  }
  return null;
}

// ==================== 4. GOOGLE TEXT-TO-IMAGE ====================
async function tryGoogleTextToImage(
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) return null;

  const prompt = `Create a professional e-commerce product photo of "${productName}". Category: ${category || "General"}. Clean white studio background, professional lighting. No text, no watermarks.`;

  const models = ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash"];

  for (const model of models) {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🎨 GOOGLE TEXT-TO-IMAGE [${model}] attempt ${attempt}/${MAX_RETRIES}`);
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

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Google text-to-image [${model}] HTTP ${response.status}: ${errText.substring(0, 200)}`);
          if (response.status === 404) break; // skip model
          if (response.status === 429) {
            await new Promise(r => setTimeout(r, attempt * 5000));
            continue;
          }
          break;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const finishReason = data.candidates?.[0]?.finishReason;
        console.log(`📋 text-to-image [${model}] finishReason: ${finishReason}, parts: ${parts.length}`);

        for (const part of parts) {
          if (part.inlineData) {
            console.log(`✅ Google text-to-image [${model}] success`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
        }
      } catch (err) {
        console.error(`Google text-to-image [${model}] error:`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
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

    console.log(`🖼️ Image generation for: "${productName}"`);
    console.log(`📦 Category: ${category || "General"} | Has source image: ${!!sourceImage}`);

    // Log available API keys
    const hasGoogle = !!Deno.env.get("GOOGLE_AI_STUDIO_KEY");
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
    const hasReplicate = !!Deno.env.get("REPLICATE_API_TOKEN");
    console.log(`🔑 Keys: Google=${hasGoogle}, OpenAI=${hasOpenAI}, Replicate=${hasReplicate}`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (sourceImage) {
      console.log("🤖 SOURCE IMAGE MODE: Google Gemini Edit → OpenAI (GPT-4o+DALL-E) → Original");

      // 1. Google AI Studio (Gemini image edit)
      imageUrl = await tryGoogleAIStudio(sourceImage, productName, category || "");
      if (imageUrl) { usedModel = "gemini-image-edit"; }

      // 2. OpenAI GPT-4o Vision + DALL-E 3
      if (!imageUrl) {
        imageUrl = await tryOpenAIImageEdit(sourceImage, productName, category || "");
        if (imageUrl) { usedModel = "openai-dalle3"; }
      }

      // 3. All AI failed → return original
      if (!imageUrl) {
        console.log("⚠️ All AI providers failed. Returning original source image.");
        return new Response(
          JSON.stringify({
            imageUrl: sourceImage,
            aiModel: "original-preserved",
            message: "Asl rasm saqlandi (AI yaxshilash mavjud emas)"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("🤖 TEXT-TO-IMAGE MODE: Flux Pro → Google Gemini → DALL-E 3");

      // 1. Flux Pro
      imageUrl = await tryFluxPro(productName, category || "");
      if (imageUrl) { usedModel = "flux-pro"; }

      // 2. Google text-to-image
      if (!imageUrl) {
        imageUrl = await tryGoogleTextToImage(productName, category || "");
        if (imageUrl) { usedModel = "gemini-text-to-image"; }
      }

      // 3. DALL-E 3 text-to-image
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
                prompt: `Professional e-commerce product photo of "${productName}". Category: ${category || "General"}. Clean studio background, professional lighting. No text, no watermarks. Photorealistic.`,
                n: 1,
                size: "1024x1792",
                quality: "hd",
                style: "natural"
              }),
            });
            if (dalleRes.ok) {
              const dalleData = await dalleRes.json();
              imageUrl = dalleData.data?.[0]?.url;
              if (imageUrl) { usedModel = "dalle-3-text"; }
            } else {
              const errText = await dalleRes.text();
              console.error("DALL-E 3 text error:", dalleRes.status, errText.substring(0, 200));
            }
          } catch (err) {
            console.error("DALL-E 3 text error:", err);
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

    console.log(`✅ SUCCESS: Image generated with ${usedModel}`);
    return new Response(
      JSON.stringify({ imageUrl, aiModel: usedModel, message: "Image generated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Rasm yaratish xatoligi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
