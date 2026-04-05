/**
 * DLSTORE — Sincronizador de Dados da Amazon
 * 
 * Atualiza preços no Supabase e descrições no arquivo JSON com base na Amazon.
 * Uso: node sync-data.cjs
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hrfyphdygyyjbajhuiuo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZnlwaGR5Z3l5amJhamh1aXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjkyNjQsImV4cCI6MjA5MDI0NTI2NH0.ncVdTyiRvUJn3O5CBPzspu4RaNRfcQp6_RbB0uHpRWw';
const DESC_PATH = path.join(__dirname, 'src', 'data', 'descriptions.json');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
];

function normalizePrice(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/[R$\s\u00a0]/g, '').replace(/\./g, '');
}

function fetchPage(url) {
  return new Promise((resolve) => {
    const doRequest = (targetUrl, redirects = 0) => {
      if (redirects > 5) return resolve({ error: 'too_many_redirects' });
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      
      const req = https.get(targetUrl, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (loc.startsWith('/')) loc = 'https://www.amazon.com.br' + loc;
          return doRequest(loc, redirects + 1);
        }

        let stream = res;
        const enc = res.headers['content-encoding'];
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        let data = '';
        stream.on('data', c => data += c);
        stream.on('end', () => resolve({ body: data }));
        stream.on('error', e => resolve({ error: e.message }));
      });

      req.on('error', e => resolve({ error: e.message }));
      req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    };
    doRequest(url);
  });
}

function extractPrice(html) {
  const wholeMatch = html.match(/class="a-price-whole"[^>]*>([^<]+)<\/span>/);
  const fractionMatch = html.match(/class="a-price-fraction"[^>]*>([^<]+)<\/span>/);
  
  if (wholeMatch && wholeMatch[1]) {
    let whole = wholeMatch[1].replace(/[^\d]/g, '');
    let fraction = fractionMatch ? fractionMatch[1].replace(/[^\d]/g, '') : '00';
    if (fraction.length === 1) fraction += '0';
    return `${parseInt(whole).toLocaleString('pt-BR')},${fraction.slice(0, 2)}`;
  }

  const offscreen = html.match(/class="a-offscreen"[^>]*>R\$\s*([^<]+)<\/span>/);
  if (offscreen) return offscreen[1].trim();

  return null;
}

function extractDescription(html) {
  const match = html.match(/<ul class="a-unordered-list a-vertical a-spacing-mini">([\s\S]*?)<\/ul>/);
  if (match) {
    return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  const matchDesc = html.match(/<div id="productDescription"[^>]*>([\s\S]*?)<\/div>/);
  if (matchDesc) {
    return matchDesc[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  return null;
}

function checkDescription(local, remote) {
  if (!local || !remote) return false;
  const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cLocal = clean(local);
  const cRemote = clean(remote);
  if (cLocal.length === 0 || cRemote.length === 0) return false;
  const lengthDiff = Math.abs(cLocal.length - cRemote.length) / Math.max(cLocal.length, cRemote.length);
  return lengthDiff < 0.3 || cRemote.includes(cLocal.substring(0, 50));
}

async function start() {
  console.log('🚀 DLSTORE — Sincronizando Dados com a Amazon');
  console.log('='.repeat(60));

  const { data: products, error } = await supabase.from('products').select('id, name, price, affiliate_link');
  if (error) { console.error('❌ Erro Supabase:', error.message); return; }

  let descriptions = {};
  if (fs.existsSync(DESC_PATH)) {
    descriptions = JSON.parse(fs.readFileSync(DESC_PATH, 'utf8'));
  }

  console.log(`📦 Sincronizando ${products.length} produtos...\n`);

  const results = { updated: 0, skipped: 0, errors: 0, captcha: 0 };
  let saveCounter = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const nameShort = p.name.substring(0, 40);
    process.stdout.write(`[${i+1}/${products.length}] ${nameShort.padEnd(40)} → `);

    if (!p.affiliate_link) {
      console.log('⏭ sem link');
      results.skipped++;
      continue;
    }

    const page = await fetchPage(p.affiliate_link);
    if (page.error || !page.body || page.body.length < 5000 || page.body.includes('captchacharacters')) {
      if (page.body && page.body.includes('captchacharacters')) {
        console.log('🔴 CAPTCHA');
        results.captcha++;
      } else {
        console.log(`❌ erro: ${page.error || 'página vazia'}`);
        results.errors++;
      }
      await sleep(5000);
      continue;
    }

    const amzPrice = extractPrice(page.body);
    const amzDesc = extractDescription(page.body);
    const localDesc = descriptions[p.id] || '';

    let updatedPrice = false;
    let updatedDesc = false;

    // Sync Price
    if (amzPrice) {
      if (normalizePrice(p.price) !== normalizePrice(amzPrice)) {
        const { error: updateError } = await supabase.from('products').update({ price: amzPrice }).eq('id', p.id);
        if (updateError) {
          console.error(`❌ Erro no update do preço: ${updateError.message}`);
        } else {
          updatedPrice = true;
        }
      }
    }

    // Sync Description
    if (amzDesc && !checkDescription(localDesc, amzDesc)) {
      descriptions[p.id] = amzDesc;
      updatedDesc = true;
      saveCounter++;
      // Save JSON every 10 updates
      if (saveCounter >= 10) {
        fs.writeFileSync(DESC_PATH, JSON.stringify(descriptions, null, 2));
        saveCounter = 0;
      }
    }

    if (updatedPrice || updatedDesc) {
      let msg = '✅ ';
      if (updatedPrice) msg += `💰 R$ ${amzPrice} `;
      if (updatedDesc) msg += `📝 Descrição atualizada`;
      console.log(msg);
      results.updated++;
    } else {
      console.log('🆗 Já estava correto');
      results.skipped++;
    }

    await sleep(2000 + Math.random() * 3000);
  }

  // Final save for JSON
  fs.writeFileSync(DESC_PATH, JSON.stringify(descriptions, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 SINCRONIZAÇÃO FINALIZADA:');
  console.log(`   ✅ Sincronizados:     ${results.updated}`);
  console.log(`   ⏭ Ignorados/Mantidos: ${results.skipped}`);
  console.log(`   🔴 Bloqueios/Capcha:  ${results.captcha}`);
  console.log(`   ❌ Erros Totais:      ${results.errors}`);
  console.log('='.repeat(60));
}

start().catch(console.error);
