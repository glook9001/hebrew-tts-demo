const $ = (s) => document.querySelector(s);
const text = $('#text'), counter = $('#counter'), speed = $('#speed'), speedValue = $('#speed-value');
const button = $('#speak'), status = $('#status'), player = $('#player'), audio = $('#audio'), download = $('#download'), ipaEl = $('#ipa'), voiceSel = $('#voice');
const VOICES = [[0, 'Voice 0 · low, clearest (default)'], [9, 'Voice 9 · low'], [4, 'Voice 4 · higher'], [1, 'Voice 1 · highest']];
for (const [v, l] of VOICES) voiceSel.add(new Option(l, v));
// A tiny silent WAV, played on the tap so iOS lets this <audio> element play the result later.
const SILENT = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

let worker, activeUrl, requestId = 0, preset = null;
const setStatus = (m, k = '') => { status.className = `status ${k}`.trim(); status.lastElementChild.textContent = m; };
const setBusy = (b) => { button.disabled = b; button.classList.toggle('busy', b); button.querySelector('.button-label').textContent = b ? 'Working…' : 'Speak'; };
const updateCounter = () => { counter.textContent = `${text.value.length} / 2000`; };

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
    ipaEl.textContent = data.ipa;
    setStatus(`${data.seconds.toFixed(1)} s of speech made on your device in ${data.took.toFixed(1)} s. Playing…`, 'success');
    audio.play().catch(() => setStatus(`${data.seconds.toFixed(1)} s of speech ready. Press play below.`, 'success'));
  };
  worker.onerror = (e) => { setBusy(false); setStatus(e.message || 'The speech worker stopped unexpectedly.', 'error'); };
  return worker;
}

function card(container, { title, text: t, src }) {
  const el = document.createElement('article'); el.className = 'card';
  el.innerHTML = `<p class="card-title"></p><p class="card-text" dir="rtl" lang="he"></p><audio controls preload="none" playsinline></audio>`;
  el.querySelector('.card-title').textContent = title; el.querySelector('.card-text').textContent = t;
  const a = el.querySelector('audio'); a.src = src;
  a.addEventListener('play', () => document.querySelectorAll('audio').forEach((o) => o !== a && o.pause()));
  container.append(el);
}

const ex = await (await fetch('examples.json')).json();
const chips = $('#chips');
const presets = [
  { ...ex.custom[0], label: ex.custom[0].text },
  { ...ex.custom[1], label: ex.custom[1].text },
  { ...ex.avocado, label: 'מונולוג האבוקדו (ארוך)' },
  { ...ex.custom[3], label: ex.custom[3].text },
];
presets.forEach((e, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dir = 'rtl'; b.lang = 'he';
  b.textContent = e.label.length > 30 ? e.label.slice(0, 28) + '…' : e.label; b.title = e.text;
  b.onclick = () => { text.value = e.text; preset = e; voiceSel.value = 0; updateCounter(); chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); b.classList.add('on'); };
  chips.append(b); if (i === 0) b.click();
});
text.addEventListener('input', () => { updateCounter(); if (preset && text.value !== preset.text) { preset = null; chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); } });
speed.addEventListener('input', () => { speedValue.value = `${Number(speed.value).toFixed(2)}×`; });
button.onclick = () => {
  const value = text.value.trim(); if (!value) { setStatus('Type some Hebrew first.', 'error'); return; }
  // Unlock playback inside the tap (iOS Safari only allows play() that starts from a user gesture).
  audio.src = SILENT; audio.play().catch(() => {});
  document.querySelectorAll('.card audio').forEach((o) => o.pause());
  requestId++; setBusy(true); setStatus('Preparing the model…', 'working');
  getWorker().postMessage({ id: requestId, text: value, ipaChunks: preset ? preset.chunks : null, voice: Number(voiceSel.value), speed: Number(speed.value) });
};

for (const e of ex.custom) card($('#custom'), { title: `Unseen text · voice ${e.voice}`, text: e.text, src: `audio/${e.id}.mp3` });
card($('#long'), { title: 'Monologue · voice 0 · 26 s', text: ex.avocado.text, src: 'audio/avocado_v0.mp3' });
const R4 = 'הרמת מסך מעל סבך של אינטרסים בעולם התקשורת הישראלית.', R8 = 'ובסוף יעשה את זה עורך הדין בועז בן צור, שהוא עורך הדין של נתניהו.', TA = 'היום בבוקר מזג האוויר נעים בתל אביב ובירושלים.';
card($('#compare'), { title: 'Real recording', text: R4, src: 'audio/ref4_real.mp3' });
card($('#compare'), { title: 'v3 model', text: R4, src: 'audio/ref4_v3_v0.mp3' });
card($('#compare'), { title: 'Real recording', text: R8, src: 'audio/ref8_real.mp3' });
card($('#compare'), { title: 'v3 model', text: R8, src: 'audio/ref8_v3_v0.mp3' });
card($('#compare'), { title: 'Older v2 model', text: TA, src: 'audio/telaviv_v2.mp3' });
card($('#compare'), { title: 'v3 model', text: TA, src: 'audio/telaviv_v3_release.mp3' });
card($('#more'), { title: 'News memo · 22 s', text: 'עדכון קצר על אנבידיה. בשבעה עשר בנובמבר דיווחה החברה על הכנסות שיא של מאה וחמישה עשר נקודה שמונה מיליארד דולר ברבעון השלישי…', src: 'audio/memo_nvidia_v0.mp3' });
for (const e of ex.test.filter((e) => !e.id.startsWith('memo') && [0, 9].includes(e.voice))) card($('#more'), { title: `${e.label} · voice ${e.voice}`, text: e.text, src: `audio/${e.id}.mp3` });
