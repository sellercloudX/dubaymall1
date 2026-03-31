import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SELLZEN_URL = "https://qqqzkrldaaqogwjvfgcg.supabase.co/functions/v1/api-generate";

const STYLE_PRESETS: Record<string, { style: string; scene: string; label: string }> = {
  infographic: { style: 'infografika', scene: 'premium', label: 'Modelli Infografika' },
  lifestyle: { style: 'lifestyle', scene: 'tabiat', label: 'Lifestyle / Ishlatilish' },
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

    const { action, imageBase64, category, productName, styles, template, mode } = await req.json();

    if (action === "generate_images") {
      // Generate multiple styled images from one source image
      const selectedStyles = styles || ['infographic', 'lifestyle', 'minimalist'];
      const results: Array<{ style: string; label: string; url: string | null; error?: string }> = [];

      const promises = selectedStyles.map(async (styleKey: string) => {
        const preset = STYLE_PRESETS[styleKey];
        if (!preset) return { style: styleKey, label: styleKey, url: null, error: 'Unknown style' };

        try {
          const body = {
            imageBase64,
            mode: mode || 'modelsiz',
            style: preset.style,
            scene: preset.scene,
            language: 'uz',
            category: category || 'home',
            productDetails: (productName || '').substring(0, 500),
            ...(template ? { template } : {}),
          };

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
            console.error(`SellZen ${styleKey} error ${response.status}: ${errText}`);
            return { style: styleKey, label: preset.label, url: null, error: `SellZen xatosi: ${response.status}` };
          }

          const data = await response.json();
          if (data.status === 'success') {
            const imageUrl = data.imageUrl || data.generatedImage;
            if (imageUrl) {
              return { style: styleKey, label: preset.label, url: imageUrl };
            }
          }
          return { style: styleKey, label: preset.label, url: null, error: 'Rasm generatsiya qilinmadi' };
        } catch (e) {
          console.error(`SellZen ${styleKey} exception:`, e);
          return { style: styleKey, label: preset.label, url: null, error: String(e) };
        }
      });

      const settled = await Promise.all(promises);
      results.push(...settled);

      await logUsage(supabase, userId, 'sellzen_studio', 'sellzen-image');

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_video") {
      // Video generation from image via SellZen
      try {
        const response = await fetch(
          "https://qqqzkrldaaqogwjvfgcg.supabase.co/functions/v1/api-video",
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': sellzenKey,
            },
            body: JSON.stringify({
              imageBase64,
              productName: (productName || '').substring(0, 300),
              template: template || 'product_showcase',
              category: category || 'home',
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error(`SellZen video error ${response.status}: ${errText}`);
          return new Response(JSON.stringify({ error: `Video generatsiya xatosi: ${response.status}` }), {
            status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await response.json();
        await logUsage(supabase, userId, 'sellzen_studio_video', 'sellzen-video');

        return new Response(JSON.stringify({
          videoUrl: data.videoUrl || data.url,
          status: data.status,
          taskId: data.taskId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error('Video generation error:', e);
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sellzen-studio error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
