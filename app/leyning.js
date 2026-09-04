/* The day's Torah reading, resolved through hebcal and looked up in the
 * pre-pulled text (Tanach with Ta'amei Hamikra, public domain). */
import { HDate } from '@hebcal/core';
import { getLeyningOnDate } from '@hebcal/leyning';

export function readingFor(hd, il, texts) {
  let items;
  try { items = getLeyningOnDate(hd, il, true); } catch (e) { return null; }
  if (!items || !items.length) return null;
  const out = [];
  for (const item of items) {
    const parts = item.weekday || item.fullkriyah;
    if (!parts) continue;
    const name = (item.name && item.name.en) || '';
    const store = texts[name];
    if (!store) continue;
    out.push({
      name,
      he: (item.name && item.name.he) || name,
      summary: item.summary || '',
      isMincha: /Mincha/i.test(name),
      aliyot: Object.entries(parts).map(([k, a]) => ({
        n: k,
        ref: `${a.k} ${a.b}-${a.e}`,
        verses: (store[k] || {}).v || [],
      })).filter((a) => a.verses.length),
    });
  }
  return out.length ? out : null;
}
