# PiVo Hebrew v3: Hebrew text-to-speech in the browser

Live demo: https://glook9001.github.io/hebrew-tts-demo/

An experimental 7.3M-parameter Hebrew TTS model (**PiVo-TPU-7M Hebrew v3**: 6,511,317 acoustic + 816,597 FARGAN vocoder parameters), trained on a Kaggle TPU v5e-8 with about 11.5 h of SASPEECH Hebrew speech, following the [PiVo-1.4M](https://huggingface.co/empero-ai/PiVo-1.4M) recipe by Empero Research.

The page runs the four ONNX graphs (29.5 MB, float32) live in a Web Worker with ONNX Runtime Web. No server is involved. It also has pre-rendered MP3 samples, including sentences written for the demo that do not appear in the training transcripts.

## How text becomes speech
1. **Cleaning and reading out.** `frontend/text.js` normalizes the text (quotes, dashes, parentheses, ellipses, invisible marks) and reads out numbers (cardinals up to the billions with gender agreement, decimals, percentages, ₪/$/€ amounts, dates like 15.3.2025, times like 14:30, prefixed forms like ב-12%), common abbreviations (ד"ר, ש"ח, צה"ל, ארה"ב, …) and Latin-script words (a small brand and tech dictionary, spelled-out acronyms, and a rough spelling-to-sound fallback). Numbers are in `frontend/numbers.js`, Latin words in `frontend/english.js`.
2. **Pronunciation.** Every Hebrew word, with its whole sentence as context, goes through [ReNikud](https://github.com/thewh1teagle/renikud) (`model/g2p/renikud.onnx`, 20.6 MB, int8), a Hebrew grapheme-to-phoneme model that predicts consonant, vowel and stress for each letter. It uses the same phoneme set as the Phonikud IPA the acoustic model was trained on. On the 250-sentence [heb-g2p-benchmark](https://github.com/thewh1teagle/heb-g2p-benchmark) this front-end gets 12.2% word error and 5.2% stress error. The old one (Horse Nikud plus rules plus an 8,300-word list) got 38.8% and 24.0%. Vowel points the user types (full or partial niqqud, shin/sin dots, dagesh, a stress accent) limit the model's choices for those letters instead of being thrown away.
3. **Phrasing.** Text is split into phrases at punctuation: sentence ends, commas, list items, colons, dashes, parentheses and ellipses. Phrases longer than about 10 words are also split at clause starts such as אבל, כי, כש-, ו- and ש-. Each phrase is synthesized on its own, its edge silence is trimmed, and a pause sized for the boundary is added: 0.15 s between list items, 0.24 s at a comma, 0.3 s at a colon or dash, 0.5 s at an ellipsis, 0.55–0.6 s between sentences and 0.9 s between paragraphs. The model has no pace control, so there is no speed slider, and the speaking rate inside each phrase is the model's own.
4. **Questions.** Yes/no questions (not those starting with מה, איך, למה, …) get a rise of about 3.5 semitones over the last 0.3 s, made by editing the FARGAN pitch feature before the vocoder.
5. **Synthesis.** The encoder predicts phone durations, the causal decoder predicts 20 FARGAN features per 10 ms, and the FARGAN vocoder produces 16 kHz audio, upsampled to 48 kHz WAV for playback.

## Files
- `index.html`, `app.js`, `worker.js`, `style.css`: the demo. `frontend/`: the text front-end. `model/g2p/`: the ReNikud model (`renikud.json` holds the vocabularies from the ONNX metadata).
- `model/onnx/`: the v3 model; `model/LICENSE`, `NOTICE`, `THIRD_PARTY.md`, `LICENSES/`: upstream PiVo notices.
- `audio/`: pre-rendered MP3s (44.1 kHz mono). `ref4_real.mp3` and `ref8_real.mp3` are two short SASPEECH reference clips.
- `vendor/ort/`: ONNX Runtime Web 1.23.2 (MIT).

## Credits and licenses
- PiVo architecture, reference runtime and recipe: Empero Research, Apache-2.0. FARGAN-derived vocoder: Xiph/Opus BSD license. See `model/`.
- Page design inspired by [ldenoue/PiVo-1.4M-web](https://github.com/ldenoue/PiVo-1.4M-web); the code here is written separately.
- Pronunciation: [ReNikud](https://huggingface.co/renikud/renikud) by Maxim Melichov, Yakov Kolani and Morris Alper (IEEE SLT 2026, [arXiv 2606.20179](https://arxiv.org/abs/2606.20179)), CC BY 4.0. `model/g2p/renikud.onnx` is unmodified (SHA-256 8b881a3a…7f3dbbca). `frontend/renikud.js` follows its reference `renikud-onnx` decoder.
- The acoustic model's phoneme conventions come from [Phonikud](https://github.com/thewh1teagle/phonikud) (CC BY 4.0), which phonemized the training data.
- No non-commercial components remain. The earlier version used Horse Nikud, which is licensed for non-commercial use only; it has been removed.
- Reference recordings: [SASPEECH](https://huggingface.co/datasets/upai-inc/saspeech).
- ONNX Runtime Web: Microsoft, MIT.

This is a research demo. Some speech sounds muffled or buzzy, and pitch is fairly flat. The front-end cannot fix the acoustic model's voice quality or its even pacing inside a phrase. About 1 word in 8 can still be mispronounced, especially names, slang and rare loanwords.
