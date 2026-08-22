// FIXTURE — oczekiwane: BLAD-011, waga MEDIUM, pewność wysoka
// SCIEZKA: components/kurs/Kurtyna.tsx
//
// Projekt broni CLS = 0 i 96-97 wydajności na mobile.
// Element z opacity: 0 jest nadal malowany i może zostać wybrany
// kandydatem na LCP — pomiar zjeżdża, a przyczyna jest niewidoczna.

export function Kurtyna({ pokaz }: { pokaz: boolean }) {
  return (
    <div
      // BŁĄD: opacity 0 nie wyjmuje elementu z malowania.
      // Duży blok pozostaje kandydatem LCP mimo że użytkownik go nie widzi.
      style={{
        opacity: pokaz ? 1 : 0,
        position: "absolute",
        inset: 0,
        transition: "opacity 300ms",
      }}
    >
      <img src="/okladki/kurs-claude.svg" alt="" width={1200} height={630} />
      <h2>Jak korzystać z Claude</h2>
    </div>
  );
}
