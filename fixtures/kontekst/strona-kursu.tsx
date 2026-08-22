// KONTEKST — miejsce użycia, kładzione w commicie BAZOWYM
// SCIEZKA: app/kurs/[slug]/page.tsx
// DLA: components/kurs/Kurtyna.tsx
//
// Bez tego pliku komponent z fixture'a jest martwym kodem: nic go nie
// importuje i nic nie montuje. Krytyk słusznie obniża wtedy wagę
// znaleziska, a my mierzymy artefakt rusztowania zamiast właściwości kodu.
//
// Plik trafia do commitu bazowego, więc nie ma go w diffie — strażnik
// dostaje do przeglądu wyłącznie zmieniony komponent, dokładnie jak
// w Pull Requeście dotykającym komponentu w aplikacji, która już go używa.

import { Kurtyna } from "@/components/kurs/Kurtyna";

export default function StronaKursu({ params }: { params: { slug: string } }) {
  return (
    <main>
      <Kurtyna pokaz={false} />
      <article>
        <h1>Kurs {params.slug}</h1>
      </article>
    </main>
  );
}
