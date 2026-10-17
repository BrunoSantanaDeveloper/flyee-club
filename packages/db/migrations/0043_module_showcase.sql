-- ============================================================
-- 0043_module_showcase: each app carries its own example of answering a
-- request (2026-10-17).
--
-- The store shows what an app RETURNS, not the command that installs it
-- (decided 2026-10-17): the home, /catalogo and each app's page show the app
-- answering a request (<AppShowcase>). The one example there was lived in the
-- home's copy, for the featured app alone. It is data of the app now, written
-- by the product and sent in its index with the name and the summary
-- (docs/CLI-CONTRACT.md, 10.1), per language:
--
--   { "pt-BR": { "request": …, "reply": [{ "label"?: …, "text": … }], "saved"?: … },
--     "en": { … } }
--
-- The import checks the shape, the lengths and the copy rules
-- (apps/web/src/lib/catalog/showcase.ts); the column only insists on an
-- object. anon and authenticated read it through the table grants of 0008, as
-- they read the name and the summary.
--
-- The example the home carried moves to its app, so the home keeps showing it
-- until the product sends one of its own: written only where the app exists
-- and has none.
-- ============================================================

alter table public.catalog_modules
  add column showcase jsonb not null default '{}'::jsonb
  constraint catalog_modules_showcase_object check (jsonb_typeof(showcase) = 'object');

comment on column public.catalog_modules.showcase is
  'The example of the app answering a request, per language ({"pt-BR": {request, reply: [{label?, text}], saved?}, "en": …}), shown by the store instead of an install command. Sent by the product''s index; checked by the import (0043).';

update public.catalog_modules
set showcase = $json$
{
  "pt-BR": {
    "request": "Quero gravar um vídeo de uns 10 minutos sobre como montar a marmita da semana sem enjoar. Me ajuda com o roteiro?",
    "reply": [
      { "label": "Título", "text": "Marmita da semana em 1 hora, sem repetir prato" },
      { "label": "Gancho · 0:00", "text": "Na quarta você já não aguenta a mesma comida. O problema não é a receita, é a ordem do preparo." },
      { "label": "Bloco 1 · 0:30", "text": "Cinco bases que viram dez pratos diferentes" },
      { "label": "Bloco 2 · 3:00", "text": "A ordem do preparo para caber em uma hora" },
      { "label": "Bloco 3 · 6:30", "text": "Como guardar para durar até sexta" },
      { "label": "Fechamento · 9:10", "text": "O que testar na primeira semana" }
    ],
    "saved": "Salvo em roteiros/marmita-da-semana/estrutura.md"
  },
  "en": {
    "request": "I want to record a video of about 10 minutes on how to prep a week of lunches without getting tired of them. Can you help with the script?",
    "reply": [
      { "label": "Title", "text": "A week of lunches in 1 hour, no repeats" },
      { "label": "Hook · 0:00", "text": "By Wednesday you can't face the same food again. The problem isn't the recipe, it's the order you cook in." },
      { "label": "Block 1 · 0:30", "text": "Five bases that turn into ten different dishes" },
      { "label": "Block 2 · 3:00", "text": "The cooking order that fits in one hour" },
      { "label": "Block 3 · 6:30", "text": "How to store it so it lasts until Friday" },
      { "label": "Close · 9:10", "text": "What to try in your first week" }
    ],
    "saved": "Saved to roteiros/meal-prep-week/estrutura.md"
  }
}
$json$::jsonb
where slug = 'youtube-script' and showcase = '{}'::jsonb;
