// Hebrew nikud -> IPA. A JavaScript port of the rule-based phonemizer in
// Phonikud (https://github.com/thewh1teagle/phonikud, CC BY 4.0, by thewh1teagle et al.), schema "modern",
// with stress and punctuation kept. Number/date expansion is not ported.
const HATAMA = '\u05ab', VOCAL_SHVA = '\u05bd', PREFIX = '|', HASER = '\u05af', STRESS = 'ˈ';
const N = { PATAH: '\u05b7', KAMATZ: '\u05b8', HIRIK: '\u05b4', SEGOL: '\u05b6', TSERE: '\u05b5', HOLAM: '\u05b9', KUBUTS: '\u05bb', SHVA: '\u05b0', DAGESH: '\u05bc', SIN: '\u05c2', HATAF_KAMATZ: '\u05b3' };
const NON_STD = VOCAL_SHVA + HATAMA + '\\|' + HASER + "'";
const HE_PATTERN = new RegExp(`[\\u05b0-\\u05ea${NON_STD}"]+`, 'gu');
const GERESH = { 'ג': 'dʒ', 'ז': 'ʒ', 'ת': 'ta', 'צ': 'tʃ', 'ץ': 'tʃ' };
const LP = { 'א': 'ʔ', 'ב': 'v', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'x', 'ט': 't', 'י': 'j', 'ך': 'x', 'כ': 'x', 'ל': 'l', 'ם': 'm', 'מ': 'm', 'ן': 'n', 'נ': 'n', 'ס': 's', 'ע': 'ʔ', 'פ': 'f', 'ף': 'f', 'ץ': 'ts', 'צ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'ʃ', 'ת': 't', 'בּ': 'b', 'כּ': 'k', 'פּ': 'p', 'שׁ': 'ʃ', 'שׂ': 's', "'": '' };
const NP = { '\u05b4': 'i', '\u05b1': 'e', '\u05b5': 'e', '\u05b6': 'e', '\u05b2': 'a', '\u05b7': 'a', '\u05c7': 'o', '\u05b9': 'o', '\u05ba': 'o', '\u05bb': 'u', '\u05b3': 'o', '\u05b8': 'a', [HATAMA]: STRESS, [VOCAL_SHVA]: 'e' };
const SET = new Set([...Object.values(NP), ...Object.values(LP), ...Object.values(GERESH), 'χ', 'ʁ', 'ɡ', 'w'].join(''));
const PUNCT = new Set('.,!? ');
const GNUVA = { 'ח': 'ax', 'ה': 'ah', 'ע': 'a' };
const VOWEL_DIACS = new Set([...Array.from({ length: 11 }, (_, i) => String.fromCharCode(0x05b1 + i)), '\u05c7', '\u05bd']);

const sortDiacs = (t) => t.replace(/(\p{L})(\p{M}+)/gu, (_, l, d) => l + [...d].sort().join(''));
export function normalize(text) {
  text = text.normalize('NFD');
  text = sortDiacs(text).replace(/״/g, '"').replace(/׳/g, "'");
  return text.replace(/\u05f3/g, "'").replace(/־/g, '-');
}
class Letter {
  constructor(char, diac) { this.char = normalize(char); this.all = normalize(diac); }
  get diac() { return [...this.all].filter((c) => c !== HATAMA && c !== PREFIX).join(''); }
  toString() { return this.char + this.all; }
}
const getLetters = (w) => [...w.matchAll(/(\p{L})([\p{M}'|]*)/gu)].map((m) => new Letter(m[1], m[2]));

function sortStress(parts) {
  const text = parts.join('');
  if (!text.includes(STRESS) || !/[aeiou]/.test(text)) return parts;
  parts = parts.map((p) => p.replaceAll(STRESS, ''));
  for (let i = 0; i < parts.length; i++) {
    const r = parts[i].replace(/([aeiou])/, `${STRESS}$1`);
    if (r !== parts[i]) { parts[i] = r; break; }
  }
  return parts;
}
const clean = (out) => out.filter((p) => p && [...p].every((c) => SET.has(c)));
const vowels = (cur) => [...cur.all].map((n) => NP[n] ?? '');
const stressOf = (cur) => (cur.all.includes(HATAMA) ? [STRESS] : []);
const out = (cur, con, vow = null, skip = 0) => [clean(sortStress([...(con ? [con] : []), ...(vow ?? vowels(cur))])), skip];
const PAT = /[\u05b7-\u05b8]/;
function vavVowel(d) {
  if (PAT.test(d)) return 'va';
  if (d.includes(N.TSERE) || d.includes(N.SEGOL) || d.includes(VOCAL_SHVA)) return 've';
  if (d.includes(N.HOLAM)) return 'o';
  if (d.includes(N.KUBUTS) || d.includes(N.DAGESH)) return 'u';
  if (d.includes(N.HIRIK)) return 'vi';
  return null;
}
function vav(cur, prev, nxt) {
  const d = cur.diac, s = stressOf(cur);
  if (prev && prev.diac.includes(N.SHVA) && d.includes(N.HOLAM)) return out(cur, 'vo', s);
  if (nxt && nxt.char === 'ו') {
    const dd = d + nxt.diac;
    if (dd.includes(N.HOLAM)) return out(cur, 'vo', s, 1);
    if (d === nxt.diac) return out(cur, 'vu', s, 1);
    const v = vavVowel(d); if (v) return out(cur, v, s);
    if (d.includes(N.SHVA) && !nxt.diac) return out(cur, 'v', s);
    return out(cur, '', s);
  }
  const v = vavVowel(d); if (v) return out(cur, v, s);
  if (d.includes(N.SHVA) && !prev) return out(cur, 've', s);
  if (nxt && !d) return out(cur, '', s);
  return out(cur, 'v', s);
}
function shin(cur, prev, nxt) {
  if (cur.diac.includes(N.SIN)) {
    if (nxt && nxt.char === 'ש' && !nxt.diac && PAT.test(cur.diac)) return out(cur, 'sa', stressOf(cur), 1);
    return out(cur, 's');
  }
  if (!cur.diac && prev && prev.diac.includes(N.SIN)) return out(cur, 's');
  return out(cur, LP['ש']);
}
function letter(cur, prev, nxt) {
  const d = cur.diac, ch = cur.char, s = stressOf(cur);
  if (cur.all.includes(HASER)) return [[], 0];
  if (d.includes("'") && ch in GERESH) return out(cur, GERESH[ch], ch === 'ת' ? [] : null);
  if (d.includes(N.DAGESH) && (ch + N.DAGESH) in LP) return out(cur, LP[ch + N.DAGESH]);
  if (ch === 'ו') return vav(cur, prev, nxt);
  if (ch === 'ש') return shin(cur, prev, nxt);
  if (!nxt && d.includes(N.PATAH) && ch in GNUVA) return out(cur, GNUVA[ch], s);
  if (d.includes(N.KAMATZ) && nxt && nxt.diac.includes(N.HATAF_KAMATZ)) return out(cur, LP[ch] ?? '', ['o', ...s]);
  if (ch === 'א' && !d && prev && nxt && nxt.char !== 'ו') return out(cur, '');
  if (ch === 'י' && !d && prev && nxt && prev.char + prev.diac !== 'אֵ' && !(nxt.char === 'ו' && nxt.diac && !nxt.diac.includes(N.SHVA))) return out(cur, '');
  return out(cur, LP[ch] ?? '');
}
function phonemizeWord(letters) {
  const ph = []; let i = 0;
  while (i < letters.length) {
    const [p, skip] = letter(letters[i], letters[i - 1] ?? null, letters[i + 1] ?? null);
    ph.push(...p); i += skip + 1;
  }
  return ph;
}
const hasVowelDiacs = (s) => s === 'וּ' || [...s].some((c) => VOWEL_DIACS.has(c));
function getSyllables(word) {
  const L = getLetters(word); const syl = []; let cur = ''; let vs = false; let i = 0;
  while (i < L.length) {
    const l = L[i];
    const hv = hasVowelDiacs(String(l)) || (i === 0 && l.all.includes(N.SHVA));
    const v1 = i + 2 < L.length && L[i + 2].char === 'ו';
    const v2 = i + 3 < L.length && L[i + 3].char === 'ו';
    if (hv) { if (vs) { syl.push(cur); cur = String(l); } else cur += String(l); vs = true; } else cur += String(l);
    i += 1;
    if (v1 && v2) { if (cur) { syl.push(cur + String(L[i])); cur = ''; } cur = String(L[i + 1]) + String(L[i + 2]); i += 3; vs = true; }
    else if (v1 && L[i + 1].diac) { if (cur) { syl.push(cur); cur = ''; } vs = false; }
  }
  if (cur) syl.push(cur);
  return syl;
}
function addMilra(word) {
  const syl = getSyllables(word); if (!syl.length) return word;
  const idx = syl.length - 1;
  const L = getLetters(syl[idx]); L[0].all += HATAMA; syl[idx] = L.map(String).join('');
  return syl.join('');
}
function sortHatama(L) {
  for (let i = 0; i < L.length - 1; i++) {
    if (L[i].all.includes(HATAMA) && L[i].all.includes(HASER)) { L[i].all = L[i].all.replace(HATAMA, ''); L[i + 1].all += HATAMA; }
  }
  return L;
}
function postNormalize(ph) {
  return ph.split(' ').map((w) => w.replace(/ʔ$/, '').replace(/h$/, '').replace(/ˈh$/, '').replace(/ij$/, 'i')).join(' ');
}
const SPECIAL = { 'צה"ל': 'tsˈahal', 'וַאלְלָה': 'wˈala', 'וואצאפ': 'wˈatsʔap', 'וואטסאפ': 'wˈatsʔap', 'יאללה': 'jˈala', '₪': 'ʃˈekel', '$': 'dˈolar', '%': 'axˈuz' };
function markVocalShva(word) {
  const L = getLetters(word); if (!L.length) return word;
  if (!L[0].all.includes('\u05b0')) return word;
  if ('למנרי'.includes(L[0].char) || (L.length > 1 && 'אעה'.includes(L[1].char))) L[0].all += VOCAL_SHVA;
  return L.map(String).join('');
}
export function phonemize(text, { predictVocalShva = false } = {}) {
  text = normalize(text);
  text = text.split(/\s+/).map((w) => SPECIAL[w] ?? SPECIAL[w.replace(/[\u05b0-\u05c7\u05ab\u05bd|]/g, '')] ?? w).join(' ');
  text = text.replace(HE_PATTERN, (word) => {
    if (predictVocalShva && !word.includes(VOCAL_SHVA)) word = markVocalShva(word);
    if (!word.includes(HATAMA)) word = addMilra(word);
    let ph = phonemizeWord(sortHatama(getLetters(word))).join('');
    ph = postNormalize(ph);
    return ph.replace(/x/g, 'χ').replace(/r/g, 'ʁ').replace(/g/g, 'ɡ');
  });
  for (const c of Object.values(SPECIAL).join('')) SET.add(c);
  return [...text].map((c) => (c === '-' ? ' ' : (SET.has(c) || c === ' ' || PUNCT.has(c) ? c : ''))).join('');
}
