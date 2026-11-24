// Hebrew number reading -> IPA words (Phonikud/ReNikud phoneme conventions).
// Feminine is the default counting form; masculine is used before masculine nouns, for days of the month,
// percentages and currencies.
const F1 = ['ʔˈefes', 'ʔaχˈat', 'ʃtˈajim', 'ʃalˈoʃ', 'ʔaʁbˈa', 'χamˈeʃ', 'ʃˈeʃ', 'ʃˈeva', 'ʃmˈone', 'tˈeʃa'];
const M1 = ['ʔˈefes', 'ʔeχˈad', 'ʃnˈajim', 'ʃloʃˈa', 'ʔaʁbaʔˈa', 'χamiʃˈa', 'ʃiʃˈa', 'ʃivʔˈa', 'ʃmonˈa', 'tiʃʔˈa'];
const F_TEEN = ['ʔˈeseʁ', 'ʔaχˈat ʔesʁˈe', 'ʃtˈem ʔesʁˈe', 'ʃlˈoʃ ʔesʁˈe', 'ʔaʁbˈa ʔesʁˈe', 'χamˈeʃ ʔesʁˈe', 'ʃˈeʃ ʔesʁˈe', 'ʃvˈa ʔesʁˈe', 'ʃmˈone ʔesʁˈe', 'tʃˈa ʔesʁˈe'];
const M_TEEN = ['ʔasaʁˈa', 'ʔaχˈad ʔasˈaʁ', 'ʃnˈem ʔasˈaʁ', 'ʃloʃˈa ʔasˈaʁ', 'ʔaʁbaʔˈa ʔasˈaʁ', 'χamiʃˈa ʔasˈaʁ', 'ʃiʃˈa ʔasˈaʁ', 'ʃivʔˈa ʔasˈaʁ', 'ʃmonˈa ʔasˈaʁ', 'tiʃʔˈa ʔasˈaʁ'];
const TENS = ['', '', 'ʔesʁˈim', 'ʃloʃˈim', 'ʔaʁbaʔˈim', 'χamiʃˈim', 'ʃiʃˈim', 'ʃivʔˈim', 'ʃmonˈim', 'tiʃʔˈim'];
const HUND = ['', 'mˈeʔa', 'matˈajim', 'ʃlˈoʃ meʔˈot', 'ʔaʁbˈa meʔˈot', 'χamˈeʃ meʔˈot', 'ʃˈeʃ meʔˈot', 'ʃvˈa meʔˈot', 'ʃmˈone meʔˈot', 'tʃˈa meʔˈot'];
const THOU = ['', 'ʔˈelef', 'ʔalpˈajim', 'ʃlˈoʃet ʔalafˈim', 'ʔaʁbˈaʔat ʔalafˈim', 'χamˈeʃet ʔalafˈim', 'ʃˈeʃet ʔalafˈim', 'ʃivʔˈat ʔalafˈim', 'ʃmonˈat ʔalafˈim', 'tiʃʔˈat ʔalafˈim', 'ʔasˈeʁet ʔalafˈim'];

// "and" before the last element: u- before ʃC / labials / shva-initial words, ve- otherwise.
export function withVe(w) {
  if (/^(ʃt|ʃn|ʃl|ʃm|ʃv|tʃ|m|b|p)/.test(w) && !/^mˈeʔa/.test(w)) return 'u' + w;
  if (w.startsWith('ʔ')) return 've' + w;
  return 've' + w;
}

function below100(n, masc) {
  if (n < 10) return (masc ? M1 : F1)[n];
  if (n < 20) return (masc ? M_TEEN : F_TEEN)[n - 10];
  const t = TENS[Math.floor(n / 10)], u = n % 10;
  return u ? `${t} ${withVe((masc ? M1 : F1)[u])}` : t;
}
// Groups below 1000, as a list of words; the caller adds the conjunction to the last group.
function below1000(n, masc) {
  const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(HUND[h]);
  if (r) out.push(below100(r, masc));
  return out;
}
function joinParts(parts) {
  // Hebrew puts "ve" only before the final element.
  if (parts.length < 2) return parts.join(' ');
  const last = parts.pop();
  const lastHasVe = /\s(ve|u)\S+$/.test(last);
  return [...parts, lastHasVe ? last : withVe(last)].join(' ');
}

export function cardinal(n, masc = false) {
  if (!Number.isFinite(n)) return null;
  if (n < 0) return `mˈinus ${cardinal(-n, masc)}`;
  if (n === 0) return F1[0];
  if (n >= 1e12) return null;
  const parts = [];
  const scale = (v, word, plural, two) => {
    if (!v) return;
    if (v === 1) parts.push(word);
    else if (v === 2) parts.push(two);
    else parts.push(`${joinParts(below1000(v, true))} ${plural}`);
  };
  scale(Math.floor(n / 1e9), 'miljˈaʁd', 'miljˈaʁd', 'ʃnˈej miljˈaʁd');
  scale(Math.floor(n / 1e6) % 1000, 'miljˈon', 'miljˈon', 'ʃnˈej miljˈon');
  const th = Math.floor(n / 1000) % 1000;
  if (th) parts.push(th <= 10 ? THOU[th] : `${joinParts(below1000(th, true))} ʔˈelef`);
  const rest = n % 1000;
  if (rest) {
    const h = Math.floor(rest / 100), r = rest % 100;
    if (h) parts.push(HUND[h]);
    if (r) parts.push(below100(r, masc));
  }
  return joinParts(parts);
}

export function digits(s) { return [...s].map((d) => F1[Number(d)]).join(' '); }

export function decimal(intPart, frac, masc = false) {
  const a = cardinal(Number(intPart), masc);
  const b = frac.length > 2 || frac.startsWith('0') ? digits(frac) : cardinal(Number(frac), false);
  return `${a} nekudˈa ${b}`;
}

const MONTHS = ['', 'janwˈaʁ', 'febʁwˈaʁ', 'mˈeʁts', 'ʔapʁˈil', 'mˈaj', 'jˈuni', 'jˈuli', 'ʔˈoɡust', 'septˈembeʁ', 'ʔoktˈobeʁ', 'novˈembeʁ', 'detsˈembeʁ'];
export function date(d, m, y) {
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  let out = `${cardinal(d, true)} be${MONTHS[m]}`;
  if (y != null) { let yy = Number(y); if (String(y).length === 2) yy += yy < 50 ? 2000 : 1900; out += ` ${cardinal(yy)}`; }
  return out;
}
export function time(h, m) {
  if (!(h >= 0 && h <= 24 && m >= 0 && m < 60)) return null;
  const hh = cardinal(h);
  if (m === 0) return hh;
  if (m === 30) return `${hh} vaχˈetsi`;
  if (m === 15) return `${hh} vaʁˈeva`;
  return `${hh} ${withVe(cardinal(m))}`;
}
