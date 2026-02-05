import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MxikCode {
  id: string;
  code: string;
  name_uz: string;
  name_ru: string | null;
  group_code: string | null;
  group_name: string | null;
  unit_code: string | null;
  unit_name: string | null;
  vat_rate: number;
  is_active: boolean;
}

interface LookupResult {
  mxik_code: string;
  mxik_name: string;
  name_ru?: string;
  vat_rate: number;
  confidence: number;
  alternatives: Array<{
    code: string;
    name_uz: string;
    name_ru?: string;
    confidence: number;
  }>;
}

// Normalize text for better matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['''`]/g, "'")
    .replace(/[^\w\s\u0400-\u04FFa-zA-Z']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract meaningful keywords
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const stopWords = ['va', 'uchun', 'bilan', 'dan', 'ga', 'ning', 'для', 'и', 'с', 'на', 'the', 'and', 'for', 'with'];
  return normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));
}

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Looking up MXIK for:', { productName, category, description });

    // Step 1: Extract keywords from product name
    const searchText = [productName, category, description].filter(Boolean).join(' ');
    const keywords = extractKeywords(searchText);
    
    console.log('Extracted keywords:', keywords);

    // Step 2: Use AI to identify the most relevant search terms
    let aiKeywords: string[] = [];
    
    if (lovableApiKey && keywords.length > 0) {
      try {
        const keywordPrompt = `Quyidagi mahsulot uchun O'zbekiston MXIK (IKPU) klassifikatorida qidirish uchun eng muhim 2-3 ta kalit so'zni ajrat.

Mahsulot: ${productName}
${category ? `Kategoriya: ${category}` : ''}

MUHIM: Faqat o'zbekcha yoki ruscha kalit so'zlarni ajrat, masalan:
- "iPhone 15 Pro Max" -> "smartfon, telefon"
- "Nike Air Max" -> "krossovka, sport poyabzal"
- "Samsung TV 55" -> "televizor"

Javob (faqat so'zlar, vergul bilan ajratilgan):`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [{ role: 'user', content: keywordPrompt }],
            max_tokens: 50,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const keywordText = aiData.choices?.[0]?.message?.content || '';
          aiKeywords = keywordText
            .split(',')
            .map((k: string) => normalizeText(k))
            .filter((k: string) => k.length > 2);
          console.log('AI keywords:', aiKeywords);
        }
      } catch (e) {
        console.error('AI keyword extraction failed:', e);
      }
    }

    // Combine AI keywords with original keywords
    const allKeywords = [...new Set([...aiKeywords, ...keywords.slice(0, 3)])];
    console.log('All search keywords:', allKeywords);

    // Step 3: Search database with multiple strategies
    let matches: MxikCode[] = [];
    
    // Strategy 1: Full-text search on search_vector
    for (const keyword of allKeywords.slice(0, 3)) {
      try {
        const { data: ftsResults } = await supabase
          .from('mxik_codes')
          .select('*')
          .textSearch('search_vector', keyword, { type: 'websearch' })
          .eq('is_active', true)
          .limit(5);
        
        if (ftsResults && ftsResults.length > 0) {
          matches.push(...ftsResults);
        }
      } catch (e) {
        console.log('FTS search failed for:', keyword);
      }
    }

    // Strategy 2: ILIKE search
    for (const keyword of allKeywords.slice(0, 3)) {
      const { data: ilikeResults } = await supabase
        .from('mxik_codes')
        .select('*')
        .or(`name_uz.ilike.%${keyword}%,name_ru.ilike.%${keyword}%,group_name.ilike.%${keyword}%`)
        .eq('is_active', true)
        .limit(10);
      
      if (ilikeResults) {
        matches.push(...ilikeResults);
      }
    }

    // Remove duplicates
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.code, m])).values()
    );

    console.log('Found unique matches:', uniqueMatches.length);

    if (uniqueMatches.length === 0) {
      // Return default code
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

    // Step 4: Rank results using AI
    let bestMatch: MxikCode | null = null;
    let confidence = 70;

    if (lovableApiKey && uniqueMatches.length > 1) {
      try {
        const matchList = uniqueMatches.slice(0, 8).map((m, i) => 
          `${i + 1}. ${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''} - ${m.code}`
        ).join('\n');

        const selectPrompt = `Quyidagi mahsulot uchun eng mos MXIK kodini tanlang.

Mahsulot: ${productName}
${category ? `Kategoriya: ${category}` : ''}

Variantlar:
${matchList}

Faqat eng mos variant raqamini yozing (1, 2, 3...). Agar aniq mos kelmasa, eng yaqin variantni tanlang.`;

        const selectResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [{ role: 'user', content: selectPrompt }],
            max_tokens: 10,
          }),
        });

        if (selectResponse.ok) {
          const selectData = await selectResponse.json();
          const selectedText = selectData.choices?.[0]?.message?.content || '1';
          const selectedIndex = parseInt(selectedText.replace(/\D/g, '')) - 1;
          
          if (selectedIndex >= 0 && selectedIndex < uniqueMatches.length) {
            bestMatch = uniqueMatches[selectedIndex];
            confidence = 85;
          }
        }
      } catch (e) {
        console.error('AI selection failed:', e);
      }
    }

    // Fallback: use first match
    if (!bestMatch && uniqueMatches.length > 0) {
      bestMatch = uniqueMatches[0];
    }

    // Prepare alternatives
    const alternatives = uniqueMatches
      .filter(m => m.code !== bestMatch?.code)
      .slice(0, 4)
      .map((m, i) => ({
        code: m.code,
        name_uz: m.name_uz,
        name_ru: m.name_ru || undefined,
        confidence: Math.max(40, confidence - (15 * (i + 1))),
      }));

    if (bestMatch) {
      const result: LookupResult = {
        mxik_code: bestMatch.code,
        mxik_name: bestMatch.name_uz,
        name_ru: bestMatch.name_ru || undefined,
        vat_rate: bestMatch.vat_rate,
        confidence,
        alternatives,
      };

      console.log('MXIK lookup result:', result);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No match found - return default
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

  } catch (error) {
    console.error('MXIK lookup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});