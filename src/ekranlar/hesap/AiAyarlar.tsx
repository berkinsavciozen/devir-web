import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { API_TABAN, SAHTE } from '../../api/ortam';
import { sorguIstemcisi, useBen } from '../../api/sorgular';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Sahne } from '../../bilesen/Sahne';
import { gunAy, saat } from '../../cizim/yol.js';
import { arama, git } from '../../yonlendirme';
import { AgentDetay, agentIkonu, baglantiOf, RutinDetay, rutinTuru, uygulamaOf, type Agent, type AgentRutin, type Agentlar, type Baglanti, type Saglik } from './Agentlarim';
import { KopyaAlan, RutinKaldir } from './Ayarlar';
import { RutinKur } from './RutinKur';

/**
 * 16 Kas (agent/rutin tek sayfa, K1–K4): agent'lar, onları çalıştıran Claude rutinleri ve bağlantılar tek sayfada.
 * Sağlık tek kuraldan gelir (sunucu 0.38.0 rutinSagligi): canli, sessiz (zamanlanmış rutin 3 gündür uğramadı), hata,
 * bekleniyor (Devir'de kuruldu, Claude'da henüz çalışmadı), yok. Bağ yalnız buradan, agent kartındaki
 * "Kim çalıştırır" seçicisiyle kurulur; ?agent=<ad> o kartı açar.
 */
type AgentV = Agent;
type RutinV = AgentRutin;
type Veri = Agentlar;

const CLAUDE_RUTINLER = 'https://claude.ai/code/routines';
const MCP_TABAN = () => (SAHTE ? 'https://sahte.devir/functions/v1/devir-mcp' : API_TABAN);
const kisaMcp = (a: string) => { const i = a.indexOf('/functions/'); return i >= 0 ? '…' + a.slice(i) : a; };
const gun = (t: string | null | undefined) => (t ? gunAy(Date.parse(t)) : null);
const zaman = (t: string | null | undefined) => (t ? `${gunAy(Date.parse(t))} ${saat(Date.parse(t))}` : null);
const tazele = () => { for (const k of [['agentlar-ai'], ['tetikler'], ['tetikler-hepsi']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };
const k = (x: string) => x.toLocaleLowerCase('tr');

/** Sağlık rozeti: renk + tek kelime (renk tek başına anlam taşımaz). */
const ROZET: Record<Saglik, { ad: string; sinif: string }> = {
  canli: { ad: 'Canlı', sinif: 'iyi' }, sessiz: { ad: 'Sessiz', sinif: 'uyari' }, hata: { ad: 'Hata', sinif: 'kotu' },
  bekleniyor: { ad: 'İlk çalışma bekleniyor', sinif: 'bekle' }, kapali: { ad: 'Kaldırıldı', sinif: 'sonuk' }, yok: { ad: 'Rutin yok', sinif: 'uyari' },
};
const Rozet = ({ s }: { s: Saglik }) => <span className={`ai-rozet ${ROZET[s].sinif}`}>{ROZET[s].ad}</span>;

/** Agent kartının sağlık cümlesi: kim çalıştırıyor, en son ne zaman uğradı, ne yapmalı. */
export function saglikCumlesi(a: AgentV, sessizGun = 3): string {
  const r = a.rutin_claude_ad || a.rutin_ad;
  switch (a.rutin_durum) {
    case 'canli': return `${r} çalıştırıyor${a.rutin_son ? ` · son uğrama ${zaman(a.rutin_son)}` : ''}.`;
    case 'sessiz': return `${r} rutini ${gun(a.rutin_son)}’den beri uğramadı (${sessizGun} günden uzun). İşler kendiliğinden başlamıyor; Claude’da rutinin açık olduğuna bak.`;
    case 'hata': return `${r} son denemede çalışmadı. Claude’da rutinin tetiğine bak.`;
    case 'bekleniyor': return `${r} Devir’de kuruldu; Claude’daki rutin henüz hiç çalışmadı.`;
    default: return 'Bu agent’ı çalıştıran rutin yok; AI yapsın işleri kendiliğinden başlamaz.';
  }
}

export function AiAyarlar() {
  const ben = useBen().data;
  const aa = useQuery({ queryKey: ['agentlar-ai'], queryFn: () => api.get<Veri>('/agentlar'), enabled: !!ben && ben.rol !== 'dis', retry: false, refetchInterval: 30_000 });
  const bg = useQuery({ queryKey: ['agentlar'], queryFn: () => api.get<any>('/ben/agentlar'), enabled: !!ben?.eposta, retry: false });
  const hedef = arama().get('agent');
  const [acik, setAcik] = useState<string | null>(hedef);
  const [detay, setDetay] = useState<string | null>(null);
  const [kur, setKur] = useState<string | true | null>(arama().get('kur') === 'ai' ? (hedef || true) : null);
  const [rutinAc, setRutinAc] = useState<string | null>(null);
  const [kaldir, setKaldir] = useState<RutinV | null>(null);
  const kartlar = useRef<Record<string, HTMLElement | null>>({});
  // sayfa boyu içerikten: gök ve kaydırma içerik kadar uzar
  const govde = useRef<HTMLDivElement | null>(null);
  const [boy, setBoy] = useState(844);
  useEffect(() => {
    const e = govde.current; if (!e || typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(() => setBoy(Math.max(844, e.offsetHeight + 160))); o.observe(e); return () => o.disconnect();
  });
  useEffect(() => { if (hedef && aa.data) kartlar.current[k(hedef)]?.scrollIntoView({ block: 'center' }); }, [hedef, aa.data]);

  const kapsam = useMutation({
    mutationFn: async ({ a, t }: { a: AgentV; t: RutinV }) => {
      // seçilen rutin bu agent'ı kapsar; önceki rutin agent'ı adıyla sayıyorsa (ve başka agent'ı da varsa) oradan çıkar
      const once = (V?.rutinler || []).find((x) => x.id === a.isleyen_rutin);
      let r: any = null;
      if (t.agentlar != null && !t.agentlar.some((x) => k(x) === k(a.ad))) r = await api.post<any>(`/tetikler/${t.id}/agentlar`, { agentlar: [...t.agentlar, a.ad] });
      if (once && once.id !== t.id && once.agentlar && once.agentlar.length > 1) await api.post<any>(`/tetikler/${once.id}/agentlar`, { agentlar: once.agentlar.filter((x) => k(x) !== k(a.ad)), ai_ac: false });
      return r;
    },
    onSuccess: () => tazele(),
  });
  const otoAc = useMutation({ mutationFn: (ad: string) => api.post<any>(`/agentlar/${encodeURIComponent(ad)}/ai`, {}), onSuccess: () => tazele() });
  const yenidenAc = useMutation({ mutationFn: (id: string) => api.post<any>(`/tetikler/${id}/ac`, {}), onSuccess: () => tazele() });
  const claudeAd = useMutation({ mutationFn: ({ id, ad }: { id: string; ad: string }) => api.post<any>(`/tetikler/${id}/ad`, { claude_ad: ad }), onSuccess: () => { setClaudeAdAc(null); tazele(); } });
  const [claudeAdAc, setClaudeAdAc] = useState<string | null>(null);
  const [claudeAdDeger, setClaudeAdDeger] = useState('');

  const V = aa.data;
  const A = V?.agentlar || [], R = V?.rutinler || [], KR = V?.kapali_rutinler || [];
  const BG: Baglanti[] = (bg.data?.agentlar || []).map((x: any) => ({ id: x.id, ad: x.ad, istemci: x.istemci, alt: `senin adına yazar · ${x.son_kullanim ? `son kullanım ${gun(x.son_kullanim)}` : 'henüz kullanılmadı'}` }));
  const claudeBagli = BG.some((b) => /claude/i.test(`${b.ad} ${b.istemci || ''}`)) || !!ben?.mcp_son_kullanim;
  const canli = R.filter((t) => t.saglik === 'canli').length;
  const sorunlu = R.filter((t) => t.saglik === 'sessiz' || t.saglik === 'hata' || t.saglik === 'bekleniyor');
  const rutinsiz = A.filter((a) => (a.rutin_durum || 'yok') === 'yok');
  const kapali = A.reduce((n, a) => n + (a.ai_kapali || 0), 0);
  const geri = () => (history.length > 1 ? history.back() : git('/ayarlar'));

  const serit = [
    { tamam: claudeBagli, metin: claudeBagli ? 'Claude Devir’e bağlı' : 'Claude bağlı değil', eylem: claudeBagli ? null : <button type="button" className="metin-baglanti" onClick={() => git('/bagla?uygulama=claude')}>Bağla</button> },
    { tamam: canli > 0 && !sorunlu.length && !rutinsiz.length, metin: R.length ? `${canli} canlı rutin${sorunlu.length ? ` · ${sorunlu.length} rutinde sorun` : ''}${rutinsiz.length ? ` · ${rutinsiz.length} agent rutinsiz` : ''}` : 'Henüz rutin yok', eylem: R.length ? null : <button type="button" className="metin-baglanti" onClick={() => setKur(true)}>Rutin kur</button> },
    { tamam: !kapali, metin: kapali ? `${kapali} açık agent işinde AI yapsın kapalı` : 'Açık agent işlerinde AI yapsın açık', eylem: null },
  ];

  const kart = (a: AgentV) => {
    const s: Saglik = a.rutin_durum || 'yok';
    const ac = acik != null && k(acik) === k(a.ad);
    const uyg = a.arac || uygulamaOf(a.ad);
    const isler = [a.acik_is ? `${a.acik_is} açık iş` : 'açık işi yok', a.sirada ? `${a.sirada} AI yapsın sırada` : null, a.bakilacak.length ? `${a.bakilacak.length} onayını bekliyor` : null].filter(Boolean).join(' · ');
    return (
      <li key={a.ad} ref={(e) => { kartlar.current[k(a.ad)] = e; }} className={`ai-kart ${ac ? 'acik' : ''} ${hedef && k(hedef) === k(a.ad) ? 'hedef' : ''}`}>
        <button type="button" className="ai-kart-ust" aria-expanded={ac} onClick={() => setAcik(ac ? null : a.ad)}>
          <svg aria-hidden width="40" height="40" viewBox="6 6 40 40" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: agentIkonu(a, 26, 26, 1.1, V?.kisi) }} />
          <span className="ai-kart-ad"><b>{a.ad}</b><small>{uyg} · {isler}</small></span>
          <Rozet s={s} />
        </button>
        <p className={`ai-kart-cumle ${ROZET[s].sinif}`}>{saglikCumlesi(a, V?.sessiz_gun)}</p>
        {ac && <div className="ai-kart-govde">
          <label className="ai-secici">
            <span>Kim çalıştırır</span>
            <select className="alan" value={a.isleyen_rutin || ''} disabled={kapsam.isPending} onChange={(e) => {
              const v = e.target.value;
              if (v === '__yeni') return setKur(a.ad);
              const t = R.find((x) => x.id === v); if (t) kapsam.mutate({ a, t });
            }}>
              {!a.isleyen_rutin && <option value="">Rutin seç</option>}
              {R.map((t) => <option key={t.id} value={t.id}>{t.claude_ad || t.ad} · {rutinTuru(t).toLocaleLowerCase('tr')}{t.saglik && t.saglik !== 'canli' ? ` · ${ROZET[t.saglik].ad.toLocaleLowerCase('tr')}` : ''}</option>)}
              <option value="__yeni">+ Yeni rutin kur…</option>
            </select>
          </label>
          {kapsam.isError && <p className="canli-hata-satir" role="alert">{(kapsam.error as Error).message}</p>}
          {kapsam.data?.not && <p className="gd-satir" role="status">{kapsam.data.not}</p>}
          {(s === 'sessiz' || s === 'hata' || s === 'bekleniyor') && <div className="ai-eylemler">
            <a className="dugme dugme-ikincil ton-lila ai-kucuk" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude’da rutinleri aç</a>
            <button type="button" className="metin-baglanti" onClick={() => setKur(a.ad)}>Kurulumu yeniden gör</button>
          </div>}
          {s === 'yok' && <Dugme type="button" yukseklik={44} fs={15} onClick={() => setKur(a.ad)}>{a.ad} için rutin kur</Dugme>}
          {!!a.ai_kapali && s !== 'yok' && <p className="gd-satir">{a.ai_kapali} açık işte AI yapsın kapalı. <button type="button" className="metin-baglanti" disabled={otoAc.isPending} onClick={() => otoAc.mutate(a.ad)}>Hepsinde aç</button></p>}
          {otoAc.data?.not && otoAc.variables === a.ad && <p className="gd-satir" role="status">{otoAc.data.not}</p>}
          <div className="ai-eylemler">
            <button type="button" className="metin-baglanti" onClick={() => setDetay(a.ad)}>İşleri, renk ve kaldırma</button>
          </div>
        </div>}
      </li>
    );
  };

  const rutinSatiri = (t: RutinV, kapaliMi = false) => {
    const kim = t.agentlar == null ? ['Tüm agent’ların'] : t.agentlar;
    const s: Saglik = t.saglik || 'canli';
    return (
      <li key={t.id} className={`ai-rutin ${kapaliMi ? 'kapali' : ''}`}>
        <div className="ai-rutin-ust">
          <span className="ai-kart-ad"><b>{t.claude_ad || t.ad}</b>
            <small>{t.claude_ad && t.claude_ad !== t.ad ? `Devir’deki adı ${t.ad} · ` : ''}{rutinTuru(t)}{t.tur === 'zamanli' ? ' (saatte bir uğrar)' : ' (Devir başlatır)'} · {t.son_hata ? 'son deneme başarısız' : t.son_calisma ? `son ${zaman(t.son_calisma)}` : 'henüz çalışmadı'}</small>
          </span>
          <Rozet s={kapaliMi ? 'kapali' : s} />
        </div>
        <div className="ai-cipler">{kim.map((x) => <span key={x} className="ai-cip">{x}</span>)}</div>
        {claudeAdAc === t.id ? <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); claudeAd.mutate({ id: t.id, ad: claudeAdDeger.trim() }); }}>
          <input className="alan" autoFocus value={claudeAdDeger} maxLength={80} placeholder="Claude › Routines’teki adı" aria-label={`${t.ad} rutininin Claude’daki adı`} onChange={(e) => setClaudeAdDeger(e.target.value)} />
          <button type="submit" className="gd-alt-ekle-dugme" disabled={claudeAd.isPending}>Kaydet</button>
        </form> : <div className="ai-eylemler">
          {kapaliMi ? (t.tur === 'zamanli' ? <button type="button" className="metin-baglanti" disabled={yenidenAc.isPending} onClick={() => yenidenAc.mutate(t.id)}>Yeniden aç</button> : <span className="gd-satir">Jetonu silindi; yeniden açmak için tetiği yeniden ekle.</span>) : <>
            <button type="button" className="metin-baglanti" onClick={() => setRutinAc(t.id)}>Agent’ları ve adı düzenle</button>
            <button type="button" className="metin-baglanti" onClick={() => { setClaudeAdAc(t.id); setClaudeAdDeger(t.claude_ad || ''); }}>{t.claude_ad ? 'Claude’daki adı' : 'Claude’daki adını yaz'}</button>
            <a className="metin-baglanti" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude’da aç</a>
          </>}
        </div>}
      </li>
    );
  };

  return (
    <>
      <Sahne gok={{ tohum: 17, yildiz: 200 }} etiket="Agent’lar ve AI yapsın" yukseklik={boy}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Agent’lar ve AI yapsın" geri={geri} /></Kutu>
        <Kutu y={112} className="ai-sayfa"><div ref={govde} className="ai-sayfa-ic">
          {!V && aa.isPending && <p className="gd-satir">Yükleniyor…</p>}
          {aa.isError && <p className="canli-hata-satir" role="alert">{(aa.error as Error).message}</p>}
          {V && <>
            <section aria-label="Hazır mı" className="ai-serit">
              <h2 className="gd-bolum-baslik">HAZIR MI</h2>
              <ul>{serit.map((x, i) => <li key={i} className={x.tamam ? 'tamam' : 'eksik'}><span aria-hidden>{x.tamam ? '✓' : '!'}</span><span>{x.metin}</span>{x.eylem}</li>)}</ul>
            </section>

            <section aria-label="Agent’ların" className="ai-bolum">
              <h2 className="gd-bolum-baslik">AGENT’LARIN</h2>
              {A.length ? <ul className="ai-liste">{A.map(kart)}</ul> : <p className="gd-satir">Henüz agent’ın yok. Bir akışta bir adımı agent’a verince burada görünür.</p>}
            </section>

            <section aria-label="Rutinlerin" className="ai-bolum">
              <h2 className="gd-bolum-baslik">CLAUDE RUTİNLERİN</h2>
              <p className="gd-satir">Rutin, Claude’da senin hesabında çalışan zamanlanmış görevdir; agent’larının işini o yapar. Bir rutin birden çok agent’a bakabilir.</p>
              <ul className="ai-liste">{R.map((t) => rutinSatiri(t))}</ul>
              <Dugme type="button" tur="ikincil" ton="lila" yukseklik={44} fs={15} onClick={() => setKur(true)}>Yeni rutin kur</Dugme>
              {yenidenAc.data?.not && <p className="gd-satir" role="status">{yenidenAc.data.not}</p>}
              {KR.length > 0 && <details className="ai-katli"><summary>Kaldırılan rutinler ({KR.length})</summary><ul className="ai-liste">{KR.map((t) => rutinSatiri(t, true))}</ul></details>}
            </section>

            <section aria-label="Bağlantılar" className="ai-bolum">
              <h2 className="gd-bolum-baslik">BAĞLANTILAR</h2>
              <ul className="ai-liste">{BG.map((b) => <li key={b.id} className="ai-rutin"><span className="ai-kart-ad"><b>{b.ad}</b><small>{b.alt}</small></span></li>)}</ul>
              {!BG.length && <p className="gd-satir">Bağlı uygulama yok.</p>}
              <button type="button" className="metin-baglanti" onClick={() => git('/bagla')}>Uygulama bağla</button>
              <div className="ai-mcp"><KopyaAlan deger={MCP_TABAN()} gosterim={kisaMcp(MCP_TABAN())} etiket="MCP adresi" style={{ position: 'relative' }} /></div>
              <button type="button" className="metin-baglanti" onClick={() => git('/ayarlar?bolum=gelismis')}>Anahtarlar ve agent kararları</button>
            </section>
          </>}
        </div></Kutu>
      </Sahne>
      {detay && V && (() => { const a = A.find((x) => x.ad === detay); return a ? <AgentDetay a={a} veri={V} kip="yonetim" baglanti={baglantiOf(a.ad, BG)} kapat={() => setDetay(null)} kurAc={(ad) => { setDetay(null); setKur(ad); }} rutinKaldir={(t) => { setDetay(null); setKaldir(t); }} /> : null; })()}
      {kur && <RutinKur mcpAdres={MCP_TABAN()} mcpBagli={claudeBagli} agent={typeof kur === 'string' ? kur : null} kapat={() => setKur(null)} />}
      {rutinAc && V && (() => { const t = R.find((x) => x.id === rutinAc); return t ? <RutinDetay t={t} agentlar={A.map((a) => a.ad)} kapat={() => setRutinAc(null)} kaldir={() => { setRutinAc(null); setKaldir(t); }} /> : null; })()}
      {kaldir && <RutinKaldir t={kaldir} kapat={() => setKaldir(null)} />}
    </>
  );
}
