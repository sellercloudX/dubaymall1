import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API key tekshirish
    const apiKey = req.headers.get("x-api-key");
    const validKey = Deno.env.get("DUBAYMALL_API_KEY");
    if (!apiKey || apiKey !== validKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: noto'g'ri yoki yo'q API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Validate required fields
    const { barcode, customer_name, customer_phone, delivery_type, target_point_id } = body;

    if (!barcode || !customer_name || !customer_phone || !delivery_type) {
      return new Response(
        JSON.stringify({ error: "barcode, customer_name, customer_phone, delivery_type majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["home", "pickup"].includes(delivery_type)) {
      return new Response(
        JSON.stringify({ error: "delivery_type faqat 'home' yoki 'pickup' bo'lishi mumkin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate confirmation code
    const confirmation_code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

    // Build tracking URL
    const appUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "");
    const tracking_url = `https://dubaymall.lovable.app/track?barcode=${encodeURIComponent(barcode)}`;

    // Insert logistics order
    const { data, error } = await supabase.from("logistics_orders").insert({
      barcode,
      customer_name,
      customer_phone,
      customer_address: body.customer_address || null,
      customer_telegram: body.customer_telegram || null,
      product_name: body.product_name || null,
      seller_name: body.seller_name || null,
      delivery_type,
      payment_amount: body.payment_amount || 0,
      target_point_id: target_point_id || null,
      confirmation_code,
      tracking_url,
      status: "created",
      status_history: [
        {
          from: null,
          to: "created",
          at: new Date().toISOString(),
          note: "DubayMall orqali yaratildi",
        },
      ],
    }).select("id, barcode, confirmation_code, tracking_url").single();

    if (error) {
      console.error("Insert error:", error);

      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Bu barcode allaqachon mavjud", code: "DUPLICATE_BARCODE" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        order_id: data.id,
        barcode: data.barcode,
        confirmation_code: data.confirmation_code,
        tracking_url: data.tracking_url,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Server xatoligi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
