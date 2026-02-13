import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchWildberriesDataRequest {
  supplierId: number;
  connectionId: string;
  warehouseId?: number;
  dataType?: 'products' | 'orders' | 'financials' | 'all';
}

async function fetchWildberriesProducts(
  supabase: any,
  userId: string,
  connectionId: string,
  supplierId: number,
  apiKey: string,
  warehouseId?: number
) {
  try {
    // Wildberries API endpoint for products
    const response = await fetch('https://suppliers-api.wildberries.ru/api/v3/suppliers/products', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Wildberries API error: ${response.statusText}`);
    }

    const productsData = await response.json();
    
    // Insert/update products in database
    const products = (productsData.data || []).map((p: any) => ({
      user_id: userId,
      connection_id: connectionId,
      nm_id: p.nmID,
      title: p.name,
      price: p.price,
      discount_percent: p.discount || 0,
      rating: p.rating,
      review_count: p.reviewCount || 0,
      stock: p.stocks,
      images: p.images || [],
      category_id: p.categoryID,
    }));

    // Upsert products
    const { error: upsertError } = await supabase
      .from('wildberries_products')
      .upsert(products, { onConflict: 'user_id,nm_id' });

    if (upsertError) throw upsertError;

    return { success: true, count: products.length };
  } catch (error: any) {
    console.error('Error fetching Wildberries products:', error);
    throw error;
  }
}

async function fetchWildberriesOrders(
  supabase: any,
  userId: string,
  connectionId: string,
  supplierId: number,
  apiKey: string
) {
  try {
    // Wildberries API endpoint for orders
    const response = await fetch('https://suppliers-api.wildberries.ru/api/v3/orders', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Wildberries API error: ${response.statusText}`);
    }

    const ordersData = await response.json();
    
    // Insert/update orders in database
    const orders = (ordersData.orders || []).map((o: any) => ({
      user_id: userId,
      connection_id: connectionId,
      order_id: o.id,
      order_date: o.createdAt,
      status: o.status,
      payment_method: o.paymentMethod,
      total_amount: o.totalPrice,
      total_price: o.totalPrice,
      commission_percent: o.commission || 0,
      commission_amount: (o.totalPrice * (o.commission || 0)) / 100,
      warehouse_id: o.warehouseID,
      delivery_address: o.deliveryAddress,
      buyer_name: o.buyerName,
      items: o.details,
    }));

    // Upsert orders
    const { error: upsertError } = await supabase
      .from('wildberries_orders')
      .upsert(orders, { onConflict: 'user_id,order_id' });

    if (upsertError) throw upsertError;

    return { success: true, count: orders.length };
  } catch (error: any) {
    console.error('Error fetching Wildberries orders:', error);
    throw error;
  }
}

async function fetchWildberriesFinancials(
  supabase: any,
  userId: string,
  connectionId: string,
  supplierId: number,
  apiKey: string
) {
  try {
    // Wildberries API endpoint for financials (last 30 days)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const response = await fetch(
      `https://suppliers-api.wildberries.ru/api/v3/supplier/finances?dateStart=${startDate.toISOString()}&dateEnd=${endDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Wildberries API error: ${response.statusText}`);
    }

    const financialsData = await response.json();
    
    // Insert/update financials in database
    const financials = (financialsData.data || []).map((f: any) => ({
      user_id: userId,
      connection_id: connectionId,
      order_id: f.orderID,
      revenue: f.saleSum,
      commission: f.commissionSum,
      logistics: f.logisticSum || 0,
      return_amount: f.returnSum || 0,
      penalty: f.penaltySum || 0,
      net_income: (f.saleSum || 0) - (f.commissionSum || 0) - (f.logisticSum || 0) + (f.returnSum || 0) - (f.penaltySum || 0),
      date: f.date,
    }));

    // Upsert financials
    const { error: upsertError } = await supabase
      .from('wildberries_financials')
      .upsert(financials, { onConflict: 'user_id,order_id' });

    if (upsertError) throw upsertError;

    return { success: true, count: financials.length };
  } catch (error: any) {
    console.error('Error fetching Wildberries financials:', error);
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { supplierId, connectionId, warehouseId, dataType = 'all' } = await req.json() as FetchWildberriesDataRequest;

    // Get API key from database
    const { data: connection, error: connError } = await supabase
      .from('wildberries_connections')
      .select('api_key')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    const results: Record<string, any> = {};

    if (dataType === 'all' || dataType === 'products') {
      results.products = await fetchWildberriesProducts(
        supabase,
        user.id,
        connectionId,
        supplierId,
        connection.api_key,
        warehouseId
      );
    }

    if (dataType === 'all' || dataType === 'orders') {
      results.orders = await fetchWildberriesOrders(
        supabase,
        user.id,
        connectionId,
        supplierId,
        connection.api_key
      );
    }

    if (dataType === 'all' || dataType === 'financials') {
      results.financials = await fetchWildberriesFinancials(
        supabase,
        user.id,
        connectionId,
        supplierId,
        connection.api_key
      );
    }

    // Update last_sync_at
    await supabase
      .from('wildberries_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
