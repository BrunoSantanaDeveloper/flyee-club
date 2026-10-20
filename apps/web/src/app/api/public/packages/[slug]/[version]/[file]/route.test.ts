// @vitest-environment node
import { GET } from "./route";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtb2R1bGVzL3gifQ.c2lnbmF0dXJl";
const BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

const call = (slug: string, version: string, file: string, token: string | null = TOKEN) =>
  GET(
    new Request(
      `https://flyee.club/api/public/packages/${slug}/${version}/${file}${token === null ? "" : `?token=${token}`}`,
    ),
    { params: Promise.resolve({ slug, version, file }) },
  );

describe("GET /api/public/packages: a signed package passed through from storage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams the zip with its length, never cached and never indexed", async () => {
    fetchMock.mockResolvedValue(
      new Response(BYTES, {
        status: 200,
        headers: { "content-length": String(BYTES.length), "cache-control": "max-age=3600" },
      }),
    );
    const response = await call("video-studio", "1.1.0", "video-studio-1.1.0.zip");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-length")).toBe(String(BYTES.length));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    // The same package, the same token, and no cache on the way in either.
    expect(fetchMock).toHaveBeenCalledWith(
      `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/sign/modules/video-studio/1.1.0/video-studio-1.1.0.zip?token=${TOKEN}`,
      { cache: "no-store" },
    );
  });

  it("serves only a package's path, never .. and never another file", async () => {
    for (const [slug, version, file] of [
      ["..", "1.1.0", "..-1.1.0.zip"],
      ["%2e%2e", "1.1.0", "%2e%2e-1.1.0.zip"],
      ["video-studio", "..", "video-studio-...zip"],
      ["video-studio", "1.1.0", "other-1.1.0.zip"],
      ["video-studio", "1.1.0", "video-studio-1.1.0.tar"],
    ]) {
      const response = await call(slug, version, file);
      expect(response.status, `${slug}/${version}/${file}`).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for the token the download route signed", async () => {
    expect((await call("video-studio", "1.1.0", "video-studio-1.1.0.zip", null)).status).toBe(400);
    expect((await call("video-studio", "1.1.0", "video-studio-1.1.0.zip", "not-a-jwt")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers an expired or forged link with an error, not with bytes", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "InvalidJWT" }), { status: 400 }));
    const expired = await call("video-studio", "1.1.0", "video-studio-1.1.0.zip");
    expect(expired.status).toBe(403);
    expect(await expired.json()).toEqual({ error: "link_expired" });

    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    expect((await call("video-studio", "1.1.0", "video-studio-1.1.0.zip")).status).toBe(404);

    fetchMock.mockRejectedValue(new Error("network"));
    expect((await call("video-studio", "1.1.0", "video-studio-1.1.0.zip")).status).toBe(502);
  });
});
