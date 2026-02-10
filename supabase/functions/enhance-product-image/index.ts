import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== CATEGORY-SPECIFIC EDIT PROMPT ====================
function getEditPrompt(productName: string, category: string): string {
  const cat = (category || "").toLowerCase();

  if (cat.includes("kosmetik") || cat.includes("beauty") || cat.includes("go'zallik") || cat.includes("parfum")) {
    return `Edit this product photo for a premium beauty marketplace listing:
- REMOVE background → soft pink-to-white gradient with subtle golden particles
- Add luxury beauty photography lighting (soft, warm, flattering)
- Enhance packaging colors and glossy reflections
- KEEP product EXACTLY identical
Product: "${productName}"`;
  }

  if (cat.includes("elektron") || cat.includes("phone") || cat.includes("smartfon") || cat.includes("kompyuter") || cat.includes("audio")) {
    return `Edit this product photo for a premium tech marketplace listing:
- REMOVE background → sleek dark gradient with subtle blue ambient glow
- Add dramatic rim lighting around product edges
- Enhance screen brightness and metal/glass reflections
- KEEP product EXACTLY identical
Product: "${productName}"`;
  }

  if (cat.includes("kiyim") || cat.includes("fashion") || cat.includes("poyabzal")) {
    return `Edit this product photo for a fashion marketplace listing:
- REMOVE background → clean white-to-light-gray gradient
- Add soft diffused lighting showing fabric texture
- True-to-life color accuracy
- KEEP product EXACTLY identical
Product: "${productName}"`;
  }

  return `Edit this product photo for a professional e-commerce listing:
- REMOVE background → clean white studio gradient
- Add professional three-point studio lighting
- Add subtle shadow beneath for depth
- Enhance sharpness and color accuracy
- KEEP product EXACTLY identical
Product: "${productName}", Category: "${category}"`;
}

// ==================== 1. LOVABLE AI — PRIMARY ====================
async function enhanceWithLovableAI(
  imageBase64: string,
  productName: string,
  category: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const prompt = getEditPrompt(productName, category);

  try {
    console.log("🎨 PRIMARY: Lovable AI (Gemini Image Edit)...");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!res.ok) {
      console.error("Lovable AI error:", res.status);
      return null;
    }

    const data = await res.json();
    const editedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (editedImage) {
      console.log("✅ Lovable AI image editing successful");
      return editedImage;
    }
    return null;
  } catch (err) {
    console.error("Lovable AI error:", err);
    return null;
  }
}

// ==================== 2. GOOGLE AI STUDIO — SECONDARY ====================
async function enhanceWithGoogle(
  imageBase64: string,
  productName: string,
  category: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) return null;

  let base64Data = imageBase64;
  let mimeType = "image/jpeg";
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) { mimeType = match[1]; base64Data = match[2]; }
  }

  const prompt = getEditPrompt(productName, category);

  try {
    console.log("🎨 SECONDARY: Google AI Studio (Gemini)...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GOOGLE_KEY}`,
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

    if (!response.ok) return null;

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        console.log("✅ Google AI Studio image editing successful");
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (err) {
    console.error("Google AI Studio error:", err);
    return null;
  }
}

// ==================== 3. DALL-E 3 — FALLBACK ====================
async function enhanceWithDallE(
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return null;

  try {
    console.log("🎨 FALLBACK: DALL-E 3...");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Professional e-commerce product photo of "${productName}". ${category ? `Category: ${category}.` : ""} Clean studio background, professional lighting, no text, no watermarks. Photorealistic.`,
        n: 1,
        size: "1024x1792",
        quality: "hd",
        style: "natural"
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl) {
      console.log("✅ DALL-E 3 fallback successful");
      return imageUrl;
    }
    return null;
  } catch (err) {
    console.error("DALL-E error:", err);
    return null;
  }
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { imageBase64, productName, category } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (imageBase64.length > 14000000) {
      return new Response(
        JSON.stringify({ error: "Image too large" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Enhancing product image for user ${user.id}`);
    console.log(`📦 Product: ${productName?.slice(0, 50)}, Category: ${category?.slice(0, 30)}`);
    console.log(`🤖 AI Priority: Lovable AI → Google AI Studio → DALL-E 3`);

    let enhancedImage: string | null = null;
    let usedModel = "none";

    // 1. Lovable AI
    enhancedImage = await enhanceWithLovableAI(imageBase64, productName || "Product", category || "default");
    if (enhancedImage) usedModel = "lovable-gemini-edit";

    // 2. Google AI Studio
    if (!enhancedImage) {
      enhancedImage = await enhanceWithGoogle(imageBase64, productName || "Product", category || "default");
      if (enhancedImage) usedModel = "google-gemini-edit";
    }

    // 3. DALL-E 3
    if (!enhancedImage) {
      enhancedImage = await enhanceWithDallE(productName || "Product", category || "");
      if (enhancedImage) usedModel = "dall-e-3";
    }

    if (!enhancedImage) {
      return new Response(
        JSON.stringify({ error: "Image enhancement failed. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Image enhanced with ${usedModel}`);

    return new Response(
      JSON.stringify({
        enhancedImageBase64: enhancedImage,
        aiModel: usedModel,
        message: "Image enhanced successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Image enhancement failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
