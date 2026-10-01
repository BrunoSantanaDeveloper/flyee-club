# Design direction (committed, PROVISIONAL) — the flyee.club marketing look

**This file is the single source of the public site's visual direction.** The `marketing-page` skill READS it and builds within it. Every new page, every edit and every added section inherits these decisions so the whole site reads as one system.

**Status (2026-10-01): provisional.** The user decided on 2026-09-30 that the brand is provisional: placeholder logo (`components/logo/logo.tsx`), the current token palette and Urbanist as the display face (`docs/PRODUCT.md`, "Decisões tomadas 2026-09-30"). When the definitive brand exists, the user asks for a "redesign", which rewrites this file first; pages follow.

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
| **Display type** | **Urbanist** (`--font-heading`, already loaded in the root layout; `font-display` falls back to it), weights 700/800 at the fluid display scale, `tracking -0.02em`. Provisional: a licensed display face replaces it with the definitive brand. |
| **Body type** | Mulish (`--font-body`), 16–18px, line-height 1.6. Commands, versions and file names use `font-mono` (system mono stack). |
| **Palette usage** | The current tokens (`theme-green`), light-first over the warm neutral ground, dark mode through the same tokens. **Primary** carries CTAs and the single bold moment per page. **Secondary** is the warmth layer: eyebrows and editorial accents, sparingly. Categorical meaning is fixed site-wide: the seven trails map Planejar/Construir → `accent-2`, Publicar/Divulgar → `accent-1`, Vender/Escalar → `accent-4`, Manter → `accent-3`; plan tiers map kit → `accent-2`, assinatura → `primary`, Pro → `accent-4`. **Red is reserved for error and risk.** |
| **Depth treatment** | Crisp: `decor="grid"` on the technical chapters, `decor="glow"` (low alpha) on the hero, exactly one `background="contrast"` band, the background changing at least twice down the page. Generous radii, diffuse shadows. |
| **Layout archetypes** | Hero `layout="split"` + `<ProductComposition>` (a terminal frame in the centre, module tiles and version chips as satellites); `<BentoGrid>` for the seven trails; `<FeatureRows>` for "atualização como produto" and for security; `<ProcessSteps variant="mono">` for the install flow; `<StatBand>` only with real catalog numbers; `<PricingSection>` for the ladder; ONE breakout per page. Never centred-stack + equal-card-grid all the way down. |
| **Signature element** | **The update moment**: a terminal frame showing `npx flyee update` with a version chip (`1.4 → 1.6`) and one changelog line. It recurs on the home hero, `/como-funciona` and the catalog, and echoes the logo (the open ring = continuous update). |
| **Imagery** | Real dashboard screenshots through `<ProductShot>` once the member dashboard exists (`npm run shots:marketing -w @flyee/web`). Until then, token-driven `<ProductFrame>`/terminal compositions with fictitious but plausible data (module names from the catalog). Never stock photos, robots, glowing brains, holograms or other AI clichés; AI vendors are named as text in compatibility lists, never used as decorative logos. |
| **Motion** | Crisp and short: one orchestrated hero timeline (terminal lines appear → tiles rise → the version chip flips); ambient layer ≤2 `<Float>` satellites and `<CountUp>` only on real numbers; quiet `<Reveal>` elsewhere. All reduced-motion safe. |

## Premium bar (must all pass before shipping any page)

1. Product evidence above the fold.
2. ≥2 layout archetypes beyond the centred stack.
3. Background changes ≥2× along the scroll.
4. 1440px density check: no viewport >50% empty.
5. One orchestrated motion moment + a runtime scroll pass (no `<Reveal>` left un-fired).
6. Display typography is Urbanist at the display scale (`font-display text-display-*`) — the provisional display face — never body-size admin type.
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
- Prices and limits are data (`plans`); scarcity only from `founders_offer()`.
- Bilingual parity: every claim exists in pt-BR and English with the same meaning.
- The banned AI-copy patterns of the `marketing-page` skill apply in both languages.

## Reference ingredients

<!-- marketing-page Pass 0.R writes here when the user drops reference screenshots in attachments/. Structural ingredients only, mapped to library primitives — never copied hex/fonts. -->
_None ingested._

## History

The inherited MedChina direction ("Cuidado Sereno"), its hand-tuned Landing DS (`clinical-source-home.css`) and the commercial TT Chocolates face were retired on 2026-09-30, when this repository became the flyee.club platform. They remain recoverable from the import commit `ab2e84d`.

Width note: `--container-max: 77.5rem` (1240px) in `packages/design-tokens/css/marketing.css` is committed site-wide.
