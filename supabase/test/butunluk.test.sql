-- P0-C (N-6, S-B2, N-3): şemanın davrandığı kurallar. Her blok kendi verisini kurar ve sonunda geri alır.
begin;
insert into public.kullanici (id, ad) values ('00000000-0000-0000-0000-00000000000a', 'A alanı'), ('00000000-0000-0000-0000-00000000000b', 'B alanı');
insert into public.akis (id, sahip_id, kisa_kod, baslik) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'TSTA', 'A akışı');

-- devir_norm sunucudaki norm() ile aynı sonucu verir (değerler sunucu/core.ts norm'undan alındı)
do $$
declare r record;
begin
  for r in select * from (values
    ('Şampirellam (sevgilisi yardım ediyor)', 'şampirellam sevgilisi yardım ediyor'),
    ('IŞIK İNCE', 'ışık ince'),
    ('Mali müşavir Ayten', 'mali müşavir ayten'),
    ('  Emre—Ege Bank!! ', 'emre ege bank'),
    ('ÇĞÖÜ çğöü 42', 'çğöü çğöü 42'),
    ('Ali', 'ali')) v(girdi, beklenen) loop
    if public.devir_norm(r.girdi) is distinct from r.beklenen then
      raise exception 'devir_norm(%) = %, beklenen %', r.girdi, public.devir_norm(r.girdi), r.beklenen;
    end if;
  end loop;
end $$;

-- N-3: bağlantı belirteci düz olmadan saklanabilir, karma tekildir
insert into public.katilimci (akis_id, ad, link_token, link_hash, link_sifreli) values ('00000000-0000-0000-0000-0000000000a1', 'Emre', null, repeat('a', 64), 'v1:x:y');
do $$ begin
  begin
    insert into public.katilimci (akis_id, ad, link_token, link_hash) values ('00000000-0000-0000-0000-0000000000a1', 'Ayten', null, repeat('a', 64));
    raise exception 'aynı link_hash iki katılımcıya yazılabildi';
  exception when unique_violation then null;
  end;
end $$;

-- anahtar karması tekil; rol ve kişi tipi listeyle sınırlı
insert into public.anahtar (kullanici_id, kisi, rol, token_hash) values ('00000000-0000-0000-0000-00000000000a', 'Berkin', 'sahip', 'karma-1');
do $$ begin
  begin insert into public.anahtar (kullanici_id, kisi, rol, token_hash) values ('00000000-0000-0000-0000-00000000000b', 'Burak', 'sahip', 'karma-1'); raise exception 'aynı token_hash iki anahtara yazılabildi'; exception when unique_violation then null; end;
  begin insert into public.anahtar (kullanici_id, kisi, rol, token_hash) values ('00000000-0000-0000-0000-00000000000a', 'X', 'yonetici', 'karma-2'); raise exception 'tanımsız rol kabul edildi'; exception when check_violation then null; end;
  begin insert into public.kisi (ws_id, ad, ad_norm, tip) values ('00000000-0000-0000-0000-00000000000a', 'X', 'x', 'robot'); raise exception 'tanımsız kişi tipi kabul edildi'; exception when check_violation then null; end;
  begin insert into public.olay (akis_id, tip, kim, kim_tip, ozet, kanal) values ('00000000-0000-0000-0000-0000000000a1', 'durum', 'X', 'insan', 'x', 'eposta'); raise exception 'tanımsız olay kanalı kabul edildi'; exception when check_violation then null; end;
  begin insert into public.olay (akis_id, tip, kim, kim_tip, ozet) values ('00000000-0000-0000-0000-0000000000a1', 'uydurma', 'X', 'insan', 'x'); raise exception 'tanımsız olay tipi kabul edildi'; exception when check_violation then null; end;
end $$;

-- akış kısa kodu bütün alanlarda tekil (çapraz alan karışmaz)
do $$ begin
  begin insert into public.akis (sahip_id, kisa_kod, baslik) values ('00000000-0000-0000-0000-00000000000b', 'TSTA', 'B akışı'); raise exception 'aynı kısa kod iki alanda'; exception when unique_violation then null; end;
end $$;

-- alan silinince alanın bütün kayıtları gider; başka alan etkilenmez
insert into public.akis (id, sahip_id, kisa_kod, baslik) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'TSTB', 'B akışı');
insert into public.kisi (ws_id, ad, ad_norm) values ('00000000-0000-0000-0000-00000000000a', 'Emre', 'emre'), ('00000000-0000-0000-0000-00000000000b', 'Burak', 'burak');
delete from public.kullanici where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists (select 1 from public.akis where sahip_id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.katilimci where akis_id = '00000000-0000-0000-0000-0000000000a1')
     or exists (select 1 from public.anahtar where kullanici_id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.kisi where ws_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'silinen alanın kayıtları kaldı';
  end if;
  if not exists (select 1 from public.akis where kisa_kod = 'TSTB') or not exists (select 1 from public.kisi where ad = 'Burak') then
    raise exception 'başka alanın kayıtları silindi';
  end if;
end $$;
rollback;
