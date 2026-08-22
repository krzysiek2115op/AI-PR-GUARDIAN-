// FIXTURE — oczekiwane: BLAD-005, waga HIGH, pewność wysoka
//
// Cena jest w groszach, CHECK (price_grosze >= 0). Zero to wartość LEGALNA —
// kurs za 0 zł jest poprawnym stanem, nie pustym formularzem.
// Operator || traktuje 0 jak brak wartości i po cichu podmienia go na domyślną.

type KursWejscie = {
  slug: string;
  title: string;
  price_grosze: number;
};

const CENA_DOMYSLNA = 9900;

export function przygotujDoZapisu(wejscie: KursWejscie) {
  return {
    slug: wejscie.slug,
    title: wejscie.title,
    // BŁĄD: cena 0 zł zostanie zamieniona na 99 zł bez śladu i bez ostrzeżenia.
    price_grosze: wejscie.price_grosze || CENA_DOMYSLNA,
  };
}

export function czyMaCene(kurs: KursWejscie): boolean {
  // BŁĄD: kurs za 0 zł zwróci false — zniknie z list filtrowanych tym predykatem.
  return !!kurs.price_grosze;
}
