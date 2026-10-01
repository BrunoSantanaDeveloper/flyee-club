# @flyee/catalog

The `flyee.module.json` manifest schema and the catalog's version rules: the pieces the platform's upload pipeline and CLI delivery API share, and that the CLI reads as JSON Schema at `/api/cli/schema/module`. The contract itself is [`docs/CLI-CONTRACT.md`](../../docs/CLI-CONTRACT.md).

| Import | What it is |
|---|---|
| `@flyee/catalog/manifest` | `moduleManifestSchema` (zod), `parseManifest(bytes)`, `manifestJsonSchema()`, `isSafePackagePath`, the enums (`MODULE_TYPES`, `AI_TOOLS`, `PERMISSION_KINDS`) |
| `@flyee/catalog/semver` | `isSemver`, `compareSemver`, `latestVersion`, `minimumOfRange`: the same rules as `semver_ok` and `semver_sort_key` in the database |

Pure and dependency-light (zod only), so it runs in the app, in scripts and in tests. The ZIP reader that uses it lives in the app (`apps/web/src/lib/catalog/package.ts`).

`npm run test:catalog` runs `src/catalog.test.ts` with Node's test runner.
