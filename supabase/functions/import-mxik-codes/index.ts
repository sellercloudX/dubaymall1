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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user is admin
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for inserts
    const supabase = createClient(supabaseUrl, serviceKey);

    const { records, clearExisting } = await req.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: 'No records provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[MXIK Import] Importing ${records.length} records, clearExisting: ${clearExisting}`);

    // Optionally clear existing
    if (clearExisting) {
      const { error: delError } = await supabase.from('mxik_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delError) console.error('Clear error:', delError);
      else console.log('Cleared existing MXIK codes');
    }

    // Batch insert in chunks of 500
    let inserted = 0;
    let errors = 0;
    const chunkSize = 500;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize).map((r: any) => ({
        code: String(r.code || '').trim(),
        name_uz: String(r.name_uz || r.name || '').trim(),
        name_ru: r.name_ru ? String(r.name_ru).trim() : null,
        group_name: r.group_name ? String(r.group_name).trim() : null,
        group_code: r.group_code ? String(r.group_code).trim() : null,
        unit_name: r.unit_name ? String(r.unit_name).trim() : null,
        unit_code: r.unit_code ? String(r.unit_code).trim() : null,
        vat_rate: r.vat_rate != null ? Number(r.vat_rate) : 12,
        is_active: true,
      })).filter((r: any) => r.code && r.code.length >= 5 && r.name_uz);

      if (chunk.length === 0) continue;

      const { error: insertError, data } = await supabase
        .from('mxik_codes')
        .upsert(chunk, { onConflict: 'code', ignoreDuplicates: false });

      if (insertError) {
        console.error(`Chunk ${i} error:`, insertError);
        errors += chunk.length;
      } else {
        inserted += chunk.length;
      }
    }

    console.log(`[MXIK Import] Done: ${inserted} inserted, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      inserted,
      errors,
      total: records.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[MXIK Import] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
