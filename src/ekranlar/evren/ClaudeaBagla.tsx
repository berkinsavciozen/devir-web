import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import type { Ben } from '../../api/turler';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { dikkatIkon, kopyaIkon, tikIkon } from '../../cizim/ekran';
import { planet } from '../../cizim/ortak.js';
import { git } from '../../yonlendirme';

interface YeniAnahtar { anahtar: { id: string }; token: string; mcp_adresi: string }
const CLAUDE_BAGLAYICI = 'https://claude.ai/settings/connectors';
const YOKLAMA = 5000;

/** Kısaltılmış gösterim: kopyalanan tam değerdir. */
const kisaAdres = (a: string) => { const i = a.indexOf('/functions/'); return i >= 0 ? '…' + a.slice(i).replace(/\/dv_\S+$/, '/dv_••••') : a; };
const kisaAnahtar = (t: string) => `${t.slice(0, 7)} •••• •••• ${t.slice(-4)}`;

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

/** A3 · Claude'a bağla: POST /ben/anahtar; sahipte GET /anahtarlar 5 sn'de bir yoklanır. */
export function ClaudeaBagla({ ben }: { ben: Ben }) {
  const [anahtar, setAnahtar] = useState<YeniAnahtar | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [baglandi, setBaglandi] = useState(false);
  const istendi = useRef(false);
  const qc = useQueryClient();
  const sahip = ben.rol === 'sahip';

  useEffect(() => {
    if (istendi.current) return;
    istendi.current = true;
    api.post<YeniAnahtar>('/ben/anahtar').then(setAnahtar).catch((e) => setHata(e instanceof ApiHatasi ? e.hata : 'Anahtar üretilemedi. Yeniden dene.'));
  }, []);

  useEffect(() => {
    if (!anahtar || !sahip || baglandi) return;
    const yokla = async () => {
      try {
        const r = await api.get<{ anahtarlar: Array<{ id: string; son_kullanim: string | null }> }>('/anahtarlar');
        if (r.anahtarlar.find((k) => k.id === anahtar.anahtar.id)?.son_kullanim) setBaglandi(true);
      } catch { /* bir sonrakinde */ }
    };
    const i = window.setInterval(yokla, YOKLAMA);
    return () => clearInterval(i);
  }, [anahtar, sahip, baglandi]);

  useEffect(() => {
    if (!baglandi) return;
    const t = window.setTimeout(() => { void qc.invalidateQueries({ queryKey: ['ozet'] }); git('/', { yerine: true }); }, 1200);
    return () => clearTimeout(t);
  }, [baglandi, qc]);

  const adim = (n: number, y: number, metin: string) => (
    <>
      <Kutu x={21} y={y - 13} w={26} h={26} className="adim-no" aria-hidden>{n}</Kutu>
      <Metin y={y + 5} x={58} fs={14} agirlik={600}><span className="gorunmez">{n}. </span>{metin}</Metin>
    </>
  );

  const kartCizim =
    `<circle cx="64" cy="75" r="46" fill="url(#${baglandi ? 'glowGold' : 'glowLilac'})"/>` +
    [34, 26].map((r) => `<circle cx="64" cy="75" r="${r}" fill="none" stroke="${baglandi ? '#FFD27A' : '#B9A6F2'}" stroke-width="1.2" stroke-dasharray="2 4" opacity="${r === 34 ? .5 : .85}"/>`).join('') +
    planet(64, 75, 16, baglandi ? 'lit' : 'dark', { life: false });

  return (
    <Sahne gok={{ tohum: 11, yildiz: 220 }} etiket="Claude’a bağla">
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Claude’a bağla" geri={() => history.length > 1 ? history.back() : git('/')} /></Kutu>
      <Metin y={112} fs={17} lh={22} serif renk="ink2">İki satırı Claude’a yapıştır;<br />bağlanınca burası yanar.</Metin>
      {adim(1, 182, 'Claude › Ayarlar › Bağlayıcılar › Ekle')}
      {adim(2, 236, 'Adresi yapıştır')}
      <KopyaAlani y={256} deger={anahtar?.mcp_adresi ?? null} gosterim={anahtar ? kisaAdres(anahtar.mcp_adresi) : ''} etiket="MCP adresi" />
      {adim(3, 340, 'Anahtarı yapıştır')}
      <KopyaAlani y={360} deger={anahtar?.token ?? null} gosterim={anahtar ? kisaAnahtar(anahtar.token) : ''} etiket="Anahtar" es />
      <Kutu x={57} y={419} w={18} h={18} aria-hidden><Ikon svg={dikkatIkon()} w={18} /></Kutu>
      <Metin y={432} x={80} fs={12} renk="ink3">Anahtar yalnızca bu ekranda bir kez görünür.</Metin>

      <Kutu y={470} h={150} className={`kart baglanti-karti ${baglandi ? 'baglandi' : ''} ${hata ? 'hatali' : ''}`} role="status" aria-live="polite">
        <svg aria-hidden className="baglanti-gezegen" width="128" height="150" viewBox="0 0 128 150" dangerouslySetInnerHTML={{ __html: kartCizim }} />
        <div className="baglanti-metin">
          {hata ? <><b>Anahtar üretilemedi</b><span className="mercan">{hata}</span></>
            : baglandi ? <><b>Bağlandı</b><span>Claude artık bu alana yazıyor.</span></>
            : sahip ? <><b>Bağlantı bekleniyor</b><span>Claude ilk çağrıyı yapınca<br />bağlantı kurulmuş olur.</span></>
            : <><b>Bağlantı bekleniyor</b><span>Claude’da ilk komutu<br />verince hazır.</span></>}
        </div>
      </Kutu>
      <Dugme style={{ top: 660 }} onClick={() => window.open(CLAUDE_BAGLAYICI, '_blank', 'noopener')}>Claude’u aç</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 726 }} onClick={() => git('/', { yerine: true })}>Sonra</Dugme>
    </Sahne>
  );
}
