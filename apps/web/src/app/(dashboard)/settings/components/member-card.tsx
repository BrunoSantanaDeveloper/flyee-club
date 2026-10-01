"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from "@mui/material";

import { setClientLocale } from "@/i18n/locale";
import { updateProfile } from "@/lib/member/actions";
import { AI_TOOL_OPTIONS, aiToolName, SEGMENT_OPTIONS } from "@/lib/member/labels";
import { createClient } from "@flyee/auth/client";

type Values = { segment: string; aiTool: string; locale: "pt-BR" | "en"; timezone: string };

/**
 * Who the member is to the club: what they build (segment), the AI they use,
 * the language they read and their timezone. The catalog, the lessons and the
 * e-mails follow these answers, and the club measures what works per segment
 * (docs/PRODUCT.md), so the card says what each answer changes.
 *
 * Saved through `update_member_profile`; the language also switches this
 * browser right away.
 */
export default function MemberCard() {
  const t = useTranslations("product");
  const [initial, setInitial] = useState<Values | null>(null);
  const [values, setValues] = useState<Values>({ segment: "", aiTool: "", locale: "pt-BR", timezone: "" });
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [saving, setSaving] = useState(false);

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("segment, ai_tool, locale, timezone")
        .eq("id", user.id)
        .maybeSingle();
      const loaded: Values = {
        segment: (data?.segment as string | null) ?? "",
        aiTool: (data?.ai_tool as string | null) ?? "",
        locale: data?.locale === "en" ? "en" : "pt-BR",
        timezone: (data?.timezone as string | null) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      setInitial(loaded);
      setValues(loaded);
    };
    void load();
  }, []);

  const save = async () => {
    if (!initial) return;
    setSaving(true);
    setStatus(null);
    const result = await updateProfile({
      ...(values.segment ? { segment: values.segment as (typeof SEGMENT_OPTIONS)[number]["value"] } : {}),
      ...(values.aiTool ? { aiTool: values.aiTool as (typeof AI_TOOL_OPTIONS)[number] } : {}),
      ...(values.timezone ? { timezone: values.timezone } : {}),
    });
    if (!result.ok) {
      setStatus("error");
      setSaving(false);
      return;
    }
    if (values.locale !== initial.locale) {
      // The switch writes the cookie AND the profile, then the page reloads in the new language.
      await setClientLocale(values.locale);
      window.location.reload();
      return;
    }
    setInitial(values);
    setStatus("saved");
    setSaving(false);
  };

  return (
    <Grid size={12}>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Typography variant="h5" component="h2" className="mb-0">
              {t("settings-member-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("settings-member-body")}
            </Typography>
          </div>

          {!initial ? (
            <Skeleton variant="rounded" height={160} />
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <FormLabel id="member-segment" component="label">
                    {t("settings-member-segment")}
                  </FormLabel>
                  <Select
                    labelId="member-segment"
                    displayEmpty
                    value={values.segment}
                    onChange={(event) => setValues({ ...values, segment: event.target.value })}
                  >
                    <MenuItem value="" disabled>
                      {t("settings-member-choose")}
                    </MenuItem>
                    {SEGMENT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <FormLabel id="member-ai" component="label">
                    {t("settings-member-ai")}
                  </FormLabel>
                  <Select
                    labelId="member-ai"
                    displayEmpty
                    value={values.aiTool}
                    onChange={(event) => setValues({ ...values, aiTool: event.target.value })}
                  >
                    <MenuItem value="" disabled>
                      {t("settings-member-choose")}
                    </MenuItem>
                    {AI_TOOL_OPTIONS.map((tool) => (
                      <MenuItem key={tool} value={tool}>
                        {aiToolName(tool, t("ai-tool-other"))}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <FormLabel id="member-locale" component="label">
                    {t("settings-member-locale")}
                  </FormLabel>
                  <Select
                    labelId="member-locale"
                    value={values.locale}
                    onChange={(event) => setValues({ ...values, locale: event.target.value as Values["locale"] })}
                  >
                    <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <FormLabel htmlFor="member-timezone" component="label">
                    {t("settings-member-timezone")}
                  </FormLabel>
                  <Autocomplete
                    id="member-timezone"
                    options={timezones}
                    value={values.timezone || null}
                    onChange={(_, value) => setValues({ ...values, timezone: value ?? "" })}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </FormControl>
              </Grid>
            </Grid>
          )}

          {status === "saved" ? (
            <Alert severity="success" className="neutral bg-background-paper/60!">
              {t("settings-member-saved")}
            </Alert>
          ) : null}
          {status === "error" ? (
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {t("settings-member-error")}
            </Alert>
          ) : null}

          <div>
            <Button variant="contained" onClick={() => void save()} disabled={!initial || saving}>
              {t("settings-member-save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Grid>
  );
}
