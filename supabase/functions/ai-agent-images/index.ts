import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Analyze image quality using Gemini Vision
async function analyzeImageQuality(imageUrl: string): Promise<{
  score: number;
  issues: string[];
  suggestions: string[];
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Sen marketplace mahsulot rasmlarini baholaydigan ekspertsan. 
Rasm sifatini 0-100 ball orasida bahola va muammolarni aniqla.
FAQAT JSON javob ber:
{
  "score": 85,
  "issues": ["Fon sifatsiz", "Yoritish past"],
  "suggestions": ["Oq fonga o'tkazish", "Rasmni yoritish"]
}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Bu marketplace mahsulot rasmini sifat jihatidan bahola. Marketplace standarlariga (oq fon, yuqori aniqlik, professional ko'rinish) mos kelishini tekshir." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) return { score: -1, issues: ["Rate limit"], suggestions: [] };
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return { score: 50, issues: ["Tahlil qilib bo'lmadi"], suggestions: [] };

  try {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch {
    return { score: 50, issues: ["JSON xatosi"], suggestions: [] };
  }
}

// Generate improved product image using Gemini image model
async function generateImprovedImage(productName: string, category: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Professional e-commerce product photo of "${productName}" (category: ${category}). Clean white background, studio lighting, high resolution, no text or watermarks. Product centered, sharp focus, commercial quality.`
          }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imageUrl || null;
  } catch (e) {
    console.error("Image generation error:", e);
    return null;
  }
}

// Upload base64 image to Supabase storage and return public URL
async function uploadImageToStorage(
  supabase: any, 
  base64Data: string, 
  partnerId: string, 
  productId: string
): Promise<string | null> {
  try {
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    const fileName = `ai-agent/${partnerId}/${productId}-${Date.now()}.png`;
    
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminPerm } = await supabase
      .from('admin_permissions')
      .select('is_super_admin, can_manage_users')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminPerm?.is_super_admin && !adminPerm?.can_manage_users) {
      return new Response(JSON.stringify({ error: 'Admin ruxsati yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action, partnerId, products, marketplace } = body;

    if (action === 'analyze') {
      // Analyze images for given products
      const results: any[] = [];
      for (const product of (products || []).slice(0, 10)) {
        const imageUrls = product.images || product.pictures || [];
        if (imageUrls.length === 0) {
          results.push({
            offerId: product.offerId,
            name: product.name,
            avgScore: 0,
            imageCount: 0,
            analyses: [],
            needsReplacement: true,
          });
          continue;
        }

        const analyses: any[] = [];
        for (const url of imageUrls.slice(0, 5)) {
          try {
            const analysis = await analyzeImageQuality(url);
            analyses.push({ url, ...analysis });
            await sleep(500);
          } catch (e) {
            analyses.push({ url, score: -1, issues: [e.message], suggestions: [] });
          }
        }

        const validScores = analyses.filter(a => a.score >= 0);
        const avgScore = validScores.length > 0 
          ? Math.round(validScores.reduce((s, a) => s + a.score, 0) / validScores.length) 
          : 0;

        results.push({
          offerId: product.offerId,
          name: product.name,
          avgScore,
          imageCount: imageUrls.length,
          analyses,
          needsReplacement: avgScore < 60,
        });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate') {
      // Generate improved images for a product
      const { productName, category, offerId } = body;
      if (!productName || !partnerId) {
        return new Response(JSON.stringify({ error: 'productName va partnerId kerak' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const base64Image = await generateImprovedImage(productName, category || '');
      if (!base64Image) {
        return new Response(JSON.stringify({ error: 'Rasm yaratib bo\'lmadi' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload to storage
      const publicUrl = await uploadImageToStorage(supabase, base64Image, partnerId, offerId || 'unknown');

      return new Response(JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        message: 'Yangi rasm yaratildi va yuklandi'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'action kerak (analyze | generate)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('AI Agent images error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Server xatosi' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
