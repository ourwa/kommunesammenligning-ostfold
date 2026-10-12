import { formaterDifferanse, formaterTall, formaterVerdi } from '../format.js';

function Verdicelle({ serie, indikator }) {
  const tekst = formaterVerdi(serie.verdi, indikator.enhet);
  return (
    <td className="tall">
      {tekst ?? <span className="mangler">{serie.mangler}</span>}
      {serie.usikker && <span className="merke merke-usikker">Usikker</span>}
      {indikator.beregnet && serie.omsetninger !== null && (
        <span className="undertekst">{formaterTall(serie.omsetninger, 0)} omsetninger</span>
      )}
    </td>
  );
}

export default function Sammenligningstabell({ rader, kommuneSerier }) {
  const [a, b] = kommuneSerier;
  return (
    <div className="tabellramme">
      <table className="sammenligning">
        <caption>
          Differanse er B minus A. For prosenttall er differansen oppgitt i prosentpoeng.
        </caption>
        <thead>
          <tr>
            <th scope="col">Indikator</th>
            {[a, b].map((s) => (
              <th scope="col" className="tall" key={s.plass}>
                <span className={`fargeprikk farge-${s.plass}`} aria-hidden="true" />
                <span className="bokstav">{s.bokstav}</span> {s.navn}
              </th>
            ))}
            <th scope="col" className="tall">Differanse (B − A)</th>
          </tr>
        </thead>
        <tbody>
          {rader.map(({ indikator, serier }) => {
            const diff = formaterDifferanse(serier[0].verdi, serier[1].verdi, indikator.enhet);
            return (
              <tr key={indikator.id}>
                <th scope="row">
                  {indikator.navn}
                  {indikator.beregnet && <span className="merke">Beregnet</span>}
                  <span className="undertekst">
                    {indikator.aar} · SSB {indikator.tabell}
                  </span>
                </th>
                <Verdicelle serie={serier[0]} indikator={indikator} />
                <Verdicelle serie={serier[1]} indikator={indikator} />
                <td className="tall">{diff ?? <span className="mangler">Kan ikke beregnes</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
