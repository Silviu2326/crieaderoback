import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY || '',
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
});

const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const TARGET_AVAILABLE = 100;
const BATCH_SIZE = 20;
const MAX_BATCHES = 100;
const RDAP_DELAY_MS = 800;
const OUTPUT_FILE = path.resolve(process.cwd(), 'available-domains.txt');

function extractDomainsFromText(text: string): string[] {
  // Remove <think> blocks
  const noThink = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Try to extract JSON array
  const arrayMatch = noThink.match(/\[.*\]/s);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((d: unknown) => {
          let s = String(d).toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (s.endsWith('com') && s.length > 3) s = s.slice(0, -3);
          return s;
        });
      }
    } catch {
      // ignore and fall through
    }
  }

  // Fallback: extract lines that look like domain names
  return noThink
    .split(/\n/)
    .map((l) => l.trim().replace(/^[-*•\d.)]+\s*/, ''))
    .filter((l) => /^[a-z0-9-]+$/i.test(l))
    .map((d) => {
      let s = d.toLowerCase();
      if (s.endsWith('com') && s.length > 3) s = s.slice(0, -3);
      return s;
    });
}

async function generateDomains(exclude: string[]): Promise<string[]> {
  const categories = `
1. Brandable names (inventados, fáciles de pronunciar): como Google, Nike, Ikea, Quora.
2. Two-word combinations (dos palabras combinadas): como Facebook, OpenDoor.
3. Portmanteau (mezcla de dos palabras): como Pinterest, FedEx.
4. Alternate spellings (deletreos alternativos): como Lyft, Fiverr.
5. Non-English names (palabras de otros idiomas): como Toyota, Audi.
`;

  // No enviamos la lista completa de exclusiones a la IA porque puede confundir al modelo
  // cuando crece mucho. El filtrado local con checkedDomains ya evita duplicados.
  const excludeText = '';

  const prompt = `Genera ${BATCH_SIZE} nombres de dominio .com para un ERP de fitness (gimnasios, entrenadores). Usa estas categorías como inspiración:
${categories}

Reglas:
- EVITA nombres obvios como fitpro, gymmax, powerfit, fitcore (ya ocupados).
- Prefiere creativos, abstractos, palabras de otros idiomas, combinaciones inusuales.
- Máximo 15 caracteres antes del .com.
- Fáciles de deletrear y pronunciar.

Responde ÚNICAMENTE con un array JSON de strings. Sin markdown, sin explicaciones. Ejemplo:
["fitcore", "gymnex", "strenox"]
`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Eres un asistente útil que responde exclusivamente en formato JSON cuando se te solicita.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 1200,
      });

      const raw = completion.choices[0]?.message?.content || '';
      const domains = extractDomainsFromText(raw).filter((d) => d.length > 0 && !exclude.includes(d));

      if (domains.length > 0) {
        return domains;
      }

      console.log(`   ⚠️  Intento ${attempts}: la IA no devolvió dominios válidos.`);
      const afterThink = raw.match(/<\/think>([\s\S]*)$/);
      const tail = afterThink ? afterThink[1].trim().slice(0, 300) : raw.slice(0, 300).replace(/\n/g, ' ');
      console.log(`   📝 Después de </think>: ${tail}`);
    } catch (err) {
      console.log(`   ⚠️  Intento ${attempts} fallido: ${err}. Reintentando...`);
    }
  }

  throw new Error('No se pudieron generar dominios después de varios intentos.');
}

async function checkDomainAvailability(domain: string, retries = 2): Promise<{ domain: string; available: boolean | null; error?: string }> {
  const url = `https://rdap.org/domain/${domain}.com`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.status === 404) {
      return { domain: `${domain}.com`, available: true };
    }
    if (res.status === 200) {
      return { domain: `${domain}.com`, available: false };
    }
    if (res.status === 429 && retries > 0) {
      console.log(`   ⏳ Rate limit en RDAP, esperando 5s...`);
      await sleep(5000);
      return checkDomainAvailability(domain, retries - 1);
    }
    return { domain: `${domain}.com`, available: null, error: `HTTP ${res.status}` };
  } catch (err) {
    return { domain: `${domain}.com`, available: null, error: String(err) };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendDomainToFile(domain: string) {
  fs.appendFileSync(OUTPUT_FILE, domain + '\n', 'utf-8');
}

async function main() {
  console.log(`🤖 Objetivo: encontrar ${TARGET_AVAILABLE} dominios .com disponibles para ERP fitness`);
  console.log(`💾 Guardando en: ${OUTPUT_FILE}\n`);

  let existingDomains: string[] = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    existingDomains = fs.readFileSync(OUTPUT_FILE, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
  } else {
    fs.writeFileSync(OUTPUT_FILE, '# Dominios .com disponibles para ERP fitness\n# Generado el ' + new Date().toISOString() + '\n\n', 'utf-8');
  }

  const checkedDomains = new Set<string>(existingDomains.map((d) => d.replace(/\.com$/, '')));
  const availableDomains: string[] = [...existingDomains];
  let batchNumber = 0;

  while (availableDomains.length < TARGET_AVAILABLE && batchNumber < MAX_BATCHES) {
    batchNumber++;
    console.log(`\n📦 Lote ${batchNumber}/${MAX_BATCHES} — pidiendo ${BATCH_SIZE} ideas a MiniMax...`);

    let domains: string[];
    try {
      domains = await generateDomains(Array.from(checkedDomains));
    } catch (err) {
      console.error('❌ Error generando dominios con IA:', err);
      console.log('   ⏭️  Saltando este lote y continuando...');
      continue;
    }

    if (domains.length === 0) {
      console.log('⚠️  MiniMax no devolvió dominios nuevos. Intentando de nuevo...');
      continue;
    }

    console.log(`🔍 Verificando ${domains.length} dominios...\n`);

    for (const domain of domains) {
      if (checkedDomains.has(domain)) continue;
      checkedDomains.add(domain);

      const result = await checkDomainAvailability(domain);

      const icon = result.available === true ? '🟢' : result.available === false ? '🔴' : '⚠️';
      const status = result.available === true
        ? 'DISPONIBLE'
        : result.available === false
          ? 'NO DISPONIBLE'
          : `ERROR (${result.error})`;
      console.log(`${icon} ${result.domain.padEnd(20)} → ${status}`);

      if (result.available === true) {
        availableDomains.push(result.domain);
        appendDomainToFile(result.domain);
        if (availableDomains.length >= TARGET_AVAILABLE) break;
      }

      await sleep(RDAP_DELAY_MS);
    }

    const pct = ((availableDomains.length / TARGET_AVAILABLE) * 100).toFixed(1);
    console.log(`\n📊 Progreso: ${availableDomains.length}/${TARGET_AVAILABLE} (${pct}%) — verificados: ${checkedDomains.size}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESULTADO FINAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (availableDomains.length === 0) {
    console.log('\n😕 No se encontraron dominios disponibles en este intento.');
    console.log('   Consejo: prueba aumentando MAX_BATCHES o relaja las restricciones.');
  } else {
    console.log(`\n✅ Se encontraron ${availableDomains.length} dominio(s) disponible(s):\n`);
    availableDomains.forEach((d) => console.log(`   • ${d}`));
  }

  console.log(`\n🔎 Total verificados: ${checkedDomains.size}`);
  console.log(`💾 Guardados en: ${OUTPUT_FILE}`);
  console.log('');
}

main();
