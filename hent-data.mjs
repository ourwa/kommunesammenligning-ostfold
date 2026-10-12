// Henter kommunedata for Østfold fra SSBs statistikkbank (PxWebApi v2)
// og lagrer resultatet som statisk JSON for React-appen.
//
// Kjøres manuelt fra prosjektroten:  node hent-data.mjs
// Krever Node 18+ (innebygd fetch).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://data.ssb.no/api/pxwebapi/v2';
const FYLKESNAVN = 'Østfold';
const VEKST_AAR = 5;
const UTFIL = join(dirname(fileURLToPath(import.meta.url)), 'app/src/data/kommunedata.json');

// Dimensjonsnavn og variabelkoder slik de står i tabellenes metadata.
// Skriptet sjekker at de fortsatt finnes før data hentes.
const TABELLER = {
  befolkning: {
    id: '07459',
    region: 'Region',
    alder: 'Alder',
    innhold: ['Personer1'],
    // Kodeliste som slår sammen kommunenes tidsserier på tvers av
    // kommune- og regionreformene (f.eks. Halden: 0101 → 3001 → 3101).
    sammenslaattKodeliste: 'agg_KommSummer',
  },
  barnehage: {
    id: '13502',
    region: 'KOKkommuneregion0000',
    innhold: ['KOSandel150000'], // Andel barn 1-5 år i barnehage (prosent)
  },
  bolig: {
    id: '06726',
    region: 'Region',
    innhold: ['Oms', 'Kjopesum'], // Antall omsetninger, samlet kjøpesum (1000 kr)
  },
};

// ---------- Hjelpefunksjoner ----------

async function hentJson(url) {
  const svar = await fetch(url);
  if (!svar.ok) {
    throw new Error(`SSB svarte ${svar.status} ${svar.statusText} for ${url}\n${await svar.text()}`);
  }
  return svar.json();
}

function hentMetadata(tabellId) {
  return hentJson(`${API}/tables/${tabellId}/metadata?lang=no`);
}

// Bygger en data-URL. `utvalg` er { dimensjon: [koder] }, `kodelister` er { dimensjon: kodeliste }.
function hentData(tabellId, utvalg, kodelister = {}) {
  const params = new URLSearchParams({ lang: 'no', outputFormat: 'json-stat2' });
  for (const [dim, koder] of Object.entries(utvalg)) params.set(`valueCodes[${dim}]`, koder.join(','));
  for (const [dim, liste] of Object.entries(kodelister)) params.set(`codelist[${dim}]`, liste);
  return hentJson(`${API}/tables/${tabellId}/data?${params}`);
}

// Gjør om et JSON-stat2-datasett til en liste med rader: { [dimensjon]: kode, verdi }.
function tilRader(ds) {
  const koder = ds.id.map((dim) => Object.keys(ds.dimension[dim].category.index));
  return ds.value.map((verdi, i) => {
    const rad = { verdi };
    let rest = i;
    for (let d = ds.id.length - 1; d >= 0; d--) {
      rad[ds.id[d]] = koder[d][rest % ds.size[d]];
      rest = Math.floor(rest / ds.size[d]);
    }
    return rad;
  });
}

function dimensjonskoder(meta, dim) {
  const dimensjon = meta.dimension[dim];
  if (!dimensjon) {
    throw new Error(`Tabell ${meta.extension?.px?.tableid}: fant ikke dimensjonen "${dim}". Finnes: ${meta.id.join(', ')}`);
  }
  return dimensjon.category;
}

function sjekkKoderFinnes(meta, dim, koder) {
  const { index } = dimensjonskoder(meta, dim);
  const mangler = koder.filter((k) => !(k in index));
  if (mangler.length) {
    throw new Error(`Tabell ${meta.extension?.px?.tableid}, dimensjon ${dim}: mangler kodene ${mangler.join(', ')}`);
  }
}

function sisteAar(meta) {
  const aar = Object.keys(dimensjonskoder(meta, 'Tid').index).sort();
  return aar.at(-1);
}

const avrund = (tall, desimaler) => (tall == null || !Number.isFinite(tall) ? null : Number(tall.toFixed(desimaler)));

// ---------- 1. Metadata ----------

console.log('Henter metadata …');
const [metaBef, metaBhg, metaBolig] = await Promise.all(
  [TABELLER.befolkning, TABELLER.barnehage, TABELLER.bolig].map((t) => hentMetadata(t.id)),
);

sjekkKoderFinnes(metaBef, 'ContentsCode', TABELLER.befolkning.innhold);
sjekkKoderFinnes(metaBhg, 'ContentsCode', TABELLER.barnehage.innhold);
sjekkKoderFinnes(metaBolig, 'ContentsCode', TABELLER.bolig.innhold);

const kodelister = metaBef.dimension[TABELLER.befolkning.region].extension?.codelists ?? [];
if (!kodelister.some((k) => k.id === TABELLER.befolkning.sammenslaattKodeliste)) {
  throw new Error(`Tabell 07459 tilbyr ikke kodelista ${TABELLER.befolkning.sammenslaattKodeliste}`);
}

// ---------- 2. Østfold-kommunene, utledet fra metadata ----------

const regioner = dimensjonskoder(metaBef, TABELLER.befolkning.region);
const fylkeskode = Object.keys(regioner.index).find(
  (k) => /^\d{2}$/.test(k) && regioner.label[k] === FYLKESNAVN,
);
if (!fylkeskode) throw new Error(`Fant ikke gjeldende fylke "${FYLKESNAVN}" i tabell 07459`);

// Gjeldende kommuner har firesifret kode med fylkesnummeret først og ingen "(-år)" i navnet.
// Koder som slutter på 99 er "Uoppgitt kommune".
const kommuner = Object.keys(regioner.index)
  .filter((k) => k.length === 4 && k.startsWith(fylkeskode) && !k.endsWith('99'))
  .filter((k) => !/\(\s*-?\d{4}(-\d{4})?\)$/.test(regioner.label[k]))
  .map((kode) => ({ kode, navn: regioner.label[kode] }));

if (!kommuner.length) throw new Error(`Fant ingen kommuner for fylke ${fylkeskode}`);
const kommunekoder = kommuner.map((k) => k.kode);
sjekkKoderFinnes(metaBhg, TABELLER.barnehage.region, kommunekoder);
sjekkKoderFinnes(metaBolig, TABELLER.bolig.region, kommunekoder);

console.log(`${FYLKESNAVN} (fylke ${fylkeskode}): ${kommuner.map((k) => `${k.kode} ${k.navn}`).join(', ')}`);

// ---------- 3. Velg år ----------

const aarBef = sisteAar(metaBef);
const aarBefStart = String(Number(aarBef) - VEKST_AAR);
sjekkKoderFinnes(metaBef, 'Tid', [aarBefStart]);
const aarBhg = sisteAar(metaBhg);
const aarBolig = sisteAar(metaBolig);

// Aldre 0-5 år, med kodene slik de står i metadata ("000" … "005").
const alder = dimensjonskoder(metaBef, TABELLER.befolkning.alder);
const alder0til5 = Object.keys(alder.index).filter((k) => /^\d+$/.test(k) && Number(k) <= 5);
if (alder0til5.length !== 6) throw new Error(`Forventet 6 aldersgrupper 0-5 år, fant ${alder0til5.join(', ')}`);

console.log(`År: befolkning ${aarBefStart}–${aarBef}, barnehage ${aarBhg}, bolig ${aarBolig}`);

// ---------- 4. Hent data ----------

console.log('Henter data …');
const kodeISammenslaattListe = (kode) => `K-${kode}`;
const sammenslaatt = kommunekoder.map(kodeISammenslaattListe);
const befRegion = TABELLER.befolkning.region;

const [dsFolketall, dsBarn, dsBhg, dsBolig] = await Promise.all([
  // Folketall totalt (Kjonn og Alder elimineres = summeres av SSB)
  hentData(
    '07459',
    { [befRegion]: sammenslaatt, ContentsCode: TABELLER.befolkning.innhold, Tid: [aarBefStart, aarBef] },
    { [befRegion]: TABELLER.befolkning.sammenslaattKodeliste },
  ),
  // Barn 0-5 år, per alder (Kjonn elimineres)
  hentData(
    '07459',
    { [befRegion]: sammenslaatt, [TABELLER.befolkning.alder]: alder0til5, ContentsCode: TABELLER.befolkning.innhold, Tid: [aarBef] },
    { [befRegion]: TABELLER.befolkning.sammenslaattKodeliste },
  ),
  hentData('13502', {
    [TABELLER.barnehage.region]: kommunekoder,
    ContentsCode: TABELLER.barnehage.innhold,
    Tid: [aarBhg],
  }),
  hentData('06726', {
    [TABELLER.bolig.region]: kommunekoder,
    ContentsCode: TABELLER.bolig.innhold,
    Tid: [aarBolig],
  }),
]);

const radFolketall = tilRader(dsFolketall);
const radBarn = tilRader(dsBarn);
const radBhg = tilRader(dsBhg);
const radBolig = tilRader(dsBolig);

const finn = (rader, filter) => rader.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v));
const sum = (rader) => (rader.some((r) => r.verdi == null) ? null : rader.reduce((s, r) => s + r.verdi, 0));

// ---------- 5. Regn ut indikatorer ----------

const resultat = kommuner.map(({ kode, navn }) => {
  const k = kodeISammenslaattListe(kode);
  const folketall = sum(finn(radFolketall, { [befRegion]: k, Tid: aarBef }));
  const folketallStart = sum(finn(radFolketall, { [befRegion]: k, Tid: aarBefStart }));
  const barn0til5 = sum(finn(radBarn, { [befRegion]: k }));
  const barnehagedekning = finn(radBhg, { [TABELLER.barnehage.region]: kode })[0]?.verdi ?? null;
  const omsetninger = finn(radBolig, { [TABELLER.bolig.region]: kode, ContentsCode: 'Oms' })[0]?.verdi ?? null;
  const kjopesum = finn(radBolig, { [TABELLER.bolig.region]: kode, ContentsCode: 'Kjopesum' })[0]?.verdi ?? null;

  return {
    kode,
    navn,
    indikatorer: {
      andelBarn0til5: avrund((barn0til5 / folketall) * 100, 1),
      befolkningsvekst: avrund(((folketall - folketallStart) / folketallStart) * 100, 1),
      barnehagedekning: avrund(barnehagedekning, 1),
      kjopesumPerOmsetning: omsetninger ? avrund(kjopesum / omsetninger, 0) : null,
    },
    grunnlag: { folketall, folketallStart, barn0til5, omsetninger, kjopesum },
  };
});

for (const k of resultat) {
  const mangler = Object.entries(k.indikatorer).filter(([, v]) => v == null).map(([n]) => n);
  if (mangler.length) console.warn(`Advarsel: ${k.navn} mangler ${mangler.join(', ')}`);
}

// ---------- 6. Lagre ----------

const ut = {
  hentet: new Date().toISOString(),
  kilde: 'Statistisk sentralbyrå (SSB), statistikkbanken',
  fylke: { kode: fylkeskode, navn: FYLKESNAVN },
  indikatorer: [
    {
      id: 'andelBarn0til5',
      navn: 'Andel barn 0-5 år',
      enhet: 'prosent',
      aar: aarBef,
      tabell: '07459',
      beskrivelse: `Antall innbyggere 0-5 år delt på totalt antall innbyggere per 1. januar ${aarBef}.`,
    },
    {
      id: 'befolkningsvekst',
      navn: `Befolkningsvekst siste ${VEKST_AAR} år`,
      enhet: 'prosent',
      aar: `${aarBefStart}–${aarBef}`,
      tabell: '07459',
      beskrivelse: `Endring i folketall fra 1. januar ${aarBefStart} til 1. januar ${aarBef}. Tidsseriene er slått sammen over kommunereformene (SSB-kodeliste ${TABELLER.befolkning.sammenslaattKodeliste}).`,
    },
    {
      id: 'barnehagedekning',
      navn: 'Andel barn 1-5 år i barnehage',
      enhet: 'prosent',
      aar: aarBhg,
      tabell: '13502',
      beskrivelse: 'Andel barn 1-5 år i barnehage i forhold til innbyggere 1-5 år, slik SSB publiserer det.',
    },
    {
      id: 'kjopesumPerOmsetning',
      navn: 'Gjennomsnittlig kjøpesum per boligomsetning',
      enhet: '1000 kr',
      aar: aarBolig,
      tabell: '06726',
      beregnet: true,
      beskrivelse:
        'Beregnet som samlet kjøpesum delt på antall omsetninger av boligeiendommer i fritt salg. ' +
        'SSB publiserer ikke gjennomsnittet på kommunenivå fordi sammensetningen av boligmassen varierer, ' +
        'så tallet bør ikke tolkes som prisnivået for en bestemt boligtype.',
    },
  ],
  kommuner: resultat,
};

await mkdir(dirname(UTFIL), { recursive: true });
await writeFile(UTFIL, JSON.stringify(ut, null, 2) + '\n', 'utf8');
console.log(`Lagret ${resultat.length} kommuner til ${UTFIL}`);
