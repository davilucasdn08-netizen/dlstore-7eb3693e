import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function isCaptchaOrBlocked(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("captcha") ||
    lower.includes("robot") ||
    lower.includes("automated access") ||
    lower.includes("api-services-support@amazon") ||
    (html.length < 5000 && !lower.includes("producttitle") && !lower.includes("og:title"))
  );
}

function normalizeBRPrice(raw: string): string {
  let p = raw.trim().replace(/[R$\s\u00a0]/g, "");
  if (!p) return "";
  if (p.includes(".") && p.includes(",")) return p;
  if (/,\d{2}$/.test(p) && !p.includes(".")) return p;
  if (/\.\d{2}$/.test(p) && !p.includes(",")) {
    const parts = p.split(".");
    if (parts[0].length <= 3) return p.replace(".", ",");
    const num = parseFloat(p);
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (/^\d+$/.test(p)) {
    return parseInt(p).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return p;
}

function extractPrice(html: string): string {
  // 1. a-price-whole + a-price-fraction (most reliable)
  const wholeMatch = html.match(/class="a-price-whole"[^>]*>([^<]+)</);
  const fractionMatch = html.match(/class="a-price-fraction"[^>]*>([^<]+)</);
  if (wholeMatch?.[1]) {
    const whole = wholeMatch[1].trim().replace(/[^\d]/g, "");
    const fraction = fractionMatch?.[1]?.trim().replace(/[^\d]/g, "") || "00";
    const paddedFraction = fraction.length === 1 ? fraction + "0" : fraction.slice(0, 2);
    if (whole) {
      const num = parseInt(whole);
      const formattedWhole = num.toLocaleString("pt-BR");
      return `${formattedWhole},${paddedFraction}`;
    }
  }

  // 2. a-offscreen price
  const offscreen = html.match(/class="a-offscreen"[^>]*>R\$\s*([^<]+)</);
  if (offscreen?.[1]) {
    const p = normalizeBRPrice(offscreen[1]);
    if (p) return p;
  }

  // 3. corePriceDisplay price
  const corePrice = html.match(/id="corePriceDisplay_desktop_feature_div"[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([^<]+)</);
  if (corePrice?.[1]) {
    const p = normalizeBRPrice(corePrice[1]);
    if (p) return p;
  }

  // 4. JSON-LD price
  const jsonLdPrice = html.match(/"price"\s*:\s*"?(\d+[\d.,]*\d*)"?/);
  if (jsonLdPrice?.[1]) return normalizeBRPrice(jsonLdPrice[1]);

  // 5. Generic R$ with cents
  const brFull = html.match(/R\$\s*([\d.]+,\d{2})/);
  if (brFull?.[1]) return normalizeBRPrice(brFull[1]);

  return "";
}

async function fetchProductPage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ua = USER_AGENTS[attempt % USER_AGENTS.length];
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
          "Cache-Control": "no-cache",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        await res.text();
        continue;
      }

      const html = await res.text();
      if (isCaptchaOrBlocked(html)) {
        console.log(`Attempt ${attempt + 1}: blocked/captcha`);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        return null;
      }
      return html;
    } catch (e) {
      console.log(`Attempt ${attempt + 1} error:`, (e as Error).message);
      if (attempt < 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const BATCH_SIZE = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Accept offset param to process in batches
    let offset = 0;
    try {
      const body = await req.json();
      offset = body?.offset || 0;
    } catch { /* no body is fine */ }

    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, affiliate_link, price")
      .order("created_at", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "Sync completo. Nenhum produto restante.", done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sync batch: offset=${offset}, ${products.length} produtos`);

    const results = { updated: 0, failed: 0, blocked: 0, skipped: 0, details: [] as string[] };

    for (const product of products) {
      if (!product.affiliate_link) {
        results.skipped++;
        continue;
      }

      const html = await fetchProductPage(product.affiliate_link);

      if (!html) {
        console.log(`❌ Bloqueado: ${product.name?.substring(0, 30)}`);
        results.blocked++;
        await sleep(1000);
        continue;
      }

      const price = extractPrice(html);

      if (price) {
        const oldPrice = product.price || "";
        const { error } = await supabase
          .from("products")
          .update({ price })
          .eq("id", product.id);

        if (error) {
          console.error(`Erro BD ${product.id}:`, error.message);
          results.failed++;
        } else {
          const detail = `${product.name?.substring(0, 25)}: ${oldPrice} → ${price}`;
          console.log(`✅ ${detail}`);
          results.updated++;
          results.details.push(detail);
        }
      } else {
        console.log(`⏳ Sem preço: ${product.name?.substring(0, 25)}`);
        results.skipped++;
      }

      await sleep(800);
    }

    const hasMore = products.length === BATCH_SIZE;
    const summary = `Batch offset=${offset}: ${results.updated} atualizados, ${results.blocked} bloqueados, ${results.skipped} ignorados`;
    console.log(summary);

    return new Response(JSON.stringify({
      message: summary,
      results,
      hasMore,
      nextOffset: hasMore ? offset + BATCH_SIZE : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
