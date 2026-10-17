import { pickFeatured } from "./featured";
import { describe, expect, it } from "vitest";

const app = (slug: string, publishedAt: string | null) => ({
  slug,
  latest: publishedAt ? { published_at: publishedAt } : null,
});

const apps = [
  app("video-studio", "2026-10-17T11:58:20Z"),
  app("youtube-script", "2026-10-17T11:59:46Z"),
  app("motion-carousel", "2026-10-17T11:56:53Z"),
  app("draft-only", null),
];

describe("pickFeatured", () => {
  it("takes the app the home's copy names", () => {
    expect(pickFeatured(apps, "video-studio")?.slug).toBe("video-studio");
  });

  it("falls back to the app updated last when the named one is not in the catalog", () => {
    expect(pickFeatured(apps, "roteiro-heygen")?.slug).toBe("youtube-script");
    expect(pickFeatured(apps, null)?.slug).toBe("youtube-script");
  });

  it("never features an app with no released version, unless the copy names it", () => {
    expect(pickFeatured([app("draft-only", null)])).toBeNull();
    expect(pickFeatured([app("draft-only", null)], "draft-only")?.slug).toBe("draft-only");
  });

  it("has nothing to feature in an empty catalog", () => {
    expect(pickFeatured([], "youtube-script")).toBeNull();
  });
});
