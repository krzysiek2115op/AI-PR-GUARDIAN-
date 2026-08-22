// FIXTURE — oczekiwane: CISZA
//
// Wygląda jak BLAD-005, ale nim nie jest. ?? reaguje wyłącznie na null
// i undefined, więc cena 0 groszy przechodzi nienaruszona.
// Strażnik, który to zgłosi, nie rozumie różnicy między || a ?? — i zostanie
// wyłączony po trzecim takim komentarzu.

type KursWejscie = {
  slug: string;
  price_grosze?: number | null;
};

const CENA_DOMYSLNA = 9900;

export function przygotujDoZapisu(wejscie: KursWejscie) {
  return {
    slug: wejscie.slug,
    price_grosze: wejscie.price_grosze ?? CENA_DOMYSLNA,
  };
}

export function czyPodanoCene(kurs: KursWejscie): boolean {
  return kurs.price_grosze !== undefined && kurs.price_grosze !== null;
}

export function czyDarmowy(kurs: KursWejscie): boolean {
  return kurs.price_grosze === 0;
}
