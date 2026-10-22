-- P1-B1 (S-C4, S-M2, M-M3): olay değişmez, durum ve olay birlikte yazılır ya da hiç, bütünlük görünümü, sayaç, istek kaydı.
begin;
insert into public.kullanici (id, ad) values ('00000000-0000-0000-0000-00000000000c', 'C alanı');
insert into public.akis (id, sahip_id, kisa_kod, baslik) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'TSTC', 'C akışı'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c', 'TSTD', 'D akışı');
insert into public.adim (id, akis_id, no, ad, sahip, kriter) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 1, 'Liste', 'Berkin', 'liste');

-- bütünlük: boş kayıtta 0 satır
do $$ begin
  if exists (select 1 from public.adim_durum_tutarsiz) then raise exception 'bütünlük görünümü boş kayıtta satır döndü'; end if;
end $$;

-- durum ve olay birlikte: başarılı yazım ikisini de yazar
do $$
declare v bigint;
begin
  v := public.adim_durum_yaz('00000000-0000-0000-0000-0000000000d1', '{"durum":"suruyor","durum_at":"2026-10-22T09:00:00Z","engel":null}', 'sirada',
    '{"akis_id":"00000000-0000-0000-0000-0000000000c1","adim_no":1,"kim":"Berkin","kim_tip":"insan","arac":"Devir web","tip":"durum","ozet":"Adım 1 başladı","veri":{"from":"sirada","to":"suruyor"},"kanal":"oturum"}');
  if v is null or (select durum from public.adim where id = '00000000-0000-0000-0000-0000000000d1') <> 'suruyor'
     or (select veri ->> 'to' from public.olay where id = v) <> 'suruyor' or (select kanal from public.olay where id = v) <> 'oturum' then
    raise exception 'adim_durum_yaz durumu ya da olayı yazmadı';
  end if;
end $$;

-- ya da hiç: önceki durum tutmazsa (eşzamanlı güncelleme) ne adım ne olay değişir
do $$
declare n0 int := (select count(*) from public.olay);
begin
  begin
    perform public.adim_durum_yaz('00000000-0000-0000-0000-0000000000d1', '{"durum":"tamam"}', 'sirada',
      '{"akis_id":"00000000-0000-0000-0000-0000000000c1","adim_no":1,"kim":"Berkin","kim_tip":"insan","tip":"durum","ozet":"x","veri":{"from":"sirada","to":"tamam"}}');
    raise exception 'eski durumla yazım kabul edildi';
  exception when serialization_failure then null;
  end;
  -- olay geçersizse (başka akışa) adım da geri alınır
  begin
    perform public.adim_durum_yaz('00000000-0000-0000-0000-0000000000d1', '{"durum":"tamam"}', 'suruyor',
      '{"akis_id":"00000000-0000-0000-0000-0000000000c2","adim_no":1,"kim":"Berkin","kim_tip":"insan","tip":"durum","ozet":"x","veri":{"from":"suruyor","to":"tamam"}}');
    raise exception 'başka akışa olay yazıldı';
  exception when raise_exception then if sqlerrm not like 'adim_durum_yaz: olay başka%' then raise; end if;
  end;
  -- olay kısıtı (tanımsız kanal) adımı da geri alır
  begin
    perform public.adim_durum_yaz('00000000-0000-0000-0000-0000000000d1', '{"durum":"tamam"}', 'suruyor',
      '{"akis_id":"00000000-0000-0000-0000-0000000000c1","adim_no":1,"kim":"Berkin","kim_tip":"insan","tip":"durum","ozet":"x","veri":{"to":"tamam"},"kanal":"eposta"}');
    raise exception 'tanımsız kanallı olay yazıldı';
  exception when check_violation then null;
  end;
  if (select durum from public.adim where id = '00000000-0000-0000-0000-0000000000d1') <> 'suruyor' or (select count(*) from public.olay) <> n0 then
    raise exception 'başarısız yazım adımı ya da olayı değiştirdi';
  end if;
end $$;

-- bütünlük: olaysız durum değişikliği görünür
update public.adim set durum = 'tamam' where id = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
  if (select count(*) from public.adim_durum_tutarsiz where akis_id = '00000000-0000-0000-0000-0000000000c1') <> 1 then raise exception 'bütünlük görünümü ayrışmayı bulmadı'; end if;
end $$;
update public.adim set durum = 'suruyor' where id = '00000000-0000-0000-0000-0000000000d1';

-- olay değişmez
do $$ begin
  begin update public.olay set ozet = 'değişti' where akis_id = '00000000-0000-0000-0000-0000000000c1'; raise exception 'olay güncellendi'; exception when raise_exception then if sqlerrm not like 'olay kaydı değiştirilemez%' then raise; end if; end;
  begin delete from public.olay where akis_id = '00000000-0000-0000-0000-0000000000c1'; raise exception 'olay silindi'; exception when raise_exception then if sqlerrm not like 'olay kaydı değiştirilemez%' then raise; end if; end;
end $$;

-- sayaç: aynı pencerede artar, yeni pencerede 1'den başlar
do $$ begin
  if public.sayac_artir('00000000-0000-0000-0000-00000000000c', 'a:1', 'mcp', '2026-10-22T09:00:00Z') <> 1
     or public.sayac_artir('00000000-0000-0000-0000-00000000000c', 'a:1', 'mcp', '2026-10-22T09:00:00Z') <> 2
     or public.sayac_artir('00000000-0000-0000-0000-00000000000c', 'a:1', 'mcp', '2026-10-22T09:01:00Z') <> 1 then
    raise exception 'sayac_artir yanlış saydı';
  end if;
end $$;

-- istek kaydı: aynı kimlik ve anahtar bir kez
insert into public.istek_kaydi (ws_id, kimlik, anahtar, ozet) values ('00000000-0000-0000-0000-00000000000c', 'a:1', 'api:k1', 'x');
do $$ begin
  begin insert into public.istek_kaydi (ws_id, kimlik, anahtar, ozet) values ('00000000-0000-0000-0000-00000000000c', 'a:1', 'api:k1', 'y'); raise exception 'aynı anahtar iki kez yazıldı'; exception when unique_violation then null; end;
end $$;

-- alan silinince olaylar, sayaç ve istek kaydı da gider (olay tetiği silmeyi engellemez)
delete from public.kullanici where id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if exists (select 1 from public.olay where akis_id = '00000000-0000-0000-0000-0000000000c1')
     or exists (select 1 from public.kullanim_sayaci where ws_id = '00000000-0000-0000-0000-00000000000c')
     or exists (select 1 from public.istek_kaydi where ws_id = '00000000-0000-0000-0000-00000000000c') then
    raise exception 'silinen alanın olay, sayaç ya da istek kaydı kaldı';
  end if;
end $$;
rollback;
