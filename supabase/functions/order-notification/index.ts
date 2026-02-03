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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, status, userId }: OrderNotification = await req.json();

    console.log("Processing order notification:", { orderId, status, userId });

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          product_name,
          quantity,
          subtotal
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      throw new Error("Order not found");
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
    };

    const notification = statusMessages[status] || {
      title: "Buyurtma holati yangilandi",
      message: `${order.order_number} raqamli buyurtmangiz holati: ${status}`,
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
      console.log("Notification table may not exist, skipping in-app notification");
    }

    // Log the notification (in production, this would send SMS/email)
    console.log("Notification sent:", {
      userId,
      phone: profile?.phone,
      title: notification.title,
      message: notification.message,
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
