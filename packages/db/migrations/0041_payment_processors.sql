-- ============================================================
-- 0041_payment_processors: the terms of use say who processes a purchase
-- without tying reais to Asaas (2026-10-12).
--
-- Stripe charges reais too until Asaas is set up (`BILLING_BRL_PROVIDER`,
-- docs/BILLING.md), and later only dollars. The terms in force said "reais by
-- Asaas, dollars by Stripe" and promised card installments in reais, which
-- Stripe does not offer in Brazil. The new text names both processors, leaves
-- the method and the split to what the payment page offers, and keeps every
-- other word: the same text serves both arrangements, so moving reais back to
-- Asaas needs no new version.
--
-- A published text never changes in place (guard_consent_term_text, migration
-- 0001): the version in force in each language is switched off and kept on
-- record, and the next one is built from it by one exact replacement, checked,
-- so no other word can drift (the method of migration 0035).
-- ============================================================

do $$
declare
  edit record;
  source record;
  next_body text;
begin
  for edit in
    select * from (values
      ('pt-BR',
       'As compras em reais são processadas pela Asaas (PIX ou cartão) e as compras em dólares pela Stripe (cartão). O FlyeeClub pode ser pago à vista ou parcelado no cartão, em reais; parcelado, ele continua sendo uma única compra, dividida em parcelas, e o prazo de 1 ano conta da confirmação do pagamento.',
       'As compras são processadas pela Stripe ou pela Asaas; a página de pagamento indica qual delas processa cada compra e as formas de pagamento disponíveis, como cartão e PIX. O FlyeeClub pode ser pago à vista e, em reais, também parcelado no cartão quando a página de pagamento oferecer o parcelamento; parcelado, ele continua sendo uma única compra, dividida em parcelas, e o prazo de 1 ano conta da confirmação do pagamento.'),
      ('en',
       'Purchases in Brazilian reais are processed by Asaas (PIX or card) and purchases in US dollars by Stripe (card). In reais, FlyeeClub may be paid at once or in card installments; split, it is still a single purchase, divided into installments, and the 1-year term counts from the confirmation of the payment.',
       'Purchases are processed by Stripe or by Asaas; the payment page shows which one processes each purchase and the payment methods available, such as card and PIX. FlyeeClub may be paid at once and, in Brazilian reais, also in card installments when the payment page offers them; split, it is still a single purchase, divided into installments, and the 1-year term counts from the confirmation of the payment.')
    ) as e(locale, old_text, new_text)
  loop
    select version, title, body_md into source
    from public.consent_terms
    where slug = 'terms' and locale = edit.locale and is_active;
    if not found then
      raise exception 'terms (%) has no version in force', edit.locale;
    end if;

    next_body := replace(source.body_md, edit.old_text, edit.new_text);
    if next_body = source.body_md or position(edit.new_text in next_body) = 0 then
      raise exception 'terms (%) version % did not take the replacement', edit.locale, source.version;
    end if;

    update public.consent_terms
    set is_active = false
    where slug = 'terms' and locale = edit.locale and version = source.version and is_active;

    insert into public.consent_terms (slug, locale, version, title, body_md, is_active)
    values ('terms', edit.locale, source.version + 1, source.title, next_body, true);
  end loop;
end;
$$;
