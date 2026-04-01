import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BodySchema = z.object({
  url: z.string().url().max(2000),
});

function normalizeBRPrice(raw: string): string {
  // Remove currency symbols and spaces
  let p = raw.trim().replace(/[R$\s\u00a0]/g, '');
  if (!p) return '';
  
  // Brazilian format: 1.299,00 → keep as-is for display
  // If has both . and , → Brazilian format (1.299,00)
  if (p.includes('.') && p.includes(',')) {
    // Already Brazilian format like 1.299,00 - good
    return p;
  }
  // If only comma with 2 decimals → Brazilian (299,00)
  if (/,\d{2}$/.test(p) && !p.includes('.')) {
    return p;
  }
  // If only dot with 2 decimals → convert to Brazilian (299.00 → 299,00)
  if (/\.\d{2}$/.test(p) && !p.includes(',')) {
    return p.replace('.', ',');
  }
  // Fallback
  return p;
}

function extractPrice(html: string): string {
  // Try structured data first (most reliable)
  const jsonLdMatches = html.match(/"price"\s*:\s*"?(\d+[\.,]?\d*)"?/g);
  if (jsonLdMatches) {
    for (const m of jsonLdMatches) {
      const val = m.match(/"price"\s*:\s*"?(\d+[\.,]?\d*)"?/);
      if (val?.[1]) return normalizeBRPrice(val[1]);
    }
  }

  // Amazon-specific: combine whole + fraction
  const wholeMatch = html.match(/class="a-price-whole"[^>]*>([^<]+)</);
  const fractionMatch = html.match(/class="a-price-fraction"[^>]*>([^<]+)</);
  if (wholeMatch?.[1]) {
    const whole = wholeMatch[1].trim().replace(/[^\d.]/g, '');
    const fraction = fractionMatch?.[1]?.trim().replace(/[^\d]/g, '') || '00';
    if (whole) return `${whole},${fraction}`;
  }

  // a-offscreen contains full price like "R$ 1.299,00"
  const offscreen = html.match(/class="a-offscreen"[^>]*>([^<]+)</);
  if (offscreen?.[1]) {
    const p = normalizeBRPrice(offscreen[1]);
    if (p) return p;
  }

  // Generic R$ pattern
  const brPattern = html.match(/R\$\s*([\d.,]+)/);
  if (brPattern?.[1]) {
    return normalizeBRPrice(brPattern[1]);
  }

  // Fallback patterns
  const fallbacks = [
    /id="priceblock_ourprice"[^>]*>([^<]+)</,
    /id="priceblock_dealprice"[^>]*>([^<]+)</,
    /data-a-color="price"[^>]*>.*?<span[^>]*>([^<]+)</s,
  ];
  for (const pattern of fallbacks) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const p = normalizeBRPrice(match[1]);
      if (p) return p;
    }
  }
  return "";
}

function extractTitle(html: string): string {
  const patterns = [
    /id="productTitle"[^>]*>\s*([^<]+)/,
    /id="title"[^>]*>\s*([^<]+)/,
    /<title[^>]*>([^<]+)</,
    /property="og:title"\s+content="([^"]+)"/,
    /name="title"\s+content="([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      let title = match[1].trim();
      // Clean Amazon title suffixes
      title = title.replace(/\s*[-|]\s*Amazon.*$/i, '').trim();
      if (title.length > 2) return title;
    }
  }
  return "";
}

function extractImage(html: string): string {
  const patterns = [
    /id="landingImage"[^>]*src="([^"]+)"/,
    /id="imgBlkFront"[^>]*src="([^"]+)"/,
    /data-old-hires="([^"]+)"/,
    /property="og:image"\s+content="([^"]+)"/,
    /"hiRes":"([^"]+)"/,
    /"large":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && match[1].startsWith('http')) {
      return match[1];
    }
  }
  return "";
}

function guessCategory(title: string): string {
  const lower = title.toLowerCase();
  const categories: Record<string, string[]> = {
    "Eletrônicos e Informática": ["notebook", "celular", "fone", "mouse", "teclado", "monitor", "tablet", "câmera", "caixa de som", "carregador", "cabo", "usb", "bluetooth", "smart", "echo", "alexa", "kindle", "tv", "computador", "pc", "ssd", "hd", "memória", "placa", "processador", "headset", "speaker", "phone", "laptop", "watch", "relógio digital", "wireless", "wi-fi"],
    "Moda e Acessórios": ["camisa", "camiseta", "calça", "vestido", "saia", "blusa", "jaqueta", "tênis", "sapato", "bota", "sandália", "bolsa", "mochila", "carteira", "óculos", "relógio", "anel", "brinco", "colar", "pulseira", "roupa", "moda", "chapéu", "boné"],
    "Casa e Decoração": ["sofá", "mesa", "cadeira", "cama", "travesseiro", "lençol", "cortina", "tapete", "luminária", "vaso", "panela", "frigideira", "liquidificador", "microondas", "geladeira", "fogão", "aspirador", "organizador", "prateleira", "estante"],
    "Beleza e Cuidados Pessoais": ["shampoo", "condicionador", "creme", "perfume", "maquiagem", "batom", "base", "protetor solar", "desodorante", "escova", "secador", "prancha", "hidratante", "sabonete", "esmalte"],
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return "Eletrônicos e Informática";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'URL inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = parsed.data;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Não foi possível acessar o link (${response.status})` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    const name = extractTitle(html);
    const imageUrl = extractImage(html);
    const price = extractPrice(html);
    const category = guessCategory(name);

    return new Response(JSON.stringify({
      success: true,
      data: { name, imageUrl, price, category },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error extracting product:', error);
    return new Response(JSON.stringify({ error: 'Erro ao extrair dados do produto' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
