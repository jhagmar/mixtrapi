import {
  AUTH_ANONYMOUS_MINT,
  AUTH_DISPLAY_NAME_GRANT,
  DEFAULT_LIMITS,
} from '../src/protocol.js';

export const SESSION_ID = '0123456789abcdef0123456789abcdef';

export function localIdeCapabilities() {
  return {
    protocol: 'mixtrapi/1',
    session: {
      channel_path: '/v1/sessions/{session_id}/channel',
      binary_tips: false,
    },
    auth: {
      models: [
        {
          id: AUTH_ANONYMOUS_MINT,
          schema: { type: 'object', additionalProperties: false, properties: {} },
        },
      ],
    },
    workspace: {
      list: true,
      read: true,
      create: true,
      update: true,
      delete: true,
      rename: true,
      mkdir: true,
      directories: true,
      binary: false,
      text_only: true,
      watch: true,
      max_files: 10000,
      max_bytes: 1048576,
    },
    limits: { ...DEFAULT_LIMITS },
  };
}

export function workshopCapabilities() {
  return {
    protocol: 'mixtrapi/1',
    session: {
      channel_path: '/v1/sessions/{session_id}/channel',
      binary_tips: true,
    },
    auth: {
      models: [
        {
          id: AUTH_DISPLAY_NAME_GRANT,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['display_name'],
            properties: {
              display_name: { type: 'string', minLength: 1, maxLength: 64 },
            },
          },
        },
      ],
    },
    workspace: {
      list: true,
      read: true,
      create: false,
      update: true,
      delete: false,
      rename: false,
      mkdir: false,
      directories: false,
      binary: false,
      text_only: true,
      watch: false,
      max_files: 1,
      max_bytes: 1048576,
      path_policy: [{ glob: 'solve.py', ops: ['read', 'update'] }],
    },
    limits: { ...DEFAULT_LIMITS },
    language_switch: { languages_path: '/v1/languages' },
    catalog: { list_path: '/v1/catalog' },
    run: { outcomes: ['pass_fail', 'value'] },
    debug: { requires_run: true },
    admin: { login_path: '/v1/login' },
  };
}
