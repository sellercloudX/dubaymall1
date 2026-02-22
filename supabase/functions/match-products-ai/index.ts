import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { wbProducts, yandexProducts } = await req.json();

    if (!wbProducts?.length || !yandexProducts?.length) {
      return new Response(JSON.stringify({ error: 'No products provided' }), { status: 400, headers: corsHeaders });
    }

    // Get all Yandex cost prices for this user
    const { data: costPrices } = await supabase
      .from('marketplace_cost_prices')
      .select('offer_id, cost_price')
      .eq('user_id', user.id)
      .eq('marketplace', 'yandex');

    const costMap = new Map<string, number>();
    (costPrices || []).forEach((cp: any) => costMap.set(cp.offer_id, cp.cost_price));

    // Filter Yandex products that have cost prices
    const yandexWithCost = yandexProducts.filter((yp: any) => costMap.has(yp.offerId));

    if (yandexWithCost.length === 0) {
      return new Response(JSON.stringify({ matches: [], message: 'Yandex da tannarx kiritilgan mahsulotlar topilmadi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use Gemini to match products in batches
    const BATCH_SIZE = 30;
    const allMatches: { wbOfferId: string; yandexOfferId: string; costPriceUzs: number }[] = [];

    // Prepare simplified lists for AI
    const yandexList = yandexWithCost.map((yp: any, i: number) => ({
      idx: i,
      name: (yp.name || '').substring(0, 100),
      offerId: yp.offerId,
    }));

    for (let i = 0; i < wbProducts.length; i += BATCH_SIZE) {
      const wbBatch = wbProducts.slice(i, i + BATCH_SIZE).map((wp: any, j: number) => ({
        idx: j,
        name: (wp.name || '').substring(0, 100),
        offerId: wp.offerId,
      }));

      const prompt = `You are a product matching assistant. Match WB (Wildberries) products to Yandex Market products by name similarity. These are the SAME physical products sold on different marketplaces, but names may differ in language (Russian vs Uzbek), formatting, or detail level.

WB Products:
${wbBatch.map((w: any) => `${w.idx}. "${w.name}" (${w.offerId})`).join('\n')}

Yandex Products:
${yandexList.map((y: any) => `${y.idx}. "${y.name}" (${y.offerId})`).join('\n')}

Return ONLY a JSON array of matches. Each match: {"wb": "wb_offerId", "yx": "yandex_offerId"}
Only include confident matches (same physical product). No explanations, just JSON array.
If no matches found, return []`;

      try {
        const apiKey = Deno.env.get('GOOGLE_AI_STUDIO_KEY');
        if (!apiKey) throw new Error('No AI key');

        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
            }),
          }
        );

        const aiData = await aiResponse.json();
        const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        
        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const matches = JSON.parse(jsonMatch[0]);
          for (const m of matches) {
            const costUzs = costMap.get(m.yx);
            if (costUzs && costUzs > 0) {
              allMatches.push({
                wbOfferId: m.wb,
                yandexOfferId: m.yx,
                costPriceUzs: costUzs,
              });
            }
          }
        }
      } catch (aiErr) {
        console.error('AI matching error for batch:', aiErr);
        // Continue with next batch
      }

      // Small delay between batches
      if (i + BATCH_SIZE < wbProducts.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Now bulk insert WB cost prices (UZS → RUB)
    const UZS_TO_RUB = 140;
    const insertEntries = allMatches.map(m => ({
      user_id: user.id,
      marketplace: 'wildberries',
      offer_id: m.wbOfferId,
      cost_price: Math.round(m.costPriceUzs / UZS_TO_RUB),
      currency: 'RUB',
    }));

    if (insertEntries.length > 0) {
      // Upsert in batches of 50
      for (let i = 0; i < insertEntries.length; i += 50) {
        const batch = insertEntries.slice(i, i + 50);
        await supabase
          .from('marketplace_cost_prices')
          .upsert(batch, { onConflict: 'user_id,marketplace,offer_id' });
      }
    }

    return new Response(JSON.stringify({
      matches: allMatches.length,
      total_wb: wbProducts.length,
      total_yandex: yandexWithCost.length,
      entries: insertEntries.map(e => ({ offerId: e.offer_id, costRub: e.cost_price })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Match error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
