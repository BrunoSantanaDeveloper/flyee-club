import { TONE, type Tone } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type StoreApp = {
  slug: string;
  name: string;
  /** The category it is listed under (the trail name). */
  category: string;
  tone: Tone;
  icon: React.ReactNode;
};

/**
 * The app store as the home's hero shows it (docs/HOME-COPY.md, "Imagem do
 * produto"): the category chips and a grid of app tiles, meant to sit inside a
 * <ProductFrame>. Built from the real catalog, so every name on it is a
 * published app; token-driven until a screenshot of the member store exists,
 * at which point a <ProductShot> replaces it on the same line.
 *
 * It illustrates. The accessible list of apps is the store section of the
 * page, so the preview is one image with a label for assistive technology.
 * Two tiles per row on a phone, four from `md` up (the store's own grid).
 */
export default function AppStorePreview({
  apps,
  categories,
  allLabel,
  installLabel,
  label,
}: {
  apps: StoreApp[];
  categories: string[];
  /** The first chip, shown selected ("Todos"). */
  allLabel: string;
  /** The pill on each tile ("Instalar"). */
  installLabel: string;
  /** What the image shows, for assistive technology. */
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-4 p-4 sm:p-6">
      <div aria-hidden className="flex flex-row flex-wrap gap-2">
        <span className="bg-text-primary text-background-paper rounded-full px-3 py-1 text-xs font-semibold">
          {allLabel}
        </span>
        {categories.map((category) => (
          <span key={category} className="border-grey-100 text-text-secondary rounded-full border px-3 py-1 text-xs">
            {category}
          </span>
        ))}
      </div>
      <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {apps.map((app) => (
          <div
            key={app.slug}
            className="border-grey-100 bg-background flex min-w-0 flex-col gap-3 rounded-2xl border p-3"
          >
            <span
              className={cn(
                "inline-grid h-10 w-10 place-items-center rounded-xl",
                TONE[app.tone].softBg,
                TONE[app.tone].text,
              )}
            >
              {app.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-text-primary truncate text-sm font-semibold">{app.name}</span>
              <span className="text-text-secondary truncate text-xs">{app.category}</span>
            </span>
            <span className="border-grey-100 text-text-primary self-start rounded-full border px-2.5 py-0.5 text-xs">
              {installLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
