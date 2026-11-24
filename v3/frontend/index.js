// Text -> phrases of IPA for the acoustic model.
import { plan, fixWord, strip } from './text.js';
export { plan };

// g2p(words: string[]) -> Promise<string[]> (one IPA per word)
export async function textToPhrases(raw, g2p) {
  const sentences = plan(raw);
  const out = [];
  for (const s of sentences) {
    // One G2P call per sentence so every word sees its full context; punctuation is kept for the model.
    const words = [], slots = [];
    s.phrases.forEach((p) => {
      p.items.forEach((it, j) => {
        if (!it.he) return;
        const parts = it.he.split(' ');
        parts.forEach((w, k) => {
          const isEnd = p.kind !== 'clause' && j === p.items.length - 1 && k === parts.length - 1;
          words.push(isEnd ? w + p.end : w);
          slots.push(it.ipa == null && parts.length === 1 ? it : null);
        });
      });
    });
    const ipas = words.length ? await g2p(words) : [];
    ipas.forEach((ipa, i) => { const it = slots[i]; if (it) it.ipa = fixWord(it.he, ipa.replace(/[.,?!]+$/, '')); });
    for (const p of s.phrases) {
      const ipa = p.items.map((it) => it.ipa).filter(Boolean).join(' ');
      if (/[aeiou]/.test(ipa)) out.push({ ipa: ipa + p.end, gap: p.gap, question: p.question, text: p.items.map((it) => it.src).join(' ') });
    }
  }
  if (out.length) out.at(-1).gap = 0;
  return out;
}
