import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { destekGemisi } from '../../cizim/ortak.js';
import { gunAy, saat } from '../../cizim/yol.js';
import { git } from '../../yonlendirme';
import { AgentIsleri } from './AgentIsleri';

/**
 * W3 (4 Kas, K3): kişinin agent'ları tek bileşende. Her agent: bağlantısı (Claude / ChatGPT), bağlı rutin(ler)i
 * (zamanlanmış / anında), şu an yaptığı iş, onayını bekleyen çıktılar, son etkinliği. Ayarlar "yönetim" kipinde kullanır
 * (rutin bağla, yeniden adlandır, kaldır); Görevler (W6) "iş" kipinde yalnız işi gösterir.
 * 0.34.0 (K1): rutin ile agent ayrı kayıttır. Rutinin hangi agent'ların işini aldığı rutinde açıkça yazılır
 * (agentlar; null = tüm agent'larım) ve buradan değişir; rutinin adı yalnız etikettir.
 */
export interface AgentIs { akis: string; akis_ad: string | null; no: number; ad: string; durum: string; oto_durum: string | null }
export interface AgentRutin { id: string; ad: string; tur: 'zamanli' | 'api'; son_calisma: string | null; son_hata: string | null; /** null = tüm agent'lar */ agentlar?: string[] | null }
export interface Agent {
  ad: string; renk?: string | null; isleyen_rutin?: string | null; ai_kapali?: number; rutinler: AgentRutin[]; durum: 'hata' | 'calisiyor' | 'bosta'; simdi: AgentIs[]; sirada: number; bakilacak: AgentIs[]; acik_is: number;
  son_etkinlik: { zaman: string; ozet: string; akis: string; no: number } | null;
}
export interface Agentlar { kisi: string; agentlar: Agent[]; rutinler?: AgentRutin[]; genel_rutin: { id: string; son_calisma: string | null } | null }
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
export function AgentDetay({ a, veri, kip, baglanti, kapat, kurAc, rutinKaldir }: {
  a: Agent; veri: Agentlar; kip: 'yonetim' | 'is'; baglanti?: Baglanti | null; kapat: () => void;
  /** AI yapsın kurulumunu bu agent için açar */
  kurAc?: (agent: string) => void;
  rutinKaldir?: (t: AgentRutin) => void;
  /** eski çağıranlar için; 0.34.0'dan beri rutinin adı agent'ı değiştirmez */
  adDegisti?: (yeni: string) => void;
}) {
  const [adlandir, setAdlandir] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState('');
  const ad = useMutation({
    mutationFn: ({ id, ad }: { id: string; ad: string }) => api.post<any>(`/tetikler/${id}/ad`, { ad }),
    onSuccess: () => { setAdlandir(null); tazele(); },
  });
  // K1: rutinin kapsamı (hangi agent'lar). Değişince yeni kapsamdaki açık adımlarda AI yapsın açılır (K3); geri alınabilir.
  const kapsam = useMutation({
    mutationFn: ({ id, agentlar }: { id: string; agentlar: string[] | null }) => api.post<any>(`/tetikler/${id}/agentlar`, { agentlar }),
    onSuccess: () => tazele(),
  });
  const geriAl = useMutation({
    mutationFn: async (acilan: { akis: string; no: number }[]) => {
      const by = new Map<string, number[]>();
      for (const x of acilan) by.set(x.akis, [...(by.get(x.akis) || []), x.no]);
      for (const [kod, nolar] of by) await api.post<any>(`/akis/${encodeURIComponent(kod)}/ai`, { oto: false, nolar });
    },
    onSuccess: () => { kapsam.reset(); tazele(); },
  });
  const otoAc = useMutation({ mutationFn: () => api.post<any>(`/agentlar/${encodeURIComponent(a.ad)}/ai`, {}), onSuccess: () => tazele() });
  const k = (x: string) => x.toLocaleLowerCase('tr');
  const tum: AgentRutin[] = (veri.rutinler || []).filter((t, i, L) => L.findIndex((u) => u.id === t.id) === i);
  const kapsar = (t: AgentRutin) => t.agentlar == null || t.agentlar.some((x) => k(x) === k(a.ad));
  const bakan = tum.length ? tum.filter(kapsar) : a.rutinler;
  const digerleri = tum.filter((t) => !kapsar(t));
  const ekle = (t: AgentRutin) => kapsam.mutate({ id: t.id, agentlar: [...(t.agentlar || []), a.ad] });
  const cikar = (t: AgentRutin) => {
    // "tüm agent'larım" rutininden çıkarmak: o an bilinen öbür agent'lar açıkça yazılır
    const L = t.agentlar == null ? veri.agentlar.map((x) => x.ad).filter((x) => k(x) !== k(a.ad)) : t.agentlar.filter((x) => k(x) !== k(a.ad));
    if (L.length) kapsam.mutate({ id: t.id, agentlar: L });
  };
  const rutinSatiri = (t: AgentRutin) => (
    <li key={t.id} className="ag-rutin">
      <span><b>{t.ad}</b><small>{rutinTuru(t)} · {t.agentlar == null ? 'tüm agent’ların' : t.agentlar.join(', ')}{t.id === a.isleyen_rutin ? ' · bu agent’ın işini o başlatır' : ''} · {t.son_hata ? `son deneme başarısız: ${t.son_hata}` : t.son_calisma ? `son çalışma ${zaman(t.son_calisma)}` : 'henüz çalışmadı'}</small></span>
      {kip === 'yonetim' && adlandir !== t.id && <span className="ag-rutin-eylem">
        {kapsar(t) && (t.agentlar ? t.agentlar.length > 1 : veri.agentlar.length > 1) && <button type="button" className="metin-baglanti" disabled={kapsam.isPending} onClick={() => cikar(t)}>Bu agent’tan ayır</button>}
        <button type="button" className="metin-baglanti" onClick={() => { setAdlandir(t.id); setYeniAd(t.ad); ad.reset(); }}>Adlandır</button>
        {rutinKaldir && <button type="button" className="metin-baglanti mercan" onClick={() => rutinKaldir(t)}>Kaldır</button>}
      </span>}
      {adlandir === t.id && <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); const v = yeniAd.trim(); if (v) ad.mutate({ id: t.id, ad: v }); }}>
        <input className="alan" value={yeniAd} autoFocus onChange={(e) => setYeniAd(e.target.value)} aria-label={`${t.ad} rutininin adı`} maxLength={60} />
        <button type="submit" className="gd-alt-ekle-dugme" disabled={!yeniAd.trim() || ad.isPending}>Kaydet</button>
      </form>}
    </li>
  );
  const sonuc = kapsam.data;
  return (
    <AltSayfa acik kapat={kapat} baslik={a.ad} yukseklik="yuksek">
      <div className="ai-etkinlik agent-detay">
        <div className="ag-ust">
          <svg aria-hidden width="44" height="44" viewBox="4 0 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: agentIkonu(a, 26, 24, 1.3) }} />
          <h2 className="ai-etkinlik-baslik">{a.ad}</h2>
        </div>
        <p className="gd-satir">{agentCumlesi(a, !!veri.genel_rutin)}.</p>

        {kip === 'yonetim' && <section className="ai-grup" aria-label="Bağlantı">
          <h3 className="gd-bolum-baslik">BAĞLANTI</h3>
          <p className="gd-satir">{baglanti ? `${uygulamaOf(a.ad)} · ${baglanti.alt}` : `${uygulamaOf(a.ad)} bu hesaba bağlı görünmüyor. Bağlanınca ${a.ad} Devir’de yazabilir.`}</p>
          {!baglanti && kip === 'yonetim' && <button type="button" className="metin-baglanti" onClick={() => { kapat(); git(/chatgpt/i.test(uygulamaOf(a.ad)) ? '/bagla?uygulama=chatgpt' : '/bagla'); }}>{/chatgpt/i.test(uygulamaOf(a.ad)) ? 'ChatGPT’yi' : `${uygulamaOf(a.ad)}’u`} bağla</button>}
        </section>}

        <section className="ai-grup" aria-label="Rutinler">
          <h3 className="gd-bolum-baslik">RUTİN</h3>
          {bakan.length > 0 ? <ul className="ag-rutinler">{bakan.map((t) => rutinSatiri(t))}</ul>
            : <p className="gd-satir">Bu agent’ın işine bakan rutin yok; AI yapsın işleri kendiliğinden başlamaz.</p>}
          {kip === 'yonetim' && digerleri.length > 0 && <div className="ag-bagla">
            <p className="gd-satir">Rutinlerinden birini bu agent için de çalıştırabilirsin. Rutinin adı değişmez; başka agent’ları da kalır.</p>
            {digerleri.map((t) => <Dugme key={t.id} type="button" tur="ikincil" ton="lila" yukseklik={44} fs={14} mesgul={kapsam.isPending && kapsam.variables?.id === t.id} onClick={() => ekle(t)}>“{t.ad}” bu agent için de çalışsın</Dugme>)}
          </div>}
          {kip === 'yonetim' && !!a.ai_kapali && a.isleyen_rutin && <p className="gd-satir">{a.ai_kapali} açık işte AI yapsın kapalı. <button type="button" className="metin-baglanti" disabled={otoAc.isPending} onClick={() => otoAc.mutate()}>Hepsinde aç</button></p>}
          {kip === 'yonetim' && kurAc && <button type="button" className="metin-baglanti" onClick={() => kurAc(a.ad)}>{bakan.length ? 'Kurulum adımları' : `${a.ad} için rutin kur`}</button>}
          {(ad.isError || kapsam.isError) && <p className="canli-hata-satir" role="alert">{((ad.error || kapsam.error) as Error).message}</p>}
          {ad.data?.not && <p className="gd-satir" role="status">{ad.data.not}</p>}
          {sonuc?.not && <p className="gd-satir" role="status">{sonuc.not}{sonuc.acilan?.length ? <> <button type="button" className="metin-baglanti" disabled={geriAl.isPending} onClick={() => geriAl.mutate(sonuc.acilan)}>Geri al</button></> : null}</p>}
          {otoAc.data?.not && <p className="gd-satir" role="status">{otoAc.data.not}{otoAc.data.acilan?.length ? <> <button type="button" className="metin-baglanti" disabled={geriAl.isPending} onClick={() => geriAl.mutate(otoAc.data.acilan)}>Geri al</button></> : null}</p>}
        </section>

        <section className="ai-grup" aria-label="Özet">
          <p className="gd-satir">{a.acik_is ? `${a.acik_is} açık iş${a.sirada ? `; ${a.sirada} tanesi AI yapsın, sırası gelince başlar` : ''}.` : 'Açık işi yok.'}{a.son_etkinlik ? ` Son etkinlik ${zaman(a.son_etkinlik.zaman)}.` : ''}</p>
        </section>
        <AgentIsleri agent={a.ad} kapat={kapat} />
      </div>
    </AltSayfa>
  );
}
