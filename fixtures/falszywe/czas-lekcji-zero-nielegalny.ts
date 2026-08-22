// FIXTURE — oczekiwane: CISZA
//
// Wzorzec !x na polu liczbowym, ale tutaj jest POPRAWNY.
// course_lessons.duration_min ma CHECK (duration_min > 0) — zero jest
// nielegalne na poziomie bazy. Odrzucenie zera to zgodność z kontraktem,
// nie regresja BLAD-005.
//
// Strażnik musi rozróżniać price_grosze (CHECK >= 0, zero legalne)
// od duration_min (CHECK > 0, zero nielegalne). Sam wzorzec nie wystarcza.

type LekcjaWejscie = {
  title: string;
  duration_min: number;
};

export function zwaliduj(lekcja: LekcjaWejscie): string | null {
  if (!lekcja.duration_min) {
    return "Czas trwania lekcji musi być większy od zera.";
  }
  if (lekcja.duration_min > 1440) {
    return "Czas trwania lekcji przekracza limit doby.";
  }
  return null;
}
