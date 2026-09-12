import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTH_DISPLAY_NAME_GRANT,
  CHANNELS,
  PROTOCOL_ID,
  WORKSPACE_OPS,
  createClient,
  parseCapabilities,
  parseCommit,
  parseFrame,
} from '../src/index.js';
import { localIdeCapabilities } from './fixtures.js';

describe('package exports', () => {
  it('exposes protocol constants', () => {
    assert.equal(PROTOCOL_ID, 'mixtrapi/1');
    assert.equal(AUTH_DISPLAY_NAME_GRANT, 'urn:mixtrapi:auth:display-name-grant');
    assert.deepEqual([...CHANNELS], ['fs', 'lsp', 'dap', 'ctl']);
    assert.ok(WORKSPACE_OPS.includes('mkdir'));
    assert.equal(typeof createClient, 'function');
  });
});

describe('narrower branches', () => {
  it('covers remaining capability failures', () => {
    const authShape = localIdeCapabilities();
    authShape.auth = { models: { id: 'x' } };
    assert.equal(parseCapabilities(authShape), null);

    const authNull = localIdeCapabilities();
    authNull.auth.models = [null];
    assert.equal(parseCapabilities(authNull), null);

    const authKeys = localIdeCapabilities();
    authKeys.auth.models = [{ id: 'urn:x', schema: {}, extra: 1 }];
    assert.equal(parseCapabilities(authKeys), null);

    const authSchema = localIdeCapabilities();
    authSchema.auth.models = [{ id: 'urn:x', schema: [] }];
    assert.equal(parseCapabilities(authSchema), null);

    const wsArr = localIdeCapabilities();
    wsArr.workspace = [];
    assert.equal(parseCapabilities(wsArr), null);

    const max = localIdeCapabilities();
    max.workspace.max_files = 0;
    assert.equal(parseCapabilities(max), null);

    const extraWs = localIdeCapabilities();
    extraWs.workspace.nope = true;
    assert.equal(parseCapabilities(extraWs), null);

    const policyNull = localIdeCapabilities();
    policyNull.workspace.path_policy = [null];
    assert.equal(parseCapabilities(policyNull), null);

    const glob = localIdeCapabilities();
    glob.workspace.path_policy = [{ glob: '', ops: ['read'] }];
    assert.equal(parseCapabilities(glob), null);

    const ops = localIdeCapabilities();
    ops.workspace.path_policy = [{ glob: '*', ops: [] }];
    assert.equal(parseCapabilities(ops), null);

    const limits = localIdeCapabilities();
    delete limits.limits.log_bytes;
    assert.equal(parseCapabilities(limits), null);

    const sessionTips = localIdeCapabilities();
    sessionTips.session.binary_tips = 'no';
    assert.equal(parseCapabilities(sessionTips), null);

    const sessionPath = localIdeCapabilities();
    sessionPath.session.channel_path = '';
    assert.equal(parseCapabilities(sessionPath), null);

    const langExtra = localIdeCapabilities();
    langExtra.language_switch = { languages_path: '/v1/languages', extra: 1 };
    assert.equal(parseCapabilities(langExtra), null);

    const runShape = localIdeCapabilities();
    runShape.run = { outcomes: { pass_fail: true } };
    assert.equal(parseCapabilities(runShape), null);

    const debugKeys = localIdeCapabilities();
    debugKeys.debug = { requires_run: false, extra: 1 };
    assert.equal(parseCapabilities(debugKeys), null);

    const debugOk = localIdeCapabilities();
    debugOk.debug = { requires_run: false };
    assert.equal(parseCapabilities(debugOk).debug.requires_run, false);
  });

  it('parses a parent hash commit and a numeric parent frame', () => {
    const parent = 'a'.repeat(64);
    assert.ok(parseCommit({ parent, version: 2, files: { 'b.txt': 'x' } }));
    assert.equal(
      parseFrame({
        id: 9007199254740991,
        parent: 0,
        channel: 'lsp',
        kind: 'msg',
        body: { jsonrpc: '2.0' },
      }).id,
      9007199254740991,
    );
  });
});
