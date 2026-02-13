import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductInput {
  name: string;
  description?: string;
  price: number;
  costPrice: number;
  images?: string[];
  category?: string;
}

interface CreateCardRequest {
  shopId?: string;
  product: ProductInput;
  skipImageGeneration?: boolean;
  cloneMode?: boolean;
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

    const userId = user.id;

    // Get Wildberries credentials
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("marketplace", "wildberries")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "Wildberries ulangan emas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiKey = "";
    if (conn.encrypted_credentials) {
      const { data, error } = await supabase.rpc("decrypt_credentials", {
        p_encrypted: conn.encrypted_credentials,
      });
      if (!error && data) {
        apiKey = (data as any).apiKey || "";
      }
    } else {
      apiKey = (conn.credentials as any)?.apiKey || "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Wildberries API kaliti yo'q" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request: CreateCardRequest = await req.json();
    const { product, cloneMode } = request;

    console.log(`Creating WB card: "${product.name}"`);

    // Generate SKU
    const sku = generateSKU(product.name);

    // Proxy images if provided
    const images = product.images || [];
    const proxiedImages: string[] = [];
    
    for (const imgUrl of images.slice(0, 5)) {
      if (!imgUrl || !imgUrl.startsWith("http")) continue;
      
      try {
        const resp = await fetch(imgUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketBot/1.0)" },
        });
        if (!resp.ok) continue;

        const ct = resp.headers.get("content-type") || "image/jpeg";
        if (!ct.startsWith("image/")) continue;

        const data = await resp.arrayBuffer();
        if (data.byteLength < 1000) continue;

        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const fileName = `${userId}/wb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, data, { contentType: ct, cacheControl: "31536000", upsert: false });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            proxiedImages.push(urlData.publicUrl);
          }
        }
      } catch (e) {
        console.warn(`Image proxy failed: ${e}`);
      }
    }

    // Prepare card payload for Wildberries API
    const cardPayload = {
      vendorCode: sku,
      title: product.name.slice(0, 100),
      description: stripHtml(product.description || product.name).slice(0, 1000),
      brand: "DubayMall",
      categoryId: 1, // Default to general category
      price: Math.round(product.price * 100), // Wildberries uses kopeks
      currencyIso3: "UZS", // Uzbek Som
      photos: proxiedImages.slice(0, 5).map(url => ({ url })),
      vendorCountriesCodes: ["UZ"],
      sizes: [{
        techSize: "OS",
        wbSize: "OS",
        skus: [sku],
      }],
    };

    console.log(`Sending to WB API: ${JSON.stringify(cardPayload)}`);

    // Create card in Wildberries
    const wbResp = await fetch("https://content-api.wildberries.ru/content/v2/cards/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cards: [cardPayload] }),
    });

    const wbData = await wbResp.json();

    if (!wbResp.ok) {
      console.error("WB API error:", wbData);
      return new Response(
        JSON.stringify({
          success: false,
          error: wbData?.error?.message || wbData?.errors?.[0]?.message || "Wildberries API xatosi",
          wbResponse: wbData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Card created in WB: ${sku}`);

    return new Response(
      JSON.stringify({
        success: true,
        sku,
        name: product.name,
        price: product.price,
        images: proxiedImages.length,
        wbResponse: wbData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Noma'lum xato",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSKU(name: string): string {
  const ascii = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = (ascii || "PROD").split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.substring(0, 4).toUpperCase()).join("");
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix || "PROD"}-${rnd}-${ts}`;
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
