import { Fragment, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { Gok } from '../../bilesen/Gok';
import { Baslik } from '../../bilesen/Baslik';
import { gunAy, saat } from '../../cizim/yol.js';
import { git } from '../../yonlendirme';

/** Satır içi: **kalın**, `kod`, [ad](https://…) bağlantı. Başka biçim yok; HTML hiç işlenmez. */
function satirIci(t: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let i = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(t))) {
    if (m.index > i) out.push(t.slice(i, m.index));
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>);
    else if (m[2]) out.push(<code key={k++}>{m[2]}</code>);
    else out.push(<a key={k++} href={m[4]} target="_blank" rel="noopener noreferrer">{m[3]}</a>);
    i = m.index + m[0].length;
  }
  if (i < t.length) out.push(t.slice(i));
  return out;
}

/** AI rutinlerinin yazdığı markdown'ın küçük bir alt kümesi: başlık, madde, numaralı madde, paragraf. */
export function MetinGoster({ metin }: { metin: string }) {
  const bloklar: ReactNode[] = [];
  let liste: { tur: 'ul' | 'ol'; ogeler: string[] } | null = null, para: string[] = [];
  const bosalt = () => {
    if (para.length) { bloklar.push(<p key={bloklar.length}>{para.map((s, j) => <Fragment key={j}>{j ? <br /> : null}{satirIci(s)}</Fragment>)}</p>); para = []; }
    if (liste) { const L = liste.tur; const ic = liste.ogeler.map((s, j) => <li key={j}>{satirIci(s)}</li>); bloklar.push(L === 'ul' ? <ul key={bloklar.length}>{ic}</ul> : <ol key={bloklar.length}>{ic}</ol>); liste = null; }
  };
  for (const ham of metin.replace(/\r/g, '').split('\n')) {
    const s = ham.trimEnd();
    const h = s.match(/^(#{1,4})\s+(.*)$/), ul = s.match(/^\s*[-*•]\s+(.*)$/), ol = s.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!s.trim()) { bosalt(); continue; }
    if (h) { bosalt(); bloklar.push(h[1].length <= 2 ? <h2 key={bloklar.length}>{satirIci(h[2])}</h2> : <h3 key={bloklar.length}>{satirIci(h[2])}</h3>); continue; }
    if (ul || ol) {
      const tur = ul ? 'ul' : 'ol';
      if (para.length || (liste && liste.tur !== tur)) bosalt();
      if (!liste) liste = { tur, ogeler: [] };
      liste.ogeler.push((ul || ol)![1]);
      continue;
    }
    if (/^-{3,}$/.test(s.trim())) { bosalt(); bloklar.push(<hr key={bloklar.length} />); continue; }
    if (liste) bosalt();
    para.push(s);
  }
  bosalt();
  return <div className="cikti-metin">{bloklar}</div>;
}

/** B11/B16 (4 Kas): bir çıktının okunur sayfası; görev detayındaki çıktıya basınca yeni sekmede açılır. */
export function CiktiSayfasi({ kod, id }: { kod: string; id: string }) {
  const q = useQuery({ queryKey: ['cikti', kod, id], queryFn: () => api.get<any>(`/cikti/${encodeURIComponent(id)}?akis=${encodeURIComponent(kod)}`), retry: false });
  const c = q.data?.cikti;
  const geri = () => (history.length > 1 ? history.back() : git(c ? `/akis/${encodeURIComponent(kod)}/adim/${c.adim_no}` : `/akis/${encodeURIComponent(kod)}`));
  const t = c ? Date.parse(c.tarih) : NaN;
  return (
    <>
      <Gok tohum={44} yildiz={160} />
      <main className="cikti-sayfa" aria-label="Çıktı">
        <Baslik baslik={c?.ad || 'Çıktı'} geri={geri} />
        {q.isPending && <p className="cikti-alt">Yükleniyor…</p>}
        {q.isError && <p className="canli-hata-satir" role="alert">{(q.error as Error).message}</p>}
        {c && <>
          <p className="cikti-alt">{[c.adim_no != null ? `${c.adim_no}. görev` : null, c.arac || c.kim, Number.isFinite(t) ? `${gunAy(t)} ${saat(t)}` : null].filter(Boolean).join(' · ')}</p>
          {c.ozet && c.ozet !== c.icerik && <p className="cikti-ozet">{c.ozet}</p>}
          {c.icerik ? <MetinGoster metin={c.icerik} /> : !c.ozet && <p className="cikti-alt">Bu çıktının metni yok.</p>}
          {c.url && <p><a className="rk-git" href={c.url} target="_blank" rel="noopener noreferrer">Bağlantıyı aç</a></p>}
          <button type="button" className="metin-baglanti" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${c.adim_no}`)}>Göreve git</button>
        </>}
      </main>
    </>
  );
}
