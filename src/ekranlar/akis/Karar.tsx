import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { Dugme } from '../../bilesen/Dugme';
import { gunAy, saat } from '../../cizim/yol.js';
import { ek, ozelEk } from '../../metin/turkce';
import { isPayi } from './Adim';

const kisi = (s: string) => s.replace(/\s*\(.*\)$/, '');
const tamamlaKucuk = (s: string) => s[0].toLocaleLowerCase('tr') + s.slice(1);

/** Kararın kısa adı (takımyıldız): `kisa` yoksa ilk cümleciğin en çok üç kelimesi. */
export function kararKisa(k: { karar: string; kisa?: string | null }): string {
  if (k.kisa) return k.kisa;
  const c = k.karar.split(/[;.:]/)[0].trim().split(/\s+/);
  return c.slice(0, 3).join(' ');
}

/**
 * Görev detayının KARAR bölümü (W2, N19): yalnız karar adımında. Ayrı karar sayfası kalktı; aynı içerik
 * detayın içinde: bekleyen kararda kriter, öneri, seçenekler ve "Kararı ver"; verilmiş kararda kim, ne zaman, kaçı kabul.
 */
export function KararBolumu({ a, kod, ben }: { a: any; kod: string; ben: string }) {
  return a.durum === 'tamam' ? <KararVerildi a={a} /> : <KararBekleyen a={a} kod={kod} ben={ben} />;
}

function KararBekleyen({ a, kod, ben }: { a: any; kod: string; ben: string }) {
  const K = a.karar || {}, sec: any[] = K.secenekler || [], oneri = K.oneri;
  const [secim, setSecim] = useState<string[]>(() => (oneri?.secim?.length ? oneri.secim : []));
  const [metin, setMetin] = useState('');
  const benim = a.sahip === ben && !['atlandi', 'ertelendi'].includes(a.durum);
  const tur = K.tur || 'seçenek';
  const ver = useMutation({
    mutationFn: () => {
      const red = sec.filter((s) => !secim.includes(s.ad)).map((s) => s.ad);
      const icerik = sec.length ? `Kabul: ${secim.join(', ') || 'hiçbiri'}.${red.length ? ` Kabul edilmedi: ${red.join(', ')}.` : ''}` : metin.trim();
      return api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { durum: 'tamam', ...(sec.length ? { karar_secimi: secim } : {}), cikti: { ad: 'Karar', ozet: icerik.slice(0, 200), icerik } });
    },
    onSuccess: () => { for (const k of [['akis', kod], ['adim', kod, a.no], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); },
  });
  const kriter = a.karar_kriteri || a.kriter;
  return (
    <form className="gd-karar" onSubmit={(e) => { e.preventDefault(); if (benim) ver.mutate(); }}>
      <p className="gd-karar-cumle">{benim ? 'Karar sende' : `Karar ${ozelEk(kisi(a.sahip), 'de')}`}{oneri ? `; ${oneri.kim} ${oneri.secim.length} ${tur} önerdi.` : sec.length ? `; ${sec.length} ${tur} var.` : '.'}</p>
      {kriter && <p className="gd-satir"><b>Kriter:</b> {kriter}</p>}
      {oneri && <p className="gd-oneri"><b>{ozelEk(oneri.kim, 'in')} önerisi:</b> {oneri.ozet || oneri.secim.join(', ')}{oneri.gerekce && <small>{oneri.gerekce}</small>}</p>}
      {sec.length ? (
        <fieldset className="gd-secenekler" disabled={!benim}>
          <legend className="gorunmez">{a.ad}</legend>
          {sec.map((s) => {
            const on = secim.includes(s.ad);
            return (
              <label key={s.ad} className={`gd-secenek${on ? ' secili' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => setSecim(on ? secim.filter((x) => x !== s.ad) : [...secim, s.ad])} />
                <span><b>{s.ad}</b>{s.alt && <small>{s.alt}</small>}</span>
                {s.etiket && <em className={s.uyari ? 'uyari' : ''}>{s.etiket}</em>}
              </label>
            );
          })}
        </fieldset>
      ) : (
        <label className="gd-karar-metin">
          <span className="gorunmez">Kararın</span>
          <textarea value={metin} onChange={(e) => setMetin(e.target.value)} placeholder={benim ? 'Kararını yaz' : 'Karar henüz verilmedi'} rows={3} disabled={!benim} />
        </label>
      )}
      {benim && (
        <Dugme type="submit" className="statik" mesgul={ver.isPending} disabled={!sec.length && !metin.trim()} ikonX={130 - 20 - 9} kayma={10}
          ikon={<svg aria-hidden width="18" height="20" viewBox="-9 -10 18 20"><rect x="-.8" y="-9" width="1.6" height="18" fill="var(--renk-metin-koyu-uzerine)" /><path d="M.8,-9 L9,-5.5 L.8,-2Z" fill="var(--renk-metin-koyu-uzerine)" /></svg>}>
          Kararı ver
        </Dugme>
      )}
      {ver.isError && <p className="canli-hata-satir" role="alert">{(ver.error as Error).message}</p>}
    </form>
  );
}

function KararVerildi({ a }: { a: any }) {
  const K = a.karar || {};
  const sonDurum = [...(a.olaylar || [])].reverse().find((e: any) => e.durum === 'tamam') || null;
  const kim = K.secim?.kim || sonDurum?.kim || a.sahip;
  const an = Date.parse(K.secim?.at || a.durum_at);
  const n = K.secenekler?.length || 0, k = K.secim?.secim?.length ?? 0, tur = K.tur || 'seçenek';
  const son = a.ciktilar?.length ? a.ciktilar[a.ciktilar.length - 1] : null;
  const cumle = K.oneri && n ? `${K.oneri.kim} öneriyi hazırladı; ${kisi(kim)} ${k === n ? `${n} ${ozelEk(tur, 'in').replace('’', '')} tamamını` : `${n} ${ek(tur, 'den')} ${k}’sini`} kabul etti.`
    : n ? `${kisi(kim)} ${n} ${ek(tur, 'den')} ${k}’sini kabul etti.` : `${kisi(kim)} kararı verdi${son ? `: ${tamamlaKucuk(son.ozet || son.ad)}` : '.'}`;
  const pay = isPayi(a.olaylar).slice(0, 2);
  const kabul = new Set<string>(K.secim?.secim || []);
  return (
    <div className="gd-karar">
      <p className="gd-karar-cumle">{cumle}</p>
      {n > 0 && <ul className="gd-secenekler okuma">{K.secenekler.map((s: any) => <li key={s.ad} className={`gd-secenek${kabul.has(s.ad) ? ' secili' : ''}`}><span><b>{s.ad}</b>{s.alt && <small>{s.alt}</small>}</span><em>{kabul.has(s.ad) ? 'kabul' : 'kabul edilmedi'}</em></li>)}</ul>}
      <p className="gd-satir">Verildi · {gunAy(an)} {saat(an)} · {kisi(kim)}{pay.length > 1 ? ` · katkı: ${pay.map((p) => `${kisi(p.ad)} ${p.n}`).join(', ')}` : ''}</p>
      {(a.kararlar || []).length > 0 && <p className="gd-satir"><b>{ozelEk(a.kararlar[0].varlik, 'in')} geçerli kararları:</b> {a.kararlar.slice(0, 4).map((x: any) => kararKisa(x)).join(' · ')}</p>}
    </div>
  );
}
