-- The lists Raw Data offers in its Community and District Name dropdowns. A monthly upload of new
-- records may only use these values. Run once in the Supabase SQL editor.
-- To add a district or community, add a row here (Table Editor); nothing in the code needs to change.

create table if not exists public.award_lists (
  id         bigint generated always as identity primary key,
  kind       text    not null check (kind in ('community', 'district')),
  value      text    not null,
  sort_order integer not null default 0,
  unique (kind, value)
);

alter table public.award_lists enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='award_lists'
                   and policyname='award lists are readable') then
    create policy "award lists are readable"
      on public.award_lists for select to anon, authenticated using (true);
  end if;
end $$;

grant select on public.award_lists to anon, authenticated;

insert into public.award_lists (kind, value, sort_order)
values
  ('community', 'ATC Community', 1),
  ('community', 'BiharZP', 2),
  ('community', 'Chhattisgarh ZP', 3),
  ('community', 'MadhyaPradesh ZP', 4),
  ('community', 'Maharashtra ZP', 5),
  ('district', 'Ahilyanagar', 1),
  ('district', 'Amravati', 2),
  ('district', 'Amravati - MC', 3),
  ('district', 'Balaghat', 4),
  ('district', 'Bastar', 5),
  ('district', 'Begusarai', 6),
  ('district', 'Bhandara', 7),
  ('district', 'Bid', 8),
  ('district', 'Buldhana', 9),
  ('district', 'Chandrapur', 10),
  ('district', 'Dantewada', 11),
  ('district', 'Dhamtari', 12),
  ('district', 'Dharashiv', 13),
  ('district', 'Durg', 14),
  ('district', 'Gadchiroli', 15),
  ('district', 'Gariaband', 16),
  ('district', 'Hingoli', 17),
  ('district', 'Jalgaon', 18),
  ('district', 'Jalna', 19),
  ('district', 'Janjgir - Champa', 20),
  ('district', 'Jashpur', 21),
  ('district', 'Latur', 22),
  ('district', 'Mumbai Suburban', 23),
  ('district', 'Nagpur', 24),
  ('district', 'Nagpur - ATC', 25),
  ('district', 'Nagpur - MC', 26),
  ('district', 'Nanded', 27),
  ('district', 'Nandurbar', 28),
  ('district', 'Nashik', 29),
  ('district', 'Nashik - MC', 30),
  ('district', 'Palghar', 31),
  ('district', 'Pune', 32),
  ('district', 'Raigarh', 33),
  ('district', 'Raigarh - MH', 34),
  ('district', 'Raipur', 35),
  ('district', 'Rajnandgaon', 36),
  ('district', 'Seoni', 37),
  ('district', 'Solapur', 38),
  ('district', 'Sukma', 39),
  ('district', 'Thane', 40),
  ('district', 'Wardha', 41),
  ('district', 'Washim', 42),
  ('district', 'Yavatmal', 43)
on conflict (kind, value) do nothing;
