import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi, useBen } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { gunAy } from '../../cizim/yol.js';
import { ozelEk } from '../../metin/turkce';
import { Segment } from '../akis/Adim';
import { git } from '../../yonlendirme';
import { KopyaAlan } from './Ayarlar';
import { kisiGemi, rolAdi, SatirKart, Svg, useUyeler } from './Hesap';

const GOK = { tohum: 17, yildiz: 200 };
const ROL = ['sahip', 'ekip', 'dis'] as const;
const ROL_AD: Record<string, string> = { sahip: 'Sahip', ekip: 'Ekip', dis: 'Dış' };
const UYARI = (sc = .6) => `<g transform="scale(${sc})"><path d="M0,-10 L10,8 L-10,8Z" fill="none" stroke="#FF8A78" stroke-width="1.8" stroke-linejoin="round"/><rect x="-1" y="-4" width="2" height="7" rx="1" fill="#FF8A78"/><circle cy="5.3" r="1.2" fill="#FF8A78"/></g>`;
const ZARF = `<rect x="-40" y="-28" width="80" height="56" rx="10" fill="url(#btn)"/><path d="M-36,-24 L0,4 L36,-24" fill="none" stroke="#2A1D4F" stroke-opacity=".55" stroke-width="2.4" stroke-linejoin="round"/><path d="M-36,24 L-12,2 M36,24 L12,2" stroke="#2A1D4F" stroke-opacity=".25" stroke-width="1.6"/>`;
const GITMEYEN = 'devir:gitmeyen-davetler';
const gitmeyenler = (): string[] => { try { return JSON.parse(localStorage.getItem(GITMEYEN) || '[]'); } catch { return []; } };
const gitmedi = (id: string) => { try { localStorage.setItem(GITMEYEN, JSON.stringify([...new Set([...gitmeyenler(), id])])); } catch { /* yok */ } };
const kisiAdi = (x: { kisi?: string | null; eposta: string }) => x.kisi || x.eposta.split('@')[0];
const webAdresi = () => `${location.origin}/giris`;

/** K2 cümlesi: "Selin katıldı; Emre’nin daveti bekliyor." */
export function ekipCumlesi(uyeler: any[], davetler: any[]): string {
  const son = uyeler.filter((u) => !u.ben).sort((a, b) => Date.parse(b.katildi) - Date.parse(a.katildi))[0];
  const bas = son ? `${kisiAdi(son)} katıldı` : 'Ekipte şimdilik yalnızsın';
  const dv = davetler.length === 1 ? `${ozelEk(kisiAdi(davetler[0]), 'in')} daveti bekliyor` : davetler.length ? `${davetler.length} davet bekliyor` : '';
  return `${bas}${dv ? `; ${dv}` : ''}.`;
}

/** K2 · Ekip: davetler, üyeler, bilgi satırı, "Kişi davet et" (§5 K2). */
export function Ekip() {
  const ben = useBen().data;
  const q = useUyeler();
  const [sayfa, setSayfa] = useState<null | { tur: 'davet' } | { tur: 'paylas'; davet: any } | { tur: 'uye'; uye: any } | { tur: 'cikar'; uye: any }>(null);
  const [geriAl, setGeriAl] = useState<any>(null);
  const tazele = () => void sorguIstemcisi.invalidateQueries({ queryKey: ['uyeler'] });
  const iptal = useMutation({ mutationFn: (d: any) => api.post<any>(`/davet/${d.id}/iptal`, {}), onSuccess: (_, d) => { setGeriAl(d); tazele(); } });
  const geriAlM = useMutation({ mutationFn: (d: any) => api.post<any>('/davet', { eposta: d.eposta, kisi: d.kisi, rol: d.rol, kapsam: d.kapsam }), onSuccess: () => { setGeriAl(null); tazele(); } });
  useEffect(() => { if (!geriAl) return; const t = setTimeout(() => setGeriAl(null), 5000); return () => clearTimeout(t); }, [geriAl]);
  const geri = () => (history.length > 1 ? history.back() : git('/ayarlar'));
  const U: any[] = q.data?.uyeler || [], D: any[] = q.data?.davetler || [];
  const posta = q.data?.posta !== false;
  const gm = gitmeyenler();
  // yerleşim (son-090 K2): davet kartı 124 + 12; ÜYELER başlığı, satırlar 74 arayla; bilgi satırı
  const davetL = 160, uyeL = D.length ? 174 + D.length * 136 + 26 : 160;
  const bilgiY = uyeL + 44 + U.length * 74;
  const altY = Math.max(742, bilgiY + 40);
  if (ben && ben.rol !== 'sahip') return <Sahne gok={GOK} etiket="Ekip"><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Ekip" geri={geri} /></Kutu><Metin y={112} fs={17} lh={22} serif renk="ink2">Ekibi yalnız alanın sahibi yönetir.</Metin></Sahne>;
  return (
    <>
      <Sahne gok={GOK} etiket="Ekip" yukseklik={altY + 102}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Ekip" geri={geri} /></Kutu>
        {q.data && <Metin y={110} fs={17.5} lh={22} serif as="p" className="tek-satir">{ekipCumlesi(U, D)}</Metin>}
        {D.length > 0 && <h3 className="bolum-baslik" style={{ top: davetL - 12 }}>DAVETLER</h3>}
        {D.map((d, i) => {
          const y = 174 + i * 136, hata = !posta || gm.includes(d.id);
          return (
            <section key={d.id} className={`kart davet-kart ${hata ? 'hata' : ''}`} style={{ top: y }} aria-label={`${kisiAdi(d)} daveti`}>
              <Svg w={40} h={40} x={8} y={14} svg={kisiGemi(kisiAdi(d), d.rol, false, 28, 34, .85)} />
              <b className="davet-ad">{kisiAdi(d)}</b>
              <small className="davet-alt">{rolAdi(d.rol)}{d.kapsam ? ` · ${d.kapsam}` : ''} · {gunAy(Date.parse(d.tarih))}</small>
              {hata && <span className="davet-uyari"><svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14" dangerouslySetInnerHTML={{ __html: UYARI() }} />e-posta gitmedi</span>}
              <Dugme tur="ikincil" ton="altin" yukseklik={44} fs={14} className="davet-paylas" onClick={() => setSayfa({ tur: 'paylas', davet: d })}>Bağlantıyı paylaş</Dugme>
              <Dugme tur="ikincil" ton="mercan" yukseklik={44} fs={14} className="davet-iptal" mesgul={iptal.isPending && iptal.variables?.id === d.id} onClick={() => iptal.mutate(d)}>İptal</Dugme>
            </section>
          );
        })}
        <h3 className="bolum-baslik" style={{ top: uyeL - 12 }}>ÜYELER</h3>
        {U.map((u, i) => {
          const y = uyeL + 14 + i * 74;
          return <SatirKart key={u.id} y={y} h={66} ikon={kisiGemi(kisiAdi(u), u.rol, u.rol === 'sahip', 26, 32, .85)} ust={kisiAdi(u)}
            alt={u.ben ? `${rolAdi(u.rol)} · bu sen` : u.son_giris ? `son giriş ${gunAy(Date.parse(u.son_giris))}` : 'henüz girmedi'}
            sag={u.ben ? <span className="satir-not">{rolAdi(u.rol)}</span> : <button type="button" className="rol-dugme" onClick={() => setSayfa({ tur: 'uye', uye: u })} aria-label={`${kisiAdi(u)}: rol ${ROL_AD[u.rol]}`}><span>{ROL_AD[u.rol]}</span><svg aria-hidden width="12" height="8" viewBox="0 0 12 8"><path d="M1,1 L6,7 L11,1" stroke="#D9CCFF" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg></button>} />;
        })}
        {q.data && !posta && <p className="bilgi-satir" style={{ top: bilgiY - 10 }}><svg aria-hidden width="16" height="16" viewBox="-8 -8 16 16"><circle r="7" fill="none" stroke="#FFD27A" strokeWidth="1.4" /><rect x="-.8" y="-1" width="1.6" height="4.6" fill="#FFD27A" /><circle cy="-3.4" r=".9" fill="#FFD27A" /></svg>Davet e-postaları şimdilik gitmiyor; bağlantıyı sen paylaş.</p>}
        {geriAl && <span className="hap silindi-hap geri-al" role="status" style={{ top: altY - 50 }}>Davet iptal edildi · <button type="button" onClick={() => geriAlM.mutate(geriAl)}>Geri al</button></span>}
        <Dugme style={{ top: altY }} fs={16} ikonX={126 - 20} kayma={8} onClick={() => setSayfa({ tur: 'davet' })}
          ikon={<svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14"><path d="M0,-6 L0,6 M-6,0 L6,0" stroke="#2A1D4F" strokeWidth="2.4" strokeLinecap="round" /></svg>}>Kişi davet et</Dugme>
      </Sahne>
      {sayfa?.tur === 'davet' && <DavetEt kapat={() => setSayfa(null)} bitti={(r) => { tazele(); if (r.gonderildi) setSayfa(null); else { gitmedi(r.davet.id); setSayfa({ tur: 'paylas', davet: r.davet }); } }} />}
      {sayfa?.tur === 'paylas' && <DavetPaylas d={sayfa.davet} kapat={() => setSayfa(null)} />}
      {sayfa?.tur === 'uye' && <UyeSayfa u={sayfa.uye} kapat={() => setSayfa(null)} cikar={() => setSayfa({ tur: 'cikar', uye: sayfa.uye })} />}
      {sayfa?.tur === 'cikar' && <UyeCikar u={sayfa.uye} kapat={() => setSayfa(null)} />}
    </>
  );
}

/** Akışlardaki sahip adları (dış kapsam önerisi): önbellekteki akış detaylarından. */
function sahipAdlari(): string[] {
  const s = new Set<string>();
  for (const [, d] of sorguIstemcisi.getQueriesData<any>({ queryKey: ['akis'] })) for (const a of d?.adimlar || []) if (a.sahip_tip === 'dis' || a.sahip_tip === 'insan') s.add(a.sahip);
  return [...s].sort((a, b) => a.localeCompare(b, 'tr'));
}

/** K2b · Kişi davet et: e-posta, ad, rol; dışta adımlardaki adı (§5 K2b). */
function DavetEt({ kapat, bitti }: { kapat: () => void; bitti: (r: any) => void }) {
  const [eposta, setEposta] = useState('');
  const [kisi, setKisi] = useState('');
  const [rol, setRol] = useState(0);
  const [kapsam, setKapsam] = useState('');
  const adlar = useMemo(sahipAdlari, []);
  const m = useMutation({ mutationFn: () => api.post<any>('/davet', { eposta: eposta.trim(), kisi: kisi.trim() || undefined, rol: rol ? 'dis' : 'ekip', kapsam: rol ? kapsam.trim() || kisi.trim() : undefined }), onSuccess: bitti });
  const y0 = 296, P = (y: number) => y - (y0 + 28);
  const btnY = rol ? y0 + 410 : y0 + 326;
  return (
    <AltSayfa acik kapat={kapat} baslik="Kişi davet et" yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <form className="karar-panel" style={{ height: btnY + 54 + 40 - y0 - 28 }} onSubmit={(e) => { e.preventDefault(); if (/\S+@\S+\.\S+/.test(eposta)) m.mutate(); }}>
        <Metin y={P(y0 + 54)} fs={24} lh={30} serif agirlik={700} as="h2">Kişi davet et</Metin>
        <label className="dis-alan" style={{ top: P(y0 + 96) - 26 }}><span className="alan-etiket">E-posta</span><input className="alan" type="email" autoComplete="email" value={eposta} onChange={(e) => setEposta(e.target.value)} /></label>
        <label className="dis-alan" style={{ top: P(y0 + 172) - 26 }}><span className="alan-etiket">Adı</span><input className="alan" value={kisi} onChange={(e) => setKisi(e.target.value)} /></label>
        <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: P(y0 + 240) - 12 }}>Rol</span>
        <div className="dis-segment" style={{ top: P(y0 + 248) }}><Segment secenekler={['Ekip', 'Dış katılımcı']} aktif={rol} sec={setRol} /></div>
        {rol === 1 && <>
          <label className="dis-alan" style={{ top: P(y0 + 326) - 26 }}><span className="alan-etiket">Adımlardaki adı</span><input className="alan" list="sahip-adlari" value={kapsam} onChange={(e) => setKapsam(e.target.value)} placeholder={kisi || undefined} /></label>
          <datalist id="sahip-adlari">{adlar.map((a) => <option key={a} value={a} />)}</datalist>
          <Metin y={P(y0 + 390)} x={22} fs={12} lh={16} renk="ink3">Yalnız bu addaki adımları görür.</Metin>
        </>}
        <Dugme type="submit" style={{ top: P(btnY) }} fs={16} disabled={!/\S+@\S+\.\S+/.test(eposta)} mesgul={m.isPending}>Davet et</Dugme>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(btnY + 60) }}>{(m.error as Error).message}</p>}
      </form>
    </AltSayfa>
  );
}

/** K2c · Davet kaydedildi, e-posta gitmedi: giriş adresini kişiye sen gönder (§5 K2c). */
function DavetPaylas({ d, kapat }: { d: any; kapat: () => void }) {
  const ad = kisiAdi(d), adres = webAdresi();
  const y0 = 352, P = (y: number) => y - (y0 + 28);
  const paylas = async () => {
    const metin = `Merhaba ${ad}, Devir’e ${d.eposta} ile gir; davetin seni bekliyor: ${adres}`;
    try { if (navigator.share) { await navigator.share({ text: metin, url: adres }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(metin)}`, '_blank', 'noopener');
  };
  return (
    <AltSayfa acik kapat={kapat} baslik="Davet kaydedildi" yukseklik={y0} duraklar={['orta']}>
      <div className="karar-panel" style={{ height: 420 }}>
        <Svg w={70} h={60} x={17} y={P(y0 + 62) - 30} svg={`<circle cx="52" cy="${P(y0 + 62)}" r="26" fill="url(#glowGold)" opacity=".7"/><g transform="translate(52,${P(y0 + 62)}) scale(.42)">${ZARF}</g><g transform="translate(70,${P(y0 + 46)})"><circle r="8" fill="#FFD27A"/><path d="M-4.5,0 L-1.2,3.4 L4.8,-3.4" stroke="#2A1D4F" stroke-width="2" fill="none" stroke-linecap="round"/></g>`} />
        <Metin y={P(y0 + 58)} x={92} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">Davet kaydedildi</Metin>
        <Metin y={P(y0 + 80)} x={92} fs={12.5} lh={16} renk="ink3" className="tek-satir">{ad} · {d.rol === 'dis' ? 'dış katılımcı' : rolAdi(d.rol)}</Metin>
        <Metin y={P(y0 + 124)} fs={17} lh={23} serif renk="ink2" style={{ width: 262 }}>E-posta henüz gitmiyor; bu adresi {ozelEk(ad, 'e')} sen gönder.</Metin>
        <KopyaAlan deger={adres} gosterim={adres.replace(/^https?:\/\//, '')} etiket="Giriş adresi" style={{ top: P(y0 + 172) }} />
        <Metin y={P(y0 + 246)} x={22} fs={12.5} lh={16} renk="ink3" className="tek-satir">{d.eposta} ile girince daveti görür.</Metin>
        <Dugme style={{ top: P(y0 + 272) }} fs={16} ikonX={150 - 20} kayma={8} onClick={paylas}
          ikon={<svg aria-hidden width="18" height="20" viewBox="-9 -10 18 20"><path d="M0,-8 L0,4 M-5,-4 L0,-9 L5,-4" stroke="#2A1D4F" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M-7,0 L-7,8 L7,8 L7,0" stroke="#2A1D4F" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}>Paylaş</Dugme>
        <Dugme tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 338) }} onClick={kapat}>Tamam</Dugme>
      </div>
    </AltSayfa>
  );
}

/** K2d · Üye: rol segmenti anında yazılır; dışta kapsam; "Alandan çıkar" (§5 K2d). */
function UyeSayfa({ u, kapat, cikar }: { u: any; kapat: () => void; cikar: () => void }) {
  const [rol, setRol] = useState<string>(u.rol);
  const [kapsam, setKapsam] = useState<string>(u.kapsam || '');
  const m = useMutation({ mutationFn: (g: any) => api.post<any>(`/uye/${u.id}`, g), onSuccess: () => void sorguIstemcisi.invalidateQueries({ queryKey: ['uyeler'] }), onError: () => setRol(u.rol) });
  const dis = rol === 'dis', y0 = dis ? 470 : 540, P = (y: number) => y - (y0 + 28);
  const ad = kisiAdi(u);
  return (
    <AltSayfa acik kapat={kapat} baslik={ad} yukseklik={y0} duraklar={['orta']}>
      <div className="karar-panel" style={{ height: 844 - y0 - 28 }}>
        <Svg w={60} h={60} x={16} y={P(y0 + 56) - 30} svg={kisiGemi(ad, u.rol, u.rol === 'sahip', 46, P(y0 + 56), 1)} />
        <Metin y={P(y0 + 52)} x={76} fs={18} lh={22} agirlik={750} as="h2" className="tek-satir">{ad}</Metin>
        <Metin y={P(y0 + 72)} x={76} fs={12.5} lh={16} renk="ink3" className="tek-satir">{u.eposta}{u.son_giris ? ` · son giriş ${gunAy(Date.parse(u.son_giris))}` : ''}</Metin>
        <span className="alan-etiket" style={{ position: 'absolute', left: 22, top: P(y0 + 116) - 12 }}>Rol</span>
        <div className="dis-segment" style={{ top: P(y0 + 124) }}><Segment secenekler={['Sahip', 'Ekip', 'Dış']} aktif={ROL.indexOf(rol as any)} sec={(i) => { const r = ROL[i]; setRol(r); if (r !== 'dis') m.mutate({ rol: r }); }} /></div>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 176) }}>{(m.error as Error).message}</p>}
        {dis && <form onSubmit={(e) => { e.preventDefault(); m.mutate({ rol: 'dis', kapsam: kapsam.trim() || ad }); }}>
          <label className="dis-alan" style={{ top: P(y0 + 210) - 26 }}><span className="alan-etiket">Adımlardaki adı</span><input className="alan" value={kapsam} onChange={(e) => setKapsam(e.target.value)} placeholder={ad} onBlur={() => m.mutate({ rol: 'dis', kapsam: kapsam.trim() || ad })} /></label>
        </form>}
        <Dugme tur="ikincil" ton="mercan" yukseklik={50} fs={15} style={{ top: P(y0 + (dis ? 276 : 196)) }} ikonX={136 - 20} kayma={8} onClick={cikar}
          ikon={<svg aria-hidden width="16" height="18" viewBox="-8 -9 16 18"><path d="M-7,-5 L7,-5 M-3,-5 L-3,-8 L3,-8 L3,-5 M-5,-5 L-4,8 L4,8 L5,-5" stroke="#FFB4A8" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}>Alandan çıkar</Dugme>
      </div>
    </AltSayfa>
  );
}

/** K2e · Çıkarma onayı; kutu işaretliyse kişinin anahtarları da iptal edilir (§5 K2e). */
function UyeCikar({ u, kapat }: { u: any; kapat: () => void }) {
  const [anahtar, setAnahtar] = useState(true);
  const ad = kisiAdi(u);
  const m = useMutation({
    mutationFn: async () => {
      await api.post<any>(`/uye/${u.id}/cikar`, {});
      if (anahtar) {
        const L = (await api.get<any>('/anahtarlar')).anahtarlar || [];
        for (const k of L.filter((k: any) => !k.iptal && k.kisi === u.kisi)) await api.post<any>(`/anahtar/${k.id}/iptal`, {});
      }
    },
    onSuccess: () => { for (const k of [['uyeler'], ['anahtarlar']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); kapat(); },
  });
  const y0 = 448, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik={`${ad} çıkarılsın mı?`} yukseklik={y0} duraklar={['orta']} guclu>
      <div className="karar-panel" style={{ height: 844 - y0 - 28 }}>
        <Svg w={24} h={24} x={24} y={P(y0 + 52) - 12} svg={`<g transform="translate(36,${P(y0 + 52)})">${UYARI(1)}</g>`} />
        <Metin y={P(y0 + 60)} x={58} fs={23} lh={28} serif agirlik={700} as="h2" className="tek-satir">{ad} çıkarılsın mı?</Metin>
        <Metin y={P(y0 + 100)} fs={17} lh={22} serif renk="ink2" className="tek-satir">{ad} bu alana artık giremez.</Metin>
        <label className={`onay-kutu ${anahtar ? 'secili' : ''}`} style={{ top: P(y0 + 124) }}>
          <input type="checkbox" checked={anahtar} onChange={(e) => setAnahtar(e.target.checked)} />
          <span className="onay-isaret" aria-hidden />
          <span className="onay-metin"><b>{ozelEk(ad, 'in')} anahtarını da iptal et</b><small>Claude bağlantısı da kapanır</small></span>
        </label>
        <Dugme tur="tehlike" style={{ top: P(y0 + 200) }} mesgul={m.isPending} onClick={() => m.mutate()}>Çıkar</Dugme>
        <Dugme tur="ikincil" ton="lila" fs={15} yukseklik={48} style={{ top: P(y0 + 266) }} onClick={kapat}>Vazgeç</Dugme>
        {m.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 322) }}>{(m.error as Error).message}</p>}
      </div>
    </AltSayfa>
  );
}
