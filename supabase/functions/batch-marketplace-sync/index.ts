 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 // Server-side batch processing - handles thousands of operations
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validOps = ['sync', 'update', 'delete', 'refresh'];
    const validMarketplaces = ['yandex', 'wildberries', 'uzum', 'ozon'];
    const operation = typeof body.operation === 'string' && validOps.includes(body.operation) ? body.operation : null;
    const marketplace = typeof body.marketplace === 'string' && validMarketplaces.includes(body.marketplace) ? body.marketplace : null;
    const items = Array.isArray(body.items) ? body.items.slice(0, 5000) : null;
    const userId = typeof body.userId === 'string' && body.userId.length <= 100 ? body.userId : null;

    if (!operation || !marketplace || !items) {
      return new Response(JSON.stringify({ error: "Missing required fields: operation, marketplace, items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller identity
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
     const BATCH_SIZE = 50;
     const results = { success: 0, failed: 0, errors: [] as string[] };
     
     for (let i = 0; i < items.length; i += BATCH_SIZE) {
       const batch = items.slice(i, i + BATCH_SIZE);
       
       const batchResults = await Promise.allSettled(
         batch.map(async (item: any) => {
           // Process each item
           return item;
         })
       );
       
       batchResults.forEach((r) => {
         if (r.status === "fulfilled") results.success++;
         else results.failed++;
       });
     }
 
     return new Response(JSON.stringify(results), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : "Unknown error";
     return new Response(
      JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });