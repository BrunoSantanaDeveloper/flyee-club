-- ============================================================
-- 0019_launch: the public site before and after it opens.
--
-- `launch` says what the public site offers. With `stage = waitlist` (the
-- seed) every primary call to action leads to the waitlist (/espera), because
-- there is nothing to buy yet: sending a visitor to sign-up or to a checkout
-- would open an empty account or a payment for something that does not exist.
-- With `stage = open` the same buttons lead to sign-up and checkout. The
-- superadmin flips it at /admin/support; sign-in and sign-up stay reachable in
-- both stages (the operator's own account is created through them).
--
-- `legal_entity` is the company that operates flyee.club: name, CNPJ and
-- city, rendered in the site footer. The terms and the privacy policy seeded
-- in 0018 say the operator is "identified in the site footer", so the footer
-- must carry it before the site opens; it ships empty until the operator
-- fills it in at /admin/support.
--
-- Both are public (read by the anonymous site). Values are validated where
-- they are written (the admin console) and read defensively by the site,
-- which falls back to the waitlist stage and to no company line.
-- ============================================================

insert into public.platform_settings (key, value, is_public) values
  ('launch', '{"stage": "waitlist"}'::jsonb, true),
  ('legal_entity', '{}'::jsonb, true)
on conflict (key) do nothing;
