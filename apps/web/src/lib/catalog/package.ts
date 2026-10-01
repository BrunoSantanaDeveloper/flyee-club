import { unzipSync } from "fflate";
import { createHash } from "node:crypto";

import { isSafePackagePath, MANIFEST_FILE, type ModuleManifest, parseManifest } from "@flyee/catalog/manifest";

/**
 * Reads an uploaded module package (a ZIP) before anything is stored, and
 * answers what the catalog records about it: the manifest, the SHA-256 and the
 * size of the exact bytes members will download (docs/CLI-CONTRACT.md).
 *
 * The archive is walked through its directory without inflating anything but
 * the manifest. It is refused when an entry could escape the install folder,
 * when it is too large or has too many entries, and when its file list and the
 * manifest's `files` disagree in either direction: the manifest is the
 * complete inventory a member can read before installing.
 */

export const MAX_PACKAGE_ENTRIES = 2001;
export const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
/** A manifest is a small JSON file; anything bigger is not one. */
const MAX_MANIFEST_BYTES = 256 * 1024;

export type PackageInspection =
  | { ok: true; manifest: ModuleManifest; sha256: string; sizeBytes: number; files: string[] }
  | { ok: false; errors: string[] };

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function inspectModulePackage(bytes: Uint8Array): PackageInspection {
  const errors: string[] = [];
  const files: string[] = [];
  let entries = 0;
  let uncompressed = 0;
  let manifestTooLarge = false;

  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(bytes, {
      filter(file) {
        entries += 1;
        uncompressed += file.originalSize;
        if (file.name.endsWith("/")) return false; // a directory entry
        if (!isSafePackagePath(file.name)) {
          errors.push(`${file.name}: path escapes the package folder`);
          return false;
        }
        if (file.name === MANIFEST_FILE) {
          if (file.originalSize > MAX_MANIFEST_BYTES || file.size > MAX_MANIFEST_BYTES) {
            manifestTooLarge = true;
            return false;
          }
          return true;
        }
        files.push(file.name);
        return false;
      },
    });
  } catch {
    return { ok: false, errors: ["the file is not a valid ZIP archive"] };
  }

  if (entries > MAX_PACKAGE_ENTRIES) errors.push(`too many entries (${entries}, at most ${MAX_PACKAGE_ENTRIES})`);
  if (uncompressed > MAX_UNCOMPRESSED_BYTES) errors.push("the package is too large once extracted");
  if (manifestTooLarge) errors.push(`${MANIFEST_FILE} is too large`);

  const manifestBytes = extracted[MANIFEST_FILE];
  if (!manifestBytes && !manifestTooLarge) errors.push(`${MANIFEST_FILE} is missing from the root of the package`);
  if (errors.length > 0 || !manifestBytes) return { ok: false, errors };

  const parsed = parseManifest(manifestBytes);
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map((error) => `${MANIFEST_FILE} ${error}`) };

  const inArchive = new Set(files);
  const declared = new Set(parsed.manifest.files);
  for (const file of parsed.manifest.files) {
    if (!inArchive.has(file)) errors.push(`${file}: listed in files but missing from the package`);
  }
  for (const file of files) {
    if (!declared.has(file)) errors.push(`${file}: in the package but not listed in files`);
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    manifest: parsed.manifest,
    sha256: sha256Hex(bytes),
    sizeBytes: bytes.byteLength,
    files: [...files].sort(),
  };
}
