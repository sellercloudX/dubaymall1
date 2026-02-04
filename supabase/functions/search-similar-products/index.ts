import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductResult {
  title: string;
  price: string;
  image: string;
  source: string;
  url: string;
  description: string;
}

// Search across multiple platforms using web search
async function searchWebForProducts(productName: string, category: string): Promise<ProductResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  // Create comprehensive multi-platform search prompt
  const searchPrompt = `You are an expert e-commerce product researcher. Your task is to find REAL, existing products across multiple online marketplaces.

SEARCH QUERY: "${productName}" ${category ? `in category: ${category}` : ''}

Search and find products from these platforms (prioritize platforms with good product images):
1. **Uzum Market** (uzum.uz) - Uzbekistan's main marketplace
2. **Yandex Market** (market.yandex.ru) - Russian marketplace
3. **Wildberries** (wildberries.ru) - Large Russian marketplace  
4. **Ozon** (ozon.ru) - Russian marketplace
5. **AliExpress** (aliexpress.com/aliexpress.ru) - Chinese marketplace
6. **Kaspi.kz** - Kazakhstan marketplace

IMPORTANT: 
- Find products with HIGH QUALITY product images (professional photos, infographics, white background)
- Include products with multiple good images when possible
- Provide REAL product URLs from these marketplaces
- Include actual prices in local currency (som, rubles, tenge)
- Focus on products that are identical or very similar to the search query

Return EXACTLY 8-10 products in this JSON format (NO other text, just JSON array):
[
  {
    "title": "Exact product name as shown on marketplace",
    "price": "price with currency symbol (e.g., '45 000 сум', '2 500 ₽', '$15.99')",
    "image": "direct URL to the main product image (must be https://)",
    "source": "Platform name (Uzum Market, Yandex Market, Wildberries, Ozon, AliExpress, Kaspi)",
    "url": "Full product page URL",
    "description": "Brief product description (50-100 characters)"
  }
]

Make sure images are real product images from the actual marketplace product pages.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a product search expert. You have access to current marketplace data. Provide accurate, real product information."
          },
          {
            role: "user",
            content: searchPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI search failed:", response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      console.log(`Found ${products.length} products from multi-platform search`);
      return products;
    }
  } catch (error) {
    console.error("Web search error:", error);
  }
  
  return [];
}

// Search specifically for high-quality images
async function searchForProductImages(productName: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const imageSearchPrompt = `Find 5 high-quality product images for: "${productName}"

Look for:
- Professional product photography
- White/clean background images
- Infographic images with features highlighted
- Multiple angles if available

Return JSON array of image URLs only:
["url1", "url2", "url3", "url4", "url5"]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: imageSearchPrompt }],
        temperature: 0.2,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error("Image search error:", error);
  }
  
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, category, description, searchMode } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("🔍 Multi-platform search for:", productName);

    // Perform comprehensive web search across platforms
    const products = await searchWebForProducts(productName, category || "");
    
    // Also get additional images
    const additionalImages = await searchForProductImages(productName);

    console.log(`✅ Found ${products.length} products, ${additionalImages.length} additional images`);

    return new Response(
      JSON.stringify({ 
        products,
        additionalImages,
        searchQuery: productName,
        platforms: ["Uzum Market", "Yandex Market", "Wildberries", "Ozon", "AliExpress", "Kaspi"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ products: [], error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
