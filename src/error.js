/**
 * @typedef {object} MixtrapiErrorBody
 * @property {string} error
 * @property {string} message
 */

/**
 * @param {unknown} input
 * @returns {MixtrapiErrorBody | null}
 */
export function parseError(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const rec = /** @type {Record<string, unknown>} */ (input);
  const keys = Object.keys(rec);
  if (keys.length !== 2) {
    return null;
  }
  if (typeof rec.error !== 'string' || rec.error.length < 1) {
    return null;
  }
  if (typeof rec.message !== 'string' || rec.message.length < 1) {
    return null;
  }
  return { error: rec.error, message: rec.message };
}

export class MixtrapiError extends Error {
  /**
   * @param {string} error
   * @param {string} message
   * @param {number} [status]
   */
  constructor(error, message, status = 0) {
    super(message);
    this.name = 'MixtrapiError';
    this.error = error;
    this.status = status;
  }

  /**
   * @param {unknown} body
   * @param {number} status
   * @returns {MixtrapiError}
   */
  static fromBody(body, status) {
    const parsed = parseError(body);
    if (parsed === null) {
      return new MixtrapiError(
        'bad_request',
        'Response is not a Mixtrapi error',
        status,
      );
    }
    return new MixtrapiError(parsed.error, parsed.message, status);
  }
}
