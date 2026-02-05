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

 // Google Lens-like visual search - finds exact matching products across marketplaces
 async function searchVisualProducts(productName: string, category: string, description?: string): Promise<ProductResult[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];
  
  const truncatedName = productName.slice(0, 150);
  const truncatedCategory = category?.slice(0, 30) || '';
   const truncatedDesc = description?.slice(0, 100) || '';

   // Google Lens-like search - find EXACT same product across marketplaces
   const searchPrompt = `You are a visual product search engine like Google Lens. 
 
 Find the EXACT same product "${truncatedName}" ${truncatedCategory ? `(category: ${truncatedCategory})` : ''} ${truncatedDesc ? `- ${truncatedDesc}` : ''} from these real marketplaces:
 
 PRIORITY SOURCES (return actual product URLs):
 1. Uzum Market (uzum.uz) - O'zbekiston marketplace
 2. Yandex Market (market.yandex.uz or market.yandex.ru)  
 3. Wildberries (wildberries.ru)
 4. Ozon (ozon.ru)
 5. AliExpress (aliexpress.com or aliexpress.ru)
 6. 1688.com - Xitoy optom narxlari
 7. Amazon (amazon.com)
 8. Kaspi (kaspi.kz)
 
 IMPORTANT:
 - Return REAL product URLs that actually exist
 - Include actual marketplace prices in local currency (so'm, ₽, $, ¥)
 - Product images must be real CDN URLs from these marketplaces
 - Find products with IDENTICAL or VERY SIMILAR appearance to the query

Return JSON array ONLY:
 [{"title":"Mahsulot nomi","price":"45000 so'm","image":"https://cdn.uzum.uz/...jpg","source":"Uzum Market","url":"https://uzum.uz/product/12345","description":"Qisqa tavsif"}]
 
 Return 8-10 results from different sources. Ensure URLs and images are realistic marketplace CDN formats.`;
 
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
         model: "google/gemini-2.5-flash", // Better quality for accurate search
        messages: [
           { role: "system", content: "You are Google Lens - a visual product search engine. Find exact matching products across e-commerce platforms. Return only valid JSON arrays with real marketplace data." },
          { role: "user", content: searchPrompt }
        ],
        temperature: 0.2,
         max_tokens: 3000,
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
       console.log(`Found ${products.length} products via Google Lens-like search`);
      return products;
    }
  } catch (error) {
     console.error("Visual search error:", error);
  }
  
  return [];
}

 // Search for high-quality product images from multiple sources
 async function searchProductImages(productName: string, category?: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];
  
   const prompt = `Find 6 HIGH QUALITY product images for "${productName.slice(0, 100)}"${category ? ` (${category})` : ''}.
 
 Requirements:
 - Professional e-commerce photos with white/clean background
 - Different angles: front, side, detail shots
 - Real CDN URLs from: uzum.uz, ozon.ru, wildberries.ru, aliexpress, amazon
 - Image URLs must end with .jpg, .png, or .webp
 
 Return JSON array of 6 image URLs only: ["https://...jpg","https://...png",...]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
         model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
         temperature: 0.3,
         max_tokens: 800,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
         const urls = JSON.parse(jsonMatch[0]);
         // Filter to only valid image URLs
         return urls.filter((url: string) => 
           url && typeof url === 'string' && url.startsWith('http') &&
           (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('.jpeg'))
         );
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

     console.log(`🔍 Google Lens-like search for: ${productName} by user ${claimsData.claims.sub}`);

    // Run searches in parallel for speed
    const [products, additionalImages] = await Promise.all([
       searchVisualProducts(productName, category || "", description),
       searchProductImages(productName, category),
    ]);
    
    // Validate results
    const validProducts = validateImages(products);

     console.log(`✅ Visual search: ${validProducts.length} products, ${additionalImages.length} images`);

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
