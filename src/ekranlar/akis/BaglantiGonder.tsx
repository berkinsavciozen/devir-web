import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { Metin } from '../../bilesen/Sahne';
import { gunAy } from '../../cizim/yol.js';
import { ship } from '../../cizim/ortak.js';
import { kopyaIkon } from '../../cizim/ekran';
import { ozelEk, tarihEk } from '../../metin/turkce';

/** Görünen bağlantı: "alan.adı/l#k7Q2…wP9" (tam adres kopyalanır). Eski biçim /l/<belirteç> de okunur. */
export function kisaBaglanti(link: string): string {
  try {
    const u = new URL(link), t = u.hash.slice(1) || u.pathname.split('/l/')[1] || '';
    return `${u.host}/l#${t.length > 9 ? `${t.slice(0, 4)}…${t.slice(-3)}` : t}`;
  } catch { return link; }
}

/** G1 · Dış katılımcıya bağlantı: kişisel bağlantı, WhatsApp, kopyala, yenile (§5 G1). */
export function BaglantiGonder({ kod, kisi, kisiId, adimSayisi, kapat }: { kod: string; kisi: string; kisiId?: string | null; adimSayisi: number; kapat: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['katilimcilar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/katilimcilar`) });
  // bağlantı kişiye kimlikle bağlıdır (0.13.0); kimliği olmayan eski kayıtta ad eşleşmesi
  const k = (q.data?.katilimcilar || []).find((x: any) => kisiId && x.kisi_id ? x.kisi_id === kisiId : x.ad.toLocaleLowerCase('tr') === kisi.toLocaleLowerCase('tr'));
  const [iletisim, setIletisim] = useState('');
  const [kopyalandi, setKopyalandi] = useState(false);
  const [onay, setOnay] = useState(false);
  const tazele = () => qc.invalidateQueries({ queryKey: ['katilimcilar', kod] });
  const olustur = useMutation({ mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/katilimci`, { ad: kisi, kisi_id: kisiId || undefined, rol: 'dis', iletisim: iletisim.trim() || undefined }), onSuccess: tazele });
  const yenile = useMutation({ mutationFn: () => api.post<any>(`/katilimci/${k.id}/yenile`, {}), onSuccess: () => { setOnay(false); void tazele(); } });
  const kopyala = async () => { try { await navigator.clipboard.writeText(k.link); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 1600); } catch { /* izin yok */ } };
  const y0 = 330, P = (y: number) => y - (y0 + 28);
  const gemi = ship(0, 0, 0, 'dis', '', '#F2B8D8', 1.05);
  return (
    <>
      <AltSayfa acik={!onay} kapat={kapat} baslik={kisi} yukseklik={y0} duraklar={['orta', 'yuksek']}>
        <div className="karar-panel" style={{ height: 420 }}>
          <svg className="karar-cizim" aria-hidden width="60" height="60" viewBox="-30 -30 60 60" style={{ position: 'absolute', left: 16, top: P(y0 + 58) - 30, overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gemi }} />
          <Metin y={P(y0 + 58)} x={76} fs={22} lh={26} serif agirlik={700} as="h2" className="tek-satir">{kisi}</Metin>
          <Metin y={P(y0 + 80)} x={76} fs={12} lh={16} renk="ink3" className="tek-satir">Dış katılımcı · {adimSayisi} adım · yalnız kendi adımlarını görür</Metin>
          {q.isPending ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor" style={{ position: 'absolute', top: P(y0 + 122), left: 20, right: 20 }}><span /><span /></div> : k?.link ? <>
            <span className="alan-etiket dis-alan-etiket" style={{ position: 'absolute', left: 22, top: P(y0 + 122) - 20 }}>Kişisel bağlantı</span>
            <div className="alan kopya-alani dis-baglanti" style={{ top: P(y0 + 122) }}>
              <span className="kopya-deger">{kisaBaglanti(k.link)}</span>
              <button type="button" className="kopya-dugme" aria-label="Bağlantıyı kopyala" onClick={kopyala}><svg aria-hidden width="44" height="44" viewBox="0 0 44 44" dangerouslySetInnerHTML={{ __html: kopyaIkon() }} /></button>
            </div>
            <Metin y={P(y0 + 192)} fs={12} lh={16} agirlik={600} renk="ink3">{kopyalandi ? 'Kopyalandı.' : `${tarihEk(gunAy(Date.parse(k.olusturuldu)), 'de')} üretildi`}</Metin>
            <Dugme style={{ top: P(y0 + 214) }} fs={16} ikonX={92 - 20} kayma={10} onClick={() => window.open(k.whatsapp, '_blank', 'noopener')}
              ikon={<svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><circle r="9" fill="none" stroke="#2A1D4F" strokeWidth="1.8" /><path d="M-6,8 L-8,10 L-4,9" fill="#2A1D4F" /></svg>}>WhatsApp’ta gönder</Dugme>
            <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: P(y0 + 280), right: 200 }} onClick={kopyala}>{kopyalandi ? 'Kopyalandı' : 'Kopyala'}</Dugme>
            <Dugme tur="ikincil" ton="mercan" yukseklik={50} fs={15} style={{ top: P(y0 + 280), left: 200 }} ikonX={44} kayma={10} onClick={() => setOnay(true)}
              ikon={<svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><path d="M5,-4 A6.5,6.5 0 1 0 6,3" fill="none" stroke="#FFB4A8" strokeWidth="1.7" strokeLinecap="round" /><path d="M6,-8 L6,-3 L1,-3" fill="none" stroke="#FFB4A8" strokeWidth="1.7" strokeLinecap="round" /></svg>}>Yenile</Dugme>
            <Metin y={P(y0 + 356)} fs={12} lh={16} renk="ink3" hiza="orta">Yenilersen eski bağlantı artık açılmaz.</Metin>
          </> : <>
            <label className="dis-alan" style={{ top: P(y0 + 122) - 21 }}><span className="alan-etiket">İletişim (isteğe bağlı)</span><input className="alan" value={iletisim} onChange={(e) => setIletisim(e.target.value)} placeholder="Telefon ya da e-posta" /></label>
            {/* bağlantı var ama gösterilemiyor (şifre anahtarı değişti): yalnız yenilenebilir */}
            <Dugme style={{ top: P(y0 + 214) }} fs={16} mesgul={olustur.isPending} onClick={() => (k ? setOnay(true) : olustur.mutate())}>{k ? 'Bağlantıyı yenile' : 'Bağlantı oluştur'}</Dugme>
            {olustur.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 280) }}>{(olustur.error as Error).message}</p>}
          </>}
        </div>
      </AltSayfa>
      <AltSayfa acik={onay} kapat={() => setOnay(false)} baslik="Bağlantı yenilensin mi?" yukseklik={500} duraklar={['orta']}>
        <div className="karar-panel" style={{ height: 300 }}>
          <Metin y={P2(500 + 60)} fs={23} lh={28} serif agirlik={700} as="h2">Bağlantı yenilensin mi?</Metin>
          <Metin y={P2(500 + 98)} fs={17} lh={22} serif renk="ink2">{ozelEk(kisi.replace(/\s*\(.*\)$/, ''), 'in')} elindeki bağlantı artık açılmaz.</Metin>
          <Dugme tur="tehlike" style={{ top: P2(500 + 124) }} mesgul={yenile.isPending} onClick={() => yenile.mutate()}>Yenile</Dugme>
          <Dugme tur="ikincil" ton="lila" fs={15} style={{ top: P2(500 + 190) }} onClick={() => setOnay(false)}>Vazgeç</Dugme>
          {yenile.isError && <p className="canli-hata" role="alert" style={{ top: P2(500 + 246) }}>{(yenile.error as Error).message}</p>}
        </div>
      </AltSayfa>
    </>
  );
}
const P2 = (y: number) => y - (500 + 28);
