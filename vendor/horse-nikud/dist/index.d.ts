/** The most model positions one line may have (positions are the model's view of a line: letters, digits, punctuation, one space per run of white space). */
export const MAX_POSITIONS: 240;

/** URLs of the model files inside this package (serve them yourself in a browser; read them from disk in Node.js). */
export const files: {
  /** The ONNX model (int8). */
  readonly model: URL;
  /** The vocabulary (vocab.json). */
  readonly vocab: URL;
  /** The identity record of the model files (artifact.json); not needed to run the model. */
  readonly artifact: URL;
};

/** Why `diacritize` refused its input: no model-visible character, a character it does not take, or a line over the limit. */
export type InputRejectedReason = 'empty' | 'invalid_input' | 'too_long';

/** Thrown when the input is refused. Nothing is truncated, split or partly annotated: the whole call fails. */
export class InputRejected extends Error {
  readonly name: 'InputRejected';
  readonly reason: InputRejectedReason;
  /** A human-readable explanation (line, index, character). */
  readonly detail: string;
  /** 1-based number of the offending line (`invalid_input`, `too_long`). */
  readonly line?: number;
  /** UTF-16 index in that line (`invalid_input`). */
  readonly index?: number;
  /** Code point of the refused character (`invalid_input`). */
  readonly codePoint?: number;
  /** Model positions of the offending line (`too_long`). */
  readonly positions?: number;
  /** The limit, MAX_POSITIONS (`too_long`). */
  readonly limit?: number;
}

/** Thrown when the model, the vocabulary or the runtime does not follow the contract this package was built for. */
export class ContractMismatch extends Error {
  readonly name: 'ContractMismatch';
}

export interface NikudOptions {
  /** The onnxruntime-web module (`import * as ort from 'onnxruntime-web'`). */
  ort: any;
  /** The bytes of models/model.onnx. */
  model: ArrayBuffer | Uint8Array;
  /** The parsed models/vocab.json. */
  vocab: any;
  /** Merged over the defaults `{ executionProviders: ['wasm'], graphOptimizationLevel: 'all' }`. */
  sessionOptions?: Record<string, unknown>;
}

export interface Nikud {
  /**
   * Inserts niqqud (vowel points, dagesh, shin and sin dots) after the letters of unpointed Hebrew text and returns the
   * text with nothing else changed. One sentence per line (`\n`), at most MAX_POSITIONS model positions per line.
   * Text that already contains Hebrew points, cantillation marks or presentation forms is refused, not modified.
   * Rejects with InputRejected when the input is refused. Calls may overlap; they run one after another.
   */
  diacritize(text: string): Promise<string>;
  /** Releases the model session. Calls made before it finish first; later calls are refused. Safe to call more than once. */
  dispose(): Promise<void>;
}

/** Creates a ready-to-use instance. Refuses (ContractMismatch) any model or vocabulary other than the ones this package ships. */
export function create(options: NikudOptions): Promise<Nikud>;
