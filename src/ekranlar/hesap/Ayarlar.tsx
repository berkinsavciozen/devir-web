import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { API_TABAN, SAHTE } from '../../api/ortam';
import { sorguIstemcisi, useBen } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { gunAy, saat } from '../../cizim/yol.js';
import { kopyaIkon, tikIkon } from '../../cizim/ekran';
import { ship } from '../../cizim/ortak.js';
import { Segment } from '../akis/Adim';
import { arama, git } from '../../yonlendirme';
import type { Ben } from '../../api/turler';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { hareketKoy, hareketSecimi } from '../../ayar/hareket';
import { akisErisimi, ekipOzeti, ekipSayilari, RolTablosu, ROL_TABLO_H } from './Roller';
import { alanAdi, alanIkon, HesapIcerik, hesapYuksekligi, kisiGemi, rolAdi, SatirKart, Svg, useUyeler } from './Hesap';

const GOK = { tohum: 17, yildiz: 200 };
const MCP_TABAN = () => (SAHTE ? 'https://sahte.devir/functions/v1/devir-mcp' : API_TABAN);
const kisaMcp = (a: string) => { const i = a.indexOf('/functions/'); return i >= 0 ? '…' + a.slice(i).replace(/\/dv_\S+$/, '/dv_••••') : a; };

/** Kopyalanabilir alan (değer kısaltılmış görünür, tamamı kopyalanır). */
export function KopyaAlan({ deger, gosterim, etiket, style }: { deger: string; gosterim: string; etiket: string; style: React.CSSProperties }) {
  const [tamam, setTamam] = useState(false);
  const kopyala = async () => { try { await navigator.clipboard.writeText(deger); setTamam(true); setTimeout(() => setTamam(false), 1400); } catch { /* izin yok */ } };
  return (
    <div className="alan kopya-alani dis-baglanti" style={style}>
      <span className="kopya-deger" aria-label={etiket}>{gosterim}</span>
      <button type="button" className="kopya-dugme" aria-label={tamam ? 'Kopyalandı' : `${etiket} kopyala`} onClick={kopyala}><svg aria-hidden width="44" height="44" viewBox="0 0 44 44" dangerouslySetInnerHTML={{ __html: tamam ? tikIkon() : kopyaIkon() }} /></button>
      <span className="gorunmez" role="status">{tamam ? 'Kopyalandı' : ''}</span>
    </div>
  );
}

const sonKullanim = (t: string | null) => (t ? `Son kullanım ${gunAy(Date.parse(t))}` : 'Hiç kullanılmadı');

const SEKMELER = ['Alan', 'Bağlantılar', 'Hesap', 'Görünüm'] as const;
const SEKME_KOD = ['alan', 'baglantilar', 'hesap', 'gorunum'] as const;

/**
 * K1 · Ayarlar, dört sekme (denetim planı, CELISKILER 62): Alan (ekip, roller) · Bağlantılar (Claude, anahtarlar) ·
 * Hesap (kişi, alanlar, davetler, çıkış) · Görünüm (hareket). Sahip olmayan da açar; yönetim satırları yalnız sahibe.
 */
export function Ayarlar() {
  const ben = useBen().data as Ben | undefined;
  const sahip = ben?.rol === 'sahip';
  const an = useQuery({ queryKey: ['anahtarlar'], queryFn: () => api.get<any>('/anahtarlar'), enabled: sahip });
  const uy = useUyeler(sahip);
  const s0 = Math.max(0, SEKME_KOD.indexOf((arama().get('sekme') || 'alan') as any));
  const [sekme, setSekme] = useState(s0);
  const sec = (i: number) => { setSekme(i); git(`/ayarlar?sekme=${SEKME_KOD[i]}`, { yerine: true }); };
  const [iptal, setIptal] = useState<any>(null);
  const [yeni, setYeni] = useState(false);
  const [hareket, setHareket] = useState(hareketSecimi());
  const geri = () => (history.length > 1 ? history.back() : git('/'));
  const sira = (k: any) => (k.ben ? 0 : k.kisi === ben?.kisi ? 1 : 2) + (k.iptal ? 3 : 0);
  const L: any[] = [...(an.data?.anahtarlar || [])].sort((a, b) => sira(a) - sira(b) || String(a.olusturuldu).localeCompare(String(b.olusturuldu)));
  const son = L.map((k) => k.son_kullanim).filter(Boolean).sort().pop() as string | undefined;
  const sayi = ekipSayilari(uy.data?.uyeler || [], uy.data?.davetler || [], an.data?.anahtarlar);
  const ikili = ship(38 - 20, 337 - 304, -12, 'insan', 'S', '#9EE6CF', .62, { flame: false }) + ship(52 - 20, 344 - 304, 0, 'dis', '', '#F2B8D8', .6);
  const Y = 200;
  let govde: ReactNode = null, h = Y;
  if (sekme === 0) {
    const alanSatiri = <SatirKart y={Y + 14} h={66} ikon={alanIkon(26, 33, '#FFD27A')} ust={alanAdi(ben?.calisma_alani?.ad || '', ben?.kisi)} alt={`senin rolün ${rolAdi(ben?.rol || '')}${ben?.rol === 'ekip' && akisErisimi(ben?.kapsam) ? ` · ${akisErisimi(ben?.kapsam)!.length} akış` : ''}`} />;
    const ekipY = Y + 14 + 66 + 34;
    const rolY = sahip ? ekipY + 14 + 66 + 34 : ekipY;
    govde = <>
      <h3 className="bolum-baslik" style={{ top: Y - 12 }}>ÇALIŞMA ALANI</h3>
      {alanSatiri}
      {sahip && <>
        <h3 className="bolum-baslik" style={{ top: ekipY - 12 }}>EKİP</h3>
        <SatirKart y={ekipY + 14} h={66} ikon={ikili} ust="Üyeler ve davetler" alt={uy.isPending ? '…' : ekipOzeti(sayi)} onClick={() => git('/ayarlar/ekip')} />
      </>}
      <h3 className="bolum-baslik" style={{ top: rolY - 12 }}>ROLLER</h3>
      <RolTablosu y={rolY + 14} vurgu={ben?.rol} />
    </>;
    h = rolY + 14 + ROL_TABLO_H;
  } else if (sekme === 1) {
    const yY = Y + 128 + 14 + L.length * 68 + 8;
    govde = <>
      <h3 className="bolum-baslik" style={{ top: Y - 12 }}>CLAUDE BAĞLANTISI</h3>
      {sahip ? <>
        <KopyaAlan deger={MCP_TABAN()} gosterim={kisaMcp(MCP_TABAN())} etiket="MCP adresi" style={{ top: Y + 14 }} />
        <Svg w={14} h={14} x={27} y={Y + 81} svg={`<circle cx="34" cy="${Y + 88}" r="6" fill="url(#pLit2)"/>`} />
        <Metin y={Y + 92} x={48} fs={12.5} lh={16} agirlik={600} renk="ink2" className="tek-satir">{son ? `Bağlı · son çağrı ${gunAy(Date.parse(son))} ${saat(Date.parse(son))}` : 'Henüz bağlanmadı'}</Metin>
        <h3 className="bolum-baslik" style={{ top: Y + 128 - 12 }}>ANAHTARLAR</h3>
        {L.map((k, i) => {
          const el = (
            <SatirKart key={k.id} y={Y + 128 + 14 + i * 68} h={60} ikon={kisiGemi(k.kisi, k.rol, k.rol === 'sahip', 26, k.rol === 'dis' ? 31 : 30, k.rol === 'dis' ? .73 : .82)} ust={k.kisi}
              alt={k.iptal ? 'iptal edildi' : `${rolAdi(k.rol)}${k.rol === 'dis' && k.kapsam ? ` · ${k.kapsam}` : ''}${k.rol === 'ekip' && akisErisimi(k.kapsam) ? ` · ${akisErisimi(k.kapsam)!.length} akış` : ''} · ${sonKullanim(k.son_kullanim)}`}
              sag={k.iptal ? <span /> : k.ben ? <span className="satir-not">bu cihaz</span> : <button type="button" className="satir-eylem mercan" onClick={() => setIptal(k)} aria-label={`${k.kisi} anahtarını iptal et`}>İptal</button>}
              x={20} w={350} />
          );
          return k.iptal ? <div key={k.id} style={{ opacity: .45 }}>{el}</div> : el;
        })}
        <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: yY }} ikonX={128 - 20} kayma={8} onClick={() => setYeni(true)}
          ikon={<svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14"><path d="M0,-6 L0,6 M-6,0 L6,0" stroke="#FFD27A" strokeWidth="2" strokeLinecap="round" /></svg>}>Yeni anahtar</Dugme>
      </> : <SatirKart y={Y + 14} h={66} ikon={kisiGemi(ben?.kisi || '', ben?.rol || 'ekip', false, 26, 33, .82)} ust="Claude’a bağla" alt="Kendi anahtarınla MCP adresi" onClick={() => git('/bagla')} />}
    </>;
    h = sahip ? yY + 50 : Y + 80;
  } else if (sekme === 2) {
    govde = <HesapIcerik y={Y} ben={ben} />; h = hesapYuksekligi(ben, Y);
  } else {
    govde = <>
      <h3 className="bolum-baslik" style={{ top: Y - 12 }}>HAREKET</h3>
      <div className="ayar-secenek" style={{ top: Y + 14 }}><Segment secenekler={['Sistem', 'Azalt']} aktif={hareket === 'az' ? 1 : 0} sec={(i) => { const h2 = i ? 'az' : 'sistem'; hareketKoy(h2); setHareket(h2); }} /></div>
      <Metin y={Y + 84} x={22} fs={12.5} lh={17} renk="ink3" style={{ right: 22 }}>{hareket === 'az' ? 'Döngüler durur, geçişler anında olur; bu cihazda kalır.' : 'İşletim sisteminin hareket ayarına uyar; bu cihazda kalır.'}</Metin>
    </>;
    h = Y + 100;
  }
  return (
    <>
      <Sahne gok={GOK} etiket={`Ayarlar · ${SEKMELER[sekme]}`} yukseklik={Math.max(844, h + 120)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Ayarlar" geri={geri} /></Kutu>
        <Metin y={110} fs={13} lh={16} agirlik={600} renk="ink3" className="tek-satir">{ben?.kisi} · {alanAdi(ben?.calisma_alani?.ad || '', ben?.kisi)} · {rolAdi(ben?.rol || '')}</Metin>
        <Kutu x={0} y={130} style={{ right: 0 }}><Segment secenekler={[...SEKMELER]} aktif={sekme} sec={sec} /></Kutu>
        {govde}
        <AltGezinme aktif="ayarlar" yeni={() => git('/yeni')} />
      </Sahne>
      {iptal && <AnahtarIptal k={iptal} kapat={() => setIptal(null)} />}
      {yeni && <YeniAnahtar kapat={() => setYeni(false)} />}
    </>
  );
}

function AnahtarIptal({ k, kapat }: { k: any; kapat: () => void }) {
  const m = useMutation({ mutationFn: () => api.post<any>(`/anahtar/${k.id}/iptal`, {}), onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['anahtarlar'] }); kapat(); } });
  const y0 = 560, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik={`${k.kisi} anahtarı iptal edilsin mi?`} yukseklik={y0} duraklar={['orta']} guclu>
      <div className="karar-panel" style={{ height: 260 }}>
        <Metin y={P(y0 + 58)} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Anahtar iptal edilsin mi?</Metin>
        <Metin y={P(y0 + 96)} fs={17} lh={22} serif renk="ink2">{k.kisi} bu anahtarla artık bağlanamaz.</Metin>
        <Dugme tur="tehlike" style={{ top: P(y0 + 122) }} mesgul={m.isPending} onClick={() => m.mutate()}>İptal et</Dugme>
        <Dugme tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 188) }} onClick={kapat}>Vazgeç</Dugme>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 242) }}>{(m.error as Error).message}</p>}
      </div>
    </AltSayfa>
  );
}

function YeniAnahtar({ kapat }: { kapat: () => void }) {
  const [kisi, setKisi] = useState('');
  const [rol, setRol] = useState(0);
  const [kapsam, setKapsam] = useState('');
  const m = useMutation({ mutationFn: () => api.post<any>('/anahtar', { kisi: kisi.trim(), rol: ['ekip', 'dis'][rol], kapsam: rol ? kapsam.trim() || kisi.trim() : undefined }), onSuccess: () => void sorguIstemcisi.invalidateQueries({ queryKey: ['anahtarlar'] }) });
  const y0 = 330, P = (y: number) => y - (y0 + 28);
  const r = m.data;
  return (
    <AltSayfa acik kapat={kapat} baslik="Yeni anahtar" yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <form className="karar-panel" style={{ height: 470 }} onSubmit={(e) => { e.preventDefault(); if (kisi.trim()) m.mutate(); }}>
        <Metin y={P(y0 + 54)} fs={24} lh={30} serif agirlik={700} as="h2">Yeni anahtar</Metin>
        {r ? <>
          <Metin y={P(y0 + 92)} fs={17} lh={22} serif renk="ink2">{r.anahtar.kisi} bu adresi Claude’a bağlayıcı olarak ekler.</Metin>
          <KopyaAlan deger={r.mcp_adresi} gosterim={kisaMcp(r.mcp_adresi)} etiket="MCP adresi" style={{ top: P(y0 + 118) }} />
          <Metin y={P(y0 + 192)} fs={12} lh={16} renk="ink3">Adres yalnız şimdi görünür; kaybolursa yenisini üret.</Metin>
          <Dugme type="button" tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 214) }} onClick={kapat}>Tamam</Dugme>
        </> : <>
          <label className="dis-alan" style={{ top: P(y0 + 96) - 26 }}><span className="alan-etiket">Kişi</span><input className="alan" value={kisi} onChange={(e) => setKisi(e.target.value)} placeholder="Ör. Selin" /></label>
          <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: P(y0 + 172) - 20 }}>Rol</span>
          <div className="dis-segment" style={{ top: P(y0 + 180) }}><Segment secenekler={['Ekip', 'Dış katılımcı']} aktif={rol} sec={setRol} /></div>
          {rol === 1 && <label className="dis-alan" style={{ top: P(y0 + 258) - 26 }}><span className="alan-etiket">Adımlardaki adı</span><input className="alan" value={kapsam} onChange={(e) => setKapsam(e.target.value)} placeholder={kisi || 'Ör. Emre (Test Bank)'} /></label>}
          <Dugme type="submit" style={{ top: P(y0 + (rol ? 330 : 258)) }} fs={16} disabled={!kisi.trim()} mesgul={m.isPending}>Anahtar üret</Dugme>
          {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + (rol ? 392 : 320)) }}>{(m.error as Error).message}</p>}
        </>}
      </form>
    </AltSayfa>
  );
}
