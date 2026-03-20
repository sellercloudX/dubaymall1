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

    const { keywords, marketplace, categories } = await req.json();

    // Build comprehensive prompt for Gemini
    const keywordData = (keywords || []).slice(0, 50).map((k: any) => 
      `"${k.text}" — chastota: ${k.totalFrequency}, buyurtma: ${k.totalOrders}, klik: ${k.totalClicks}, konversiya: ${k.totalClicks > 0 ? ((k.totalOrders/k.totalClicks)*100).toFixed(1) : 0}%`
    ).join('\n');

    const prompt = `Sen professional e-commerce trend analitik ekspertisan. O'zbekiston va MDH bozori uchun marketplace (${marketplace || 'Wildberries'}) ma'lumotlarini tahlil qil.

## HOZIRGI MA'LUMOTLAR (oxirgi 14 kun):
${keywordData || 'Kalit so\'z ma\'lumotlari mavjud emas'}

${categories ? `Kategoriyalar: ${categories.join(', ')}` : ''}

## VAZIFA:
1. Kelgusi 7-30 kun uchun ANIQ bashoratlar ber
2. Har bir bashorat uchun: mahsulot nomi, kategoriya, talab darajasi (1-100), narx oralig'i (so'm), oylik sotuvlar bashorati, sof foyda potentsiali
3. Nima uchun bu mahsulot trend ekanligini tushuntir
4. Mavsum va bayramlar ta'sirini hisobga ol (hozirgi sana: ${new Date().toISOString().split('T')[0]})
5. Raqobat darajasini baholash (past/o'rta/yuqori)
6. Kamida 10 ta turli kategoriyadan mahsulotlar taklif qil

MUHIM: Faqat O'zbekiston bozoriga mos mahsulotlarni taklif qil. Narxlarni so'm da ber. Real bozor ma'lumotlariga asoslan.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sen professional marketplace trend analitik va talab bashoratchi (demand forecaster) san. Javoblarni JSON formatda ber." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "trend_predictions",
            description: "Marketplace trend bashoratlari",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string", description: "Mahsulot nomi" },
                      category: { type: "string", description: "Kategoriya" },
                      demand_score: { type: "number", description: "Talab darajasi 1-100" },
                      price_min: { type: "number", description: "Minimal narx (so'm)" },
                      price_max: { type: "number", description: "Maksimal narx (so'm)" },
                      monthly_sales_estimate: { type: "number", description: "Oylik sotuvlar bashorati (dona)" },
                      net_profit_potential: { type: "number", description: "Sof foyda potentsiali (so'm/oy)" },
                      competition_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                      trend_direction: { type: "string", enum: ["tez_o'sish", "sekin_o'sish", "barqaror", "mavsumiy"] },
                      reason: { type: "string", description: "Nima uchun trend" },
                      best_time_to_enter: { type: "string", description: "Qachon kirish yaxshi" },
                      risk_level: { type: "string", enum: ["past", "o'rta", "yuqori"] },
                    },
                    required: ["product_name", "category", "demand_score", "price_min", "price_max", "monthly_sales_estimate", "net_profit_potential", "competition_level", "trend_direction", "reason"],
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
      metadata: { marketplace, keyword_count: keywords?.length || 0 },
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
