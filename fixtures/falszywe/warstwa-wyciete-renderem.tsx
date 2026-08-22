// FIXTURE — oczekiwane: CISZA
//
// Wygląda jak BLAD-011, ale element nie istnieje w drzewie, dopóki nie jest
// potrzebny. Nic nie jest malowane, więc nic nie kandyduje na LCP.
// Wariant z display: none jest równie poprawny.

export function Kurtyna({ pokaz }: { pokaz: boolean }) {
  if (!pokaz) return null;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <img src="/okladki/kurs-claude.svg" alt="Jak korzystać z Claude" width={1200} height={630} />
      <h2>Jak korzystać z Claude</h2>
    </div>
  );
}

export function Podpowiedz({ widoczna }: { widoczna: boolean }) {
  return (
    <span style={{ display: widoczna ? "inline" : "none" }}>
      Podpowiedź
    </span>
  );
}
