import NextureIcons, { IconMap, type IconName, type IconSize } from "@/icons/nexture-icons";

/**
 * A catalog icon stored by name (`catalog_modules.icon`, `catalog_trails.icon`):
 * the operator types it in the console, so a name the icon set lacks must not
 * render as nothing. It falls back to the catalog glyph.
 */
export default function CatalogIcon({
  name,
  size = "large",
  className,
}: {
  name: string | null | undefined;
  size?: IconSize;
  className?: string;
}) {
  const icon: IconName = name && name in IconMap ? (name as IconName) : "NiCatalog";
  return <NextureIcons icon={icon} size={size} className={className} />;
}
