import { DEFAULT_LIMITS, PROTOCOL_ID, WORKSPACE_OPS } from './protocol.js';

const LIMIT_KEYS = [
  'grant_per_hour_per_addr',
  'grants_pending_global',
  'login_per_minute_per_addr',
  'file_bytes',
  'file_count',
  'lsp_dap_bytes',
  'log_bytes',
  'display_name_chars',
];

const LIMIT_MAX = {
  grant_per_hour_per_addr: 10,
  grants_pending_global: 30,
  login_per_minute_per_addr: 5,
  file_bytes: 1048576,
  file_count: 10000,
  lsp_dap_bytes: 2097152,
  log_bytes: 1048576,
  display_name_chars: 64,
};

const WORKSPACE_BOOLS = [
  'list',
  'read',
  'create',
  'update',
  'delete',
  'rename',
  'mkdir',
  'directories',
  'binary',
  'text_only',
  'watch',
];

const RUN_OUTCOMES = ['pass_fail', 'exit_code', 'value'];

/**
 * @param {unknown} input
 * @returns {Record<string, unknown> | null}
 */
function asObject(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return /** @type {Record<string, unknown>} */ (input);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isUint(value) {
  return Number.isInteger(value) && value >= 1;
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
export function parseCapabilities(input) {
  const rec = asObject(input);
  if (rec === null) {
    return null;
  }
  if (rec.protocol !== PROTOCOL_ID) {
    return null;
  }
  const session = parseSession(rec.session);
  const auth = parseAuth(rec.auth);
  const workspace = parseWorkspace(rec.workspace);
  const limits = parseLimits(rec.limits);
  if (session === null || auth === null || workspace === null || limits === null) {
    return null;
  }
  /** @type {Record<string, unknown>} */
  const caps = { protocol: PROTOCOL_ID, session, auth, workspace, limits };
  if (rec.language_switch !== undefined) {
    const language_switch = parsePathObject(rec.language_switch, 'languages_path');
    if (language_switch === null) {
      return null;
    }
    caps.language_switch = language_switch;
  }
  if (rec.catalog !== undefined) {
    const catalog = parsePathObject(rec.catalog, 'list_path');
    if (catalog === null) {
      return null;
    }
    caps.catalog = catalog;
  }
  if (rec.run !== undefined) {
    const run = parseRun(rec.run);
    if (run === null) {
      return null;
    }
    caps.run = run;
  }
  if (rec.debug !== undefined) {
    const debug = parseDebug(rec.debug, caps.run !== undefined);
    if (debug === null) {
      return null;
    }
    caps.debug = debug;
  }
  if (rec.admin !== undefined) {
    const admin = parsePathObject(rec.admin, 'login_path');
    if (admin === null) {
      return null;
    }
    caps.admin = admin;
  }
  const allowed = new Set([
    'protocol',
    'session',
    'auth',
    'workspace',
    'limits',
    'language_switch',
    'catalog',
    'run',
    'debug',
    'admin',
  ]);
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key)) {
      return null;
    }
  }
  return caps;
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parseSession(input) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 2) {
    return null;
  }
  if (typeof rec.channel_path !== 'string' || rec.channel_path.length < 1) {
    return null;
  }
  if (typeof rec.binary_tips !== 'boolean') {
    return null;
  }
  return { channel_path: rec.channel_path, binary_tips: rec.binary_tips };
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parseAuth(input) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 1 || !Array.isArray(rec.models)) {
    return null;
  }
  if (rec.models.length < 1) {
    return null;
  }
  const models = [];
  for (const model of rec.models) {
    const m = asObject(model);
    if (m === null || Object.keys(m).length !== 2) {
      return null;
    }
    if (typeof m.id !== 'string' || m.id.length < 1) {
      return null;
    }
    if (asObject(m.schema) === null) {
      return null;
    }
    models.push({ id: m.id, schema: m.schema });
  }
  return { models };
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parseWorkspace(input) {
  const rec = asObject(input);
  if (rec === null) {
    return null;
  }
  /** @type {Record<string, unknown>} */
  const ws = {};
  for (const key of WORKSPACE_BOOLS) {
    if (typeof rec[key] !== 'boolean') {
      return null;
    }
    ws[key] = rec[key];
  }
  if (!isUint(rec.max_files) || !isUint(rec.max_bytes)) {
    return null;
  }
  ws.max_files = rec.max_files;
  ws.max_bytes = rec.max_bytes;
  if (rec.path_policy !== undefined) {
    if (!Array.isArray(rec.path_policy)) {
      return null;
    }
    const policy = [];
    for (const row of rec.path_policy) {
      const parsed = parsePathPolicy(row);
      if (parsed === null) {
        return null;
      }
      policy.push(parsed);
    }
    ws.path_policy = policy;
  }
  const allowed = new Set([
    ...WORKSPACE_BOOLS,
    'max_files',
    'max_bytes',
    'path_policy',
  ]);
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key)) {
      return null;
    }
  }
  return ws;
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parsePathPolicy(input) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 2) {
    return null;
  }
  if (typeof rec.glob !== 'string' || rec.glob.length < 1) {
    return null;
  }
  if (!Array.isArray(rec.ops) || rec.ops.length < 1) {
    return null;
  }
  const ops = [];
  for (const op of rec.ops) {
    if (typeof op !== 'string' || !WORKSPACE_OPS.includes(op)) {
      return null;
    }
    ops.push(op);
  }
  return { glob: rec.glob, ops };
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parseLimits(input) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== LIMIT_KEYS.length) {
    return null;
  }
  /** @type {Record<string, number>} */
  const limits = {};
  for (const key of LIMIT_KEYS) {
    const max = LIMIT_MAX[key];
    if (!isUint(rec[key]) || rec[key] > max) {
      return null;
    }
    limits[key] = rec[key];
  }
  return limits;
}

/**
 * @param {unknown} input
 * @param {string} pathKey
 * @returns {object | null}
 */
function parsePathObject(input, pathKey) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 1) {
    return null;
  }
  const path = rec[pathKey];
  if (typeof path !== 'string' || path.length < 1) {
    return null;
  }
  return { [pathKey]: path };
}

/**
 * @param {unknown} input
 * @returns {object | null}
 */
function parseRun(input) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 1 || !Array.isArray(rec.outcomes)) {
    return null;
  }
  if (rec.outcomes.length < 1) {
    return null;
  }
  const outcomes = [];
  for (const outcome of rec.outcomes) {
    if (typeof outcome !== 'string' || !RUN_OUTCOMES.includes(outcome)) {
      return null;
    }
    outcomes.push(outcome);
  }
  return { outcomes };
}

/**
 * @param {unknown} input
 * @param {boolean} hasRun
 * @returns {object | null}
 */
function parseDebug(input, hasRun) {
  const rec = asObject(input);
  if (rec === null || Object.keys(rec).length !== 1) {
    return null;
  }
  if (typeof rec.requires_run !== 'boolean') {
    return null;
  }
  if (rec.requires_run && !hasRun) {
    return null;
  }
  return { requires_run: rec.requires_run };
}

/**
 * @param {string} glob
 * @param {string} path
 * @returns {boolean}
 */
export function matchPathGlob(glob, path) {
  const globParts = glob.split('/');
  const pathParts = path.split('/');
  return matchParts(globParts, pathParts);
}

/**
 * @param {string[]} globParts
 * @param {string[]} pathParts
 * @returns {boolean}
 */
function matchParts(globParts, pathParts) {
  if (globParts.length === 0) {
    return pathParts.length === 0;
  }
  const [head, ...rest] = globParts;
  if (head === '**') {
    if (rest.length === 0) {
      return true;
    }
    for (let i = 0; i <= pathParts.length; i += 1) {
      if (matchParts(rest, pathParts.slice(i))) {
        return true;
      }
    }
    return false;
  }
  if (pathParts.length === 0) {
    return false;
  }
  if (head === '*' || head === pathParts[0]) {
    return matchParts(rest, pathParts.slice(1));
  }
  return false;
}

export { DEFAULT_LIMITS };
