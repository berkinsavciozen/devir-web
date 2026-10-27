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
import { alanAdi, CikisSatiri, HesapIcerik, hesapYuksekligi, kisiGemi, rolAdi, SatirKart, Svg, useUyeler } from './Hesap';
import { useOlaylar } from '../../bilesen/Zil';
import { TumHaritaDili } from '../akis/Lejant';
import { whatsappAdresi } from '../akis/BaglantiGonder';
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

const BOLUMLER = ['ben', 'kisiler', 'oner', 'harita', 'gelismis'] as const;
type Bolum = typeof BOLUMLER[number];
// eski adresler (?sekme=hesap, ?bolum=ekip …) yeni gruplara iner
const ESKI: Record<string, Bolum> = { hesap: 'ben', alan: 'kisiler', ekip: 'kisiler', baglantilar: 'gelismis', gorunum: 'harita' };
const BASLIK: Record<Bolum, string> = { ben: 'BEN', kisiler: 'KİŞİLER', oner: 'DEVİR’İ ÖNER', harita: 'HARİTA DİLİ', gelismis: 'GELİŞMİŞ' };

/** "Berkin’in Claude’u" yerine satırda yalnız uygulama; alt satır ne zaman kullanıldı. */
const agentAlt = (a: { son_kullanim?: string | null; ilk_kullanim?: string | null; tarih?: string }) =>
  `senin adına yazar · ${a.son_kullanim ? `son kullanım ${gunAy(Date.parse(a.son_kullanim))}` : a.ilk_kullanim || a.tarih ? `${gunAy(Date.parse((a.ilk_kullanim || a.tarih)!))} bağlandı` : 'henüz kullanılmadı'}`;
/** Dış katılımcı bağlantısının kısa durumu (Kişiler satırı ve Ekip listesi) */
export const katilimciDurumu = (k: any) => (k.durum === 'iptal' ? 'bağlantı kapalı' : k.durum === 'suresi_doldu' ? 'süresi doldu' : k.son_acilis ? (k.acik_adim ? 'aktif' : 'açtı') : 'bağlantı gönderildi, açılmadı');

/**
 * Ayarlar (plan 27 Eki, Epic 4): tek kayan sayfa, beş grup. Ben (kişi, Agent'larım, Devir AI kullanımı) · Kişiler (ekip ve
 * dış katılımcılar; rol tablosu "?" arkasında) · Devir'i öner (referans bağlantısı, onay listesi) · Harita dili (tam lejant,
 * hareket, bildirimler) · Gelişmiş (MCP adresi, anahtarlar, agent kararları, bağlantı denetimi). Çalışma alanı tek olduğu
 * sürece gösterilmez. Yönetim satırları yalnız sahibe.
 */
export function Ayarlar() {
  const ben = useBen().data as Ben | undefined;
  const sahip = ben?.rol === 'sahip', dis = ben?.rol === 'dis', oturum = !!ben?.eposta;
  const an = useQuery({ queryKey: ['anahtarlar'], queryFn: () => api.get<any>('/anahtarlar'), enabled: sahip });
  const durum = useQuery({ queryKey: ['durum'], queryFn: () => api.get<any>('/durum'), staleTime: 300_000 });
  const okunmamis = useOlaylar().data?.okunmamis ?? 0;
  const uy = useUyeler(sahip);
  const kt = useQuery({ queryKey: ['katilimcilar-tum'], queryFn: () => api.get<any>('/katilimcilar'), enabled: sahip, staleTime: 60_000 });
  // 0.28.0: agent bağlantıları, kullanım, referans ve onay listesi; eski sunucuda bölümler sessizce eski haline döner
  const ag = useQuery({ queryKey: ['agentlar'], queryFn: () => api.get<any>('/ben/agentlar'), enabled: oturum, retry: false });
  const ku = useQuery({ queryKey: ['kullanim'], queryFn: () => api.get<any>('/kullanim'), enabled: !!ben && !dis, retry: false, staleTime: 60_000 });
  const rf = useQuery({ queryKey: ['referans'], queryFn: () => api.get<any>('/referans'), enabled: oturum && !dis, retry: false });
  const bk = useQuery({ queryKey: ['bekleme'], queryFn: () => api.get<any>('/bekleme'), enabled: oturum && sahip, retry: false });
  const [iptal, setIptal] = useState<any>(null);
  const [yeni, setYeni] = useState(false);
  const [roller, setRoller] = useState(false);
  const [politikaAcik, setPolitikaAcik] = useState(false);
  const [kaldir, setKaldir] = useState<null | { id: string; ad: string; istemci?: string; eski?: boolean }>(null);
  const [lejant, setLejant] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);
  // bağlı uygulamalar (OAuth izinleri) yalnız e-postayla girişte; anahtarla girişte Supabase oturumu yok
  const ist = useQuery({ queryKey: ['istemciler'], queryFn: () => kimlik.istemciler(), enabled: oturum && ag.isError, retry: false });
  const pol = useQuery({ queryKey: ['politika'], queryFn: () => api.get<any>('/politika'), enabled: sahip });
  const [hareket, setHareket] = useState(hareketSecimi());
  const geri = () => (history.length > 1 ? history.back() : git('/'));
  const sira = (k: any) => (k.ben ? 0 : k.kisi === ben?.kisi ? 1 : 2) + (k.iptal ? 3 : 0);
  const L: any[] = [...(an.data?.anahtarlar || [])].sort((a, b) => sira(a) - sira(b) || String(a.olusturuldu).localeCompare(String(b.olusturuldu)));
  const son = [...L.map((k) => k.son_kullanim), ben?.mcp_son_kullanim].filter(Boolean).sort().pop() as string | undefined;
  const sayi = ekipSayilari(uy.data?.uyeler || [], uy.data?.davetler || [], an.data?.anahtarlar);
  const ikili = ship(38 - 20, 337 - 304, -12, 'insan', 'S', '#9EE6CF', .62, { flame: false }) + ship(52 - 20, 344 - 304, 0, 'dis', '', '#F2B8D8', .6);
  // agent satırları: sunucunun bağlantı listesi; eski sunucuda OAuth izinleri
  const AG: { id: string; ad: string; istemci?: string; alt: string; eski?: boolean }[] = ag.data
    ? (ag.data.agentlar || []).map((a: any) => ({ id: a.id, ad: a.ad, istemci: a.istemci, alt: agentAlt(a) }))
    : ((ist.data || []) as BagliIstemci[]).map((u) => ({ id: u.id, ad: u.ad, istemci: u.id, alt: agentAlt({ tarih: u.tarih }), eski: true }));
  const KT: any[] = kt.data?.katilimcilar || [];
  const B: any[] = (bk.data?.bekleme || []).filter((x: any) => x.durum === 'bekliyor');
  const k = ku.data?.kullanim;

  // dikey yerleşim: her grup başlığı G, satırlar G+14'ten; her blok kendi yüksekliğini ekler
  const bY = {} as Record<Bolum, number>;
  let y = 150;
  bY.ben = y;
  y = hesapYuksekligi(ben, y + 14, false);
  const agY = y + 34; y = agY + 14 + AG.length * 68 + 66;
  const kuY = k ? y + 34 : null; if (kuY != null) y = kuY + 14 + 70;
  bY.kisiler = y + 46; y = bY.kisiler + 14 + (sahip ? 2 * 74 : 66);
  const onerVar = !dis && !!rf.data;
  if (onerVar) { bY.oner = y + 46; y = bY.oner + 14 + 66 + 8 + 50 + (sahip ? 74 + 8 : 0); }
  bY.harita = y + 46; y = bY.harita + 14 + 74;
  const hareketY = y + 14; y = hareketY + 100;
  const bildirimY = y; y += 74;
  bY.gelismis = y + 46; y = bY.gelismis + 14;
  const mcpY = y; if (sahip) y += 66 + 30;
  const anahtarY = y + 26; if (sahip) y = anahtarY + 14 + L.length * 68 + 8 + 58;
  const polY = y; if (sahip) y += 74;
  const denetimY = y; y += 74;
  const cikisY = y + 10;
  const h = cikisY + 60;

  // adresle gelinen grup (?bolum=ben, eski ?sekme=hesap): ilk çizimden sonra oraya kayar
  const hedef = (() => { const q = arama(); const b = q.get('bolum') || q.get('sekme') || ''; const g = (BOLUMLER as readonly string[]).includes(b) ? (b as Bolum) : ESKI[b] || null; return g; })();
  const kaydi = useRef(false);
  useEffect(() => {
    if (!hedef || hedef === 'ben' || kaydi.current || !ben) return;
    // grup veri gelince çizilebilir (Devir'i öner): başlık yoksa bir sonraki çizimde yeniden dener
    const el = document.getElementById(`ayar-${hedef}`);
    if (!el) return;
    kaydi.current = true;
    el.scrollIntoView({ block: 'start' });
  }, [hedef, ben, an.data, uy.data, rf.data, ag.data, ku.data]);

  const baslik = (b: Bolum, ek?: ReactNode) => <>
    <h2 id={`ayar-${b}`} className="bolum-baslik ayar-grup" style={{ top: bY[b] - 12 }}>{BASLIK[b]}</h2>{ek}
  </>;
  const ozelIkon = (svg: string) => `<g transform="translate(26,33)"><circle r="15" fill="#1E1645" stroke="#8E80D6" stroke-opacity=".6"/>${svg}</g>`;
  const uyum = uyumDurumu(durum.data);
  const disSayi = KT.length ? `${KT.length} dış katılımcı · ${KT.filter((x) => x.durum === 'acik').length} bağlantı açık` : 'Bağlantı paylaşılan dış katılımcı yok';
  return (
    <>
      <Sahne gok={GOK} etiket="Ayarlar" yukseklik={Math.max(844, h + 120)}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Ayarlar" geri={geri} /></Kutu>
        <Metin y={110} fs={13} lh={16} agirlik={600} renk="ink3" className="tek-satir">{ben?.kisi} · {rolAdi(ben?.rol || '')}{(ben?.uyelikler?.length || 0) > 1 ? ` · ${alanAdi(ben?.calisma_alani?.ad || '', ben?.kisi)}` : ''}</Metin>

        {baslik('ben')}
        <HesapIcerik y={bY.ben + 14} ben={ben} cikis={false} />
        <h3 className="bolum-baslik" style={{ top: agY - 12 }}>AGENT’LARIM</h3>
        {AG.map((a, i) => (
          <SatirKart key={a.id} y={agY + 14 + i * 68} h={60} ikon={ship(26, 30, -12, 'agent', (a.ad[0] || 'C').toLocaleUpperCase('tr'), '#FFC9A3', .62, { flame: false })} ust={a.ad} alt={a.alt}
            sag={<button type="button" className="satir-eylem mercan" onClick={() => setKaldir(a)} aria-label={`${a.ad} bağlantısını kaldır`}>Kaldır</button>} />
        ))}
        <SatirKart y={agY + 14 + AG.length * 68} h={60} ikon={ozelIkon('<path d="M0,-6 L0,6 M-6,0 L6,0" stroke="#FFD27A" stroke-width="2" stroke-linecap="round"/>')}
          ust={AG.length ? 'Başka bir uygulama bağla' : 'Claude ya da ChatGPT bağla'} alt="İki adım: uygulamayı seç, adresi ekle" onClick={() => git('/bagla')} />
        {k && kuY != null && <>
          <h3 className="bolum-baslik" style={{ top: kuY - 12 }}>DEVİR AI KULLANIMI</h3>
          <div className="kart kullanim-kart" style={{ top: kuY + 14 }} role="group" aria-label="Devir AI kullanımı">
            <b>Bu ayın kullanımı: %{Math.round((k.oran || 0) * 100)}</b>
            <span className="kullanim-cubuk" aria-hidden><i style={{ width: `${Math.max(2, Math.round((k.oran || 0) * 100))}%` }} className={k.doldu ? 'doldu' : k.oran > .8 ? 'az' : ''} /></span>
            <small>{k.doldu ? `Sınır doldu; ${k.yenilenme_metin} yenilenir.` : `Plan ve sohbet tek sayaçta; ${k.yenilenme_metin} sıfırlanır.`}</small>
          </div>
        </>}

        {baslik('kisiler', <button type="button" className="ayar-yardim" style={{ top: bY.kisiler - 34 }} aria-label="Roller ve yetkiler" onClick={() => setRoller(true)}>?</button>)}
        {sahip ? <>
          <SatirKart y={bY.kisiler + 14} h={66} ikon={ikili} ust="Üyeler ve davetler" alt={uy.isPending ? '…' : ekipOzeti(sayi)} onClick={() => git('/ayarlar/ekip')} />
          <SatirKart y={bY.kisiler + 14 + 74} h={66} ikon={ship(26, 35, 0, 'dis', '', '#F2B8D8', .62)} ust="Dış katılımcılar" alt={kt.isPending ? '…' : disSayi} onClick={() => git('/ayarlar/ekip?bolum=dis')} />
        </> : <SatirKart y={bY.kisiler + 14} h={66} ikon={kisiGemi(ben?.kisi || '', ben?.rol || 'ekip', false, 26, 33, .82)} ust={`Rolün: ${rolAdi(ben?.rol || '')}`}
          alt={ben?.rol === 'ekip' && akisErisimi(ben?.kapsam) ? `${akisErisimi(ben?.kapsam)!.length} akışı görürsün` : dis ? 'Yalnız kendi adımlarını görürsün' : 'Ekibi alanın sahibi yönetir'} />}

        {onerVar && <>
          {baslik('oner')}
          <KopyaAlan deger={rf.data.link} gosterim={rf.data.link.replace(/^https?:\/\//, '')} etiket="Referans bağlantısı" style={{ top: bY.oner + 14 }} />
          <Metin y={bY.oner + 14 + 66 + 14} x={22} fs={12.5} lh={16} renk="ink3" className="tek-satir" style={{ right: 22 }}>{rf.data.gelen ? `Bu bağlantıyla ${rf.data.gelen} kişi geldi.` : 'Bağlantıyla gelen kişi onaydan sonra kendi alanını açar.'}</Metin>
          <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: bY.oner + 14 + 66 + 8 + 20, right: 200 }} onClick={() => window.open(whatsappAdresi(rf.data.mesaj), '_blank', 'noopener')}>WhatsApp’ta paylaş</Dugme>
          <MesajKopyala metin={rf.data.mesaj} style={{ top: bY.oner + 14 + 66 + 8 + 20, left: 200 }} />
          {sahip && <SatirKart y={bY.oner + 14 + 66 + 8 + 50 + 28} h={66} ikon={ozelIkon(`<text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="${B.length ? '#FFD27A' : '#D9CCFF'}">${B.length}</text>`)}
            ust="Onay bekleyenler" alt={bk.isPending ? '…' : B.length ? `${B.length} kişi Devir’e katılmak istiyor` : 'Bekleyen kimse yok'} onClick={() => setOnayAcik(true)} />}
        </>}

        {baslik('harita')}
        <SatirKart y={bY.harita + 14} h={66} ikon={ozelIkon('<text y="5" text-anchor="middle" font-size="15" font-weight="700" fill="#D9CCFF">?</text>')}
          ust="Tüm harita dili" alt="Bütün işaretler: gezegen, gemi, galaksi, takvim" onClick={() => setLejant(true)} />
        <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: hareketY - 2 }}>Hareket</span>
        <div className="ayar-secenek" style={{ top: hareketY + 20 }}><Segment secenekler={['Sistem', 'Azalt']} aktif={hareket === 'az' ? 1 : 0} sec={(i) => { const h2 = i ? 'az' : 'sistem'; hareketKoy(h2); setHareket(h2); }} /></div>
        <Metin y={hareketY + 86} x={22} fs={12.5} lh={17} renk="ink3" style={{ right: 22 }}>{hareket === 'az' ? 'Döngüler durur, geçişler anında olur; bu cihazda kalır.' : 'İşletim sisteminin hareket ayarına uyar; bu cihazda kalır.'}</Metin>
        <SatirKart y={bildirimY} h={66} ikon={ozelIkon('<path d="M-6,4 C-5,3 -5,1 -5,-1 C-5,-4 -3,-6 0,-6 C3,-6 5,-4 5,-1 C5,1 5,3 6,4 Z" fill="none" stroke="#D9CCFF" stroke-width="1.4"/><circle cy="7" r="1.6" fill="#FFC9A3"/>')}
          ust="Bildirimler" alt={okunmamis ? `${okunmamis} okunmamış · okundu bilgisi cihazlarında aynı` : 'Okundu bilgisi cihazlarında aynı'} onClick={() => git('/bildirimler')} />

        {baslik('gelismis')}
        {sahip && <>
          <KopyaAlan deger={MCP_TABAN()} gosterim={kisaMcp(MCP_TABAN())} etiket="MCP adresi" style={{ top: mcpY }} />
          <Svg w={14} h={14} x={27} y={mcpY + 67} svg={`<circle cx="34" cy="${mcpY + 74}" r="6" fill="url(#pLit2)"/>`} />
          <Metin y={mcpY + 78} x={48} fs={12.5} lh={16} agirlik={600} renk="ink2" className="tek-satir">{son ? `Son MCP çağrısı ${gunAy(Date.parse(son))} ${saat(Date.parse(son))}` : 'MCP henüz çağrılmadı'}</Metin>
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
          <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: anahtarY + 14 + L.length * 68 + 8 }} ikonX={128 - 20} kayma={8} onClick={() => setYeni(true)}
            ikon={<svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14"><path d="M0,-6 L0,6 M-6,0 L6,0" stroke="#FFD27A" strokeWidth="2" strokeLinecap="round" /></svg>}>Yeni anahtar</Dugme>
          <SatirKart y={polY} h={66} ikon={ozelIkon('<path d="M-6,1 L-2,5 L6,-5" fill="none" stroke="#9EE6CF" stroke-width="1.8" stroke-linecap="round"/>')} ust="Agent kararları" alt={pol.isPending ? '…' : politikaOzeti(pol.data?.politika?.agent_karari)} onClick={() => setPolitikaAcik(true)} />
        </>}
        <SatirKart y={denetimY} h={66} ikon={ozelIkon(`<circle r="5" fill="${durum.isError || (durum.data && !uyum.tamam) ? '#FF9A8A' : durum.data ? '#9EE6CF' : '#8E80D6'}"/>`)}
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
      <TumHaritaDili acik={lejant} kapat={() => setLejant(false)} />
      {onayAcik && <OnayListesi L={bk.data?.bekleme || []} kapat={() => setOnayAcik(false)} />}
      {politikaAcik && <KararPolitikasi ak={pol.data?.politika?.agent_karari} kapat={() => setPolitikaAcik(false)} />}
      {iptal && <AnahtarIptal k={iptal} kapat={() => setIptal(null)} />}
      {kaldir && <AgentKaldir a={kaldir} kapat={() => setKaldir(null)} />}
      {yeni && <YeniAnahtar kapat={() => setYeni(false)} />}
    </>
  );
}

function MesajKopyala({ metin, style }: { metin: string; style: React.CSSProperties }) {
  const [tamam, setTamam] = useState(false);
  return <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={style} onClick={async () => { try { await navigator.clipboard.writeText(metin); setTamam(true); setTimeout(() => setTamam(false), 1400); } catch { /* izin yok */ } }}>{tamam ? 'Kopyalandı' : 'Mesajı kopyala'}</Dugme>;
}

/** Onay listesi (karar 4.B): referansla gelenler; onaylanınca giriş e-postası gider, kişi kendi alanını açar. */
function OnayListesi({ L, kapat }: { L: any[]; kapat: () => void }) {
  const tazele = () => { for (const q of [['bekleme'], ['referans']]) void sorguIstemcisi.invalidateQueries({ queryKey: q }); };
  const m = useMutation({ mutationFn: ({ id, ne }: { id: string; ne: 'onayla' | 'reddet' }) => api.post<any>(`/bekleme/${id}/${ne}`, {}), onSuccess: tazele });
  const B = L.filter((x) => x.durum === 'bekliyor'), D = L.filter((x) => x.durum !== 'bekliyor').slice(0, 5);
  const durumAd: Record<string, string> = { onaylandi: 'onaylandı', reddedildi: 'reddedildi', katildi: 'katıldı' };
  return (
    <AltSayfa acik kapat={kapat} baslik="Onay bekleyenler" yukseklik={200} duraklar={['orta', 'yuksek']}>
      <div className="lejant onay-listesi">
        <h2 className="lejant-baslik">Onay bekleyenler</h2>
        {!B.length && <p className="lejant-not">Şu an onay bekleyen kimse yok.</p>}
        <ul aria-label="Onay bekleyenler">{B.map((x) => (
          <li key={x.id} className="onay-satir">
            <span><b>{x.ad || x.eposta.split('@')[0]}</b><small>{x.eposta}{x.referans_veren ? ` · ${x.referans_veren} önerdi` : ''} · {gunAy(Date.parse(x.tarih))}</small></span>
            <button type="button" className="satir-eylem altin" disabled={m.isPending} onClick={() => m.mutate({ id: x.id, ne: 'onayla' })} aria-label={`${x.eposta}: onayla`}>Onayla</button>
            <button type="button" className="satir-eylem mercan" disabled={m.isPending} onClick={() => m.mutate({ id: x.id, ne: 'reddet' })} aria-label={`${x.eposta}: reddet`}>Reddet</button>
          </li>
        ))}</ul>
        {D.length > 0 && <>
          <h3 className="lejant-alt-baslik">Son kararlar</h3>
          <ul aria-label="Son kararlar">{D.map((x) => <li key={x.id} className="onay-satir"><span><b>{x.ad || x.eposta.split('@')[0]}</b><small>{x.eposta} · {durumAd[x.durum] || x.durum}</small></span></li>)}</ul>
        </>}
        {m.isError && <p className="canli-hata-satir" role="alert">{(m.error as Error).message}</p>}
      </div>
    </AltSayfa>
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

/** Agent bağlantısını kaldırır: sunucu o bağlantının eski jetonlarını reddeder; e-postalı girişte OAuth izni de geri alınır. */
function AgentKaldir({ a, kapat }: { a: { id: string; ad: string; istemci?: string; eski?: boolean }; kapat: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      if (!a.eski) await api.post<any>(`/ben/agent/${a.id}/kaldir`, {});
      if (a.istemci) { try { await kimlik.istemciKaldir(a.istemci); } catch (e) { if (a.eski) throw e; } }
    },
    onSuccess: () => { for (const q of [['agentlar'], ['istemciler']]) void sorguIstemcisi.invalidateQueries({ queryKey: q }); kapat(); },
  });
  const y0 = 560, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik={`${a.ad} bağlantısı kaldırılsın mı?`} yukseklik={y0} duraklar={['orta']} guclu>
      <div className="karar-panel" style={{ height: 260 }}>
        <Metin y={P(y0 + 58)} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Bağlantı kaldırılsın mı?</Metin>
        <Metin y={P(y0 + 96)} fs={17} lh={22} serif renk="ink2">{a.ad} senin adına artık yazamaz; istersen yeniden bağlarsın.</Metin>
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
