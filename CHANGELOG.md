# CHANGELOG

Konwencja: SemVer przedprodukcyjny. `0.X.0` — większy krok, `0.X.Y` — poprawka
w ramach etapu. Separator w nagłówku to em dash (U+2014).

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
- `node --check` na obu skryptach i na teście — bez zastrzeżeń
- oba pliki konfiguracji parsują się jako poprawny JSON
- `bash -n templates/pre-push` — bez zastrzeżeń

### Znane ograniczenia

- Strażnik nie był jeszcze uruchomiony na prawdziwym Pull Requeście.
  Precyzja na fixture'ach niezmierzona — to zadanie na etap 7.
- `templates/straznik-ai.yml` nie był uruchomiony na self-hosted runnerze.
  Wymaga rejestracji runnera i sekretu `ANTHROPIC_API_KEY`.
- Blokada merge'a wymaga branch protection, niedostępnej na prywatnym
  repozytorium w planie Free organizacji. Do czasu upgrade'u na Team twardą
  blokadę daje wyłącznie hook `pre-push`; check na PR-ze jest sygnałem, nie bramą.
