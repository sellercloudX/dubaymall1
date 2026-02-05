import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Fast parallel search across multiple platforms
async function searchWebForProducts(productName: string, category: string, imageBase64?: string): Promise<ProductResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];
  
  const truncatedName = productName.slice(0, 150);
  const truncatedCategory = category?.slice(0, 30) || '';

  // Optimized prompt for speed
  const searchPrompt = `Find 8 products similar to "${truncatedName}" ${truncatedCategory ? `(${truncatedCategory})` : ''} from these marketplaces:
- Uzum Market (uzum.uz)
- Yandex Market (market.yandex.ru)
- Wildberries (wildberries.ru)
- Ozon (ozon.ru)
- AliExpress
- Amazon
- Kaspi.kz

Return JSON array ONLY:
[{"title":"name","price":"45000 so'm","image":"https://...jpg","source":"Uzum","url":"https://...","description":"short desc"}]`;
 
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Faster model
        messages: [
          { role: "system", content: "Product search expert. Return JSON only." },
          { role: "user", content: searchPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
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

// Fast image search
async function searchForProductImages(productName: string, category?: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];
  
  const prompt = `Find 5 HD product images for "${productName.slice(0, 100)}"${category ? ` (${category})` : ''}. Professional photos, white background. Return JSON: ["url1","url2","url3","url4","url5"]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
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

// Validate and fix image URLs
function validateImages(products: ProductResult[]): ProductResult[] {
  return products.map(p => ({
    ...p,
    image: p.image?.startsWith('http') ? p.image : '',
  })).filter(p => p.title && p.price);
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
        JSON.stringify({ error: "Unauthorized", products: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication", products: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { productName, category, description, imageBase64 } = body;

    // Input validation
    if (!productName || typeof productName !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid product name", products: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service unavailable", products: [] }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Multi-platform search for: ${productName} by user ${claimsData.claims.sub}`);

    // Run searches in parallel for speed
    const [products, additionalImages] = await Promise.all([
      searchWebForProducts(productName, category || "", imageBase64),
      searchForProductImages(productName, category),
    ]);
    
    // Validate results
    const validProducts = validateImages(products);

    console.log(`✅ Found ${validProducts.length} products, ${additionalImages.length} images`);

    return new Response(
      JSON.stringify({ 
        products: validProducts,
        additionalImages,
        searchQuery: productName,
        platforms: ["Uzum", "Yandex", "Wildberries", "Ozon", "AliExpress", "Amazon", "Kaspi"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ products: [], error: "Search failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
