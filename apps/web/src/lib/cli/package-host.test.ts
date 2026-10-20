// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isPackagePath, packageHostOf, platformPackageUrl, servesPackages } from "@/lib/cli/package-host";

const STORAGE = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/modules";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtb2R1bGVzL3gifQ.c2lnbmF0dXJl";

describe("where a package leaves from", () => {
  it("reads the setting, and anything unknown as the storage", () => {
    expect(packageHostOf("platform")).toBe("platform");
    expect(packageHostOf("preview")).toBe("preview");
    expect(packageHostOf("storage")).toBe("storage");
    expect(packageHostOf(undefined)).toBe("storage");
    expect(packageHostOf("cdn")).toBe("storage");
  });

  it("serves from the platform everywhere, or only outside production for the acceptance", () => {
    expect(servesPackages("platform", "production")).toBe(true);
    expect(servesPackages("preview", "preview")).toBe(true);
    expect(servesPackages("preview", undefined)).toBe(true);
    expect(servesPackages("preview", "production")).toBe(false);
    expect(servesPackages("storage", "preview")).toBe(false);
  });
});

describe("the platform's address for a signed package", () => {
  it("keeps the package and the token, on the host the CLI called", () => {
    expect(
      platformPackageUrl(`${STORAGE}/video-studio/1.1.0/video-studio-1.1.0.zip?token=${TOKEN}`, "https://flyee.club"),
    ).toBe(`https://flyee.club/api/public/packages/video-studio/1.1.0/video-studio-1.1.0.zip?token=${TOKEN}`);
    expect(
      platformPackageUrl(
        `${STORAGE}/motion-loop/2.0.0-beta.1/motion-loop-2.0.0-beta.1.zip?token=${TOKEN}`,
        "https://x.vercel.app",
      ),
    ).toBe(
      `https://x.vercel.app/api/public/packages/motion-loop/2.0.0-beta.1/motion-loop-2.0.0-beta.1.zip?token=${TOKEN}`,
    );
  });

  it("refuses whatever is not a package of the modules bucket", () => {
    const origin = "https://flyee.club";
    for (const url of [
      `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/backups/x/1.0.0/x-1.0.0.zip?token=${TOKEN}`,
      `${STORAGE}/video-studio/1.1.0/other-1.1.0.zip?token=${TOKEN}`,
      `${STORAGE}/video-studio/latest/video-studio-latest.zip?token=${TOKEN}`,
      `${STORAGE}/../1.1.0/x-1.1.0.zip?token=${TOKEN}`,
      `${STORAGE}/%2e%2e/1.1.0/%2e%2e-1.1.0.zip?token=${TOKEN}`,
      `${STORAGE}/video-studio/1.1.0/video-studio-1.1.0.zip`,
      `${STORAGE}/a/b/video-studio/1.1.0/video-studio-1.1.0.zip?token=${TOKEN}`,
      "not a url",
    ]) {
      expect(platformPackageUrl(url, origin), url).toBeNull();
    }
  });

  it("knows a package's path in the bucket", () => {
    expect(isPackagePath("video-studio", "1.1.0", "video-studio-1.1.0.zip")).toBe(true);
    expect(isPackagePath("video-studio", "1.1.0", "video-studio-1.1.1.zip")).toBe(false);
    expect(isPackagePath("..", "1.1.0", "..-1.1.0.zip")).toBe(false);
    expect(isPackagePath("%2e%2e", "1.1.0", "%2e%2e-1.1.0.zip")).toBe(false);
  });
});
