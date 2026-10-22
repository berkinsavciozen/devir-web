import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { Metin } from '../../bilesen/Sahne';
import { gunAy, saat } from '../../cizim/yol.js';
import { ship } from '../../cizim/ortak.js';
import { kopyaIkon } from '../../cizim/ekran';
import { ozelEk, tarihEk } from '../../metin/turkce';
import { git } from '../../yonlendirme';

/** Görünen bağlantı: "alan.adı/l#k7Q2…wP9" (tam adres kopyalanır). Eski biçim /l/<belirteç> de okunur. */
export function kisaBaglanti(link: string): string {
  try {
    const u = new URL(link), t = u.hash.slice(1) || u.pathname.split('/l/')[1] || '';
    return `${u.host}/l#${t.length > 9 ? `${t.slice(0, 4)}…${t.slice(-3)}` : t}`;
  } catch { return link; }
}

/** WhatsApp adresi: iletişim bir telefon numarasıysa doğrudan o kişiye (0 ile başlayan TR numarası 90'la). */
export function whatsappAdresi(metin: string, iletisim?: string | null): string {
  const r = (iletisim || '').trim();
  let no = /^\+?[\d\s()-]{10,}$/.test(r) ? r.replace(/\D/g, '') : '';
  if (no.startsWith('0')) no = '90' + no.slice(1);
  return `https://wa.me/${no}?text=${encodeURIComponent(metin)}`;
}

/** Bağlantının durum cümlesi (P1-C): açık mı, en son ne zaman açıldı, ne zamana kadar açık. */
export function baglantiDurumu(k: any): { ust: string; alt: string } {
  const acilis = k.son_acilis ? `son açılış ${tarihEk(gunAy(Date.parse(k.son_acilis)), 'de')} ${saat(Date.parse(k.son_acilis))}${k.acilis_sayisi > 1 ? ` (${k.acilis_sayisi} kez)` : ''}` : 'henüz açılmadı';
  if (k.durum === 'iptal') return { ust: 'Bağlantı kapalı', alt: `Kapatıldı; ${acilis}.` };
  if (k.durum === 'suresi_doldu') return { ust: 'Süresi doldu', alt: 'Akış kapanalı 30 gün geçti; bağlantı açılmıyor.' };
  return { ust: `Açık · ${acilis}`, alt: k.gecerlilik ? `${tarihEk(gunAy(Date.parse(k.gecerlilik)), 'e')} kadar açık.` : 'Akış sürdükçe açık; kapanınca 30 gün daha açılır.' };
}

/** G1 · Dış katılımcıyla paylaşım (P1-C): kişisel bağlantı, düzenlenebilir mesaj, WhatsApp, önizleme, yenile, kapat (§5 G1). */
export function BaglantiGonder({ kod, kisi, kisiId, adimSayisi, kapat }: { kod: string; kisi: string; kisiId?: string | null; adimSayisi: number; kapat: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['katilimcilar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/katilimcilar`) });
  // bağlantı kişiye kimlikle bağlıdır (0.13.0); kimliği olmayan eski kayıtta ad eşleşmesi
  const k = (q.data?.katilimcilar || []).find((x: any) => kisiId && x.kisi_id ? x.kisi_id === kisiId : x.ad.toLocaleLowerCase('tr') === kisi.toLocaleLowerCase('tr'));
  const [iletisim, setIletisim] = useState('');
  const [metin, setMetin] = useState('');
  const [kopyalandi, setKopyalandi] = useState<null | 'metin' | 'baglanti'>(null);
  const [onay, setOnay] = useState<null | 'yenile' | 'kapat'>(null);
  // bağlantı yenilenince düzenlenmiş metindeki eski adres yenisiyle değişir
  const onceki = useRef<string | null>(null);
  useEffect(() => {
    const yeni = k?.link || null, eski = onceki.current;
    if (!yeni) return; // kapatılınca son bağlantı hatırlanır; yenisi metinde onun yerine geçer
    onceki.current = yeni;
    setMetin((m) => (m && eski && m.includes(eski) ? m.replace(eski, yeni) : m && !eski ? m : k.mesaj || ''));
  }, [k?.link, k?.mesaj]);
  const tazele = () => { void qc.invalidateQueries({ queryKey: ['katilimcilar', kod] }); void qc.invalidateQueries({ queryKey: ['katilimcilar-tum'] }); };
  const olustur = useMutation({ mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/katilimci`, { ad: kisi, kisi_id: kisiId || undefined, rol: 'dis', iletisim: iletisim.trim() || undefined }), onSuccess: tazele });
  const yenile = useMutation({ mutationFn: () => api.post<any>(`/katilimci/${k.id}/yenile`, {}), onSuccess: () => { setOnay(null); tazele(); } });
  const kapatM = useMutation({ mutationFn: () => api.post<any>(`/katilimci/${k.id}/iptal`, {}), onSuccess: () => { setOnay(null); tazele(); } });
  const tamMetin = () => (k?.link && !metin.includes(k.link) ? `${metin.trim()} ${k.link}`.trim() : metin);
  const kopyala = async (ne: 'metin' | 'baglanti') => { try { await navigator.clipboard.writeText(ne === 'metin' ? tamMetin() : k.link); setKopyalandi(ne); setTimeout(() => setKopyalandi(null), 1600); } catch { /* izin yok */ } };
  const y0 = 150, P = (y: number) => y - (y0 + 28);
  const gemi = ship(0, 0, 0, 'dis', '', '#F2B8D8', 1.05);
  const D = k?.durum ? baglantiDurumu(k) : null; // 0.19.0 öncesi sunucu durum vermez
  const ad = kisi.replace(/\s*\(.*\)$/, '');
  return (
    <>
      <AltSayfa acik={!onay} kapat={kapat} baslik={`${ad} ile paylaş`} yukseklik={y0} duraklar={['yuksek']}>
        <div className="karar-panel" style={{ height: 640 }}>
          <svg className="karar-cizim" aria-hidden width="60" height="60" viewBox="-30 -30 60 60" style={{ position: 'absolute', left: 16, top: P(y0 + 58) - 30, overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gemi }} />
          <Metin y={P(y0 + 58)} x={76} fs={22} lh={26} serif agirlik={700} as="h2" className="tek-satir">{kisi}</Metin>
          <Metin y={P(y0 + 80)} x={76} fs={12} lh={16} renk="ink3" className="tek-satir">Dış katılımcı · {k?.adim_sayisi ?? adimSayisi} adım · yalnız kendi adımlarını görür</Metin>
          {q.isPending ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor" style={{ position: 'absolute', top: P(y0 + 122), left: 20, right: 20 }}><span /><span /></div> : k ? <>
            {D && <div className={`baglanti-durum ${k.durum}`} style={{ top: P(y0 + 104) }} role="status">
              <b>{D.ust}</b><small>{D.alt}</small>
            </div>}
            {k.link ? <>
              <label className="dis-alan paylasim-metin" style={{ top: P(y0 + 186) - 21 }}>
                <span className="alan-etiket">Mesaj (gönderilmeden önce düzenlenebilir)</span>
                <textarea className="alan" rows={4} value={metin} onChange={(e) => setMetin(e.target.value)} aria-label="WhatsApp mesajı" />
              </label>
              {!metin.includes(k.link) && <Metin y={P(y0 + 302)} x={22} fs={12} lh={16} renk="mercan" className="tek-satir">Metinde bağlantı yok; gönderirken sonuna eklenir.</Metin>}
              <Dugme style={{ top: P(y0 + 316) }} fs={16} ikonX={92 - 20} kayma={10} onClick={() => window.open(whatsappAdresi(tamMetin(), k.iletisim), '_blank', 'noopener')}
                ikon={<svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><circle r="9" fill="none" stroke="#2A1D4F" strokeWidth="1.8" /><path d="M-6,8 L-8,10 L-4,9" fill="#2A1D4F" /></svg>}>WhatsApp’ta gönder</Dugme>
              <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: P(y0 + 380), right: 200 }} onClick={() => void kopyala('metin')}>{kopyalandi === 'metin' ? 'Kopyalandı' : 'Metni kopyala'}</Dugme>
              <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: P(y0 + 380), left: 200 }} onClick={() => git(`/akis/${encodeURIComponent(kod)}/onizleme/${encodeURIComponent(k.id)}`)}>Ne görecek?</Dugme>
              <div className="alan kopya-alani dis-baglanti" style={{ top: P(y0 + 442) }}>
                <span className="kopya-deger">{kopyalandi === 'baglanti' ? 'Bağlantı kopyalandı.' : kisaBaglanti(k.link)}</span>
                <button type="button" className="kopya-dugme" aria-label="Bağlantıyı kopyala" onClick={() => void kopyala('baglanti')}><svg aria-hidden width="44" height="44" viewBox="0 0 44 44" dangerouslySetInnerHTML={{ __html: kopyaIkon() }} /></button>
              </div>
              <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={14.5} style={{ top: P(y0 + 510), right: 200 }} onClick={() => setOnay('yenile')}>Yenile</Dugme>
              <Dugme tur="ikincil" ton="mercan" yukseklik={48} fs={14.5} style={{ top: P(y0 + 510), left: 200 }} onClick={() => setOnay('kapat')}>Bağlantıyı kapat</Dugme>
              <Metin y={P(y0 + 580)} fs={12} lh={16} renk="ink3" hiza="orta">{`${tarihEk(gunAy(Date.parse(k.olusturuldu)), 'de')} üretildi.`}<br />Yenilersen ya da kapatırsan eski bağlantı açılmaz.</Metin>
            </> : k.durum === 'suresi_doldu' ? null : <>
              {/* kapatılmış ya da gösterilemeyen (şifre anahtarı değişti) bağlantı: yenisi üretilir */}
              <Dugme style={{ top: P(y0 + 172) }} fs={16} mesgul={yenile.isPending} onClick={() => (k.durum === 'iptal' ? yenile.mutate() : setOnay('yenile'))}>{k.durum === 'iptal' ? 'Yeni bağlantı üret' : 'Bağlantıyı yenile'}</Dugme>
              {yenile.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 238) }}>{(yenile.error as Error).message}</p>}
            </>}
          </> : <>
            <label className="dis-alan" style={{ top: P(y0 + 122) - 21 }}><span className="alan-etiket">İletişim (isteğe bağlı)</span><input className="alan" value={iletisim} onChange={(e) => setIletisim(e.target.value)} placeholder="Telefon ya da e-posta" /></label>
            <Dugme style={{ top: P(y0 + 214) }} fs={16} mesgul={olustur.isPending} onClick={() => olustur.mutate()}>Bağlantı oluştur</Dugme>
            <Metin y={P(y0 + 290)} fs={12} lh={16} renk="ink3" hiza="orta">Telefon yazarsan WhatsApp mesajı doğrudan ona açılır.</Metin>
            {olustur.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 310) }}>{(olustur.error as Error).message}</p>}
          </>}
        </div>
      </AltSayfa>
      <AltSayfa acik={onay != null} kapat={() => setOnay(null)} baslik={onay === 'kapat' ? 'Bağlantı kapatılsın mı?' : 'Bağlantı yenilensin mi?'} yukseklik={500} duraklar={['orta']} guclu>
        <div className="karar-panel" style={{ height: 300 }}>
          <Metin y={P2(500 + 60)} fs={23} lh={28} serif agirlik={700} as="h2">{onay === 'kapat' ? 'Bağlantı kapatılsın mı?' : 'Bağlantı yenilensin mi?'}</Metin>
          <Metin y={P2(500 + 98)} fs={17} lh={22} serif renk="ink2">{onay === 'kapat' ? `${ozelEk(ad, 'in')} bağlantısı açılmaz; istersen sonra yenisini üretirsin.` : `${ozelEk(ad, 'in')} elindeki bağlantı artık açılmaz.`}</Metin>
          <Dugme tur="tehlike" style={{ top: P2(500 + 124) }} mesgul={onay === 'kapat' ? kapatM.isPending : yenile.isPending} onClick={() => (onay === 'kapat' ? kapatM.mutate() : yenile.mutate())}>{onay === 'kapat' ? 'Kapat' : 'Yenile'}</Dugme>
          <Dugme tur="ikincil" ton="lila" fs={15} style={{ top: P2(500 + 190) }} onClick={() => setOnay(null)}>Vazgeç</Dugme>
          {(onay === 'kapat' ? kapatM : yenile).isError && <p className="canli-hata" role="alert" style={{ top: P2(500 + 246) }}>{((onay === 'kapat' ? kapatM : yenile).error as Error).message}</p>}
        </div>
      </AltSayfa>
    </>
  );
}
const P2 = (y: number) => y - (500 + 28);
