import { useEffect, useRef, useState } from 'react';
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
import { git } from '../../yonlendirme';

const CLAUDE_BAGLAYICI = 'https://claude.ai/settings/connectors';
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

/** A3 · Claude'a bağla: anahtarsız adres + OAuth onayı. /ben 5 sn'de bir yoklanır; bu ekran açıldıktan sonra MCP çağrısı gelince yanar. */
export function ClaudeaBagla({ ben }: { ben: Ben }) {
  const [baglandi, setBaglandi] = useState(false);
  const acilis = useRef(Date.now());
  const qc = useQueryClient();

  useEffect(() => {
    if (baglandi) return;
    const yokla = async () => {
      try {
        const r = await api.get<Ben>('/ben');
        if (r.mcp_son_kullanim && Date.parse(r.mcp_son_kullanim) >= acilis.current - 60_000) setBaglandi(true);
      } catch { /* bir sonrakinde */ }
    };
    const i = window.setInterval(yokla, YOKLAMA);
    return () => clearInterval(i);
  }, [baglandi]);

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
      <Metin y={112} fs={17} lh={22} serif renk="ink2">Adresi Claude’a ekle, Devir’de onayla;<br />bağlanınca burası yanar.</Metin>
      {adim(1, 182, 'Claude › Ayarlar › Bağlayıcılar › Ekle')}
      {adim(2, 236, 'Adresi yapıştır')}
      <KopyaAlani y={256} deger={MCP_ADRESI || null} gosterim={kisaAdres(MCP_ADRESI)} etiket="MCP adresi" />
      {adim(3, 340, 'Bağlan’a bas, Devir’de izin ver')}
      <Kutu x={57} y={367} w={18} h={18} aria-hidden><Ikon svg={bilgiIkon()} w={18} /></Kutu>
      <Metin y={380} x={80} fs={12} lh={16} renk="ink3">Anahtar gerekmez; izni {ben.eposta || 'e-postan'} ile verirsin.</Metin>

      <Kutu y={470} h={150} className={`kart baglanti-karti ${baglandi ? 'baglandi' : ''}`} role="status" aria-live="polite">
        <svg aria-hidden className="baglanti-gezegen" width="128" height="150" viewBox="0 0 128 150" dangerouslySetInnerHTML={{ __html: kartCizim }} />
        <div className="baglanti-metin">
          {baglandi ? <><b>Bağlandı</b><span>Claude artık bu alana<br />senin adına yazıyor.</span></>
            : <><b>Bağlantı bekleniyor</b><span>İzin verip Claude’da ilk<br />komutu verince hazır.</span></>}
        </div>
      </Kutu>
      <Dugme style={{ top: 660 }} onClick={() => window.open(CLAUDE_BAGLAYICI, '_blank', 'noopener')}>Claude’u aç</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 726 }} onClick={() => git('/', { yerine: true })}>Sonra</Dugme>
    </Sahne>
  );
}
