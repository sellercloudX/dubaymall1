import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Search 1688/Alibaba via Firecrawl and get real product data */
async function searchRealProducts(category: string, firecrawlKey: string): Promise<any[]> {
  const categoryKeywords: Record<string, { en: string; zh: string }> = {
    electronics: { en: "portable electronics gadgets wholesale", zh: "便携电子产品批发" },
    fashion: { en: "women fashion clothing wholesale trending", zh: "女装批发爆款" },
    home: { en: "home gadgets wholesale trending 2025", ch: "家居用品批发爆款" },
    beauty: { en: "beauty skincare tools wholesale", zh: "美容护肤工具批发" },
    toys: { en: "children toys educational wholesale trending", zh: "儿童玩具益智批发爆款" },
    sports: { en: "sports fitness equipment wholesale", zh: "运动健身器材批发" },
    auto: { en: "car accessories wholesale trending", zh: "汽车用品批发爆款" },
    kitchen: { en: "kitchen gadgets wholesale trending 2025", zh: "厨房小工具批发爆款" },
    pet: { en: "pet supplies wholesale trending", zh: "宠物用品批发爆款" },
  };

  const kw = categoryKeywords[category] || { en: "trending wholesale products 2025", zh: "爆款批发产品" };

  // Search Alibaba for real products with prices
  const alibabaResults = await searchFirecrawl(
    `site:alibaba.com ${kw.en} 2025 trending`,
    firecrawlKey,
    5
  );

  // Search 1688 for Chinese wholesale prices
  const results1688 = await searchFirecrawl(
    `site:1688.com ${kw.zh} 爆款`,
    firecrawlKey,
    5
  );

  // Search for trending products globally
  const trendResults = await searchFirecrawl(
    `trending products to sell 2025 ${kw.en} wholesale China import`,
    firecrawlKey,
    5
  );

  return [...alibabaResults, ...results1688, ...trendResults];
}

async function searchFirecrawl(query: string, apiKey: string, limit: number): Promise<any[]> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit, lang: "en" }),
    });

    if (!response.ok) {
      console.error(`Firecrawl search error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (e) {
    console.error("Firecrawl search failed:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Avtorizatsiya talab qilinadi" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 per hour
    const { count } = await supabase
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action_type", "trend-prediction")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Soatiga 5 ta bashoratdan ortiq bo'lmaydi. Keyinroq urinib ko'ring." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ BILLING: check_feature_access + deduct_balance ═══
    const adminSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: billingAccess } = await adminSupabase.rpc('check_feature_access', {
      p_user_id: user.id,
      p_feature_key: 'ai-trend-predict',
    });
    const ba = billingAccess as any;
    if (ba && !ba.allowed) {
      return new Response(JSON.stringify({ 
        error: ba.message || 'Ruxsat berilmadi',
        billingError: ba.error,
        price: ba.price,
        balance: ba.balance,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const billingPrice = ba?.price || 0;

    const { category, period = 14 } = await req.json();
    const cat = category || "all";

    console.log("Trend prediction start:", { category: cat, period, user: user.id });

    // Step 1: Search real products from 1688/Alibaba via Firecrawl
    const realProducts = await searchRealProducts(
      cat === "all" ? "" : cat,
      FIRECRAWL_API_KEY
    );

    console.log(`Firecrawl found ${realProducts.length} results`);

    // Build context from real search results
    const searchContext = realProducts
      .map((r: any) => `- ${r.title || ""}: ${r.url || ""} | ${r.description || ""}`)
      .join("\n");

    const currentDate = new Date().toISOString().split("T")[0];
    const categoryFilter = cat !== "all" && cat ? `\nFAQAT "${cat}" kategoriyasiga tegishli mahsulotlarni tahlil qil.` : "";

    // Step 2: AI analyzes real search data
    const prompt = `Sen professional e-commerce import analitikasan. Quyida Firecrawl orqali 1688.com va Alibaba.com dan olingan REAL qidiruv natijalari bor.

Hozirgi sana: ${currentDate}
Bashorat muddati: ${period} kun
${categoryFilter}

## REAL QIDIRUV NATIJALARI (1688, Alibaba):
${searchContext || "Qidiruv natijalari topilmadi, umumiy bilimingdan foydalanib tavsiya ber."}

## VAZIFA:
Yuqoridagi REAL ma'lumotlardan foydalanib, O'zbekistonga import qilish uchun eng foydali 6 ta mahsulotni tavsiya qil.

## NARXLAR QOIDASI (JUDA MUHIM):
- Xitoy optom narxi ($): Yuqoridagi real qidiruv natijalaridan olingan HAQIQIY narxlarni yoz. Agar narx ko'rsatilmagan bo'lsa, shu turdagi tovarlarning 1688 dagi real optom narxi oralig'ini yoz.
- O'zbekistonda sotish narxi (so'mda): Real bozor narxi. Masalan blender 150,000-350,000 so'm, power bank 80,000-200,000 so'm, kiyim 50,000-300,000 so'm kabi REAL narxlar.
- HECH QACHON 250,000 so'mlik narx bilan $40 lik Xitoy narxini birga YOZMA - mantiqsiz. Import xarajatlari bilan foyda chiqishi kerak.

## HAVOLALAR QOIDASI:
1688.com havolasi: XITOY TILIDA kalit so'z bilan https://s.1688.com/selloffer/offer_search.htm?keywords=KALIT_SOZ
Alibaba havolasi: INGLIZ TILIDA kalit so'z bilan https://www.alibaba.com/trade/search?SearchText=KALIT_SOZ
Kalit so'zlar URL-encoded bo'lishi kerak.

## QOIDALAR:
- FAQAT Xitoydan import qilsa arziydigan FIZIK mahsulotlar
- HECH QACHON oziq-ovqat, meva, jam, ichimlik taklif QILMA
- HECH QACHON dori-darmon, tibbiy asbob taklif QILMA
- Narxlar ALBATTA REAL va MANTIQIY bo'lishi kerak
- Kamida 6 ta TURLI mahsulot ber
- Barcha izohlar O'ZBEK TILIDA`;

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
            content: "Sen professional Xitoy-O'zbekiston import analitikasan. Senga REAL qidiruv natijalari berilgan. Faqat FIZIK mahsulotlarni tavsiya qil. Oziq-ovqat, dori TAQIQLANGAN. Har bir mahsulot uchun 1688.com va Alibaba havolalarini ber. BARCHA izohlar FAQAT O'ZBEK TILIDA. Narxlar MANTIQIY bo'lishi shart - Xitoy optom narxi va O'zbekiston sotish narxi o'rtasida kamida 2-3x farq bo'lishi kerak."
          },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "trend_predictions",
            description: "Import uchun trend mahsulotlar bashorati",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string", description: "Mahsulot nomi o'zbek tilida" },
                      category: { type: "string" },
                      demand_score: { type: "number", description: "1-100" },
                      price_min: { type: "number", description: "O'zbekistonda sotish narxi MIN (so'mda)" },
                      price_max: { type: "number", description: "O'zbekistonda sotish narxi MAX (so'mda)" },
                      china_price_usd: { type: "number", description: "Xitoy optom narxi USD (REAL)" },
                      monthly_sales_estimate: { type: "number" },
                      net_profit_potential: { type: "number", description: "Sof foyda so'mda oylik" },
                      competition_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      trend_direction: { type: "string", enum: ["tez_o'sish", "sekin_o'sish", "barqaror", "mavsumiy"] },
                      reason: { type: "string" },
                      best_time_to_enter: { type: "string" },
                      risk_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      global_trend_data: { type: "string" },
                      source_links: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            platform: { type: "string" },
                            url: { type: "string", description: "To'liq havola" },
                            price_range: { type: "string" },
                          },
                          required: ["platform", "url", "price_range"],
                        },
                      },
                    },
                    required: ["product_name", "category", "demand_score", "price_min", "price_max", "china_price_usd", "monthly_sales_estimate", "net_profit_potential", "competition_level", "trend_direction", "reason", "source_links"],
                  },
                },
                market_summary: {
                  type: "object",
                  properties: {
                    overall_trend: { type: "string" },
                    hot_categories: { type: "array", items: { type: "string" } },
                    seasonal_factors: { type: "string" },
                    recommendation: { type: "string" },
                  },
                },
              },
              required: ["predictions", "market_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "trend_predictions" } },
      }),
    });

    console.log("AI response status:", response.status);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI xizmati band. Biroz kutib turing." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI xatoligi: " + response.status);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let predictions: any = null;
    if (toolCall?.function?.arguments) {
      try {
        predictions = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        throw new Error("AI javobini o'qib bo'lmadi");
      }
    }

    if (!predictions?.predictions?.length) {
      throw new Error("AI natija bermadi, qaytadan urinib ko'ring");
    }

    console.log("Predictions count:", predictions.predictions.length);

    // Deduct balance
    if (billingPrice > 0) {
      await adminSupabase.rpc('deduct_balance', {
        p_user_id: user.id,
        p_amount: billingPrice,
        p_feature_key: 'ai-trend-predict',
        p_description: `Trend bashorat: ${cat}`,
      });
    }

    // Log usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      action_type: "trend-prediction",
      model_used: "gemini-2.5-flash+firecrawl",
      metadata: { category: cat, period, real_results: realProducts.length },
    });

    return new Response(JSON.stringify({
      success: true,
      ...predictions,
      data_source: "firecrawl+ai",
      real_results_count: realProducts.length,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Trend prediction error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Noma'lum xatolik",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
