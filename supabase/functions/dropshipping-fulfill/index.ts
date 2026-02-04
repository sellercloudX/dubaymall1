import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  orderId: string;
  action: 'create' | 'check_status' | 'get_tracking';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user authentication
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { orderId, action } = body as OrderRequest;

    // Input validation
    if (!orderId || typeof orderId !== 'string' || orderId.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid order ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!action || !['create', 'check_status', 'get_tracking'].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CJDROPSHIPPING_API_KEY = Deno.env.get('CJDROPSHIPPING_API_KEY');
    if (!CJDROPSHIPPING_API_KEY) {
      console.error('CJDropshipping API key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Service unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from API key
    const parts = CJDROPSHIPPING_API_KEY.split('@api@');
    const apiToken = parts.length === 2 ? parts[1] : CJDROPSHIPPING_API_KEY;

    // Get dropshipping order details
    const { data: dropOrder, error: dropError } = await supabase
      .from('dropshipping_orders')
      .select(`
        *,
        orders:order_id (*),
        products:product_id (*),
        shops:shop_id (user_id)
      `)
      .eq('order_id', orderId)
      .single();

    if (dropError || !dropOrder) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this order's shop
    const shopUserId = (dropOrder.shops as any)?.user_id;
    if (shopUserId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing dropshipping action: ${action} for order ${orderId} by user ${userId}`);

    switch (action) {
      case 'create': {
        // Create order at CJDropshipping
        console.log('Creating order at CJDropshipping...');
        
        const shippingAddress = dropOrder.shipping_address as any;
        
        const orderPayload = {
          orderNumber: dropOrder.orders?.order_number || `DS-${Date.now()}`,
          shippingZip: shippingAddress?.zip || '',
          shippingCountry: 'UZ', // Uzbekistan
          shippingCountryState: shippingAddress?.region || '',
          shippingCity: shippingAddress?.city || '',
          shippingAddress: shippingAddress?.address || '',
          shippingCustomerName: shippingAddress?.name || '',
          shippingPhone: shippingAddress?.phone || '',
          products: [
            {
              vid: dropOrder.variant_id || '',
              quantity: dropOrder.quantity,
            }
          ],
          logisticName: dropOrder.shipping_method || 'CJPacket',
          remark: `BazarHub Order: ${dropOrder.orders?.order_number}`,
        };

        const createResponse = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder', {
          method: 'POST',
          headers: {
            'CJ-Access-Token': apiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        const createData = await createResponse.json();
        console.log('CJ Order creation completed');

        if (createData.result && createData.data) {
          // Update dropshipping order with supplier info
          await supabase
            .from('dropshipping_orders')
            .update({
              supplier_order_id: createData.data.orderId || createData.data.orderNum,
              supplier_order_status: 'ordered',
              ordered_at: new Date().toISOString(),
              supplier_response: createData,
            })
            .eq('id', dropOrder.id);

          return new Response(JSON.stringify({
            success: true,
            message: 'Order created at supplier',
            supplierOrderId: createData.data.orderId || createData.data.orderNum,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.error('CJ order creation failed');
          return new Response(JSON.stringify({
            success: false,
            error: 'Supplier order creation failed',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'check_status': {
        if (!dropOrder.supplier_order_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No supplier order found',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Checking order status...');
        
        const statusResponse = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${dropOrder.supplier_order_id}`, {
          method: 'GET',
          headers: {
            'CJ-Access-Token': apiToken,
            'Content-Type': 'application/json',
          },
        });

        const statusData = await statusResponse.json();

        if (statusData.result && statusData.data) {
          const orderData = statusData.data;
          let newStatus = dropOrder.supplier_order_status;
          
          // Map CJ status to our status
          if (orderData.orderStatus === 'SHIPPED') {
            newStatus = 'shipped';
          } else if (orderData.orderStatus === 'DELIVERED') {
            newStatus = 'delivered';
          } else if (orderData.orderStatus === 'CANCELLED') {
            newStatus = 'cancelled';
          }

          // Update tracking if available
          const updates: any = {
            supplier_order_status: newStatus,
            supplier_response: statusData,
          };

          if (orderData.trackNumber && orderData.trackNumber !== dropOrder.tracking_number) {
            updates.tracking_number = orderData.trackNumber;
            updates.tracking_url = `https://www.17track.net/en/track#nums=${orderData.trackNumber}`;
            updates.shipped_at = new Date().toISOString();
          }

          await supabase
            .from('dropshipping_orders')
            .update(updates)
            .eq('id', dropOrder.id);

          return new Response(JSON.stringify({
            success: true,
            status: newStatus,
            trackingNumber: orderData.trackNumber || dropOrder.tracking_number,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'Status check failed',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_tracking': {
        if (!dropOrder.tracking_number) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No tracking available',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Return tracking info
        return new Response(JSON.stringify({
          success: true,
          trackingNumber: dropOrder.tracking_number,
          trackingUrl: dropOrder.tracking_url || `https://www.17track.net/en/track#nums=${dropOrder.tracking_number}`,
          status: dropOrder.supplier_order_status,
          shippedAt: dropOrder.shipped_at,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (err) {
    console.error('Error in dropshipping-fulfill:', err);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Operation failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
