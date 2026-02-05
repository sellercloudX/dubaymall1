import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { productName, category, description } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'productName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Looking up MXIK for:', productName);

    // Extract keywords from product name
    const searchText = [productName, category, description].filter(Boolean).join(' ');
    const keywords = searchText
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FFa-zA-Z']/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    console.log('Keywords:', keywords.slice(0, 5));

    // Search database
    let matches: any[] = [];
    
    for (const keyword of keywords.slice(0, 3)) {
      const { data } = await supabase
        .from('mxik_codes')
        .select('*')
        .or(`name_uz.ilike.%${keyword}%,name_ru.ilike.%${keyword}%`)
        .eq('is_active', true)
        .limit(10);
      
      if (data) matches.push(...data);
    }

    // Remove duplicates
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.code, m])).values()
    );

    console.log('Found matches:', uniqueMatches.length);

    if (uniqueMatches.length === 0) {
      return new Response(
        JSON.stringify({
          mxik_code: '46901100001000000',
          mxik_name: 'Boshqa tovarlar',
          name_ru: 'Прочие товары',
          vat_rate: 12,
          confidence: 30,
          alternatives: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use first match as best
    const bestMatch = uniqueMatches[0];
    const confidence = 75;

    const alternatives = uniqueMatches
      .slice(1, 5)
      .map((m, i) => ({
        code: m.code,
        name_uz: m.name_uz,
        name_ru: m.name_ru || undefined,
        confidence: Math.max(40, confidence - (15 * (i + 1))),
      }));

    return new Response(
      JSON.stringify({
        mxik_code: bestMatch.code,
        mxik_name: bestMatch.name_uz,
        name_ru: bestMatch.name_ru || undefined,
        vat_rate: bestMatch.vat_rate || 12,
        confidence,
        alternatives,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('MXIK lookup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
