# CHANGELOG

Konwencja: SemVer przedprodukcyjny. `0.X.0` — większy krok, `0.X.Y` — poprawka
w ramach etapu. Separator w nagłówku to em dash (U+2014).

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
