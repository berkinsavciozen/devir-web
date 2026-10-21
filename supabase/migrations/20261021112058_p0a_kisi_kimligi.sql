-- P0-A (0.13.0) · M2: kişi kimliği, üyeye bağlı anahtar, olay kanalı, karar politikası. Yalnız ekler; eski kod bu sütunları yok sayar.
-- Sıra: önce bu migration, sonra 0.13.0 kodu. Geri alma en altta.

-- Ad normalleştirme: sunucudaki norm() ile aynı (Türkçe küçük harf, harf/rakam dışı boşluk). en_US.UTF-8'de lower Türkçe harfleri küçültür; I/İ önce elle.
create or replace function public.devir_norm(t text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(replace(replace(coalesce(t, ''), 'I', 'ı'), 'İ', 'i')), '[^a-zçğıöşü0-9]+', ' ', 'g'))
$$;
revoke all on function public.devir_norm(text) from public, anon, authenticated;

create table public.kisi (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.kullanici(id) on delete cascade,
  ad text not null,
  ad_norm text not null,
  tip text not null default 'insan' check (tip in ('insan', 'dis', 'agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kisi_ws_ad on public.kisi (ws_id, ad_norm);
alter table public.kisi enable row level security;
comment on table public.kisi is 'Çalışma alanındaki kişi (insan, dış kişi ya da agent). Kapsam ve aktör kimlikle eşleşir; ad yalnız gösterimdir.';

alter table public.adim add column sahip_kisi_id uuid references public.kisi(id) on delete set null;
alter table public.katilimci add column kisi_id uuid references public.kisi(id) on delete set null;
alter table public.uye add column kisi_id uuid references public.kisi(id) on delete set null;
-- üyelik silinince üyeye bağlı anahtar da silinir (N-4); sunucu silmeden önce iptal eder
alter table public.anahtar add column uye_id uuid references public.uye(id) on delete cascade,
  add column kisi_id uuid references public.kisi(id) on delete set null;
alter table public.olay add column kanal text check (kanal in ('mcp', 'oturum', 'anahtar', 'baglanti')),
  add column kisi_id uuid references public.kisi(id) on delete set null;
alter table public.kullanici add column politika jsonb not null default '{}';
create index adim_sahip_kisi on public.adim (sahip_kisi_id);
create index katilimci_kisi on public.katilimci (kisi_id);
create index anahtar_uye on public.anahtar (uye_id);

-- Geri doldurma: her (alan, normalleşmiş ad) için bir kişi. Tip: üye/anahtar rolü, yoksa bağlantı (dış), yoksa adımlardaki en sık tip.
with adlar as (
  select a.sahip_id ws_id, s.sahip ad, s.sahip_tip tip, s.created_at t, 3 oncelik from public.adim s join public.akis a on a.id = s.akis_id
  union all select a.sahip_id, k.ad, 'dis', k.created_at, 2 from public.katilimci k join public.akis a on a.id = k.akis_id
  union all select kullanici_id, case when rol = 'dis' then coalesce(kapsam, kisi) else kisi end, case when rol = 'dis' then 'dis' else 'insan' end, created_at, 0 from public.uye
  union all select kullanici_id, case when rol = 'dis' then coalesce(kapsam, kisi) else kisi end, case when rol = 'dis' then 'dis' else 'insan' end, created_at, 1 from public.anahtar where token_hash not like 'iptal:%'
), g as (
  select ws_id, public.devir_norm(ad) n, (array_agg(ad order by t))[1] ad,
    coalesce((array_agg(tip order by oncelik, t) filter (where oncelik < 3))[1], mode() within group (order by tip)) tip
  from adlar where public.devir_norm(ad) <> '' group by ws_id, public.devir_norm(ad)
)
insert into public.kisi (ws_id, ad, ad_norm, tip) select ws_id, ad, n, tip from g;

update public.adim s set sahip_kisi_id = k.id from public.akis a, public.kisi k
  where a.id = s.akis_id and k.ws_id = a.sahip_id and k.ad_norm = public.devir_norm(s.sahip);
update public.katilimci x set kisi_id = k.id from public.akis a, public.kisi k
  where a.id = x.akis_id and k.ws_id = a.sahip_id and k.ad_norm = public.devir_norm(x.ad);
update public.uye u set kisi_id = k.id from public.kisi k
  where k.ws_id = u.kullanici_id and k.ad_norm = public.devir_norm(case when u.rol = 'dis' then coalesce(u.kapsam, u.kisi) else u.kisi end);
update public.anahtar n set kisi_id = k.id from public.kisi k
  where k.ws_id = n.kullanici_id and k.ad_norm = public.devir_norm(case when n.rol = 'dis' then coalesce(n.kapsam, n.kisi) else n.kisi end);
update public.anahtar n set uye_id = u.id from public.uye u
  where u.kullanici_id = n.kullanici_id and public.devir_norm(u.kisi) = public.devir_norm(n.kisi) and n.token_hash not like 'iptal:%';

-- Geri alma:
-- alter table public.adim drop column sahip_kisi_id; alter table public.katilimci drop column kisi_id; alter table public.uye drop column kisi_id;
-- alter table public.anahtar drop column uye_id, drop column kisi_id; alter table public.olay drop column kanal, drop column kisi_id;
-- alter table public.kullanici drop column politika; drop table public.kisi; drop function public.devir_norm(text);
