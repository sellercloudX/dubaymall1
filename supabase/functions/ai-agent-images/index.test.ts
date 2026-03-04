import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// First sign in to get a real auth token
async function getAuthToken(): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: "rasmiydorixona@gmail.com",
      password: "Medik9298",
    }),
  });
  const data = await resp.json();
  await resp.body?.cancel();
  if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
  return data.access_token;
}

Deno.test("AI Agent Images - Lovable AI fallback test with scanner-generate", async () => {
  const token = await getAuthToken();
  console.log("✅ Auth token obtained");

  // Call scanner-generate with a real Uzum product image
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent-images`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "scanner-generate",
      referenceImageUrl: "https://images.uzum.uz/cnuk4ff2u18gghcl26tg/t_product_540_high.jpg",
      productName: "Elektr mini pech OD-3601",
      category: "electronics",
      features: ["36 litr hajm", "Taymerli", "1200W quvvat"],
    }),
  });

  console.log("Response status:", resp.status);
  const data = await resp.json();
  console.log("Response data:", JSON.stringify({
    success: data.success,
    totalImages: data.totalImages,
    heroUrl: data.heroUrl?.substring(0, 120),
    lifestyleUrls: data.lifestyleUrls?.map((u: string) => u?.substring(0, 120)),
    error: data.error,
    detection: data.detection ? {
      product_name: data.detection.product_name,
      category: data.detection.category,
    } : null,
  }, null, 2));

  assertEquals(resp.status, 200);
  assertEquals(data.success, true);
  assertExists(data.images, "images array should exist");
  console.log(`✅ Total images generated: ${data.totalImages}`);
  
  // Check hero image
  if (data.heroUrl) {
    console.log("✅ Hero infographic URL:", data.heroUrl.substring(0, 120));
    // Verify the URL is accessible
    const heroResp = await fetch(data.heroUrl, { method: "HEAD" });
    console.log("Hero image accessible:", heroResp.status === 200);
    await heroResp.body?.cancel();
  } else {
    console.log("⚠️ No hero image generated");
  }

  // Check lifestyle images
  if (data.lifestyleUrls?.length > 0) {
    for (const url of data.lifestyleUrls) {
      console.log("✅ Lifestyle URL:", url?.substring(0, 120));
      const lResp = await fetch(url, { method: "HEAD" });
      console.log("Lifestyle image accessible:", lResp.status === 200);
      await lResp.body?.cancel();
    }
  } else {
    console.log("⚠️ No lifestyle images generated");
  }
});
