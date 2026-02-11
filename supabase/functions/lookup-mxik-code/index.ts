import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function aiExtractKeywords(productName: string, category?: string, description?: string): Promise<string[]> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    // Fallback: basic keyword extraction
    return productName
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FFa-zA-Z'ʼ]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 2);
  }

  try {
    const prompt = `Siz O'zbekiston soliq tizimidagi MXIK (IKPU) kodlarini aniqlash uchun kalit so'zlar ajratuvchi AI siz.

Mahsulot: "${productName}"
${category ? `Kategoriya: "${category}"` : ''}
${description ? `Tavsif: "${description}"` : ''}

Ushbu mahsulot uchun MXIK kodini topish uchun eng muhim kalit so'zlarni ajrating.
Faqat mahsulot turini aniqlaydigan umumiy so'zlarni bering (brend, model raqami, rang kabi tafsilotlarni olib tashlang).

Masalan:
- "iPhone 15 Pro Max 256GB" -> ["telefon", "mobil telefon", "smartfon", "aloqa qurilmasi"]
- "Nike Air Max 90 erkaklar krossovkasi" -> ["poyabzal", "krossovka", "sport poyabzali"]
- "Samsung Galaxy Tab S9 planshet" -> ["planshet", "elektron qurilma", "kompyuter"]

Javobni faqat JSON array formatida bering, boshqa hech narsa yozmang:
["so'z1", "so'z2", "so'z3", "so'z4"]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Parse JSON array from response
    const match = content.match(/\[.*\]/s);
    if (match) {
      const keywords = JSON.parse(match[0]) as string[];
      return keywords.filter((k: string) => typeof k === 'string' && k.length > 1);
    }
  } catch (error) {
    console.error('AI keyword extraction failed:', error);
  }

  // Fallback
  return productName
    .toLowerCase()
    .replace(/[^\w\s\u0400-\u04FFa-zA-Z'ʼ]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 2);
}

async function aiBestMatch(
  matches: any[],
  productName: string,
  category?: string
): Promise<{ index: number; confidence: number }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey || matches.length <= 1) {
    return { index: 0, confidence: matches.length > 0 ? 70 : 30 };
  }

  try {
    const options = matches.slice(0, 10).map((m, i) => 
      `${i + 1}. Kod: ${m.code} | Nomi: ${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''}${m.group_name ? ` | Guruh: ${m.group_name}` : ''}`
    ).join('\n');

    const prompt = `Mahsulot: "${productName}"${category ? ` (Kategoriya: ${category})` : ''}

Quyidagi MXIK kodlardan eng mosini tanlang:
${options}

Javobni faqat JSON formatida bering:
{"index": <raqam 1 dan boshlab>, "confidence": <0-100 orasida soniya>}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    const match = content.match(/\{.*\}/s);
    if (match) {
      const result = JSON.parse(match[0]);
      const idx = Math.max(0, Math.min((result.index || 1) - 1, matches.length - 1));
      const conf = Math.max(30, Math.min(result.confidence || 70, 99));
      return { index: idx, confidence: conf };
    }
  } catch (error) {
    console.error('AI best match failed:', error);
  }

  return { index: 0, confidence: 70 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    console.log('[MXIK] Looking up:', productName);

    // Step 1: AI-powered keyword extraction
    const keywords = await aiExtractKeywords(productName, category, description);
    console.log('[MXIK] AI keywords:', keywords);

    // Step 2: Search database with multiple strategies
    let matches: any[] = [];

    // Strategy A: Full-text search with keywords
    for (const keyword of keywords.slice(0, 4)) {
      const { data } = await supabase
        .from('mxik_codes')
        .select('*')
        .or(`name_uz.ilike.%${keyword}%,name_ru.ilike.%${keyword}%,group_name.ilike.%${keyword}%`)
        .eq('is_active', true)
        .limit(10);
      
      if (data) matches.push(...data);
    }

    // Strategy B: Try original product name words too
    const originalWords = productName
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FFa-zA-Z]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 3);

    for (const word of originalWords.slice(0, 2)) {
      if (!keywords.includes(word)) {
        const { data } = await supabase
          .from('mxik_codes')
          .select('*')
          .or(`name_uz.ilike.%${word}%,name_ru.ilike.%${word}%`)
          .eq('is_active', true)
          .limit(5);
        
        if (data) matches.push(...data);
      }
    }

    // Deduplicate
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.code, m])).values()
    );

    console.log('[MXIK] Found matches:', uniqueMatches.length);

    if (uniqueMatches.length === 0) {
      return new Response(
        JSON.stringify({
          mxik_code: '46901100001000000',
          mxik_name: 'Boshqa tovarlar',
          name_ru: 'Прочие товары',
          vat_rate: 12,
          confidence: 25,
          alternatives: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: AI selects the best match
    const { index: bestIdx, confidence } = await aiBestMatch(uniqueMatches, productName, category);
    const bestMatch = uniqueMatches[bestIdx];

    console.log('[MXIK] Best match:', bestMatch.name_uz, 'confidence:', confidence);

    const alternatives = uniqueMatches
      .filter((_, i) => i !== bestIdx)
      .slice(0, 4)
      .map((m, i) => ({
        code: m.code,
        name_uz: m.name_uz,
        name_ru: m.name_ru || undefined,
        confidence: Math.max(25, confidence - (12 * (i + 1))),
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
    console.error('[MXIK] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
