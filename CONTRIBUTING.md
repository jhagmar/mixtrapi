# Contributing

Thank you for contributing to Mixtrapi.

## Contract

The living protocol is [docs/spec.md](docs/spec.md). JSON Schema in [schema/](schema/) MUST match that document. The JavaScript module in `src/` MUST accept every document the schemas accept and reject every document they reject for the types it parses.

RFC 2119 in the spec. Fail-closed encodings stay fail-closed unless a discussed MUST change says otherwise.

## Bootstrap

Node 22.12 or later.

```bash
npm ci
npm test
npm run conformance
npm run lint
```

CI runs those commands. Line coverage on `src/` is 100%.

## Pull requests

1. Open an issue for a spec change, then implement after discussion.
2. Typos and clearer language in docs MAY land without an issue.
3. Add a table-driven test for each new error code a parser can emit.
4. Do not hand-edit generated files if a regen script exists.
5. Fill in the pull request template.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
