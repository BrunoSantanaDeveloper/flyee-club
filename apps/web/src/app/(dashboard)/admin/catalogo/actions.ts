"use server";

import { revalidatePath } from "next/cache";

import type { Credential, DeliverySettings, Localized } from "@/lib/admin/catalog";
import { requireSuperadmin } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit";
import { MODULES_BUCKET } from "@/lib/catalog/upload";
import { AI_TOOL_DETAIL_PATTERN } from "@/lib/cli/installs";
import { PERSONA_SEGMENTS } from "@/lib/site-segment";
import { createServiceClient } from "@flyee/auth/service";
import { AI_TOOLS, MODULE_TYPES } from "@flyee/catalog/manifest";
import { isSemver } from "@flyee/catalog/semver";

/**
 * What the catalog console writes. The database owns the rules (migration
 * 0008): a module goes public only with a published version, a module that was
 * ever public keeps its slug and is archived instead of deleted, a released
 * version never changes. These actions add the session check, the shape checks
 * the database cannot phrase for a person, and the audit trail.
 */

export type CatalogActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;
const ENTITLEMENT_KEY = /^[a-z][a-z0-9_]{1,39}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const ICON = /^Ni[A-Za-z0-9]{1,60}$/;

const refresh = (slug?: string) => {
  revalidatePath("/admin/catalogo");
  if (slug) revalidatePath(`/admin/catalogo/${slug}`);
};

/** The database answers in codes and constraint names; the console answers in reasons. */
function dbMessage(raw: string, code?: string): string {
  if (raw.includes("module_has_no_published_version")) {
    return "A ferramenta só fica pública com pelo menos uma versão publicada. Publique uma versão primeiro.";
  }
  if (raw.includes("module_slug_frozen")) return "O endereço de uma ferramenta que já foi publicada não muda mais.";
  if (raw.includes("module_was_published")) {
    return "Uma ferramenta que já foi publicada não é excluída: integrantes têm ela instalada. Arquive em vez disso.";
  }
  if (raw.includes("version_released_immutable")) return "Uma versão publicada não muda. Publique uma versão nova.";
  if (raw.includes("invalid_version_transition")) return "Essa mudança de estado não é permitida para esta versão.";
  if (code === "23505") return "Já existe um item com esse endereço (slug). Escolha outro.";
  if (code === "23503") return "Um item ligado a este não existe mais. Recarregue a página.";
  if (code === "23514") return "O banco recusou um dos valores. Confira os campos e tente de novo.";
  if (code === "42501") return "Só quem tem o papel de superadmin pode mudar o catálogo.";
  return raw;
}

const cleanText = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** A `{pt-BR, en}` text with the Portuguese one required when `required` is set. Empty languages are dropped. */
function localized(value: Localized | undefined, max: number, required: boolean): Localized | null {
  const pt = cleanText(value?.["pt-BR"], max);
  const en = cleanText(value?.en, max);
  if (required && !pt) return null;
  return { ...(pt ? { "pt-BR": pt } : {}), ...(en ? { en } : {}) };
}

// ---------- Modules ----------

export type ModuleInput = {
  id?: string | null;
  slug: string;
  trail: string;
  /** The store category (migration 0029); null lists the app only under "Todos". */
  storeCategory: string | null;
  /** The site personas this app is a good start for (migration 0032); never `outro`. */
  personas: string[];
  type: string;
  icon: string;
  name: Localized;
  summary: Localized;
  descriptionMd: Localized;
  compatibleAis: string[];
  externalCredentials: Credential[];
  isFreeSample: boolean;
  entitlementKey: string;
  sort: number;
};

export async function saveModule(input: ModuleInput): Promise<CatalogActionResult<{ id: string; slug: string }>> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };

  const slug = cleanText(input.slug, 60).toLowerCase();
  if (!SLUG.test(slug)) return { ok: false, error: "O slug usa só letras minúsculas, números e hífens (2 a 60)." };
  if (!(MODULE_TYPES as readonly string[]).includes(input.type)) return { ok: false, error: "Escolha o tipo." };
  const name = localized(input.name, 80, true);
  if (!name) return { ok: false, error: "Dê um nome em português." };
  const icon = cleanText(input.icon, 64);
  if (icon && !ICON.test(icon)) return { ok: false, error: "O ícone é um nome do conjunto Ni, como NiRocket." };
  const entitlementKey = cleanText(input.entitlementKey, 40) || "catalog_access";
  if (!ENTITLEMENT_KEY.test(entitlementKey)) return { ok: false, error: "A chave de acesso usa letras, números e _." };
  const compatibleAis = [...new Set(input.compatibleAis)].filter((tool) =>
    (AI_TOOLS as readonly string[]).includes(tool),
  );
  const personas = PERSONA_SEGMENTS.filter((persona) => (input.personas ?? []).includes(persona));

  const credentials: Credential[] = [];
  for (const credential of input.externalCredentials ?? []) {
    const env = cleanText(credential.env, 64).toUpperCase();
    const label = cleanText(credential.name, 80);
    if (!label && !env) continue;
    if (!label || !ENV_NAME.test(env)) {
      return { ok: false, error: "Cada chave precisa de um nome e de uma variável de ambiente em MAIÚSCULAS." };
    }
    const url = cleanText(credential.url, 500);
    if (url && !/^https:\/\//.test(url))
      return { ok: false, error: "O link de onde conseguir a chave precisa ser https." };
    credentials.push({
      name: label,
      env,
      ...(url ? { url } : {}),
      required: Boolean(credential.required),
      purpose: localized(credential.purpose, 280, false) ?? {},
    });
  }

  const row = {
    slug,
    trail: input.trail,
    store_category: input.storeCategory || null,
    personas,
    type: input.type,
    icon: icon || null,
    name,
    summary: localized(input.summary, 280, false) ?? {},
    description_md: localized(input.descriptionMd, 8000, false) ?? {},
    compatible_ais: compatibleAis,
    external_credentials: credentials,
    is_free_sample: Boolean(input.isFreeSample),
    entitlement_key: entitlementKey,
    sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
  };

  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "Ferramenta inválida." };
    const { data, error } = await session.supabase
      .from("catalog_modules")
      .update(row)
      .eq("id", input.id)
      .select("id, slug")
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
    if (!data) return { ok: false, error: "Esta ferramenta não existe mais. Recarregue a página." };
    await recordAudit(session.supabase, "admin.catalog.module.updated", {
      entityType: "catalog_module",
      entityId: data.id,
      metadata: { slug: data.slug },
    });
    refresh(data.slug);
    return { ok: true, data: { id: data.id, slug: data.slug } };
  }

  const { data, error } = await session.supabase
    .from("catalog_modules")
    .insert({ ...row, created_by: session.userId })
    .select("id, slug")
    .single();
  if (error || !data) return { ok: false, error: dbMessage(error?.message ?? "", error?.code) };
  await recordAudit(session.supabase, "admin.catalog.module.created", {
    entityType: "catalog_module",
    entityId: data.id,
    metadata: { slug: data.slug },
  });
  refresh(data.slug);
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function setModuleStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<CatalogActionResult> {
  if (!UUID.test(id) || !["draft", "published", "archived"].includes(status))
    return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data, error } = await session.supabase
    .from("catalog_modules")
    .update({ status })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  if (!data) return { ok: false, error: "Esta ferramenta não existe mais. Recarregue a página." };
  await recordAudit(session.supabase, "admin.catalog.module.status_changed", {
    entityType: "catalog_module",
    entityId: id,
    metadata: { slug: data.slug, status },
  });
  refresh(data.slug);
  return { ok: true, data: null };
}

/** Only a module that was never public goes; the database refuses the rest. Its draft packages go with it. */
export async function deleteModule(id: string): Promise<CatalogActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };

  let service;
  try {
    service = createServiceClient();
  } catch {
    return {
      ok: false,
      error: "Defina SUPABASE_SERVICE_ROLE_KEY: os pacotes guardados só podem ser removidos com ela.",
    };
  }
  const { data: paths } = await service.from("catalog_module_versions").select("storage_path").eq("module_id", id);

  const { data, error } = await session.supabase
    .from("catalog_modules")
    .delete()
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  if (!data) return { ok: false, error: "Esta ferramenta não existe mais. Recarregue a página." };

  const files = (paths ?? []).map((row) => row.storage_path as string).filter(Boolean);
  if (files.length > 0) await service.storage.from(MODULES_BUCKET).remove(files);
  await recordAudit(session.supabase, "admin.catalog.module.deleted", {
    entityType: "catalog_module",
    entityId: id,
    metadata: { slug: data.slug, packagesRemoved: files.length },
  });
  refresh();
  return { ok: true, data: null };
}

/**
 * A draft version is thrown away whole: its row and its package. A released
 * version is never deleted (members verify it); it is yanked instead.
 */
export async function discardDraftVersion(versionId: string): Promise<CatalogActionResult> {
  if (!UUID.test(versionId)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };

  let service;
  try {
    service = createServiceClient();
  } catch {
    return { ok: false, error: "Defina SUPABASE_SERVICE_ROLE_KEY: o pacote guardado só pode ser removido com ela." };
  }
  const { data: version } = await service
    .from("catalog_module_versions")
    .select("id, version, status, storage_path, catalog_modules(slug)")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { ok: false, error: "Esta versão não existe mais. Recarregue a página." };
  if (version.status !== "draft") {
    return { ok: false, error: "Só um rascunho é descartado. Uma versão publicada é retirada, nunca apagada." };
  }

  const { error } = await session.supabase.from("catalog_module_versions").delete().eq("id", versionId);
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await service.storage.from(MODULES_BUCKET).remove([version.storage_path as string]);

  const owner = version.catalog_modules as { slug: string } | { slug: string }[] | null;
  const slug = Array.isArray(owner) ? owner[0]?.slug : owner?.slug;
  await recordAudit(session.supabase, "admin.catalog.version.discarded", {
    entityType: "catalog_module_version",
    entityId: versionId,
    metadata: { module: slug, version: version.version },
  });
  refresh(slug);
  return { ok: true, data: null };
}

// ---------- Lessons ----------

export type LessonInput = {
  id?: string | null;
  moduleId: string;
  depth: string;
  locale: string;
  title: string;
  youtubeId: string;
  durationMinutes: number | null;
  isAdvanced: boolean;
  sort: number;
};

/** Accepts the id or a full YouTube link, and keeps only the id. */
function youtubeIdFrom(value: string): string | null {
  const text = value.trim();
  if (YOUTUBE_ID.test(text)) return text;
  const match = text.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{6,20})/);
  return match ? match[1] : null;
}

export async function saveLesson(input: LessonInput, moduleSlug: string): Promise<CatalogActionResult<{ id: string }>> {
  if (!UUID.test(input.moduleId)) return { ok: false, error: "Ferramenta inválida." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  if (!["usar", "abrir_o_capo"].includes(input.depth)) return { ok: false, error: "Escolha a profundidade do vídeo." };
  if (!["pt-BR", "en"].includes(input.locale)) return { ok: false, error: "Escolha o idioma do vídeo." };
  const title = cleanText(input.title, 160);
  if (!title) return { ok: false, error: "Dê um título ao vídeo." };
  const youtubeId = input.youtubeId.trim() ? youtubeIdFrom(input.youtubeId) : null;
  if (input.youtubeId.trim() && !youtubeId) return { ok: false, error: "Cole o link ou o id do vídeo no YouTube." };
  const minutes = input.durationMinutes;
  const duration = minutes && minutes > 0 ? Math.round(minutes * 60) : null;

  const row = {
    module_id: input.moduleId,
    depth: input.depth,
    locale: input.locale,
    title,
    duration_seconds: duration,
    is_advanced: Boolean(input.isAdvanced),
    sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
  };

  let lessonId = input.id ?? null;
  if (lessonId) {
    if (!UUID.test(lessonId)) return { ok: false, error: "Vídeo inválido." };
    const { error } = await session.supabase.from("catalog_lessons").update(row).eq("id", lessonId);
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  } else {
    const { data, error } = await session.supabase.from("catalog_lessons").insert(row).select("id").single();
    if (error || !data) {
      return {
        ok: false,
        error:
          error?.code === "23505"
            ? "Esta ferramenta já tem um vídeo nesta profundidade e neste idioma. Edite o existente."
            : dbMessage(error?.message ?? "", error?.code),
      };
    }
    lessonId = data.id as string;
  }

  // The video id lives apart from the lesson: it is what an unentitled member must never read.
  const { error: videoError } = youtubeId
    ? await session.supabase.from("catalog_lesson_videos").upsert({ lesson_id: lessonId, youtube_id: youtubeId })
    : await session.supabase.from("catalog_lesson_videos").delete().eq("lesson_id", lessonId);
  if (videoError) return { ok: false, error: dbMessage(videoError.message, videoError.code) };

  await recordAudit(session.supabase, "admin.catalog.lesson.saved", {
    entityType: "catalog_lesson",
    entityId: lessonId,
    metadata: { module: moduleSlug, depth: row.depth, locale: row.locale, hasVideo: Boolean(youtubeId) },
  });
  refresh(moduleSlug);
  return { ok: true, data: { id: lessonId } };
}

export async function deleteLesson(id: string, moduleSlug: string): Promise<CatalogActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Vídeo inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { error } = await session.supabase.from("catalog_lessons").delete().eq("id", id);
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await recordAudit(session.supabase, "admin.catalog.lesson.deleted", {
    entityType: "catalog_lesson",
    entityId: id,
    metadata: { module: moduleSlug },
  });
  refresh(moduleSlug);
  return { ok: true, data: null };
}

// ---------- Recipes ----------

export type RecipeInput = {
  id?: string | null;
  slug: string;
  name: Localized;
  summary: Localized;
  icon: string;
  sort: number;
  moduleIds: string[];
  workflow: Localized;
};

export async function saveRecipe(input: RecipeInput): Promise<CatalogActionResult<{ id: string }>> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const slug = cleanText(input.slug, 60).toLowerCase();
  if (!SLUG.test(slug)) return { ok: false, error: "O slug usa só letras minúsculas, números e hífens (2 a 60)." };
  const name = localized(input.name, 80, true);
  if (!name) return { ok: false, error: "Dê um nome em português." };
  const icon = cleanText(input.icon, 64);
  if (icon && !ICON.test(icon)) return { ok: false, error: "O ícone é um nome do conjunto Ni, como NiRocket." };
  const moduleIds = [...new Set(input.moduleIds)].filter((id) => UUID.test(id));
  if (moduleIds.length < 2) return { ok: false, error: "Uma receita encadeia pelo menos duas ferramentas." };

  const row = {
    slug,
    name,
    summary: localized(input.summary, 280, false) ?? {},
    icon: icon || null,
    sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
  };

  let recipeId = input.id ?? null;
  if (recipeId) {
    if (!UUID.test(recipeId)) return { ok: false, error: "Receita inválida." };
    const { error } = await session.supabase.from("catalog_recipes").update(row).eq("id", recipeId);
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  } else {
    const { data, error } = await session.supabase.from("catalog_recipes").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: dbMessage(error?.message ?? "", error?.code) };
    recipeId = data.id as string;
  }

  // The chain is replaced whole: the order is part of the recipe.
  const { error: clearError } = await session.supabase
    .from("catalog_recipe_modules")
    .delete()
    .eq("recipe_id", recipeId);
  if (clearError) return { ok: false, error: dbMessage(clearError.message, clearError.code) };
  const { error: chainError } = await session.supabase
    .from("catalog_recipe_modules")
    .insert(moduleIds.map((moduleId, index) => ({ recipe_id: recipeId, module_id: moduleId, sort: index })));
  if (chainError) return { ok: false, error: dbMessage(chainError.message, chainError.code) };

  const { error: workflowError } = await session.supabase
    .from("catalog_recipe_workflows")
    .upsert({ recipe_id: recipeId, body_md: localized(input.workflow, 20000, false) ?? {} });
  if (workflowError) return { ok: false, error: dbMessage(workflowError.message, workflowError.code) };

  await recordAudit(session.supabase, "admin.catalog.recipe.saved", {
    entityType: "catalog_recipe",
    entityId: recipeId,
    metadata: { slug, modules: moduleIds.length },
  });
  refresh();
  return { ok: true, data: { id: recipeId } };
}

export async function setRecipeStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<CatalogActionResult> {
  if (!UUID.test(id) || !["draft", "published", "archived"].includes(status))
    return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data, error } = await session.supabase
    .from("catalog_recipes")
    .update({ status })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  if (!data) return { ok: false, error: "Esta receita não existe mais. Recarregue a página." };
  await recordAudit(session.supabase, "admin.catalog.recipe.status_changed", {
    entityType: "catalog_recipe",
    entityId: id,
    metadata: { slug: data.slug, status },
  });
  refresh();
  return { ok: true, data: null };
}

/** A recipe that was published may be in someone's terminal history: it is archived, not deleted. */
export async function deleteRecipe(id: string): Promise<CatalogActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const { data: recipe } = await session.supabase
    .from("catalog_recipes")
    .select("slug, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) return { ok: false, error: "Esta receita não existe mais. Recarregue a página." };
  if (recipe.published_at) return { ok: false, error: "Uma receita que já foi publicada é arquivada, não excluída." };
  const { error } = await session.supabase.from("catalog_recipes").delete().eq("id", id);
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await recordAudit(session.supabase, "admin.catalog.recipe.deleted", {
    entityType: "catalog_recipe",
    entityId: id,
    metadata: { slug: recipe.slug },
  });
  refresh();
  return { ok: true, data: null };
}

// ---------- Trails ----------

export type TrailInput = { slug: string; name: Localized; description: Localized; icon: string; sort: number };

/** The seven stages are fixed by the product: their texts, icon and order change, never their slug. */
export async function saveTrail(input: TrailInput): Promise<CatalogActionResult> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const name = localized(input.name, 60, true);
  if (!name) return { ok: false, error: "Dê um nome em português." };
  const icon = cleanText(input.icon, 64);
  if (icon && !ICON.test(icon)) return { ok: false, error: "O ícone é um nome do conjunto Ni, como NiRocket." };
  const { data, error } = await session.supabase
    .from("catalog_trails")
    .update({
      name,
      description: localized(input.description, 280, false) ?? {},
      icon: icon || null,
      sort: Number.isFinite(input.sort) ? Math.round(input.sort) : 0,
    })
    .eq("slug", input.slug)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  if (!data) return { ok: false, error: "Esta trilha não existe." };
  await recordAudit(session.supabase, "admin.catalog.trail.updated", {
    entityType: "catalog_trail",
    entityId: input.slug,
  });
  refresh();
  return { ok: true, data: null };
}

// ---------- Store categories ----------

export type StoreCategoryInput = { slug: string; name: Localized; sort: number; isNew: boolean };

const CATEGORY_SLUG = /^[a-z][a-z0-9-]{1,30}$/;

/**
 * Creates or edits a kind of work the public store filters by (migration
 * 0029). The slug is fixed once created (links and events carry it); the
 * names and the order change freely.
 */
export async function saveStoreCategory(input: StoreCategoryInput): Promise<CatalogActionResult> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const slug = cleanText(input.slug, 31).toLowerCase();
  if (!CATEGORY_SLUG.test(slug)) {
    return { ok: false, error: "O identificador usa letras minúsculas, números e hífens, começando por uma letra." };
  }
  const name = localized(input.name, 40, true);
  if (!name) return { ok: false, error: "Dê um nome em português." };
  const sort = Number.isFinite(input.sort) ? Math.round(input.sort) : 0;

  if (input.isNew) {
    const { error } = await session.supabase.from("catalog_store_categories").insert({ slug, name, sort });
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
    await recordAudit(session.supabase, "admin.catalog.store_category.created", {
      entityType: "catalog_store_category",
      entityId: slug,
    });
  } else {
    const { data, error } = await session.supabase
      .from("catalog_store_categories")
      .update({ name, sort })
      .eq("slug", slug)
      .select("slug")
      .maybeSingle();
    if (error) return { ok: false, error: dbMessage(error.message, error.code) };
    if (!data) return { ok: false, error: "Esta categoria não existe mais. Recarregue a página." };
    await recordAudit(session.supabase, "admin.catalog.store_category.updated", {
      entityType: "catalog_store_category",
      entityId: slug,
    });
  }
  refresh();
  return { ok: true, data: null };
}

/** Only a category no app is in is deleted: moving the apps first is a choice the operator makes, not a side effect. */
export async function deleteStoreCategory(slug: string): Promise<CatalogActionResult> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  if (!CATEGORY_SLUG.test(slug)) return { ok: false, error: "Categoria inválida." };
  const { count, error: countError } = await session.supabase
    .from("catalog_modules")
    .select("id", { count: "exact", head: true })
    .eq("store_category", slug);
  if (countError) return { ok: false, error: dbMessage(countError.message, countError.code) };
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Há ferramentas nesta categoria. Mude a categoria delas antes de excluir." };
  }
  const { error } = await session.supabase.from("catalog_store_categories").delete().eq("slug", slug);
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await recordAudit(session.supabase, "admin.catalog.store_category.deleted", {
    entityType: "catalog_store_category",
    entityId: slug,
  });
  refresh();
  return { ok: true, data: null };
}

/** How many days after its first publication an app shows "Novo" in the store (platform_settings.catalog, public). */
export async function saveStoreSettings(input: { newBadgeDays: number }): Promise<CatalogActionResult> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  const days = Math.floor(Number(input.newBadgeDays));
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { ok: false, error: "Os dias do selo Novo são um número inteiro de 1 a 365." };
  }
  // Public: the public store reads it.
  const { error } = await session.supabase
    .from("platform_settings")
    .upsert({ key: "catalog", value: { new_badge_days: days }, is_public: true });
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await recordAudit(session.supabase, "admin.catalog.store_settings.updated", {
    entityType: "platform_settings",
    entityId: "catalog",
    metadata: { new_badge_days: days },
  });
  refresh();
  return { ok: true, data: null };
}

// ---------- Delivery ----------

const positive = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;

/** `platform_settings.cli`: the CLI's rate ceilings, the oldest CLI still served, the newest core, the notices. */
export async function saveDelivery(input: DeliverySettings): Promise<CatalogActionResult> {
  const session = await requireSuperadmin();
  if (!session) return { ok: false, error: dbMessage("", "42501") };
  if (!positive(input.perMinute, 10_000) || !positive(input.perHour, 100_000)) {
    return { ok: false, error: "Os limites de chamadas são números inteiros a partir de 1." };
  }
  if (input.perHour < input.perMinute)
    return { ok: false, error: "O limite por hora não pode ser menor que o por minuto." };
  if (!positive(input.downloadsPerDay, 100_000) || !positive(input.eventsPerHour, 100_000)) {
    return { ok: false, error: "Os limites de downloads e de eventos são números inteiros a partir de 1." };
  }
  if (!isSemver(input.minCliVersion)) return { ok: false, error: "A versão mínima da CLI segue o formato 1.2.3." };
  if (input.latestCoreVersion && !isSemver(input.latestCoreVersion)) {
    return { ok: false, error: "A versão mais nova do core segue o formato 1.2.3, ou fica vazia." };
  }
  const deprecations = input.deprecations
    .map((line) => line.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 10);
  // The names a machine may give beside `other` (migration 0036): short
  // tokens, never one of the AI tools that have their own value.
  const knownTools = [...new Set(input.knownTools.map((line) => line.trim().toLowerCase()).filter(Boolean))];
  if (knownTools.length > 30) return { ok: false, error: "A lista de ferramentas reconhecidas vai até 30 nomes." };
  const malformed = knownTools.find((tool) => !AI_TOOL_DETAIL_PATTERN.test(tool));
  if (malformed) {
    return {
      ok: false,
      error: `"${malformed}" não serve como nome de ferramenta: use letras minúsculas, números, hífen ou sublinhado, até 32 caracteres, como copilot ou windsurf.`,
    };
  }
  const ownValue = knownTools.find((tool) => (AI_TOOLS as readonly string[]).includes(tool));
  if (ownValue) {
    return {
      ok: false,
      error: `"${ownValue}" já tem valor próprio no relato da CLI; a lista é só das IAs compatíveis pelo padrão.`,
    };
  }

  const { error } = await session.supabase.from("platform_settings").upsert({
    key: "cli",
    value: {
      rate: { per_minute: input.perMinute, per_hour: input.perHour },
      downloads_per_day: input.downloadsPerDay,
      events_per_hour: input.eventsPerHour,
      min_cli_version: input.minCliVersion,
      latest_core_version: input.latestCoreVersion || null,
      deprecations,
      known_tools: knownTools,
    },
  });
  if (error) return { ok: false, error: dbMessage(error.message, error.code) };
  await recordAudit(session.supabase, "admin.cli_settings.updated", {
    entityType: "platform_settings",
    entityId: "cli",
    metadata: { minCliVersion: input.minCliVersion, deprecations: deprecations.length, knownTools },
  });
  refresh();
  return { ok: true, data: null };
}
