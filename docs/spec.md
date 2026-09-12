# Mixtrapi

Contract between a web editor and a language host. Protocol id: `mixtrapi/1`.

**MUST**, **SHOULD**, and **MAY** mean required, recommended, and optional (RFC 2119).

JSON Schema for the types in this document lives in [`schema/`](../schema/). A stranger MUST be able to implement a backend or an editor from this spec and those schemas.

## Principles

1. The editor discovers the backend with `GET /v1/capabilities`. An absent capability object means the feature is unsupported.
2. Compilation feedback is always offered: LSP JSON-RPC on the `lsp` channel of one session WebSocket.
3. Workspace document truth is a hash-linked commit chain on the `fs` channel. The host synthesizes LSP document-sync from that chain.
4. Auth is a list of models, each a URN plus a JSON Schema and a status machine. A later model is a new URN.
5. Run, debug, catalog, language switching, admin, and filesystem watch are optional capabilities.
6. HTTP JSON uses Unix seconds (UTC) for instants. JSON text WebSocket frames carry session messages. Binary frames MAY carry gzip tip snapshots when advertised.
7. Errors are `{ "error": string, "message": string }`. `message` is English. The editor MAY replace it from its catalogs by `error`.

## Protocol id

Hello and `Sec-WebSocket-Protocol` MUST be `mixtrapi/1`. An incompatible encoding or MUST-step requires `mixtrapi/2`.

HTTP paths in this document sit under `/v1`. A backend MAY serve the editor at `/`. The editor MAY load from another origin and use a configured API base URL; then the backend CORS-allows that origin.

Bind address, TLS, and which directory a local host serves are backend configuration.

## Identifiers

```
SessionId     = 16 random bytes, lowercase hex
GrantId       = 16 random bytes, lowercase hex
WaitToken     = 32 random bytes, unpadded base64url
AdminSession  = 32 random bytes, unpadded base64url
LanguageId    = non-empty UTF-8; backend-defined vocabulary
ProblemId     = non-empty UTF-8; catalog stem
Path          = relative POSIX path, `/`-separated, Unicode NFC
CommitHash    = 64-char lowercase hex SHA-256
DocVersion    = JSON number, integer in 0..=9007199254740991
ProtocolId    = "mixtrapi/1"
Token         = non-empty string (JWT compact serialization or opaque)
```

`Path` MUST have at least one segment. Each segment MUST be non-empty and MUST NOT be `.` or `..`. `Path` MUST NOT start with `/`.

Times in JSON are Unix seconds (UTC).

## Error

```
Error {
  error:    string
  message:  string
}
```

HTTP error responses use this body. Session and wait sockets close with a reason matching `Ending.reason` when applicable.

Registered `error` codes:

| Code                     | When                                                 |
| ------------------------ | ---------------------------------------------------- |
| `bad_token`              | Missing, malformed, expired, or revoked Bearer token |
| `denied`                 | Grant denied                                         |
| `expired`                | Grant or session TTL elapsed                         |
| `full`                   | Backend cannot accept another session                |
| `unavailable_language`   | Language missing from the available list             |
| `language_mismatch`      | Hello language differs from the live session         |
| `unknown_problem`        | `problem_id` is not in the catalog                   |
| `start_failed`           | Session workspace failed to start                    |
| `unsupported_capability` | Request needs a capability the backend omitted       |
| `unavailable_path`       | Path outside policy or unknown                       |
| `too_large`              | Body, file, or message exceeds the live limit        |
| `bad_protocol`           | Hello protocol is not `mixtrapi/1`                   |
| `bad_request`            | JSON failed validation                               |

An unknown code still carries a usable `message`.

## Capabilities

`GET /v1/capabilities` is unauthenticated. The response MUST validate against [`schema/capabilities.schema.json`](../schema/capabilities.schema.json).

```
Capabilities {
  protocol:          ProtocolId
  session:           SessionCaps
  auth:              AuthCaps
  workspace:         WorkspaceCaps
  limits:            Limits
  language_switch:   LanguageSwitchCaps | omitted
  catalog:           CatalogCaps | omitted
  run:               RunCaps | omitted
  debug:             DebugCaps | omitted
  admin:             AdminCaps | omitted
}

SessionCaps {
  channel_path:      string     // default "/v1/sessions/{session_id}/channel"
  binary_tips:       bool       // default false
}

AuthCaps {
  models:            AuthModel[]
}

AuthModel {
  id:                string     // URN
  schema:            object     // JSON Schema for the editor form / POST body
}

WorkspaceCaps {
  list:              bool
  read:              bool
  create:            bool
  update:            bool
  delete:            bool
  rename:            bool
  mkdir:             bool
  directories:       bool
  binary:            bool
  text_only:         bool
  watch:             bool
  max_files:         uint
  max_bytes:         uint
  path_policy:       PathPolicy[] | omitted   // omitted → all Paths allowed for true ops
}

PathPolicy {
  glob:              string     // `*` matches a single Path segment; `**` matches zero or more
  ops:               ("list"|"read"|"create"|"update"|"delete"|"rename"|"mkdir")[]
}

LanguageSwitchCaps {
  languages_path:    string     // default "/v1/languages"
}

CatalogCaps {
  list_path:         string     // default "/v1/catalog"
}

RunCaps {
  outcomes:          ("pass_fail"|"exit_code"|"value")[]
}

DebugCaps {
  requires_run:      bool       // default false
}

AdminCaps {
  login_path:        string     // default "/v1/login"
}

Limits {
  grant_per_hour_per_addr:   uint    // default 10
  grants_pending_global:     uint    // default 30
  login_per_minute_per_addr: uint    // default 5
  file_bytes:                uint    // default 1048576
  file_count:                uint    // default 10000
  lsp_dap_bytes:             uint    // default 2097152
  log_bytes:                 uint    // default 1048576
  display_name_chars:        uint    // default 64
}
```

Live `limits` MUST be less than or equal to those defaults. The editor uses the live document.

`workspace` operations the editor may attempt are the booleans that are true, intersected with matching `path_policy` entries. A Path that matches no policy row is unavailable when `path_policy` is present.

`debug` MAY appear only when `run` appears if `requires_run` is true.

## Auth models

The editor picks one advertised `auth.models[].id` and POSTs a body that validates against that model's `schema`.

### `urn:mixtrapi:auth:anonymous-mint`

POST `/v1/sessions` with `{}`. Response:

```
SessionToken {
  session_id:   SessionId
  token:        Token
  token_type:   "Bearer"
  expires_at:   uint | omitted
  ws_url:       string
}
```

The editor stores `token` and opens the session channel with `Authorization: Bearer <token>`. The editor MUST NOT parse token claims except JWT `exp` when the token is a JWT.

### `urn:mixtrapi:auth:display-name-grant`

Form schema: `{ "display_name": string }` after trim, length 1..=live `display_name_chars`.

POST `/v1/grants` with `{ "model": "urn:mixtrapi:auth:display-name-grant", "display_name": string }`.

Response:

```
GrantPending {
  grant_id:     GrantId
  wait_token:   WaitToken
  expires_at:   uint
  poll_url:     string
  wait_url:     string
}
```

`grant_id` is for URLs. The editor MUST NOT label it a user-facing code. Ten identical `display_name` values MUST yield ten pending grants.

GET `{poll_url}` with `Authorization: Bearer <wait_token>` returns `GrantView`. GET `{wait_url}` with the same Bearer upgrades to a WebSocket, sends one `GrantDecision`, and closes.

```
GrantView {
  grant_id:     GrantId
  display_name: string
  created_at:   uint
  expires_at:   uint
  status:       "pending" | "approved" | "denied" | "expired"
}

GrantDecision {
  status:       "approved" | "denied" | "expired"
  session:      SessionToken | omitted    // only when status is approved, and only for the wait-token principal
}
```

Approve (admin) mints `SessionId` and a token. It MUST NOT start the workspace. The first session Hello starts it. Approve MUST fail with `full` when the backend cannot accept a session.

A later auth model MUST use a URN under `urn:mixtrapi:auth:` and include `schema` plus the HTTP steps in that model's specification.

## Bearer session

HTTP and the session WebSocket use `Authorization: Bearer <token>` for the session token. The token `session_id` MUST equal the path `{session_id}` when the path includes one. Reject with `bad_token` when the token is missing, malformed, expired, or revoked.

## Session channel

Upgrade: `GET /v1/sessions/{session_id}/channel` with Bearer session token and `Sec-WebSocket-Protocol: mixtrapi/1`.

The first JSON text frame MUST be:

```
Hello {
  protocol:     ProtocolId
  session_id:   SessionId
  language:     LanguageId | omitted
  problem_id:   ProblemId | omitted
}
```

Rules:

- `protocol` MUST be `mixtrapi/1` or the server closes with `bad_protocol`.
- `session_id` MUST equal the path and the token.
- When `language_switch` is advertised and there is no live workspace, `language` MUST be present and on the available list.
- When `catalog` is advertised and there is no live workspace, `problem_id` MUST be present and exist.
- Live workspace, `language` omitted: attach as-is. `language` equal to the live language: attach. `language` different: fail with `language_mismatch` until `SwitchLanguage`.
- Reconnect MAY omit `problem_id` to keep the current problem.

Then frames:

```
Frame {
  id:       uint
  parent:   uint | null
  channel:  "fs" | "lsp" | "dap" | "ctl"
  kind:     string
  body:     object
}
```

JSON text frames MUST be accepted. When `session.binary_tips` is true, a binary WebSocket frame MAY carry a tip snapshot: one byte `0x01` followed by gzip of UTF-8 JSON of `Tip`. Multiple sockets for one `SessionId` MUST be allowed. Last-write-wins applies on `fs`.

`dap` frames MUST be rejected with `unsupported_capability` when `debug` is omitted. `Run` / `RunResult` MUST be rejected when `run` is omitted.

### `fs`

The host stores a hash-linked chain (parent hash, payload, own hash). It MUST NOT invoke `git(1)` on the keystroke path. Each commit has `version` (`DocVersion`, monotonic per session) and `CommitHash`.

LSP `textDocument/didChange` MUST be applied on every keystroke. Chain commits MUST coalesce on a 50–100ms debounce and on blur or save.

**Canonical commit JSON** is an object with exactly the keys `parent`, `version`, `files` in that order in the hash input:

- `parent`: lowercase hex `CommitHash` of the parent, or `""` for the root.
- `version`: JSON number, integer.
- `files`: object mapping `Path` to file text. Keys sorted by UTF-8 byte order.

Hash input is UTF-8 of `canonicalJson(commit)` as defined in [Canonical JSON](#canonical-json). `CommitHash` is SHA-256 of that input, lowercase hex.

On sync both sides advertise HEAD (`version`, `CommitHash`). The higher `version` wins; the loser is replaced. Equal version and equal hash: already in sync. Equal version and different hashes: the lexicographically smaller hash wins. When sending the winner, the sender MUST compare the byte size of (canonical JSON of commits after the peer cursor) with the byte size of the **tip** (full tree) and send the smaller.

```
Tip {
  version:      DocVersion
  hash:         CommitHash
  files:        { [Path]: string }
}

Replay {
  from:         CommitHash | ""
  commits:      Commit[]
}

Commit {
  parent:       string
  version:      DocVersion
  files:        { [Path]: string }
}
```

`fs` kinds:

| kind     | direction | body                                                                            |
| -------- | --------- | ------------------------------------------------------------------------------- |
| `Head`   | both      | `{ version, hash }`                                                             |
| `Commit` | both      | `Commit` (one delta; `files` is the full tree after the commit)                 |
| `Tip`    | both      | `Tip`                                                                           |
| `Replay` | both      | `Replay`                                                                        |
| `Watch`  | ←         | `Commit` when `workspace.watch` is true and the tree changed outside the editor |

`Watch` commits follow the same LWW rules.

Text files only when `workspace.text_only` is true. Binary Paths MUST be rejected then. Symlink escape is a `unavailable_path` error.

### `lsp`

`body` is one LSP JSON-RPC 2.0 message. The backend MUST rewrite `file://` URIs between `file:///workspace/...` and the host root. `rootUri` is `file:///workspace`.

The editor MUST NOT send document-sync methods that disagree with `fs`. The host MUST synthesize `didOpen` / `didChange` / `didClose` from the chain. Client-originated document-sync MUST be dropped.

The host MUST forward editor methods the language server provides, including completion, hover, definition, references, signature help, inlay hints, semantic tokens, formatting, rename, and code actions. AI/LLM assistance MUST NOT be wired. `publishDiagnostics` MUST be pushed to the editor.

One `lsp` channel per session. When `language_switch` is omitted, the host uses its single language.

### `dap`

Present only when `debug` is advertised. `body` is one DAP message. URI rewrite as for LSP. Breakpoints, continue, step in/over/out, stack traces, and variables MUST work. When `requires_run` is true, debug of a Run MUST use the instance batch from that Run.

### `ctl`

| kind             | direction | body                                                                    | Needs             |
| ---------------- | --------- | ----------------------------------------------------------------------- | ----------------- |
| `Status`         | ←         | `{ expires_at?, seconds_left?, language?, problem_id? }`                | always            |
| `Ending`         | ←         | `{ reason: "expired"\|"revoked"\|"error"\|"language_switch", message }` | always            |
| `Languages`      | ←         | `{ languages: LanguageId[] }`                                           | `language_switch` |
| `SwitchLanguage` | →         | `{ language }`                                                          | `language_switch` |
| `SwitchProblem`  | →         | `{ problem_id }`                                                        | `catalog`         |
| `Run`            | →         | `{}`                                                                    | `run`             |
| `RunResult`      | ←         | `RunResult`                                                             | `run`             |
| `Log`            | ←         | `{ json }`                                                              | `run` or `debug`  |
| `NewToken`       | ←         | `{ token, expires_at }`                                                 | admin extend      |

```
RunResult {
  status:    "completed" | "failed" | "cancelled"
  logs:      json[]
  outcome:   RunOutcome | omitted
}

RunOutcome {
  pass:        bool | omitted
  exit_code:   int | omitted
  value:       json | omitted
}
```

`outcome` fields that appear MUST be listed in `run.outcomes`.

`SwitchLanguage` MUST fail with `unavailable_language` if the target is off the available list. On success the workspace is empty; the previous language's files MUST NOT be restored.

`SwitchProblem` MUST fail with `unknown_problem` if the id is unknown. On success the tree is that problem's starter for the current language.

## Languages

When `language_switch` is advertised, `GET /v1/languages` (Bearer optional) returns `{ "languages": LanguageId[] }` — the currently available set. A language off this list MUST be rejected at Hello or `SwitchLanguage` with `unavailable_language`.

## Catalog

When `catalog` is advertised, `GET /v1/catalog` with Bearer session token returns:

```
{ "problems": [ { "id": ProblemId, "summary": string, "visualize": string | omitted } ] }
```

## Admin

When `admin` is advertised, the bundle is:

| Method | Path                               | Auth          | Purpose                                   |
| ------ | ---------------------------------- | ------------- | ----------------------------------------- |
| POST   | `/v1/login`                        | password body | set admin cookie                          |
| POST   | `/v1/logout`                       | admin cookie  | drop admin session                        |
| GET    | `/v1/grants`                       | admin         | pending and recently decided grants       |
| GET    | `/v1/events`                       | admin         | WebSocket: grant and session events       |
| POST   | `/v1/grants/{grant_id}/approve`    | admin         | mint session token                        |
| POST   | `/v1/grants/{grant_id}/deny`       | admin         | reject                                    |
| GET    | `/v1/sessions`                     | admin         | live sessions                             |
| POST   | `/v1/sessions/{session_id}/revoke` | admin         | end session, deny later Hello until `exp` |
| POST   | `/v1/sessions/{session_id}/extend` | admin         | new token, `NewToken` on `ctl`            |
| GET    | `/v1/languages`                    | admin         | all languages plus enabled flags          |
| POST   | `/v1/languages/{id}/enabled`       | admin         | `{ enabled: bool }`                       |

`POST /v1/languages/{id}/enabled` and admin `GET /v1/languages` exist only when `language_switch` is advertised.

`POST /v1/login` body `{ "password": string }`. On success set HttpOnly cookie, `SameSite=Strict`, `Path=/`, `Secure` when the request was HTTPS. Lifetime: process life or 8 hours idle, whichever ends first. Failed login MUST use the same timing budget as success and MUST count against `login_per_minute_per_addr`, then HTTP 429.

Every admin `/v1/*` except `/v1/login` MUST require a valid admin cookie.

Approve body `{ "ttl_seconds": uint | null }`. `null` uses the backend default. Extend adds `ttl_seconds` such that the new expiry stays within the backend maximum from original `iat`, or the request fails. The old session token remains valid until its own `exp`. Revoke MUST make Hello fail with `bad_token` until that `exp`.

Admin events are a WebSocket. An implementation MAY also offer SSE with the same JSON payloads.

```
AdminEvent {
  type:    "grant" | "session" | "language"
  body:    object
}
```

## Canonical JSON

Used for `CommitHash` and for comparing tip vs replay sizes.

`canonicalJson(value)` is UTF-8 text:

- `null` → `null`
- boolean → `true` or `false`
- number → shortest JSON number that round-trips the integer (commits use integers only)
- string → JSON string with code points U+0000..U+001F escaped as `\u00XX`, `"` and `\` escaped, and no other escapes
- array → `[` then values separated by `,` then `]`
- object → `{` then entries sorted by UTF-8 key bytes, each `canonicalJson(key):canonicalJson(value)`, separated by `,`, then `}`

No whitespace outside strings.

## Size ceilings

A backend MUST reject above the live `limits` in capabilities. Spec maxima are the defaults in `Limits`.

## JavaScript module

This repository's `mixtrapi` package MUST parse `Error`, `Capabilities`, `Hello`, and `Frame`, MUST compute `CommitHash`, MUST implement last-write-wins HEAD compare, and MUST offer `fetch` helpers for the HTTP-JSON routes in this document. The session WebSocket MAY be omitted from that module.
