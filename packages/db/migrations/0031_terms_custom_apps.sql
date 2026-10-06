-- ============================================================
-- 0031_terms_custom_apps: terms of use, version 4 (2026-10-06).
--
-- The home brief promises that an app someone commissions "enters the store
-- for everyone" once it is ready. Decided (option 2): public by default,
-- unless an exclusivity agreement is made through the contact channels before
-- the work is hired. Whoever commissions an app must read that before paying,
-- so the terms say it, next to the other services sold on demand.
--
-- Version 4 is built from version 3 by one exact replacement, checked (the
-- migration fails if it does not land), so no other word of the published
-- text can drift. Version 3 is switched off and kept on record.
-- ============================================================

do $$
declare
  source record;
  next_body text;
  anchor text;
  addition text;
begin
  for source in
    select locale, title, body_md from public.consent_terms
    where slug = 'terms' and version = 3
    order by locale
  loop
    if source.locale = 'pt-BR' then
      anchor := 'Mentoria e consultoria são serviços contratados à parte, sob demanda, com escopo e preço combinados pelos canais de contato. Eles não fazem parte de nenhum plano.';
      addition := 'Um app desenvolvido sob demanda, a pedido de um integrante, entra na loja para todos os integrantes quando fica pronto, salvo acordo de exclusividade combinado por escrito pelos canais de contato antes da contratação.';
    else
      anchor := 'Mentoring and consulting are services booked separately, on demand, with a scope and a price agreed through the contact channels. They are not part of any plan.';
      addition := 'An app built on demand, at a member''s request, joins the store for every member once it is ready, unless an exclusivity agreement is made in writing through the contact channels before the work is hired.';
    end if;

    next_body := replace(source.body_md, anchor, anchor || E'\n\n' || addition);
    if next_body = source.body_md or position(addition in next_body) = 0 then
      raise exception 'terms of use (%) did not take the version 4 clause', source.locale;
    end if;

    update public.consent_terms
    set is_active = false
    where slug = 'terms' and locale = source.locale and version = 3 and is_active;

    insert into public.consent_terms (slug, locale, version, title, body_md, is_active)
    values ('terms', source.locale, 4, source.title, next_body, true);
  end loop;

  if (select count(*) from public.consent_terms where slug = 'terms' and version = 4) <> 2 then
    raise exception 'expected version 4 of the terms of use in both languages';
  end if;
end;
$$;
