import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TASNIF_API = 'https://tasnif.soliq.uz/api/cls-api';

interface MxikDbRow {
  code: string;
  name_uz: string;
  name_ru: string | null;
  group_name: string | null;
  vat_rate: number | null;
}

// ===== STEP 1: Search local mxik_codes database =====
async function searchLocalDB(
  supabase: any,
  productName: string,
  category?: string
): Promise<MxikDbRow[]> {
  const results: MxikDbRow[] = [];

  // Clean search terms
  const cleanName = productName
    .replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, ' ')
    .replace(/\b(для|с|и|в|на|от|из|к|по|без|до|за|не|ни|же|или|но|а|то|это|the|a|an|of|for|with)\b/gi, '')
    .trim();

  const words = cleanName.split(/\s+/).filter(w => w.length > 2);

  // Try full-text search first
  if (words.length > 0) {
    const searchQuery = words.slice(0, 4).join(' & ');
    try {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name, vat_rate')
        .textSearch('search_vector', searchQuery, { type: 'plain' })
        .eq('is_active', true)
        .limit(20);
      if (data?.length) results.push(...data);
    } catch (e) {
      console.log('[MXIK DB] Full-text search failed, trying ILIKE');
    }
  }

  // If no results, try ILIKE search with individual words
  if (results.length === 0) {
    for (const word of words.slice(0, 3)) {
      if (word.length < 3) continue;
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name, vat_rate')
        .or(`name_uz.ilike.%${word}%,name_ru.ilike.%${word}%,group_name.ilike.%${word}%`)
        .eq('is_active', true)
        .limit(15);
      if (data?.length) results.push(...data);
    }
  }

  // Also search by category if provided
  if (category && results.length < 5) {
    const catWords = category.split(/\s+/).filter(w => w.length > 2).slice(0, 2);
    for (const word of catWords) {
      const { data } = await supabase
        .from('mxik_codes')
        .select('code, name_uz, name_ru, group_name, vat_rate')
        .or(`name_uz.ilike.%${word}%,name_ru.ilike.%${word}%,group_name.ilike.%${word}%`)
        .eq('is_active', true)
        .limit(10);
      if (data?.length) results.push(...data);
    }
  }

  // Deduplicate
  const unique = Array.from(new Map(results.map(r => [r.code, r])).values());
  console.log(`[MXIK DB] Found ${unique.length} results from local DB`);
  return unique;
}

// ===== STEP 2: Search tasnif.soliq.uz API =====
async function searchTasnif(keyword: string, lang = 'ru'): Promise<any[]> {
  try {
    const url = `${TASNIF_API}/elasticsearch/search?search=${encodeURIComponent(keyword)}&size=15&page=0&lang=${lang}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.content || [];
  } catch {
    return [];
  }
}

// ===== STEP 3: AI selects best code from REAL results =====
async function aiSelectBestCode(
  productName: string,
  category: string | undefined,
  description: string | undefined,
  dbResults: MxikDbRow[],
  tasnifResults: any[]
): Promise<{
  mxik_code: string;
  mxik_name: string;
  name_ru?: string;
  vat_rate: number;
  confidence: number;
  alternatives: Array<{ code: string; name_uz: string; name_ru?: string; confidence: number }>;
}> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  // Build candidate list from DB + Tasnif
  const candidates: Array<{ code: string; name_uz: string; name_ru?: string; source: string }> = [];

  for (const r of dbResults) {
    candidates.push({
      code: r.code,
      name_uz: r.name_uz,
      name_ru: r.name_ru || undefined,
      source: 'database',
    });
  }

  for (const t of tasnifResults) {
    const fullName = [t.groupName, t.className, t.positionName, t.subPositionName, t.attributeName]
      .filter(Boolean).join(' > ');
    if (!candidates.some(c => c.code === t.mxikCode)) {
      candidates.push({
        code: t.mxikCode,
        name_uz: fullName,
        source: 'tasnif',
      });
    }
  }

  if (candidates.length === 0) {
    throw new Error('Hech qanday MXIK kod topilmadi');
  }

  const candidateList = candidates.slice(0, 30).map((c, i) =>
    `${i + 1}. ${c.code} — ${c.name_uz}${c.name_ru ? ` (${c.name_ru})` : ''} [${c.source}]`
  ).join('\n');

  const prompt = `Mahsulot: "${productName}"
${category ? `Kategoriya: "${category}"` : ''}
${description ? `Tavsif: "${description}"` : ''}

Quyidagi RO'YXATDAN eng mos MXIK kodini tanlang.
MUHIM: Faqat shu ro'yxatdagi kodlardan birini tanlang! O'zingizdan kod to'qib chiqarmang!

${candidateList}

Javobni FAQAT JSON formatida bering:
{
  "selected_index": 1,
  "mxik_code": "ro'yxatdagi kod",
  "mxik_name": "nomi",
  "name_ru": "ruscha nomi",
  "vat_rate": 12,
  "confidence": 90,
  "alternatives": [
    {"index": 2, "code": "kod", "name_uz": "nomi", "confidence": 75}
  ]
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Sen MXIK kod mutaxassisizan. FAQAT berilgan ro\'yxatdagi kodlardan tanlaysan. Yangi kod to\'qib chiqarma. JSON formatda javob ber.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 400,
    }),
  });

  if (!response.ok) throw new Error(`AI error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    const result = JSON.parse(match[0]);
    const selectedCode = String(result.mxik_code || '');

    // CRITICAL: Validate that the code is actually from our candidates
    const isValid = candidates.some(c => c.code === selectedCode);
    if (!isValid && candidates.length > 0) {
      // AI hallucinated — fall back to first candidate
      console.warn(`[MXIK] AI returned invalid code ${selectedCode}, falling back to first candidate`);
      const fallback = candidates[0];
      return {
        mxik_code: fallback.code,
        mxik_name: fallback.name_uz,
        name_ru: fallback.name_ru,
        vat_rate: 12,
        confidence: 60,
        alternatives: candidates.slice(1, 4).map(c => ({
          code: c.code,
          name_uz: c.name_uz,
          name_ru: c.name_ru,
          confidence: 50,
        })),
      };
    }

    return {
      mxik_code: selectedCode,
      mxik_name: result.mxik_name || productName,
      name_ru: result.name_ru || undefined,
      vat_rate: result.vat_rate ?? 12,
      confidence: Math.min(result.confidence || 70, 99),
      alternatives: (result.alternatives || []).slice(0, 5)
        .map((a: any) => {
          const altCode = String(a.code || '');
          // Only include valid alternatives
          if (!candidates.some(c => c.code === altCode)) return null;
          return {
            code: altCode,
            name_uz: a.name_uz || '',
            name_ru: a.name_ru || undefined,
            confidence: Math.min(a.confidence || 50, 95),
          };
        })
        .filter(Boolean),
    };
  }

  // Fallback to first candidate
  const fallback = candidates[0];
  return {
    mxik_code: fallback.code,
    mxik_name: fallback.name_uz,
    name_ru: fallback.name_ru,
    vat_rate: 12,
    confidence: 50,
    alternatives: candidates.slice(1, 4).map(c => ({
      code: c.code,
      name_uz: c.name_uz,
      name_ru: c.name_ru,
      confidence: 40,
    })),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { productName, category, description } = await req.json();
    if (!productName) {
      return new Response(JSON.stringify({ error: 'productName is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[MXIK] Looking up:', productName);

    // STEP 1: Search local database (MXIK codes from Excel)
    const dbResults = await searchLocalDB(supabase, productName, category);

    // STEP 2: Search tasnif.soliq.uz API in parallel
    const cleanName = productName
      .replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, ' ')
      .replace(/\b(для|с|и|в|на|от|из|к|по|без|до|за|не|ни|же|или|но|а|то|это)\b/gi, '')
      .trim();
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    const searchTerms = [
      productName.slice(0, 50),
      words.slice(0, 3).join(' '),
      category || '',
    ].filter(Boolean);

    const allTasnif: any[] = [];
    for (const term of searchTerms) {
      if (!term) continue;
      const [ruRes, uzRes] = await Promise.all([
        searchTasnif(term, 'ru'),
        searchTasnif(term, 'uz'),
      ]);
      allTasnif.push(...ruRes, ...uzRes);
    }
    const uniqueTasnif = Array.from(new Map(allTasnif.map(i => [i.mxikCode, i])).values());

    console.log(`[MXIK] DB: ${dbResults.length}, Tasnif: ${uniqueTasnif.length}`);

    // STEP 3: AI selects best code from REAL results only
    const result = await aiSelectBestCode(productName, category, description, dbResults, uniqueTasnif);

    console.log('[MXIK] Result:', result.mxik_code, result.mxik_name, 'confidence:', result.confidence);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MXIK] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
