import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { Gok } from '../../bilesen/Gok';
import { Baslik } from '../../bilesen/Baslik';
import { gunAy, saat } from '../../cizim/yol.js';
import { git } from '../../yonlendirme';
import { Markdown } from '../../metin/markdown';

/** 12 Kas: çıktı metni GFM alt kümesiyle (tablolar dahil) okunur; okuyucu src/metin/markdown.tsx'te. */
export function MetinGoster({ metin }: { metin: string }) {
  return <Markdown metin={metin} />;
}

const adresKisa = (u: string) => { try { const x = new URL(u); return x.host.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.slice(0, 28) + (x.pathname.length > 28 ? '…' : '') : ''); } catch { return u; } };

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
          {c.url && <p className="cikti-baglanti"><a className="rk-git" href={c.url} target="_blank" rel="noopener noreferrer">Bağlantıyı aç</a><span>{adresKisa(c.url)}</span></p>}
          {c.ozet && c.ozet !== c.icerik && <p className="cikti-ozet">{c.ozet}</p>}
          {c.icerik ? <MetinGoster metin={c.icerik} /> : !c.ozet && <p className="cikti-alt">Bu çıktının metni yok.</p>}
          <button type="button" className="metin-baglanti" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${c.adim_no}`)}>Göreve git</button>
        </>}
      </main>
    </>
  );
}
