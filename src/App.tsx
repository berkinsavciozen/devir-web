import { Gok, Gren } from './bilesen/Gok';
import { SvgTanimlar } from './bilesen/Svg';
import { Iskelet } from './ekranlar/Iskelet';
import { useYol } from './yonlendirme';

export function App() {
  const yol = useYol();
  let ekran = <Iskelet />;
  if (yol === '/_iskelet') ekran = <Iskelet />;
  return (
    <div className="uygulama">
      <SvgTanimlar />
      <Gok tohum={21} yildiz={330} />
      {ekran}
      <Gren />
    </div>
  );
}
