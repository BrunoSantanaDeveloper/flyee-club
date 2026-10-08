# Design direction (committed) — the flyee.club look

**This file is the single source of the public site's visual direction.** The `marketing-page` skill READS it and builds within it. Every new page, every edit and every added section inherits these decisions so the whole site reads as one system.

**Status (2026-10-08): the logo, the typography and the palette are the brand's.** On 2026-10-01 the user delivered the official logo (`apps/web/public/brand/`, drawn by `components/logo/logo.tsx`) and set the brand type (Londrina Solid for headings and display, JetBrains Mono for commands, Mulish for text); the template's orange palette stood in for a week. On 2026-10-08 the user replaced the orange and its derived tones with the yellow of the logo (`theme-yellow`, `packages/design-tokens/css/yellow.css`) and asked for the contrast of WCAG 2.2 AA the home brief requires (`docs/PRODUCT.md`, "Contraste e paleta"). A change of direction is still a "redesign", asked for by the user, which rewrites this file first; pages follow.

## STRICT MODE — how this governs work

- **New page** → inherit everything below. Do NOT re-run the direction engine.
- **Edit an existing page** → follow this file; do not restyle.
- **Add or change a section** → the new section obeys this file AND you run a **whole-page coherence pass**: every existing section must stay aesthetically aligned with the new one and pass the premium bar.
- **Redesign** (changing the direction itself) happens ONLY when the user explicitly asks ("redesign" / "nova direção").

**One design system.** Every public page, campaign pages in `app/(funil)/` included, composes the marketing library (`components/marketing/*`, catalog in `components/marketing/catalog.json`). There is no second stylesheet vocabulary.

---

## Committed direction — "Ferramenta bem cuidada" (well-kept tool)

| Field | Decision |
|---|---|
| **Direction** | Operational precision with warmth: a well-run developer tool, calm and exact, technical without being cold. |
| **Why** | The buyer installs a harness in their own terminal and pays for the updates that keep it working. Trust comes from showing the mechanism honestly (versions, changelog, checksum, declared permissions) and from a concrete catalog. The site must feel like a tool that is maintained, never like a course landing page made of promises. |
| **Display type** | **Londrina Solid** (`--font-heading`, loaded in the root layout; `font-display` falls back to it), the face of the "flyeeclub" lettermark. The family ships Regular (400) and Black (900) and nothing between them, so every class from `font-semibold` up renders Black. **Black is the display weight**: `text-display-*` and any heading from 24px up (`font-bold`; `font-extrabold` on the hero), `tracking -0.02em` on the display scale. **Regular is the weight of every heading below 24px** (`font-normal`): Black closes up at those sizes, and Regular is already a heavy face. `marketing-lint` flags a small heading in a heavy weight (`[heading-weight]`); the dashboard gets the same split from `style/data-display/typography.css` (MUI `h1`/`h2` Black, `h3`–`h6` Regular). |
| **Body type** | Mulish (`--font-body`), 16–18px, line-height 1.6. Commands, versions and file names use `font-mono`: JetBrains Mono (`--font-mono`), with the system mono face while the file loads. |
| **Palette usage** | The tokens of `theme-yellow`: the primary is the yellow of the logo (`#ffcc12`), the secondary a dark gold drawn from it; the accents are pink, magenta, violet and blue. Light-first over the warm neutral ground, dark mode through the same tokens. **Primary** carries CTAs and the single bold moment per page. **Secondary** is the warmth layer: editorial accents, sparingly. Categorical meaning is fixed site-wide: the seven trails map Planejar/Construir → `accent-2`, Publicar/Divulgar → `accent-1`, Vender/Escalar → `accent-4`, Manter → `accent-3`; plan tiers map kit → `accent-2`, assinatura → `primary`, Pro → `accent-4`. **The yellow is a fill, never a foreground on a light ground** (measured 2026-10-08): as text it measures 1.5:1 on white and 1.4:1 on the page, against the 4.5:1 of WCAG AA (3:1 for large text, icons and focus rings), and a white label on it 1.5:1. So the palette carries two more tokens. `--primary-contrast` is the label or icon ON a primary fill: the charcoal of the logo, 8.7:1 (`text-primary-contrast`; a contained button, a selected toggle, a badge). `--primary-ink` is the primary as a foreground on the page: the charcoal on a light ground (13.2:1) and the yellow itself on a dark one (10.7:1), for text, links, icons, focus rings and checked controls (`text-primary-ink`, `ring-primary-ink`). What follows from it on a page: an **eyebrow** is words in a text colour after a yellow bar (`<Eyebrow>`); the **accent phrase of a headline** (`<em>` under `site-emphasis`) is a yellow highlighter stroke under words that keep the text colour in light mode, and yellow words in dark mode, as in the logo; a **link** is the ink, underlined in its own colour (a yellow underline would not show); a **tint** of the primary is at least `/20` (a 10% tint of this yellow is invisible on paper); a border that marks a **selected state** is the ink, a border that only decorates (the featured plan) may be the yellow. **The deep band** (the footer, `background="deep"`, every terminal body, the command block) is `--background-deep`, a neutral equal to the charcoal of the logo tile: it does not follow the primary, so it stays dark under any palette; on it the logo is the dark-surface file and the accent is the yellow itself (`text-primary`, 8.7:1), in both modes. The accents fall short as small text on a light ground (3.4 to 4.5:1 on white), so those hues ride on icons, bars and fills and the words keep text colours: the feature-row eyebrows, the process-step kickers and the ruled-grid links work that way since phase 7.2; the secondary gold measures 5.6:1 and may be text. `lib/palette-contrast.test.ts` holds the palette to these ratios and fails on `text-primary`, `ring-primary` or `outline-primary` outside the dark grounds, and on a white label over a primary fill. **Red is reserved for error and risk.** |
| **Depth treatment** | Crisp: `decor="grid"` on the technical chapters, `decor="glow"` (low alpha) on the hero, exactly one `background="contrast"` band, the background changing at least twice down the page. Generous radii, diffuse shadows. |
| **Layout archetypes** | The home follows the layout of `docs/HOME-COPY.md`: Hero `layout="center"` with the store itself as evidence (`<AppStorePreview>` inside `<ProductFrame glow>`, in a `<ProductComposition>` whose satellites are the real app count and the featured app's install command) and the `strip` of the AIs the apps run on; the featured app in `<FeatureRows>` with the filtered `<StoreGrid>` closing the same chapter. The inner pages lead with Hero `layout="split"` + `<ProductComposition>` (a terminal frame in the centre, chips as satellites). `<FeatureRows>` for the mechanisms (token, checksum, your AI); `<ProcessSteps variant="mono">` for the install flow; `<RuledGrid>` for reasons, principles and requirements, and its cards (`RuledCard`) inside `<StoreGrid>` for the apps (badge + mono version line); `<StatBand>` only with real catalog numbers; `<PricingSection>` for the ladder; ONE breakout per page. Never centred-stack + equal-card-grid all the way down. |
| **Signature element** | **The update moment**: a terminal frame showing `npx flyee update` with a version chip (`1.4 → 1.6`) and one changelog line. It recurs on `/como-funciona`, `/sobre` and the catalog; the home leads with the store and keeps the terminal in the featured app (`npx flyee add`). Its body is the deep band, so it reads as a terminal under any palette. |
| **Imagery** | Real dashboard screenshots through `<ProductShot>` once the member dashboard exists (`npm run shots:marketing -w @flyee/web`). Until then, token-driven `<ProductFrame>`/terminal compositions with fictitious but plausible data (module names from the catalog). Never stock photos, robots, glowing brains, holograms or other AI clichés; AI vendors are named as text in compatibility lists, never used as decorative logos. |
| **Motion** | Crisp and short: one orchestrated hero entrance (the copy rises line by line, then the media, then the satellites pop in); ambient layer ≤2 `<Float>` satellites and `<CountUp>` only on real numbers; quiet `<Reveal>` elsewhere. All reduced-motion safe. **Built in CSS** (measured 2026-10-01 on a throttled phone profile): the entrance is a keyframe animation that starts with the first paint, `<Float>` is a keyframe animation that settles after five cycles, `<Reveal>` is a transition started when the block reaches the viewport and it leaves alone a block already on screen. No scripted timeline, no ScrollTrigger per block, nothing that runs forever; GSAP is loaded only by `<Parallax>`. |

## Premium bar (must all pass before shipping any page)

1. Product evidence above the fold.
2. ≥2 layout archetypes beyond the centred stack.
3. Background changes ≥2× along the scroll.
4. 1440px density check: no viewport >50% empty.
5. One orchestrated motion moment + a runtime scroll pass (no `<Reveal>` left un-fired).
6. Display typography is Londrina Solid Black at the display scale (`font-display text-display-*`), never body-size admin type; headings below 24px are Londrina Solid Regular.
7. Harmonic palette in use: at least two hues beyond primary, mapped per the table above, via the `tone` prop.
8. Show, don't tell: text-heavy sections carry a glance-able visual (meaningful icon, terminal snippet, figure).
9. The hero media is a LAYERED `<ProductComposition>` (≥2 satellite chips) or a real screenshot — never a flat single rectangle.
10. ≥1 breakout / full-bleed moment (`<Band>` or `<Breakout>`).
11. Ambient motion present but restrained, within budget and reduced-motion safe.

## flyee.club copy guardrails (blocking)

- Never say or imply that the club runs AI for the member, spends their credits or "does the work for them": the member uses their own plan or API.
- Never promise compatibility beyond the listed AIs (Claude Code, Codex, Gemini CLI, Cursor), and say plainly that v1 needs a terminal.
- Update claims are only what the catalog shows (versions and changelog are data); never "always up to date" as an absolute.
- Security claims only as declared mechanisms: versioned packages, sha256 checksum, declared permissions, nothing leaves the machine without notice.
- No fabricated metrics, testimonials, logos, member counts or seals. Every number on a page comes from the database (catalog counts, plan prices).
- Prices and limits are data (`plans`); no scarcity anywhere: the founders offer, the one page with seats and a deadline, left on 2026-10-08.
- Bilingual parity: every claim exists in pt-BR and English with the same meaning.
- The banned AI-copy patterns of the `marketing-page` skill apply in both languages.

## Reference ingredients

<!-- marketing-page Pass 0.R writes here when the user drops reference screenshots in attachments/. Structural ingredients only, mapped to library primitives — never copied hex/fonts. -->
_None ingested._

## History

The inherited MedChina direction ("Cuidado Sereno"), its hand-tuned Landing DS (`clinical-source-home.css`) and the commercial TT Chocolates face were retired on 2026-09-30, when this repository became the flyee.club platform. They remain recoverable from the import commit `ab2e84d`.

On 2026-10-01 the placeholder logo (an open ring), Urbanist and the inherited teal palette (`theme-green`) gave way to the official logo, Londrina Solid with JetBrains Mono, and the provisional orange palette. The same change gave the deep band its own token: it used to be the dark primary, which is only dark while the primary is.

On 2026-10-08 the orange gave way to the yellow of the logo, at the user's request, together with the contrast of WCAG 2.2 AA: dark labels on yellow fills, the ink for the primary as a foreground, the highlighter stroke for the accent phrase of a headline. The orange file stays in the tokens package, not loaded.

Width note: `--container-max: 77.5rem` (1240px) in `packages/design-tokens/css/marketing.css` is committed site-wide.
