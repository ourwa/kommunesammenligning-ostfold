// Lesing av den statiske datafilen. Alle oppslag tåler manglende felt.
import data from './data/kommunedata.json';
import { erTall } from './format.js';

// Under så mange boligomsetninger regnes gjennomsnittlig kjøpesum som usikker.
export const LAV_OMSETNING = 30;

export const kommuner = Array.isArray(data.kommuner) ? data.kommuner : [];
export const indikatorer = Array.isArray(data.indikatorer) ? data.indikatorer : [];
export const kilde = data.kilde ?? 'Statistisk sentralbyrå (SSB)';
export const hentet = data.hentet ?? null;
export const fylkesnavn = data.fylke?.navn ?? '';

export const finnKommune = (kode) => kommuner.find((k) => k.kode === kode) ?? null;

export function hentVerdi(kommune, indikator) {
  const verdi = kommune?.indikatorer?.[indikator.id];
  return erTall(verdi) ? verdi : null;
}

export function antallOmsetninger(kommune) {
  const n = kommune?.grunnlag?.omsetninger;
  return erTall(n) ? n : null;
}

export function erUsikker(kommune, indikator) {
  if (!indikator.beregnet) return false;
  const n = antallOmsetninger(kommune);
  return n !== null && n > 0 && n < LAV_OMSETNING;
}

// Tekst som forklarer hvorfor en verdi mangler.
export function manglerTekst(kommune, indikator) {
  if (indikator.beregnet && antallOmsetninger(kommune) === 0) return 'Ingen omsetninger';
  return 'Mangler data';
}

// De to seriene i fast rekkefølge: A først, så B. Fargen følger plassen, aldri verdien.
export function lagSerier(indikator, kommuneA, kommuneB) {
  return [
    { plass: 'a', bokstav: 'A', kommune: kommuneA },
    { plass: 'b', bokstav: 'B', kommune: kommuneB },
  ].map((s) => ({
    ...s,
    navn: s.kommune?.navn ?? 'Ukjent kommune',
    verdi: hentVerdi(s.kommune, indikator),
    usikker: erUsikker(s.kommune, indikator),
    omsetninger: antallOmsetninger(s.kommune),
    mangler: manglerTekst(s.kommune, indikator),
  }));
}
