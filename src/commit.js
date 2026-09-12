import { isPath } from './path.js';

const MAX_UINT = 9007199254740991;

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareUtf8(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null) {
    return 'null';
  }
  if (value === true) {
    return 'true';
  }
  if (value === false) {
    return 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > MAX_UINT) {
      throw new TypeError('canonicalJson numbers MUST be integers in 0..=2^53-1');
    }
    return String(value);
  }
  if (typeof value === 'string') {
    return stringifyString(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const rec = /** @type {Record<string, unknown>} */ (value);
    const keys = Object.keys(rec).sort(compareUtf8);
    const entries = keys.map(
      (key) => `${stringifyString(key)}:${canonicalJson(rec[key])}`,
    );
    return `{${entries.join(',')}}`;
  }
  throw new TypeError('canonicalJson cannot encode this value');
}

/**
 * @param {string} value
 * @returns {string}
 */
function stringifyString(value) {
  let out = '"';
  for (const char of value) {
    const code = /** @type {number} */ (char.codePointAt(0));
    if (code === 0x22) {
      out += '\\"';
    } else if (code === 0x5c) {
      out += '\\\\';
    } else if (code <= 0x1f) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += char;
    }
  }
  return `${out}"`;
}

/**
 * @param {unknown} input
 * @returns {{ parent: string, version: number, files: Record<string, string> } | null}
 */
export function parseCommit(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const rec = /** @type {Record<string, unknown>} */ (input);
  if (Object.keys(rec).length !== 3) {
    return null;
  }
  if (typeof rec.parent !== 'string' || !isParentHash(rec.parent)) {
    return null;
  }
  if (!Number.isInteger(rec.version) || rec.version < 0 || rec.version > MAX_UINT) {
    return null;
  }
  if (rec.files === null || typeof rec.files !== 'object' || Array.isArray(rec.files)) {
    return null;
  }
  const filesIn = /** @type {Record<string, unknown>} */ (rec.files);
  /** @type {Record<string, string>} */
  const files = {};
  for (const [path, text] of Object.entries(filesIn)) {
    if (!isPath(path) || typeof text !== 'string') {
      return null;
    }
    files[path] = text;
  }
  return { parent: rec.parent, version: rec.version, files };
}

/**
 * @param {string} parent
 * @returns {boolean}
 */
function isParentHash(parent) {
  return parent === '' || /^[0-9a-f]{64}$/.test(parent);
}

/**
 * @param {{ parent: string, version: number, files: Record<string, string> }} commit
 * @returns {string}
 */
export function canonicalCommit(commit) {
  const files = {};
  const paths = Object.keys(commit.files).sort(compareUtf8);
  for (const path of paths) {
    files[path] = commit.files[path];
  }
  return canonicalJson({ parent: commit.parent, version: commit.version, files });
}

/**
 * @param {{ parent: string, version: number, files: Record<string, string> }} commit
 * @returns {Promise<string>}
 */
export async function commitHash(commit) {
  const bytes = new TextEncoder().encode(canonicalCommit(commit));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @typedef {{ version: number, hash: string }} Head
 */

/**
 * @param {Head} left
 * @param {Head} right
 * @returns {Head}
 */
export function winningHead(left, right) {
  if (left.version > right.version) {
    return left;
  }
  if (right.version > left.version) {
    return right;
  }
  return left.hash <= right.hash ? left : right;
}

/**
 * @param {string} replayJson
 * @param {string} tipJson
 * @returns {"replay" | "tip"}
 */
export function smallerSyncPayload(replayJson, tipJson) {
  const replaySize = new TextEncoder().encode(replayJson).length;
  const tipSize = new TextEncoder().encode(tipJson).length;
  return replaySize <= tipSize ? 'replay' : 'tip';
}
