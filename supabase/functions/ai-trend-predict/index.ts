import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { category, period = 14 } = await req.json();

    const categoryFilter = category ? `\nFAQAT "${category}" kategoriyasiga tegishli mahsulotlarni tahlil qil.` : '';
    const currentDate = new Date().toISOString().split('T')[0];

    console.log("Starting trend prediction:", { category, period, user: user.id });

    const prompt = `Sen professional e-commerce import/export analitikasan. Sening vazifang — Xitoydan O'zbekistonga import qilish uchun eng foydali va trendga chiqayotgan FIZIK MAHSULOTLARNI topish.

Hozirgi sana: ${currentDate}
Bashorat muddati: ${period} kun
${categoryFilter}

## SEN NIMA QILISHING KERAK:

1. HOZIRDA dunyo bozorida (Amazon, TikTok Shop, AliExpress, Temu) eng ko'p sotilayotgan, viral bo'layotgan yoki tez o'sish trendidagi FIZIK mahsulotlarni aniqla.

2. Bu mahsulotlarning O'zbekiston bozorida hali KAM tarqalgani yoki UMUMAN yo'qligini tekshir.

3. Har bir mahsulot uchun ANIQ havolalar ber.

## HAVOLALAR QOIDASI (JUDA MUHIM):

1688.com havolasi uchun: 
- Kalit so'z ALBATTA XITOY TILIDA bo'lishi kerak
- URL formati: https://s.1688.com/selloffer/offer_search.htm?keywords=KALIT_SOZ
- Kalit so'z URL-encoded bo'lishi kerak
- Har bir mahsulot uchun JUDA ANIQ kalit so'z ber.

Alibaba havolasi uchun:
- Kalit so'z INGLIZ TILIDA bo'lishi kerak  
- URL formati: https://www.alibaba.com/trade/search?SearchText=KALIT_SOZ
- Har bir mahsulot uchun JUDA ANIQ kalit so'z ber.

## RASM QOIDASI:
Har bir mahsulot uchun image_url maydoniga shu mahsulotning Alibaba yoki AliExpress'dagi haqiqiy rasm URL'ini ber. Agar aniq rasm URL bilmasang, bo'sh qoldir.

## QOIDALAR:
- FAQAT Xitoydan import qilsa arziydigan mahsulotlar
- HECH QACHON oziq-ovqat, meva, sabzavot, jam, konserva, ichimlik taklif QILMA
- HECH QACHON dori-darmon, tibbiy asbob, kimyoviy moddalar taklif QILMA
- Narxlar REAL bo'lishi kerak
- Kamida 6 ta TURLI mahsulot ber
- TEZKOR javob ber, ortiqcha tafsilotlarga kirma`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Sen professional Xitoy-O'zbekiston import analitikasan. Faqat FIZIK mahsulotlarni tavsiya qil. Oziq-ovqat, dori TAQIQLANGAN. Har bir mahsulot uchun 1688.com va Alibaba havolalarini ALBATTA ber. TEZKOR va ANIQ javob ber."
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
                      china_price_usd: { type: "number", description: "Xitoy optom narxi USD" },
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI kreditlari tugagan." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error: " + response.status);
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

    // Log usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      action_type: "trend-prediction",
      model_used: "gemini-2.5-flash-lite",
      metadata: { category, period },
    });

    return new Response(JSON.stringify({
      success: true,
      ...predictions,
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
