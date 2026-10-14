import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { importCatalogIndex, MAX_INDEX_BYTES, parseCatalogIndex } from "@/lib/catalog/index-import";
import { checkServiceToken } from "@/lib/catalog/service-token";
import { serviceActor } from "@/lib/catalog/upload";
import { createServiceClient } from "@flyee/auth/service";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/service/catalog/import: the product's index (`dist/index.json`)
 * creates or updates each module, never publishing anything
 * (docs/CLI-CONTRACT.md, section 10). Authenticated by the service token.
 *
 * Answers 200 with one line per app (`created`, `updated`, `unchanged` or
 * `refused`, with the fields changed, the warnings and the errors), and 422
 * when the file itself is not an index: then nothing is written.
 */
export async function POST(request: Request) {
  const auth = checkServiceToken(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_INDEX_BYTES) {
    return NextResponse.json({ error: "index_too_large" }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseCatalogIndex(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, errors: parsed.errors }, { status: 422, headers: NO_STORE });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  }

  let apps;
  try {
    apps = await importCatalogIndex(service, parsed, serviceActor(service).audit);
  } catch {
    return NextResponse.json({ error: "catalog_read_failed" }, { status: 502, headers: NO_STORE });
  }

  revalidatePath("/admin/catalogo");
  for (const app of apps) if (app.result === "updated") revalidatePath(`/admin/catalogo/${app.slug}`);

  const count = (result: string) => apps.filter((app) => app.result === result).length;
  return NextResponse.json(
    {
      apps,
      summary: {
        created: count("created"),
        updated: count("updated"),
        unchanged: count("unchanged"),
        refused: count("refused"),
      },
    },
    { headers: NO_STORE },
  );
}
