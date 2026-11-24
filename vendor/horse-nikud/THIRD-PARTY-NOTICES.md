# Third-party notices

The model file of this package, `model.onnx`, was trained in part on material from the third-party resources below. Each section says which files it applies to and reproduces the notice that has to travel with them.

The terms below apply to the third-party material as licensed by its owners. They do not license the Horse Nikud model or its data files as a whole, which are provided under `LICENSE`. Nothing in `LICENSE` limits the rights these terms grant in the third-party material itself.

| file | Eran Tomer verb lists (CC BY 4.0) | Tanach.us UXLC |
|---|---|---|
| `model.onnx` | yes | yes |
| `vocab.json` | no | no |
| `artifact.json` | no | no |

`vocab.json` lists characters, marks and classes only, and `artifact.json` is metadata only. Neither contains text from these resources.

## Eran Tomer: Hebrew verb lists

Applies to: `model.onnx`.

Eran Tomer, "Hebrew Verb Lists from Eran Tomer's Master thesis" (Ben-Gurion University), as hosted by NNLP-IL, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credit: Eran Tomer, CC BY 4.0.

Modified: the vocalised verb forms in `InflectedVerbsExtended.csv` and `TheVerbIndex.csv` were deduplicated, grouped into lines of 12 forms in shuffled order, and sampled; the training pipeline normalised the order of the marks. Used as a small part of the training data.

## Tanach.us: Unicode/XML Leningrad Codex

Applies to: `model.onnx`.

Unicode/XML Leningrad Codex (UXLC 2.5, build 27.6), Tanach.us Inc., West Redding, CT, USA: https://tanach.us . The licence page https://tanach.us/License.html (retrieved 2026-09-23) states:

- "All biblical Hebrew text, in any format, may be viewed or copied without restriction."
- "Citation of the Tanach.us site as the source of the text is appreciated."
- "The text presented at this site is not the Westminster Leningrad Codex (WLC); please do not represent it as such."

Tanach.us is the source of the text used here. It is not the Westminster Leningrad Codex.

Modified: cantillation and other signs the model does not predict, verse numbers and layout markup were removed; the qere reading is kept with its Nikud and the ketiv is dropped; the text was sampled, and the training pipeline normalised the order of the marks. Used as a small part of the training data.

## Runtimes

This package contains no inference runtime: `onnxruntime-web` is a separate component that you install yourself. Any JavaScript in this package is written for this package and contains no third-party code. If you distribute a runtime such as ONNX Runtime with your application, include the license notices of the components you actually distribute.
