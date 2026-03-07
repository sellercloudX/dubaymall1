import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const pdfResponse = (buf: ArrayBuffer, filename: string) =>
  new Response(buf, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { marketplace, action } = body;
    if (!marketplace || !action) return json({ error: "marketplace and action required" }, 400);

    // Get connection
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("marketplace", marketplace)
      .eq("is_active", true)
      .single();

    if (!connection) return json({ error: "Marketplace not connected" }, 404);

    // Decrypt credentials - 3-level fallback
    let credentials: { apiKey: string; campaignId?: string; businessId?: string; sellerId?: string };
    if (connection.encrypted_credentials) {
      try {
        const { data: decData, error: decError } = await supabase
          .rpc("decrypt_credentials", { p_encrypted: connection.encrypted_credentials });
        if (decError || !decData) {
          try { credentials = JSON.parse(atob(connection.encrypted_credentials)); }
          catch { credentials = connection.credentials as any; }
        } else {
          credentials = typeof decData === "string" ? JSON.parse(decData) : decData;
        }
      } catch {
        credentials = connection.credentials as any;
      }
    } else {
      credentials = connection.credentials as any;
    }

    const { apiKey, campaignId, businessId } = credentials || {};
    console.log(`[manage-orders] mp=${marketplace}, action=${action}, hasKey=${!!apiKey}, keyLen=${apiKey?.length || 0}`);

    if (!apiKey) return json({ success: false, error: "API key not found in credentials" }, 400);

    let result: any = { success: false };

    // =============================================
    // UZUM MARKET - FBS Order Management
    // =============================================
    if (marketplace === "uzum") {
      const base = "https://api-seller.uzum.uz/api/seller-openapi";
      const headers: Record<string, string> = { "Authorization": apiKey, "Accept": "application/json", "Content-Type": "application/json" };

      const ids = body.orderIds || (body.orderId ? [body.orderId] : []);

      switch (action) {
        case "confirm": {
          // POST /v1/fbs/order/{orderId}/confirm — one by one
          const results = [];
          for (const oid of ids) {
            try {
              const resp = await fetch(`${base}/v1/fbs/order/${oid}/confirm`, { method: "POST", headers });
              const ok = resp.ok;
              if (!ok) console.error(`Uzum confirm ${oid}:`, resp.status, await resp.text());
              results.push({ orderId: oid, success: ok });
            } catch (e) {
              results.push({ orderId: oid, success: false, error: String(e) });
            }
            await sleep(300);
          }
          result = { success: true, results };
          break;
        }

        case "cancel": {
          // POST /v1/fbs/order/{orderId}/cancel
          const results = [];
          for (const oid of ids) {
            try {
              const resp = await fetch(`${base}/v1/fbs/order/${oid}/cancel`, {
                method: "POST", headers,
                body: JSON.stringify({ reason: body.cancelReason || "SELLER_CANCEL" }),
              });
              results.push({ orderId: oid, success: resp.ok });
              if (!resp.ok) console.error(`Uzum cancel ${oid}:`, await resp.text());
            } catch (e) {
              results.push({ orderId: oid, success: false, error: String(e) });
            }
            await sleep(300);
          }
          result = { success: true, results };
          break;
        }

        case "labels": {
          // GET /v1/fbs/order/{orderId}/labels/print — PDF binary
          if (ids.length === 1) {
            const resp = await fetch(`${base}/v1/fbs/order/${ids[0]}/labels/print`, { headers });
            if (resp.ok) {
              return pdfResponse(await resp.arrayBuffer(), `label_uzum_${ids[0]}.pdf`);
            }
            result = { success: false, error: `Label fetch failed: ${resp.status}`, details: await resp.text() };
          } else {
            const labels = [];
            for (const oid of ids) {
              const resp = await fetch(`${base}/v1/fbs/order/${oid}/labels/print`, { headers });
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
          break;
        }

        case "drop-off-points": {
          const params = new URLSearchParams();
          ids.forEach((id: string) => params.append("orderIds", String(id)));
          const resp = await fetch(`${base}/v1/fbs/invoice/dop/drop-off-points?${params}`, { headers });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, data: data.payload || data.data || data };
          } else {
            result = { success: false, error: `Drop-off points failed: ${resp.status}` };
          }
          break;
        }

        case "time-slots": {
          const params = new URLSearchParams();
          if (body.dropOffPointId) params.append("dropOffPointId", String(body.dropOffPointId));
          ids.forEach((id: string) => params.append("orderIds", String(id)));
          const resp = await fetch(`${base}/v1/fbs/invoice/dop/time-slot?${params}`, { headers });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, data: data.payload || data.data || data };
          } else {
            result = { success: false, error: `Time slots failed: ${resp.status}` };
          }
          break;
        }

        case "create-invoice": {
          const resp = await fetch(`${base}/v1/fbs/invoice`, {
            method: "POST", headers,
            body: JSON.stringify({ orderIds: ids }),
          });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, data: data.payload || data };
          } else {
            result = { success: false, error: `Create invoice failed: ${resp.status}`, details: await resp.text() };
          }
          break;
        }

        case "set-drop-off": {
          const resp = await fetch(`${base}/v1/fbs/invoice/dop/time-slot`, {
            method: "POST", headers,
            body: JSON.stringify({ invoiceId: body.invoiceId, dropOffPointId: body.dropOffPointId, timeSlotId: body.timeSlotId }),
          });
          if (resp.ok) {
            result = { success: true, data: (await resp.json()).payload };
          } else {
            result = { success: false, error: `Set drop-off failed: ${resp.status}` };
          }
          break;
        }

        case "print-invoice": {
          const resp = await fetch(`${base}/v1/fbs/invoice/${body.invoiceId}/print`, { headers });
          if (resp.ok) return pdfResponse(await resp.arrayBuffer(), `invoice_${body.invoiceId}.pdf`);
          result = { success: false, error: `Print invoice failed: ${resp.status}` };
          break;
        }

        default:
          result = { success: false, error: `Unknown Uzum action: ${action}` };
      }

    // =============================================
    // WILDBERRIES - FBS Order Management
    // WB flow: new → (add to supply) → confirm → (deliver supply) → complete
    // Key: WB does NOT have a "confirm" endpoint. 
    // To confirm = create supply + add orders to supply.
    // Stickers available only for orders in confirm/complete status.
    // =============================================
    } else if (marketplace === "wildberries") {
      const wbHeaders = { "Authorization": apiKey, "Content-Type": "application/json" };
      const wbBase = "https://marketplace-api.wildberries.ru";
      const ids = body.orderIds || (body.orderId ? [body.orderId] : []);

      switch (action) {
        case "confirm": {
          // WB "confirm" = create a supply, then add orders to it
          // Step 1: Create supply
          const supplyName = body.supplyName || `SC-${new Date().toISOString().slice(0, 10)}-${Date.now() % 10000}`;
          const createResp = await fetch(`${wbBase}/api/v3/supplies`, {
            method: "POST", headers: wbHeaders,
            body: JSON.stringify({ name: supplyName }),
          });

          if (!createResp.ok) {
            const err = await createResp.text();
            console.error("WB create supply failed:", createResp.status, err);
            result = { success: false, error: `Postavka yaratish xatosi: ${createResp.status}`, details: err };
            break;
          }

          const supplyData = await createResp.json();
          const supplyId = supplyData.id || supplyData.supplyId;
          console.log(`WB supply created: ${supplyId}`);

          // Step 2: Add orders to supply — batch endpoint (up to 100 orders)
          // New API: PATCH /api/marketplace/v3/supplies/{supplyId}/orders
          const numIds = ids.map(Number);
          const results: any[] = [];
          try {
            const addResp = await fetch(`${wbBase}/api/marketplace/v3/supplies/${supplyId}/orders`, {
              method: "PATCH", headers: wbHeaders,
              body: JSON.stringify({ orders: numIds }),
            });
            const ok = addResp.ok || addResp.status === 204;
            if (!ok) {
              const errText = await addResp.text();
              console.error(`WB add orders to supply ${supplyId}:`, addResp.status, errText);
              for (const oid of numIds) results.push({ orderId: oid, success: false, error: errText });
            } else {
              // Check response for per-order errors
              let respData: any = null;
              try { respData = await addResp.json(); } catch { /* 204 no body */ }
              if (respData?.errors?.length) {
                const errorMap = new Map(respData.errors.map((e: any) => [e.orderId || e.orderID, e.error || e.message]));
                for (const oid of numIds) {
                  if (errorMap.has(oid)) {
                    results.push({ orderId: oid, success: false, error: errorMap.get(oid) });
                  } else {
                    results.push({ orderId: oid, success: true });
                  }
                }
              } else {
                for (const oid of numIds) results.push({ orderId: oid, success: true });
              }
            }
          } catch (e) {
            for (const oid of numIds) results.push({ orderId: oid, success: false, error: String(e) });
          }
          result = { success: true, supplyId, results };
          break;
        }

        case "cancel": {
          // PATCH /api/v3/orders/{orderId}/cancel
          const results = [];
          for (const oid of ids) {
            try {
              const resp = await fetch(`${wbBase}/api/v3/orders/${Number(oid)}/cancel`, {
                method: "PATCH", headers: wbHeaders,
              });
              const ok = resp.ok || resp.status === 204;
              if (!ok) console.error(`WB cancel ${oid}:`, resp.status, await resp.text());
              results.push({ orderId: oid, success: ok });
            } catch (e) {
              results.push({ orderId: oid, success: false, error: String(e) });
            }
            await sleep(200);
          }
          result = { success: true, results };
          break;
        }

        case "labels": {
          // POST /api/v3/orders/stickers?type=png&width=58&height=40
          // Only works for orders in confirm or complete status
          const numIds = ids.map(Number);
          const resp = await fetch(`${wbBase}/api/v3/orders/stickers?type=png&width=58&height=40`, {
            method: "POST", headers: wbHeaders,
            body: JSON.stringify({ orders: numIds }),
          });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, stickers: data.stickers || [] };
          } else {
            const err = await resp.text();
            console.error("WB stickers failed:", resp.status, err);
            // If 400 — likely orders not in confirm status yet
            if (resp.status === 400) {
              result = { 
                success: false, 
                error: "Stikerlar faqat yig'ishdagi (confirm) yoki jo'natilgan buyurtmalar uchun mavjud. Avval buyurtmalarni tasdiqlang.",
                code: "NOT_CONFIRMED"
              };
            } else {
              result = { success: false, error: `WB stickers: ${resp.status}`, details: err };
            }
          }
          break;
        }

        case "status": {
          // POST /api/v3/orders/status
          const resp = await fetch(`${wbBase}/api/v3/orders/status`, {
            method: "POST", headers: wbHeaders,
            body: JSON.stringify({ orders: ids.map(Number) }),
          });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, data: data.orders || [] };
          } else {
            result = { success: false, error: `WB status: ${resp.status}` };
          }
          break;
        }

        case "supplies": {
          // GET /api/v3/supplies
          const resp = await fetch(`${wbBase}/api/v3/supplies?limit=100`, { headers: wbHeaders });
          if (resp.ok) {
            const data = await resp.json();
            result = { success: true, data: data.supplies || [] };
          } else {
            result = { success: false, error: `WB supplies: ${resp.status}` };
          }
          break;
        }

        case "create-supply": {
          const resp = await fetch(`${wbBase}/api/v3/supplies`, {
            method: "POST", headers: wbHeaders,
            body: JSON.stringify({ name: body.supplyName || `Supply-${Date.now()}` }),
          });
          if (resp.ok) {
            result = { success: true, data: await resp.json() };
          } else {
            result = { success: false, error: `Create supply: ${resp.status}`, details: await resp.text() };
          }
          break;
        }

        case "add-to-supply": {
          // Add orders to existing supply
          const { supplyId } = body;
          const results = [];
          for (const oid of ids) {
            const resp = await fetch(`${wbBase}/api/v3/supplies/${supplyId}/orders/${Number(oid)}`, {
              method: "PATCH", headers: wbHeaders,
            });
            results.push({ orderId: oid, success: resp.ok || resp.status === 204 });
            await sleep(200);
          }
          result = { success: true, results };
          break;
        }

        case "deliver-supply": {
          // PATCH /api/v3/supplies/{supplyId}/deliver
          const resp = await fetch(`${wbBase}/api/v3/supplies/${body.supplyId}/deliver`, {
            method: "PATCH", headers: wbHeaders,
          });
          result = { success: resp.ok || resp.status === 204 };
          break;
        }

        default:
          result = { success: false, error: `Unknown WB action: ${action}` };
      }

    // =============================================
    // YANDEX MARKET - FBS Order Management
    // Flow: PROCESSING/STARTED → (accept) → PROCESSING/READY_TO_SHIP → (ship) → DELIVERY
    // =============================================
    } else if (marketplace === "yandex") {
      const yHeaders = { "Api-Key": apiKey, "Content-Type": "application/json" };
      const yBase = `https://api.partner.market.yandex.ru`;
      const cId = campaignId || businessId;

      if (!cId) {
        result = { success: false, error: "campaignId/businessId not found" };
      } else {
        const ids = body.orderIds || (body.orderId ? [body.orderId] : []);

        switch (action) {
          case "confirm": {
            // Yandex: accept items → set status to PROCESSING/READY_TO_SHIP
            const results = [];
            for (const oid of ids) {
              try {
                // First accept all items
                const orderResp = await fetch(`${yBase}/v2/campaigns/${cId}/orders/${oid}`, { headers: yHeaders });
                if (!orderResp.ok) {
                  results.push({ orderId: oid, success: false, error: `Get order failed: ${orderResp.status}` });
                  await orderResp.text();
                  continue;
                }
                const orderData = await orderResp.json();
                const items = orderData.order?.items || [];

                // PUT accept items
                const acceptBody = {
                  order: {
                    items: items.map((item: any) => ({
                      id: item.id,
                      count: item.count,
                    })),
                  },
                };
                const acceptResp = await fetch(
                  `${yBase}/v2/campaigns/${cId}/orders/${oid}/accept`,
                  { method: "PUT", headers: yHeaders, body: JSON.stringify(acceptBody) }
                );
                
                if (acceptResp.ok || acceptResp.status === 200) {
                  results.push({ orderId: oid, success: true });
                } else {
                  const errText = await acceptResp.text();
                  // If already accepted, try status update
                  const statusResp = await fetch(
                    `${yBase}/v2/campaigns/${cId}/orders/${oid}/status`,
                    { method: "PUT", headers: yHeaders, body: JSON.stringify({ order: { status: "PROCESSING", substatus: "READY_TO_SHIP" } }) }
                  );
                  results.push({ orderId: oid, success: statusResp.ok, error: statusResp.ok ? undefined : errText });
                  if (!statusResp.ok) await statusResp.text();
                }
              } catch (e) {
                results.push({ orderId: oid, success: false, error: String(e) });
              }
              await sleep(300);
            }
            result = { success: true, results };
            break;
          }

          case "cancel": {
            const results = [];
            for (const oid of ids) {
              try {
                const statusBody = { order: { status: "CANCELLED", substatus: body.cancelReason || "SHOP_FAILED" } };
                const resp = await fetch(
                  `${yBase}/v2/campaigns/${cId}/orders/${oid}/status`,
                  { method: "PUT", headers: yHeaders, body: JSON.stringify(statusBody) }
                );
                results.push({ orderId: oid, success: resp.ok });
                if (!resp.ok) await resp.text();
              } catch (e) {
                results.push({ orderId: oid, success: false, error: String(e) });
              }
              await sleep(300);
            }
            result = { success: true, results };
            break;
          }

          case "labels": {
            // GET /v2/campaigns/{id}/orders/{id}/delivery/labels
            if (ids.length === 1) {
              const resp = await fetch(
                `${yBase}/v2/campaigns/${cId}/orders/${ids[0]}/delivery/labels`,
                { headers: { ...yHeaders, "Accept": "application/pdf" } }
              );
              if (resp.ok) {
                return pdfResponse(await resp.arrayBuffer(), `label_yandex_${ids[0]}.pdf`);
              }
              result = { success: false, error: `Yandex labels: ${resp.status}`, details: await resp.text() };
            } else {
              // Multiple — fetch each as base64
              const labels = [];
              for (const oid of ids) {
                const resp = await fetch(
                  `${yBase}/v2/campaigns/${cId}/orders/${oid}/delivery/labels`,
                  { headers: { ...yHeaders, "Accept": "application/pdf" } }
                );
                if (resp.ok) {
                  const buf = await resp.arrayBuffer();
                  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                  labels.push({ orderId: oid, pdf: b64, success: true });
                } else {
                  await resp.text();
                  labels.push({ orderId: oid, success: false });
                }
                await sleep(200);
              }
              result = { success: true, labels };
            }
            break;
          }

          case "update-status": {
            const statusBody: any = { order: { status: body.newStatus } };
            if (body.substatus) statusBody.order.substatus = body.substatus;
            const resp = await fetch(
              `${yBase}/v2/campaigns/${cId}/orders/${body.orderId}/status`,
              { method: "PUT", headers: yHeaders, body: JSON.stringify(statusBody) }
            );
            if (resp.ok) {
              result = { success: true, data: await resp.json() };
            } else {
              result = { success: false, error: `Yandex status: ${resp.status}`, details: await resp.text() };
            }
            break;
          }

          case "set-boxes": {
            const resp = await fetch(
              `${yBase}/v2/campaigns/${cId}/orders/${body.orderId}/boxes`,
              { method: "PUT", headers: yHeaders, body: JSON.stringify({ boxes: body.boxes || [{ items: [] }] }) }
            );
            if (resp.ok) {
              result = { success: true, data: await resp.json() };
            } else {
              result = { success: false, error: `Yandex boxes: ${resp.status}`, details: await resp.text() };
            }
            break;
          }

          default:
            result = { success: false, error: `Unknown Yandex action: ${action}` };
        }
      }
    } else {
      result = { success: false, error: `Unsupported marketplace: ${marketplace}` };
    }

    const statusCode = result.success ? 200 : 400;
    return json(result, statusCode);

  } catch (err) {
    console.error("[manage-orders] Unhandled error:", err);
    return json({ success: false, error: err.message || "Internal error" }, 500);
  }
});
