-- ============================================================
-- 0027_legal_texts_v3: the privacy and cookie policies, version 3 (2026-10-06).
--
--   - Cookie policy: a new essential cookie, the segment a visitor declares on
--     the site (a `?segment=` link or a click), kept up to 90 days to pre-fill
--     the sign-up; and the analytics paragraph says the trackers also measure
--     clicks on the pages (the site events of docs/TRACKING.md).
--   - Privacy policy: the platform's name, FlyeeClub (migration 0025 renamed
--     the plans and the terms of use; this text still said flyee.club). The
--     substance is unchanged.
--
-- Neither change needs consent, so the cookie notice is not shown again.
-- A published text never changes (guard_consent_term_text, migration 0001):
-- version 3 is built from version 2 by exact replacements, each checked, so
-- nothing else in the text can drift; version 2 is switched off.
-- ============================================================

do $$
declare
  source record;
  next_body text;
begin
  for source in
    select slug, locale, title, body_md from public.consent_terms
    where slug in ('privacy', 'cookies') and version = 2
    order by slug, locale
  loop
    next_body := source.body_md;

    if source.slug = 'cookies' and source.locale = 'pt-BR' then
      next_body := replace(
        next_body,
        '- **Cupom e origem**: guardam o cupom e a campanha do link pelo qual você chegou, para que continuem valendo até a compra.',
        '- **Cupom e origem**: guardam o cupom e a campanha do link pelo qual você chegou, para que continuem valendo até a compra.' || E'\n' ||
        '- **Segmento**: guarda o público que você escolheu no site (por um link ou um clique), por até 90 dias, para preencher o seu cadastro.'
      );
      next_body := replace(next_body, 'para medir visitas, o uso do painel', 'para medir visitas, os cliques nas páginas, o uso do painel');
    elsif source.slug = 'cookies' and source.locale = 'en' then
      next_body := replace(
        next_body,
        '- **Coupon and origin**: remember the coupon and the campaign of the link you arrived through, so they still apply at purchase.',
        '- **Coupon and origin**: remember the coupon and the campaign of the link you arrived through, so they still apply at purchase.' || E'\n' ||
        '- **Segment**: remembers the audience you chose on the site (through a link or a click), for up to 90 days, to fill in your sign-up.'
      );
      next_body := replace(next_body, 'to measure visits, dashboard use', 'to measure visits, clicks on the pages, dashboard use');
    elsif source.slug = 'privacy' then
      next_body := replace(next_body, 'flyee.club', 'FlyeeClub');
    end if;

    -- Every replacement must land: a text that did not change means the source
    -- moved under this migration, and publishing it would be a silent no-op.
    if next_body = source.body_md
       or (source.slug = 'cookies' and next_body not like '%' || case when source.locale = 'en' then 'clicks on the pages' else 'cliques nas páginas' end || '%')
       or (source.slug = 'cookies' and next_body not like '%' || case when source.locale = 'en' then '**Segment**' else '**Segmento**' end || '%')
       or (source.slug = 'privacy' and next_body like '%flyee.club%') then
      raise exception 'legal text % (%) did not take the version 3 changes', source.slug, source.locale;
    end if;

    update public.consent_terms
    set is_active = false
    where slug = source.slug and locale = source.locale and version = 2 and is_active;

    insert into public.consent_terms (slug, locale, version, title, body_md, is_active)
    values (source.slug, source.locale, 3, source.title, next_body, true);
  end loop;

  if (select count(*) from public.consent_terms where slug in ('privacy', 'cookies') and version = 3) <> 4 then
    raise exception 'expected version 3 of the privacy and cookie policies in both languages';
  end if;
end;
$$;
