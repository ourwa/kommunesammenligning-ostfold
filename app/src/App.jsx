import { useState } from 'react';
import Indikatorkort from './components/Indikatorkort.jsx';
import Sammenligningstabell from './components/Sammenligningstabell.jsx';
import { finnKommune, fylkesnavn, hentet, indikatorer, kilde, kommuner, lagSerier } from './kommunedata.js';
import { formaterDato } from './format.js';
import logo from './assets/logo.png';
import './App.css';

function Kommunevelger({ plass, bokstav, verdi, onChange }) {
  return (
    <label className="velger">
      <span className="velger-etikett">
        <span className={`fargeprikk farge-${plass}`} aria-hidden="true" />
        Kommune {bokstav}
      </span>
      <select value={verdi} onChange={(e) => onChange(e.target.value)}>
        {kommuner.map((k) => (
          <option key={k.kode} value={k.kode}>
            {k.navn}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const [kodeA, setKodeA] = useState(kommuner[0]?.kode ?? '');
  const [kodeB, setKodeB] = useState(kommuner[1]?.kode ?? kommuner[0]?.kode ?? '');

  if (!kommuner.length || !indikatorer.length) {
    return (
      <main className="side">
        <h1>Kommunesammenligning</h1>
        <p>Fant ingen kommunedata å vise.</p>
      </main>
    );
  }

  const kommuneA = finnKommune(kodeA);
  const kommuneB = finnKommune(kodeB);
  const rader = indikatorer.map((indikator) => ({
    indikator,
    serier: lagSerier(indikator, kommuneA, kommuneB),
  }));
  const kommuneSerier = rader[0].serier;
  const hentetDato = formaterDato(hentet);

  return (
    <main className="side">
      <header className="sidetopp">
        <img
          className="logo"
          src={logo}
          alt="Logo: to hus side om side, ett blått og ett oransje"
          width="512"
          height="324"
        />
        <div className="sidetopp-tekst">
          <h1>Kommunesammenligning for unge familier</h1>
          <p className="ingress">
            Sammenlign to kommuner i {fylkesnavn} på fire indikatorer som betyr noe for barnefamilier.
          </p>
          <p className="ki-merknad">Logoen og ikonene på denne siden er generert med KI (Gemini).</p>
        </div>
      </header>

      <section className="velgere" aria-label="Velg kommuner">
        <Kommunevelger plass="a" bokstav="A" verdi={kodeA} onChange={setKodeA} />
        <Kommunevelger plass="b" bokstav="B" verdi={kodeB} onChange={setKodeB} />
      </section>

      {kodeA === kodeB && (
        <p className="melding" role="status">
          Du har valgt samme kommune i begge menyene. Velg en annen kommune for å se forskjeller.
        </p>
      )}

      <section aria-labelledby="tabell-tittel">
        <h2 id="tabell-tittel">Sammenligning</h2>
        <Sammenligningstabell rader={rader} kommuneSerier={kommuneSerier} />
      </section>

      <section aria-labelledby="diagram-tittel">
        <h2 id="diagram-tittel">Indikatorene i diagram</h2>
        <div className="kortrutenett">
          {rader.map(({ indikator, serier }) => (
            <Indikatorkort key={indikator.id} indikator={indikator} serier={serier} />
          ))}
        </div>
      </section>

      <footer className="sidebunn">
        <p className="kilde">
          Kilde: {kilde}.{hentetDato && ` Data hentet ${hentetDato}.`}
        </p>
        <section className="ki-erklaering" aria-labelledby="ki-tittel">
          <h2 id="ki-tittel">Bruk av kunstig intelligens</h2>
          <p>
            Denne løsningen er laget med hjelp av generative KI-verktøy. Oversikten under viser hva som er generert
            og hva som ikke er det.
          </p>
          <ul>
            <li>Logo og de fire ikonene er generert med Gemini.</li>
            <li>Kildekoden til denne nettsiden er skrevet med Claude Code.</li>
            <li>
              Forklaringstekstene til indikatorene er utarbeidet med Claude Code og kontrollert mot SSBs egne
              tabellbeskrivelser.
            </li>
            <li>
              Tallene er ikke generert av KI. De er hentet direkte fra SSBs statistikkbank, tabellene 07459, 13502 og
              06726. Gjennomsnittlig kjøpesum er regnet ut fra SSBs tall, ikke publisert av SSB.
            </li>
          </ul>
        </section>
      </footer>
    </main>
  );
}
