import { Component, type ReactNode } from 'react';
import { git } from '../yonlendirme';

/**
 * Hata sınırı (3 Kas, NM8R): bir akışın beklenmeyen verisi bir ekranı çökertirse uygulamanın tamamı beyaz kalmasın;
 * kullanıcı dilinde tek cümle, yeniden deneme ve evrene dönüş. Adres değişince sıfırlanır (key ile değil: key bütün uygulamayı yeniden kurar, harita yeniden çizilir).
 */
export class HataSiniri extends Component<{ children: ReactNode; yol: string }, { hata: Error | null }> {
  state = { hata: null as Error | null };
  static getDerivedStateFromError(hata: Error) { return { hata }; }
  componentDidCatch(hata: Error) { console.error('Devir ekran hatası:', hata); }
  componentDidUpdate(onceki: { yol: string }) { if (this.state.hata && onceki.yol !== this.props.yol) this.setState({ hata: null }); }
  render() {
    if (!this.state.hata) return this.props.children;
    return (
      <main className="hata-siniri" role="alert" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--renk-zemin-gok-1)', color: 'var(--renk-metin-ink)', textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Bu ekran açılamadı</h1>
          <p style={{ fontSize: 15, opacity: 0.8, margin: '0 0 20px' }}>Bir akışın verisi beklenmedik biçimde geldi. Yeniden deneyebilir ya da evrene dönebilirsin.</p>
          <button type="button" className="dugme dugme-birincil" onClick={() => this.setState({ hata: null })} style={{ marginRight: 8 }}>Yeniden dene</button>
          <button type="button" className="dugme" onClick={() => { this.setState({ hata: null }); git('/', { yerine: true }); }}>Evrene dön</button>
        </div>
      </main>
    );
  }
}
