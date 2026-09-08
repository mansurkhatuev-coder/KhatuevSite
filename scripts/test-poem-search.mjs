// scripts/test-poem-search.mjs
import assert from 'node:assert/strict';

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[iіӀӏⅠ]/g, 'i')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s) {
  const t = normalize(s);
  if (t.length < 2) return new Set();
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function bestDice(query, text) {
  const n = normalize(text);
  if (!n) return 0;
  let best = dice(query, n);
  for (const w of n.split(' ')) {
    if (w.length >= 2) best = Math.max(best, dice(query, w));
  }
  return best;
}

function scorePoem(query, { title, meta, body }) {
  const q = normalize(query);
  if (!q) return 1;
  let best = 0;
  const titleN = normalize(title);
  const metaN = normalize(meta);
  const bodyN = normalize(body);
  if (titleN.includes(q)) best = Math.max(best, 300);
  if (metaN.includes(q)) best = Math.max(best, 200);
  if (bodyN.includes(q)) best = Math.max(best, 100);
  if (q.length >= 2) {
    const dTitle = bestDice(q, title);
    if (dTitle >= 0.45) best = Math.max(best, dTitle * 30);
    const dMeta = bestDice(q, meta);
    if (dMeta >= 0.45) best = Math.max(best, dMeta * 20);
  }
  return best;
}

assert.equal(normalize('Ёлка Iаьржа'), 'елка iаьржа');
assert.ok(normalize('Нохчийчоь').includes('нохчийчо'));
assert.ok(scorePoem('Нохчйчо', { title: 'Бусулба сан Нохчийчоь', meta: '', body: '' }) > 5);
assert.ok(scorePoem('Песнь орла', { title: 'Аьрзунан илли', meta: '«Песнь орла» · 1997', body: '' }) >= 200);
assert.ok(scorePoem('Песнь орла', { title: 'Жизнь коротка', meta: 'перевод', body: '' }) < 3.5);
assert.equal(scorePoem('zzzqqq', { title: 'Аьрзунан', meta: '', body: '' }) < 3.5, true);

console.log('ok');
