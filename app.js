const $ = (s) => document.querySelector(s);
const text = $('#text'), counter = $('#counter'), speed = $('#speed'), speedValue = $('#speed-value');
const button = $('#speak'), status = $('#status'), player = $('#player'), audio = $('#audio'), download = $('#download'), ipaEl = $('#ipa'), voiceSel = $('#voice');
const VOICES = { 0: 'Voice 0 · low (Shaul)', 9: 'Voice 9 · low', 2: 'Voice 2 · medium, slower', 4: 'Voice 4 · higher', 1: 'Voice 1 · highest' };
for (const v of [0, 9, 2, 4, 1]) voiceSel.add(new Option(VOICES[v], v));
for (let v = 0; v < 16; v++) if (!(v in VOICES)) voiceSel.add(new Option(`Voice ${v}`, v));

let worker, activeUrl, requestId = 0, presetIpa = null, presetText = '';
const setStatus = (m, k = '') => { status.className = `status ${k}`.trim(); status.lastElementChild.textContent = m; };
const setBusy = (b) => { button.disabled = b; button.classList.toggle('busy', b); button.querySelector('.button-label').textContent = b ? 'Generating…' : 'Generate speech'; };
const updateCounter = () => { counter.textContent = `${text.value.length} / 400`; };

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return;
    if (data.type === 'progress') return setStatus(data.message, 'working');
    setBusy(false);
    if (data.type === 'error') return setStatus(data.message, 'error');
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = URL.createObjectURL(new Blob([data.wav], { type: 'audio/wav' }));
    audio.src = activeUrl; download.href = activeUrl; player.hidden = false;
    ipaEl.textContent = `Phonemes: ${data.ipa}`;
    setStatus(`${data.seconds.toFixed(1)} s of speech generated on your device in ${data.took.toFixed(1)} s.`, 'success');
    audio.play().catch(() => {});
  };
  worker.onerror = (e) => { setBusy(false); setStatus(e.message || 'The speech worker stopped unexpectedly.', 'error'); };
  return worker;
}

function card(container, { title, text: t, src, note, he = true }) {
  const el = document.createElement('article'); el.className = 'card';
  el.innerHTML = `<p class="card-title"></p>${t ? `<p class="card-text" ${he ? 'dir="rtl" lang="he"' : ''}></p>` : ''}<audio controls preload="metadata" playsinline></audio>${note ? '<p class="card-note"></p>' : ''}`;
  el.querySelector('.card-title').textContent = title;
  if (t) el.querySelector('.card-text').textContent = t;
  if (note) el.querySelector('.card-note').textContent = note;
  const a = el.querySelector('audio'); a.src = src; a.addEventListener('play', () => document.querySelectorAll('audio').forEach((o) => o !== a && o.pause()));
  container.append(el);
}

const ex = await (await fetch('examples.json')).json();
const chips = $('#chips');
const presets = [...ex.custom.map((e) => ({ ...e, label: 'Unseen' })), ...ex.test.filter((e) => !e.id.startsWith('memo'))];
presets.slice(0, 6).forEach((e, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dir = 'rtl'; b.lang = 'he';
  b.textContent = e.text.length > 34 ? e.text.slice(0, 32) + '…' : e.text; b.title = e.text;
  b.onclick = () => { text.value = e.text; presetIpa = e.ipa; presetText = e.text; voiceSel.value = e.voice; updateCounter(); chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); b.classList.add('on'); };
  chips.append(b); if (i === 0) b.click();
});
text.addEventListener('input', () => { updateCounter(); if (text.value !== presetText) { presetIpa = null; chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); } });
speed.addEventListener('input', () => { speedValue.value = `${Number(speed.value).toFixed(2)}×`; });
button.onclick = () => {
  const value = text.value.trim(); if (!value) { setStatus('Type some Hebrew first.', 'error'); return; }
  requestId++; setBusy(true); player.hidden = true; setStatus('Preparing the model…', 'working');
  getWorker().postMessage({ id: requestId, text: value, ipa: presetIpa, voice: Number(voiceSel.value), speed: Number(speed.value) });
};

for (const e of ex.custom) card($('#custom'), { title: `Custom text, unseen in training · voice ${e.voice}`, text: e.text, src: `audio/${e.id}.mp3` });
card($('#compare'), { title: 'Real recording (SASPEECH)', text: 'הרמת מסך מעל סבך של אינטרסים בעולם התקשורת הישראלית.', src: 'audio/ref4_real.mp3' });
card($('#compare'), { title: 'PiVo Hebrew v3 · voice 0', text: 'הרמת מסך מעל סבך של אינטרסים בעולם התקשורת הישראלית.', src: 'audio/ref4_v3_v0.mp3' });
card($('#compare'), { title: 'Real recording (SASPEECH)', text: 'ובסוף יעשה את זה עורך הדין בועז בן צור, שהוא עורך הדין של נתניהו.', src: 'audio/ref8_real.mp3' });
card($('#compare'), { title: 'PiVo Hebrew v3 · voice 0', text: 'ובסוף יעשה את זה עורך הדין בועז בן צור, שהוא עורך הדין של נתניהו.', src: 'audio/ref8_v3_v0.mp3' });
card($('#compare'), { title: 'Older v2 model', text: 'היום בבוקר מזג האוויר נעים בתל אביב ובירושלים.', src: 'audio/telaviv_v2.mp3' });
card($('#compare'), { title: 'v3 model', text: 'היום בבוקר מזג האוויר נעים בתל אביב ובירושלים.', src: 'audio/telaviv_v3_release.mp3' });
card($('#more'), { title: 'News memo · voice 0 · 22 s', text: 'עדכון קצר על אנבידיה. בשבעה עשר בנובמבר דיווחה החברה על הכנסות שיא של מאה וחמישה עשר נקודה שמונה מיליארד דולר ברבעון השלישי…', src: 'audio/memo_nvidia_v0.mp3', note: 'Facts from NVIDIA press releases of 17 and 23 Nov 2026.' });
for (const e of ex.test.filter((e) => !e.id.startsWith('memo'))) card($('#more'), { title: `${e.label} · voice ${e.voice}`, text: e.text, src: `audio/${e.id}.mp3` });
for (const v of [0, 9, 2, 4, 1]) card($('#more'), { title: `Same sentence · ${VOICES[v]}`, text: 'היום בבוקר מזג האוויר נעים בתל אביב ובירושלים.', src: `audio/telaviv_v${v}.mp3` });
