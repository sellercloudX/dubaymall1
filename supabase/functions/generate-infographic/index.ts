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
  pinterestDesignPrompts?: { prompt: string; referenceImage?: string; style: string }[];
  usePinterestDesigns?: boolean;
}

// ==================== INFOGRAPHIC STYLE PROMPTS ====================
// Har bir variatsiya uchun marketplace'ga mos professional infografik prompt
function getInfographicPrompts(productName: string, category: string): string[] {
  const cat = (category || "").toLowerCase();

  // Category-specific professional configurations
  let bgStyle = "clean white-to-light-gray gradient studio";
  let accent = "soft neutral";
  let mood = "professional marketplace listing, clean and trustworthy";
  let extraInstruction = "";

  if (cat.includes("kosmetik") || cat.includes("beauty") || cat.includes("go'zallik") || cat.includes("parfum") || cat.includes("cream") || cat.includes("makeup")) {
    bgStyle = "luxurious rose-gold to champagne gradient with subtle golden bokeh particles floating in background, marble surface beneath";
    accent = "rose gold metallic shimmer, warm golden rim light";
    mood = "Sephora/Charlotte Tilbury luxury beauty campaign, editorial cosmetics photography";
    extraInstruction = "Show texture/shimmer of the product packaging. Emphasize premium brand feel.";
  } else if (cat.includes("elektron") || cat.includes("phone") || cat.includes("smartfon") || cat.includes("kompyuter") || cat.includes("audio") || cat.includes("tech") || cat.includes("gadget")) {
    bgStyle = "ultra-sleek dark gradient (#080810 to #1a1a2e) with subtle electric blue ambient light rays, polished reflective dark surface";
    accent = "electric blue neon edge glow, holographic prismatic light leak";
    mood = "Apple/Samsung flagship product launch, cutting-edge premium tech showcase";
    extraInstruction = "Show reflections on the surface. Make the device look futuristic and desirable.";
  } else if (cat.includes("kiyim") || cat.includes("fashion") || cat.includes("poyabzal") || cat.includes("shoes") || cat.includes("sumka") || cat.includes("bag")) {
    bgStyle = "warm off-white to cream gradient with subtle linen texture overlay, natural diffused window lighting";
    accent = "warm gold accent lines, editorial fashion composition";
    mood = "ZARA/COS catalog photography, minimalist Scandinavian fashion editorial";
    extraInstruction = "Show fabric texture and stitching quality. Use natural light feel.";
  } else if (cat.includes("sport") || cat.includes("fitness") || cat.includes("velosiped")) {
    bgStyle = "high-contrast dark gradient with dynamic orange-to-red energy streaks and motion blur accents";
    accent = "fiery orange rim lighting with speed-line energy effects";
    mood = "Nike/Adidas performance campaign, explosive dynamic energy";
    extraInstruction = "Add sense of motion and energy. Product should feel powerful.";
  } else if (cat.includes("bolalar") || cat.includes("kids") || cat.includes("baby") || cat.includes("toy") || cat.includes("o'yinchoq")) {
    bgStyle = "cheerful soft pastel gradient (light sky blue to mint to soft yellow) with playful confetti dots and star shapes";
    accent = "bright cheerful primary colors, playful rounded shapes";
    mood = "premium children's brand like Mothercare/LEGO, safe and joyful";
    extraInstruction = "Make it feel safe, bright, and fun. Parents should feel confident about quality.";
  } else if (cat.includes("oziq") || cat.includes("food") || cat.includes("ovqat") || cat.includes("drink") || cat.includes("ichimlik")) {
    bgStyle = "warm appetizing gradient with rustic wooden board surface, fresh herbs/ingredients scattered artfully";
    accent = "warm amber glow, steam/freshness visual cues";
    mood = "premium food photography, restaurant-quality presentation, appetizing";
    extraInstruction = "Make the food/drink look fresh, appetizing, and premium. Add freshness cues.";
  } else if (cat.includes("uy") || cat.includes("maishiy") || cat.includes("texnika") || cat.includes("appliance") || cat.includes("mebel")) {
    bgStyle = "clean bright Scandinavian interior-inspired gradient, warm white with subtle wood accents";
    accent = "clean metallic silver/chrome highlights, warm ambient glow";
    mood = "IKEA/Dyson product showcase, reliable and modern home design";
    extraInstruction = "Show the product in a modern home context. Emphasize sleek design.";
  } else if (cat.includes("avtomobil") || cat.includes("car") || cat.includes("motor")) {
    bgStyle = "dark carbon fiber textured gradient with metallic blue accent lighting";
    accent = "chrome metallic highlights, automotive grade finish";
    mood = "premium automotive accessories catalog, performance and reliability";
    extraInstruction = "Emphasize durability and precision engineering.";
  }

  return [
    // 1. Hero shot — main marketplace listing image
    `You are a world-class product photographer creating PREMIUM MARKETPLACE LISTING images.
Edit this product photo:
- Background: ${bgStyle}
- Product perfectly centered, fills 70-80% of frame
- Professional three-point studio lighting (key, fill, rim)
- Subtle realistic shadow and reflection beneath for grounding
- ${mood} atmosphere
- ${accent}
- ${extraInstruction}
- CRITICAL: Keep the product 100% IDENTICAL — same brand, color, shape, every detail unchanged
- NO text, NO watermarks, NO labels, NO badges overlaid on the image
Product: "${productName}"
Output: Premium hero marketplace listing image, 3:4 aspect ratio, ultra-sharp 4K quality`,

    // 2. Lifestyle/mood shot
    `You are a luxury brand photographer creating LIFESTYLE MARKETPLACE images.
Edit this product photo:
- Background: ${bgStyle} with subtle lifestyle context (soft bokeh, ambient glow, aspirational elements)
- Product at slight 10-15 degree angle for dynamic dimensional feel
- Warm cinematic lighting creating emotional desire and connection
- ${accent}
- ${extraInstruction}
- CRITICAL: Product must be 100% IDENTICAL to the original — same brand, color, shape
- NO text, NO watermarks, NO overlays
Product: "${productName}"
Output: Aspirational lifestyle shot that creates immediate desire to purchase`,

    // 3. Detail/texture close-up
    `You are a luxury brand macro photographer showing PREMIUM QUALITY and CRAFTSMANSHIP.
Edit this product photo to emphasize fine details:
- Background: ${bgStyle}
- Bright, even studio lighting revealing every texture and material quality
- Slight close-up crop, product fills 85-90% of frame
- Enhanced texture visibility — material quality, stitching, finish must be crystal clear
- ${accent}
- ${extraInstruction}
- CRITICAL: Product must be 100% IDENTICAL — same brand, color, shape
- NO text, NO watermarks, NO overlays
Product: "${productName}"
Output: Detail quality shot showing premium craftsmanship, macro studio photography`,

    // 4. Premium 3D angle
    `You are an award-winning product photographer creating PREMIUM ANGLE SHOWCASE images.
Edit this product photo:
- Background: ${bgStyle}
- Three-quarter angle perspective showing beautiful 3D depth and volume
- Dramatic rim lighting creating stunning silhouette edge highlight
- Sophisticated composition with strategic negative space
- ${accent}
- ${extraInstruction}
- CRITICAL: Product must be 100% IDENTICAL — same brand, color, shape
- NO text, NO watermarks, NO overlays
Product: "${productName}"
Output: Premium perspective shot, luxury catalog quality with cinematic depth`,

    // 5. Clean white catalog (marketplace technical requirement)
    `You are a professional e-commerce photographer creating CLEAN CATALOG images.
Edit this product photo:
- Background: pure white (#FFFFFF) studio background, no shadows, no gradients
- Even, diffused lightbox-style lighting for perfect color accuracy
- Product perfectly centered with symmetrical composition
- Razor-sharp focus on entire product, what-you-see-is-what-you-get accuracy
- CRITICAL: Product must be 100% IDENTICAL — same brand, color, shape
- NO text, NO watermarks, NO overlays, NO artistic effects
Product: "${productName}"
Output: Clean white-background catalog image meeting marketplace technical requirements`,

    // 6. Cinematic dramatic hero
    `You are a cinematic advertising photographer creating SCROLL-STOPPING marketplace hero images.
Edit this product photo:
- Background: ${bgStyle} with dramatic cinematic lighting contrast
- Strong key light with deep artistic shadows for drama and impact
- ${accent} creating stunning edge highlight and volumetric glow
- Product looks premium, desirable, must-have — scroll-stopping impact
- Subtle cinematic vignette for focus
- ${extraInstruction}
- CRITICAL: Product must be 100% IDENTICAL — same brand, color, shape
- NO text, NO watermarks, NO overlays
Product: "${productName}"
Output: Cinematic hero image that stops scrolling and drives immediate purchase, advertising-quality`,
  ];
}

// ==================== LOVABLE AI — PRIMARY (High Quality) ====================
async function generateWithLovableAI(
  productImage: string,
  prompt: string,
  useHighQuality: boolean = true
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  // Use Pro model for high quality, Flash for speed
  const model = useHighQuality ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image";

  try {
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
            { type: "image_url", image_url: { url: productImage } }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Lovable AI error (${model}): ${res.status} ${errText.substring(0, 200)}`);
      if (res.status === 429 || res.status === 402) {
        // Rate limited or credits exhausted — try fallback model
        if (useHighQuality) {
          console.log("⚠️ Pro model unavailable, falling back to Flash...");
          return generateWithLovableAI(productImage, prompt, false);
        }
        return null;
      }
      return null;
    }

    const data = await res.json();
    const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (img) {
      console.log(`✅ Infographic generated with ${model}`);
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

// ==================== PINTEREST REFERENCE — MULTI-IMAGE EDIT ====================
async function generateWithPinterestReference(
  productImage: string,
  referenceImage: string,
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
            { type: "text", text: `Use the FIRST image as the design style/layout REFERENCE from Pinterest marketplace cards. Apply that card design style to the SECOND image (the actual product). ${prompt}. CRITICAL: Keep the product in the second image EXACTLY identical — only change background, lighting, layout and composition to match the Pinterest reference style.` },
            { type: "image_url", image_url: { url: referenceImage } },
            { type: "image_url", image_url: { url: productImage } }
          ]
        }],
        modalities: ["image", "text"]
      }),
    });

    if (!res.ok) {
      console.error(`Pinterest ref generation failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (img) {
      console.log("✅ Pinterest-enhanced infographic generated");
      return img;
    }
    return null;
  } catch (err) {
    console.error("Pinterest reference generation error:", err);
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
    const { productImage, productName, category = "", count = 1, pinterestDesignPrompts, usePinterestDesigns } = request;

    if (!productImage) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasPinterest = usePinterestDesigns && pinterestDesignPrompts && pinterestDesignPrompts.length > 0;
    console.log(`🎨 Generating ${count} infographic(s) for: "${productName}" [${category}]`);
    console.log(`🤖 AI Priority: Lovable AI (Gemini Image Edit) → Google AI Studio`);
    if (hasPinterest) {
      console.log(`📌 Pinterest design reference: ${pinterestDesignPrompts.length} prompts available`);
    }

    // Use Pinterest-enhanced prompts if available, otherwise fallback to built-in
    const prompts = hasPinterest
      ? pinterestDesignPrompts.map(p => p.prompt)
      : getInfographicPrompts(productName, category);
    
    // Pinterest reference images for multi-image edit
    const referenceImages = hasPinterest
      ? pinterestDesignPrompts.map(p => p.referenceImage).filter(Boolean)
      : [];

    const results: any[] = [];
    let usedModel = "lovable-ai";

    for (let i = 0; i < Math.min(count, 6); i++) {
      const prompt = prompts[i % prompts.length];
      const refImage = referenceImages[i % (referenceImages.length || 1)] as string | undefined;
      console.log(`📸 Infographic ${i + 1}/${count}${refImage ? ' (with Pinterest ref)' : ''}...`);

      // PRIMARY: Lovable AI — with optional Pinterest reference image
      let imageUrl: string | null = null;
      
      if (refImage) {
        // Use Pinterest reference + product image together
        imageUrl = await generateWithPinterestReference(productImage, refImage, prompt);
      }
      
      if (!imageUrl) {
        imageUrl = await generateWithLovableAI(productImage, prompt);
      }
      
      if (imageUrl) {
        usedModel = "lovable-gemini-edit";
      }

      // SECONDARY: Google AI Studio
      if (!imageUrl) {
        imageUrl = await generateWithGoogle(productImage, prompt);
        if (imageUrl) usedModel = "google-gemini-edit";
      }

      if (imageUrl) {
        const styleLabel = hasPinterest 
          ? (pinterestDesignPrompts[i % pinterestDesignPrompts.length]?.style || "pinterest")
          : ["hero", "lifestyle", "detail", "premium", "catalog", "dramatic"][i % 6];
        
        results.push({
          url: imageUrl,
          id: `infographic-${Date.now()}-${i}`,
          style: styleLabel,
          variation: `Variation ${i + 1}`,
          source: hasPinterest ? "pinterest-enhanced" : "standard",
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
        format: "marketplace-optimized",
        pinterestEnhanced: hasPinterest,
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
