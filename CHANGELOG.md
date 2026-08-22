# CHANGELOG

Konwencja: SemVer przedprodukcyjny. `0.X.0` — większy krok, `0.X.Y` — poprawka
w ramach etapu. Separator w nagłówku to em dash (U+2014).

## [0.4.1] — 2026-08-22

### Naprawione

- **Wynik `--powtorz` sam sobie przeczył.** Wiersz fixture'a dostawał znacznik
  `⚠ NIESTABILNY`, gdy różniło się samo uzasadnienie — także wtedy, gdy fixture
  zaliczał się w każdym przebiegu, a wędrowała tylko waga w dopuszczalnym
  paśmie. Obok stało `niestabilne między przebiegami: 0`. Rozdzielone na dwa
  pojęcia: `⚠ NIESTABILNY` (raz zalicza, raz nie — awaria) i `≈ rozrzut oceny`
  (komplet trafień, różna waga — nieszkodliwe). Licznik liczy wyłącznie
  pierwsze. Funkcja `stabilnosc()` wydzielona i przetestowana osobno.

### Dowody

- `node --test scripts/*.test.mjs` — 54/54 zielone

## [0.4.0] — 2026-08-22

Naprawa rusztowania pomiarowego. Pełny zestaw fixture'ów zaliczony.

### Naprawione

- **Repozytorium pomiarowe czyniło z każdego fixture'a martwy kod.** Zawierało
  jeden plik, więc nic nikąd nie prowadziło. Krytyk sprawdza ścieżkę wykonania
  (krok 2 jego procedury) i słusznie obniżał wtedy wagę — systematycznie
  karaliśmy fixture'y komponentowe za artefakt rusztowania, nie za właściwość
  kodu. Objaw: `BLAD-011` przeoczony w pomiarze z 0.3.0.
- **Jeden komunikat na cztery różne awarie.** `PRZEOCZENIE: brak znalezisk`
  padało zarówno wtedy, gdy strażnik nic nie zgłosił, jak i wtedy, gdy krytyk
  obalił poprawne znalezisko. Nie dało się na tej podstawie odpowiedzieć, czy
  kalibrować strażnika czy krytyka, bez grzebania w katalogu tymczasowym.

### Dodane

- `fixtures/kontekst/` — fixture może wnieść **miejsce użycia**. Plik kontekstu
  ma nagłówki `// SCIEZKA:` i `// DLA:`, trafia do commitu **bazowego**, więc
  nie ma go w diffie; `zakres.mjs` nadal widzi jeden zmieniony plik. Dopasowanie
  idzie po ścieżce docelowej, nie po nazwie fixture'a: para prawdziwy plus
  fałszywy alarm celująca w ten sam plik dostaje ten sam kontekst. Asymetria
  byłaby wadą pomiaru — fixture fałszywy bez miejsca użycia ma łatwiej o ciszę.
- `fixtures/kontekst/strona-kursu.tsx` — miejsce użycia dla obu fixture'ów
  celujących w `components/kurs/Kurtyna.tsx`.
- Rozróżnienie w ocenie: `PRZEOCZENIE STRAŻNIKA`, `ODRZUCONE PRZEZ KRYTYKA`
  (z uzasadnieniem krytyka w komunikacie), `ZA NISKA WAGA`, `POMYŁKA KLASY`.
- `node scripts/zmierz.mjs --powtorz N` — pomiar stabilności. Fixture zalicza
  się tylko wtedy, gdy zalicza się w **każdym** przebiegu; rozbieżne przebiegi
  dostają znacznik `⚠ NIESTABILNY`.
- 6 testów rusztowania, w tym pilnujący symetrii kontekstu w parze
  prawdziwy/fałszywy.

### Zmienione

- `przygotujRepo` zwraca `{ kat, kontekst }` zamiast samej ścieżki.
- `agents/straznik-regresji.md` i `agents/krytyk.md` **bez zmian**. Kalibracja
  agenta pod wadę narzędzia pomiarowego byłaby błędem metodycznym.

### Pomiar na pełnym zestawie

**8/8 zgodnych z oczekiwaniem. Zero fałszywych alarmów. Zero przeoczeń.**

| Fixture | Wynik |
|---|---|
| `blad-002-baza-testowa.test.ts` | wykryte jako HIGH |
| `blad-005-cena-zero.ts` | wykryte jako HIGH |
| `blad-007-build-z-katalogu.mjs` | wykryte jako HIGH |
| `blad-011-niewidzialny-lcp.tsx` | **wykryte jako HIGH** (było: przeoczone) |
| `cena-zero-obsluzona.ts` | cisza |
| `csp-unsafe-inline-swiadomy.ts` | cisza |
| `czas-lekcji-zero-nielegalny.ts` | cisza |
| `warstwa-wyciete-renderem.tsx` | cisza |

Kluczowy wiersz to ostatni. `warstwa-wyciete-renderem.tsx` celuje w ten sam
plik co `blad-011`, więc dostał ten sam kontekst — i nadal milczy. Naprawa
podniosła wykrywalność, nie próg krzykliwości.

### Dowody

- `node --test scripts/*.test.mjs` — 50/50 zielone
- `node scripts/zmierz.mjs` — 8/8, kod wyjścia 0
- Diff fixture'a `blad-011` po naprawie: nadal 1 plik, 16 linii

## [0.3.0] — 2026-08-22

Pierwsze uruchomienie strażnika na kodzie. Harness pomiarowy dopięty.

### Dodane

- `docs/STAN.md` — punkt wznowienia po przerwie: repozytoria, decyzje
  właściciela, stan etapów, konwencje, czego nie udowodniono
- `docs/wdrozenie.md` — wdrożenie krok po kroku po stronie właściciela

### Naprawione

- **`zmierz.mjs` nie dostawał zgody na zapis.** W trybie `-p` nie ma komu
  potwierdzić zapisu `findings.json`, a pytanie nie ma się gdzie pojawić —
  przegląd wykonywał się poprawnie i ginął. Dodane `--permission-mode
  acceptEdits`. Ten sam błąd wystąpiłby na maszynie właściciela.
- **Obejście dla środowisk z piaskownicą.** Gdy zagnieżdżony proces jest
  odcięty od zapisu poza własnym katalogiem roboczym, wynik trafia do
  scratchpada zamiast do `.straznik-ai/`. Harness szuka w obu miejscach.

### Dowody

- **Pierwszy realny przebieg strażnika**, fixture `blad-005-cena-zero.ts`:
  wykryte jako HIGH, `blad_id` poprawne, wynik zgodny ze schematem.
  Strażnik znalazł oba wystąpienia klasy — `||` w `przygotujDoZapisu`
  i `!!` w `czyMaCene`.
- Krytyk zadziałał zgodnie z projektem: próbował obalić oba znaleziska,
  utrzymał je, ale drugie obniżył do MEDIUM z uzasadnieniem, że funkcja
  nie ma wywołań w repozytorium. Zauważył przy tym, że `price_grosze: number`
  jest nienullowalne, więc jedyną wartością fałszywą jest legalne zero
  i fallback nie może zadziałać poprawnie.
- `node --test scripts/*.test.mjs` — 44/44 zielone

### Pomiar na pełnym zestawie

**7/8 zgodnych z oczekiwaniem. Zero fałszywych alarmów. Jedno przeoczenie.**

| Fixture | Wynik |
|---|---|
| `blad-002-baza-testowa.test.ts` | wykryte jako HIGH |
| `blad-005-cena-zero.ts` | wykryte jako HIGH |
| `blad-007-build-z-katalogu.mjs` | wykryte jako HIGH |
| `blad-011-niewidzialny-lcp.tsx` | **przeoczone** |
| `cena-zero-obsluzona.ts` | cisza |
| `csp-unsafe-inline-swiadomy.ts` | cisza |
| `czas-lekcji-zero-nielegalny.ts` | cisza |
| `warstwa-wyciete-renderem.tsx` | cisza |

Wszystkie cztery fixture'y fałszywych alarmów przeszły w ciszy, łącznie
z zastawionymi celowo: `unsafe-inline` w `style-src`, `!duration_min`
przy `CHECK > 0` oraz `??` zamiast `||`.

### Znane ograniczenia

- **Przeoczenie BLAD-011 to wada harnessu, nie strażnika.** Powtórzony
  przebieg pokazał, że strażnik znajduje klasę poprawnie, a wagę obniża
  **krytyk** — uzasadniając, że komponent nie jest nigdzie importowany,
  więc wpływ na LCP jest nierealizowalny. Krytyk działa zgodnie z krokiem 2
  swojej procedury. Problem w tym, że repozytorium pomiarowe zawiera jeden
  plik, więc **wszystko w nim jest martwym kodem z definicji** — systematycznie
  karzemy znaleziska w komponentach za artefakt rusztowania.
  Naprawa: fixture ma móc wnieść miejsce użycia, kładzione w commicie
  bazowym, żeby diff pozostał minimalny.
- Wynik bywa niestabilny między przebiegami: w pomiarze zbiorczym strażnik
  nie zgłosił nic, w powtórzeniu zgłosił i krytyk obniżył do LOW.
  Do zbadania razem z powyższym.
- `templates/straznik-ai.yml` nadal nieuruchomiony na self-hosted runnerze.
- `podsumowanie.blokujace` bywa liczone przez orkiestratora niezgodnie
  z polityką — bez wpływu na bramkę, bo `brama.mjs` liczy blokujące sama.

## [0.2.0] — 2026-08-22

Narzędzia pomiaru i kontroli. Nadal zero wywołań modelu w testach.

### Dodane

- `scripts/zmierz.mjs` — pomiar strażnika na fixture'ach jedną komendą.
  Buduje dla każdego fixture'a tymczasowe repozytorium git z rejestrem
  znanych błędów, puszcza przegląd i zestawia wynik z oczekiwaniem.
  Tryb `--sucho` sprawdza rusztowanie bez wołania modelu.
- `fixtures/rejestr-testowy/znane-bledy.json` — 13 wpisów odtworzonych
  z audytu, żeby dało się mierzyć strażnika bez dostępu do repozytorium
  prywatnego. To rusztowanie testowe, nie kopia oryginału.
- Nagłówek `// SCIEZKA:` w każdym fixturze — jawna ścieżka docelowa
  zamiast zgadywania przez harness.
- `scripts/wersja.mjs` — kontrola spójności wersji między `plugin.json`,
  `CHANGELOG.md` i `README.md`, z wykryciem ASCII hyphen i en dash
  podstawionych pod em dash.
- `.github/workflows/ci.yml` — CI silnika. Repozytorium jest publiczne,
  więc minuty są nielimitowane. Bez sekretów i bez wołania modelu.
- `scripts/zmierz.test.mjs` (18 testów), `scripts/wersja.test.mjs` (6 testów).

### Zmienione

- `docs/STAN.md` i `docs/wdrozenie.md` — dokumentacja przeniesiona do
  repozytorium, żeby przetrwała wyczyszczenie kontekstu rozmowy
- `templates/straznik-ai.yml` obsługuje `anthropic_api_key`
  i `claude_code_oauth_token` naraz. Nieustawiony sekret jest pustym
  inputem i zostaje zignorowany, więc wybór wariantu nie wymaga
  edycji pliku.

### Dowody

- `node --test scripts/*.test.mjs` — 44/44 zielone
- `node scripts/wersja.mjs` — spójne
- `node scripts/zmierz.mjs --sucho` — 8 fixture'ów, wszystkie przechodzą
  filtr ścieżek kodu
- kontrola negatywna kroku CI o agentach: podstawiony agent z `Write`
  został wykryty
- fixture z CSP, JSX i szablonem literalnym przetrwał czyszczenie
  bez uszkodzenia treści

### Naprawione

- **Pomiar mierzyłby czytanie ze zrozumieniem, nie wykrywanie.** Pierwsza
  wersja harnessu zdejmowała z fixture'a tylko nagłówki `FIXTURE`
  i `SCIEZKA`, zostawiając komentarze wyjaśniające i znaczniki `// BŁĄD:`.
  Strażnik dostawałby odpowiedź podaną wprost. Teraz leci każdy komentarz —
  reguła celowo brutalna, bo przeciek jest gorszy niż utrata realizmu.

### Znane ograniczenia

- Strażnik nadal nie był uruchomiony na żadnym kodzie. `zmierz.mjs`
  przetestowany wyłącznie w trybie `--sucho`; pełny przebieg wymaga
  `claude` CLI z tokenem.
- `templates/straznik-ai.yml` nie był uruchomiony na self-hosted runnerze.

## [0.1.0] — 2026-08-22

Fundament strażnika AI: silnik, jeden strażnik, krytyk, bramka, fixture'y.

### Dodane

- Plugin Claude Code `ai-pr-guardian` z marketplace'em w tym samym repozytorium
- `agents/straznik-regresji.md` — celuje w 4 klasy błędów z rejestru bez
  strażnika skryptowego: BLAD-002, BLAD-005, BLAD-007, BLAD-011
- `agents/krytyk.md` — obowiązkowa ocena znalezisk, nastawienie na obalenie
- `skills/przeglad/SKILL.md` — orkiestrator w pięciu krokach
- `knowledge/metodyka-przegladu.md` — zasada nadrzędna, wymóg dowodu,
  zakaz dublowania kontroli skryptowych
- `knowledge/schemat-findings.json` — kontrakt wyniku, walidowalny
- `config/routing.json` — filtr ścieżek jako kopia 1:1 z `ci.yml:54`
- `config/severity.json` — polityka wag i próg pewności
- `scripts/zakres.mjs` — ustalenie zakresu, zero tokenów
- `scripts/brama.mjs` — bramka jakości, zero tokenów
- `scripts/brama.test.mjs` — 11 testów bramki
- `scripts/zakres.test.mjs` — 9 testów zakresu na tymczasowych repozytoriach git
- `templates/straznik-ai.yml` — workflow na self-hosted runnera
- `templates/pre-push` — twarda blokada pusha z komunikatem wskazującym strażnika
- `fixtures/` — 4 trafienia i 4 fałszywe alarmy

### Decyzje właściciela (0.2.0)

- **Uwierzytelnianie: `CLAUDE_CODE_OAUTH_TOKEN`, nie klucz API.** Zero ryzyka
  finansowego w etapach kalibracji. Próg przełączenia na klucz API: gdy
  strażnik po raz drugi zablokuje pracę w środku innego zadania.
- **Kolejność planu zmieniona.** Pomiar precyzji nie wymaga już self-hosted
  runnera, więc idzie przed nim: token → pomiar → kalibracja → runner → PR.

### Decyzje właściciela

- **Zmiana WYTYCZNE §N1 dla tego narzędzia.** Dotychczas: *„agenci to bramki,
  nie stała obsada"*. Strażnik AI działa automatycznie na PR-ach przechodzących
  filtr ścieżek kodu — ok. 2 PR-y dziennie wg pomiaru z audytu. PR-y treściowe
  i dokumentacyjne pozostają nietknięte. Krytyk pozostaje obowiązkowy, więc
  duch §N1 („agent nigdy sam") jest zachowany.
- **Wykonanie na self-hosted runnerze**, nie na GitHub Actions. Minuty planu
  Free wyczerpane 2026-08-18 (2072 z 2000, w tym automatic-ai 1753). Nie czekamy
  na 1 września.
- **Zakres v1: jeden strażnik.** Kolejni dochodzą po jednym, po pomiarze
  na fixture'ach.
- Modele: strażnicy `claude-sonnet-5`, krytyk `claude-opus-5`.

### Dowody

- `node --test scripts/brama.test.mjs` — 11/11 zielone
- `node --test scripts/zakres.test.mjs` — 9/9 zielone
- `claude plugin validate .` — przeszła bez ostrzeżeń
- `node --check` na obu skryptach i obu testach — bez zastrzeżeń
- oba pliki konfiguracji parsują się jako poprawny JSON
- `bash -n templates/pre-push` — bez zastrzeżeń

Każdy test zakresu ma odpowiednik negatywny: obok „plik kodu uruchamia
strażnika" stoi „sam Markdown treści nie uruchamia", obok „przekroczony limit
zatrzymuje analizę" stoi „pusty diff nie uruchamia". Reguła projektu
sprawdzanego: każdy nowy test sprawdzić testem negatywnym.

### Znane ograniczenia

- Strażnik nie był jeszcze uruchomiony na prawdziwym Pull Requeście.
  Precyzja na fixture'ach niezmierzona — to zadanie na etap 7.
- `templates/straznik-ai.yml` nie był uruchomiony na self-hosted runnerze.
  Wymaga rejestracji runnera i sekretu `ANTHROPIC_API_KEY`.
- Blokada merge'a wymaga branch protection, niedostępnej na prywatnym
  repozytorium w planie Free organizacji. Do czasu upgrade'u na Team twardą
  blokadę daje wyłącznie hook `pre-push`; check na PR-ze jest sygnałem, nie bramą.
