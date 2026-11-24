// Text front-end for PiVo Hebrew v3: cleans the text, reads numbers, dates, abbreviations and Latin words,
// and splits it into phrases with pause lengths. Pronunciation of Hebrew words comes from ReNikud (renikud.js);
// this file only decides what gets said and where the pauses go.
import { cardinal, decimal, date, time, digits, withVe } from './numbers.js';
import { latinToIpa } from './english.js';

const L = '\u05d0-\u05ea', M = '\u0591-\u05c7';
export const strip = (w) => w.replace(/[\u0591-\u05c7]/g, '');

// Pause after a phrase, in seconds, by what ended it. Values follow typical read-speech pause lengths.
export const GAP = { para: 0.9, '.': 0.55, '!': 0.6, '?': 0.6, ellipsis: 0.5, colon: 0.32, dash: 0.3, paren: 0.22, comma: 0.24, list: 0.15, clause: 0.1 };

const ABBR = {
  'ד"ר': ['דוקטור', 'dˈoktoʁ'], "פרופ'": ['פרופסור', 'pʁofˈesoʁ'], "גב'": ['גברת', 'ɡvˈeʁet'], 'ש"ח': ['שקלים', 'ʃkalˈim'],
  'ע"י': ['על ידי', 'ʔˈal jedˈej'], "וכו'": ['וכולי', 'veχˈulej'], "וכד'": ['וכדומה', 'veχadomˈe'], 'בע"מ': ['בעמ', 'bˈeʔam'],
  'ארה"ב': ['ארצות הברית', 'ʔaʁtsˈot habʁˈit'], 'צה"ל': ['צהל', 'tsˈahal'], 'ת"א': ['תל אביב', 'tˈel ʔavˈiv'], 'ק"מ': ['קילומטר', 'kilomˈeteʁ'],
  'ס"מ': ['סנטימטר', 'sentimˈeteʁ'], 'מ"מ': ['מילימטר', 'milimˈeteʁ'], 'ק"ג': ['קילו', 'kˈilo'], 'מ"ר': ['מטר', 'mˈeteʁ ʁavˈua'], "עמ'": ['עמוד', 'ʔamˈud'],
  "רח'": ['רחוב', 'ʁeχˈov'], "מס'": ['מספר', 'mispˈaʁ'], 'סה"כ': ['סך הכל', 'sˈaχ hakˈol'], 'בי"ס': ['בית ספר', 'bˈejt sˈefeʁ'], 'ביה"ס': ['בית הספר', 'bˈejt hasˈefeʁ'],
  'עו"ד': ['עורך דין', 'ʔˈoʁeχ dˈin'], 'רו"ח': ['רואה חשבון', 'ʁoʔˈe χeʃbˈon'], 'מנכ"ל': ['מנכל', 'mankˈal'], 'מנכ"לית': ['מנכלית', 'mankalˈit'],
  'יו"ר': ['יושב ראש', 'joʃˈev ʁˈoʃ'], 'ח"כ': ['חבר כנסת', 'χavˈeʁ knˈeset'], 'אח"כ': ['אחר כך', 'ʔaχˈaʁ kˈaχ'], 'ז"ל': ['זל', 'zˈal'], 'כנ"ל': ['כנל', 'kanˈal'],
  'דו"ח': ['דוח', 'dˈoχ'], 'בג"ץ': ['בגץ', 'bˈaɡats'], 'רמטכ"ל': ['רמטכל', 'ʁamatkˈal'], 'שב"כ': ['שבכ', 'ʃabˈak'], 'מד"א': ['מדא', 'madˈa'], 'תנ"ך': ['תנך', 'tanˈaχ'],
  'ת"ז': ['תעודת זהות', 'teʔudˈat zehˈut'], 'מע"מ': ['מעמ', 'maʔˈam'], 'חו"ל': ['חול', 'χˈul'], 'או"ם': ['אום', 'ʔˈum'], 'אא"כ': ['אלא אם כן', 'ʔˈela ʔˈim kˈen'],
  'עפ"י': ['על פי', 'ʔˈal pˈi'], 'בד"כ': ['בדרך כלל', 'bedˈeʁeχ klˈal'], 'ע"ש': ['על שם', 'ʔˈal ʃˈem'], 'כ"כ': ['כל כך', 'kˈol kˈaχ'], 'ש"ס': ['שס', 'ʃˈas'],
  'רה"מ': ['ראש הממשלה', 'ʁˈoʃ hamemʃalˈa'], 'ראה"מ': ['ראש הממשלה', 'ʁˈoʃ hamemʃalˈa'], 'ביהמ"ש': ['בית המשפט', 'bˈejt hamiʃpˈat'], 'בס"ד': ['', ''],
  "ג'נסן": ["ג'נסן", 'dʒˈensen'], 'הואנג': ['הואנג', 'hwˈanɡ'], 'מיקרוסופט': ['מיקרוסופט', 'mˈajkʁosoft'], 'ומיקרוסופט': ['ומיקרוסופט', 'vemˈajkʁosoft'],
  'יאללה': ['יאללה', 'jˈala'], 'וואלה': ['וואלה', 'wˈala'], 'וואטסאפ': ['וואטסאפ', 'wˈatsʔap'], 'אנבידיה': ['אנבידיה', 'ʔenvˈidja'],
};
const PREFIX_IPA = { 'ו': 've', 'ה': 'ha', 'ב': 'be', 'ל': 'le', 'מ': 'mi', 'ש': 'ʃe', 'כ': 'ke' };
function prefixIpa(p, next) {
  let out = '';
  [...p].forEach((c, i) => {
    const rest = i === p.length - 1 ? next : PREFIX_IPA[p[i + 1]];
    if (c === 'ו' && i === 0) out += /^(ʃt|ʃn|ʃl|ʃm|ʃv|tʃ|m|b|p)/.test(rest) ? 'u' : 've';
    else if (c === 'מ' && /^[ʔhχʁ]/.test(rest)) out += 'me';
    else if ('בלכ'.includes(c) && p[i + 1] === 'ה') { out += PREFIX_IPA[c][0] + 'a'; }
    else if (c === 'ה' && i > 0 && 'בלכ'.includes(p[i - 1])) { /* merged into ba/la/ka */ }
    else out += PREFIX_IPA[c];
  });
  return out;
}

const MONTH_RE = /^ב?(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/;
const MASC_UNITS = new Set(['שקל', 'שקלים', 'ש"ח', 'דולר', 'דולרים', 'יורו', 'אחוז', 'אחוזים', 'ימים', 'יום', 'חודשים', 'חודש', 'אנשים', 'ילדים', 'מטר', 'מטרים', 'קילומטר', 'קילומטרים', 'ק"מ', 'ס"מ', 'גרם', 'קילו', 'ק"ג', 'מיליון', 'מיליארד', 'אלף', 'תינוקות', 'מקומות', 'חלונות', 'שולחנות', 'לילות', 'דורות', 'רחובות', 'כלבים', 'ספרים', 'שבועות', 'סטודנטים', 'עובדים', 'פרמטרים', 'שחקנים']);
const FEM_IM = new Set(['שנים', 'פעמים', 'ביצים', 'ערים', 'אבנים', 'נשים', 'ציפורים', 'שעתיים', 'מילים']);
function isMasc(next) {
  if (!next) return false;
  const w = strip(next).replace(/[^א-ת"']/g, '');
  if (MASC_UNITS.has(w) || MONTH_RE.test(w)) return true;
  if (FEM_IM.has(w)) return false;
  return /ים$/.test(w) && w.length > 3;
}
const CURRENCY = { '₪': ['ʃkalˈim', 'ʃˈekel ʔeχˈad'], '$': ['dˈolaʁ', 'dˈolaʁ ʔeχˈad'], '€': ['jˈuʁo', 'jˈuʁo ʔeχˈad'] };

// One number token (digits with optional separators, %, currency) -> IPA, or null.
function numberIpa(tok, next) {
  let m;
  let cur = null, pct = false;
  tok = tok.replace(/^([₪$€])/, (_, c) => { cur = c; return ''; }).replace(/([₪$€])$/, (_, c) => { cur = c; return ''; });
  if (tok.endsWith('%')) { pct = true; tok = tok.slice(0, -1); }
  const unitNext = next && /^(ש"ח|שקלים|שקל)$/.test(strip(next)) ? '₪' : null;
  const masc = pct || cur || unitNext || isMasc(next);
  let ipa = null;
  if ((m = tok.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/))) ipa = date(+m[1], +m[2], m[3]);
  else if ((m = tok.match(/^(\d{1,2})[./](\d{1,2})$/)) && next && false) ipa = date(+m[1], +m[2]);
  else if ((m = tok.match(/^(\d{1,2}):(\d{2})$/))) ipa = time(+m[1], +m[2]);
  else if ((m = tok.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/))) { const n = m[1].replace(/,/g, ''); ipa = m[2] ? decimal(n, m[2], masc) : cardinal(+n, masc); }
  else if ((m = tok.match(/^(\d+)\.(\d+)$/))) ipa = decimal(m[1], m[2], masc);
  else if ((m = tok.match(/^(\d+)-(\d+)$/))) ipa = `${cardinal(+m[1], masc)} ʔˈad ${cardinal(+m[2], masc)}`;
  else if (/^\d+$/.test(tok)) {
    if ((tok.length > 1 && tok[0] === '0') || tok.length > 12) ipa = digits(tok);
    else {
      const n = +tok;
      if (n === 2 && next && /[א-ת]/.test(next) && !pct && !cur && !MONTH_RE.test(strip(next))) ipa = masc ? 'ʃnˈej' : 'ʃtˈej';
      else ipa = cardinal(n, masc);
    }
  }
  if (!ipa) return null;
  if (pct) ipa += ' ʔaχˈuz';
  const c = cur || null;
  if (c) ipa = tok === '1' ? CURRENCY[c][1] : `${ipa} ${CURRENCY[c][0]}`;
  return ipa;
}

// ---- tokenizer ----
const TOKEN_RE = new RegExp([
  '(\\n[ \\t]*\\n\\s*)', // 1 paragraph
  '(\\n)', // 2 line break
  `([₪$€]?\\d(?:[\\d,.:/\\-]*\\d)?%?[₪$€]?)`, // 3 number-ish
  `([A-Za-z][A-Za-z0-9]*(?:['’.\\-&][A-Za-z0-9]+)*)`, // 4 latin
  `([${L}][${L}${M}|]*(?:["״'׳][${L}][${L}${M}|]*)*['׳]?)`, // 5 hebrew word (with gershayim / geresh)
  '(\\.{2,}|…|[?!]{2,}|[.?!]|[,;:]|[–—]|(?<=\\s)-(?=\\s)|[()\\[\\]{}])', // 6 punctuation
  '([&+@=])', // 7 symbols
].join('|'), 'gu');
const SYM = { '&': ['ו', 've'], '+': ['פלוס', 'plˈus'], '@': ['שטרודל', 'ʃtʁudˈel'], '=': ['שווה', 'ʃavˈe'] };

export function clean(raw) {
  return raw.normalize('NFC')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[“”„«»]/g, '"').replace(/[‘’‚`´]/g, "'").replace(/\r/g, '')
    .replace(/(?<=[א-ת][\u0591-\u05c7]*)[״"](?=[א-ת])/g, '"') // gershayim stays inside acronyms
    .replace(/־/g, ' ').replace(/(?<=[א-ת][\u0591-\u05c7]*)-(?=[א-ת])/g, ' ')
    .replace(/[\t ]+/g, ' ');
}

// Returns sentences: [{ phrases: [{ items, end, gap, question }] }]
// item: { he: Hebrew text for the G2P context (may be ''), ipa: fixed IPA or null, src }
export function plan(raw) {
  const text = clean(raw);
  const toks = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m[1]) toks.push({ t: 'brk', k: 'para' });
    else if (m[2]) toks.push({ t: 'brk', k: 'line' });
    else if (m[3]) toks.push({ t: 'num', v: m[3], at: m.index });
    else if (m[4]) toks.push({ t: 'lat', v: m[4] });
    else if (m[5]) toks.push({ t: 'heb', v: m[5], at: m.index, end: m.index + m[5].length });
    else if (m[6]) toks.push({ t: 'brk', k: m[6] });
    else if (m[7]) toks.push({ t: 'sym', v: m[7] });
  }
  // Hebrew prefix letters glued to a number or Latin word: ב-12%, ל-2025, ה-iPhone
  for (let i = 0; i < toks.length - 1; i++) {
    const a = toks[i], b = toks[i + 1];
    if (a.t === 'heb' && /^[ובלהמשכ]{1,3}$/.test(strip(a.v)) && (b.t === 'num' || b.t === 'lat') && /^[-־]?$/.test(text.slice(a.end, b.at ?? a.end).trim() || '')) {
      b.prefix = strip(a.v); a.t = 'skip';
    }
  }
  const words = toks.filter((t) => t.t !== 'skip');

  const sentences = []; let phrases = [], items = [];
  const close = (kind) => {
    if (items.length) { phrases.push({ items, kind }); items = []; }
    else if (phrases.length && (GAP[kind] ?? 0) > (GAP[phrases.at(-1).kind] ?? 0)) phrases.at(-1).kind = kind;
  };
  const endSentence = (kind) => { close(kind); if (phrases.length) sentences.push({ phrases }); phrases = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const nextHeb = words.slice(i + 1).find((x) => x.t !== 'brk' || true);
    const next = nextHeb && nextHeb.t === 'heb' ? nextHeb.v : null;
    if (w.t === 'brk') {
      const k = w.k;
      if (k === 'para') endSentence('para');
      else if (k === 'line') endSentence('.');
      else if (/^[.]$/.test(k)) {
        // a single Hebrew letter followed by a dot is an initial (א. ב. יהושע)
        const prev = words[i - 1];
        if (prev && prev.t === 'heb' && strip(prev.v).length === 1) continue;
        endSentence('.');
      } else if (/^[?!]+$/.test(k)) endSentence(k.includes('?') ? '?' : '!');
      else if (k === '…' || /^\.{2,}$/.test(k)) close('ellipsis');
      else if (k === ',') close('comma');
      else if (k === ';' || k === ':') close('colon');
      else if (k === '–' || k === '—' || k === '-') close('dash');
      else close('paren');
      continue;
    }
    if (w.t === 'num') {
      const ipa = numberIpa(w.v, next);
      if (!ipa) continue;
      const first = ipa.split(' ')[0];
      items.push({ he: '', ipa: (w.prefix ? prefixIpa(w.prefix, first) : '') + ipa, src: (w.prefix || '') + w.v });
      // a unit word right after the number is already spoken
      if (next && /^(ש"ח)$/.test(strip(next))) { const n = words[i + 1]; if (n && n.t === 'heb') { n.t = 'done'; items.at(-1).ipa += ` ${ipa === 'ʔaχˈat' ? 'ʃˈekel' : 'ʃkalˈim'}`; } }
      continue;
    }
    if (w.t === 'done') continue;
    if (w.t === 'lat') {
      const ipa = latinToIpa(w.v); if (!ipa) continue;
      items.push({ he: '', ipa: (w.prefix ? prefixIpa(w.prefix, ipa) : '') + ipa, src: w.v });
      continue;
    }
    if (w.t === 'sym') { const [he, ipa] = SYM[w.v]; items.push({ he, ipa, src: w.v }); continue; }
    if (w.t === 'heb') {
      const v = w.v.replace(/\|/g, '').replace(/׳/g, "'").replace(/״/g, '"');
      const key = strip(v);
      let ab = ABBR[key];
      if (!ab) { const pm = key.match(/^([ובלהמשכ]{1,2})(.+)$/); if (pm && ABBR[pm[2]] && /["']/.test(pm[2])) { const [he, ipa] = ABBR[pm[2]]; ab = [pm[1] + he, prefixIpa(pm[1], ipa) + ipa]; } }
      if (ab) { if (ab[1]) items.push({ he: ab[0], ipa: ab[1], src: v }); continue; }
      items.push({ he: v, ipa: null, src: v });
    }
  }
  endSentence('.');

  // lists: comma-separated runs of short phrases get short pauses
  for (const s of sentences) {
    const short = (p) => p && p.kind === 'comma' && p.items.length <= 2;
    const isItem = s.phrases.map((p, i) => short(p) && (short(s.phrases[i - 1]) || short(s.phrases[i + 1])));
    s.phrases.forEach((p, i) => { if (isItem[i] || (short(p) && isItem[i + 1])) p.kind = 'list'; });
    s.phrases = s.phrases.flatMap(splitLong);
    const last = s.phrases.at(-1);
    const first = [...s.phrases[0].items.slice(0, 2), ...last.items.slice(0, 2)].map((x) => strip(x.src || '').replace(/^ו/, ''));
    s.question = last.kind === '?' ? (first.some((w) => WH.has(w)) ? 'wh' : 'yn') : null;
    s.phrases.forEach((p, i) => {
      const isLast = i === s.phrases.length - 1;
      p.end = isLast ? (p.kind === '?' ? '?' : p.kind === '!' ? '!' : '.') : ',';
      if (isLast && p.kind !== '?' && p.kind !== '!' && p.kind !== 'para') p.kind = '.';
      p.gap = GAP[p.kind] ?? GAP.comma;
      // tag questions like "..., לא?" rise even after a wh-free statement
      p.question = isLast && s.question === 'yn';
    });
  }
  const all = sentences.flatMap((s) => s.phrases);
  if (all.length) all.at(-1).gap = 0;
  return sentences;
}

const WH = new Set(['מה', 'מי', 'איפה', 'איך', 'למה', 'מדוע', 'מתי', 'כמה', 'איזה', 'איזו', 'אילו', 'לאן', 'מאיפה', 'מאין', 'היכן', 'כיצד', 'מהו', 'מהי', 'מיהו', 'מיהי', 'באיזה', 'באיזו', 'למי', 'ממי', 'ממה', 'בכמה', 'לכמה', 'כמהו']);
const STRONG = new Set(['אבל', 'אלא', 'כי', 'לכן', 'ולכן', 'אולם', 'אך', 'למרות', 'בגלל', 'כדי', 'אז', 'ואז', 'כאשר', 'בזמן', 'עד', 'מפני', 'משום', 'אם', 'או', 'וגם', 'אשר', 'שבו', 'שבה', 'שבהם', 'ואילו', 'בעוד', 'כך', 'אחרי', 'לפני', 'מאז', 'כמו']);
const NUM_WORD = /^ו(אחד|אחת|שניים|שתיים|שני|שתי|שלוש|ארבע|חמש|חמיש|שש|שיש|שבע|שמונ|תשע|עשר|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאות|מאתיים|אלף|אלפיים|חצי|רבע)/;
const NOT_CONJ = /^(ו(?:ה|ב|ל|כ|מ)?)?(ויכוח|וילון|ווילון|ורד|ורוד|וידאו|ויזה|ועד|ותיק|וריד|ויטמין|וואלה|ולנטיין)/;
// common words that merely start with ש (not the relative prefix ש-)
const SH_WORD = /^(שמונ|שלוש|שבע|שיש|שני|שתי|שתיים|שנה|שנים|שעה|שעות|שבוע|שבת|שלום|שלי|שלך|שלו|שלה|שלנו|שלכם|שלהם|שלהן|שמש|שוק|שולחן|שיר|שיא|שאל|שמח|שקט|שחור|שמאל|שביל|שוב|שום|שמיים|שירות|שלט|שלב|שטח|שפה|שינוי|שימוש|שיחה|שכנ|שכונ|שופט|שוטר|שחקן|שגריר|שמן|שמלה|שעון|שקל|שורה|שאר|שלם|שלמ|שמור|שפע|שאיפ|שליט|שלח|שמע|שמר|שתה|שכח|שלט)/;
const WEAK = new Set(['על', 'עם', 'את', 'אל', 'מול', 'לפי', 'בין', 'בתוך', 'מתוך', 'ליד', 'אצל', 'בשביל', 'במהלך', 'לגבי']);
function boundaryScore(w, weakOk) {
  const s = strip(w.src || w.he || '');
  if (!s || w.ipa) return 0;
  if (STRONG.has(s)) return 3;
  if (/^כש/.test(s) && s.length > 3) return 2.5;
  if (/^ו[א-ת]{2,}/.test(s) && !NOT_CONJ.test(s) && !NUM_WORD.test(s)) return 2;
  if (/^ש[א-ת]{3,}/.test(s) && !SH_WORD.test(s)) return 1;
  if (weakOk && WEAK.has(s)) return 0.8;
  if (weakOk && /^[בלמ][א-ת]{3,}/.test(s)) return 0.5;
  return 0;
}
// Break phrases longer than MAX words at the most clause-like word near the middle;
// past SOFT words also accept prepositions, past HARD words split anyway (the model was trained on clips under ~10 s).
const MAX = 10, SOFT = 14, HARD = 20;
function splitLong(p) {
  const n = p.items.length;
  if (n <= MAX) return [p];
  let best = -1, bs = -Infinity;
  for (let i = 3; i <= n - 3; i++) {
    const sc = boundaryScore(p.items[i], n > SOFT); if (!sc) continue;
    const v = sc - Math.abs(i - n / 2) / n * 2;
    if (v > bs && (v > 0 || n > SOFT)) { bs = v; best = i; }
  }
  if (best < 0 && n > HARD) best = Math.round(n / 2);
  if (best < 0) return [p];
  return [...splitLong({ items: p.items.slice(0, best), kind: 'clause' }), ...splitLong({ items: p.items.slice(best), kind: p.kind })];
}

// ---- IPA clean-up after the G2P model ----
const VOW = /[aeiou]/;
export function fixWord(he, ipa) {
  const s = strip(he);
  let w = ipa;
  // conjunction ו-: the model sometimes drops its consonant ("e...") or doubles it ("vu...").
  // Everyday speech says "ve-" even before labials, so that is left alone.
  if (/^ו[^וי]/.test(s) && s.length > 2) {
    if (/^ˈ?e/.test(w) && !/^ˈ?e[aeiou]/.test(w)) w = 'v' + w;
    // "vu" + soft consonant means the model meant the u- form (ובהם -> uvahem); otherwise say ve-
    else if (/^vˈ?u[vχf]/.test(w)) w = w.replace(/^v(ˈ?)u/, '$1u');
    else if (/^vˈ?u[^aeiouˈ]/.test(w)) w = w.replace(/^v(ˈ?)u/, 've$1');
  }
  // furtive patah under a final ע (יודע -> jodˈea)
  if (/ע$/.test(s)) w = w.replace(/([aeiou]ˈ?|ˈ[aeiou])ʔa$/, '$1a').replace(/([ei])ʔa$/, '$1a');
  // Phonikud post-normalization, which the training data used
  w = w.replace(/ʔ$/, '').replace(/(ˈ?)h$/, '').replace(/ij$/, 'i');
  // exactly one stress mark, right before a vowel
  const hadStress = w.includes('ˈ');
  let pos = w.indexOf('ˈ');
  w = w.replace(/ˈ/g, '');
  if (VOW.test(w)) {
    if (pos < 0 || !hadStress) pos = w.length;
    let v = w.slice(pos).search(VOW);
    if (v >= 0) v += pos; else { v = -1; for (let i = w.length - 1; i >= 0; i--) if (VOW.test(w[i])) { v = i; break; } }
    w = w.slice(0, v) + 'ˈ' + w.slice(v);
  }
  return w;
}
