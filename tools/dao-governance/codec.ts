import { validateModel, type IssueCode, type Model } from "./model";

export const STORAGE_KEY = "bc:dao-governance:workspace:v1";
export const HASH_PREFIX = "#dao=";
export const MAX_JSON_BYTES = 32_768;
export const MAX_ENCODED_LENGTH = 16_000;
export class DataError extends Error {
  code: IssueCode;
  constructor(code: IssueCode) { super(code); this.code = code; }
}

export function readJson(text: string): Model {
  if (text.length > MAX_JSON_BYTES || new TextEncoder().encode(text).length > MAX_JSON_BYTES) throw new DataError("size");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new DataError("encoding"); }
  const parsed = validateModel(value);
  if (!parsed.ok) throw new DataError(parsed.issues[0].code);
  return parsed.model;
}

export function jsonFile(model: Model): string {
  const checked = validateModel(model);
  if (!checked.ok) throw new DataError(checked.issues[0].code);
  const text = JSON.stringify(checked.model, null, 2);
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) throw new DataError("size");
  return text;
}

/** Strip every authored string, including identifiers, unless the visitor opts in. */
export function shareModel(model: Model, includeText = false): Model {
  const copy = structuredClone(model);
  if (!includeText) for (const s of [copy.baseline, copy.scenario]) {
    s.title = "";
    s.notes = "";
    const ids = new Map(s.groups.map((g, index) => [g.id, `g${index + 1}`]));
    s.groups = s.groups.map((g) => ({ ...g, id: ids.get(g.id)!, name: "", delegateTo: g.delegateTo ? ids.get(g.delegateTo)! : null }));
  }
  return copy;
}

export function encodeShare(model: Model, includeText = false): string {
  const text = JSON.stringify(readJson(JSON.stringify(shareModel(model, includeText))));
  const bytes = new TextEncoder().encode(text);
  const encoded = "v1." + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (encoded.length > MAX_ENCODED_LENGTH) throw new DataError("size");
  return encoded;
}

export function decodeShare(encoded: string): Model {
  if (encoded.length > MAX_ENCODED_LENGTH) throw new DataError("size");
  if (!/^v1\.[A-Za-z0-9_-]+$/.test(encoded)) throw new DataError("encoding");
  try {
    const raw = encoded.slice(3).replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "="));
    if (binary.length > MAX_JSON_BYTES) throw new DataError("size");
    return readJson(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch (error) {
    throw error instanceof DataError ? error : new DataError("encoding");
  }
}
