import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderNotification {
  orderId: string;
  status: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user authentication
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerUserId = claimsData.claims.sub;

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { orderId, status, userId } = body as OrderNotification;

    // Input validation
    if (!orderId || typeof orderId !== 'string' || orderId.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid order ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!status || typeof status !== 'string' || status.length > 50) {
      return new Response(
        JSON.stringify({ error: "Invalid status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId || typeof userId !== 'string' || userId.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid user ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'out_for_delivery'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing order notification:", { orderId, status });

    // Get order details and verify ownership
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          product_name,
          quantity,
          subtotal,
          products:product_id (
            shop_id,
            shops:shop_id (user_id)
          )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is order owner or shop owner
    const isOrderOwner = order.user_id === callerUserId;
    const isShopOwner = order.order_items?.some((item: any) => 
      item.products?.shops?.user_id === callerUserId
    );

    if (!isOrderOwner && !isShopOwner) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", userId)
      .single();

    // Status messages in Uzbek
    const statusMessages: Record<string, { title: string; message: string }> = {
      pending: {
        title: "Buyurtma qabul qilindi",
        message: `Hurmatli ${profile?.full_name || "Mijoz"}, ${order.order_number} raqamli buyurtmangiz qabul qilindi. Tez orada ko'rib chiqamiz.`,
      },
      confirmed: {
        title: "Buyurtma tasdiqlandi",
        message: `${order.order_number} raqamli buyurtmangiz tasdiqlandi va yig'ilmoqda.`,
      },
      shipped: {
        title: "Buyurtma jo'natildi",
        message: `${order.order_number} raqamli buyurtmangiz jo'natildi. Yetkazib berish kutilmoqda.`,
      },
      delivered: {
        title: "Buyurtma yetkazildi",
        message: `${order.order_number} raqamli buyurtmangiz muvaffaqiyatli yetkazildi. Xaridingiz uchun rahmat!`,
      },
      cancelled: {
        title: "Buyurtma bekor qilindi",
        message: `${order.order_number} raqamli buyurtmangiz bekor qilindi.`,
      },
      out_for_delivery: {
        title: "Yetkazib berish boshlandi",
        message: `${order.order_number} raqamli buyurtmangiz yetkazib berilmoqda.`,
      },
    };

    const notification = statusMessages[status] || {
      title: "Buyurtma holati yangilandi",
      message: `${order.order_number} raqamli buyurtmangiz holati yangilandi.`,
    };

    // Store notification in database for in-app notifications
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: notification.title,
        message: notification.message,
        type: "order",
        reference_id: orderId,
        is_read: false,
      });

    if (notificationError) {
      console.log("Notification insert skipped:", notificationError.code);
    }

    // Log the notification (in production, this would send SMS/email)
    console.log("Notification sent:", {
      userId,
      title: notification.title,
    });

    return new Response(
      JSON.stringify({
        success: true,
        notification: {
          title: notification.title,
          message: notification.message,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Notification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
