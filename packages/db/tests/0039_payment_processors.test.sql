begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ============================================================
-- Terms of use after migration 0041: both processors are named, reais are no
-- longer tied to Asaas, the split is what the payment page offers, and every
-- other word is the previous version's.
-- ============================================================

select ok(
  (select body_md like '%processadas pela Stripe ou pela Asaas%'
      and body_md like '%quando a página de pagamento oferecer o parcelamento%'
      and body_md not like '%compras em reais são processadas pela Asaas%'
   from public.consent_terms where slug = 'terms' and locale = 'pt-BR' and is_active),
  'the Portuguese terms in force name both processors and no longer route reais to Asaas'
);
select ok(
  (select body_md like '%processed by Stripe or by Asaas%'
      and body_md like '%when the payment page offers them%'
      and body_md not like '%reais are processed by Asaas%'
   from public.consent_terms where slug = 'terms' and locale = 'en' and is_active),
  'and so do the English ones'
);
select is(
  (select count(*)::int
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = n.version - 1
   where n.slug = 'terms' and n.is_active and not o.is_active
     and o.body_md like '%Asaas (PIX%'
     and length(n.body_md) - length(o.body_md) between 100 and 400),
  2,
  'the previous version stays on record in each language, switched off, and only the payment paragraph grew'
);
select is(
  (select count(*)::int
   from public.consent_terms n
   join public.consent_terms o on o.slug = n.slug and o.locale = n.locale and o.version = n.version - 1
   where n.slug = 'terms' and n.is_active
     and split_part(n.body_md, '## 7.', 1) = split_part(o.body_md, '## 7.', 1)
     and split_part(n.body_md, '## 8.', 2) = split_part(o.body_md, '## 8.', 2)),
  2,
  'the sections before and after the payment section are word for word the previous version'
);

select * from finish();
rollback;
