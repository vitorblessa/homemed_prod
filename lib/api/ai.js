import { getDb } from '@/lib/mongo';
import { enrichMedicine, enrichFromBarcodeAndImage, readBoxDates, answerInventoryQuestion } from '@/lib/ai';
import { hit } from '@/lib/rate-limit';
import { COL, HOUR, json, scopeFilter } from '@/lib/api/common';

// Rotas de IA (enriquecimento, fotos, perguntas ao estoque).
export async function handleAI(request, { path, segs, method, user, userEmail }) {
  // AI enrichment (no persistence)
  if (path === '/ai/enrich' && method === 'POST') {
    const body = await request.json();
    const input = (body?.name || body?.query || '').toString().trim();
    if (!input) return json({ error: 'name obrigatório' }, 400);
    const result = await enrichMedicine(input);
    return json(result);
  }

  // AI enrichment from barcode + image (Gemini Vision)
  if (path === '/ai/enrich-barcode' && method === 'POST') {
    const body = await request.json();
    const barcode = (body?.barcode || '').toString().trim();
    const image_base64 = body?.image_base64;
    if (!barcode && !image_base64) return json({ error: 'barcode ou image_base64 obrigatório' }, 400);
    if (image_base64) {
      if (typeof image_base64 !== 'string' || image_base64.length > 3_500_000) {
        return json({ error: 'Foto muito grande. Tente de novo com uma foto menor.' }, 413);
      }
      // Cada leitura de foto custa uma chamada de IA: limite por conta.
      const rl = await hit(await getDb(), `photo:${userEmail}`, 20, HOUR);
      if (!rl.allowed) {
        const res = json({ error: 'Muitas fotos em pouco tempo. Tente de novo mais tarde ou cadastre pelo nome.' }, 429);
        res.headers.set('Retry-After', String(rl.retryAfterSec));
        return res;
      }
    }
    const result = await enrichFromBarcodeAndImage({ barcode, image_base64 });
    return json(result);
  }

  // Lote / fabricação / validade a partir de uma foto (close do carimbo)
  if (path === '/ai/read-box-dates' && method === 'POST') {
    const body = await request.json();
    const image_base64 = body?.image_base64;
    if (typeof image_base64 !== 'string' || !image_base64) return json({ error: 'image_base64 obrigatório' }, 400);
    if (image_base64.length > 3_500_000) return json({ error: 'Foto muito grande. Tente de novo com uma foto menor.' }, 413);
    const rl = await hit(await getDb(), `photo:${userEmail}`, 20, HOUR);
    if (!rl.allowed) {
      const res = json({ error: 'Muitas fotos em pouco tempo. Tente de novo mais tarde ou digite os dados.' }, 429);
      res.headers.set('Retry-After', String(rl.retryAfterSec));
      return res;
    }
    return json(await readBoxDates({ image_base64 }));
  }

  // Natural language query on inventory
  if (path === '/ai/ask' && method === 'POST') {
    const body = await request.json();
    const question = (body?.question || '').toString().trim();
    if (!question) return json({ error: 'question obrigatório' }, 400);
    const db = await getDb();
    const meds = await db.collection(COL).find(scopeFilter(user)).toArray();
    const answer = await answerInventoryQuestion(question, meds);
    return json({ answer });
  }
  return null;
}
