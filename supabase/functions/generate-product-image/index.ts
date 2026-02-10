import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== CATEGORY-SPECIFIC PROMPTS ====================
// Marketplace reglamentiga mos, kategoriyaga qarab professional prompt
function getCategoryPrompt(productName: string, category: string): string {
  const cat = (category || "").toLowerCase();

  // Kosmetika & Go'zallik
  if (cat.includes("go'zallik") || cat.includes("kosmetik") || cat.includes("parfum") || cat.includes("beauty") || cat.includes("cosmetic") || cat.includes("cream") || cat.includes("shampoo")) {
    return `Edit this product photo for a premium beauty/cosmetics marketplace listing:
1. REMOVE the background completely
2. Place the product on a soft pink-to-white gradient studio background
3. Add soft golden hour lighting from the upper-left
4. Add subtle light reflections on glossy surfaces of the product
5. Add a very faint shadow beneath for grounding
6. If the product has a cap/lid, make sure it's clearly visible
7. Enhance color vibrancy slightly — make packaging colors pop
8. KEEP the product EXACTLY identical — same shape, label, text, colors
Product: "${productName}"
Style: Luxury beauty brand advertisement, Sephora/L'Oreal level quality`;
  }

  // Elektronika & Smartfonlar
  if (cat.includes("elektron") || cat.includes("smartfon") || cat.includes("telefon") || cat.includes("phone") || cat.includes("kompyuter") || cat.includes("laptop") || cat.includes("planshet") || cat.includes("audio") || cat.includes("naushnik")) {
    return `Edit this product photo for a premium electronics marketplace listing:
1. REMOVE the background completely
2. Place on a sleek dark-to-charcoal gradient background with subtle blue ambient light
3. Add dramatic rim lighting (thin bright edge highlight) around the product
4. Add a subtle reflection on a dark glossy surface beneath
5. Enhance screen brightness if the device has a screen
6. Make metal/glass surfaces look pristine and premium
7. KEEP the product EXACTLY identical — same design, buttons, ports, logos
Product: "${productName}"
Style: Apple/Samsung flagship device launch photo, premium tech photography`;
  }

  // Kiyim-kechak & Poyabzal
  if (cat.includes("kiyim") || cat.includes("poyabzal") || cat.includes("oyoq") || cat.includes("clothes") || cat.includes("shoe") || cat.includes("fashion") || cat.includes("ko'ylak") || cat.includes("shim")) {
    return `Edit this product photo for a fashion marketplace listing:
1. REMOVE the background completely
2. Place on a clean white-to-light-gray gradient background
3. Add soft, diffused natural lighting from above
4. Show fabric/material texture clearly with proper lighting
5. Add a very subtle soft shadow for depth
6. Enhance color accuracy — colors should look true-to-life
7. KEEP the product EXACTLY identical — same pattern, color, stitching, labels
Product: "${productName}"
Style: ZARA/H&M catalog photography, clean fashion editorial`;
  }

  // Oziq-ovqat
  if (cat.includes("oziq") || cat.includes("ovqat") || cat.includes("food") || cat.includes("ichimlik") || cat.includes("drink") || cat.includes("choy") || cat.includes("kofe")) {
    return `Edit this product photo for a food/beverage marketplace listing:
1. REMOVE the background completely
2. Place on a warm, appetizing setting — light wooden surface or warm gradient
3. Add warm, inviting lighting that makes the product look fresh and appetizing
4. If packaging is transparent, enhance visibility of contents inside
5. Add subtle condensation/freshness effect if it's a cold beverage
6. KEEP the product EXACTLY identical — same packaging, labels, branding
Product: "${productName}"
Style: Premium food photography, appetizing and inviting`;
  }

  // Bolalar uchun
  if (cat.includes("bolalar") || cat.includes("o'yinchoq") || cat.includes("kids") || cat.includes("baby") || cat.includes("toy")) {
    return `Edit this product photo for a children's product marketplace listing:
1. REMOVE the background completely
2. Place on a soft, cheerful pastel gradient (light blue, mint, or soft yellow)
3. Add bright, warm lighting that feels safe and playful
4. Make colors vibrant and appealing
5. Add a soft shadow for grounding
6. KEEP the product EXACTLY identical — same colors, shapes, details
Product: "${productName}"
Style: Safe, bright, parent-friendly product photography`;
  }

  // Uy-ro'zg'or & Maishiy texnika
  if (cat.includes("uy") || cat.includes("maishiy") || cat.includes("texnika") || cat.includes("appliance") || cat.includes("home") || cat.includes("mebel") || cat.includes("furniture")) {
    return `Edit this product photo for a home appliance marketplace listing:
1. REMOVE the background completely
2. Place on a clean white studio background with subtle warm ambient light
3. Add professional three-point studio lighting
4. Show the product's size and form clearly
5. Add subtle reflection on a clean surface beneath
6. KEEP the product EXACTLY identical — same controls, panels, finish
Product: "${productName}"
Style: Professional home appliance catalog, clean and trustworthy`;
  }

  // Sport & Fitness
  if (cat.includes("sport") || cat.includes("fitness") || cat.includes("trenirovka")) {
    return `Edit this product photo for a sports/fitness marketplace listing:
1. REMOVE the background completely
2. Place on a dynamic gradient (dark gray to energetic blue/orange accent)
3. Add dramatic lighting with energy feel
4. Enhance textures — grip, fabric weave, rubber treads
5. KEEP the product EXACTLY identical
Product: "${productName}"
Style: Nike/Adidas campaign photography, dynamic and powerful`;
  }

  // Default — universal professional
  return `Edit this product photo for a professional e-commerce marketplace listing:
1. REMOVE the background completely
2. Place on a clean white-to-light-gray gradient studio background
3. Add professional three-point studio lighting (key, fill, rim)
4. Add a subtle natural shadow beneath for depth
5. Enhance sharpness and color accuracy
6. KEEP the product EXACTLY identical — do NOT change, distort, or recreate the product
Product: "${productName}", Category: "${category}"
Style: Premium marketplace listing, Uzum Market / Yandex Market quality standard`;
}

// ==================== 1. LOVABLE AI (Gemini Image Edit) — PRIMARY ====================
async function tryLovableAI(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ LOVABLE_API_KEY not set");
    return null;
  }

  const prompt = getCategoryPrompt(productName, category);

  // Try both models
  const models = ["google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"];

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🎨 LOVABLE AI [${model}] attempt ${attempt}/2`);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: sourceImage } }
              ]
            }],
            modalities: ["image", "text"]
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Lovable AI [${model}] HTTP ${res.status}: ${errText.substring(0, 200)}`);
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, attempt * 5000));
            continue;
          }
          if (res.status === 402) {
            console.log("❌ Lovable AI credits exhausted");
            break;
          }
          continue;
        }

        const data = await res.json();
        const editedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (editedImage) {
          console.log(`✅ Lovable AI [${model}]: Product image edited successfully!`);
          return editedImage;
        }

        console.log(`⚠️ Lovable AI [${model}]: No image in response`);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error(`Lovable AI [${model}] error:`, err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  return null;
}

// ==================== 2. GOOGLE AI STUDIO — SECONDARY ====================
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

  let base64Data = sourceImage;
  let mimeType = "image/jpeg";
  if (sourceImage.startsWith("data:")) {
    const match = sourceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  const prompt = getCategoryPrompt(productName, category);
  const models = ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash"];

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🎨 GOOGLE [${model}] attempt ${attempt}/3`);

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
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
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
          if (response.status === 404) break;
          break;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const finishReason = data.candidates?.[0]?.finishReason;

        for (const part of parts) {
          if (part.inlineData) {
            console.log(`✅ Google [${model}]: Image edited!`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }

        if (finishReason === "IMAGE_OTHER" || finishReason === "SAFETY") {
          console.log(`⚠️ [${model}] rejected (${finishReason}), retrying...`);
          await new Promise(r => setTimeout(r, attempt * 3000));
          continue;
        }

        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
      } catch (err) {
        console.error(`Google [${model}] error:`, err);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  return null;
}

// ==================== 3. OPENAI GPT-4o + DALL-E 3 — FALLBACK ====================
async function tryOpenAI(
  sourceImage: string,
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return null;

  try {
    console.log("🎨 OPENAI: GPT-4o Vision → DALL-E 3...");

    // Step 1: Describe the product in extreme detail
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `You are a professional product photographer. Describe this product in EXTREME visual detail for exact recreation. Include: exact colors (with hex codes if possible), precise shape and proportions, material textures, brand markings/logos/text on product, packaging details, every visual element. Product: "${productName}", Category: ${category}. Return ONLY the visual description, nothing else.` },
            { type: "image_url", image_url: { url: sourceImage, detail: "high" } }
          ]
        }],
        max_tokens: 800
      }),
    });

    if (!visionRes.ok) return null;

    const visionData = await visionRes.json();
    const desc = visionData.choices?.[0]?.message?.content;
    if (!desc) return null;

    console.log("📝 Product described:", desc.substring(0, 120));

    // Step 2: Generate with DALL-E using category-specific background
    const catLower = (category || "").toLowerCase();
    let bgInstruction = "clean white studio background with professional three-point lighting";
    if (catLower.includes("elektron") || catLower.includes("phone") || catLower.includes("tech")) {
      bgInstruction = "sleek dark gradient background with subtle blue ambient rim lighting, premium tech photography";
    } else if (catLower.includes("kosmetik") || catLower.includes("beauty") || catLower.includes("go'zallik")) {
      bgInstruction = "soft pink-to-white gradient with golden hour lighting, luxury beauty advertisement";
    } else if (catLower.includes("sport") || catLower.includes("fitness")) {
      bgInstruction = "dynamic dark gradient with energetic accent lighting";
    }

    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `EXACT photorealistic product photo. ${desc}. Background: ${bgInstruction}. Product must match the description EXACTLY — same colors, shape, labels, logos. Professional e-commerce listing quality. 3:4 portrait ratio. NO text overlays, NO watermarks, NO humans. Ultra-realistic commercial photography.`,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        style: "natural"
      }),
    });

    if (!dalleRes.ok) return null;

    const dalleData = await dalleRes.json();
    const imageUrl = dalleData.data?.[0]?.url;
    if (imageUrl) {
      console.log("✅ OpenAI DALL-E 3: Product image generated!");
      return imageUrl;
    }
  } catch (err) {
    console.error("OpenAI pipeline error:", err);
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
    const { productName, category, sourceImage } = body;

    if (!productName || typeof productName !== "string") {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Image generation for: "${productName}"`);
    console.log(`📦 Category: ${category || "General"} | Has source image: ${!!sourceImage}`);

    const hasLovable = !!Deno.env.get("LOVABLE_API_KEY");
    const hasGoogle = !!Deno.env.get("GOOGLE_AI_STUDIO_KEY");
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
    console.log(`🔑 Keys: Lovable=${hasLovable}, Google=${hasGoogle}, OpenAI=${hasOpenAI}`);

    let imageUrl: string | null = null;
    let usedModel = "unknown";

    if (sourceImage) {
      console.log("🤖 SOURCE IMAGE MODE: Lovable AI → Google Gemini → OpenAI → Original");

      // 1. Lovable AI (Gemini Image Edit) — BEST for actual image editing
      imageUrl = await tryLovableAI(sourceImage, productName, category || "");
      if (imageUrl) usedModel = "lovable-gemini-edit";

      // 2. Google AI Studio direct
      if (!imageUrl) {
        imageUrl = await tryGoogleAIStudio(sourceImage, productName, category || "");
        if (imageUrl) usedModel = "google-gemini-edit";
      }

      // 3. OpenAI GPT-4o + DALL-E 3
      if (!imageUrl) {
        imageUrl = await tryOpenAI(sourceImage, productName, category || "");
        if (imageUrl) usedModel = "openai-dalle3";
      }

      // 4. All failed → return original
      if (!imageUrl) {
        console.log("⚠️ All AI providers failed. Returning original.");
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
      // TEXT-TO-IMAGE mode (no source image)
      console.log("🤖 TEXT-TO-IMAGE MODE: Lovable AI → Google → DALL-E 3");

      // 1. Lovable AI text-to-image
      const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_KEY) {
        try {
          const prompt = getCategoryPrompt(productName, category || "");
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: `Create a professional e-commerce product photo of "${productName}" (${category || "general"}). Clean studio background, professional lighting. No text, no watermarks. Photorealistic.` }],
              modalities: ["image", "text"]
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (img) { imageUrl = img; usedModel = "lovable-gemini-generate"; }
          }
        } catch (err) {
          console.error("Lovable AI text-to-image error:", err);
        }
      }

      // 2. DALL-E 3 text-to-image
      if (!imageUrl) {
        const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
        if (OPENAI_KEY) {
          try {
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
              if (imageUrl) usedModel = "dalle-3-text";
            }
          } catch (err) {
            console.error("DALL-E 3 text error:", err);
          }
        }
      }
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image generation failed", aiModel: "none" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Image ready with ${usedModel}`);

    return new Response(
      JSON.stringify({ imageUrl, aiModel: usedModel, message: "Image generated successfully" }),
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
