# Mixtrapi

Mixtrapi is a protocol for a web editor talking to a language host. The editor discovers capabilities over HTTP, authenticates with a pluggable model, and opens one WebSocket that multiplexes workspace files, the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), optional run/debug, and session control.

Protocol id: `mixtrapi/1`. Spec: [docs/spec.md](docs/spec.md). JSON Schema: [schema/](schema/). JavaScript HTTP helpers and validators ship in this repository.

[![CI](https://github.com/jhagmar/mixtrapi/actions/workflows/ci.yml/badge.svg)](https://github.com/jhagmar/mixtrapi/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jhagmar/mixtrapi/graph/badge.svg)](https://codecov.io/gh/jhagmar/mixtrapi)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jhagmar/mixtrapi/badge)](https://scorecard.dev/viewer/?uri=github.com/jhagmar/mixtrapi)
[![REUSE status](https://api.reuse.software/badge/github.com/jhagmar/mixtrapi)](https://api.reuse.software/info/github.com/jhagmar/mixtrapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

## Bootstrap

Node 22.12 or later. From a clone:

```bash
npm ci
npm test
```

`npm test` runs the unit suite at 100% line coverage. `npm run conformance` checks example documents against the schemas.

## Install

```bash
npm install mixtrapi
```

```js
import { PROTOCOL_ID, createClient, parseCapabilities } from 'mixtrapi';

const client = createClient('http://127.0.0.1:8080');
const capabilities = parseCapabilities(await client.getCapabilities());
```

## What a backend advertises

A backend always offers compilation feedback (LSP on the session socket) and a workspace whose document truth is a hash-linked commit chain. Auth, catalog, language switching, run, debug, admin, and filesystem watch are capability objects. An absent object means the feature is unsupported. The editor reads `GET /v1/capabilities` and adapts.

Two example profiles live in [conformance/capabilities/](conformance/capabilities/).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. Copyright (c) 2026 Jonas Hagmar.
