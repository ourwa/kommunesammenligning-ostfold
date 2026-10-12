// Tallformatering på norsk bokmål.

const ENHETER = {
  prosent: { kort: '%', lang: 'prosent', desimaler: 1, differanse: 'prosentpoeng' },
  '1000 kr': { kort: 'tusen kr', lang: 'tusen kroner', desimaler: 0, differanse: 'tusen kr' },
};

export function enhetInfo(enhet) {
  return ENHETER[enhet] ?? { kort: enhet ?? '', lang: enhet ?? '', desimaler: 1, differanse: enhet ?? '' };
}

export const erTall = (v) => typeof v === 'number' && Number.isFinite(v);

export function formaterTall(verdi, desimaler, medFortegn = false) {
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: desimaler,
    maximumFractionDigits: desimaler,
    signDisplay: medFortegn ? 'exceptZero' : 'auto',
  }).format(verdi);
}

// "5,0 %" eller "3 750 tusen kr". Returnerer null når verdien mangler.
export function formaterVerdi(verdi, enhet) {
  if (!erTall(verdi)) return null;
  const e = enhetInfo(enhet);
  return `${formaterTall(verdi, e.desimaler)} ${e.kort}`;
}

// Differansen B minus A, med fortegn. Returnerer null hvis en av verdiene mangler.
export function formaterDifferanse(a, b, enhet) {
  if (!erTall(a) || !erTall(b)) return null;
  const e = enhetInfo(enhet);
  const diff = Number((b - a).toFixed(e.desimaler));
  return `${formaterTall(diff, e.desimaler, true)} ${e.differanse}`;
}

export function formaterDato(iso) {
  const dato = new Date(iso);
  if (Number.isNaN(dato.getTime())) return null;
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }).format(dato);
}
