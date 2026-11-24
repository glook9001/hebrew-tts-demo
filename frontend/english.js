// Latin-script words inside Hebrew text, read the way an Israeli speaker would.
// 1) a small dictionary of common brands and tech words, 2) short all-caps words are spelled out,
// 3) a rough spelling-to-sound fallback using only phonemes the Hebrew voice knows.
const DICT = {
  iphone: 'ʔˈajfon', ipad: 'ʔˈajpad', apple: 'ʔˈepel', google: 'ɡˈuɡel', microsoft: 'mˈajkʁosoft', nvidia: 'ʔenvˈidja',
  amazon: 'ʔˈamazon', facebook: 'fˈejsbuk', instagram: 'ʔˈinstaɡʁam', whatsapp: 'wˈatsʔap', youtube: 'jˈutjub', tiktok: 'tˈiktok',
  netflix: 'nˈetfliks', tesla: 'tˈesla', samsung: 'sˈamsunɡ', android: 'ʔandʁˈoid', windows: 'wˈindouz', linux: 'lˈinuks',
  chatgpt: 'tʃˈat dʒi pi tˈi', openai: 'ʔˈopen ʔej ʔˈaj', zoom: 'zˈum', pay: 'pˈej', paypal: 'pˈejpal', twitter: 'twˈiteʁ', x: 'ʔˈeks', email: 'ʔˈimejl', mail: 'mˈejl',
  online: 'ʔˈonlajn', app: 'ʔˈep', apps: 'ʔˈeps', store: 'stˈoʁ', the: 'da', and: 'ʔˈend', of: 'ʔˈov', new: 'nju', york: 'jˈoʁk', ok: 'ʔokˈej', okay: 'ʔokˈej',
  hello: 'hˈelo', hi: 'hˈaj', bye: 'bˈaj', yes: 'jˈes', no: 'nˈo', wow: 'wˈau', cool: 'kˈul', start: 'stˈaʁt', startup: 'stˈaʁtap', hitech: 'hˈajtek',
  software: 'sˈoftweʁ', hardware: 'hˈaʁdweʁ', cloud: 'klˈaud', server: 'sˈeʁveʁ', web: 'wˈeb', website: 'wˈebsajt', browser: 'bʁˈauzeʁ', chrome: 'kʁˈom', safari: 'safˈaʁi',
  wifi: 'wˈajfaj', bluetooth: 'blˈutus', usb: 'ju ʔes bˈi', pc: 'pi sˈi', mac: 'mˈek', macbook: 'mˈekbuk', galaxy: 'ɡˈalaksi', pixel: 'pˈiksel', pro: 'pʁˈo', max: 'mˈeks', mini: 'mˈini', plus: 'plˈas', ultra: 'ʔˈultʁa',
  model: 'mˈodel', data: 'dˈata', deep: 'dˈip', learning: 'lˈeʁnin', python: 'pˈajton', javascript: 'dʒˈavaskʁipt', github: 'ɡˈithab', code: 'kˈod', bug: 'bˈaɡ', update: 'ʔapdˈejt',
  jensen: 'dʒˈensen', huang: 'hwˈanɡ', vera: 'vˈeʁa', rubin: 'ʁˈubin', blackwell: 'blˈekwel', elon: 'ʔˈilon', musk: 'mˈask', trump: 'tʁˈamp', biden: 'bˈajden',
  london: 'lˈondon', paris: 'pˈaʁis', berlin: 'beʁlˈin', tokyo: 'tˈokjo', israel: 'ʔˈizʁael', tel: 'tˈel', aviv: 'ʔavˈiv', coffee: 'kˈofi', pizza: 'pˈitsa', burger: 'bˈuʁɡeʁ',
  team: 'tˈim', meeting: 'mˈitinɡ', manager: 'mˈenedʒeʁ', ceo: 'si ʔi ʔˈo', cto: 'si ti ʔˈo', ai: 'ʔej ʔˈaj', gpu: 'dʒi pi jˈu', cpu: 'si pi jˈu', tpu: 'ti pi jˈu', api: 'ʔej pi ʔˈaj',
  covid: 'kˈovid', vs: 'vˈeʁsus', etc: 'ʔetsˈetʁa', mr: 'mˈisteʁ', dr: 'dˈoktoʁ',
};
const LETTERS = { a: 'ʔˈej', b: 'bˈi', c: 'sˈi', d: 'dˈi', e: 'ʔˈi', f: 'ʔˈef', g: 'dʒˈi', h: 'ʔˈejtʃ', i: 'ʔˈaj', j: 'dʒˈej', k: 'kˈej', l: 'ʔˈel', m: 'ʔˈem', n: 'ʔˈen', o: 'ʔˈo', p: 'pˈi', q: 'kjˈu', r: 'ʔˈaʁ', s: 'ʔˈes', t: 'tˈi', u: 'jˈu', v: 'vˈi', w: 'dˈabelju', x: 'ʔˈeks', y: 'wˈaj', z: 'zˈed' };

function spell(w) { return [...w.toLowerCase()].filter((c) => LETTERS[c]).map((c) => LETTERS[c]).join(' '); }

// Very rough English spelling -> Hebrew-voice phonemes. Stress on the first syllable.
const RULES = [
  ['tion', 'ʃen'], ['sion', 'ʒen'], ['ture', 'tʃeʁ'], ['ough', 'of'], ['igh', 'aj'], ['sch', 'sk'], ['tch', 'tʃ'],
  ['sh', 'ʃ'], ['ch', 'tʃ'], ['th', 't'], ['ph', 'f'], ['ck', 'k'], ['qu', 'kw'], ['wh', 'w'], ['kn', 'n'], ['wr', 'ʁ'],
  ['ee', 'i'], ['ea', 'i'], ['ie', 'i'], ['oo', 'u'], ['ou', 'au'], ['ow', 'au'], ['ai', 'ej'], ['ay', 'ej'], ['ey', 'ej'],
  ['oa', 'o'], ['oi', 'oj'], ['oy', 'oj'], ['au', 'o'], ['aw', 'o'], ['ew', 'ju'], ['ng', 'nɡ'],
  [/^c(?=[eiy])/, 's'], ['c', 'k'], [/^g(?=[ei])/, 'dʒ'], ['g', 'ɡ'], ['j', 'dʒ'], ['x', 'ks'], [/^y(?=[aeiou])/, 'j'], ['y', 'i'], ['r', 'ʁ'], ['q', 'k'],
  ['a', 'a'], ['e', 'e'], ['i', 'i'], ['o', 'o'], ['u', 'u'],
];
// One left-to-right pass so a rule never rewrites another rule's output.
function rough(w) {
  let s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  if (s.length > 3) s = s.replace(/le$/, 'el').replace(/e$/, '');
  s = s.replace(/(.)\1/g, '$1');
  let out = '';
  for (let i = 0; i < s.length;) {
    const rest = s.slice(i);
    const hit = RULES.find(([p]) => (typeof p === 'string' ? rest.startsWith(p) : p.test(rest)));
    if (hit) { const [p, rep] = hit; out += rep; i += typeof p === 'string' ? p.length : rest.match(p)[0].length; }
    else { out += s[i]; i++; }
  }
  if (/^[aeiou]/.test(out)) out = 'ʔ' + out;
  const v = out.search(/[aeiou]/);
  return v < 0 ? spell(w) : out.slice(0, v) + 'ˈ' + out.slice(v);
}

export function latinToIpa(word) {
  const key = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (DICT[key]) return DICT[key];
  if (/^[A-Z]{2,5}s?$/.test(word) || (word.length <= 3 && !/[aeiouy]/i.test(word))) return spell(word.replace(/s$/, ''));
  if (word.length === 1) return LETTERS[key] ?? '';
  return rough(word);
}
