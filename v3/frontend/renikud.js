// In-browser ReNikud: unvocalized Hebrew -> IPA with stress, one result per word.
// Model: renikud/renikud (Melichov, Kolani, Alper, "ReNikud: Audio-Supervised Hebrew G2P", IEEE SLT 2026), CC BY 4.0.
// Decoding follows the reference renikud-onnx package (letter-constrained consonants, one stress per word),
// extended so niqqud the user typed constrains the prediction instead of being thrown away.

const ALEF = 0x05d0, TAV = 0x05ea, STRESS = 'ˈ';
const isHebrewLetter = (c) => { const o = c.codePointAt(0); return o >= ALEF && o <= TAV; };

// Vowel point -> allowed vowel classes (indices into the model's vowel vocab: ∅ a e i o u).
const V = { NONE: 0, A: 1, E: 2, I: 3, O: 4, U: 5 };
const POINT_VOWELS = {
  '\u05b7': [V.A], '\u05b2': [V.A], '\u05b8': [V.A], '\u05b5': [V.E], '\u05b6': [V.E], '\u05b1': [V.E],
  '\u05b4': [V.I], '\u05b9': [V.O], '\u05ba': [V.O], '\u05b3': [V.O], '\u05c7': [V.O], '\u05bb': [V.U],
  '\u05b0': [V.NONE, V.E], '\u05bd': [V.E],
};
const DAGESH = '\u05bc', SHIN_DOT = '\u05c1', SIN_DOT = '\u05c2', HATAMA = '\u05ab';

export class ReNikud {
  constructor(session, meta) {
    this.s = session; this.m = meta;
    this.cons = Object.entries(meta.consonant_vocab).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    this.vow = Object.entries(meta.vowel_vocab).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    this.cid = Object.fromEntries(this.cons.map((c, i) => [c, i]));
  }

  // words: array of strings (may carry niqqud). Returns array of IPA strings (same length).
  async phonemizeWords(words, ort) {
    // Strip marks into per-letter hints; the model only sees letters, geresh/gershayim and punctuation.
    const chars = [];
    const wordSpans = [];
    words.forEach((w, wi) => {
      if (wi) chars.push({ c: ' ' });
      const start = chars.length; let last = null;
      for (const ch of w.normalize('NFD')) {
        const o = ch.codePointAt(0);
        if (o >= 0x0591 && o <= 0x05c7 && !isHebrewLetter(ch)) { if (last) last.marks += ch; continue; }
        const c = ch === '׳' || ch === '`' || ch === '´' || ch === '’' ? "'" : ch === '״' || ch === '”' || ch === '“' ? '"' : ch;
        const item = { c, letter: isHebrewLetter(c), marks: '', word: wi }; chars.push(item);
        if (item.letter) last = item;
      }
      wordSpans.push([start, chars.length]);
    });
    const ids = [this.m.cls_token_id, ...chars.map((x) => this.m.vocab[x.c] ?? this.m.vocab['[UNK]'] ?? 0), this.m.sep_token_id];
    const n = ids.length;
    const feeds = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, n]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]),
    };
    const out = await this.s.run(feeds);
    const CL = out.consonant_logits.data, VL = out.vowel_logits.data, SL = out.stress_logits.data;
    const nc = this.cons.length, nv = this.vow.length;
    const argmaxIn = (L, base, allowed) => { let best = allowed[0], bv = -Infinity; for (const k of allowed) { const v = L[base + k]; if (v > bv) { bv = v; best = k; } } return best; };
    const allC = [...Array(nc).keys()], allV = [...Array(nv).keys()];

    const pointed = wordSpans.map(([s, e]) => chars.slice(s, e).filter((x) => /[\u05b0-\u05bb\u05c7]/.test(x.marks)).length >= 1);
    const res = [];
    for (const [s, e] of wordSpans) {
      // stress: the letter with the highest stress logit, unless the user marked one with a hataf/meteg-style accent
      let stressPos = -1, bv = -Infinity;
      for (let i = s; i < e; i++) {
        const x = chars[i]; if (!x.letter) continue;
        if (x.marks.includes(HATAMA)) { stressPos = i; bv = Infinity; break; }
        const v = SL[(i + 1) * 2 + 1]; if (v > bv) { bv = v; stressPos = i; }
      }
      let ipa = '';
      for (let i = s; i < e; i++) {
        const x = chars[i];
        if (!x.letter) { if (x.c !== "'" && x.c !== '"') ipa += x.c; continue; }
        const t = i + 1;
        let allowedC = this.m.letter_consonant_constraints[x.c] ?? allC;
        let allowedV = allV;
        const mk = x.marks;
        // In a word written with vowel points, an unpointed letter carries no vowel (silent letter or mater lectionis).
        if (pointed[x.word] && !/[\u05b0-\u05bb\u05bd\u05c7]/.test(mk)) allowedV = [V.NONE];
        if (mk) {
          if (x.c === 'ש' && mk.includes(SHIN_DOT)) allowedC = allowedC.filter((k) => this.cons[k] === 'ʃ');
          if (x.c === 'ש' && mk.includes(SIN_DOT)) allowedC = allowedC.filter((k) => this.cons[k] === 's');
          if ('בכפ'.includes(x.c) || 'ךף'.includes(x.c)) {
            const hard = { 'ב': 'b', 'כ': 'k', 'ך': 'k', 'פ': 'p', 'ף': 'p' }[x.c], soft = { 'ב': 'v', 'כ': 'χ', 'ך': 'χ', 'פ': 'f', 'ף': 'f' }[x.c];
            const want = mk.includes(DAGESH) ? hard : soft;
            const f = allowedC.filter((k) => this.cons[k] === want); if (f.length) allowedC = f;
          }
          if (x.c !== 'ו' && x.c !== 'י') {
            const pts = [...mk].filter((p) => POINT_VOWELS[p]);
            if (pts.length) allowedV = [...new Set(pts.flatMap((p) => POINT_VOWELS[p]))];
          } else if (x.c === 'ו' && /[\u05b0-\u05b8\u05bd]/.test(mk) && !mk.includes('\u05b9') && !(mk.includes(DAGESH) && !/[\u05b0-\u05b8]/.test(mk))) {
            const f = allowedC.filter((k) => this.cons[k] === 'v'); if (f.length) allowedC = f;
            const pts = [...mk].filter((p) => POINT_VOWELS[p]); if (pts.length) allowedV = [...new Set(pts.flatMap((p) => POINT_VOWELS[p]))];
          }
        }
        const ci = argmaxIn(CL, t * nc, allowedC), vi = argmaxIn(VL, t * nv, allowedV);
        let cons = this.cons[ci], vow = this.vow[vi];
        if (this.m.geresh_map[x.c] && chars[i + 1]?.c === "'") cons = this.m.geresh_map[x.c];
        const stressed = i === stressPos;
        const final = !(chars[i + 1] && chars[i + 1].letter);
        if (x.c === 'ח' && final && vow === 'a') ipa += (stressed ? STRESS : '') + 'aχ';
        else ipa += (cons !== '∅' ? cons : '') + (stressed ? STRESS : '') + (vow !== '∅' ? vow : '');
      }
      res.push(ipa);
    }
    return res;
  }
}
