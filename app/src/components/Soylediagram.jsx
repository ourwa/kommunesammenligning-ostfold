import { useLayoutEffect, useRef, useState } from 'react';
import { enhetInfo, formaterTall, formaterVerdi } from '../format.js';

const SOYLEHOYDE = 24; // tynne søyler
const MELLOMROM = 2; // flategap mellom de to søylene
const RADIUS = 4; // avrunding på dataenden
const NAVNEBREDDE = 132;
const TOPP = 6;
const AKSEHOYDE = 22;
const TEGNBREDDE = 7; // grovt anslag for bredden på ett tegn i verdietikettene

function useBredde(ref) {
  const [bredde, setBredde] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setBredde(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return bredde;
}

// Runde akseverdier som dekker [min, max] og alltid inkluderer 0.
function akseverdier(min, max, antall = 4) {
  const spenn = max - min || 1;
  const raa = spenn / antall;
  const potens = 10 ** Math.floor(Math.log10(raa));
  const steg = [1, 2, 2.5, 5, 10].map((m) => m * potens).find((s) => s >= raa);
  const start = Math.floor(min / steg) * steg;
  const slutt = Math.ceil(max / steg) * steg;
  const verdier = [];
  for (let t = start; t <= slutt + steg / 2; t += steg) verdier.push(Number(t.toFixed(10)));
  return verdier;
}

// Liggende søyle med avrundede hjørner kun på enden som peker bort fra grunnlinjen.
function soylesti(x0, x1, y, h) {
  const b = Math.abs(x1 - x0);
  if (b < 0.5) return '';
  const r = Math.min(RADIUS, b, h / 2);
  if (x1 >= x0) {
    return `M${x0},${y} H${x1 - r} A${r},${r} 0 0 1 ${x1},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x1 - r},${y + h} H${x0} Z`;
  }
  return `M${x0},${y} H${x1 + r} A${r},${r} 0 0 0 ${x1},${y + r} V${y + h - r} A${r},${r} 0 0 0 ${x1 + r},${y + h} H${x0} Z`;
}

const forkort = (tekst, maks) => (tekst.length > maks ? `${tekst.slice(0, maks - 1)}…` : tekst);

export default function Soylediagram({ indikator, serier }) {
  const beholder = useRef(null);
  const bredde = useBredde(beholder) || 480;
  const [aktiv, setAktiv] = useState(null);

  const enhet = enhetInfo(indikator.enhet);
  const etikett = (s) => {
    const tall = formaterTall(s.verdi, enhet.desimaler);
    const medEnhet = indikator.enhet === 'prosent' ? `${tall} %` : tall;
    return s.usikker ? `≈ ${medEnhet}` : medEnhet;
  };

  const tall = serier.filter((s) => s.verdi !== null).map((s) => s.verdi);
  const ticks = akseverdier(Math.min(0, ...tall), Math.max(0, ...tall, tall.length ? 0 : 1));
  const [dMin, dMax] = [ticks[0], ticks.at(-1)];

  // Plass til verdietikettene utenfor søyleendene.
  const lengsteEtikett = Math.max(0, ...serier.filter((s) => s.verdi !== null).map((s) => etikett(s).length));
  const etikettrom = lengsteEtikett * TEGNBREDDE + 10;
  const venstre = NAVNEBREDDE + (dMin < 0 ? etikettrom : 8);
  const hoyre = bredde - Math.max(etikettrom, 16);
  const x = (v) => venstre + ((v - dMin) / (dMax - dMin)) * Math.max(hoyre - venstre, 1);
  const x0 = x(0);

  const plotHoyde = serier.length * SOYLEHOYDE + (serier.length - 1) * MELLOMROM;
  const hoyde = TOPP + plotHoyde + 6 + AKSEHOYDE;
  const radY = (i) => TOPP + i * (SOYLEHOYDE + MELLOMROM);

  const aktivSerie = aktiv === null ? null : serier[aktiv];

  return (
    <div className="diagram" ref={beholder}>
      <svg
        width={bredde}
        height={hoyde}
        role="img"
        aria-label={`${indikator.navn}: ${serier
          .map((s) => `${s.navn} ${formaterVerdi(s.verdi, indikator.enhet) ?? s.mangler.toLowerCase()}`)
          .join(', ')}`}
      >
        {/* Rutenett og akse, dempet */}
        {ticks.map((t) => (
          <g key={t}>
            <line className="rutenett" x1={x(t)} x2={x(t)} y1={TOPP - 4} y2={TOPP + plotHoyde + 4} />
            <text className="aksetekst" x={x(t)} y={TOPP + plotHoyde + 6 + 14} textAnchor="middle">
              {formaterTall(t, Number.isInteger(t) ? 0 : 1)}
            </text>
          </g>
        ))}
        <line className="grunnlinje" x1={x0} x2={x0} y1={TOPP - 4} y2={TOPP + plotHoyde + 4} />

        {serier.map((s, i) => {
          const y = radY(i);
          const harVerdi = s.verdi !== null;
          const xEnde = harVerdi ? x(s.verdi) : x0;
          const negativ = harVerdi && s.verdi < 0;
          return (
            <g key={s.plass}>
              <text className="navnetekst" x={0} y={y + SOYLEHOYDE / 2} dominantBaseline="central">
                <tspan className="bokstav">{s.bokstav}</tspan>
                <tspan dx={6}>{forkort(s.navn, 16)}</tspan>
              </text>
              {harVerdi ? (
                <>
                  <path
                    className={`soyle soyle-${s.plass}${s.usikker ? ' usikker' : ''}${aktiv === i ? ' aktiv' : ''}`}
                    d={soylesti(x0, xEnde, y, SOYLEHOYDE)}
                  />
                  <text
                    className="verditekst"
                    x={negativ ? xEnde - 6 : xEnde + 6}
                    y={y + SOYLEHOYDE / 2}
                    dominantBaseline="central"
                    textAnchor={negativ ? 'end' : 'start'}
                  >
                    {etikett(s)}
                  </text>
                </>
              ) : (
                <text className="manglertekst" x={x0 + 6} y={y + SOYLEHOYDE / 2} dominantBaseline="central">
                  {s.mangler}
                </text>
              )}
              {/* Treffflate større enn søylen, for mus og tastatur */}
              <rect
                className="treffflate"
                x={NAVNEBREDDE - 8}
                y={y - MELLOMROM / 2}
                width={Math.max(bredde - NAVNEBREDDE + 8, 0)}
                height={SOYLEHOYDE + MELLOMROM}
                tabIndex={0}
                aria-label={`${s.navn}: ${formaterVerdi(s.verdi, indikator.enhet) ?? s.mangler}`}
                onMouseEnter={() => setAktiv(i)}
                onMouseLeave={() => setAktiv(null)}
                onFocus={() => setAktiv(i)}
                onBlur={() => setAktiv(null)}
              />
            </g>
          );
        })}
      </svg>

      {aktivSerie && (
        <div
          className="tooltip"
          role="status"
          style={{
            left: Math.min(Math.max(aktivSerie.verdi !== null ? x(aktivSerie.verdi) : x0, NAVNEBREDDE), bredde - 200),
            top: radY(aktiv) + SOYLEHOYDE + 6,
          }}
        >
          <div className="tooltip-navn">
            <span className={`fargeprikk farge-${aktivSerie.plass}`} aria-hidden="true" />
            {aktivSerie.bokstav}: {aktivSerie.navn}
          </div>
          <div className="tooltip-verdi">
            {aktivSerie.verdi !== null
              ? `${formaterTall(aktivSerie.verdi, enhet.desimaler)} ${enhet.lang}`
              : aktivSerie.mangler}
          </div>
          {indikator.beregnet && aktivSerie.omsetninger !== null && (
            <div className="tooltip-ekstra">
              {formaterTall(aktivSerie.omsetninger, 0)} omsetninger
              {aktivSerie.usikker ? ' – usikkert tall' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
