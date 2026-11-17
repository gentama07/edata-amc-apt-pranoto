drop policy if exists "Active users can view airport video" on storage.objects;

create policy "Active users can view airport video"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'airport-video'
  and name in ('airport-card.mp4', 'animasi-logo.mp4')
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
  )
);

