import Link from "next/link";

import { Alert, Box, Button, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";

/**
 * The standalone chrome of the CLI connection screens (/oauth/authorize,
 * /ativar, /revalidar): no app shell, one card, the logo on top, the same
 * card as the sign-in screens. The member arrives from a terminal with one
 * decision to make, so nothing else competes for attention.
 */
export function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <Box className="bg-waves flex min-h-screen w-full items-center justify-center bg-cover bg-center p-4">
      <Paper elevation={3} className="bg-background-paper shadow-darker-xs w-lg max-w-full rounded-4xl py-12">
        <Box className="flex flex-col gap-5 px-6 sm:px-12">
          <Box className="flex justify-center">
            <Logo classNameFull="h-12 w-auto" classNameMobile="hidden" />
          </Box>
          {children}
        </Box>
      </Paper>
    </Box>
  );
}

/** A dead end that still says what to do next: why it stopped, and the way back. */
export function ConsentError({
  title,
  message,
  backLabel,
  backHref = "/inicio",
}: {
  title: string;
  message: string;
  backLabel: string;
  backHref?: string;
}) {
  return (
    <ConsentShell>
      <Typography variant="h1" component="h1" className="mb-0">
        {title}
      </Typography>
      <Alert severity="warning" className="neutral bg-background-paper/60!">
        {message}
      </Alert>
      <Button color="grey" variant="text" component={Link} href={backHref}>
        {backLabel}
      </Button>
    </ConsentShell>
  );
}
