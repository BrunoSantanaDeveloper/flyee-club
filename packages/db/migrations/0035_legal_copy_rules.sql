-- ============================================================
-- 0035_legal_copy_rules: the English terms of use (version 5) and the
-- English CLI connection term (version 2) without "unlock" (2026-10-07).
--
-- The copy rules of the home brief (decided 2026-10-07, docs/PRODUCT.md)
-- keep the dash, the exclamation mark, emoji and a list of words out of every
-- text a person reads, "unlock" among them. Two texts in force broke them,
-- both in English, both with that verb. A published text never changes in
-- place, so each gets a new version built from the one in force by one exact
-- replacement, checked (the migration fails if it does not land), so no other
-- word can drift. The Portuguese texts did not break the rules and keep their
-- versions. The previous English versions are switched off and kept on record.
-- pgTAP 0033_copy_rules keeps every text in force inside the rules.
-- ============================================================

do $$
declare
  edit record;
  source record;
  next_body text;
begin
  for edit in
    select * from (values
      ('terms', 4,
       'It unlocks the app store and its updates for that term.',
       'It gives access to the app store and its updates for that term.'),
      ('cli-connection', 1,
       'download the tools your plan unlocks',
       'download the tools your plan includes')
    ) as e(slug, version, old_text, new_text)
  loop
    select title, body_md into source
    from public.consent_terms
    where slug = edit.slug and locale = 'en' and version = edit.version and is_active;
    if not found then
      raise exception '% (en) version % is not the text in force', edit.slug, edit.version;
    end if;

    next_body := replace(source.body_md, edit.old_text, edit.new_text);
    if next_body = source.body_md or position(edit.new_text in next_body) = 0 then
      raise exception '% (en) did not take the replacement', edit.slug;
    end if;

    update public.consent_terms
    set is_active = false
    where slug = edit.slug and locale = 'en' and version = edit.version and is_active;

    insert into public.consent_terms (slug, locale, version, title, body_md, is_active)
    values (edit.slug, 'en', edit.version + 1, source.title, next_body, true);
  end loop;
end;
$$;
