"use client";

import AiPricesAdmin from "./components/ai-prices-admin";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Box, Breadcrumbs, Card, CardContent, Grid, Typography } from "@mui/material";

import InfoHint from "@/components/product/info-hint";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Superadmin console for what the operator's AI costs (RLS is the real gate).
 *
 * The club never spends AI on a member's behalf; the only AI calls the
 * platform makes are the operator's own `/admin/insights` questions, priced
 * here so the console can say what they cost. Phase 6 of
 * docs/PLANO-IMPLEMENTACAO.md moves this price book into `/admin/insights`.
 */
export default function AdminAi() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!isSupabaseConfigured) {
        setAllowed(false);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
      setAllowed(Boolean(data?.is_superadmin));
    };
    check();
  }, []);

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <Typography variant="h1" component="h1" className="mb-0">
          Custo de IA
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/inicio">
            Início
          </Link>
          <Typography variant="body2">Admin</Typography>
          <Typography variant="body2">IA</Typography>
        </Breadcrumbs>
      </Grid>

      {allowed === false && (
        <Grid size={12}>
          <Alert severity="error" className="neutral bg-background-paper/60!">
            Esta área é restrita aos superadmins da plataforma.
          </Alert>
        </Grid>
      )}

      {allowed && (
        <Grid size={12}>
          <Card component="section">
            <CardContent className="flex flex-col gap-3">
              <Box className="flex flex-row items-center gap-1">
                <Typography variant="h6" component="h2" className="mb-0">
                  Custo dos modelos
                </Typography>
                <InfoHint
                  label="Quanto cada modelo cobra por milhão de tokens, na moeda da tabela do provedor (dólar, no caso dos nossos). Um modelo sem preço entra no livro como sem preço, e os consoles dizem quantas são."
                  placement="bottom-start"
                  className="self-center"
                />
              </Box>
              <AiPricesAdmin />
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
