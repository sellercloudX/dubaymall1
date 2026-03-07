import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { marketplace, action, orderIds, orderId, invoiceId, dropOffPointId, timeSlotId, cancelReason } = body;

    if (!marketplace || !action) {
      return new Response(JSON.stringify({ error: "marketplace and action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get connection + credentials
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", marketplace)
      .eq("is_active", true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ error: "Marketplace not connected" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decrypt credentials - 3-level fallback matching fetch-marketplace-data
    let credentials: { apiKey: string; campaignId?: string; businessId?: string; sellerId?: string };
    
    if (connection.encrypted_credentials) {
      try {
        const { data: decData, error: decError } = await supabase
          .rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
        if (decError || !decData) {
          console.warn("Decrypt failed, trying base64 fallback:", decError?.message);
          try {
            const decoded = atob(connection.encrypted_credentials);
            credentials = JSON.parse(decoded);
          } catch {
            console.warn("Base64 fallback failed, using plain credentials");
            credentials = connection.credentials as any;
          }
        } else {
          credentials = typeof decData === "string" ? JSON.parse(decData) : decData;
        }
      } catch (e) {
        console.warn("Decrypt exception, falling back to plain credentials:", e);
        credentials = connection.credentials as any;
      }
    } else {
      credentials = connection.credentials as any;
    }

    const { apiKey, campaignId, businessId } = credentials || {};
    console.log(`[manage-orders] marketplace=${marketplace}, action=${body.action}, hasApiKey=${!!apiKey}, keyLen=${apiKey?.length || 0}`);
    let result: any = { success: false };

    // ========== UZUM MARKET ==========
    if (marketplace === "uzum") {
      const uzumBase = "https://api-seller.uzum.uz/api/seller-openapi";
      const uzumHeaders: Record<string, string> = { "Authorization": apiKey, "Accept": "application/json", "Content-Type": "application/json" };

      if (action === "confirm") {
        // POST /v1/fbs/order/{orderId}/confirm
        const results = [];
        const ids = orderIds || [orderId];
        for (const oid of ids) {
          const resp = await fetch(`${uzumBase}/v1/fbs/order/${oid}/confirm`, { method: "POST", headers: uzumHeaders });
          if (resp.ok) {
            results.push({ orderId: oid, success: true });
          } else {
            const err = await resp.text();
            console.error(`Uzum confirm ${oid} failed:`, resp.status, err);
            results.push({ orderId: oid, success: false, error: err });
          }
          if (ids.indexOf(oid) < ids.length - 1) await sleep(300);
        }
        result = { success: true, results };

      } else if (action === "cancel") {
        // POST /v1/fbs/order/{orderId}/cancel
        const ids = orderIds || [orderId];
        const results = [];
        for (const oid of ids) {
          const resp = await fetch(`${uzumBase}/v1/fbs/order/${oid}/cancel`, {
            method: "POST", headers: uzumHeaders,
            body: JSON.stringify({ reason: cancelReason || "SELLER_CANCEL" }),
          });
          results.push({ orderId: oid, success: resp.ok, error: resp.ok ? undefined : await resp.text() });
          if (ids.indexOf(oid) < ids.length - 1) await sleep(300);
        }
        result = { success: true, results };

      } else if (action === "labels") {
        // GET /v1/fbs/order/{orderId}/labels/print — returns PDF binary
        const ids = orderIds || [orderId];
        if (ids.length === 1) {
          const resp = await fetch(`${uzumBase}/v1/fbs/order/${ids[0]}/labels/print`, { headers: uzumHeaders });
          if (resp.ok) {
            const contentType = resp.headers.get("content-type") || "application/pdf";
            const blob = await resp.arrayBuffer();
            return new Response(blob, {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": contentType, "Content-Disposition": `attachment; filename="label_${ids[0]}.pdf"` },
            });
          } else {
            result = { success: false, error: `Label fetch failed: ${resp.status}` };
          }
        } else {
          // Multiple labels — fetch each and return URLs/base64
          const labels = [];
          for (const oid of ids) {
            const resp = await fetch(`${uzumBase}/v1/fbs/order/${oid}/labels/print`, { headers: uzumHeaders });
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
              labels.push({ orderId: oid, pdf: b64, success: true });
            } else {
              labels.push({ orderId: oid, success: false });
            }
            await sleep(200);
          }
          result = { success: true, labels };
        }

      } else if (action === "drop-off-points") {
        // GET /v1/fbs/invoice/dop/drop-off-points?orderIds=...
        const ids = orderIds || [orderId];
        const params = new URLSearchParams();
        ids.forEach((id: string) => params.append("orderIds", String(id)));
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice/dop/drop-off-points?${params.toString()}`, { headers: uzumHeaders });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.payload || data.data || data };
        } else {
          result = { success: false, error: `Drop-off points failed: ${resp.status}` };
        }

      } else if (action === "time-slots") {
        // GET /v1/fbs/invoice/dop/time-slot?dropOffPointId=...&orderIds=...
        const ids = orderIds || [orderId];
        const params = new URLSearchParams();
        if (dropOffPointId) params.append("dropOffPointId", String(dropOffPointId));
        ids.forEach((id: string) => params.append("orderIds", String(id)));
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice/dop/time-slot?${params.toString()}`, { headers: uzumHeaders });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.payload || data.data || data };
        } else {
          result = { success: false, error: `Time slots failed: ${resp.status}` };
        }

      } else if (action === "create-invoice") {
        // POST /v1/fbs/invoice
        const ids = orderIds || [orderId];
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice`, {
          method: "POST", headers: uzumHeaders,
          body: JSON.stringify({ orderIds: ids }),
        });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.payload || data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Create invoice failed: ${resp.status}`, details: err };
        }

      } else if (action === "set-drop-off") {
        // POST /v1/fbs/invoice/dop/time-slot — update drop-off point and time slot
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice/dop/time-slot`, {
          method: "POST", headers: uzumHeaders,
          body: JSON.stringify({ invoiceId, dropOffPointId, timeSlotId }),
        });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.payload || data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Set drop-off failed: ${resp.status}`, details: err };
        }

      } else if (action === "print-invoice") {
        // GET /v1/fbs/invoice/{invoiceId}/print — supply act PDF
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice/${invoiceId}/print`, { headers: uzumHeaders });
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          return new Response(blob, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="invoice_${invoiceId}.pdf"` },
          });
        } else {
          result = { success: false, error: `Print invoice failed: ${resp.status}` };
        }

      } else if (action === "closing-documents") {
        // GET /v1/fbs/invoice/{invoiceId}/closing-documents — acceptance act PDF
        const resp = await fetch(`${uzumBase}/v1/fbs/invoice/${invoiceId}/closing-documents`, { headers: uzumHeaders });
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          return new Response(blob, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="closing_${invoiceId}.pdf"` },
          });
        } else {
          result = { success: false, error: `Closing docs failed: ${resp.status}` };
        }

      } else if (action === "return-reasons") {
        const resp = await fetch(`${uzumBase}/v1/fbs/order/return-reasons`, { headers: uzumHeaders });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.payload || data };
        } else {
          result = { success: false, error: `Return reasons failed: ${resp.status}` };
        }
      }

    // ========== WILDBERRIES ==========
    } else if (marketplace === "wildberries") {
      const wbHeaders = { "Authorization": apiKey, "Content-Type": "application/json" };

      if (action === "labels") {
        // POST /api/v3/orders/stickers — type/width/height are query params, body is only orders
        const ids = orderIds || [orderId];
        const resp = await fetch("https://marketplace-api.wildberries.ru/api/v3/orders/stickers?type=png&width=58&height=40", {
          method: "POST", headers: wbHeaders,
          body: JSON.stringify({ orders: ids.map(Number) }),
        });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, stickers: data.stickers || [] };
        } else {
          const err = await resp.text();
          result = { success: false, error: `WB stickers failed: ${resp.status}`, details: err };
        }

      } else if (action === "cancel") {
        const ids = orderIds || [orderId];
        const results = [];
        for (const oid of ids) {
          const resp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/orders/${oid}/cancel`, {
            method: "PATCH", headers: wbHeaders,
          });
          results.push({ orderId: oid, success: resp.ok || resp.status === 204, error: resp.ok ? undefined : await resp.text() });
          await sleep(200);
        }
        result = { success: true, results };

      } else if (action === "status") {
        // POST /api/v3/orders/status
        const ids = orderIds || [orderId];
        const resp = await fetch("https://marketplace-api.wildberries.ru/api/v3/orders/status", {
          method: "POST", headers: wbHeaders,
          body: JSON.stringify({ orders: ids.map(Number) }),
        });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.orders || [] };
        } else {
          result = { success: false, error: `WB status failed: ${resp.status}` };
        }

      } else if (action === "supplies") {
        // GET /api/v3/supplies — list supplies
        const resp = await fetch("https://marketplace-api.wildberries.ru/api/v3/supplies?limit=100", { headers: wbHeaders });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.supplies || [] };
        } else {
          result = { success: false, error: `WB supplies failed: ${resp.status}` };
        }

      } else if (action === "create-supply") {
        // POST /api/v3/supplies — create new supply
        const { supplyName } = body;
        const resp = await fetch("https://marketplace-api.wildberries.ru/api/v3/supplies", {
          method: "POST", headers: wbHeaders,
          body: JSON.stringify({ name: supplyName || `Supply ${new Date().toISOString().slice(0,10)}` }),
        });
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Create supply failed: ${resp.status}`, details: err };
        }

      } else if (action === "add-to-supply") {
        // PATCH /api/v3/supplies/{supplyId}/orders/{orderId}
        const { supplyId } = body;
        const ids = orderIds || [orderId];
        const results = [];
        for (const oid of ids) {
          const resp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/supplies/${supplyId}/orders/${oid}`, {
            method: "PATCH", headers: wbHeaders,
          });
          results.push({ orderId: oid, success: resp.ok || resp.status === 204 });
          await sleep(200);
        }
        result = { success: true, results };

      } else if (action === "deliver-supply") {
        // PATCH /api/v3/supplies/{supplyId}/deliver
        const { supplyId } = body;
        const resp = await fetch(`https://marketplace-api.wildberries.ru/api/v3/supplies/${supplyId}/deliver`, {
          method: "PATCH", headers: wbHeaders,
        });
        result = { success: resp.ok || resp.status === 204 };
      }

    // ========== YANDEX MARKET ==========
    } else if (marketplace === "yandex") {
      const yandexHeaders = { "Api-Key": apiKey, "Content-Type": "application/json" };

      if (action === "update-status") {
        // PUT /v2/campaigns/{id}/orders/{id}/status
        const { newStatus, substatus } = body;
        const statusBody: any = { order: { status: newStatus } };
        if (substatus) statusBody.order.substatus = substatus;

        const resp = await fetch(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/orders/${orderId}/status`,
          { method: "PUT", headers: yandexHeaders, body: JSON.stringify(statusBody) }
        );
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data: data.order || data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Yandex status update failed: ${resp.status}`, details: err };
        }

      } else if (action === "batch-status") {
        // POST /v2/campaigns/{id}/orders/status-update
        const { orders: statusOrders } = body;
        const resp = await fetch(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/orders/status-update`,
          { method: "POST", headers: yandexHeaders, body: JSON.stringify({ orders: statusOrders }) }
        );
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Yandex batch status failed: ${resp.status}`, details: err };
        }

      } else if (action === "set-boxes") {
        // PUT /v2/campaigns/{id}/orders/{id}/boxes
        const { boxes } = body;
        const resp = await fetch(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/orders/${orderId}/boxes`,
          { method: "PUT", headers: yandexHeaders, body: JSON.stringify({ boxes: boxes || [{ items: [] }] }) }
        );
        if (resp.ok) {
          const data = await resp.json();
          result = { success: true, data };
        } else {
          const err = await resp.text();
          result = { success: false, error: `Yandex boxes failed: ${resp.status}`, details: err };
        }

      } else if (action === "labels") {
        // GET /v2/campaigns/{id}/orders/{id}/delivery/labels (PDF)
        const resp = await fetch(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/orders/${orderId}/delivery/labels`,
          { headers: { ...yandexHeaders, "Accept": "application/pdf" } }
        );
        if (resp.ok) {
          const blob = await resp.arrayBuffer();
          return new Response(blob, {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="label_yandex_${orderId}.pdf"` },
          });
        } else {
          result = { success: false, error: `Yandex labels failed: ${resp.status}` };
        }

      } else if (action === "cancel") {
        // Cancel = update status to CANCELLED
        const statusBody = { order: { status: "CANCELLED", substatus: cancelReason || "SHOP_FAILED" } };
        const resp = await fetch(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/orders/${orderId}/status`,
          { method: "PUT", headers: yandexHeaders, body: JSON.stringify(statusBody) }
        );
        result = { success: resp.ok, data: resp.ok ? await resp.json() : undefined, error: resp.ok ? undefined : `Cancel failed: ${resp.status}` };
      }
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("manage-marketplace-orders error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
