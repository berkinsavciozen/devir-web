import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { destekGemisi } from '../../cizim/ortak.js';
import { gunAy, saat } from '../../cizim/yol.js';
import { git } from '../../yonlendirme';

/**
 * W3 (4 Kas, K3): kişinin agent'ları tek bileşende. Her agent: bağlantısı (Claude / ChatGPT), bağlı rutin(ler)i
 * (zamanlanmış / anında), şu an yaptığı iş, onayını bekleyen çıktılar, son etkinliği. Ayarlar "yönetim" kipinde kullanır
 * (rutin bağla, yeniden adlandır, kaldır); Görevler (W6) "iş" kipinde yalnız işi gösterir.
 * Rutinin hangi agent'ın işini yaptığı adıyla belirlenir (sunucu rutinSec): bağlamak, rutinin adını agent'ın adı yapmaktır.
 */
export interface AgentIs { akis: string; akis_ad: string | null; no: number; ad: string; durum: string; oto_durum: string | null }
export interface AgentRutin { id: string; ad: string; tur: 'zamanli' | 'api'; son_calisma: string | null; son_hata: string | null }
export interface Agent {
  ad: string; rutinler: AgentRutin[]; durum: 'hata' | 'calisiyor' | 'bosta'; simdi: AgentIs[]; sirada: number; bakilacak: AgentIs[]; acik_is: number;
  son_etkinlik: { zaman: string; ozet: string; akis: string; no: number } | null;
}
export interface Agentlar { kisi: string; agentlar: Agent[]; genel_rutin: { id: string; son_calisma: string | null } | null }
/** OAuth bağlantısı (Ayarlar'daki /ben/agentlar satırı) */
export interface Baglanti { id: string; ad: string; istemci?: string; alt: string; eski?: boolean }

export const useAgentlar = (acik: boolean) =>
  useQuery({ queryKey: ['agentlar-ai'], queryFn: () => api.get<Agentlar>('/agentlar'), enabled: acik, retry: false, refetchInterval: 30_000 });
const tazele = () => { for (const k of [['agentlar-ai'], ['tetikler']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };

const zaman = (t: string | null | undefined) => (t ? `${gunAy(Date.parse(t))} ${saat(Date.parse(t))}` : null);
/** Agent'ın hangi uygulamayla çalıştığı: adından (ör. "Berkin'in Claude'u", "Ayşe'nin ChatGPT'si") */
export const uygulamaOf = (ad: string) => (/chat\s?gpt|openai|gpt/i.test(ad) ? 'ChatGPT' : 'Claude');
/** Agent'ın uygulamasıyla kurulmuş OAuth bağlantısı (varsa) */
export const baglantiOf = (ad: string, L: Baglanti[]) => {
  const u = uygulamaOf(ad).toLocaleLowerCase('tr');
  return L.find((b) => `${b.ad} ${b.istemci || ''}`.toLocaleLowerCase('tr').includes(u)) || null;
};
export const rutinTuru = (t: { tur: string }) => (t.tur === 'zamanli' ? 'Zamanlanmış' : 'Anında');

/** Agent satırının tek cümlesi: önce kişiden beklenen (onay), sonra sorun, sonra iş; rutin yoksa o söylenir. */
export function agentCumlesi(a: Agent, genelVar: boolean, kisa = false): string {
  if (a.bakilacak.length) return a.bakilacak.length === 1 && !kisa ? `“${a.bakilacak[0].ad}” çıktısı onayını bekliyor` : `${a.bakilacak.length} çıktı onayını bekliyor`;
  if (a.durum === 'hata') return a.rutinler.length && a.rutinler.every((t) => t.son_hata) ? 'Rutin son denemede çalışmadı' : 'Bir işi yapamadı; yeniden dene';
  if (a.simdi.length) return `Şu an: ${a.simdi[0].ad}`;
  const rutin = a.rutinler.length ? a.rutinler.map(rutinTuru).join(' + ').toLocaleLowerCase('tr') + ' rutin' : genelVar ? 'genel rutin' : null;
  if (!rutin) return a.sirada ? `${a.sirada} iş sırada; rutin bağlı değil` : 'Rutin bağlı değil';
  return `${a.sirada ? `${a.sirada} iş sırada` : a.acik_is ? `${a.acik_is} açık iş` : 'Boşta'} · ${rutin}`;
}

/** Satırın simgesi: agent'ın destek gemisi; durum rengiyle */
export const agentIkonu = (a: Pick<Agent, 'durum' | 'bakilacak'>, x = 26, y = 30, sc = 1) =>
  destekGemisi(x, y, 1, -.35, a.bakilacak.length ? '#5FE3F0' : a.durum === 'hata' ? '#FF9A8A' : a.durum === 'calisiyor' ? '#9EE6CF' : '#FFC9A3', sc);

/** Agent detayı (alt sayfa). kip "yonetim": rutin bağla, adlandır, kaldır, kur; kip "is": yalnız iş. */
export function AgentDetay({ a, veri, kip, baglanti, kapat, kurAc, rutinKaldir, adDegisti }: {
  a: Agent; veri: Agentlar; kip: 'yonetim' | 'is'; baglanti?: Baglanti | null; kapat: () => void;
  /** AI yapsın kurulumunu bu agent için açar */
  kurAc?: (agent: string) => void;
  rutinKaldir?: (t: AgentRutin) => void;
  /** agent'ın adını taşıyan rutin yeniden adlandırıldı: agent artık yeni adla listelenir */
  adDegisti?: (yeni: string) => void;
}) {
  const [adlandir, setAdlandir] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState('');
  const ad = useMutation({
    mutationFn: ({ id, ad }: { id: string; ad: string }) => api.post<any>(`/tetikler/${id}/ad`, { ad }),
    onSuccess: (_r, v) => {
      setAdlandir(null); tazele();
      // agent yalnız bu rutinden geliyorsa (işi yok) adı rutinle değişir; detay yeni adla açık kalır
      const t = a.rutinler.find((x) => x.id === v.id);
      if (t && t.ad.toLocaleLowerCase('tr') === a.ad.toLocaleLowerCase('tr') && !a.acik_is && !a.son_etkinlik) adDegisti?.(v.ad);
    },
  });
  // bağlanabilecek rutinler: genel zamanlanmış rutin ve işi olmayan, yalnız rutin olarak duran agent'ların rutinleri
  const k = (x: string) => x.toLocaleLowerCase('tr');
  const bagli = a.rutinler.filter((t) => k(t.ad) === k(a.ad));
  const ortak = a.rutinler.filter((t) => !bagli.includes(t));
  const genel = veri.genel_rutin && !a.rutinler.some((t) => t.id === veri.genel_rutin!.id) ? veri.genel_rutin : null;
  const serbest: AgentRutin[] = [
    ...(genel ? [{ id: genel.id, ad: 'Zamanlanmış rutin', tur: 'zamanli' as const, son_calisma: genel.son_calisma, son_hata: null }] : []),
    ...veri.agentlar.filter((x) => x.ad !== a.ad && !x.acik_is && !x.son_etkinlik).flatMap((x) => x.rutinler.filter((t) => k(t.ad) === k(x.ad))),
    ...ortak,
  ].filter((t, i, L) => L.findIndex((u) => u.id === t.id) === i);
  const isAc = (i: { akis: string; no: number }) => { kapat(); git(`/akis/${encodeURIComponent(i.akis)}/adim/${i.no}`); };
  const isler = (baslik: string, L: AgentIs[], alt: string) => L.length > 0 && (
    <section className="ai-grup" aria-label={baslik}>
      <h3 className="gd-bolum-baslik">{baslik} · {L.length}</h3>
      <ul className="gd-baglar">{L.map((i) => (
        <li key={`${i.akis}-${i.no}`}><button type="button" className="gd-bag" onClick={() => isAc(i)}><span><b>{i.ad}</b><small>{i.akis_ad ? `${i.akis_ad} · ` : ''}{i.no}. görev · {alt}</small></span></button></li>
      ))}</ul>
    </section>
  );
  const rutinSatiri = (t: AgentRutin, not?: string) => (
    <li key={t.id} className="ag-rutin">
      <span><b>{t.ad}</b><small>{rutinTuru(t)} · {t.son_hata ? `son deneme başarısız: ${t.son_hata}` : t.son_calisma ? `son çalışma ${zaman(t.son_calisma)}` : 'henüz çalışmadı'}{not ? ` · ${not}` : ''}</small></span>
      {kip === 'yonetim' && adlandir !== t.id && <span className="ag-rutin-eylem">
        <button type="button" className="metin-baglanti" onClick={() => { setAdlandir(t.id); setYeniAd(t.ad); ad.reset(); }}>Adlandır</button>
        {rutinKaldir && <button type="button" className="metin-baglanti mercan" onClick={() => rutinKaldir(t)}>Kaldır</button>}
      </span>}
      {adlandir === t.id && <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); const v = yeniAd.trim(); if (v) ad.mutate({ id: t.id, ad: v }); }}>
        <input className="alan" value={yeniAd} autoFocus onChange={(e) => setYeniAd(e.target.value)} aria-label={`${t.ad} rutininin adı`} maxLength={60} />
        <button type="submit" className="gd-alt-ekle-dugme" disabled={!yeniAd.trim() || ad.isPending}>Kaydet</button>
      </form>}
    </li>
  );
  return (
    <AltSayfa acik kapat={kapat} baslik={a.ad} yukseklik="yuksek">
      <div className="ai-etkinlik agent-detay">
        <div className="ag-ust">
          <svg aria-hidden width="44" height="44" viewBox="4 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: agentIkonu(a, 26, 24, 1.3) }} />
          <h2 className="ai-etkinlik-baslik">{a.ad}</h2>
        </div>
        <p className="gd-satir">{agentCumlesi(a, !!veri.genel_rutin)}.</p>

        <section className="ai-grup" aria-label="Bağlantı">
          <h3 className="gd-bolum-baslik">BAĞLANTI</h3>
          <p className="gd-satir">{baglanti ? `${uygulamaOf(a.ad)} · ${baglanti.alt}` : `${uygulamaOf(a.ad)} bu hesaba bağlı görünmüyor. Bağlanınca ${a.ad} Devir’de yazabilir.`}</p>
          {!baglanti && kip === 'yonetim' && <button type="button" className="metin-baglanti" onClick={() => { kapat(); git('/bagla'); }}>{uygulamaOf(a.ad)}’u bağla</button>}
        </section>

        <section className="ai-grup" aria-label="Rutinler">
          <h3 className="gd-bolum-baslik">RUTİN</h3>
          {bagli.length + ortak.length > 0 ? <ul className="ag-rutinler">
            {bagli.map((t) => rutinSatiri(t))}
            {ortak.map((t) => rutinSatiri(t, t.id === veri.genel_rutin?.id ? 'genel rutin; bu agent’ın işlerine de bakar' : 'başka rutin bağlı olmadığı için bu agent’ın işlerini de yapar'))}
          </ul> : <p className="gd-satir">{genel ? `Bu agent’a bağlı rutin yok; genel zamanlanmış rutinin (son uğradı ${zaman(genel.son_calisma) || '—'}) işlerine bakar.` : 'Bu agent’a bağlı rutin yok; AI yapsın işleri kendiliğinden başlamaz.'}</p>}
          {kip === 'yonetim' && !bagli.length && serbest.length > 0 && <div className="ag-bagla">
            <p className="gd-satir">Başka bir agent’a bağlı olmayan rutinini bu agent’a bağlayabilirsin. Rutinin adı “{a.ad}” olur; Devir işleri ona göre dağıtır.</p>
            {serbest.map((t) => <Dugme key={t.id} type="button" tur="ikincil" ton="lila" yukseklik={44} fs={14} mesgul={ad.isPending && ad.variables?.id === t.id} onClick={() => ad.mutate({ id: t.id, ad: a.ad })}>“{t.ad}” rutinini bağla</Dugme>)}
          </div>}
          {kip === 'yonetim' && bagli.length > 0 && !a.acik_is && !a.son_etkinlik && <p className="gd-satir">Bu rutin henüz hiçbir görevin sahibi değil. Bir agent’ın işlerini yapsın istersen adını o agent’ın adı yap; ya da görevlerde sahip olarak “{a.ad}” seç.</p>}
          {kip === 'yonetim' && kurAc && <button type="button" className="metin-baglanti" onClick={() => kurAc(a.ad)}>{bagli.length ? 'Kurulum adımları' : `${a.ad} için rutin kur`}</button>}
          {ad.isError && <p className="canli-hata-satir" role="alert">{(ad.error as Error).message}</p>}
          {ad.data?.not && <p className="gd-satir" role="status">{ad.data.not}</p>}
        </section>

        {isler('ŞU AN', a.simdi, 'üzerinde çalışıyor')}
        {isler('ONAYINI BEKLİYOR', a.bakilacak, 'çıktıyı yazdı; bakıp onayla')}
        <section className="ai-grup" aria-label="İşler">
          <h3 className="gd-bolum-baslik">İŞLER</h3>
          <p className="gd-satir">{a.acik_is ? `${a.acik_is} açık iş${a.sirada ? `; ${a.sirada} tanesi AI yapsın, sırası gelince başlar` : ''}.` : 'Açık işi yok.'}</p>
          {a.son_etkinlik && <p className="gd-satir">Son etkinlik {zaman(a.son_etkinlik.zaman)}: <button type="button" className="metin-baglanti" onClick={() => isAc(a.son_etkinlik!)}>{a.son_etkinlik.ozet}</button></p>}
        </section>
      </div>
    </AltSayfa>
  );
}
