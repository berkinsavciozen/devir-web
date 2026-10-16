import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, alanSecimi } from '../../api/istemci';
import { kimlik } from '../../api/kimlik';
import { oturumDegisti, sorguIstemcisi, useBen } from '../../api/sorgular';
import type { Ben, Davet, Uyelik } from '../../api/turler';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { galaxy, ship } from '../../cizim/ortak.js';
import { git } from '../../yonlendirme';

/** Alanın görünen adı: sahibin adıyla başlayan ön ek düşer ("Berkin · test çalışma alanı" → "test çalışma alanı"). */
export const alanAdi = (ad: string, kisi?: string | null) => (kisi && ad.startsWith(`${kisi} · `) ? ad.slice(kisi.length + 3) : ad);
export const rolAdi = (r: string) => (r === 'dis' ? 'dış' : r);

/** Kişi gemisi (insan: baş harf; dış: yelkenli). */
export function kisiGemi(ad: string, rol: string, sahip: boolean, x: number, y: number, sc = .85) {
  return rol === 'dis' ? ship(x, y + 2, 0, 'dis', '', '#F2B8D8', sc * .96) : ship(x, y, -12, 'insan', (ad[0] || '?').toLocaleUpperCase('tr'), sahip ? '#FFC9A3' : '#9EE6CF', sc, { flame: false });
}
export const Svg = ({ w, h, x, y, svg, sinif }: { w: number; h: number; x: number; y: number; svg: string; sinif?: string }) => (
  <svg aria-hidden className={sinif} width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} style={{ position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: svg }} />
);
const alanIkon = (x: number, y: number, renk: string) => `<g transform="translate(${x},${y})"><circle r="15" fill="url(#glowLilac)"/>${galaxy(0, 0, Array.from({ length: 5 }, () => ({ state: 'lit' })), { scale: .26, seed: 4, rot: -14, pr: 1.6 })}<circle r="15" fill="none" stroke="${renk}" stroke-opacity=".6"/></g>`;
const zarfIkon = (x: number, y: number, sc: number) => `<g transform="translate(${x},${y}) scale(${sc})"><rect x="-40" y="-28" width="80" height="56" rx="10" fill="url(#btn)"/><path d="M-36,-24 L0,4 L36,-24" fill="none" stroke="#2A1D4F" stroke-opacity=".55" stroke-width="2.4" stroke-linejoin="round"/><path d="M-36,24 L-12,2 M36,24 L12,2" stroke="#2A1D4F" stroke-opacity=".25" stroke-width="1.6"/></g>`;
export const Ok = () => <svg aria-hidden className="satir-ok" width="12" height="16" viewBox="-6 -8 12 16"><path d="M-3,-6 L3,0 L-3,6" stroke="#B9A6F2" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>;
export const Tik = ({ r = 10 }: { r?: number }) => <svg aria-hidden className="satir-tik" width={r * 2} height={r * 2} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}><circle r={r} fill="#FFD27A" /><path d="M-4.5,0 L-1.2,3.4 L4.8,-3.4" stroke="#2A1D4F" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;

/** Satır kartı (son-090 satirKart): ikon x+26, üst/alt yazı x+58; sağda tik, ok ya da eylem. */
export function SatirKart({ y, h = 58, ikon, ust, alt, sec, sag, onClick, etiket, x = 20, w = 350 }: { y: number; h?: number; ikon: string; ust: ReactNode; alt?: ReactNode; sec?: boolean; sag?: ReactNode; onClick?: () => void; etiket?: string; x?: number; w?: number }) {
  const Etiket = onClick ? 'button' : 'div';
  return (
    <Etiket type={onClick ? 'button' : undefined} className={`kart satir-kart ${sec ? 'secili' : ''}`} style={{ left: x, top: y, width: w, height: h }} onClick={onClick} aria-label={etiket} aria-current={sec || undefined}>
      <svg aria-hidden width="52" height={h} viewBox={`0 0 52 ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ikon }} />
      <span className="satir-metin"><b>{ust}</b>{alt != null && <small>{alt}</small>}</span>
      {sag ?? (sec ? <Tik /> : onClick ? <Ok /> : null)}
    </Etiket>
  );
}

/** K3 · Avatar sayfası: kişi, çalışma alanları, davet, Ayarlar (sahip), Çıkış (§5 K3). */
export function HesapSayfasi({ kapat }: { kapat: () => void }) {
  const ben = useBen().data as Ben | undefined;
  const [hata, setHata] = useState<string | null>(null);
  const katil = useMutation({
    mutationFn: (d: Davet) => api.post<{ katildi: { alan_id: string } }>('/kayit', { davet: d.id }),
    onSuccess: (r) => alanaGec(r.katildi.alan_id),
    onError: (e) => setHata((e as Error).message),
  });
  if (!ben) return null;
  const U: Uyelik[] = ben.uyelikler || [], D: Davet[] = ben.bekleyen_davetler || [];
  const acikAlan = ben.calisma_alani?.id;
  // yerleşim: bölüm başlığı L, satırlar L+12'den 66 arayla; çizgi son satırın 18 altında (son-090 K3)
  let L = 108, cizgi = 96;
  const alanL = U.length > 1 ? L : null;
  if (alanL != null) { const son = alanL + 12 + U.length * 66 - 8; cizgi = son + 18; L = son + 26; }
  const davetL = D.length ? L : null;
  if (davetL != null) { const son = davetL + 12 + D.length * 66 - 8; cizgi = son + 18; }
  const y0 = Math.max(120, 844 - (cizgi + 134)), P = (y: number) => y - 28;
  const sahip = ben.rol === 'sahip';
  return (
    <AltSayfa acik kapat={kapat} baslik="Hesap" yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <div className="karar-panel hesap-panel" style={{ height: cizgi + 134 - 28 }}>
        <Svg w={60} h={60} x={16} y={P(52) - 30} svg={kisiGemi(ben.kisi || '', 'insan', true, 46, P(52), 1)} />
        <b className="hesap-ad" style={{ top: P(48) - 15 }}>{ben.kisi}</b>
        <small className="hesap-eposta" style={{ top: P(68) - 12 }}>{ben.eposta}</small>
        {alanL != null && <>
          <h3 className="bolum-baslik" style={{ top: P(alanL) - 12 }}>ÇALIŞMA ALANLARI</h3>
          {U.map((u, i) => {
            const sec = u.alan_id === acikAlan, y = P(alanL + 12 + i * 66);
            return <SatirKart key={u.alan_id} y={y} ikon={alanIkon(26, 29, sec ? '#FFD27A' : '#8E80D6')} ust={alanAdi(u.alan, u.kisi)} alt={`${rolAdi(u.rol)}${sec ? ' · şu an açık' : ''}`} sec={sec} onClick={sec ? undefined : () => alanaGec(u.alan_id)} etiket={sec ? undefined : `${alanAdi(u.alan, u.kisi)} alanına geç`} />;
          })}
        </>}
        {davetL != null && <>
          <h3 className="bolum-baslik" style={{ top: P(davetL) - 12 }}>DAVET</h3>
          {D.map((d, i) => (
            <SatirKart key={d.id} y={P(davetL + 12 + i * 66)} ikon={`<g transform="translate(26,29)"><circle r="15" fill="#1E1645" stroke="#F2B8D8" stroke-dasharray="2 3"/>${zarfIkon(0, 0, .22)}</g>`}
              ust={alanAdi(d.alan || '', d.davet_eden)} alt={`${rolAdi(d.rol)}${d.davet_eden ? ` · ${d.davet_eden} davet etti` : ''}`}
              sag={<button type="button" className="satir-eylem altin" onClick={() => katil.mutate(d)} disabled={katil.isPending}>Katıl</button>} />
          ))}
        </>}
        {hata && <p className="canli-hata" role="alert" style={{ top: P(cizgi) - 22 }}>{hata}</p>}
        <hr className="hesap-cizgi" style={{ top: P(cizgi) }} />
        {sahip && <button type="button" className="hesap-satir" style={{ top: P(cizgi + 34) - 22 }} onClick={() => git('/ayarlar')}>
          <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><circle r="9" fill="none" stroke="#D9CCFF" strokeWidth="1.6" /><circle r="3" fill="#D9CCFF" /></svg><span>Ayarlar</span><Ok />
        </button>}
        <button type="button" className="hesap-satir cikis" style={{ top: P(cizgi + (sahip ? 86 : 34)) - 22 }} onClick={cikisYap}>
          <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M2,-7 L-6,-7 L-6,7 L2,7 M-1,0 L9,0 M5,-4 L9,0 L5,4" stroke="#FFB4A8" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Çıkış yap</span>
        </button>
      </div>
    </AltSayfa>
  );
}

/** Alan değiştir: başlık değişir, seçim cihazda kalır, önbellek temizlenir, evren yeniden çekilir (§5 K3). */
export function alanaGec(id: string) { alanSecimi.koy(id); sorguIstemcisi.clear(); oturumDegisti(); git('/', { yerine: true }); }
async function cikisYap() { await kimlik.cikis(); alanSecimi.koy(null); oturumDegisti(); git('/', { yerine: true }); }

export const useUyeler = () => useQuery({ queryKey: ['uyeler'], queryFn: () => api.get<any>('/uyeler') });
