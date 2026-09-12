import { CHANNELS, PROTOCOL_ID } from './protocol.js';

const MAX_UINT = 9007199254740991;

/**
 * @typedef {object} Hello
 * @property {typeof PROTOCOL_ID} protocol
 * @property {string} session_id
 * @property {string} [language]
 * @property {string} [problem_id]
 */

/**
 * @param {unknown} input
 * @returns {Hello | null}
 */
export function parseHello(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const rec = /** @type {Record<string, unknown>} */ (input);
  if (rec.protocol !== PROTOCOL_ID) {
    return null;
  }
  if (typeof rec.session_id !== 'string' || !/^[0-9a-f]{32}$/.test(rec.session_id)) {
    return null;
  }
  /** @type {Hello} */
  const hello = { protocol: PROTOCOL_ID, session_id: rec.session_id };
  if (rec.language !== undefined) {
    if (typeof rec.language !== 'string' || rec.language.length < 1) {
      return null;
    }
    hello.language = rec.language;
  }
  if (rec.problem_id !== undefined) {
    if (typeof rec.problem_id !== 'string' || rec.problem_id.length < 1) {
      return null;
    }
    hello.problem_id = rec.problem_id;
  }
  const allowed = new Set(['protocol', 'session_id', 'language', 'problem_id']);
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key)) {
      return null;
    }
  }
  return hello;
}

/**
 * @typedef {object} Frame
 * @property {number} id
 * @property {number | null} parent
 * @property {"fs" | "lsp" | "dap" | "ctl"} channel
 * @property {string} kind
 * @property {Record<string, unknown>} body
 */

/**
 * @param {unknown} input
 * @returns {Frame | null}
 */
export function parseFrame(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const rec = /** @type {Record<string, unknown>} */ (input);
  if (Object.keys(rec).length !== 5) {
    return null;
  }
  if (!Number.isInteger(rec.id) || rec.id < 0 || rec.id > MAX_UINT) {
    return null;
  }
  if (
    rec.parent !== null &&
    (!Number.isInteger(rec.parent) || rec.parent < 0 || rec.parent > MAX_UINT)
  ) {
    return null;
  }
  if (typeof rec.channel !== 'string' || !CHANNELS.includes(rec.channel)) {
    return null;
  }
  if (typeof rec.kind !== 'string' || rec.kind.length < 1) {
    return null;
  }
  if (rec.body === null || typeof rec.body !== 'object' || Array.isArray(rec.body)) {
    return null;
  }
  return {
    id: rec.id,
    parent: rec.parent,
    channel: rec.channel,
    kind: rec.kind,
    body: /** @type {Record<string, unknown>} */ (rec.body),
  };
}
