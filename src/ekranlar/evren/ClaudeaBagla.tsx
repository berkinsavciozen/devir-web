import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { API_TABAN, SAHTE } from '../../api/ortam';
import type { Ben } from '../../api/turler';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { bilgiIkon, kopyaIkon, tikIkon } from '../../cizim/ekran';
import { planet } from '../../cizim/ortak.js';
import { arama, git } from '../../yonlendirme';
import { gunAy } from '../../cizim/yol.js';

/**
 * Uygulamaya göre yol (B12/C22/C23/K9, 0.34.0; 0.35.0'da altı uygulama). Hepsi aynı anahtarsız MCP adresini ekler ve
 * Devir'de e-postayla onaylar (OAuth, istemci kendini kaydeder). not: o uygulamaya özgü kısıt; yollar Kasım 2026.
 */
export const UYGULAMALAR = {
  claude: { ad: 'Claude', a: 'Claude’a', da: 'Claude’da', i: 'Claude’u', ac: 'https://claude.ai/customize/connectors', yol: 'Claude › Customize › Connectors › Add custom connector', esle: /claude/i, not: '' },
  chatgpt: { ad: 'ChatGPT', a: 'ChatGPT’ye', da: 'ChatGPT’de', i: 'ChatGPT’yi', ac: 'https://chatgpt.com/#settings/Connectors', yol: 'ChatGPT › Ayarlar › Apps & Connectors › Create (Developer mode açık)', esle: /chatgpt|openai/i, not: 'Create yoksa Apps’te Developer mode’u aç.' },
  gemini: { ad: 'Gemini', a: 'Gemini’ye', da: 'Gemini’de', i: 'Gemini’yi', ac: 'https://gemini.google.com/', yol: 'Gemini (web) › Settings › Connected Apps › Add a custom app', esle: /gemini/i, not: 'Web’den eklenir; şimdilik kişisel hesap, İngilizce, ABD.' },
  perplexity: { ad: 'Perplexity', a: 'Perplexity’ye', da: 'Perplexity’de', i: 'Perplexity’yi', ac: 'https://www.perplexity.ai/', yol: 'Perplexity › Plugins › Add custom › MCP connector › Remote', esle: /perplexity/i, not: 'Plugins yoksa Customize › Connectors. Kimlik olarak OAuth seç.' },
  lechat: { ad: 'Le Chat', a: 'Le Chat’ya', da: 'Le Chat’da', i: 'Le Chat’yı', ac: 'https://chat.mistral.ai/', yol: 'Le Chat › Intelligence › Connectors › Add Connector › Custom MCP', esle: /le ?chat|mistral/i, not: 'Adı boşluksuz yaz: Devir. Ekipte yönetici ekler.' },
  grok: { ad: 'Grok', a: 'Grok’a', da: 'Grok’ta', i: 'Grok’u', ac: 'https://grok.com/connectors', yol: 'Grok › Connectors › New Connector › Custom', esle: /grok/i, not: 'Ücretli hesap gerekir.' },
} as const;
export type Uygulama = keyof typeof UYGULAMALAR;
const YOKLAMA = 5000;
/** MCP adresi anahtarsızdır (S-B1): kişi bağlayıcıyı ekleyince Devir'de e-postasıyla onaylar (OAuth). */
const MCP_ADRESI = SAHTE ? 'https://sahte.devir/functions/v1/devir-mcp' : API_TABAN;

/** Kısaltılmış gösterim: kopyalanan tam değerdir. */
const kisaAdres = (a: string) => { const i = a.indexOf('/functions/'); return i >= 0 ? '…' + a.slice(i) : a; };

function KopyaAlani({ y, deger, gosterim, etiket, es }: { y: number; deger: string | null; gosterim: string; etiket: string; es?: boolean }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const kopyala = async () => {
    if (!deger) return;
    try { await navigator.clipboard.writeText(deger); } catch {
      const t = document.createElement('textarea'); t.value = deger; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setKopyalandi(true); window.setTimeout(() => setKopyalandi(false), 1200);
  };
  return (
    <Kutu x={58} y={y} h={48} className="alan kopya-alani" style={{ fontSize: es ? 14 : 13.5, letterSpacing: es ? '.3px' : undefined }}>
      <span className="kopya-deger" aria-label={etiket}>{deger ? gosterim : '…'}</span>
      <button className="kopya-dugme" onClick={kopyala} disabled={!deger} aria-label={kopyalandi ? 'Kopyalandı' : `${etiket} kopyala`}>
        <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" dangerouslySetInnerHTML={{ __html: kopyalandi ? tikIkon() : kopyaIkon() }} />
      </button>
      <span className="gorunmez" role="status">{kopyalandi ? 'Kopyalandı' : ''}</span>
    </Kutu>
  );
}

/**
 * A3 · Claude, ChatGPT, Gemini, Perplexity, Le Chat ya da Grok'a bağla: uygulama seçimi + anahtarsız adres + OAuth onayı (K9).
 * Zaten bağlıysa (C12) "bağlı" gösterir; değilse /ben 5 sn'de bir yoklanır, ilk MCP çağrısı gelince yanar.
 */
export function ClaudeaBagla({ ben }: { ben: Ben }) {
  const [uyg, setUyg] = useState<Uygulama>(() => { const q = arama().get('uygulama'); return q && q in UYGULAMALAR ? q as Uygulama : 'claude'; });
  const U = UYGULAMALAR[uyg];
  const [baglandi, setBaglandi] = useState(false);
  const acilis = useRef(Date.now());
  const qc = useQueryClient();
  const ag = useQuery({ queryKey: ['agentlar'], queryFn: () => api.get<any>('/ben/agentlar'), retry: false });
  const mevcut = ((ag.data?.agentlar || []) as any[]).filter((a) => U.esle.test(String(a.ad || '')) && !a.kullanilmiyor)
    .sort((a, b) => Date.parse(b.son_kullanim || b.ilk_kullanim || 0) - Date.parse(a.son_kullanim || a.ilk_kullanim || 0))[0] || null;

  useEffect(() => {
    if (baglandi || mevcut) return;
    const yokla = async () => {
      try {
        const r = await api.get<Ben>('/ben');
        if (r.mcp_son_kullanim && Date.parse(r.mcp_son_kullanim) >= acilis.current - 60_000) setBaglandi(true);
      } catch { /* bir sonrakinde */ }
    };
    const i = window.setInterval(yokla, YOKLAMA);
    return () => clearInterval(i);
  }, [baglandi, mevcut]);

  useEffect(() => {
    if (!baglandi) return;
    const t = window.setTimeout(() => { void qc.invalidateQueries({ queryKey: ['ozet'] }); void qc.invalidateQueries({ queryKey: ['agentlar'] }); git('/', { yerine: true }); }, 1200);
    return () => clearTimeout(t);
  }, [baglandi, qc]);

  const adim = (n: number, y: number, metin: string) => (
    <>
      <Kutu x={21} y={y - 13} w={26} h={26} className="adim-no" aria-hidden>{n}</Kutu>
      <Metin y={y + 5} x={58} fs={14} agirlik={600} style={{ right: 16 }}><span className="gorunmez">{n}. </span>{metin}</Metin>
    </>
  );
  const yandi = baglandi || !!mevcut;
  const kartCizim =
    `<circle cx="64" cy="75" r="46" fill="url(#${yandi ? 'glowGold' : 'glowLilac'})"/>` +
    [34, 26].map((r) => `<circle cx="64" cy="75" r="${r}" fill="none" stroke="${yandi ? '#FFD27A' : '#B9A6F2'}" stroke-width="1.2" stroke-dasharray="2 4" opacity="${r === 34 ? .5 : .85}"/>`).join('') +
    planet(64, 75, 16, yandi ? 'lit' : 'dark', { life: false });
  const son = mevcut?.son_kullanim || mevcut?.ilk_kullanim;

  return (
    <Sahne gok={{ tohum: 11, yildiz: 220 }} etiket="Yapay zekâna bağla">
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={`${U.a} bağla`} geri={() => history.length > 1 ? history.back() : git('/')} /></Kutu>
      <Kutu x={0} y={100} h={96} style={{ right: 0 }}>
        <div className="segment uyg-secici" role="tablist" aria-label="Uygulama">
          {(Object.keys(UYGULAMALAR) as Uygulama[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={uyg === k} className={uyg === k ? 'secili' : ''} onClick={() => { setUyg(k); setBaglandi(false); acilis.current = Date.now(); }}>{UYGULAMALAR[k].ad}</button>
          ))}
        </div>
      </Kutu>
      <Metin y={224} fs={15} lh={20} serif renk="ink2">Adresi {U.a} ekle, Devir’de onayla; bağlanınca burası yanar.</Metin>
      {adim(1, 274, U.yol)}
      {adim(2, 322, 'Adresi yapıştır')}
      <KopyaAlani y={342} deger={MCP_ADRESI || null} gosterim={kisaAdres(MCP_ADRESI)} etiket="MCP adresi" />
      {adim(3, 424, `Bağlan’a bas, Devir’de izin ver`)}
      <Kutu x={57} y={451} w={18} h={18} aria-hidden><Ikon svg={bilgiIkon()} w={18} /></Kutu>
      <Metin y={464} x={80} fs={12} lh={16} renk="ink3" style={{ right: 16 }}>Anahtar gerekmez; izni {ben.eposta || 'e-postan'} ile verirsin.{U.not ? ' ' + U.not : ''}{uyg !== 'claude' ? ' AI yapsın şimdilik yalnız Claude’da.' : ''}</Metin>

      <Kutu y={530} h={150} className={`kart baglanti-karti ${yandi ? 'baglandi' : ''}`} role="status" aria-live="polite">
        <svg aria-hidden className="baglanti-gezegen" width="128" height="150" viewBox="0 0 128 150" dangerouslySetInnerHTML={{ __html: kartCizim }} />
        <div className="baglanti-metin">
          {baglandi ? <><b>Bağlandı</b><span>{U.ad} artık bu alana<br />senin adına yazıyor.</span></>
            : mevcut ? <><b>Zaten bağlı</b><span>{U.ad} bu alana yazıyor{son ? ` · son ${gunAy(Date.parse(son))}` : ''}.<br />Yeniden eklemene gerek yok.</span></>
            : <><b>Bağlantı bekleniyor</b><span>İzin verip {U.da} ilk<br />komutu verince hazır.</span></>}
        </div>
      </Kutu>
      <Dugme style={{ top: 706 }} onClick={() => window.open(U.ac, '_blank', 'noopener')}>{U.i} aç</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 770 }} onClick={() => git('/', { yerine: true })}>{mevcut ? 'Evrene dön' : 'Sonra'}</Dugme>
    </Sahne>
  );
}
