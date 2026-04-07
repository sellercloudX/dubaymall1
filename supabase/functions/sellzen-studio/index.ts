import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SELLZEN_URL = "https://yyrlkbbnemimflbeddzq.supabase.co/functions/v1/webhook-generate";

const MARKETPLACE_MAP: Record<string, string> = {
  uzum: "uzum",
  wildberries: "wildberries",
  ozon: "ozon",
  yandex: "yandex",
};

async function checkRateLimit(supabase: any, userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count } = await supabase
    .from('ai_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', 'sellzen_studio')
    .gte('created_at', oneHourAgo);
  return (count || 0) < 10;
}

async function logUsage(supabase: any, userId: string, action: string, model: string) {
  await supabase.from('ai_usage_log').insert({
    user_id: userId,
    action_type: action,
    model_used: model,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sellzenKey = Deno.env.get("SELLZEN_API_KEY");
    
    if (!sellzenKey) {
      return new Response(JSON.stringify({ error: "SELLZEN_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    let userId: string;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }).auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const allowed = await checkRateLimit(supabase, userId);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Soatiga 10 ta so'rov limiti. Keyinroq urinib ko'ring." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ BILLING: check_feature_access + deduct_balance ═══
    const { data: billingAccess } = await supabase.rpc('check_feature_access', {
      p_user_id: userId,
      p_feature_key: 'sellzen-image-generate',
    });
    const ba = billingAccess as any;
    if (ba && !ba.allowed) {
      return new Response(JSON.stringify({ 
        error: ba.message || 'Ruxsat berilmadi',
        billingError: ba.error,
        price: ba.price,
        balance: ba.balance,
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const billingPrice = ba?.price || 0;

    const { action, imageBase64, productName, productDescription, category, marketplace, style, variants } = await req.json();

    if (action === "generate_images") {
      // Build request for SellZen API v3
      const body: Record<string, any> = {
        product_name: productName || "Mahsulot",
        marketplace: MARKETPLACE_MAP[marketplace || "wildberries"] || "wildberries",
      };

      // v3: use variants array (default both infographic + lifestyle)
      if (variants && Array.isArray(variants) && variants.length > 0) {
        body.variants = variants;
      } else {
        // Default: generate both variants
        body.variants = ["infographic", "lifestyle"];
      }

      if (productDescription) body.product_description = productDescription;

      // Send image as base64
      if (imageBase64) {
        if (imageBase64.startsWith("data:image/")) {
          body.product_image_base64 = imageBase64;
        } else {
          body.product_image_base64 = `data:image/jpeg;base64,${imageBase64}`;
        }
      }

      if (category) body.category = category;

      console.log(`SellZen v3 request: marketplace=${body.marketplace}, variants=${JSON.stringify(body.variants)}`);

      try {
        const response = await fetch(SELLZEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': sellzenKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`SellZen v3 error ${response.status}: ${errText}`);
          return new Response(JSON.stringify({ 
            error: `SellZen xatosi: ${response.status}`,
            details: errText,
          }), {
            status: response.status, 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await response.json();
        console.log(`SellZen v3 response: success=${data.success}, images=${data.images?.length}, job_id=${data.job_id}`);

        if (data.success && data.images?.length > 0) {
          // Map v3 API response to our format
          const results = data.images.map((img: any) => ({
            style: img.variant,
            label: img.variant === 'infographic' ? 'Infografika' : 'Lifestyle',
            url: img.image_url,
            format: img.format || 'png',
          }));

          // Include any partial errors from v3
          if (data.errors?.length > 0) {
            data.errors.forEach((err: any) => {
              results.push({
                style: err.variant,
                label: err.variant === 'infographic' ? 'Infografika' : 'Lifestyle',
                url: null,
                error: err.error,
              });
            });
          }

          // Deduct balance for each successfully generated image
          const successfulImages = data.images.length;
          if (billingPrice > 0 && successfulImages > 0) {
            for (let i = 0; i < successfulImages; i++) {
              await supabase.rpc('deduct_balance', {
                p_user_id: userId,
                p_amount: billingPrice,
                p_feature_key: 'sellzen-image-generate',
                p_description: `SellZen rasm (${i + 1}/${successfulImages}): ${body.product_name?.substring(0, 40) || 'N/A'}`,
              });
            }
          }

          await logUsage(supabase, userId, 'sellzen_studio', 'sellzen-v3');

          return new Response(JSON.stringify({ 
            results,
            summary: data.summary,
            job_id: data.job_id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // No images generated
        return new Response(JSON.stringify({ 
          results: [],
          error: data.error || 'Rasm generatsiya qilinmadi',
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (e) {
        console.error('SellZen v3 exception:', e);
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: generate_images" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sellzen-studio error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
