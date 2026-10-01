---
paths: ["apps/web/**"]
---

# apps/web boundaries

- `apps/web` is the only app in this repo. Code shared between the app and tooling lives in `packages/*`.
- Do not redefine theme tokens locally (`--primary`, `--grey-*` etc.) — they come from `@flyee/design-tokens`.
- This repo is the flyee.club PLATFORM. The product (the `npx flyee` CLI, the harness core, the module contents) is a separate project: here, it only exists as the API contract (`/api/cli/*`) and the module manifest schema it consumes. Never add product logic to this repo.
