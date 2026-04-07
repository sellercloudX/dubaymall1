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
    if (wordsB.has(w)) {
      overlap++;
    } else {
      for (const wb of wordsB) {
        if (wb.includes(w) || w.includes(wb)) {
          overlap += 0.5;
          break;
        }
      }
    }
  }
  
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// Exact SKU match (highest priority)
function skuMatch(targetSku: string, sourceSku: string): boolean {
  if (!targetSku || !sourceSku) return false;
  const a = normalize(targetSku);
  const b = normalize(sourceSku);
  return a === b || a.includes(b) || b.includes(a);
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

    const body = await req.json();
    
    // New universal API: targetProducts, sourceProducts, targetMarketplace, sourceMarketplace
    // Also supports legacy API: wbProducts, yandexProducts
    const targetMarketplace: string = body.targetMarketplace || 'wildberries';
    const sourceMarketplace: string = body.sourceMarketplace || 'yandex';
    const targetProducts = body.targetProducts || body.wbProducts || [];
    const sourceProducts = body.sourceProducts || body.yandexProducts || [];

    console.log(`Matching ${targetProducts.length} ${targetMarketplace} ← ${sourceProducts.length} ${sourceMarketplace}`);

    if (!targetProducts.length || !sourceProducts.length) {
      return new Response(JSON.stringify({ error: 'No products provided' }), { status: 400, headers: corsHeaders });
    }

    // ═══ BILLING: check_feature_access + deduct_balance ═══
    const { data: billingAccess } = await supabase.rpc('check_feature_access', {
      p_user_id: user.id,
      p_feature_key: 'ai-product-matching',
    });
    const ba = billingAccess as any;
    if (ba && !ba.allowed) {
      return new Response(JSON.stringify({ 
        error: ba.message || 'Ruxsat berilmadi',
        billingError: ba.error,
        price: ba.price,
        balance: ba.balance,
      }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const billingPrice = ba?.price || 0;

    // Get ALL cost prices for this user from ALL marketplaces (source will be filtered)
    const { data: costPrices } = await supabase
      .from('marketplace_cost_prices')
      .select('offer_id, cost_price, marketplace, currency')
      .eq('user_id', user.id);

    // Build cost map from all marketplaces EXCEPT target (any marketplace can be source)
    const costMap = new Map<string, { cost: number; marketplace: string; currency: string }>();
    (costPrices || []).forEach((cp: any) => {
      // If specific sourceMarketplace given, only use that; otherwise use all except target
      if (sourceMarketplace === 'all') {
        if (cp.marketplace !== targetMarketplace) {
          costMap.set(`${cp.marketplace}:${cp.offer_id}`, { cost: cp.cost_price, marketplace: cp.marketplace, currency: cp.currency || 'UZS' });
        }
      } else {
        if (cp.marketplace === sourceMarketplace) {
          costMap.set(`${cp.marketplace}:${cp.offer_id}`, { cost: cp.cost_price, marketplace: cp.marketplace, currency: cp.currency || 'UZS' });
        }
      }
    });
    console.log(`Found ${costMap.size} source cost prices`);

    // Filter source products that have cost prices
    const sourceWithCost = sourceProducts.filter((sp: any) => {
      for (const [key] of costMap) {
        const offerId = key.split(':')[1];
        if (offerId === sp.offerId) return true;
      }
      return false;
    });
    console.log(`Source with cost prices: ${sourceWithCost.length}`);

    if (sourceWithCost.length === 0) {
      return new Response(JSON.stringify({ 
        matches: 0, 
        message: `Manba marketplace'da tannarx kiritilgan mahsulotlar topilmadi` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Helper to get cost for a source offerId
    function getCostForSource(offerId: string): { cost: number; currency: string } | null {
      // Check specific source first, then any
      const specificKey = `${sourceMarketplace}:${offerId}`;
      if (costMap.has(specificKey)) {
        const entry = costMap.get(specificKey)!;
        return { cost: entry.cost, currency: entry.currency };
      }
      // Check all sources
      for (const [key, val] of costMap) {
        if (key.endsWith(`:${offerId}`)) return { cost: val.cost, currency: val.currency };
      }
      return null;
    }

    // STEP 0: Exact SKU match (highest priority)
    const skuMatches: { targetOfferId: string; sourceOfferId: string; costPrice: number; currency: string }[] = [];
    const afterSkuTarget: any[] = [];

    for (const tp of targetProducts) {
      let matched = false;
      for (const sp of sourceWithCost) {
        if (skuMatch(tp.offerId, sp.offerId)) {
          const costEntry = getCostForSource(sp.offerId);
          if (costEntry && costEntry.cost > 0) {
            skuMatches.push({
              targetOfferId: tp.offerId,
              sourceOfferId: sp.offerId,
              costPrice: costEntry.cost,
              currency: costEntry.currency,
            });
            matched = true;
            break;
          }
        }
      }
      if (!matched) afterSkuTarget.push(tp);
    }
    console.log(`SKU matches: ${skuMatches.length}`);

    // STEP 1: Fast text-based matching (word overlap)
    const textMatches: typeof skuMatches = [];
    const unmatchedTarget: any[] = [];

    for (const tp of afterSkuTarget) {
      let bestScore = 0;
      let bestSource: any = null;

      for (const sp of sourceWithCost) {
        const score = wordOverlapScore(tp.name, sp.name);
        if (score > bestScore) {
          bestScore = score;
          bestSource = sp;
        }
      }

      if (bestScore >= 0.3 && bestSource) {
        const costEntry = getCostForSource(bestSource.offerId);
        if (costEntry && costEntry.cost > 0) {
          textMatches.push({
            targetOfferId: tp.offerId,
            sourceOfferId: bestSource.offerId,
            costPrice: costEntry.cost,
            currency: costEntry.currency,
          });
        }
      } else {
        unmatchedTarget.push(tp);
      }
    }
    console.log(`Text matching: ${textMatches.length} matches, ${unmatchedTarget.length} unmatched`);

    // STEP 2: AI matching for remaining
    const aiMatches: typeof textMatches = [];

    if (unmatchedTarget.length > 0 && sourceWithCost.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const AI_BATCH = 20;
        
        for (let i = 0; i < unmatchedTarget.length; i += AI_BATCH) {
          const targetBatch = unmatchedTarget.slice(i, i + AI_BATCH);
          
          const candidateSet = new Set<string>();
          for (const tp of targetBatch) {
            const scored = sourceWithCost
              .map((sp: any) => ({ sp, score: wordOverlapScore(tp.name, sp.name) }))
              .filter((x: any) => x.score > 0.1)
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 5);
            for (const s of scored) candidateSet.add(s.sp.offerId);
          }

          const candidates = sourceWithCost.filter((sp: any) => candidateSet.has(sp.offerId));
          if (candidates.length === 0) continue;

          const prompt = `Match target marketplace products to source marketplace products. Same physical product, different names/languages.

Target (${targetMarketplace}):
${targetBatch.map((t: any) => `- "${t.name}" [${t.offerId}]`).join('\n')}

Source (${sourceMarketplace}):
${candidates.map((s: any) => `- "${s.name}" [${s.offerId}]`).join('\n')}

Return JSON array only: [{"target":"offerId","source":"offerId"}]
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

            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              const matches = JSON.parse(jsonMatch[0]);
              for (const m of matches) {
                const sourceId = m.source || m.yx;
                const targetId = m.target || m.wb;
                const costEntry = getCostForSource(sourceId);
                if (costEntry && costEntry.cost > 0) {
                  aiMatches.push({
                    targetOfferId: targetId,
                    sourceOfferId: sourceId,
                    costPrice: costEntry.cost,
                    currency: costEntry.currency,
                  });
                }
              }
            }
          } catch (aiErr) {
            console.error('AI batch error:', aiErr);
          }

          if (i + AI_BATCH < unmatchedTarget.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
    }

    console.log(`AI matching: ${aiMatches.length} additional matches`);

    const allMatches = [...skuMatches, ...textMatches, ...aiMatches];
    console.log(`Total matches: ${allMatches.length}`);

    // ===== CRITICAL FIX: Don't overwrite existing manually-set cost prices =====
    // Get existing cost prices for the target marketplace to avoid overwriting
    const { data: existingTargetCosts } = await supabase
      .from('marketplace_cost_prices')
      .select('offer_id, cost_price')
      .eq('user_id', user.id)
      .eq('marketplace', targetMarketplace);
    
    const existingTargetMap = new Set<string>();
    (existingTargetCosts || []).forEach((cp: any) => {
      if (cp.cost_price > 0) existingTargetMap.add(cp.offer_id);
    });
    console.log(`Existing target cost prices: ${existingTargetMap.size} (will skip these)`);

    // Filter out matches where target already has a cost price
    const newMatches = allMatches.filter(m => !existingTargetMap.has(m.targetOfferId));
    const skippedExisting = allMatches.length - newMatches.length;
    console.log(`After filtering: ${newMatches.length} new, ${skippedExisting} skipped (already have cost price)`);

    // Determine target currency and conversion
    // RUB marketplaces: wildberries, ozon
    // UZS marketplaces: uzum, yandex
    const rubMarketplaces = ['wildberries', 'ozon'];
    const targetIsRub = rubMarketplaces.includes(targetMarketplace);
    const UZS_TO_RUB = 140; // Approximate cross-rate

    const insertEntries = newMatches.map(m => {
      let finalCost = m.costPrice;
      const sourceIsRub = m.currency === 'RUB';

      // Convert to target currency
      if (targetIsRub && !sourceIsRub) {
        // UZS → RUB
        finalCost = Math.round(m.costPrice / UZS_TO_RUB);
      } else if (!targetIsRub && sourceIsRub) {
        // RUB → UZS
        finalCost = Math.round(m.costPrice * UZS_TO_RUB);
      }
      // Same currency → no conversion

      return {
        user_id: user.id,
        marketplace: targetMarketplace,
        offer_id: m.targetOfferId,
        cost_price: finalCost,
        currency: targetIsRub ? 'RUB' : 'UZS',
      };
    });

    if (insertEntries.length > 0) {
      for (let i = 0; i < insertEntries.length; i += 50) {
        const batch = insertEntries.slice(i, i + 50);
        const { error: upsertErr } = await supabase
          .from('marketplace_cost_prices')
          .upsert(batch, { onConflict: 'user_id,marketplace,offer_id' });
        if (upsertErr) console.error('Upsert error:', upsertErr);
      }
      console.log(`Inserted ${insertEntries.length} cost prices for ${targetMarketplace}`);
    }

    // Deduct balance after successful matching
    if (billingPrice > 0 && newMatches.length > 0) {
      await supabase.rpc('deduct_balance', {
        p_user_id: user.id,
        p_amount: billingPrice,
        p_feature_key: 'ai-product-matching',
        p_description: `AI tannarx moslashtirish: ${newMatches.length} ta mahsulot (${targetMarketplace} ← ${sourceMarketplace})`,
      });
    }

    return new Response(JSON.stringify({
      matches: newMatches.length,
      total_target: targetProducts.length,
      total_source: sourceWithCost.length,
      sku_matches: skuMatches.length,
      text_matches: textMatches.length,
      ai_matches: aiMatches.length,
      skipped_existing: skippedExisting,
      target_marketplace: targetMarketplace,
      source_marketplace: sourceMarketplace,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Match error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
