-- P1-D (S-M4): her yabancı anahtarın onu kapsayan bir indeksi var; public işlevlerinin arama yolu sabit.
do $$
declare r record; eksik text := '';
begin
  for r in
    select c.conrelid::regclass::text tablo, c.conname ad
    from pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)
  loop eksik := eksik || ' ' || r.tablo || '.' || r.ad; end loop;
  if eksik <> '' then raise exception 'indekssiz yabancı anahtar:%', eksik; end if;
end $$;

do $$
declare eksik text;
begin
  select string_agg(p.proname, ', ') into eksik from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%');
  if eksik is not null then raise exception 'arama yolu sabit olmayan işlev: %', eksik; end if;
end $$;

-- arama yolu boşken de devir_norm aynı sonucu verir
do $$ begin
  if public.devir_norm('IŞIK İnce—Ege!!') <> 'ışık ince ege' then raise exception 'devir_norm arama yolu boşken bozuldu: %', public.devir_norm('IŞIK İnce—Ege!!'); end if;
end $$;
