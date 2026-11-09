import { AltSayfa } from '../../bilesen/AltSayfa';
import { planet } from '../../cizim/ortak.js';
import { gunAy, otoRozet, saat } from '../../cizim/yol.js';
import { adimAdi } from '../../metin/turkce';
import { git } from '../../yonlendirme';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'suruyor' ? 'run' : a.durum === 'hazir' ? 'wait' : 'dark');
const ikon = (a: any) => planet(0, 0, 10, durumGor(a), { life: false, cloudGap: 2, oto: BITTI(a.durum) ? null : otoRozet(a) });

/** Akıştaki AI yapsın işlerinin özeti: kaç tanesi onay bekliyor, çalışıyor, yapamadı, bekliyor. */
export function aiOzeti(adimlar: any[]) {
  const ai = adimlar.filter((a) => a.oto && !BITTI(a.durum));
  const say = (r: string) => ai.filter((a) => otoRozet(a) === r);
  return { toplam: ai.length, onay: say('bakilacak'), calisiyor: say('calisiyor'), hata: say('hata'), bekliyor: say('bekliyor') };
}

/** Haritadaki "AI" çipinin yazısı; AI işi yoksa null. */
export function aiCipYazisi(adimlar: any[]): string | null {
  const o = aiOzeti(adimlar);
  if (!o.toplam && !adimlar.some((a) => a.oto)) return null;
  if (o.onay.length) return `AI · ${o.onay.length} onay`;
  if (o.hata.length) return `AI · ${o.hata.length} yapamadı`;
  if (o.calisiyor.length) return 'AI · çalışıyor';
  return 'AI';
}

const OLAY: Record<string, string> = { basladi: 'başladı', bakilacak: 'çıktıyı yazdı, onay bekliyor', hata: 'yapamadı' };

/**
 * W2 (4 Kas, B8, B19): akıştaki AI etkinliği. Üstte şu anki durum (onay bekleyen, çalışan, yapamayan, bekleyen),
 * altta zaman çizelgesi: AI başladı, yazdı, onay bekliyor, onaylandı; oturum bağlantıları.
 */
export function AiEtkinligi({ acik, kapat, kod, d }: { acik: boolean; kapat: () => void; kod: string; d: any }) {
  const adimlar: any[] = d?.adimlar || [];
  const by = new Map<number, any>(adimlar.map((a) => [a.no, a]));
  const o = aiOzeti(adimlar);
  const otoNo = new Set(adimlar.filter((a) => a.oto).map((a) => a.no));
  const olaylar = ((d?.olaylar || []) as any[]).filter((e) => e.adim_no != null && otoNo.has(e.adim_no) && (e.ai || (e.kim_tip === 'agent' && e.tip !== 'okuma') || (e.tip === 'durum' && e.durum === 'tamam')))
    .map((e) => ({ ...e, ne: e.ai ? OLAY[e.ai] : e.tip === 'durum' && e.durum === 'tamam' ? `onaylandı (${e.kim})` : e.ozet }))
    .slice(0, 30);
  const ac = (no: number) => { kapat(); git(`/akis/${encodeURIComponent(kod)}/adim/${no}`); };
  const grup = (baslik: string, L: any[], alt: (a: any) => string) => L.length > 0 && (
    <section className="ai-grup" aria-label={baslik}>
      <h3 className="gd-bolum-baslik">{baslik} · {L.length}</h3>
      <ul className="gd-baglar">{L.map((a) => (
        <li key={a.no}>
          <button type="button" className="gd-bag" onClick={() => ac(a.no)}>
            <svg aria-hidden width="28" height="28" viewBox="-14 -14 28 28" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ikon(a) }} />
            <span><b>{a.no}. {adimAdi(a)}</b><small>{alt(a)}</small></span>
          </button>
          {a.oto_oturum && <a className="metin-baglanti ai-oturum" href={a.oto_oturum} target="_blank" rel="noopener noreferrer">Oturumu aç</a>}
        </li>
      ))}</ul>
    </section>
  );
  return (
    <AltSayfa acik={acik} kapat={kapat} baslik="AI etkinliği" yukseklik="yuksek">
      <div className="ai-etkinlik" role="dialog" aria-label="AI etkinliği">
        <h2 className="ai-etkinlik-baslik">AI etkinliği</h2>
        <p className="gd-satir">{o.toplam ? `Bu akışta ${o.toplam} açık AI yapsın işi var${o.onay.length ? `; ${o.onay.length} tanesi onayını bekliyor` : ''}.` : 'Bu akışta açık AI yapsın işi yok.'}</p>
        {grup('ONAYINI BEKLİYOR', o.onay, (a) => `${a.sahip} çıktıyı yazdı; bakıp onayla`)}
        {grup('YAPAMADI', o.hata, (a) => a.engel || 'Rutin bitiremedi; yeniden dene')}
        {grup('ÇALIŞIYOR', o.calisiyor, (a) => `${a.sahip} şu an bunun üzerinde`)}
        {grup('SIRADA', o.bekliyor, (a) => (a.oto_bekledigi ? `bekliyor: ${a.oto_bekledigi}` : 'hazır olunca başlayacak'))}
        <section className="ai-grup" aria-label="Zaman çizelgesi">
          <h3 className="gd-bolum-baslik">ZAMAN ÇİZELGESİ</h3>
          {olaylar.length ? <ol className="ai-cizelge">{olaylar.map((e) => (
            <li key={e.id} className={`ai-olay ${e.ai || (e.tip === 'durum' && e.durum === 'tamam' ? 'onay' : e.durum === 'engelli' ? 'hata' : 'agent')}`}>
              <time dateTime={e.zaman}>{gunAy(Date.parse(e.zaman))} {saat(Date.parse(e.zaman))}</time>
              <button type="button" className="metin-baglanti" onClick={() => ac(e.adim_no)}>{e.adim_no}. {by.get(e.adim_no) ? adimAdi(by.get(e.adim_no)) : ''}</button>
              <span>{e.ne}</span>
            </li>
          ))}</ol> : <p className="gd-satir">Henüz AI etkinliği yok.</p>}
        </section>
      </div>
    </AltSayfa>
  );
}
