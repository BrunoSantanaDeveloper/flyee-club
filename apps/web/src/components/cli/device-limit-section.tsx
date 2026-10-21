import { getLocale, getTranslations } from "next-intl/server";

import { Alert, Box, Button, List, ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";

import NiLaptop from "@/icons/nexture/ni-laptop";
import type { DeviceRoom } from "@/lib/member/device-room";

const OS_NAME: Record<string, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

/**
 * The connected machines of an account at its device limit, shown before the
 * approval on /ativar and /oauth/authorize (the product's request of
 * 2026-10-21, item 7.7), each with "Desconectar". Each page passes its own
 * action and the hidden fields that bring the member back to the same
 * approval, so one approval is enough. Renders nothing when there is room.
 *
 * Closest existing shape: the machine rows of /settings/devices, condensed to
 * the consent card's list (the scopes above it use the same List).
 */
export default async function DeviceLimitSection({
  room,
  action,
  hidden,
}: {
  room: DeviceRoom | null;
  /** Disconnects the machine in the `device` field and comes back to this approval. */
  action: (formData: FormData) => Promise<void>;
  /** What the action needs to come back to this approval (the code, or the authorization request). */
  hidden: React.ReactNode;
}) {
  if (!room?.full) return null;
  const [t, locale] = await Promise.all([getTranslations("product"), getLocale()]);
  const day = (value: string) => new Date(value).toLocaleDateString(locale, { day: "numeric", month: "long" });

  return (
    <Box className="flex flex-col gap-3">
      <Alert severity="warning" className="neutral bg-background-paper/60!">
        {t("device-limit-full", { limit: room.limit })}
      </Alert>
      <List disablePadding className="flex flex-col gap-2">
        {room.connected.map((device) => (
          <ListItem
            key={device.id}
            disableGutters
            className="border-grey-100 rounded-lg border px-3 py-2"
            secondaryAction={
              <Box component="form" action={action}>
                {hidden}
                <input type="hidden" name="device" value={device.id} />
                <Button type="submit" size="small" variant="text" color="grey">
                  {t("devices-revoke")}
                </Button>
              </Box>
            }
          >
            <ListItemIcon>
              <NiLaptop size="medium" className="text-primary-ink" />
            </ListItemIcon>
            <ListItemText
              primary={device.name || t("device-limit-unnamed")}
              secondary={[
                device.os ? (OS_NAME[device.os] ?? t("devices-os-other")) : null,
                t("device-limit-seen", { date: day(device.lastSeenAt) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </ListItem>
        ))}
      </List>
      <Typography variant="body2" className="text-text-secondary">
        {t("device-limit-note")}
      </Typography>
    </Box>
  );
}
