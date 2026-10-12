import { LAV_OMSETNING } from '../kommunedata.js';
import { formaterTall } from '../format.js';
import Forklaring from './Forklaring.jsx';
import Soylediagram from './Soylediagram.jsx';
import ikonBarn from '../assets/ikon-1-barn.png';
import ikonVekst from '../assets/ikon-2-vekst.png';
import ikonBarnehage from '../assets/ikon-3-barnehage.png';
import ikonBolig from '../assets/ikon-4-bolig.png';

const ssbLenke = (tabell) => `https://www.ssb.no/statbank/table/${tabell}`;

// Dekorative ikoner, knyttet til indikatorens id i datafilen.
const IKONER = {
  andelBarn0til5: ikonBarn,
  befolkningsvekst: ikonVekst,
  barnehagedekning: ikonBarnehage,
  kjopesumPerOmsetning: ikonBolig,
};

export default function Indikatorkort({ indikator, serier }) {
  const harUsikre = serier.some((s) => s.usikker);
  const ikon = IKONER[indikator.id];

  return (
    <article className="kort">
      <header className="kort-topp">
        <h3 className="kort-tittel">
          {ikon && <img className="ikon" src={ikon} alt="" aria-hidden="true" width="28" height="28" />}
          <span>
            {indikator.navn}
            {indikator.beregnet && <span className="merke">Beregnet – ikke publisert av SSB</span>}
          </span>
        </h3>
        <p className="enhet">Enhet: {indikator.enhet}</p>
        <Forklaring serier={serier} />
      </header>

      <Soylediagram indikator={indikator} serier={serier} />

      {harUsikre && (
        <p className="fotnote">≈ = usikkert tall, bygger på færre enn {LAV_OMSETNING} boligomsetninger.</p>
      )}

      <div className="metadata">
        <p>{indikator.beskrivelse}</p>
        {indikator.beregnet && (
          <div className="beregnet-boks">
            <p>
              <strong>Dette tallet er beregnet av oss.</strong> SSB publiserer ikke gjennomsnittlig kjøpesum på
              kommunenivå. Vi har delt samlet kjøpesum på antall omsetninger. Få omsetninger gir et usikkert snitt.
            </p>
            <ul>
              {serier.map((s) => (
                <li key={s.plass}>
                  <span className="bokstav">{s.bokstav}</span> {s.navn}:{' '}
                  {s.omsetninger === null
                    ? 'antall omsetninger mangler'
                    : `${formaterTall(s.omsetninger, 0)} omsetninger`}
                  {s.usikker && <span className="merke merke-usikker">Usikker</span>}
                  {s.omsetninger === 0 && ' – snitt kan ikke beregnes'}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="kildelinje">
          Gjelder: {indikator.aar ?? 'ukjent år'} · Kilde: SSB, tabell{' '}
          {indikator.tabell ? (
            <a href={ssbLenke(indikator.tabell)} target="_blank" rel="noreferrer">
              {indikator.tabell}
            </a>
          ) : (
            'ukjent'
          )}
        </p>
      </div>
    </article>
  );
}
