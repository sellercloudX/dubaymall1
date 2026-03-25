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

    const { category, period = 14, keywords, marketplace, include_source_links = true, global_trends = true } = await req.json();

    // Build optional WB keyword context if provided
    let keywordContext = '';
    if (keywords && keywords.length > 0) {
      const keywordData = keywords.slice(0, 30).map((k: any) =>
        `"${k.text}" — chastota: ${k.totalFrequency}, buyurtma: ${k.totalOrders}, konversiya: ${k.totalClicks > 0 ? ((k.totalOrders / k.totalClicks) * 100).toFixed(1) : 0}%`
      ).join('\n');
      keywordContext = `\n\n## MARKETPLACE MA'LUMOTLARI (${marketplace || 'Wildberries'}, oxirgi 14 kun):\n${keywordData}`;
    }

    const categoryFilter = category ? `\nFAQAT "${category}" kategoriyasiga tegishli mahsulotlarni tahlil qil.` : '';

    const currentDate = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toLocaleString('uz-UZ', { month: 'long' });

    const prompt = `Sen dunyo miqyosidagi professional e-commerce trend analitik va import/export mutaxassisisan.

## VAZIFA:
Dunyo bozorida (AQSh, Yevropa, Xitoy, Janubi-Sharqiy Osiyo) hozirda TREND ga chiqayotgan, lekin O'zbekiston va MDH bozoriga hali KIRMAGAN yoki endigina kirish bosqichidagi mahsulotlarni aniqla.

Hozirgi sana: ${currentDate} (${currentMonth})
Bashorat muddati: ${period} kun

${categoryFilter}
${keywordContext}

## TALAB:
1. Har bir mahsulot uchun ANIQ ma'lumotlar ber:
   - Mahsulot nomi (o'zbek tilida tushuntir)
   - Kategoriya
   - Talab darajasi (demand_score: 1-100)
   - Narx oralig'i so'mda (O'zbekiston bozorida sotish narxi)
   - Oylik sotuvlar bashorati (O'zbekiston bozorida necha dona sotilishi mumkin)
   - Sof foyda potentsiali (so'm/oy) - import narxi va sotish narxi farqini hisobga ol
   - Raqobat darajasi O'zbekiston bozorida
   - Trend yo'nalishi
   - Nima uchun trend ekanligini aniq sabablari
   - Qachon kirish yaxshiligini ayt
   - Risk darajasi
   - Dunyo bozorida qanday trend ekanligi haqida qisqa ma'lumot

2. Har bir mahsulot uchun XITOY OPTOM SAYTLARIDAN xarid qilish uchun havolalar ber:
   - 1688.com (xitoy optom narxi eng arzon)
   - alibaba.com (xalqaro optom)
   - Zarur bo'lsa boshqa optom saytlar
   - Har bir havola uchun taxminiy narx oralig'ini ko'rsat

3. MUHIM qoidalar:
   - Faqat HAQIQIY global trendlarni taklif qil (TikTok viral, Amazon bestseller, AliExpress top seller)
   - Narxlarni real bozor asosida ber (taxminiy emas)
   - O'zbekiston logistikasi va bojxona xarajatlarini hisobga ol
   - Mavsumiy omillarni e'tiborga ol (hozirgi oy: ${currentMonth})
   - Kamida 8-12 ta turli kategoriyadan mahsulotlar taklif qil
   - Xitoy optom havolalari to'g'ridan-to'g'ri mahsulot sahifasiga olib borishi kerak

4. HAVOLALAR FORMATI:
   - 1688.com uchun: https://s.1688.com/selloffer/offer_search.htm?keywords=MAHSULOT_NOMI_XITOYCHA
   - alibaba.com uchun: https://www.alibaba.com/trade/search?SearchText=MAHSULOT_NOMI_INGLIZCHA
   - Bu havolalar qidiruv natijalari sahifasiga olib boradi`;

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
            content: "Sen professional dunyo miqyosidagi marketplace trend analitik va import/export mutaxassisisan. Javoblarni JSON formatda, aniq va real ma'lumotlar asosida ber. Xitoy optom saytlariga havolalarni DOIM qo'sh."
          },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "trend_predictions",
            description: "Dunyo bozori trend bashoratlari va xitoy optom manbalari",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string", description: "Mahsulot nomi (o'zbek tilida)" },
                      category: { type: "string", description: "Kategoriya" },
                      demand_score: { type: "number", description: "Talab darajasi 1-100" },
                      price_min: { type: "number", description: "Minimal narx (so'm) - O'zbekiston bozorida" },
                      price_max: { type: "number", description: "Maksimal narx (so'm) - O'zbekiston bozorida" },
                      monthly_sales_estimate: { type: "number", description: "Oylik sotuvlar bashorati O'zbekistonda (dona)" },
                      net_profit_potential: { type: "number", description: "Sof foyda potentsiali (so'm/oy)" },
                      competition_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      trend_direction: { type: "string", enum: ["tez_o'sish", "sekin_o'sish", "barqaror", "mavsumiy"] },
                      reason: { type: "string", description: "Nima uchun trend (aniq sabablar)" },
                      best_time_to_enter: { type: "string", description: "Qachon kirish yaxshi" },
                      risk_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      global_trend_data: { type: "string", description: "Dunyo bozorida qanday trend ekanligi" },
                      source_links: {
                        type: "array",
                        description: "Xitoy optom saytlaridan xarid qilish havolalari",
                        items: {
                          type: "object",
                          properties: {
                            platform: { type: "string", description: "Platforma nomi (1688.com, Alibaba, AliExpress)" },
                            url: { type: "string", description: "To'g'ridan-to'g'ri havola" },
                            price_range: { type: "string", description: "Taxminiy optom narx oralig'i" },
                          },
                          required: ["platform", "url"],
                        },
                      },
                    },
                    required: ["product_name", "category", "demand_score", "price_min", "price_max", "monthly_sales_estimate", "net_profit_potential", "competition_level", "trend_direction", "reason", "source_links"],
                  },
                },
                market_summary: {
                  type: "object",
                  properties: {
                    overall_trend: { type: "string", description: "Umumiy bozor holati va trend yo'nalishi" },
                    hot_categories: { type: "array", items: { type: "string" }, description: "Eng issiq kategoriyalar" },
                    seasonal_factors: { type: "string", description: "Mavsumiy omillar" },
                    recommendation: { type: "string", description: "Umumiy strategik tavsiya" },
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
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let predictions: any = null;
    if (toolCall?.function?.arguments) {
      try {
        predictions = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    // Log usage
    await supabase.from("ai_usage_log").insert({
      user_id: user.id,
      action_type: "trend-prediction",
      model_used: "gemini-2.5-flash",
      metadata: { category, period, global_trends, keyword_count: keywords?.length || 0 },
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
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
