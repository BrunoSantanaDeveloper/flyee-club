import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig keeps JSX for Next to compile ("preserve"); a test that renders a
  // component needs it compiled here.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    // next-intl's ESM build imports "next/server" without an extension, which
    // Node refuses outside a bundler; processing it through Vite resolves it.
    server: { deps: { inline: ["next-intl"] } },
  },
});
