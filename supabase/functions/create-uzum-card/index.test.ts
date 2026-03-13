import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("create-uzum-card: returns 401 without auth", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-uzum-card`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      product: {
        name: "Test mahsulot",
        price: 100000,
        costPrice: 50000,
      },
    }),
  });
  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("create-uzum-card: returns 401 with invalid token", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-uzum-card`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer invalid-token-12345",
    },
    body: JSON.stringify({
      product: {
        name: "Test mahsulot",
        price: 100000,
        costPrice: 50000,
      },
    }),
  });
  const body = await response.json();
  assertEquals(response.status, 401);
  await response.body?.cancel().catch(() => {});
});

Deno.test("create-uzum-card: CORS preflight works", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-uzum-card`, {
    method: "OPTIONS",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
    },
  });
  assertEquals(response.status, 200);
  const corsHeader = response.headers.get("access-control-allow-origin");
  assertEquals(corsHeader, "*");
  await response.text();
});
