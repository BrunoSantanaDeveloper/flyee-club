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

test("legal pages render the terms in force or say they cannot", async ({ page }) => {
  for (const route of ["/legal/termos", "/en/legal/terms", "/legal/privacidade", "/legal/cookies"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // No database in this run: never another text dressed as the terms.
    await expect(page.locator("main")).toContainText(/não conseguimos carregar|couldn't load/i);
  }
});

test("protected product routes preserve the intended destination through authentication", async ({ page }) => {
  for (const route of ["/inicio", "/settings", "/settings/billing", "/settings/security"]) {
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
