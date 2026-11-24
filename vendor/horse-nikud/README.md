# Horse Nikud

Horse Nikud: Hebrew diacritization. Adds niqqud (vowel points) to Hebrew text written without them. Offline ONNX model with a JavaScript SDK.

Version 1.1.0 (Horse Nikud 1.1). Free for non-commercial use. Commercial use requires a license.

## Install

```sh
npm install @2008-horse/horse-nikud onnxruntime-web
```

`onnxruntime-web` is a peer dependency (>=1.19.2 <2). The package is written for browsers, module Web Workers and Node.js 18 or later; the setups that were actually tested are listed under Runtime support below. If your bundler serves the onnxruntime-web `.wasm` files from another location, set `ort.env.wasm.wasmPaths` to that URL.

## Usage

```js
import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-web';
import { create, files } from '@2008-horse/horse-nikud';

// files.model, files.vocab and files.artifact are file: URLs of the package's models/ folder.
const model = await readFile(files.model);
const vocab = JSON.parse(await readFile(files.vocab, 'utf8'));

const nikud = await create({ ort, model, vocab });
console.log(await nikud.diacritize('שלום עולם')); // שָׁלוֹם עוֹלָם
await nikud.dispose();
```

In a browser, serve the files of the package's `models/` folder yourself and fetch them instead:

```js
const model = await (await fetch('/models/model.onnx')).arrayBuffer();
const vocab = await (await fetch('/models/vocab.json')).json();
```

`diacritize` takes unpointed Hebrew text and returns the same text with niqqud (vowel points, dagesh, shin and sin dots) inserted after the Hebrew letters. Nothing else changes: Latin text, digits, punctuation and spacing stay exactly as you typed them. Write one sentence per line (`\n`). The model reads one line at a time, and a line may have at most 240 model positions: every visible character (a letter of any script, a digit, a punctuation mark, a symbol or an emoji) counts as one, and so does each run of white space; white space at the start or end of a line and invisible characters such as zero-width joiners and soft hyphens do not count.

The package refuses what it cannot handle and never truncates, splits or partly annotates it: an input with no model-visible character, a control character or lone surrogate, text that already has Hebrew points, cantillation marks or presentation forms, and a line over the limit each reject with an `InputRejected` error whose `reason` is `empty`, `invalid_input` or `too_long` (`detail` says which line and character, and `line`, `index` and `positions` give the numbers). Split longer text into sentences yourself.

```js
import { InputRejected } from '@2008-horse/horse-nikud';

try {
  await nikud.diacritize(text);
} catch (e) {
  if (!(e instanceof InputRejected)) throw e;
  console.log(e.reason, e.line, e.detail);
}
```

`artifact.json` describes the model files (their input and output contract); it is not needed to run the model. The niqqud are the model's predictions: no accuracy figure is published for this model, so check the output before you rely on it.

### Runtime support

Tested on macOS with an Apple silicon (arm64) CPU, with the model files of this package:

- Node.js 22.23.2 and 18.20.8 with `onnxruntime-web` 1.19.2 and 1.31.1 (WASM, with onnxruntime-web's default thread setting): the Node.js example above, run as written, prints `שָׁלוֹם עוֹלָם`.
- Chrome for Testing 151 (headless) with `onnxruntime-web` 1.19.2 and 1.31.1, on the main thread and in a module Web Worker, with the model files fetched as in the browser example: the same example sentence gives the same output, and the test set described below ran to the end without an error. The page was not cross-origin isolated, so WASM ran on one thread.
- `onnxruntime-node` 1.19.2 and 1.31.1 (CPU) under Node.js 22.23.2: the Node.js example with `import * as ort from 'onnxruntime-node'` and `sessionOptions: { executionProviders: ['cpu'] }` passed to `create`.

Not tested: other browsers, other Node.js versions, other onnxruntime versions, GPU providers, and multi-threaded WASM in a browser (cross-origin isolated pages).

The niqqud depend slightly on the runtime. A test set of 2,715 inputs written for this check (47 sentences, 2,000 random word sequences with punctuation, digits and Latin words, 600 random letter strings mixed with special characters, and boundary-length and refused inputs; 104,106 Hebrew letters) was run through each runtime, and the Node.js runs checked every model call: batch size 1, no padding, at most 240 model positions. The Node.js runs were made with one thread and again with the default thread settings (four WASM threads in onnxruntime-web), and gave the same output. Compared with a Python run of the same model (onnxruntime 1.19.2, CPU), `onnxruntime-node` 1.19.2 gave the identical output for every input. With the other runtimes 0.10 % to 0.15 % of the letters got a different niqqud (101 letters with `onnxruntime-web` 1.19.2, 155 and 156 letters with 1.31.1), always at letters where the model's two best choices scored close to each other (by at most 0.082 in the model's output score). Repeated runs of one runtime gave the same output, and so did the main thread and the Web Worker of the browser. The test set checks that a runtime reproduces the same output, not that the niqqud are correct.

## Files

| File | Bytes | SHA-256 |
|---|---|---|
| `model.onnx` | 5410365 | `5f230a6903bd5544fc50cc3dd14eac97b97bd70f214e23edf40594e394b3e875` |
| `vocab.json` | 5910 | `1fab6ff4670debaf9be91f0c282f646f935b84a227adbbb94a07e285b7e1361c` |
| `artifact.json` | 4972 | `8161b6a958d606f26f333f9883f07f3fcab6fef9911d6e3544e23e8b345e2251` |

## Verify

`SHA256SUMS` lists the package files and is signed with minisign (`SHA256SUMS.minisig`). The public key is at https://2008-horse.com/security/model-signing-key.txt

```sh
minisign -Vm SHA256SUMS -p model-signing-key.txt
shasum -a 256 -c SHA256SUMS
```

## License

Horse Models Community License v2.0. See `LICENSE`. The model was trained in part on third-party material that keeps its own licenses, which this license does not change; the required attributions are in `THIRD-PARTY-NOTICES.md`. Commercial licensing: https://2008-horse.com/licensing/

Official website: https://2008-horse.com
