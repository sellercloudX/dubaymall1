import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== LOVABLE AI - PRIMARY IMAGE EDITING ====================
// Uses Gemini image model to ACTUALLY EDIT the uploaded image (background removal, quality improvement)
async function enhanceWithLovableAI(
  imageBase64: string,
  productName: string,
  category: string
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log("🎨 PRIMARY: Lovable AI (Gemini Image Edit) - Real image editing...");
    
    const editPrompt = `Edit this product image for professional e-commerce listing:
1. REMOVE the current background completely
2. Replace with a clean, professional white/light gradient studio background
3. KEEP the product EXACTLY the same - do NOT change, distort, or recreate the product
4. Improve lighting: add professional studio lighting (key light, fill, rim light)
5. Add subtle natural shadow beneath the product for depth
6. Enhance color accuracy and sharpness
7. Make it marketplace-ready (Uzum Market / Yandex Market standard)

Product: "${productName}", Category: "${category}"

CRITICAL: The product in the output must be IDENTICAL to the input image. Only change the background and lighting.`;

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
            { type: "text", text: editPrompt },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lovable AI image edit error:", res.status, errText);
      if (res.status === 429) console.log("Rate limited");
      if (res.status === 402) console.log("Credits exhausted");
      return null;
    }

    const data = await res.json();
    const editedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (editedImage) {
      console.log("✅ Lovable AI image editing successful - background removed & enhanced");
      return editedImage;
    }
    
    console.log("⚠️ Lovable AI returned no image");
    return null;
  } catch (err) {
    console.error("Lovable AI image edit error:", err);
    return null;
  }
}

// ==================== FLUX PRO - SECONDARY IMAGE ENHANCEMENT ====================
  productDescription: string,
  category: string,
  style: string
): Promise<string | null> {
  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!REPLICATE_API_TOKEN) {
    console.log("⚠️ REPLICATE_API_TOKEN not configured");
    return null;
  }

  try {
    console.log("🎨 PRIMARY: Using Flux Pro for image enhancement...");
    
    // Category-specific professional styling
    const categoryEnhancements: Record<string, string> = {
      "cosmetics": `soft pink peach gradient background with subtle bokeh, scattered flower petals around product, 
        citrus slices decoration, water droplets for freshness, soft glow and golden particles, 
        beauty product photography lighting, luxury cosmetic advertisement style`,
      
      "electronics": `dark gradient blue black background with tech glow effects, light trails around product,
        subtle circuit pattern reflections, dramatic side lighting, neon blue accents,
        premium tech product photography, flagship device presentation style`,
      
      "clothing": `clean studio backdrop, soft natural lighting, fashion editorial feel,
        subtle fabric texture visible, elegant shadows for depth, lookbook style presentation,
        professional fashion photography, runway quality lighting`,
      
      "food": `warm appetizing setting, wooden surface texture, natural window lighting,
        fresh ingredient props around product, steam effect for warm items, water droplets for freshness,
        food photography styling, appetizing warm color grading`,
      
      "home": `cozy home interior background, natural light from window, complementary decor elements,
        lifestyle photography feel, warm inviting atmosphere, catalog style presentation,
        interior design magazine quality`,
      
      "default": `clean gradient studio background, professional product photography lighting,
        soft shadows beneath product, subtle reflections, elegant platform surface,
        premium e-commerce presentation, marketplace listing ready`
    };

    const enhancement = categoryEnhancements[category.toLowerCase()] || categoryEnhancements["default"];

    // ULTRA-PROFESSIONAL FLUX PRO ENHANCEMENT PROMPT
    const fluxPrompt = `PROFESSIONAL E-COMMERCE PRODUCT PHOTOGRAPHY ENHANCEMENT.

PRODUCT: "${productName}"
${productDescription ? `DESCRIPTION: ${productDescription}` : ""}
CATEGORY: ${category || "General"}

ENHANCEMENT REQUIREMENTS:
${enhancement}

COMPOSITION:
- Product centered and prominent, fills 70-80% of frame
- Professional studio lighting setup (key light, fill light, rim light)
- Soft natural shadows for depth and grounding
- Clean crisp product edges with perfect focus
- Premium marketplace presentation quality

TECHNICAL SPECIFICATIONS:
- Ultra high resolution, 8K quality details
- Perfect color accuracy and white balance
- Ready for Uzum Market / Yandex Market listing
- 3:4 portrait aspect ratio (1080x1440 pixels)
- Commercial photography quality

ABSOLUTE RESTRICTIONS:
- NO text, watermarks, logos, labels, or prices
- NO people, hands, or body parts visible
- NO cluttered or distracting backgrounds
- NO unrealistic colors or over-saturation
- The product itself must look EXACTLY realistic

OUTPUT: Premium marketplace-ready product photograph.`;

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
    console.log("📤 Flux Pro enhancement started:", prediction.id);

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
      console.log("✅ Flux Pro enhancement completed successfully");
      return imageUrl;
    }

    console.error("Flux Pro enhancement failed:", result.error || "Unknown error");
    return null;
  } catch (err) {
    console.error("Flux Pro enhancement error:", err);
    return null;
  }
}

// ==================== DALL-E 3 - FALLBACK ====================
async function enhanceWithDallE(
  productName: string,
  category: string
): Promise<string | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.log("⚠️ OPENAI_API_KEY not configured for fallback");
    return null;
  }

  try {
    console.log("🎨 FALLBACK: Using DALL-E 3 for enhancement...");
    
    const dallePrompt = `Professional e-commerce product photography of "${productName}".
${category ? `Category: ${category}.` : ""}
Clean studio background, premium lighting, high resolution product photography, 
marketplace listing quality, no text or watermarks, 3:4 portrait ratio.
Ultra realistic, commercial photography quality, ready for premium marketplace.`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
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
    const { imageBase64, productName, productDescription, category } = body;

    // Input validation
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base64 format
    if (!imageBase64.startsWith('data:image/') && !imageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit image size (roughly 10MB base64)
    if (imageBase64.length > 14000000) {
      return new Response(
        JSON.stringify({ error: "Image too large" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (productName && (typeof productName !== 'string' || productName.length > 500)) {
      return new Response(
        JSON.stringify({ error: "Invalid product name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (category && (typeof category !== 'string' || category.length > 100)) {
      return new Response(
        JSON.stringify({ error: "Invalid category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🖼️ Enhancing product image for user ${user.id}`);
    console.log(`📦 Product: ${productName?.slice(0, 50)}, Category: ${category?.slice(0, 30)}`);
    console.log(`🤖 AI Priority: Lovable AI (Gemini Image Edit) → Flux Pro → DALL-E 3`);

    let enhancedImage: string | null = null;
    let usedModel = "flux-pro";

    // PRIMARY: Try Flux Pro first
    enhancedImage = await enhanceWithFluxPro(
      productName || "Product",
      productDescription || "",
      category || "default"
    );

    // FALLBACK: Try DALL-E 3 if Flux Pro fails
    if (!enhancedImage) {
      enhancedImage = await enhanceWithDallE(productName || "Product", category || "");
      if (enhancedImage) usedModel = "dall-e-3";
    }

    if (!enhancedImage) {
      console.error("All AI models failed for image enhancement");
      return new Response(
        JSON.stringify({ error: "Image enhancement failed. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Image enhanced successfully with ${usedModel}`);

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
