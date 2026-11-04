import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { planet } from '../../cizim/ortak.js';
import { gunAy, otoRozet, saat } from '../../cizim/yol.js';
import { adimAdi } from '../../metin/turkce';
import { git } from '../../yonlendirme';

/**
 * W6 (4 Kas, Berkin 11:39): agent detayında agent'ın bütün işleri, AI durumuna göre gruplu (çalışıyor, onayını bekliyor,
 * yapamadı, sırada, AI kapalı, bitti). Her satır akışı ve AI durumunu söyler; dokununca o işin çalışma geçmişi açılır
 * (rutin başladı, yazdı, onay bekledi, yapamadı, onaylandı; zamanı ve oturum bağlantısıyla).
 */
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'suruyor' ? 'run' : a.durum === 'hazir' ? 'wait' : 'dark');
const ikon = (a: any) => planet(0, 0, 11, durumGor(a), { life: true, waitRings: 1, cloudGap: 2, karar: a.karar_adimi && !BITTI(a.durum), oto: BITTI(a.durum) ? null : otoRozet(a) });
const zaman = (t: string | null | undefined) => (t ? `${gunAy(Date.parse(t))} ${saat(Date.parse(t))}` : '');
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

type Grup = 'calisiyor' | 'bakilacak' | 'hata' | 'sirada' | 'kapali' | 'bitti';
export const GRUP_AD: Record<Grup, string> = { calisiyor: 'ÇALIŞIYOR', bakilacak: 'ONAYINI BEKLİYOR', hata: 'YAPAMADI', sirada: 'AI YAPSIN · SIRADA', kapali: 'AI KAPALI', bitti: 'BİTTİ' };
export const isGrubu = (a: any): Grup => {
  if (BITTI(a.durum)) return 'bitti';
  if (!a.oto) return 'kapali';
  const r = otoRozet(a);
  return r === 'bekliyor' || !r ? 'sirada' : (r as Grup);
};
/** Satırın alt cümlesi: akış · AI durumu · zaman */
export function isAlt(a: any): string {
  const g = isGrubu(a);
  const ne = g === 'calisiyor' ? 'rutin üzerinde çalışıyor' : g === 'bakilacak' ? 'çıktıyı yazdı, bakıp onayla' : g === 'hata' ? (a.engel || 'rutin bitiremedi') : g === 'sirada' ? (a.durum === 'hazir' ? 'hazır, bir sonraki çalışmada başlar' : 'öncülleri bitince başlar') : g === 'kapali' ? (a.durum === 'hazir' || a.durum === 'suruyor' ? 'hazır; AI yapsın kapalı' : 'AI yapsın kapalı') : a.durum === 'atlandi' ? 'atlandı' : 'bitti';
  const t = g === 'bitti' ? (a.durum_at ? gunAy(Date.parse(a.durum_at)) : '') : a.son_tarih ? `son ${gunAy(tarihMs(a.son_tarih))}` : '';
  return [a.akis_kisa_ad || a.akis_baslik, ne, t].filter(Boolean).join(' · ');
}

const OLAY: Record<string, string> = { oto_tetik: 'Rutin başladı', oto_bakilacak: 'Çıktıyı yazdı, onay bekliyor', oto_hata: 'Yapamadı', oto_engel: 'Takıldı', onaylandi: 'Onaylandı', agent: 'Yazdı' };

function Gecmis({ a, kapat }: { a: any; kapat: () => void }) {
  const q = useQuery({ queryKey: ['adim-ai', a.akis, a.no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(a.akis)}/adim/${a.no}/ai`), retry: false });
  const L: any[] = q.data?.olaylar || [];
  const ad = q.data?.adim;
  return (
    <div className="ag-gecmis">
      {q.isPending ? <p className="gd-satir">Yükleniyor…</p> : q.isError ? <p className="gd-satir">Çalışma geçmişi alınamadı.</p> : <>
        {ad?.bekledigi && ad.bekledigi !== 'sürüyor' && !BITTI(a.durum) && <p className="gd-satir">Bekliyor: {ad.bekledigi}</p>}
        {L.length ? <ol className="ai-cizelge" aria-label={`${a.ad}: çalışma geçmişi`}>{[...L].reverse().map((e) => (
          <li key={e.id} className={`ai-olay ${e.tur === 'oto_bakilacak' ? 'bakilacak' : e.tur === 'onaylandi' ? 'onay' : e.tur === 'oto_hata' || e.tur === 'oto_engel' ? 'hata' : 'agent'}`}>
            <time dateTime={e.zaman}>{zaman(e.zaman)}{e.kim ? ` · ${e.kim}` : ''}</time>
            <b>{OLAY[e.tur] || e.tur}</b>
            {e.ozet && <span>{e.ozet}</span>}
            {e.oturum && <a className="metin-baglanti" href={e.oturum} target="_blank" rel="noopener noreferrer">Oturumu aç</a>}
          </li>
        ))}</ol> : <p className="gd-satir">Henüz çalışma yok.</p>}
      </>}
      <span className="ag-gecmis-eylem">
        <button type="button" className="metin-baglanti" onClick={() => { kapat(); git(`/akis/${encodeURIComponent(a.akis)}/adim/${a.no}`); }}>Göreve git</button>
        {ad?.oto_oturum && <a className="metin-baglanti" href={ad.oto_oturum} target="_blank" rel="noopener noreferrer">Son oturumu aç</a>}
      </span>
    </div>
  );
}

export function AgentIsleri({ agent, kapat }: { agent: string; kapat: () => void }) {
  const q = useQuery({ queryKey: ['gorevler', `kisi=${agent}&durum=hepsi`], queryFn: () => api.get<any>(`/gorevler?${new URLSearchParams({ kisi: agent, durum: 'hepsi' })}`), retry: false });
  const [acik, setAcik] = useState<string | null>(null);
  const [bitenler, setBitenler] = useState(false);
  const L: any[] = (q.data?.gorevler || []).filter((a: any) => a.sahip === agent);
  const sira: Grup[] = ['calisiyor', 'bakilacak', 'hata', 'sirada', 'kapali', 'bitti'];
  if (q.isPending) return <p className="gd-satir">İşler yükleniyor…</p>;
  if (!L.length) return <p className="gd-satir">{q.isError ? 'İşler alınamadı.' : 'Bu agent’ın görevi yok.'}</p>;
  return <>{sira.map((g) => {
    // akış bazlı: grup içinde akışa göre, akış içinde görev numarasıyla
    const G = L.filter((a) => isGrubu(a) === g).sort((x, y) => String(x.akis_kisa_ad || x.akis).localeCompare(String(y.akis_kisa_ad || y.akis), 'tr') || x.no - y.no);
    if (!G.length) return null;
    const goster = g === 'bitti' && !bitenler ? G.slice(0, 3) : G;
    return (
      <section key={g} className="ai-grup" aria-label={GRUP_AD[g]}>
        <h3 className="gd-bolum-baslik">{GRUP_AD[g]} · {G.length}</h3>
        <ul className="gd-baglar ag-isler">{goster.map((a) => {
          const k = `${a.akis}:${a.no}`;
          return (
            <li key={k}>
              <button type="button" className="gd-bag" aria-expanded={acik === k} onClick={() => setAcik(acik === k ? null : k)}>
                <svg aria-hidden width="30" height="30" viewBox="-15 -15 30 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ikon(a) }} />
                <span><b>{a.no}. {adimAdi(a)}</b><small>{isAlt(a)}</small></span>
              </button>
              {acik === k && <Gecmis a={a} kapat={kapat} />}
            </li>
          );
        })}</ul>
        {g === 'bitti' && G.length > 3 && <button type="button" className="metin-baglanti" onClick={() => setBitenler((x) => !x)}>{bitenler ? 'Daha az göster' : `Bitenlerin hepsini göster (${G.length})`}</button>}
      </section>
    );
  })}</>;
}
