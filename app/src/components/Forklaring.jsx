// Fargeforklaring: knytter farge og bokstav til kommunenavn.
export default function Forklaring({ serier }) {
  return (
    <ul className="forklaring" aria-label="Fargeforklaring">
      {serier.map((s) => (
        <li key={s.plass}>
          <span className={`fargeprikk farge-${s.plass}`} aria-hidden="true" />
          <span className="bokstav">{s.bokstav}</span> {s.navn}
        </li>
      ))}
    </ul>
  );
}
