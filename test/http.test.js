import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MixtrapiError } from '../src/error.js';
import { createClient } from '../src/http.js';
import { SESSION_ID } from './fixtures.js';

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function jsonResponse(body, status = 200) {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createClient', () => {
  it('rejects a missing base URL and a non-function fetch', () => {
    assert.throws(() => createClient(''), MixtrapiError);
    assert.throws(() => createClient('http://x', { fetch: 1 }), MixtrapiError);
  });

  it('uses globalThis.fetch when fetch is omitted', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    try {
      const c = createClient('http://host');
      assert.deepEqual(await c.getCapabilities(), {});
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('keeps an explicit Authorization header', async () => {
    const client = createClient('http://host', {
      token: 'tok',
      headers: { Authorization: 'Bearer other' },
      fetch: async (_url, init) => {
        assert.equal(init.headers.Authorization, 'Bearer other');
        return new Response('{}', { status: 200 });
      },
    });
    await client.getCapabilities();
  });

  it('strips trailing slashes and sends JSON', async () => {
    /** @type {string[]} */
    const urls = [];
    const client = createClient('http://127.0.0.1:8080///', {
      token: 'tok',
      fetch: async (url, init) => {
        urls.push(url);
        assert.equal(init.headers.Authorization, 'Bearer tok');
        return jsonResponse({ protocol: 'mixtrapi/1' });
      },
    });
    await client.getCapabilities();
    assert.equal(urls[0], 'http://127.0.0.1:8080/v1/capabilities');
    assert.equal(
      client.sessionChannelUrl(SESSION_ID),
      `http://127.0.0.1:8080/v1/sessions/${SESSION_ID}/channel`,
    );
  });

  it('covers visitor and admin routes', async () => {
    /** @type {{ method: string, url: string, body: unknown }} */
    let last = { method: '', url: '', body: null };
    const client = createClient('http://host', {
      credentials: 'include',
      fetch: async (url, init) => {
        last = {
          method: init.method,
          url,
          body: init.body ? JSON.parse(init.body) : null,
        };
        return jsonResponse({ ok: true });
      },
    });
    await client.mintSession();
    assert.equal(last.url, 'http://host/v1/sessions');
    await client.applyGrant({ display_name: 'room' });
    assert.equal(last.body.display_name, 'room');
    await client.getGrant('abc', 'wait');
    assert.equal(last.url, 'http://host/v1/grants/abc');
    await client.getLanguages();
    await client.getCatalog();
    await client.login('secret');
    assert.deepEqual(last.body, { password: 'secret' });
    await client.logout();
    await client.listGrants();
    await client.approveGrant('g1', 3600);
    assert.deepEqual(last.body, { ttl_seconds: 3600 });
    await client.denyGrant('g1');
    await client.listSessions();
    await client.revokeSession(SESSION_ID);
    await client.extendSession(SESSION_ID, 60);
    await client.setLanguageEnabled('python', true);
    assert.deepEqual(last.body, { enabled: true });
  });

  it('throws MixtrapiError on HTTP errors and non-JSON', async () => {
    const errClient = createClient('http://host', {
      fetch: async () =>
        new Response(JSON.stringify({ error: 'denied', message: 'No' }), {
          status: 403,
        }),
    });
    await assert.rejects(errClient.getCapabilities(), (err) => {
      assert.equal(err.error, 'denied');
      assert.equal(err.status, 403);
      return true;
    });
    const emptyClient = createClient('http://host', {
      fetch: async () => new Response('', { status: 500 }),
    });
    await assert.rejects(emptyClient.getCapabilities(), MixtrapiError);
    const junkClient = createClient('http://host', {
      fetch: async () => new Response('not-json', { status: 200 }),
    });
    const junk = await junkClient.getCapabilities();
    assert.equal(junk.error, 'bad_request');
    const okEmpty = createClient('http://host', {
      fetch: async () => new Response('', { status: 200 }),
    });
    assert.equal(await okEmpty.logout(), null);
  });
});
