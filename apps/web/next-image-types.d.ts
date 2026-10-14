// The `*.svg` and `*.png` module types that `next-env.d.ts` brings. That file is
// written by `next build`/`next dev` and gitignored, and CI typechecks before it
// builds, so the logo's SVG imports need the declaration from a tracked file.
/// <reference types="next/image-types/global" />
