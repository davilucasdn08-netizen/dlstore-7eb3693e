import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BodySchema = z.object({
  url: z.string().url().max(2000),
});

function normalizeBRPrice(raw: string): string {
  let p = raw.trim().replace(/[R$\s\u00a0]/g, '');
  if (!p) return '';
  
  // Already Brazilian format: 1.299,00
  if (p.includes('.') && p.includes(',')) return p;
  // Only comma with 2 decimals: 299,00
  if (/,\d{2}$/.test(p) && !p.includes('.')) return p;
  // Only dot with 2 decimals: 299.00 → 299,00
  if (/\.\d{2}$/.test(p) && !p.includes(',')) {
    // Check if dot is thousands separator (1.299) vs decimal (29.99)
    const parts = p.split('.');
    if (parts[0].length > 3) {
      // e.g. 1299.99 → 1.299,99
      const num = parseFloat(p);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return p.replace('.', ',');
  }
  // Pure integer like 1299 → 1.299,00
  if (/^\d+$/.test(p) && p.length > 0) {
    const num = parseInt(p);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return p;
}

function extractPrice(html: string): string {
  // Try structured data first (most reliable) - look for full price with cents
  const jsonLdPriceWithCents = html.match(/"price"\s*:\s*"?(\d+\.\d{1,2})"?/);
  if (jsonLdPriceWithCents?.[1]) {
    return normalizeBRPrice(jsonLdPriceWithCents[1]);
  }

  // Amazon-specific: combine whole + fraction (most accurate for Amazon)
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

  // Generic R$ pattern with cents
  const brFull = html.match(/R\$\s*([\d.]+,\d{2})/);
  if (brFull?.[1]) return normalizeBRPrice(brFull[1]);

  // R$ without comma
  const brSimple = html.match(/R\$\s*([\d.,]+)/);
  if (brSimple?.[1]) return normalizeBRPrice(brSimple[1]);

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

function extractRating(html: string): string {
  // Amazon: "4,5 de 5 estrelas" or data attribute
  const amazonRating = html.match(/class="a-icon-alt"[^>]*>([0-9.,]+)\s*(de|out of)\s*5/);
  if (amazonRating?.[1]) return amazonRating[1].replace('.', ',');

  // Structured data: aggregateRating
  const jsonLdRating = html.match(/"ratingValue"\s*:\s*"?([0-9.,]+)"?/);
  if (jsonLdRating?.[1]) {
    const val = jsonLdRating[1].replace('.', ',');
    return val;
  }

  // Meta tag
  const metaRating = html.match(/itemprop="ratingValue"\s+content="([^"]+)"/);
  if (metaRating?.[1]) return metaRating[1].replace('.', ',');

  // Review count for context
  const reviewCount = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/);
  
  return "";
}
}

function extractTitle(html: string): string {
  const patterns = [
    /id="productTitle"[^>]*>\s*([^<]+)/,
    /id="title"[^>]*>\s*([^<]+)/,
    /property="og:title"\s+content="([^"]+)"/,
    /name="title"\s+content="([^"]+)"/,
    /<title[^>]*>([^<]+)</,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      let title = match[1].trim();
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

function guessCategory(title: string, html: string): string {
  const lower = title.toLowerCase();
  
  // Try to extract category from the page itself first
  // Amazon breadcrumbs
  const breadcrumb = html.match(/class="a-link-normal a-color-tertiary"[^>]*>\s*([^<]+)/);
  const amazonCat = breadcrumb?.[1]?.trim().toLowerCase() || '';
  
  // Amazon department / category node
  const department = html.match(/id="nav-subnav"[^>]*data-category="([^"]+)"/);
  const deptVal = department?.[1]?.toLowerCase() || '';
  
  // Structured data category
  const schemaCat = html.match(/"category"\s*:\s*"([^"]+)"/);
  const schemaVal = schemaCat?.[1]?.toLowerCase() || '';

  const allContext = `${lower} ${amazonCat} ${deptVal} ${schemaVal}`;

  const categories: Record<string, string[]> = {
    "Eletrônicos e Informática": [
      "notebook", "celular", "fone", "mouse", "teclado", "monitor", "tablet",
      "câmera", "camera", "caixa de som", "carregador", "cabo", "usb", "bluetooth",
      "smart", "echo", "alexa", "kindle", "tv", "televisão", "televisao",
      "computador", "pc", "ssd", "hd", "memória", "memoria", "placa", "processador",
      "headset", "speaker", "phone", "laptop", "wireless", "wi-fi", "wifi",
      "eletrônico", "eletronico", "electronics", "computers", "informática", "informatica",
      "impressora", "printer", "pendrive", "pen drive", "roteador", "router",
      "console", "playstation", "xbox", "nintendo", "gaming", "gamer",
      "drone", "gopro", "webcam", "microfone", "microphone", "caixa amplificada",
      "controle", "controller", "joystick", "placa de vídeo", "gpu", "cpu",
      "fonte", "gabinete", "cooler", "ventilador pc", "adaptador", "hub",
    ],
    "Moda e Acessórios": [
      "camisa", "camiseta", "calça", "calca", "vestido", "saia", "blusa",
      "jaqueta", "tênis", "tenis", "sapato", "bota", "sandália", "sandalia",
      "bolsa", "mochila", "carteira", "óculos", "oculos", "relógio", "relogio",
      "anel", "brinco", "colar", "pulseira", "roupa", "moda", "chapéu", "chapeu",
      "boné", "bone", "fashion", "clothing", "shoes", "jewelry",
      "bermuda", "short", "moletom", "suéter", "sueter", "casaco", "blazer",
      "chinelo", "sapatilha", "peep toe", "scarpin", "slip on", "sneaker",
      "cinto", "gravata", "lenço", "lenco", "cachecol", "luva", "meias", "meia",
      "lingerie", "cueca", "sutiã", "sutia", "pijama", "biquíni", "biquini",
      "maiô", "maio", "regata", "polo", "social",
    ],
    "Casa e Decoração": [
      "sofá", "sofa", "mesa", "cadeira", "cama", "travesseiro", "lençol", "lencol",
      "cortina", "tapete", "luminária", "luminaria", "vaso", "panela", "frigideira",
      "liquidificador", "microondas", "geladeira", "fogão", "fogao", "aspirador",
      "organizador", "prateleira", "estante", "home", "kitchen", "furniture",
      "colchão", "colchao", "edredom", "cobertor", "toalha", "almofada",
      "abajur", "espelho", "quadro", "porta-retrato", "relógio de parede",
      "cafeteira", "torradeira", "batedeira", "mixer", "air fryer", "airfryer",
      "fritadeira", "forno", "grill", "churrasqueira", "espremedor",
      "ferro de passar", "máquina de lavar", "secadora", "lava-louça",
      "ventilador", "ar condicionado", "aquecedor", "umidificador",
      "vassoura", "rodo", "balde", "lixeira", "pano", "detergente",
      "jogo de cama", "jogo americano", "aparelho de jantar", "talheres",
      "copo", "xícara", "prato", "jarra", "garrafa térmica",
    ],
    "Beleza e Cuidados Pessoais": [
      "shampoo", "condicionador", "creme", "perfume", "maquiagem", "batom",
      "base", "protetor solar", "desodorante", "escova de cabelo", "secador",
      "prancha", "hidratante", "sabonete", "esmalte", "beauty", "cosmetics",
      "skincare", "skin care", "máscara", "mascara", "rímel", "rimel",
      "corretivo", "pó compacto", "blush", "iluminador", "contorno",
      "demaquilante", "tônico", "tonico", "sérum", "serum", "ácido",
      "proteção solar", "fps", "colônia", "colonia", "eau de toilette",
      "body splash", "loção", "locao", "óleo corporal", "oleo corporal",
      "depilador", "barbeador", "aparelho de barbear", "gillette",
      "escova dental", "pasta de dente", "fio dental", "enxaguante",
      "cabelo", "hair", "tintura", "coloração", "coloracao",
      "chapinha", "babyliss", "modelador", "difusor",
    ],
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => allContext.includes(k))) return cat;
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
    const category = guessCategory(name, html);
    const rating = extractRating(html);

    return new Response(JSON.stringify({
      success: true,
      data: { name, imageUrl, price, category, rating },
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
