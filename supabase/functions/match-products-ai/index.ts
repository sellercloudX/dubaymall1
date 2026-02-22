import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple text normalization for matching
function normalize(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate word overlap score between two product names
function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length >= 3));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length >= 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  
  return overlap / Math.min(wordsA.size, wordsB.size);
}

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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { wbProducts, yandexProducts } = await req.json();
    console.log(`Received ${wbProducts?.length} WB, ${yandexProducts?.length} Yandex products`);

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
    console.log(`Found ${costMap.size} Yandex cost prices`);

    // Filter Yandex products that have cost prices
    const yandexWithCost = yandexProducts.filter((yp: any) => costMap.has(yp.offerId));
    console.log(`Yandex with cost prices: ${yandexWithCost.length}`);

    if (yandexWithCost.length === 0) {
      return new Response(JSON.stringify({ matches: 0, message: 'Yandex da tannarx kiritilgan mahsulotlar topilmadi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STEP 1: Fast text-based matching first (word overlap)
    const textMatches: { wbOfferId: string; yandexOfferId: string; costPriceUzs: number }[] = [];
    const unmatchedWb: any[] = [];

    for (const wp of wbProducts) {
      let bestScore = 0;
      let bestYandex: any = null;

      for (const yp of yandexWithCost) {
        const score = wordOverlapScore(wp.name, yp.name);
        if (score > bestScore) {
          bestScore = score;
          bestYandex = yp;
        }
      }

      // Threshold: at least 40% word overlap
      if (bestScore >= 0.4 && bestYandex) {
        const costUzs = costMap.get(bestYandex.offerId);
        if (costUzs && costUzs > 0) {
          textMatches.push({
            wbOfferId: wp.offerId,
            yandexOfferId: bestYandex.offerId,
            costPriceUzs: costUzs,
          });
        }
      } else {
        unmatchedWb.push(wp);
      }
    }

    console.log(`Text matching: ${textMatches.length} matches, ${unmatchedWb.length} unmatched`);

    // STEP 2: Use AI for unmatched products (smaller batches with fewer yandex candidates)
    const aiMatches: typeof textMatches = [];

    if (unmatchedWb.length > 0 && yandexWithCost.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const AI_BATCH = 20;
        
        for (let i = 0; i < unmatchedWb.length; i += AI_BATCH) {
          const wbBatch = unmatchedWb.slice(i, i + AI_BATCH);
          
          // For each WB batch, find top candidates from Yandex by partial word overlap
          const candidateSet = new Set<string>();
          for (const wp of wbBatch) {
            const scored = yandexWithCost
              .map((yp: any) => ({ yp, score: wordOverlapScore(wp.name, yp.name) }))
              .filter((x: any) => x.score > 0.1)
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 5);
            for (const s of scored) candidateSet.add(s.yp.offerId);
          }

          const yxCandidates = yandexWithCost.filter((yp: any) => candidateSet.has(yp.offerId));
          
          if (yxCandidates.length === 0) continue;

          const prompt = `Match WB products to Yandex products. Same physical product, different names/languages.

WB:
${wbBatch.map((w: any) => `- "${w.name}" [${w.offerId}]`).join('\n')}

Yandex:
${yxCandidates.map((y: any) => `- "${y.name}" [${y.offerId}]`).join('\n')}

Return JSON array only: [{"wb":"offerId","yx":"offerId"}]
Only confident matches. Empty array if none.`;

          try {
            const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
              }),
            });

            if (!resp.ok) {
              console.error(`AI error: ${resp.status}`);
              continue;
            }

            const aiData = await resp.json();
            const text = aiData?.choices?.[0]?.message?.content || '[]';
            console.log(`AI batch ${i}: response length=${text.length}`);

            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              const matches = JSON.parse(jsonMatch[0]);
              for (const m of matches) {
                const costUzs = costMap.get(m.yx);
                if (costUzs && costUzs > 0) {
                  aiMatches.push({
                    wbOfferId: m.wb,
                    yandexOfferId: m.yx,
                    costPriceUzs: costUzs,
                  });
                }
              }
            }
          } catch (aiErr) {
            console.error('AI batch error:', aiErr);
          }

          if (i + AI_BATCH < unmatchedWb.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
    }

    console.log(`AI matching: ${aiMatches.length} additional matches`);

    const allMatches = [...textMatches, ...aiMatches];
    console.log(`Total matches: ${allMatches.length}`);

    // Bulk insert WB cost prices (UZS → RUB)
    const UZS_TO_RUB = 140;
    const insertEntries = allMatches.map(m => ({
      user_id: user.id,
      marketplace: 'wildberries',
      offer_id: m.wbOfferId,
      cost_price: Math.round(m.costPriceUzs / UZS_TO_RUB),
      currency: 'RUB',
    }));

    if (insertEntries.length > 0) {
      for (let i = 0; i < insertEntries.length; i += 50) {
        const batch = insertEntries.slice(i, i + 50);
        const { error: upsertErr } = await supabase
          .from('marketplace_cost_prices')
          .upsert(batch, { onConflict: 'user_id,marketplace,offer_id' });
        if (upsertErr) console.error('Upsert error:', upsertErr);
      }
      console.log(`Inserted ${insertEntries.length} cost prices`);
    }

    return new Response(JSON.stringify({
      matches: allMatches.length,
      total_wb: wbProducts.length,
      total_yandex: yandexWithCost.length,
      text_matches: textMatches.length,
      ai_matches: aiMatches.length,
      entries: insertEntries.map(e => ({ offerId: e.offer_id, costRub: e.cost_price })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Match error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
