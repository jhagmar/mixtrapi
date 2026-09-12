import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  parseCapabilities,
  parseCommit,
  parseFrame,
  parseHello,
} from '../src/index.js';
import { localIdeCapabilities, workshopCapabilities, SESSION_ID } from './fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} name
 */
async function loadSchema(name) {
  const text = await readFile(join(root, 'schema', name), 'utf8');
  return JSON.parse(text);
}

describe('conformance schemas', () => {
  it('accepts example capability documents', async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const schema = await loadSchema('capabilities.schema.json');
    const validate = ajv.compile(schema);
    for (const doc of [localIdeCapabilities(), workshopCapabilities()]) {
      assert.equal(validate(doc), true, JSON.stringify(validate.errors));
      assert.ok(parseCapabilities(doc));
    }
    const localPath = join(root, 'conformance', 'capabilities', 'local-ide.json');
    const workshopPath = join(root, 'conformance', 'capabilities', 'workshop.json');
    const localFile = JSON.parse(await readFile(localPath, 'utf8'));
    const workshopFile = JSON.parse(await readFile(workshopPath, 'utf8'));
    assert.equal(validate(localFile), true, JSON.stringify(validate.errors));
    assert.equal(validate(workshopFile), true, JSON.stringify(validate.errors));
  });

  it('accepts hello, frame, commit, and error examples', async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const helloSchema = ajv.compile(await loadSchema('hello.schema.json'));
    const frameSchema = ajv.compile(await loadSchema('frame.schema.json'));
    const commitSchema = ajv.compile(await loadSchema('commit.schema.json'));
    const errorSchema = ajv.compile(await loadSchema('error.schema.json'));
    const hello = { protocol: 'mixtrapi/1', session_id: SESSION_ID };
    const frame = {
      id: 0,
      parent: null,
      channel: 'ctl',
      kind: 'Status',
      body: {},
    };
    const commit = { parent: '', version: 0, files: { 'a.txt': '' } };
    const error = { error: 'expired', message: 'Grant expired' };
    assert.equal(helloSchema(hello), true);
    assert.equal(frameSchema(frame), true);
    assert.equal(commitSchema(commit), true);
    assert.equal(errorSchema(error), true);
    assert.ok(parseHello(hello));
    assert.ok(parseFrame(frame));
    assert.ok(parseCommit(commit));
  });
});
