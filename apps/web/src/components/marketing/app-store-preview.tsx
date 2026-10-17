import LocaleLink from "@/components/marketing/locale-link";
import { cn } from "@/lib/utils";

export type StoreApp = {
  slug: string;
  name: string;
  /** The category it is listed under (the store category, else the stage). */
  category: string;
  /** The app's page (internal Portuguese path). */
  href: string;
  /** Its <AppIcon>, rendered on the server. */
  icon: React.ReactNode;
  /** The site event of the click (`trackAttributes`, lib/site-events.ts). */
  track?: Record<string, string>;
};

/** Up to three apps sit in one row; four to six make two rows of three; more, rows of four. */
export function previewColumns(count: number): 1 | 2 | 3 | 4 {
  if (count <= 3) return Math.max(1, count) as 1 | 2 | 3;
  return count <= 6 ? 3 : 4;
}

const COLUMNS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
};

/**
 * The app store as the home's hero shows it (docs/HOME-COPY.md, "Imagem do
 * produto"), laid out the way an app shelf is read (decided 2026-10-17, from
 * the owner's reference): each app as its icon, large, with the name and the
 * category under it, on a quiet dot matrix. Built from the real catalog, so
 * every icon on it is a published app; it sits inside a <ProductFrame>.
 *
 * Every icon is a link to the app's page. The category chips above the shelf
 * only picture the store (the filter that works is the carousel's, further
 * down), so they are hidden from assistive technology. A phone shows six apps
 * at most, three to a row.
 */
export default function AppStorePreview({
  apps,
  title,
  categories,
  allLabel,
  label,
}: {
  apps: StoreApp[];
  /** The shelf's heading inside the frame ("Loja de apps"). */
  title: string;
  categories: string[];
  /** The first chip, shown selected ("Todos"). */
  allLabel: string;
  /** What the list of apps is, for assistive technology. */
  label: string;
}) {
  const shown = apps.slice(0, 8);
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--grey-200) / 0.7) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative flex flex-col gap-7 px-4 pt-5 pb-8 sm:gap-9 sm:px-10 sm:pt-8 sm:pb-12">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <p className="font-display text-text-primary m-0 text-lg font-normal sm:text-xl">{title}</p>
          {categories.length > 0 && (
            <div aria-hidden className="hidden flex-row flex-wrap gap-2 sm:flex">
              <span className="bg-text-primary text-background-paper rounded-full px-3 py-1 text-xs font-semibold">
                {allLabel}
              </span>
              {categories.map((category) => (
                <span
                  key={category}
                  className="border-grey-100 bg-background-paper text-text-secondary rounded-full border px-3 py-1 text-xs"
                >
                  {category}
                </span>
              ))}
            </div>
          )}
        </div>
        <ul
          aria-label={label}
          className={cn(
            "m-0 grid list-none gap-x-3 gap-y-7 p-0 sm:gap-x-8 sm:gap-y-10",
            COLUMNS[previewColumns(shown.length)],
          )}
        >
          {shown.map((app, index) => (
            <li key={app.slug} className={cn("flex justify-center", index >= 6 && "hidden sm:flex")}>
              <LocaleLink
                href={app.href}
                className="group focus-visible:outline-primary-ink flex w-full max-w-44 flex-col items-center gap-2.5 rounded-2xl text-center focus-visible:outline-2 focus-visible:outline-offset-4"
                {...app.track}
              >
                <span className="transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none">
                  {app.icon}
                </span>
                <span className="font-display text-text-primary text-base leading-5 font-normal sm:text-lg sm:leading-6">
                  {app.name}
                </span>
                <span className="text-text-secondary -mt-1.5 text-xs sm:text-sm">{app.category}</span>
              </LocaleLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
