import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetches real RUB→UZS exchange rate from CBU.uz (Central Bank of Uzbekistan).
 * Returns { rubToUzs: number, date: string, source: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // CBU.uz official API for RUB rate
    const cbuResp = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/RUB/", {
      headers: { "Accept": "application/json" },
    });

    if (!cbuResp.ok) {
      throw new Error(`CBU.uz API error: ${cbuResp.status}`);
    }

    const cbuData = await cbuResp.json();
    
    // CBU returns array: [{ Ccy: "RUB", CcyNm_UZ: "...", Rate: "140.52", Diff: "0.01", Date: "24.02.2026" }]
    const rubEntry = Array.isArray(cbuData) ? cbuData[0] : cbuData;
    
    if (!rubEntry || !rubEntry.Rate) {
      throw new Error("Invalid CBU response format");
    }

    const rate = parseFloat(rubEntry.Rate);
    if (isNaN(rate) || rate <= 0) {
      throw new Error(`Invalid rate value: ${rubEntry.Rate}`);
    }

    console.log(`CBU.uz RUB rate: 1 RUB = ${rate} UZS (date: ${rubEntry.Date})`);

    return new Response(
      JSON.stringify({
        success: true,
        rubToUzs: rate,
        date: rubEntry.Date,
        source: "CBU.uz",
        currency: rubEntry.Ccy,
        currencyName: rubEntry.CcyNm_UZ || rubEntry.CcyNm_RU || "Rossiya rubli",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Exchange rate fetch error:", error);
    
    // Fallback to approximate rate
    return new Response(
      JSON.stringify({
        success: false,
        rubToUzs: 140, // Fallback
        error: error.message,
        source: "fallback",
      }),
      {
        status: 200, // Still 200 so client can use fallback
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
