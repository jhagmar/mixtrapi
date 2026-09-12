import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MixtrapiError, parseError } from '../src/error.js';
import { AUTH_ANONYMOUS_MINT, ERROR_CODES } from '../src/protocol.js';
import { isPath } from '../src/path.js';
import {
  canonicalCommit,
  canonicalJson,
  commitHash,
  compareUtf8,
  parseCommit,
  smallerSyncPayload,
  winningHead,
} from '../src/commit.js';
import { parseFrame, parseHello } from '../src/hello.js';
import { matchPathGlob, parseCapabilities } from '../src/capabilities.js';
import { SESSION_ID, localIdeCapabilities, workshopCapabilities } from './fixtures.js';

describe('parseError', () => {
  it('accepts a valid body', () => {
    assert.deepEqual(parseError({ error: 'denied', message: 'Grant denied' }), {
      error: 'denied',
      message: 'Grant denied',
    });
  });

  it('rejects non-objects', () => {
    assert.equal(parseError(null), null);
    assert.equal(parseError('x'), null);
    assert.equal(parseError([]), null);
  });

  it('rejects wrong keys and empty strings', () => {
    assert.equal(parseError({ error: 'denied' }), null);
    assert.equal(parseError({ error: '', message: 'x' }), null);
    assert.equal(parseError({ error: 'denied', message: '' }), null);
    assert.equal(parseError({ error: 1, message: 'x' }), null);
    assert.equal(parseError({ error: 'denied', message: 1 }), null);
  });
});

describe('MixtrapiError', () => {
  it('fromBody uses parsed fields', () => {
    const err = MixtrapiError.fromBody({ error: 'full', message: 'At capacity' }, 409);
    assert.equal(err.error, 'full');
    assert.equal(err.message, 'At capacity');
    assert.equal(err.status, 409);
    assert.equal(err.name, 'MixtrapiError');
  });

  it('fromBody falls back', () => {
    const err = MixtrapiError.fromBody(null, 500);
    assert.equal(err.error, 'bad_request');
    assert.equal(err.status, 500);
  });
});

describe('ERROR_CODES', () => {
  it('lists the registered codes', () => {
    assert.ok(ERROR_CODES.includes('bad_token'));
    assert.equal(ERROR_CODES.length, 13);
  });
});

describe('isPath', () => {
  it('accepts relative POSIX paths', () => {
    assert.equal(isPath('solve.py'), true);
    assert.equal(isPath('src/main.rs'), true);
  });

  it('rejects absolute, empty, and traversal', () => {
    assert.equal(isPath(''), false);
    assert.equal(isPath('/a'), false);
    assert.equal(isPath('a/'), false);
    assert.equal(isPath('a//b'), false);
    assert.equal(isPath('.'), false);
    assert.equal(isPath('a/..'), false);
    assert.equal(isPath(1), false);
    assert.equal(isPath('e\u0301'), false);
  });
});

describe('compareUtf8', () => {
  it('orders by UTF-8 bytes', () => {
    assert.equal(compareUtf8('a', 'a'), 0);
    assert.ok(compareUtf8('a', 'b') < 0);
    assert.ok(compareUtf8('b', 'a') > 0);
    assert.ok(compareUtf8('a', 'aa') < 0);
    assert.ok(compareUtf8('aa', 'a') > 0);
  });
});

describe('canonicalJson', () => {
  it('encodes scalars and containers', () => {
    assert.equal(canonicalJson(null), 'null');
    assert.equal(canonicalJson(true), 'true');
    assert.equal(canonicalJson(false), 'false');
    assert.equal(canonicalJson(0), '0');
    assert.equal(canonicalJson('a"b\\c'), '"a\\"b\\\\c"');
    assert.equal(canonicalJson('a\nb'), '"a\\u000ab"');
    assert.equal(canonicalJson([1, 'x']), '[1,"x"]');
    assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  });

  it('rejects non-integers and other types', () => {
    assert.throws(() => canonicalJson(1.5), TypeError);
    assert.throws(() => canonicalJson(-1), TypeError);
    assert.throws(() => canonicalJson(9007199254740992), TypeError);
    assert.throws(() => canonicalJson(undefined), TypeError);
  });
});

describe('commit', () => {
  const files = { 'a.txt': 'hi' };

  it('parses and hashes', async () => {
    const commit = parseCommit({ parent: '', version: 1, files });
    assert.ok(commit);
    const hash = await commitHash(commit);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(
      canonicalCommit(commit),
      '{"files":{"a.txt":"hi"},"parent":"","version":1}',
    );
  });

  it('rejects bad commits', () => {
    assert.equal(parseCommit(null), null);
    assert.equal(parseCommit([]), null);
    assert.equal(parseCommit({ parent: '', version: 1 }), null);
    assert.equal(parseCommit({ parent: 'zz', version: 1, files }), null);
    assert.equal(parseCommit({ parent: '', version: -1, files }), null);
    assert.equal(parseCommit({ parent: '', version: 1, files: [] }), null);
    assert.equal(parseCommit({ parent: '', version: 1, files: { '/x': 'a' } }), null);
    assert.equal(parseCommit({ parent: '', version: 1, files: { 'a.txt': 1 } }), null);
  });

  it('compares heads and payload sizes', () => {
    const a = { version: 2, hash: 'aa' };
    const b = { version: 1, hash: 'zz' };
    assert.equal(winningHead(a, b), a);
    assert.equal(winningHead(b, a), a);
    const c = { version: 2, hash: 'bb' };
    assert.equal(winningHead(a, c), a);
    assert.equal(winningHead(c, a), a);
    assert.equal(smallerSyncPayload('ab', 'abcd'), 'replay');
    assert.equal(smallerSyncPayload('abcdef', 'ab'), 'tip');
    assert.equal(smallerSyncPayload('ab', 'ab'), 'replay');
  });
});

describe('hello and frame', () => {
  it('parses Hello', () => {
    assert.deepEqual(parseHello({ protocol: 'mixtrapi/1', session_id: SESSION_ID }), {
      protocol: 'mixtrapi/1',
      session_id: SESSION_ID,
    });
    assert.equal(
      parseHello({
        protocol: 'mixtrapi/1',
        session_id: SESSION_ID,
        language: 'python',
        problem_id: 'sum',
      }).language,
      'python',
    );
  });

  it('rejects bad Hello', () => {
    assert.equal(parseHello(null), null);
    assert.equal(parseHello([]), null);
    assert.equal(parseHello({ protocol: 'mixtrapi/2', session_id: SESSION_ID }), null);
    assert.equal(parseHello({ protocol: 'mixtrapi/1', session_id: 'zz' }), null);
    assert.equal(
      parseHello({ protocol: 'mixtrapi/1', session_id: SESSION_ID, language: '' }),
      null,
    );
    assert.equal(
      parseHello({ protocol: 'mixtrapi/1', session_id: SESSION_ID, problem_id: '' }),
      null,
    );
    assert.equal(
      parseHello({ protocol: 'mixtrapi/1', session_id: SESSION_ID, extra: 1 }),
      null,
    );
  });

  it('parses Frame', () => {
    const frame = parseFrame({
      id: 1,
      parent: null,
      channel: 'fs',
      kind: 'Head',
      body: { version: 0 },
    });
    assert.equal(frame.channel, 'fs');
    assert.equal(
      parseFrame({
        id: 2,
        parent: 1,
        channel: 'ctl',
        kind: 'Run',
        body: {},
      }).parent,
      1,
    );
  });

  it('rejects bad Frame', () => {
    assert.equal(parseFrame(null), null);
    assert.equal(parseFrame([]), null);
    assert.equal(parseFrame({ id: 1 }), null);
    assert.equal(
      parseFrame({ id: -1, parent: null, channel: 'fs', kind: 'Head', body: {} }),
      null,
    );
    assert.equal(
      parseFrame({ id: 1, parent: -1, channel: 'fs', kind: 'Head', body: {} }),
      null,
    );
    assert.equal(
      parseFrame({ id: 1, parent: null, channel: 'no', kind: 'Head', body: {} }),
      null,
    );
    assert.equal(
      parseFrame({ id: 1, parent: null, channel: 'fs', kind: '', body: {} }),
      null,
    );
    assert.equal(
      parseFrame({ id: 1, parent: null, channel: 'fs', kind: 'Head', body: [] }),
      null,
    );
  });
});

describe('capabilities', () => {
  it('parses both profiles', () => {
    assert.equal(
      parseCapabilities(localIdeCapabilities()).auth.models[0].id,
      AUTH_ANONYMOUS_MINT,
    );
    const workshop = parseCapabilities(workshopCapabilities());
    assert.equal(workshop.debug.requires_run, true);
    assert.equal(workshop.workspace.path_policy[0].glob, 'solve.py');
  });

  it('rejects invalid documents', () => {
    assert.equal(parseCapabilities(null), null);
    assert.equal(parseCapabilities([]), null);
    const badProto = localIdeCapabilities();
    badProto.protocol = 'other';
    assert.equal(parseCapabilities(badProto), null);
    const extra = localIdeCapabilities();
    extra.nope = 1;
    assert.equal(parseCapabilities(extra), null);
    const session = localIdeCapabilities();
    session.session = { channel_path: '/x' };
    assert.equal(parseCapabilities(session), null);
    const auth = localIdeCapabilities();
    auth.auth = { models: [] };
    assert.equal(parseCapabilities(auth), null);
    const model = localIdeCapabilities();
    model.auth.models = [{ id: '', schema: {} }];
    assert.equal(parseCapabilities(model), null);
    const ws = localIdeCapabilities();
    ws.workspace.list = 'yes';
    assert.equal(parseCapabilities(ws), null);
    const limits = localIdeCapabilities();
    limits.limits.file_bytes = 1048577;
    assert.equal(parseCapabilities(limits), null);
    const pathPolicy = localIdeCapabilities();
    pathPolicy.workspace.path_policy = 'x';
    assert.equal(parseCapabilities(pathPolicy), null);
    const pathRow = localIdeCapabilities();
    pathRow.workspace.path_policy = [{ glob: '*', ops: ['nope'] }];
    assert.equal(parseCapabilities(pathRow), null);
    const lang = localIdeCapabilities();
    lang.language_switch = {};
    assert.equal(parseCapabilities(lang), null);
    const catalog = localIdeCapabilities();
    catalog.catalog = { list_path: '' };
    assert.equal(parseCapabilities(catalog), null);
    const run = localIdeCapabilities();
    run.run = { outcomes: [] };
    assert.equal(parseCapabilities(run), null);
    const runBad = localIdeCapabilities();
    runBad.run = { outcomes: ['nope'] };
    assert.equal(parseCapabilities(runBad), null);
    const debug = localIdeCapabilities();
    debug.debug = { requires_run: true };
    assert.equal(parseCapabilities(debug), null);
    const debugType = localIdeCapabilities();
    debugType.debug = { requires_run: 'yes' };
    assert.equal(parseCapabilities(debugType), null);
    const admin = localIdeCapabilities();
    admin.admin = { login_path: 1 };
    assert.equal(parseCapabilities(admin), null);
  });

  it('matches path globs', () => {
    assert.equal(matchPathGlob('solve.py', 'solve.py'), true);
    assert.equal(matchPathGlob('*', 'a.txt'), true);
    assert.equal(matchPathGlob('*', 'a/b'), false);
    assert.equal(matchPathGlob('**', 'a/b/c'), true);
    assert.equal(matchPathGlob('src/**', 'src/a.rs'), true);
    assert.equal(matchPathGlob('src/*', 'src/a.rs'), true);
    assert.equal(matchPathGlob('src/*', 'src/a/b.rs'), false);
    assert.equal(matchPathGlob('src/**/z.rs', 'src/a.rs'), false);
    assert.equal(matchPathGlob('**/a.rs', 'x/a.rs'), true);
    assert.equal(matchPathGlob('a/b', 'a/b'), true);
  });
});
