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
 
     // Step 1: AI orqali kalit so'zlarni ajratish
     let keywords: string[] = [];
     
     if (lovableApiKey) {
       try {
         const keywordPrompt = `Quyidagi mahsulot nomidan O'zbekiston MXIK (IKPU) klassifikatori uchun qidiruv kalit so'zlarini ajrat.
 
 Mahsulot: ${productName}
 ${category ? `Kategoriya: ${category}` : ''}
 ${description ? `Tavsif: ${description}` : ''}
 
 Faqat qidiruv uchun foydali bo'lgan 3-5 ta kalit so'zni vergul bilan ajratib yoz.
 Masalan: telefon, smartphone, mobil qurilma
 Yoki: krossovka, sport poyabzal, yugurish
 
 Javob (faqat so'zlar, hech qanday izoh yo'q):`;
 
         const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${lovableApiKey}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             model: 'google/gemini-2.5-flash-lite',
             messages: [
               { role: 'user', content: keywordPrompt }
             ],
             max_tokens: 100,
           }),
         });
 
         if (aiResponse.ok) {
           const aiData = await aiResponse.json();
           const keywordText = aiData.choices?.[0]?.message?.content || '';
           keywords = keywordText.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 2);
           console.log('AI extracted keywords:', keywords);
         }
       } catch (e) {
         console.error('AI keyword extraction failed:', e);
       }
     }
 
     // Fallback: mahsulot nomidan oddiy kalit so'zlar
     if (keywords.length === 0) {
       keywords = productName.toLowerCase()
         .replace(/[^\w\s\u0400-\u04FFa-zA-Z]/g, ' ')
         .split(/\s+/)
         .filter((w: string) => w.length > 2);
     }
 
     console.log('Search keywords:', keywords);
 
     // Step 2: Database'dan qidirish
     // 2a: Full-text search
     let matches: MxikCode[] = [];
     
     // Trigram search for each keyword
     for (const keyword of keywords.slice(0, 3)) {
       const { data: trigramResults } = await supabase
         .from('mxik_codes')
         .select('*')
         .or(`name_uz.ilike.%${keyword}%,name_ru.ilike.%${keyword}%,group_name.ilike.%${keyword}%`)
         .eq('is_active', true)
         .limit(10);
       
       if (trigramResults) {
         matches.push(...trigramResults);
       }
     }
 
     // Remove duplicates
     const uniqueMatches = Array.from(
       new Map(matches.map(m => [m.code, m])).values()
     );
 
     console.log('Found matches:', uniqueMatches.length);
 
     if (uniqueMatches.length === 0) {
       // Fallback to default
       const { data: defaultCode } = await supabase
         .from('mxik_codes')
         .select('*')
         .eq('code', '46901100001000000')
         .single();
 
       if (defaultCode) {
         return new Response(
           JSON.stringify({
             mxik_code: defaultCode.code,
             mxik_name: defaultCode.name_uz,
             name_ru: defaultCode.name_ru,
             vat_rate: defaultCode.vat_rate,
             confidence: 50,
             alternatives: [],
           }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
     }
 
     // Step 3: AI orqali eng mosini tanlash
     let bestMatch: MxikCode | null = null;
     let confidence = 70;
     let alternatives: Array<{ code: string; name_uz: string; name_ru?: string; confidence: number }> = [];
 
     if (lovableApiKey && uniqueMatches.length > 1) {
       try {
         const matchList = uniqueMatches.slice(0, 10).map((m, i) => 
           `${i + 1}. ${m.code} - ${m.name_uz}${m.name_ru ? ` (${m.name_ru})` : ''}`
         ).join('\n');
 
         const selectPrompt = `Quyidagi mahsulot uchun eng mos MXIK kodini tanlang.
 
 Mahsulot: ${productName}
 ${category ? `Kategoriya: ${category}` : ''}
 
 Mavjud variantlar:
 ${matchList}
 
 Faqat eng mos variant raqamini yozing (1, 2, 3...). Hech qanday izoh yo'q.`;
 
         const selectResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${lovableApiKey}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             model: 'google/gemini-3-flash-preview',
             messages: [
               { role: 'user', content: selectPrompt }
             ],
             max_tokens: 10,
           }),
         });
 
         if (selectResponse.ok) {
           const selectData = await selectResponse.json();
           const selectedText = selectData.choices?.[0]?.message?.content || '1';
           const selectedIndex = parseInt(selectedText.replace(/\D/g, '')) - 1;
           
           if (selectedIndex >= 0 && selectedIndex < uniqueMatches.length) {
             bestMatch = uniqueMatches[selectedIndex];
             confidence = 90;
           }
         }
       } catch (e) {
         console.error('AI selection failed:', e);
       }
     }
 
     // Fallback: birinchi natijani olish
     if (!bestMatch && uniqueMatches.length > 0) {
       bestMatch = uniqueMatches[0];
     }
 
     // Alternativalarni tayyorlash
     alternatives = uniqueMatches
       .filter(m => m.code !== bestMatch?.code)
       .slice(0, 3)
       .map((m, i) => ({
         code: m.code,
         name_uz: m.name_uz,
         name_ru: m.name_ru || undefined,
         confidence: Math.max(50, confidence - (10 * (i + 1))),
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
 
     // No match found
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