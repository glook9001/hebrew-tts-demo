// Runs PiVo-TPU-7M Hebrew v3 (4 ONNX graphs) with ONNX Runtime Web in a Web Worker.
// Pipeline follows the PiVo reference runtime (Empero Research, Apache-2.0) and
// the v3 export script; structure inspired by ldenoue/PiVo-1.4M-web.
import * as ort from './vendor/ort/ort.wasm.min.mjs';
import { phonemize } from './g2p.js';

const BASE = new URL('./', import.meta.url).href;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = BASE + 'vendor/ort/';

let meta, S2I, sessionsP, nikudP;
const SPECIAL = 10, MULTI = ['tʃ', 'dʒ', 'ts'];
const STATE_NAMES = ['memory', 'gru1', 'gru2', 'gru3', 'frame_state'];
const STATE_W = [256, 160, 128, 128, 164];
const T = (type, data, dims) => new ort.Tensor(type, data, dims);
const I64 = (v, dims) => T('int64', BigInt64Array.from(v, BigInt), dims);

async function fetchBuf(url, label, progress) {
  const r = await fetch(url); if (!r.ok) throw new Error(`Could not load ${label} (${r.status}).`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader(); const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    parts.push(value); got += value.length;
    progress(total && got <= total ? `Downloading ${label}… ${Math.round(got / total * 100)}%` : `Downloading ${label}… ${(got / 1e6).toFixed(1)} MB`);
  }
  const buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}

function loadModel(progress) {
  if (!sessionsP) sessionsP = (async () => {
    meta = await (await fetch(BASE + 'model/onnx/metadata.json')).json();
    S2I = Object.fromEntries(meta.symbols.map((s, i) => [s, i]));
    const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    const s = {};
    for (const [i, name] of ['encoder', 'decoder', 'conditioning', 'vocoder_step'].entries()) {
      const bytes = await fetchBuf(`${BASE}model/onnx/${name}.onnx`, `model part ${i + 1} of 4`, progress);
      progress(`Starting model part ${i + 1} of 4…`);
      s[name] = await ort.InferenceSession.create(bytes, opts);
    }
    return s;
  })().catch((e) => { sessionsP = null; throw e; });
  return sessionsP;
}

function loadNikud(progress) {
  if (!nikudP) nikudP = (async () => {
    const { create } = await import('./vendor/horse-nikud/dist/index.js');
    const model = await fetchBuf(BASE + 'vendor/horse-nikud/models/model.onnx', 'the Hebrew vowel model', progress);
    const vocab = await (await fetch(BASE + 'vendor/horse-nikud/models/vocab.json')).json();
    return create({ ort, model, vocab });
  })().catch((e) => { nikudP = null; throw e; });
  return nikudP;
}

function tokens(ipa) {
  const t = ['<bos>']; let i = 0;
  while (i < ipa.length) {
    let ch = ipa[i];
    if (/\s/.test(ch)) { if (t.at(-1) !== '<bos>' && t.at(-1) !== '<space>') t.push('<space>'); i++; continue; }
    if ('.,?!;:'.includes(ch)) { t.push(ch); i++; continue; }
    const m = MULTI.find((mc) => ipa.startsWith(mc, i)); if (m) { t.push(m); i += m.length; continue; }
    if (ch === 'g') ch = 'ɡ';
    if (ch in S2I) t.push(ch);
    i++;
  }
  if (t.at(-1) === '<space>') t.pop();
  t.push('<eos>'); return t;
}

// 16 kHz -> 48 kHz (zero-stuff x3 + windowed-sinc low-pass) for wide playback support.
function upsample3(x) {
  const L = 3, taps = 48, h = new Float32Array(2 * taps + 1);
  for (let n = -taps; n <= taps; n++) { const t = n / L; const sinc = n === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t); const w = 0.42 + 0.5 * Math.cos(Math.PI * n / taps) + 0.08 * Math.cos(2 * Math.PI * n / taps); h[n + taps] = sinc * w; }
  const y = new Float32Array(x.length * L);
  for (let m = 0; m < y.length; m++) { let acc = 0; const k0 = Math.ceil((m - taps) / L), k1 = Math.floor((m + taps) / L); for (let k = Math.max(0, k0); k <= Math.min(x.length - 1, k1); k++) acc += x[k] * h[m - k * L + taps]; y[m] = acc; }
  return y;
}
function wav(samples, rate) {
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, b.byteLength - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return b;
}

async function synth({ text, ipa, voice, speed }, progress) {
  const t0 = performance.now();
  let nikud = null;
  if (!ipa) {
    if (!/[\u05d0-\u05ea]/.test(text)) throw new Error('Type some Hebrew text.');
    const nk = await loadNikud(progress); progress('Adding vowel marks…');
    const lines = text.split(/(?<=[.!?])\s+|\n+/).map((l) => l.trim()).filter(Boolean);
    const out = []; for (const l of lines) out.push(/[\u05b0-\u05c7]/.test(l) ? l : await nk.diacritize(l));
    nikud = out.join(' '); ipa = phonemize(nikud, { predictVocalShva: true });
  }
  const s = await loadModel(progress);
  const tk = tokens(ipa); const ids = tk.map((x) => S2I[x]);
  if (ids.length > 600) throw new Error('Text too long; try one or two sentences.');
  progress('Predicting timing…');
  const enc = await s.encoder.run({ tokens: I64(ids, [1, ids.length]), voice: I64([voice], [1]), lengths: I64([ids.length], [1]) });
  const [E, LD] = s.encoder.outputNames.map((n) => enc[n]);
  const W = E.dims.at(-1), maxF = meta.config.max_token_frames;
  const durs = Array.from(LD.data, (v, i) => { let d = Math.round(Math.expm1(Math.max(0, Math.min(Math.log1p(maxF), v))) / speed); d = Math.max(0, Math.min(maxF, d)); if (ids[i] >= SPECIAL) d = Math.max(1, d); if (ids[i] <= 2) d = 0; return d; });
  const F = durs.reduce((a, b) => a + b, 0); if (F > 3000) throw new Error('Speech would exceed 30 s; shorten the text.');
  const XW = W + 4, X = new Float32Array(F * XW); let f = 0;
  for (let i = 0; i < durs.length; i++) for (let r = 0; r < durs[i]; r++, f++) {
    X.set(E.data.subarray(i * W, (i + 1) * W), f * XW); const fr = (r + 0.5) / durs[i];
    X.set([2 * fr - 1, Math.sin(Math.PI * fr), Math.cos(Math.PI * fr), Math.log1p(durs[i]) / Math.log1p(maxF)], f * XW + W);
  }
  const kvH = meta.config.kv_heads, hd = meta.config.head_dim;
  let cache = Object.fromEntries(meta.cache_names.map((n) => [n, T('float32', new Float32Array(0), [1, kvH, 0, hd])]));
  let st = Object.fromEntries(STATE_NAMES.map((n, i) => [n, T('float32', new Float32Array(STATE_W[i]), [1, STATE_W[i]])]));
  const feats = []; const pcm = new Float32Array(F * 160); let o = 0, de = 0;
  for (let p = 0; p < F; p += 16) {
    const c = Math.min(16, F - p);
    const r = await s.decoder.run({ expanded: T('float32', X.slice(p * XW, (p + c) * XW), [1, c, XW]), position: I64([p], []), ...cache });
    const outs = s.decoder.outputNames.map((n) => r[n]);
    cache = Object.fromEntries(meta.cache_names.map((n, i) => [n, outs[i + 1]]));
    for (let i = 0; i < c; i++) feats.push(outs[0].data.slice(i * 20, i * 20 + 20));
  }
  for (let t = 0; t < F; t++) {
    if (t % 25 === 0) progress(`Generating audio… ${Math.round(t / F * 100)}%`);
    const prev = feats[Math.max(0, t - 1)], cur = feats[t], next = feats[Math.min(F - 1, t + 1)];
    const ctx = new Float32Array(60); ctx.set(prev); ctx.set(cur, 20); ctx.set(next, 40);
    const per = [prev, cur, next].map((x) => Math.max(32, Math.min(255, Math.round(256 / 2 ** (Math.max(-10, Math.min(10, x[18])) + 1.5)))));
    const cr = await s.conditioning.run({ features: T('float32', ctx, [1, 3, 20]), periods: I64(per, [1, 3]) });
    const cond = cr[s.conditioning.outputNames[0]].data;
    for (let k = 0; k < 4; k++) {
      const g = await s.vocoder_step.run({ conditioning: T('float32', cond.slice(k * 80, k * 80 + 80), [1, 80]), period: I64([per[1]], [1]), ...st });
      const go = s.vocoder_step.outputNames.map((n) => g[n]);
      st = Object.fromEntries(STATE_NAMES.map((n, i) => [n, go[i + 1]]));
      for (const x of go[0].data) { de = x + 0.85 * de; pcm[o++] = de; }
    }
  }
  const audio = pcm.subarray(0, o); let peak = 0; for (const x of audio) peak = Math.max(peak, Math.abs(x));
  if (peak > 0.95) for (let i = 0; i < audio.length; i++) audio[i] *= 0.9 / peak;
  const secs = o / 16000, took = (performance.now() - t0) / 1000;
  return { wav: wav(upsample3(audio), 48000), seconds: secs, took, ipa, nikud };
}

self.onmessage = async ({ data }) => {
  const progress = (m) => self.postMessage({ type: 'progress', id: data.id, message: m });
  try { const r = await synth(data, progress); self.postMessage({ type: 'result', id: data.id, ...r }, [r.wav]); }
  catch (e) { console.error(e); self.postMessage({ type: 'error', id: data.id, message: e?.message || String(e) }); }
};
