# PiVo Hebrew v3: Hebrew text-to-speech in the browser

Live demo: https://glook9001.github.io/hebrew-tts-demo/

An experimental 7.3M-parameter Hebrew TTS model (**PiVo-TPU-7M Hebrew v3**: 6,511,317 acoustic + 816,597 FARGAN vocoder parameters), trained on a Kaggle TPU v5e-8 with about 11.5 h of SASPEECH Hebrew speech, following the [PiVo-1.4M](https://huggingface.co/empero-ai/PiVo-1.4M) recipe by Empero Research.

The page runs the four ONNX graphs (29.5 MB, float32) live in a Web Worker with ONNX Runtime Web. No server is involved. It also has pre-rendered MP3 samples, including sentences written for the demo that do not appear in the training transcripts.

## How text becomes speech
1. Example sentences come with IPA made by [Phonikud](https://github.com/thewh1teagle/phonikud) (Python) when the demo was built.
2. Typed text gets vowel marks from Horse Nikud, then `g2p.js`, a JavaScript port of Phonikud's rule-based phonemizer (matches the Python output on 40/40 test sentences given the same vowel marks), turns it into IPA. Stress and vocal shva on typed text are approximate.
3. The encoder predicts phone durations; the causal decoder predicts 20 FARGAN features per 10 ms; the FARGAN vocoder produces 16 kHz audio, upsampled to 48 kHz for playback.

## Files
- `index.html`, `app.js`, `worker.js`, `g2p.js`, `style.css`: the demo.
- `model/onnx/`: the v3 model; `model/LICENSE`, `NOTICE`, `THIRD_PARTY.md`, `LICENSES/`: upstream PiVo notices.
- `audio/`: pre-rendered MP3s (44.1 kHz mono). `ref4_real.mp3` and `ref8_real.mp3` are two short SASPEECH reference clips.
- `vendor/ort/`: ONNX Runtime Web 1.23.2 (MIT). `vendor/horse-nikud/`: Horse Nikud 1.1.0, unmodified, under its own license.

## Credits and licenses
- PiVo architecture, reference runtime and recipe: Empero Research, Apache-2.0. FARGAN-derived vocoder: Xiph/Opus BSD license. See `model/`.
- Page design inspired by [ldenoue/PiVo-1.4M-web](https://github.com/ldenoue/PiVo-1.4M-web); the code here is written separately.
- Phonikud by thewh1teagle et al., CC BY 4.0; `g2p.js` is an adaptation of its phonemizer rules.
- Hebrew vowel marks for typed text: Powered by Horse Models (https://2008-horse.com/licensing/). Non-commercial use only; see `vendor/horse-nikud/LICENSE`.
- Reference recordings: [SASPEECH](https://huggingface.co/datasets/upai-inc/saspeech).
- ONNX Runtime Web: Microsoft, MIT.

This is a research demo. Some speech sounds muffled or buzzy, pitch is fairly flat, and pauses at commas are short.
