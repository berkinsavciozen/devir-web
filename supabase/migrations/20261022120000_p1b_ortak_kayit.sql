-- P1-B1 (0.18.0) · M3: ortak kaydın güvenilirliği (S-C4, S-M2, M-M3, M-M2; MK-6).
-- 1) istek_kaydi: aynı isteğin ikinci kez yazılmaması (JSON API Idempotency-Key, MCP islem_id ve 10 dk doğal tekrar).
-- 2) adim_durum_yaz: adım durumu ve durum olayı tek işlemde; olay geçmişiyle adım durumu ayrışamaz.
-- 3) olay değişmez: güncelleme ve silme reddedilir (akış ya da alan silinince olaylar yine gider).
-- 4) adim_durum_tutarsiz: adım durumu ile son durum olayı farklı olan satırlar (0 satır beklenir); var olanlara düzeltme olayı.
-- 5) kullanim_sayaci + sayac_artir: hız sınırı ve günlük yapay zekâ bütçesi (sabit pencere).

-- 1) istek kaydı
create table public.istek_kaydi (
  id bigint generated always as identity primary key,
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  kimlik text not null,
  anahtar text not null,
  ozet text not null,
  durum text not null default 'isleniyor' check (durum in ('isleniyor', 'tamam', 'hata')),
  sonuc jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ws_id, kimlik, anahtar)
);
comment on table public.istek_kaydi is 'Yazan isteklerin sonucu (P1-B). anahtar: "api:<Idempotency-Key>", "mcp:<islem_id>" ya da "dogal:<araç+argüman karması>"; ozet: gövde karması.';
alter table public.istek_kaydi enable row level security;

-- 2) durum ve olay tek işlemde
create function public.adim_durum_yaz(p_adim uuid, p_patch jsonb, p_onceki text, p_olay jsonb) returns bigint
language plpgsql set search_path = '' as $$
declare
  v_set text;
  v_n int;
  v_akis uuid;
  v_id bigint;
begin
  if not (p_patch ? 'durum') then raise exception 'adim_durum_yaz: patch içinde durum gerekli'; end if;
  select string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ') into v_set
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'adim' and p_patch ? c.column_name::text
    and c.column_name not in ('id', 'akis_id', 'no', 'created_at');
  execute format('update public.adim a set %s from jsonb_populate_record(null::public.adim, $1) r where a.id = $2 and ($3::text is null or a.durum = $3::text) returning a.akis_id', v_set)
    into v_akis using p_patch, p_adim, p_onceki;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    if exists (select 1 from public.adim where id = p_adim) then raise exception 'durum_degisti' using errcode = '40001'; end if;
    raise exception 'adim_yok' using errcode = 'P0002';
  end if;
  insert into public.olay (akis_id, adim_no, kim, kim_tip, arac, tip, ozet, veri, kanal, kisi_id)
  select r.akis_id, r.adim_no, r.kim, r.kim_tip, r.arac, r.tip, r.ozet, coalesce(r.veri, '{}'::jsonb), r.kanal, r.kisi_id
  from jsonb_populate_record(null::public.olay, p_olay) r
  where r.akis_id = v_akis
  returning id into v_id;
  if v_id is null then raise exception 'adim_durum_yaz: olay başka akışa yazılamaz'; end if;
  return v_id;
end $$;
revoke all on function public.adim_durum_yaz(uuid, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.adim_durum_yaz(uuid, jsonb, text, jsonb) to service_role;

-- 4) bütünlük görünümü ve var olan ayrışmalara düzeltme olayı (canlıda 22 Eki itibarıyla 1 satır)
create view public.adim_durum_tutarsiz with (security_invoker = true) as
select a.id as adim_id, a.akis_id, a.no, a.durum, s.son_durum, s.olay_id
from public.adim a
join lateral (
  select o.id as olay_id, o.veri ->> 'to' as son_durum
  from public.olay o
  where o.akis_id = a.akis_id and o.adim_no = a.no and o.tip = 'durum' and o.veri ? 'to'
  order by o.id desc limit 1
) s on true
where s.son_durum is distinct from a.durum;
revoke all on public.adim_durum_tutarsiz from public, anon, authenticated;
grant select on public.adim_durum_tutarsiz to service_role;

insert into public.olay (akis_id, adim_no, kim, kim_tip, arac, tip, ozet, veri)
select t.akis_id, t.no, 'Devir', 'sistem', null, 'durum',
  format('Kayıt düzeltmesi: adım %s durumu %s (olay geçmişinde son durum %s idi)', t.no, t.durum, t.son_durum),
  jsonb_build_object('from', t.son_durum, 'to', t.durum, 'tur', 'duzeltme', 'olay_id', t.olay_id)
from public.adim_durum_tutarsiz t;

-- 3) olay değişmez (silme yalnız akış silinirken, cascade ile)
create function public.olay_degismez() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.akis where id = old.akis_id) then return old; end if;
  raise exception 'olay kaydı değiştirilemez (%); düzeltme için yeni olay yaz', lower(tg_op) using errcode = 'P0001';
end $$;
revoke all on function public.olay_degismez() from public, anon, authenticated;
create trigger olay_degismez before update or delete on public.olay for each row execute function public.olay_degismez();

-- 5) kullanım sayacı
create table public.kullanim_sayaci (
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  kimlik text not null,
  tur text not null,
  pencere timestamptz not null,
  sayi int not null default 0,
  primary key (ws_id, kimlik, tur, pencere)
);
comment on table public.kullanim_sayaci is 'Sabit pencereli sayaç (P1-B): tur "mcp"/"api" dakikalık istek, "llm" günlük yapay zekâ çağrısı (kimlik "*" = alan).';
alter table public.kullanim_sayaci enable row level security;

create function public.sayac_artir(p_ws uuid, p_kimlik text, p_tur text, p_pencere timestamptz) returns int
language sql set search_path = '' as $$
  insert into public.kullanim_sayaci as k (ws_id, kimlik, tur, pencere, sayi) values (p_ws, p_kimlik, p_tur, p_pencere, 1)
  on conflict (ws_id, kimlik, tur, pencere) do update set sayi = k.sayi + 1
  returning sayi
$$;
revoke all on function public.sayac_artir(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.sayac_artir(uuid, text, text, timestamptz) to service_role;

-- Geri alma (önce 0.17.0 koduna dön; düzeltme olayları kalır, olay değişmez olduğu için):
-- drop trigger olay_degismez on public.olay; drop function public.olay_degismez();
-- drop function public.adim_durum_yaz(uuid, jsonb, text, jsonb); drop function public.sayac_artir(uuid, text, text, timestamptz);
-- drop view public.adim_durum_tutarsiz; drop table public.istek_kaydi, public.kullanim_sayaci;
