// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { guideLocaleFor, type GuideVersionRow, installedVersionOf, pickGuideVersion } from "@/lib/member/guides";

const v = (version: string, guides: GuideVersionRow["guides"], status: GuideVersionRow["status"] = "published") => ({
  id: `id-${version}`,
  version,
  status,
  guides,
});

describe("the guide a member reads: the one of the version installed", () => {
  it("reads the newest version of the app across the member's machines", () => {
    const devices = [
      {
        installed_modules: [
          { slug: "video-cut", version: "1.2.0" },
          { slug: "other", version: "9.0.0" },
        ],
      },
      { installed_modules: [{ slug: "video-cut", version: "1.10.0" }] },
      { installed_modules: "not a list" },
    ];
    expect(installedVersionOf(devices, "video-cut")).toBe("1.10.0");
    expect(installedVersionOf(devices, "absent")).toBeNull();
  });

  it("shows the installed version's guide and names the newer release", () => {
    const versions = [v("1.0.0", { "pt-BR": ["usar"] }), v("1.2.0", { "pt-BR": ["usar"] })];
    const picked = pickGuideVersion(versions, "1.0.0");
    expect(picked?.version.version).toBe("1.0.0");
    expect(picked?.installed).toBe(true);
    expect(picked?.newer).toBe("1.2.0");
  });

  it("falls back to the newest guide when the installed version has none, and says it is not the installed one", () => {
    const versions = [v("0.9.0", {}), v("1.0.0", { en: ["usar"] }), v("1.1.0", {})];
    const picked = pickGuideVersion(versions, "0.9.0");
    expect(picked?.version.version).toBe("1.0.0");
    expect(picked?.installed).toBe(false);
    expect(picked?.newer).toBe("1.1.0");
  });

  it("reads the newest released guide without an installed version, never a yanked one first", () => {
    const versions = [v("1.0.0", { "pt-BR": ["usar"] }), v("1.1.0", { "pt-BR": ["usar"] }, "yanked")];
    expect(pickGuideVersion(versions, null)?.version.version).toBe("1.0.0");
  });

  it("has nothing to show when no version carries a guide", () => {
    expect(pickGuideVersion([v("1.0.0", {})], "1.0.0")).toBeNull();
  });

  it("reads a depth in the member's language, else in Portuguese, else in English", () => {
    const both = { "pt-BR": ["usar", "abrir_o_capo"], en: ["usar"] } satisfies GuideVersionRow["guides"];
    expect(guideLocaleFor(both, "usar", "en")).toBe("en");
    expect(guideLocaleFor(both, "abrir_o_capo", "en")).toBe("pt-BR");
    expect(guideLocaleFor({ en: ["usar"] }, "usar", "pt-BR")).toBe("en");
    expect(guideLocaleFor({}, "usar", "pt-BR")).toBeNull();
  });
});
