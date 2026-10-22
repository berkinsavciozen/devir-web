-- P0-C (S-M1, N-2): istemci rolleri (anon, authenticated) public şemada hiçbir şeye erişemez; her tabloda RLS açık
-- ve istemci rollerine politika yok. Erişim yalnız sunucunun service role'ü üzerinden. Supabase varsayılan yetkileri
-- onkosul.sql'de canlıdaki gibi verildiği için bu test yetki kaldıran migration'ın gerçekten işlediğini de sınar.
do $$
declare r record; hata text[] := '{}';
begin
  for r in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S') loop
    if r.relkind = 'S' then
      if has_sequence_privilege('anon', 'public.' || quote_ident(r.relname), 'USAGE,SELECT,UPDATE')
         or has_sequence_privilege('authenticated', 'public.' || quote_ident(r.relname), 'USAGE,SELECT,UPDATE') then
        hata := hata || ('dizi ' || r.relname);
      end if;
    elsif has_table_privilege('anon', 'public.' || quote_ident(r.relname), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_table_privilege('authenticated', 'public.' || quote_ident(r.relname), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      hata := hata || ('tablo ' || r.relname);
    end if;
  end loop;
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    if has_function_privilege('anon', r.f, 'EXECUTE') or has_function_privilege('authenticated', r.f, 'EXECUTE') then
      hata := hata || ('fonksiyon ' || r.f::text);
    end if;
  end loop;
  if cardinality(hata) > 0 then raise exception 'istemci rollerinin yetkisi kalmış: %', array_to_string(hata, ', '); end if;
end $$;

do $$
declare eksik text;
begin
  select string_agg(c.relname, ', ') into eksik from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if eksik is not null then raise exception 'RLS kapalı tablolar: %', eksik; end if;
  select string_agg(tablename || ':' || policyname, ', ') into eksik from pg_policies
    where schemaname = 'public' and roles && array['anon', 'authenticated', 'public']::name[];
  if eksik is not null then raise exception 'istemci rollerine açık politika: %', eksik; end if;
end $$;

-- yeni tablo da kapalı doğar (varsayılan yetkiler kaldırıldı)
create table public.zz_yeni_tablo (id int);
do $$ begin
  if has_table_privilege('anon', 'public.zz_yeni_tablo', 'SELECT') or has_table_privilege('authenticated', 'public.zz_yeni_tablo', 'SELECT') then
    raise exception 'yeni tablo istemci rollerine açık doğuyor (varsayılan yetkiler)';
  end if;
end $$;
drop table public.zz_yeni_tablo;

-- gerçek erişim denemesi: anon ve authenticated okuyamaz, yazamaz
do $$
declare rol text; t text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    foreach t in array array['anahtar', 'katilimci', 'akis', 'adim', 'kullanici', 'uye', 'ayar', 'dosya', 'kisi'] loop
      begin
        execute format('set local role %I', rol);
        execute format('select 1 from public.%I limit 1', t);
        reset role;
        raise exception '% rolü % tablosunu okuyabildi', rol, t;
      exception when insufficient_privilege then reset role;
      end;
    end loop;
  end loop;
end $$;

-- dosya kovası gizli
do $$ begin
  if exists (select 1 from storage.buckets where id = 'devir-dosya' and public) then raise exception 'devir-dosya kovası herkese açık'; end if;
  if not exists (select 1 from storage.buckets where id = 'devir-dosya') then raise exception 'devir-dosya kovası yok'; end if;
end $$;
