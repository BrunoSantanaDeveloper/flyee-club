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
