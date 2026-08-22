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
