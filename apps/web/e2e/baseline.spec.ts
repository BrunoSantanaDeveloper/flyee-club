import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public home and authentication remain reachable without remote data", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();

  await page.goto("/auth/sign-in");
  await expect(page.locator("body")).toContainText(/entrar|acessar|sign in/i);
});

test("public pages answer in the language of their address", async ({ page, request }) => {
  await page.goto("/en/pricing");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/pricing$/);
  await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute("href", /\/planos$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/planos$/);

  // A public page is shared with the site's social card. A page that states its
  // own Open Graph fields drops the image the root route contributes unless
  // publicPageMetadata names it again, and nothing else shows that it is gone.
  const card = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(card).toMatch(/\/opengraph-image/);
  const cardImage = await request.get(new URL(card ?? "", "http://localhost").pathname);
  expect(cardImage.headers()["content-type"]).toContain("image/png");

  // Reading a public page in English carries the language into sign-in,
  // which has no locale in its address.
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.goto("/planos");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/pricing$/);

  // The switch leads to the same page in the other language.
  await page
    .locator("footer")
    .getByRole("link", { name: /ver esta página em inglês/i })
    .click();
  await expect(page).toHaveURL(/\/en\/pricing$/);

  // Every non-canonical address redirects to the canonical one.
  for (const [from, to] of [
    ["/pt-BR/planos", "/planos"],
    ["/pt-BR", "/"],
    ["/en/planos", "/en/pricing"],
    ["/pricing", "/en/pricing"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBeGreaterThanOrEqual(300);
    expect(response.status(), from).toBeLessThan(400);
    expect(new URL(response.headers().location, "http://localhost").pathname, from).toBe(to);
  }

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/pricing");
  expect(sitemap).toContain('hreflang="x-default"');
});

test.describe("a browser that reads the other language", () => {
  // The suite's own browser announces itself as headless, which the site
  // treats as a crawler: this is an ordinary browser set to English.
  test.use({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });

  test("is offered that language without the page moving, until it answers", async ({ page }) => {
    await page.goto("/planos");
    const offer = page.getByText("This page is also available in English.");
    await expect(offer).toBeVisible();

    // The bar sits above the header. It is decided from <head>, before the
    // first paint: shown after hydration it pushed the whole page down.
    const shifted = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
              if (!entry.hadRecentInput) total += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => resolve(total), 1500);
        }),
    );
    expect(shifted).toBeLessThan(0.05);

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(offer).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(offer).toBeHidden();
  });
});

test("the waitlist is the primary action until the site opens", async ({ page }) => {
  // Without a readable launch stage the site stays in the waitlist stage.
  await page.goto("/");
  await expect(page.locator("footer").getByRole("link", { name: /entrar na lista de espera/i })).toHaveAttribute(
    "href",
    "/espera",
  );

  await page.goto("/espera");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/lista de espera/i);
  const submit = page.getByRole("button", { name: /entrar na lista de espera/i });

  await submit.click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();

  await page.getByLabel("Seu e-mail").fill("pessoa@example.com");
  await submit.click();
  await expect(page.getByText("Marque a caixa para que possamos enviar o aviso.")).toBeVisible();

  // No database in this run: the form says so instead of promising an e-mail.
  await page.getByRole("checkbox").check();
  await submit.click();
  await expect(page.getByText(/a lista de espera está fora do ar agora/i)).toBeVisible();

  await page.goto("/en/waitlist");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/waitlist/i);
});

test("the confirmation link never leaves its token in the address", async ({ page }) => {
  await page.goto(`/espera/confirmar?t=${"a".repeat(43)}`);
  await expect(page).toHaveURL(/\/espera\/confirmar$/);
  const confirm = page.getByRole("button", { name: /confirmar inscrição/i });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page.getByText(/a lista de espera está fora do ar agora/i)).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/espera/confirmar");
  await expect(page.getByText("Este link expirou ou já foi usado.")).toBeVisible();
});

test("an unsubscribe link asks before acting and never leaves its token in the address", async ({ page, request }) => {
  const token = "0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b";

  // A member's link: the weekly summary, in Portuguese.
  await page.goto(`/api/public/email/unsubscribe?k=m&t=${token}`);
  await expect(page).toHaveURL(/\/descadastro$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Parar de receber as novidades?");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const stop = page.getByRole("button", { name: "Parar de receber" });
  await expect(stop).toBeVisible();
  // No database in this run: the page says it could not, instead of claiming it did.
  await stop.click();
  await expect(page.getByText("Não foi possível concluir agora. Tente de novo em instantes.")).toBeVisible();

  // A contact of the list, reading English: its own words, at the English address.
  await page.goto(`/api/public/email/unsubscribe?k=l&t=${token}&l=en`);
  await expect(page).toHaveURL(/\/en\/unsubscribe$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Leave the FlyeeClub list?");
  await expect(page.getByRole("button", { name: "Leave the list" })).toBeVisible();

  // A link that is not one of ours arms nothing, and disarms what was there.
  await page.goto("/api/public/email/unsubscribe?k=m&t=not-a-token");
  await expect(page).toHaveURL(/\/descadastro$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Este link expirou");
  await expect(page.getByRole("button", { name: "Parar de receber" })).toHaveCount(0);

  // The one-click post of a mail client answers by itself, never through sign-in.
  const malformed = await request.post("/api/public/email/unsubscribe?k=m&t=not-a-token", { maxRedirects: 0 });
  expect(malformed.status()).toBe(400);
  const oneClick = await request.post(`/api/public/email/unsubscribe?k=m&t=${token}`, {
    maxRedirects: 0,
    form: { "List-Unsubscribe": "One-Click" },
  });
  // 503 here because this run has no database; with one it is 200.
  expect(oneClick.status()).toBe(503);
  expect(await oneClick.json()).toEqual({ error: "unavailable" });
});

test("legal pages render the terms in force or say they cannot", async ({ page }) => {
  for (const route of ["/legal/termos", "/en/legal/terms", "/legal/privacidade", "/legal/cookies"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // No database in this run: never another text dressed as the terms.
    await expect(page.locator("main")).toContainText(/não conseguimos carregar|couldn't load/i);
  }
});

test("the site menu leads to the store, how it works and pricing in the language being read", async ({ page }) => {
  const sites = [
    {
      home: "/",
      menu: { Apps: "/catalogo", "Como funciona": "/como-funciona", Preços: "/planos" },
      footer: { Apps: "/catalogo", Sobre: "/sobre", "Lista de espera": "/espera" },
    },
    {
      home: "/en",
      menu: { Apps: "/en/catalog", "How it works": "/en/how-it-works", Pricing: "/en/pricing" },
      footer: { Apps: "/en/catalog", About: "/en/about", Waitlist: "/en/waitlist" },
    },
  ];
  for (const site of sites) {
    await page.goto(site.home);
    // The footer first: an open drawer hides the rest of the page from assistive technology.
    for (const [name, href] of Object.entries(site.footer)) {
      await expect(page.locator("footer").getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
    // Below the md breakpoint the menu lives in the drawer.
    const opener = page.getByRole("button", { name: /abrir menu|open menu/i });
    const narrow = await opener.isVisible();
    if (narrow) await opener.click();
    const menu = narrow ? page.locator(".MuiDrawer-paper") : page.locator("header nav");
    for (const [name, href] of Object.entries(site.menu)) {
      await expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
  }
});

test("how it works, the app store and about render in both languages without remote data", async ({
  page,
  request,
}) => {
  for (const [route, lang] of [
    ["/como-funciona", "pt-BR"],
    ["/en/how-it-works", "en"],
    ["/sobre", "pt-BR"],
    ["/en/about", "en"],
  ]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).not.toContainText(/MISSING_MESSAGE|\[object Object\]|undefined/);
  }

  // No database in this run: the store says it could not load, never an empty shelf.
  for (const route of ["/catalogo", "/en/catalog", "/catalogo/deploy-check", "/en/catalog/deploy-check"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 }), route).toHaveText(
      /a loja não carregou agora|the store did not load right now/i,
    );
  }

  // An address that cannot name an app answers a real 404, not a page saying so with a 200.
  const unknown = await request.get("/catalogo/Not_An_App");
  expect(unknown.status()).toBe(404);
  // And the 404 reads in the language of the address. Next builds that page in
  // the browser, where the script that lifts the loader overlay never runs.
  await page.goto("/en/catalog/Not_An_App");
  await expect(page.locator("#initial-loader")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/en");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/como-funciona", "/en/how-it-works", "/catalogo", "/en/catalog", "/sobre", "/en/about"]) {
    expect(sitemap, path).toContain(`${path}<`);
  }
  // The funnel pages stay out of the index.
  expect(sitemap).not.toContain("/fundadores");
  expect(sitemap).not.toContain("/en/founders");
});

test("the founders page stays out of search and explains a closed offer", async ({ page }) => {
  for (const route of ["/fundadores", "/en/founders"]) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // No database in this run: the offer reads as not open, never as open with made-up seats.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /a oferta de fundador não está aberta|the founders offer is not open/i,
    );
    // A funnel page carries no site menu.
    await expect(page.locator("header nav")).toHaveCount(0);
  }
});

test("protected product routes preserve the intended destination through authentication", async ({ page }) => {
  for (const route of [
    "/inicio",
    "/modulos",
    "/receitas",
    "/novidades",
    "/encontros",
    "/roadmap",
    "/settings",
    "/settings/billing",
    "/settings/security",
    "/settings/devices",
    "/onboarding",
    "/ativar",
    "/revalidar",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/auth/sign-in\\?next=${encodeURIComponent(route)}`));
    await expect(page.getByRole("heading", { name: /entrar|sign in/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /relation .* does not exist|postgres|\[object Object\]|undefined/i,
    );
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the CLI endpoints answer on their own, never through the sign-in redirect", async ({ request, page }) => {
  // Public by contract (docs/CLI-CONTRACT.md): no session, no redirect.
  const version = await request.get("/api/cli/version");
  expect(version.status()).toBe(200);
  expect(await version.json()).toMatchObject({ min_cli_version: expect.any(String) });

  const schema = await request.get("/api/cli/schema/module");
  expect(schema.status()).toBe(200);
  expect((await schema.json()).properties).toHaveProperty("manifest_version");

  const discovery = await (await request.get("/.well-known/oauth-authorization-server")).json();
  expect(discovery.device_authorization_endpoint).toMatch(/\/api\/oauth\/device$/);
  expect(discovery.revocation_endpoint).toMatch(/\/api\/oauth\/revoke$/);
  expect(discovery).not.toHaveProperty("registration_endpoint");

  // A gated endpoint answers the CLI in JSON: a refusal, not an HTML page.
  const me = await request.get("/api/cli/me", { maxRedirects: 0 });
  expect([401, 503]).toContain(me.status());
  expect(await me.json()).toHaveProperty("error");

  const token = await request.post("/api/oauth/token", { form: { grant_type: "refresh_token" }, maxRedirects: 0 });
  expect(token.status()).toBe(401);
  expect((await token.json()).error).toBe("invalid_client");

  // The public checksum page renders, and says so when the catalog cannot answer.
  await page.goto("/verificar/deploy-check%401.2.0");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("@a11y core entry and product routes have no critical axe violations", async ({ page }) => {
  for (const route of [
    "/auth/sign-in",
    "/auth/sign-up",
    "/auth/password-reset",
    "/",
    "/planos",
    "/en",
    "/en/pricing",
    "/espera",
    "/como-funciona",
    "/en/how-it-works",
    "/catalogo",
    "/sobre",
    "/fundadores",
    "/descadastro",
    "/legal/termos",
    "/inicio",
    "/settings/billing",
    "/settings/security",
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical, `Critical accessibility violations at ${route}`).toEqual([]);
  }
});
