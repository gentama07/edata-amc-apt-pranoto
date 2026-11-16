-- Keep Pimpinan read-only for correspondence records while allowing
-- replies through the dedicated message and outbound-letter insert policies.
-- Personel and Admin retain permission to update correspondence status/data.

drop policy if exists "internal update correspondence" on public.incoming_letters;
create policy "internal update correspondence" on public.incoming_letters
  for update to authenticated
  using (public.can_write_amc())
  with check (public.can_write_amc());
