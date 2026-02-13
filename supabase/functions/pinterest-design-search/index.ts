import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Category-specific Pinterest search queries for marketplace card designs
const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  // Beauty & Cosmetics
  "kosmetika": ["cosmetic product card design marketplace", "beauty product listing design", "skincare marketplace card layout"],
  "parfum": ["perfume product card design", "fragrance marketplace listing design", "luxury perfume ecommerce card"],
  "beauty": ["beauty product marketplace card design", "cosmetic ecommerce listing layout", "beauty brand product card"],
  
  // Electronics
  "elektronika": ["electronics product card design marketplace", "tech gadget listing design ecommerce", "smartphone product card layout"],
  "phone": ["smartphone product card design", "phone marketplace listing layout", "mobile device ecommerce card"],
  "smartfon": ["smartphone product card design", "mobile phone marketplace listing", "tech product card layout"],
  "kompyuter": ["computer product card marketplace design", "laptop listing design ecommerce", "PC product card layout"],
  "audio": ["headphone product card design", "audio device marketplace listing", "speaker product card layout"],
  
  // Fashion
  "kiyim": ["fashion product card design marketplace", "clothing listing layout ecommerce", "apparel product card design"],
  "poyabzal": ["shoes product card design marketplace", "footwear listing layout ecommerce", "sneaker product card"],
  "fashion": ["fashion marketplace card design", "clothing product listing layout", "style product card ecommerce"],
  
  // Sports
  "sport": ["sports product card design marketplace", "fitness equipment listing layout", "athletic product card design"],
  "fitness": ["fitness product card design", "gym equipment marketplace listing", "workout product card layout"],
  
  // Kids
  "bolalar": ["kids product card design marketplace", "children toy listing layout", "baby product card design"],
  "kids": ["kids toy product card design", "children marketplace listing", "baby product card layout"],
  
  // Food
  "oziq": ["food product card design marketplace", "grocery listing layout", "organic food product card"],
  "food": ["food product card marketplace design", "gourmet listing layout ecommerce", "food brand product card"],
  
  // Home & Appliances
  "uy": ["home product card design marketplace", "furniture listing layout ecommerce", "home decor product card"],
  "texnika": ["home appliance product card design", "kitchen appliance marketplace listing", "household tech product card"],
  "maishiy": ["household product card design marketplace", "home goods listing layout", "domestic product card"],
};

// Build Pinterest-optimized search query
function buildSearchQuery(category: string, productName: string): string {
  const catLower = (category || "").toLowerCase();
  
  // Find matching category keywords
  for (const [key, queries] of Object.entries(CATEGORY_SEARCH_MAP)) {
    if (catLower.includes(key)) {
      // Pick a random query from the category for variety
      return queries[Math.floor(Math.random() * queries.length)];
    }
  }
  
  // Fallback: generic marketplace card design search
  return `${productName} product card design marketplace ecommerce`;
}

// Extract design elements from scraped Pinterest content
function extractDesignInsights(scrapedData: any): any {
  const insights = {
    colorPalettes: [] as string[],
    layoutStyles: [] as string[],
    designElements: [] as string[],
    imageUrls: [] as string[],
    designPrompts: [] as string[],
  };

  // Extract image URLs from the scraped content
  if (scrapedData?.data?.links) {
    insights.imageUrls = scrapedData.data.links
      .filter((link: string) => link.includes("pinimg.com") || link.includes(".jpg") || link.includes(".png"))
      .slice(0, 10);
  }
  
  // Extract from markdown content for design patterns
  const markdown = scrapedData?.data?.markdown || scrapedData?.markdown || "";
  
  // Common marketplace card design patterns found on Pinterest
  const designPatterns = [
    "gradient background with product centered",
    "minimalist white space with accent colors",
    "lifestyle context with blurred background",
    "bold typography with feature highlights",
    "side-by-side before/after comparison",
    "infographic with icons and specifications",
    "premium dark background with golden accents",
    "clean grid layout with product details",
  ];
  
  insights.layoutStyles = designPatterns.slice(0, 4);
  
  return insights;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, productName, count = 5 } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Firecrawl not configured",
          // Return fallback design prompts even without Firecrawl
          fallbackPrompts: getCategoryDesignPrompts(category, productName)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchQuery = buildSearchQuery(category, productName);
    console.log(`🔍 Pinterest search: "${searchQuery}" for category: ${category}`);

    // Step 1: Search Pinterest via Firecrawl
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`;
    
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ["markdown", "links", "screenshot"],
        waitFor: 3000,
        onlyMainContent: true,
      }),
    });

    let pinterestData: any = null;
    let designInsights: any = null;
    let pinterestScreenshot: string | null = null;

    if (scrapeResponse.ok) {
      pinterestData = await scrapeResponse.json();
      designInsights = extractDesignInsights(pinterestData);
      pinterestScreenshot = pinterestData?.data?.screenshot || null;
      console.log(`✅ Pinterest scraped: ${designInsights.imageUrls.length} images found`);
    } else {
      console.warn("Pinterest scrape failed, using fallback prompts");
    }

    // Step 2: Generate enhanced design prompts combining Pinterest insights + category knowledge
    const enhancedPrompts = generateEnhancedDesignPrompts(
      category, 
      productName, 
      designInsights,
      pinterestScreenshot
    );

    console.log(`🎨 Generated ${enhancedPrompts.length} enhanced design prompts`);

    return new Response(
      JSON.stringify({
        success: true,
        searchQuery,
        designInsights,
        pinterestScreenshot,
        enhancedPrompts,
        pinterestImageUrls: designInsights?.imageUrls || [],
        category,
        productName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pinterest search error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        // Always return fallback prompts
        fallbackPrompts: getCategoryDesignPrompts("", "product")
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Category-specific premium design prompts (fallback + base)
function getCategoryDesignPrompts(category: string, productName: string): string[] {
  const cat = (category || "").toLowerCase();
  
  if (cat.includes("kosmetik") || cat.includes("beauty") || cat.includes("parfum") || cat.includes("go'zallik")) {
    return [
      `Transform into a luxury beauty marketplace card: soft rose-gold gradient background, product centered with ethereal glow effect, delicate floral accents, premium serif typography, subtle sparkle particles. Style: Sephora/Charlotte Tilbury product listing. Product: "${productName}"`,
      `Create an elegant beauty editorial card: clean cream-to-blush gradient, product on marble surface, soft natural lighting, minimalist gold text accents, botanical shadow overlay. Style: Glossier/Fenty Beauty. Product: "${productName}"`,
      `Design a premium skincare marketplace card: glass morphism card on pastel gradient, product with dewdrop effects, clean sans-serif typography, ingredient highlight icons, luxurious feel. Style: The Ordinary/Drunk Elephant. Product: "${productName}"`,
    ];
  }
  
  if (cat.includes("elektron") || cat.includes("phone") || cat.includes("smartfon") || cat.includes("tech")) {
    return [
      `Transform into a sleek tech marketplace card: dark gradient (#0a0a0a to #1a1a2e) with electric blue accent glow, product floating with reflection, futuristic grid lines, spec badges with neon borders. Style: Apple Store listing. Product: "${productName}"`,
      `Create a premium tech product card: matte charcoal background, product with dramatic rim lighting, holographic accent shimmer, clean mono font specs, minimalist tech aesthetic. Style: Samsung/OnePlus. Product: "${productName}"`,
      `Design a modern gadget marketplace card: gradient dark-to-teal, product centered with 3D depth shadow, circuit pattern subtle overlay, feature icons with glow effect. Style: Best Buy premium. Product: "${productName}"`,
    ];
  }
  
  if (cat.includes("kiyim") || cat.includes("fashion") || cat.includes("poyabzal")) {
    return [
      `Transform into a fashion editorial marketplace card: warm neutral tone background, product styled with fabric texture visible, elegant thin serif typography, fashion magazine composition. Style: ZARA/H&M product page. Product: "${productName}"`,
      `Create a trendy fashion listing card: clean off-white background, product with styled shadow, color swatch dots, size guide icon, modern sans-serif bold title. Style: ASOS/Farfetch. Product: "${productName}"`,
      `Design a luxury fashion marketplace card: cream gradient, product draped elegantly, golden accent line details, premium brand feeling, editorial photography style. Style: NET-A-PORTER. Product: "${productName}"`,
    ];
  }
  
  if (cat.includes("sport") || cat.includes("fitness")) {
    return [
      `Transform into a dynamic sports marketplace card: energetic dark gradient with orange streaks, product with motion blur effect, bold impact typography, performance stats badges. Style: Nike/Adidas listing. Product: "${productName}"`,
      `Create a powerful fitness product card: dark background with red accent lighting, product with dramatic shadow, athletic icons, motivational composition. Style: Under Armour. Product: "${productName}"`,
      `Design an active lifestyle marketplace card: gradient green-to-dark, product in action context, energy lines, feature badges with sport icons. Style: Decathlon/REI. Product: "${productName}"`,
    ];
  }
  
  if (cat.includes("bolalar") || cat.includes("kids") || cat.includes("baby")) {
    return [
      `Transform into a cheerful kids marketplace card: soft pastel rainbow gradient, product surrounded by playful shapes, rounded friendly typography, safety badge, warm inviting feeling. Style: Mothercare. Product: "${productName}"`,
      `Create a fun children's product card: bright cheerful background with confetti dots, product centered with cute shadow, bubbly font, age-appropriate badge, parent-trust design. Style: Fisher-Price. Product: "${productName}"`,
      `Design a safe baby product marketplace card: gentle cream-mint gradient, product with soft cloud elements, tender sans-serif font, organic/safety certification badges. Style: BabyBjorn. Product: "${productName}"`,
    ];
  }
  
  // Default - universal marketplace card designs
  return [
    `Transform into a premium marketplace product card: clean white-to-light-gray gradient, product professionally lit and centered, modern sans-serif title, price badge with accent color, feature icons row, trust badges at bottom. Style: Amazon Premium listing. Product: "${productName}"`,
    `Create a modern ecommerce product card: subtle gradient background matching product colors, item with professional shadow, specification highlights with icons, clean layout with strong CTA. Style: Wildberries/Uzum top seller. Product: "${productName}"`,
    `Design a conversion-optimized marketplace card: bright white background, product filling 70% frame, benefit bullets with checkmarks, discount badge top-left, delivery estimate badge, professional studio quality. Style: OZON Featured. Product: "${productName}"`,
  ];
}

// Enhanced prompts combining Pinterest insights with category knowledge
function generateEnhancedDesignPrompts(
  category: string, 
  productName: string, 
  insights: any | null,
  pinterestScreenshot: string | null
): { prompt: string; referenceImage?: string; style: string }[] {
  const basePrompts = getCategoryDesignPrompts(category, productName);
  const enhanced: { prompt: string; referenceImage?: string; style: string }[] = [];

  const styles = ["hero", "lifestyle", "detail", "premium", "catalog", "dramatic"];

  for (let i = 0; i < Math.min(basePrompts.length, 6); i++) {
    const entry: { prompt: string; referenceImage?: string; style: string } = {
      prompt: basePrompts[i % basePrompts.length],
      style: styles[i % styles.length],
    };

    // If Pinterest screenshot exists, add it as a design reference
    if (pinterestScreenshot && i === 0) {
      entry.referenceImage = pinterestScreenshot;
      entry.prompt = `Using the Pinterest marketplace card designs shown as visual reference for layout and style inspiration, ${entry.prompt}. IMPORTANT: Keep the actual product EXACTLY identical - only change background, lighting, and composition to match the Pinterest card design style.`;
    }

    // Add Pinterest image URLs as reference context
    if (insights?.imageUrls?.length > 0 && i < insights.imageUrls.length) {
      entry.referenceImage = entry.referenceImage || insights.imageUrls[i];
    }

    enhanced.push(entry);
  }

  // Add 3 more variations with different Pinterest-inspired styles
  const extraStyles = [
    `Create a Pinterest-trending marketplace card: Use current trending card layout (product hero center, gradient overlay, bold price callout, benefit icons strip). Aspect 3:4. Product: "${productName}"`,
    `Design an Etsy/Pinterest inspired artisan product card: handcrafted feel with texture background, warm tones, storytelling composition, lifestyle context. Product: "${productName}"`,
    `Transform into a viral Pinterest product pin: eye-catching vertical card, bold headline, step-by-step benefit icons, social proof stars, CTA button. Product: "${productName}"`,
  ];

  for (let i = 0; i < extraStyles.length; i++) {
    enhanced.push({
      prompt: extraStyles[i],
      style: ["pinterest-hero", "artisan", "viral"][i],
      referenceImage: insights?.imageUrls?.[3 + i] || undefined,
    });
  }

  return enhanced;
}
