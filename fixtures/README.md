# Fixture'y — testy samego strażnika

Sprawdzają trzy rzeczy naraz:

1. czy strażnik **wykrywa** prawdziwy nawrót znanej klasy błędu,
2. czy **milczy** na kodzie, który tylko wygląda podejrzanie,
3. czy **waga** jest proporcjonalna do skutku.

Punkt 2 jest najważniejszy. Strażnik, który krzyczy na poprawny kod, zostanie
wyłączony po tygodniu — i słusznie.

## Układ

```
prawdziwe/   kod, który MUSI zostać zgłoszony; nazwa pliku niesie oczekiwany BLAD-xxx
falszywe/    kod, na który strażnik MUSI milczeć
kontekst/    miejsca użycia kładzione w commicie BAZOWYM, poza diffem
```

## Uruchomienie

Każdy fixture jest samodzielnym plikiem z nagłówkiem opisującym oczekiwanie.
Aby zmierzyć strażnika, zbuduj z fixture'a diff i przepuść przez skilla:

```bash
git checkout -b fixture-test
cp fixtures/prawdziwe/blad-005-cena-zero.ts <sciezka/w/projekcie>
git add -A && git commit -m "test: fixture BLAD-005"
claude -p "/ai-pr-guardian:przeglad --baza <galaz-bazowa>"
```

Wynik czytelny w `.straznik-ai/findings.json`.

## Kryterium

| Zbiór | Oczekiwanie |
|---|---|
| `prawdziwe/` | znalezisko z właściwym `blad_id`, `utrzymane: true`, waga ≥ MEDIUM |
| `falszywe/` | zero znalezisk utrzymanych przez krytyka |

Jedno trafienie w `falszywe/` jest gorsze niż jedno przeoczenie w `prawdziwe/`.
Projekt ma 25 strażników skryptowych i 75 testów, które wyłapią to, co model
przeoczy. Nie mają nic, co wyłapie fałszywy alarm modelu.

## Kontekst — miejsce użycia

Repozytorium pomiarowe z jednym plikiem czyni z każdego fixture'a **martwy
kod**. Krytyk sprawdza ścieżkę wykonania (krok 2 jego procedury) i słusznie
obniża wtedy wagę — a my mierzymy artefakt rusztowania, nie właściwość kodu.

Fixture może więc wnieść miejsce użycia. Plik w `kontekst/` ma dwa nagłówki:

```
// SCIEZKA: app/kurs/[slug]/page.tsx        gdzie go położyć
// DLA: components/kurs/Kurtyna.tsx         któremu fixture'owi służy
```

Dwie rzeczy są tu istotne:

**Kontekst idzie do commitu bazowego, nie do diffu.** Strażnik dostaje do
przeglądu wyłącznie zmieniony plik — dokładnie jak w Pull Requeście dotykającym
komponentu w aplikacji, która już go używa. `zakres.mjs` nadal widzi jeden plik.

**Dopasowanie idzie po ścieżce docelowej, nie po nazwie fixture'a.** Para
fixture'ów celująca w ten sam plik — prawdziwy i fałszywy alarm — dostaje ten
sam kontekst automatycznie. Asymetria byłaby wadą pomiaru: fixture fałszywy bez
miejsca użycia ma łatwiej o ciszę, bo krytyk sam z siebie obniża wagę martwemu
kodowi. Test w `scripts/zmierz.test.mjs` tego pilnuje.

Kontekst przechodzi to samo czyszczenie komentarzy co fixture — nagłówki
i wyjaśnienia nie docierają do strażnika.

Fixture bez wpisu w `kontekst/` działa jak dotąd. Kontekst dokładamy tam, gdzie
brak miejsca użycia **wykazano** jako źródło zaburzenia pomiaru — nie każdemu
fixture'owi z góry, bo każdy dołożony plik to dodatkowa powierzchnia dla
fałszywego alarmu.

## Stabilność między przebiegami

```bash
node scripts/zmierz.mjs --powtorz 3
```

Każdy przebieg to świeże repozytorium i świeży proces. Fixture zalicza się
tylko wtedy, gdy zalicza się w **każdym** przebiegu — strażnik trafiający dwa
razy na trzy nie jest strażnikiem, na którym da się oprzeć bramkę.

Dwie rozbieżności są rozdzielone, bo znaczą co innego:

| Znacznik | Znaczenie |
|---|---|
| `⚠ NIESTABILNY` | raz zalicza, raz nie — awaria, licznik ją zlicza |
| `≈ rozrzut oceny` | komplet trafień, różna waga w dopuszczalnym paśmie — nieszkodliwe |

## Diagnoza niepowodzenia

Wynik rozróżnia cztery różne awarie, które kiedyś dawały ten sam komunikat:

| Komunikat | Co kalibrować |
|---|---|
| `PRZEOCZENIE STRAŻNIKA` | strażnik nie zgłosił klasy w ogóle |
| `ODRZUCONE PRZEZ KRYTYKA` | strażnik zgłosił, krytyk obalił — komunikat niesie uzasadnienie |
| `ZA NISKA WAGA` | krytyk utrzymał, ale zszedł poniżej MEDIUM |
| `POMYŁKA KLASY` | zgłoszono inny `BLAD-xxx` niż oczekiwany |

Bez tego rozróżnienia nie da się odpowiedzieć na pytanie „poprawiać strażnika
czy krytyka" bez grzebania w katalogu tymczasowym po przebiegu.
