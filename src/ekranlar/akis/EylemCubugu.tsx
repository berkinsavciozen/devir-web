import { hamleSimgesi, type Hamle } from '../../cizim/hamle';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { Dugme } from '../../bilesen/Dugme';
import { ship } from '../../cizim/ortak.js';
import { kisaAd } from '../../cizim/yol.js';
import { ozelEk } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { duzeltIstemi, EYLEM_AD, RED_NEDENLERI, type Eylem, type EylemPlani } from './eylemler';

/**
 * W1 (4 Kas): görev detayının eylem çubuğu. Başlığın altında; en çok bir ana, bir ikincil düğme ve seyrek işler için
 * "⋯" menüsü. Hangi düğmenin görüneceğini eylemPlani belirler (matris eylemler.test.ts'te).
 */
export function EylemCubugu({ a, kod, plan, ciktiEkle, baglantiAc, children, hamle}: {
  a: any; kod: string; plan: EylemPlani;
  /** Çıktılar bölümündeki dosya seçicisini açar */
  ciktiEkle: () => void;
  /** dış katılımcıya bağlantı gönderme sayfası */
  baglantiAc: () => void;
  children?: React.ReactNode;
  /** W4: ana düğme hamlenin düştüğü kişinin renginde, simgesi damladaki */
  hamle?: Hamle | null;
}) {
  const yol = `/akis/${encodeURIComponent(kod)}/adim/${a.no}`;
  const yenile = () => { for (const k of [['akis', kod], ['adim', kod, a.no], ['ozet'], ['gorevler']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };
  const yaz = useMutation({
    mutationFn: async (g: Record<string, unknown> | Record<string, unknown>[]) => { for (const x of Array.isArray(g) ? g : [g]) await api.post<any>(yol, x); },
    onSuccess: yenile,
  });
  const [menuAcik, setMenuAcik] = useState(false);
  const [engelAc, setEngelAc] = useState(false);
  const [engel, setEngel] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  // P4 (0.33.0): AI çıktısına geri bildirim; geri_gonder yorum ister, reddet neden ister (hazır nedenler + ek)
  const [geri, setGeri] = useState<null | 'geri_gonder' | 'reddet'>(null);
  const [neden, setNeden] = useState<string | null>(null);
  const [yorum, setYorum] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const kat = useQuery({ queryKey: ['katilimcilar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/katilimcilar`), enabled: plan.menu.includes('onizle'), retry: false });
  useEffect(() => {
    if (!menuAcik) return;
    const kapat = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuAcik(false); };
    addEventListener('keydown', kapat); addEventListener('pointerdown', kapat);
    return () => { removeEventListener('keydown', kapat); removeEventListener('pointerdown', kapat); };
  }, [menuAcik]);
  useEffect(() => { setEngelAc(false); setBilgi(null); setMenuAcik(false); setGeri(null); setNeden(null); setYorum(''); }, [a.no]);
  const geriMetni = () => (geri === 'reddet' ? [neden, yorum.trim()].filter(Boolean).join(': ') : yorum.trim());
  const geriGonder = () => {
    const v = geriMetni(); if (!v || !geri) return;
    yaz.mutate({ [geri]: v }, { onSuccess: () => { setGeri(null); setNeden(null); setYorum(''); setBilgi('Geri bildirim AI’a gitti; yeni sürüm gelince yeniden onayına düşer.'); } });
  };

  const ac = (u?: string | null) => { if (u) window.open(u, '_blank', 'noopener'); };
  const calis = (e: Eylem) => {
    setMenuAcik(false); setBilgi(null);
    switch (e) {
      case 'bitti': case 'kendim_bitir': case 'onayla': return yaz.mutate({ durum: 'tamam' });
      case 'ciktisiz_bitir': return yaz.mutate({ durum: 'tamam', not: 'Çıktısız bitirildi' });
      case 'cikti_ekle': return ciktiEkle();
      case 'claude': case 'claude_dusun': return ac(a.linkler?.claude);
      case 'oturum': return ac(a.oto_oturum);
      case 'engel_bildir': return setEngelAc((x) => !x);
      case 'engel_kaldir': case 'yeniden_ac': return yaz.mutate({ durum: 'hazir' });
      case 'oto_ac': return yaz.mutate({ oto: true });
      case 'oto_kur': return git('/ayarlar?bolum=ben&kur=ai');
      case 'oto_kapat': case 'kendim_yapacagim': return yaz.mutate({ oto: false });
      // yeniden dene: deneme sayısı sıfırlanır (AI yapsın kapatılıp açılır), görev hazıra döner ve rutin yeniden çağrılır
      case 'yeniden_dene': return yaz.mutate(a.oto_durum === 'hata' ? { durum: 'hazir', oto: true } : [{ oto: false }, { durum: 'hazir', oto: true }]);
      case 'geri_gonder': case 'reddet': setEngelAc(false); return setGeri((x) => (x === e ? null : e));
      case 'duzelt': {
        // D4: AI'ın oturumu (yoksa görevin bağlamıyla Claude) açılır, düzeltme istemi panoya konur; görev bakılacak kalır
        const metin = duzeltIstemi(kod, a);
        void navigator.clipboard?.writeText(metin).catch(() => {});
        ac(a.oto_oturum || a.linkler?.claude);
        return setBilgi('Düzeltme istemi panoda: Claude’a yapıştır, neyin düzeltileceğini sonuna ekle. Yeni çıktı gelince yeniden onayına düşer.');
      }
      case 'baglanti': return baglantiAc();
      case 'onizle': {
        const k = (kat.data?.katilimcilar || []).find((x: any) => (a.sahip_kisi_id && x.kisi_id ? x.kisi_id === a.sahip_kisi_id : x.ad.toLocaleLowerCase('tr') === String(a.sahip).toLocaleLowerCase('tr')));
        return k ? git(`/akis/${encodeURIComponent(kod)}/onizleme/${encodeURIComponent(k.id)}`) : baglantiAc();
      }
    }
  };
  const ad = (e: Eylem) => (e === 'baglanti' ? `${ozelEk(kisaAd(a.sahip), 'e')} bağlantı gönder` : EYLEM_AD[e]);
  const mesgul = (e: Eylem | null) => !!e && yaz.isPending && !['claude', 'claude_dusun', 'oturum', 'cikti_ekle', 'oto_kur', 'baglanti', 'onizle', 'duzelt', 'engel_bildir', 'geri_gonder', 'reddet'].includes(e);

  const { ana, ikincil, menu } = plan;
  if (!ana && !ikincil && !menu.length && !children) return null;
  return (
    <div className="gd-eylem" role="group" aria-label="Eylemler">
      {ana && <Dugme className={`statik${hamle ? ' hamle-renkli' : ''}`} mesgul={mesgul(ana)} onClick={() => calis(ana)}
        style={hamle ? { ['--hamle' as string]: hamle.renk } : undefined}
        {...(hamle && ana !== 'baglanti' ? { ikonX: 20, kayma: 8, ikon: <svg aria-hidden width="26" height="26" viewBox="-5 -5 10 10" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: `<circle r="4.6" fill="#08222E" opacity=".14"/>${hamleSimgesi(hamle.tur, 1.15, '#08222E')}` }} /> } : {})}
        {...(ana === 'baglanti' ? { ikonX: 56, kayma: 14, ikon: <svg aria-hidden width="40" height="30" viewBox="-20 -15 40 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 1, 0, 'dis', '', '#2A1D4F', .75) }} /> } : {})}>{ad(ana)}</Dugme>}
      {(ikincil || menu.length > 0) && <div className="gd-eylem-sira">
        {ikincil ? <Dugme className="statik" tur="ikincil" ton="lila" yukseklik={48} fs={15} mesgul={mesgul(ikincil)} onClick={() => calis(ikincil)}>{ad(ikincil)}</Dugme> : <span className="gd-eylem-bosluk" />}
        {menu.length > 0 && <div className="gd-daha" ref={menuRef}>
          <button type="button" className="gd-daha-dugme" aria-label="Diğer eylemler" aria-haspopup="menu" aria-expanded={menuAcik} onClick={() => setMenuAcik((x) => !x)}>
            <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><circle cx="-6" r="1.8" /><circle r="1.8" /><circle cx="6" r="1.8" /></svg>
          </button>
          {menuAcik && <div className="gd-menu" role="menu" aria-label="Diğer eylemler">
            {menu.map((e) => <button key={e} type="button" role="menuitem" className={`gd-menu-oge${e === 'engel_bildir' || e === 'oto_kapat' || e === 'kendim_yapacagim' || e === 'reddet' ? ' mercan' : ''}`} onClick={() => calis(e)}>{ad(e)}</button>)}
          </div>}
        </div>}
      </div>}
      {engelAc && <form className="gd-alt-ekle gd-engel" onSubmit={(e) => { e.preventDefault(); const v = engel.trim(); if (v) yaz.mutate({ durum: 'engelli', engel: v }, { onSuccess: () => { setEngelAc(false); setEngel(''); } }); }}>
        <input className="alan" value={engel} autoFocus onChange={(e) => setEngel(e.target.value)} placeholder="Ne ya da kim bekleniyor?" aria-label="Neye takıldın" maxLength={160} />
        <button type="submit" className="gd-alt-ekle-dugme" disabled={!engel.trim() || yaz.isPending}>Kaydet</button>
      </form>}
      {geri && <form className="gd-alt-ekle gd-geri" aria-label={EYLEM_AD[geri]} onSubmit={(e) => { e.preventDefault(); geriGonder(); }}>
        {geri === 'reddet' && <div className="gd-geri-nedenler" role="radiogroup" aria-label="Red nedeni">
          {RED_NEDENLERI.map((n) => <button key={n} type="button" role="radio" aria-checked={neden === n} className={`gd-cip${neden === n ? ' secili' : ''}`} onClick={() => setNeden((x) => (x === n ? null : n))}>{n}</button>)}
        </div>}
        <textarea className="alan" rows={2} value={yorum} autoFocus onChange={(e) => setYorum(e.target.value)} maxLength={1000}
          placeholder={geri === 'reddet' ? 'Ne yanlıştı? (isteğe bağlı ayrıntı)' : 'AI neyi değiştirsin?'} aria-label={geri === 'reddet' ? 'Red ayrıntısı' : 'Yorum'} />
        <button type="submit" className="gd-alt-ekle-dugme" disabled={!geriMetni() || yaz.isPending}>{geri === 'reddet' ? 'Reddet, yeniden yapsın' : 'Geri gönder'}</button>
      </form>}
      {children}
      {bilgi && <p className="gd-satir" role="status">{bilgi}</p>}
      {yaz.isError && <p className="canli-hata-satir" role="alert">{(yaz.error as Error).message}</p>}
    </div>
  );
}
