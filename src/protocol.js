/** @typedef {"fs" | "lsp" | "dap" | "ctl"} Channel */

export const PROTOCOL_ID = 'mixtrapi/1';

export const AUTH_ANONYMOUS_MINT = 'urn:mixtrapi:auth:anonymous-mint';

export const AUTH_DISPLAY_NAME_GRANT = 'urn:mixtrapi:auth:display-name-grant';

export const CHANNELS = /** @type {const} */ (['fs', 'lsp', 'dap', 'ctl']);

export const ERROR_CODES = /** @type {const} */ ([
  'bad_token',
  'denied',
  'expired',
  'full',
  'unavailable_language',
  'language_mismatch',
  'unknown_problem',
  'start_failed',
  'unsupported_capability',
  'unavailable_path',
  'too_large',
  'bad_protocol',
  'bad_request',
]);

export const DEFAULT_LIMITS = Object.freeze({
  grant_per_hour_per_addr: 10,
  grants_pending_global: 30,
  login_per_minute_per_addr: 5,
  file_bytes: 1048576,
  file_count: 10000,
  lsp_dap_bytes: 2097152,
  log_bytes: 1048576,
  display_name_chars: 64,
});

export const WORKSPACE_OPS = /** @type {const} */ ([
  'list',
  'read',
  'create',
  'update',
  'delete',
  'rename',
  'mkdir',
]);
