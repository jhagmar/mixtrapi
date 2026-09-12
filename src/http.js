import { MixtrapiError } from './error.js';

/**
 * @typedef {object} ClientOptions
 * @property {typeof fetch} [fetch]
 * @property {string} [token]
 * @property {Record<string, string>} [headers]
 * @property {RequestCredentials} [credentials]
 */

/**
 * @param {string} baseUrl
 * @param {ClientOptions} [options]
 */
export function createClient(baseUrl, options = {}) {
  if (typeof baseUrl !== 'string' || baseUrl.length < 1) {
    throw new MixtrapiError('bad_request', 'baseUrl MUST be a non-empty string');
  }
  const root = baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new MixtrapiError('bad_request', 'fetch is unavailable');
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {Record<string, string>} [headers]
   */
  async function request(method, path, body, headers = {}) {
    const merged = { ...options.headers, ...headers };
    if (options.token !== undefined && merged.Authorization === undefined) {
      merged.Authorization = `Bearer ${options.token}`;
    }
    /** @type {RequestInit} */
    const init = { method, headers: merged, credentials: options.credentials };
    if (body !== undefined) {
      merged['Content-Type'] = 'application/json';
      init.headers = merged;
      init.body = JSON.stringify(body);
    }
    const res = await fetchImpl(`${root}${path}`, init);
    const text = await res.text();
    const json = parseJson(text);
    if (!res.ok) {
      throw MixtrapiError.fromBody(json, res.status);
    }
    return json;
  }

  return {
    /**
     * @returns {Promise<unknown>}
     */
    getCapabilities() {
      return request('GET', '/v1/capabilities');
    },
    /**
     * @param {Record<string, unknown>} [body]
     * @returns {Promise<unknown>}
     */
    mintSession(body = {}) {
      return request('POST', '/v1/sessions', body);
    },
    /**
     * @param {Record<string, unknown>} body
     * @returns {Promise<unknown>}
     */
    applyGrant(body) {
      return request('POST', '/v1/grants', body);
    },
    /**
     * @param {string} grantId
     * @param {string} waitToken
     * @returns {Promise<unknown>}
     */
    getGrant(grantId, waitToken) {
      return request('GET', `/v1/grants/${grantId}`, undefined, {
        Authorization: `Bearer ${waitToken}`,
      });
    },
    /**
     * @returns {Promise<unknown>}
     */
    getLanguages() {
      return request('GET', '/v1/languages');
    },
    /**
     * @returns {Promise<unknown>}
     */
    getCatalog() {
      return request('GET', '/v1/catalog');
    },
    /**
     * @param {string} sessionId
     * @returns {string}
     */
    sessionChannelUrl(sessionId) {
      return `${root}/v1/sessions/${sessionId}/channel`;
    },
    /**
     * @param {string} password
     * @returns {Promise<unknown>}
     */
    login(password) {
      return request('POST', '/v1/login', { password });
    },
    /**
     * @returns {Promise<unknown>}
     */
    logout() {
      return request('POST', '/v1/logout');
    },
    /**
     * @returns {Promise<unknown>}
     */
    listGrants() {
      return request('GET', '/v1/grants');
    },
    /**
     * @param {string} grantId
     * @param {number | null} ttlSeconds
     * @returns {Promise<unknown>}
     */
    approveGrant(grantId, ttlSeconds) {
      return request('POST', `/v1/grants/${grantId}/approve`, {
        ttl_seconds: ttlSeconds,
      });
    },
    /**
     * @param {string} grantId
     * @returns {Promise<unknown>}
     */
    denyGrant(grantId) {
      return request('POST', `/v1/grants/${grantId}/deny`, {});
    },
    /**
     * @returns {Promise<unknown>}
     */
    listSessions() {
      return request('GET', '/v1/sessions');
    },
    /**
     * @param {string} sessionId
     * @returns {Promise<unknown>}
     */
    revokeSession(sessionId) {
      return request('POST', `/v1/sessions/${sessionId}/revoke`, {});
    },
    /**
     * @param {string} sessionId
     * @param {number} ttlSeconds
     * @returns {Promise<unknown>}
     */
    extendSession(sessionId, ttlSeconds) {
      return request('POST', `/v1/sessions/${sessionId}/extend`, {
        ttl_seconds: ttlSeconds,
      });
    },
    /**
     * @param {string} languageId
     * @param {boolean} enabled
     * @returns {Promise<unknown>}
     */
    setLanguageEnabled(languageId, enabled) {
      return request('POST', `/v1/languages/${languageId}/enabled`, { enabled });
    },
  };
}

/**
 * @param {string} text
 * @returns {unknown}
 */
function parseJson(text) {
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'bad_request', message: 'Non-JSON response' };
  }
}
