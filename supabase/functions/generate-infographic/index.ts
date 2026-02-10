import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InfographicRequest {
  productImage: string;
  productName: string;
  category?: string;
  style?: string;
  count?: number;
}

// ==================== INFOGRAPHIC STYLE PROMPTS ====================
// Har bir variatsiya uchun marketplace'ga mos professional infografik prompt
function getInfographicPrompts(productName: string, category: string): string[] {
  const cat = (category || "").toLowerCase();

  // Category-specific background descriptions
  let bgStyle = "clean white gradient";
  let accent = "soft blue";
  let mood = "professional and trustworthy";

  if (cat.includes("kosmetik") || cat.includes("beauty") || cat.includes("go'zallik") || cat.includes("parfum")) {
    bgStyle = "soft pink-to-cream gradient with subtle golden sparkle particles";
    accent = "rose gold";
    mood = "luxurious and feminine";
  } else if (cat.includes("elektron") || cat.includes("phone") || cat.includes("smartfon") || cat.includes("kompyuter") || cat.includes("audio")) {
    bgStyle = "sleek dark charcoal-to-black gradient with subtle blue tech glow";
    accent = "electric blue neon";
    mood = "premium tech and futuristic";
  } else if (cat.includes("kiyim") || cat.includes("fashion") || cat.includes("poyabzal")) {
    bgStyle = "clean off-white to warm beige gradient";
    accent = "warm gold";
    mood = "elegant fashion editorial";
  } else if (cat.includes("sport") || cat.includes("fitness")) {
    bgStyle = "dynamic dark gradient with energetic orange-red accent streaks";
    accent = "fiery orange";
    mood = "powerful and dynamic";
  } else if (cat.includes("bolalar") || cat.includes("kids") || cat.includes("baby") || cat.includes("toy")) {
    bgStyle = "cheerful soft pastel rainbow gradient";
    accent = "bright cheerful";
    mood = "safe, playful, parent-friendly";
  } else if (cat.includes("oziq") || cat.includes("food") || cat.includes("ovqat")) {
    bgStyle = "warm appetizing gradient with subtle wooden texture";
    accent = "warm amber";
    mood = "fresh and appetizing";
  } else if (cat.includes("uy") || cat.includes("maishiy") || cat.includes("texnika") || cat.includes("appliance")) {
    bgStyle = "clean bright white studio with warm ambient glow";
    accent = "clean silver";
    mood = "reliable and professional";
  }

  return [
    // 1. Hero shot — asosiy rasm
    `Edit this product photo into a HERO marketplace listing image:
- Background: ${bgStyle}
- Product centered, fills 75% of frame
- Professional three-point studio lighting
- Subtle shadow beneath for grounding
- ${mood} atmosphere
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Premium marketplace hero shot, 3:4 ratio`,

    // 2. Lifestyle/mood shot
    `Edit this product photo into a LIFESTYLE marketplace image:
- Background: ${bgStyle} with subtle lifestyle elements (soft bokeh, ambient glow)
- Product slightly angled at 15 degrees for dynamic feel
- Warm inviting lighting that creates emotional connection
- ${accent} accent highlights
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Lifestyle mood shot that creates desire to purchase`,

    // 3. Detail/texture focus
    `Edit this product photo to emphasize DETAILS and QUALITY:
- Background: ${bgStyle}
- Bright, even lighting to show every detail clearly
- Enhanced texture visibility — material quality must be obvious
- Slight close-up crop, product fills 85% of frame
- Professional macro-style product photography
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Detail shot showing premium quality and craftsmanship`,

    // 4. Premium angle shot
    `Edit this product photo into a PREMIUM angle marketplace image:
- Background: ${bgStyle}
- Three-quarter angle perspective for 3D depth
- Dramatic rim lighting creating premium silhouette edge
- Sophisticated composition with artistic negative space
- ${accent} subtle light accents
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Premium perspective shot, luxury catalog quality`,

    // 5. Clean catalog shot
    `Edit this product photo into a CLEAN CATALOG image:
- Background: pure white (#FFFFFF) studio background
- Even, shadowless lighting (product photography lightbox style)
- Perfect color accuracy — what you see is what you get
- Product centered with symmetrical composition
- Razor-sharp focus on entire product
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Clean catalog image for marketplace technical requirement`,

    // 6. Dramatic/cinematic shot
    `Edit this product photo into a DRAMATIC marketplace image:
- Background: ${bgStyle} with dramatic lighting contrast
- Cinematic lighting — strong key light, deep shadows for drama
- ${accent} rim light creating stunning edge highlight
- Product looks premium, desirable, must-have
- Slight vignette effect for focus
- KEEP product EXACTLY identical
Product: "${productName}"
Output: Cinematic hero image that stops scrolling and drives sales`,
  ];
}

// ==================== LOVABLE AI — PRIMARY ====================
async function generateWithLovableAI(
  productImage: string,
  prompt: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
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
            { type: "image_url", image_url: { url: productImage } }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Lovable AI error: ${res.status} ${errText.substring(0, 200)}`);
      if (res.status === 429) return null; // rate limited
      if (res.status === 402) return null; // credits exhausted
      return null;
    }

    const data = await res.json();
    const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (img) {
      console.log("✅ Lovable AI infographic generated");
      return img;
    }
    return null;
  } catch (err) {
    console.error("Lovable AI infographic error:", err);
    return null;
  }
}

// ==================== GOOGLE AI STUDIO — SECONDARY ====================
async function generateWithGoogle(
  productImage: string,
  prompt: string
): Promise<string | null> {
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_STUDIO_KEY");
  if (!GOOGLE_KEY) return null;

  let base64Data = productImage;
  let mimeType = "image/jpeg";
  if (productImage.startsWith("data:")) {
    const match = productImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) { mimeType = match[1]; base64Data = match[2]; }
  }

  try {
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
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (err) {
    console.error("Google infographic error:", err);
    return null;
  }
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: InfographicRequest = await req.json();
    const { productImage, productName, category = "", count = 1 } = request;

    if (!productImage) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎨 Generating ${count} infographic(s) for: "${productName}" [${category}]`);
    console.log(`🤖 AI Priority: Lovable AI (Gemini Image Edit) → Google AI Studio`);

    const prompts = getInfographicPrompts(productName, category);
    const results: any[] = [];
    let usedModel = "lovable-ai";

    for (let i = 0; i < Math.min(count, 6); i++) {
      const prompt = prompts[i % prompts.length];
      console.log(`📸 Infographic ${i + 1}/${count}...`);

      // PRIMARY: Lovable AI
      let imageUrl = await generateWithLovableAI(productImage, prompt);
      if (imageUrl) {
        usedModel = "lovable-gemini-edit";
      }

      // SECONDARY: Google AI Studio
      if (!imageUrl) {
        imageUrl = await generateWithGoogle(productImage, prompt);
        if (imageUrl) usedModel = "google-gemini-edit";
      }

      if (imageUrl) {
        results.push({
          url: imageUrl,
          id: `infographic-${Date.now()}-${i}`,
          style: ["hero", "lifestyle", "detail", "premium", "catalog", "dramatic"][i % 6],
          variation: `Variation ${i + 1}`,
        });
        console.log(`✅ Infographic ${i + 1} ready (${usedModel})`);
      } else {
        console.log(`⚠️ Infographic ${i + 1} failed`);
      }

      // Delay between requests to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`🎉 Generated ${results.length}/${count} infographics`);

    return new Response(
      JSON.stringify({
        images: results,
        aiModel: usedModel,
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
