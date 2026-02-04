import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InfographicRequest {
  productImage: string; // base64 or URL - ORIGINAL product image from AI Scanner
  productName: string;
  category?: string;
  style?: "professional" | "minimalist" | "vibrant" | "luxury" | "tech";
  backgroundColor?: string;
  count?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: InfographicRequest = await req.json();
    const { productImage, productName, category, style = "professional", count = 1 } = request;

    if (!productImage) {
      return new Response(
        JSON.stringify({ error: "Product image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`🎨 Generating ${count} infographic(s) for: ${productName}`);
    console.log(`📐 Target size: 1080x1440 (Uzum/Yandex marketplace format)`);
    console.log(`🎯 Style: ${style}, Category: ${category || "general"}`);

    // Category-specific background styling (NO TEXT - Zero-Text Policy)
    const categoryBackgrounds: Record<string, string> = {
      "Elektronika": "sleek dark gradient background with subtle blue tech glow effects, premium studio lighting",
      "Smartfonlar": "elegant dark gradient with soft blue/purple ambient lighting, floating reflections",
      "Kiyim-kechak": "soft neutral fabric texture background, fashion editorial lighting, subtle shadows",
      "Go'zallik": "luxurious soft pink/gold bokeh background, beauty product photography lighting",
      "Sport": "dynamic gradient with energy vibes, athletic mood lighting",
      "Uy-ro'zg'or": "warm cozy home interior blur background, natural lighting",
      "Bolalar uchun": "playful soft pastel gradient background, cheerful mood",
      "Kompyuterlar": "professional dark tech background with subtle grid patterns, RGB accents",
      "Audio": "premium dark background with sound wave subtle effects, studio quality",
    };

    const styleBackgrounds: Record<string, string> = {
      professional: "clean white/light gray gradient studio background, professional product photography lighting, soft shadows",
      minimalist: "pure white background, minimal composition, elegant simplicity, premium feel",
      vibrant: "colorful dynamic gradient background, eye-catching energy, bold modern feel",
      luxury: "dark elegant background with golden/warm accents, premium sophisticated lighting",
      tech: "futuristic dark gradient with blue/cyan tech accents, modern digital aesthetic"
    };

    const bgStyle = categoryBackgrounds[category || ""] || styleBackgrounds[style];

    // Generate infographics using Lovable AI image editing
    // This KEEPS the original product and only changes the background/lighting/composition
    const results = [];

    // Enhanced variation prompts - different compositions, zooms, and angles
    // Each variation focuses on different aspects while keeping the EXACT same product
    const variationConfigs = [
      {
        composition: "centered hero composition, product fills 80% of frame, dramatic lighting from above",
        focus: "overall product showcase, full visibility",
        cameraAngle: "straight-on frontal view"
      },
      {
        composition: "slight 15-degree angle, dynamic perspective, product fills 70% of frame",
        focus: "emphasize product depth and dimension",
        cameraAngle: "three-quarter view showing product form"
      },
      {
        composition: "close-up crop focusing on key product details, product fills 90% of frame",
        focus: "highlight textures, materials, and craftsmanship",
        cameraAngle: "macro detail shot"
      },
      {
        composition: "elegant offset composition, product positioned slightly right, negative space on left",
        focus: "premium catalog style, editorial feel",
        cameraAngle: "eye-level elegant angle"
      },
      {
        composition: "dramatic low angle view, product appears powerful and prominent",
        focus: "create impression of quality and importance",
        cameraAngle: "slight upward perspective"
      },
      {
        composition: "clean symmetrical layout, perfectly centered with balanced lighting",
        focus: "professional product photography standard",
        cameraAngle: "direct frontal catalog view"
      }
    ];

    for (let i = 0; i < Math.min(count, 6); i++) {
      try {
        const config = variationConfigs[i % variationConfigs.length];

        const editPrompt = `Transform this product photo into a professional e-commerce marketplace infographic.

ABSOLUTE REQUIREMENTS (MUST FOLLOW):
- Keep the EXACT same product - do NOT change, replace, or alter the product in ANY way
- The product model, shape, color, brand, and ALL details MUST remain 100% identical
- Output size: 1080x1440 pixels (3:4 portrait aspect ratio for Uzum/Yandex marketplace)
- ZERO TEXT on the image - no text, no watermarks, no logos, no labels, no prices

COMPOSITION FOR THIS VARIATION:
- ${config.composition}
- Focus: ${config.focus}
- Camera angle: ${config.cameraAngle}

BACKGROUND & STYLING:
- ${bgStyle}
- Professional e-commerce studio lighting setup
- Soft shadows beneath product for depth and grounding
- Subtle reflections to enhance premium feel
- Clean separation between product and background

QUALITY REQUIREMENTS:
- Ultra high resolution, sharp details
- Professional product photography quality
- Ready for Uzum Market / Yandex Market listing`;

        console.log(`📸 Generating infographic ${i + 1}/${count} - ${config.focus}...`);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: editPrompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: productImage // Original product image from AI Scanner
                    }
                  }
                ]
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Infographic ${i + 1} API error:`, response.status, errorText);
          continue;
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageUrl) {
          results.push({
            url: imageUrl,
            id: `infographic-${i + 1}-${Date.now()}`,
            style: style,
            variation: config.focus,
            composition: config.cameraAngle
          });
          console.log(`✅ Infographic ${i + 1} generated - ${config.cameraAngle}`);
        }

        // Small delay between requests to avoid rate limiting
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (err) {
        console.error(`Error generating infographic ${i + 1}:`, err);
      }
    }

    if (results.length === 0) {
      throw new Error("Failed to generate any infographics");
    }

    console.log(`🎉 Generated ${results.length}/${count} infographics successfully`);

    return new Response(
      JSON.stringify({ 
        images: results,
        aiModel: "gemini-2.5-flash-image",
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
