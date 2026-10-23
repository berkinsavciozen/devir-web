import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { kimlik, type BagliIstemci } from '../../api/kimlik';
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
import { alanAdi, alanIkon, CikisSatiri, HesapIcerik, hesapYuksekligi, kisiGemi, rolAdi, SatirKart, Svg, useUyeler } from './Hesap';
import { useOlaylar } from '../../bilesen/Zil';
import { evrenDiliniSifirla } from '../evren/Evren';
import { uyumDurumu } from '../../api/surum';

const GOK = { tohum: 17, yildiz: 200 };
const MCP_TABAN = () => (SAHTE ? 'https://sahte.devir/functions/v1/devir-mcp' : API_TABAN);
const kisaMcp = (a: string) => { const i = a.indexOf('/functions/'); return i >= 0 ? '…' + a.slice(i) : a; };

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
/** Anahtar süresi (MK-1): yeni anahtarlar 90 gün; eskilerde süre yok */
const sureMetni = (k: any) => (k.suresi_doldu ? 'süresi doldu' : k.son_gecerlilik ? `${gunAy(Date.parse(k.son_gecerlilik))}'e kadar` : null);

const BOLUMLER = ['ben', 'ekip', 'baglantilar', 'gorunum'] as const;
type Bolum = typeof BOLUMLER[number];
// eski sekme adresleri (?sekme=hesap …) aynı gruba iner
const ESKI: Record<string, Bolum> = { hesap: 'ben', alan: 'ekip', baglantilar: 'baglantilar', gorunum: 'gorunum' };

/**
 * K1 · Ayarlar (el notu 17): sekmeler yerine tek kayan sayfa, dört grup. Ben (kişi, alanlar, davetler) · Ekip (alan, üyeler;
 * rol tablosu "?" arkasında) · Bağlantılar (Claude, anahtarlar) · Görünüm ve bildirimler. Her satır aynı satır kartı.
 * Evrende adına dokununca bu sayfa Ben grubunda açılır (eski Hesap çekmecesi). Yönetim satırları yalnız sahibe.
 */
export function Ayarlar() {
  const ben = useBen().data as Ben | undefined;
  const sahip = ben?.rol === 'sahip';
  const an = useQuery({ queryKey: ['anahtarlar'], queryFn: () => api.get<any>('/anahtarlar'), enabled: sahip });
  const durum = useQuery({ queryKey: ['durum'], queryFn: () => api.get<any>('/durum'), staleTime: 300_000 });
  const okunmamis = useOlaylar().data?.okunmamis ?? 0;
  const uy = useUyeler(sahip);
  const [iptal, setIptal] = useState<any>(null);
  const [yeni, setYeni] = useState(false);
  const [roller, setRoller] = useState(false);
  const [politikaAcik, setPolitikaAcik] = useState(false);
  const [kaldir, setKaldir] = useState<BagliIstemci | null>(null);
  // bağlı uygulamalar (OAuth izinleri) yalnız e-postayla girişte; anahtarla girişte Supabase oturumu yok
  const ist = useQuery({ queryKey: ['istemciler'], queryFn: () => kimlik.istemciler(), enabled: !!ben?.eposta, retry: false });
  const U: BagliIstemci[] = ist.data || [];
  const pol = useQuery({ queryKey: ['politika'], queryFn: () => api.get<any>('/politika'), enabled: sahip });
  const [hareket, setHareket] = useState(hareketSecimi());
  const geri = () => (history.length > 1 ? history.back() : git('/'));
  const sira = (k: any) => (k.ben ? 0 : k.kisi === ben?.kisi ? 1 : 2) + (k.iptal ? 3 : 0);
  const L: any[] = [...(an.data?.anahtarlar || [])].sort((a, b) => sira(a) - sira(b) || String(a.olusturuldu).localeCompare(String(b.olusturuldu)));
  const son = [...L.map((k) => k.son_kullanim), ben?.mcp_son_kullanim].filter(Boolean).sort().pop() as string | undefined;
  const sayi = ekipSayilari(uy.data?.uyeler || [], uy.data?.davetler || [], an.data?.anahtarlar);
  const ikili = ship(38 - 20, 337 - 304, -12, 'insan', 'S', '#9EE6CF', .62, { flame: false }) + ship(52 - 20, 344 - 304, 0, 'dis', '', '#F2B8D8', .6);

  // dikey yerleşim: her grup başlığı G, satırlar G+14'ten
  const bY: Record<Bolum, number> = { ben: 150, ekip: 0, baglantilar: 0, gorunum: 0 };
  bY.ekip = hesapYuksekligi(ben, bY.ben + 14, false) + 46;
  const ekipSon = bY.ekip + 14 + 66 + (sahip ? 2 * 74 : 0);
  bY.baglantilar = ekipSon + 46;
  const uygY = bY.baglantilar + (sahip ? 128 : 14 + 66 + 46);
  const uygSon = U.length ? uygY + 14 + U.length * 68 : uygY - 46;
  const anahtarY = uygSon + 46;
  const yY = anahtarY + 14 + L.length * 68 + 8;
  bY.gorunum = (sahip ? yY + 50 : uygSon) + 46;
  const gY = bY.gorunum + 14;
  const satirY = gY + 100;
  const cikisY = satirY + 3 * 74 + 10;
  const h = cikisY + 60;

  // adresle gelinen grup (?bolum=ben, eski ?sekme=hesap): ilk çizimden sonra oraya kayar
  const hedef = (() => { const q = arama(); const b = q.get('bolum') || ESKI[q.get('sekme') || ''] || null; return BOLUMLER.includes(b as Bolum) ? (b as Bolum) : null; })();
  const kaydi = useRef(false);
  useEffect(() => {
    if (!hedef || hedef === 'ben' || kaydi.current || !ben) return;
    kaydi.current = true;
    document.getElementById(`ayar-${hedef}`)?.scrollIntoView({ block: 'start' });
  }, [hedef, ben, an.data, uy.data]);

  const baslik = (b: Bolum, metin: string, ek?: ReactNode) => <>
    <h2 id={`ayar-${b}`} className="bolum-baslik ayar-grup" style={{ top: bY[b] - 12 }}>{metin}</h2>{ek}
  </>;
  const ozelIkon = (svg: string) => `<g transform="translate(26,33)"><circle r="15" fill="#1E1645" stroke="#8E80D6" stroke-opacity=".6"/>${svg}</g>`;
  const uyum = uyumDurumu(durum.data);
  return (
    <>
      <Sahne gok={GOK} etiket="Ayarlar" yukseklik={Math.max(844, h + 120)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Ayarlar" geri={geri} /></Kutu>
        <Metin y={110} fs={13} lh={16} agirlik={600} renk="ink3" className="tek-satir">{ben?.kisi} · {alanAdi(ben?.calisma_alani?.ad || '', ben?.kisi)} · {rolAdi(ben?.rol || '')}</Metin>

        {baslik('ben', 'BEN')}
        <HesapIcerik y={bY.ben + 14} ben={ben} cikis={false} />

        {baslik('ekip', 'EKİP', <button type="button" className="ayar-yardim" style={{ top: bY.ekip - 26 }} aria-label="Roller ve yetkiler" onClick={() => setRoller(true)}>?</button>)}
        <SatirKart y={bY.ekip + 14} h={66} ikon={alanIkon(26, 33, '#FFD27A')} ust={alanAdi(ben?.calisma_alani?.ad || '', ben?.kisi)} alt={`çalışma alanı · senin rolün ${rolAdi(ben?.rol || '')}${ben?.rol === 'ekip' && akisErisimi(ben?.kapsam) ? ` · ${akisErisimi(ben?.kapsam)!.length} akış` : ''}`} />
        {sahip && <SatirKart y={bY.ekip + 14 + 74} h={66} ikon={ikili} ust="Üyeler ve davetler" alt={uy.isPending ? '…' : ekipOzeti(sayi)} onClick={() => git('/ayarlar/ekip')} />}
        {sahip && <SatirKart y={bY.ekip + 14 + 148} h={66} ikon={ozelIkon('<path d="M-6,1 L-2,5 L6,-5" fill="none" stroke="#9EE6CF" stroke-width="1.8" stroke-linecap="round"/>')} ust="Agent kararları" alt={pol.isPending ? '…' : politikaOzeti(pol.data?.politika?.agent_karari)} onClick={() => setPolitikaAcik(true)} />}

        {baslik('baglantilar', 'BAĞLANTILAR')}
        {sahip ? <>
          <KopyaAlan deger={MCP_TABAN()} gosterim={kisaMcp(MCP_TABAN())} etiket="MCP adresi" style={{ top: bY.baglantilar + 14 }} />
          <Svg w={14} h={14} x={27} y={bY.baglantilar + 81} svg={`<circle cx="34" cy="${bY.baglantilar + 88}" r="6" fill="url(#pLit2)"/>`} />
          <Metin y={bY.baglantilar + 92} x={48} fs={12.5} lh={16} agirlik={600} renk="ink2" className="tek-satir">{son ? `Claude bağlı · son çağrı ${gunAy(Date.parse(son))} ${saat(Date.parse(son))}` : 'Claude henüz bağlanmadı'}</Metin>
          <h3 className="bolum-baslik" style={{ top: anahtarY - 12 }}>ANAHTARLAR · CLAUDE CODE VE BETİKLER</h3>
          {L.map((k, i) => {
            const el = (
              <SatirKart key={k.id} y={anahtarY + 14 + i * 68} h={60} ikon={kisiGemi(k.kisi, k.rol, k.rol === 'sahip', 26, k.rol === 'dis' ? 31 : 30, k.rol === 'dis' ? .73 : .82)} ust={k.kisi}
                alt={k.iptal ? 'iptal edildi' : `${k.onek ? `${k.onek}… · ` : ''}${rolAdi(k.rol)}${k.rol === 'dis' && k.kapsam ? ` · ${k.kapsam}` : ''}${k.rol === 'ekip' && akisErisimi(k.kapsam) ? ` · ${akisErisimi(k.kapsam)!.length} akış` : ''} · ${sureMetni(k) || sonKullanim(k.son_kullanim)}`}
                sag={k.iptal ? <span /> : k.ben ? <span className="satir-not">bu cihaz</span> : <button type="button" className="satir-eylem mercan" onClick={() => setIptal(k)} aria-label={`${k.kisi} anahtarını iptal et`}>İptal</button>}
              />
            );
            return k.iptal ? <div key={k.id} style={{ opacity: .45 }}>{el}</div> : el;
          })}
          <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: yY }} ikonX={128 - 20} kayma={8} onClick={() => setYeni(true)}
            ikon={<svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14"><path d="M0,-6 L0,6 M-6,0 L6,0" stroke="#FFD27A" strokeWidth="2" strokeLinecap="round" /></svg>}>Yeni anahtar</Dugme>
        </> : <SatirKart y={bY.baglantilar + 14} h={66} ikon={kisiGemi(ben?.kisi || '', ben?.rol || 'ekip', false, 26, 33, .82)} ust="Claude’a bağla" alt="Adresi ekle, e-postanla onayla" onClick={() => git('/bagla')} />}
        {U.length > 0 && <>
          <h3 className="bolum-baslik" style={{ top: uygY - 12 }}>BAĞLI UYGULAMALAR</h3>
          {U.map((u, i) => (
            <SatirKart key={u.id} y={uygY + 14 + i * 68} h={60} ikon={ozelIkon('<circle r="6" fill="url(#pLit2)"/>')} ust={u.ad}
              alt={`senin adına yazar · ${gunAy(Date.parse(u.tarih))} izin verildi`}
              sag={<button type="button" className="satir-eylem mercan" onClick={() => setKaldir(u)} aria-label={`${u.ad} iznini kaldır`}>Kaldır</button>} />
          ))}
        </>}

        {baslik('gorunum', 'GÖRÜNÜM VE BİLDİRİMLER')}
        <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: gY - 2 }}>Hareket</span>
        <div className="ayar-secenek" style={{ top: gY + 20 }}><Segment secenekler={['Sistem', 'Azalt']} aktif={hareket === 'az' ? 1 : 0} sec={(i) => { const h2 = i ? 'az' : 'sistem'; hareketKoy(h2); setHareket(h2); }} /></div>
        <Metin y={gY + 86} x={22} fs={12.5} lh={17} renk="ink3" style={{ right: 22 }}>{hareket === 'az' ? 'Döngüler durur, geçişler anında olur; bu cihazda kalır.' : 'İşletim sisteminin hareket ayarına uyar; bu cihazda kalır.'}</Metin>
        <SatirKart y={satirY} h={66} ikon={ozelIkon('<path d="M-6,4 C-5,3 -5,1 -5,-1 C-5,-4 -3,-6 0,-6 C3,-6 5,-4 5,-1 C5,1 5,3 6,4 Z" fill="none" stroke="#D9CCFF" stroke-width="1.4"/><circle cy="7" r="1.6" fill="#FFC9A3"/>')}
          ust="Bildirimler" alt={okunmamis ? `${okunmamis} okunmamış · okundu bilgisi cihazlarında aynı` : 'Okundu bilgisi cihazlarında aynı'} onClick={() => git('/bildirimler')} />
        <SatirKart y={satirY + 74} h={66} ikon={ozelIkon('<text y="5" text-anchor="middle" font-size="15" font-weight="700" fill="#D9CCFF">?</text>')}
          ust="Evren dilini yeniden göster" alt="Galaksi, bugün ibresi, bulut, bayrak, gemi" onClick={() => { evrenDiliniSifirla(); git('/'); }} />
        <SatirKart y={satirY + 148} h={66} ikon={ozelIkon(`<circle r="5" fill="${durum.isError || (durum.data && !uyum.tamam) ? '#FF9A8A' : durum.data ? '#9EE6CF' : '#8E80D6'}"/>`)}
          ust="Bağlantı denetimi" alt={durum.isPending ? 'denetleniyor…' : durum.isError ? 'Sunucuya ulaşılamadı' : uyum.metin} />
        <CikisSatiri y={cikisY} />
        <AltGezinme aktif="ayarlar" yeni={() => git('/yeni')} />
      </Sahne>
      <AltSayfa acik={roller} kapat={() => setRoller(false)} baslik="Roller ve yetkiler" yukseklik={300} duraklar={['orta', 'yuksek']}>
        <div className="karar-panel" style={{ height: ROL_TABLO_H + 110 }}>
          <Metin y={44} fs={22} lh={28} serif agirlik={700} as="h2">Roller ve yetkiler</Metin>
          <RolTablosu y={70} vurgu={ben?.rol} />
        </div>
      </AltSayfa>
      {politikaAcik && <KararPolitikasi ak={pol.data?.politika?.agent_karari} kapat={() => setPolitikaAcik(false)} />}
      {iptal && <AnahtarIptal k={iptal} kapat={() => setIptal(null)} />}
      {kaldir && <IzinKaldir u={kaldir} kapat={() => setKaldir(null)} />}
      {yeni && <YeniAnahtar kapat={() => setYeni(false)} />}
    </>
  );
}

const POL_ROLLER = [['sahip', 'Sahip'], ['ekip', 'Ekip'], ['dis', 'Dış katılımcı']] as const;
const POL_VARSAYILAN: Record<string, string> = { sahip: 'insan', ekip: 'insan', dis: 'beyan' };
/** "Sahip ve ekip insan kararı · dış beyan" gibi tek satır. */
export function politikaOzeti(ak?: Record<string, string>) {
  const p = { ...POL_VARSAYILAN, ...(ak || {}) };
  const ins = POL_ROLLER.filter(([r]) => p[r] === 'insan').map(([, a]) => a.toLocaleLowerCase('tr'));
  const bey = POL_ROLLER.filter(([r]) => p[r] !== 'insan').map(([, a]) => a.toLocaleLowerCase('tr'));
  const bir = (L: string[]) => L.join(' ve ');
  return [ins.length ? `${bir(ins)}: insan kararı` : '', bey.length ? `${bir(bey)}: beyan` : ''].filter(Boolean).join(' · ').replace(/^./, (c) => c.toLocaleUpperCase('tr'));
}

/**
 * MK-3 · Agent kararları: kişinin kendi Claude'u üzerinden verdiği karar, kullanıcı tipine göre insan kararı sayılır
 * ya da beyan kalır (adım kapanmaz, kişi Devir'de onaylar). Her kayıtta kanal görünür.
 */
function KararPolitikasi({ ak, kapat }: { ak?: Record<string, string>; kapat: () => void }) {
  const [p, setP] = useState<Record<string, string>>({ ...POL_VARSAYILAN, ...(ak || {}) });
  const m = useMutation({ mutationFn: () => api.post<any>('/politika', { agent_karari: p }), onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['politika'] }); kapat(); } });
  const y0 = 260, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik="Agent kararları" yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <div className="karar-panel" style={{ height: 560 }}>
        <Metin y={P(y0 + 54)} fs={24} lh={30} serif agirlik={700} as="h2">Agent kararları</Metin>
        <Metin y={P(y0 + 90)} fs={15} lh={20} serif renk="ink2" style={{ right: 22 }}>Bir kişi kararı kendi Claude’u ya da ChatGPT’si üzerinden verirse ne sayılsın?</Metin>
        {POL_ROLLER.map(([r, ad], i) => (
          <div key={r}>
            <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: P(y0 + 158 + i * 92) - 20 }}>{ad}</span>
            <div className="dis-segment" style={{ top: P(y0 + 166 + i * 92) }}><Segment secenekler={['İnsan kararı', 'Beyan']} aktif={p[r] === 'insan' ? 0 : 1} sec={(j) => setP({ ...p, [r]: j ? 'beyan' : 'insan' })} /></div>
          </div>
        ))}
        <Metin y={P(y0 + 440)} fs={12.5} lh={17} renk="ink3" style={{ right: 22 }}>Beyan: adım kapanmaz, karar öneri olarak kalır; kişi Devir’de onaylar. Her kayıtta hangi yoldan geldiği görünür.</Metin>
        <Dugme style={{ top: P(y0 + 486) }} fs={16} mesgul={m.isPending} onClick={() => m.mutate()}>Kaydet</Dugme>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 548) }}>{(m.error as Error).message}</p>}
      </div>
    </AltSayfa>
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

/** OAuth iznini kaldırır: istemcinin oturumları ve yenileme jetonları geçersiz olur. */
function IzinKaldir({ u, kapat }: { u: BagliIstemci; kapat: () => void }) {
  const m = useMutation({ mutationFn: () => kimlik.istemciKaldir(u.id), onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['istemciler'] }); kapat(); } });
  const y0 = 560, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik={`${u.ad} izni kaldırılsın mı?`} yukseklik={y0} duraklar={['orta']} guclu>
      <div className="karar-panel" style={{ height: 260 }}>
        <Metin y={P(y0 + 58)} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">İzin kaldırılsın mı?</Metin>
        <Metin y={P(y0 + 96)} fs={17} lh={22} serif renk="ink2">{u.ad} senin adına artık yazamaz.</Metin>
        <Dugme tur="tehlike" style={{ top: P(y0 + 122) }} mesgul={m.isPending} onClick={() => m.mutate()}>Kaldır</Dugme>
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
          <Metin y={P(y0 + 92)} fs={17} lh={22} serif renk="ink2">{r.anahtar.kisi} Claude Code ya da betikte başlık olarak ekler.</Metin>
          <KopyaAlan deger={r.baslik} gosterim={`Bearer ${r.token.slice(0, 7)} •••• ${r.token.slice(-4)}`} etiket="Authorization başlığı" style={{ top: P(y0 + 118) }} />
          <Metin y={P(y0 + 192)} fs={12} lh={16} renk="ink3">Yalnız şimdi görünür, 90 gün geçerli. Claude ve ChatGPT’de anahtar gerekmez.</Metin>
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
