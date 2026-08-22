#!/usr/bin/env node
// Pomiar strażnika na fixture'ach. Buduje dla każdego fixture'a tymczasowe
// repozytorium git, puszcza przegląd i zestawia wynik z oczekiwaniem.
//
// Użycie:
//   node scripts/zmierz.mjs                 wszystkie fixture'y
//   node scripts/zmierz.mjs --tylko 005     tylko pasujące nazwą
//   node scripts/zmierz.mjs --sucho         plan bez wołania modelu
//
// Kod: 0 = wszystkie oczekiwania spełnione, 1 = choć jedno niespełnione
//
// WYMAGA: claude CLI + ANTHROPIC_API_KEY albo CLAUDE_CODE_OAUTH_TOKEN.
// Bez tego użyj --sucho, żeby sprawdzić samo rusztowanie.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const KORZEN = resolve(KATALOG, "..");

// ---------------------------------------------------------------------------
// Ocena — funkcja czysta, testowana osobno bez wołania modelu.
// ---------------------------------------------------------------------------
export function ocen(fixture, raport) {
  const znaleziska = (raport?.znaleziska ?? []).filter(
    (z) => z.werdykt_krytyka?.utrzymane === true,
  );

  if (fixture.rodzaj === "falszywy") {
    return znaleziska.length === 0
      ? { trafienie: true, powod: "cisza, zgodnie z oczekiwaniem" }
      : {
          trafienie: false,
          powod: `FAŁSZYWY ALARM: ${znaleziska.length} znalezisk na poprawnym kodzie ` +
                 `(${znaleziska.map((z) => `${z.waga} ${z.lokalizacja.plik}:${z.lokalizacja.linia}`).join("; ")})`,
        };
  }

  const trafione = znaleziska.filter((z) => z.blad_id === fixture.oczekiwanyBlad);
  if (trafione.length === 0) {
    return znaleziska.length === 0
      ? { trafienie: false, powod: `PRZEOCZENIE: brak znalezisk, oczekiwano ${fixture.oczekiwanyBlad}` }
      : {
          trafienie: false,
          powod: `POMYŁKA KLASY: zgłoszono ${znaleziska.map((z) => z.blad_id ?? "bez blad_id").join(", ")}, ` +
                 `oczekiwano ${fixture.oczekiwanyBlad}`,
        };
  }

  const WAZNE = ["CRITICAL", "HIGH", "MEDIUM"];
  const dosc = trafione.some((z) => WAZNE.includes(z.werdykt_krytyka.korekta_wagi ?? z.waga));
  return dosc
    ? { trafienie: true, powod: `wykryte jako ${trafione[0].werdykt_krytyka.korekta_wagi ?? trafione[0].waga}` }
    : { trafienie: false, powod: `ZA NISKA WAGA: ${fixture.oczekiwanyBlad} zgłoszone, ale poniżej MEDIUM` };
}

export function zbierzFixtury(korzen = KORZEN) {
  const wynik = [];
  for (const [katalog, rodzaj] of [["prawdziwe", "prawdziwy"], ["falszywe", "falszywy"]]) {
    const sciezka = join(korzen, "fixtures", katalog);
    if (!existsSync(sciezka)) continue;
    for (const nazwa of readdirSync(sciezka).sort()) {
      if (nazwa === "README.md") continue;
      const pelna = join(sciezka, nazwa);
      const tresc = readFileSync(pelna, "utf8");
      const dopasowanie = tresc.match(/^\/\/ SCIEZKA:\s*(.+)$/m);
      if (!dopasowanie) throw new Error(`${nazwa}: brak nagłówka "// SCIEZKA:" — harness nie wie, gdzie go położyć`);
      const blad = nazwa.match(/^blad-(\d{3})/);
      wynik.push({
        nazwa,
        plik: pelna,
        rodzaj,
        celowaSciezka: dopasowanie[1].trim(),
        oczekiwanyBlad: blad ? `BLAD-${blad[1]}` : null,
      });
    }
  }
  return wynik;
}

// ---------------------------------------------------------------------------
// Czyszczenie fixture'a przed pomiarem.
//
// Fixture'y mają komentarze wyjaśniające dla człowieka — nagłówek FIXTURE,
// znaczniki "BŁĄD:", uzasadnienia przy fałszywych alarmach. Gdyby trafiły
// do repozytorium pomiarowego, strażnik dostałby odpowiedź podaną wprost
// i mierzylibyśmy czytanie ze zrozumieniem zamiast wykrywania.
//
// Reguła jest celowo brutalna: leci KAŻDY komentarz zajmujący całą linię
// oraz każdy komentarz kończący linię kodu. Węższa reguła zawsze coś
// przepuści, a przeciek jest tu gorszy niż utrata realizmu.
// ---------------------------------------------------------------------------
export function oczysc(tresc) {
  const bezKomentarzy = tresc
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    // Komentarz na końcu linii kodu — ostrożnie, żeby nie ciąć "https://"
    // ani ukośników w treści łańcucha znaków.
    .map((l) => {
      const bez = l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1");
      return bez.trimEnd();
    });
  // Trzy puste linie pod rząd po wycięciu komentarzy wyglądają jak artefakt.
  return bezKomentarzy.join("\n").replace(/\n{3,}/g, "\n\n").trimStart() + "\n";
}

// ---------------------------------------------------------------------------
// Przebieg
// ---------------------------------------------------------------------------
function przygotujRepo(fixture) {
  const kat = mkdtempSync(join(tmpdir(), "zmierz-"));
  const git = (...a) => execFileSync("git", a, { cwd: kat, encoding: "utf8" });

  git("init", "-q", "-b", "baza");
  git("config", "user.email", "pomiar@example.invalid");
  git("config", "user.name", "pomiar");

  // Rejestr znanych błędów — strażnik czyta go jako źródło prawdy.
  mkdirSync(join(kat, "rejestr"), { recursive: true });
  cpSync(join(KORZEN, "fixtures/rejestr-testowy/znane-bledy.json"), join(kat, "rejestr/znane-bledy.json"));
  writeFileSync(join(kat, "README.md"), "# Repozytorium pomiarowe\n");
  git("add", "-A");
  git("commit", "-q", "-m", "baza");

  git("checkout", "-q", "-b", "praca");
  const cel = join(kat, fixture.celowaSciezka);
  mkdirSync(dirname(cel), { recursive: true });
  writeFileSync(cel, oczysc(readFileSync(fixture.plik, "utf8")));
  git("add", "-A");
  git("commit", "-q", "-m", `zmiana: ${fixture.celowaSciezka}`);

  return kat;
}

// Wynik normalnie ląduje w .straznik-ai/findings.json repozytorium sprawdzanego.
// W środowiskach, gdzie zagnieżdżony proces jest odcięty od zapisu poza własnym
// katalogiem roboczym (np. zdalne kontenery z piaskownicą), trafia do scratchpada.
// Szukamy w obu miejscach, żeby pomiar dał się wykonać także tam.
function wczytajWynik(kat) {
  const wRepo = join(kat, ".straznik-ai/findings.json");
  if (existsSync(wRepo)) return JSON.parse(readFileSync(wRepo, "utf8"));

  const zmangowany = kat.replace(/\//g, "-");
  const bazaScratchpada = join("/tmp/claude-0", zmangowany);
  if (!existsSync(bazaScratchpada)) return null;
  for (const sesja of readdirSync(bazaScratchpada)) {
    const kandydat = join(bazaScratchpada, sesja, "scratchpad", "findings.json");
    if (existsSync(kandydat)) return JSON.parse(readFileSync(kandydat, "utf8"));
  }
  return null;
}

function main() {
  const tylko = process.argv.indexOf("--tylko");
  const filtr = tylko !== -1 ? process.argv[tylko + 1] : null;
  const sucho = process.argv.includes("--sucho");

  let fixtury = zbierzFixtury();
  if (filtr) fixtury = fixtury.filter((f) => f.nazwa.includes(filtr));
  if (fixtury.length === 0) {
    console.error("Brak fixture'ów do zmierzenia.");
    process.exit(2);
  }

  const wyniki = [];
  for (const f of fixtury) {
    const kat = przygotujRepo(f);
    if (sucho) {
      console.log(`${f.rodzaj === "prawdziwy" ? "+" : "-"} ${f.nazwa}`);
      console.log(`    ${f.celowaSciezka}  →  ${kat}`);
      console.log(`    oczekiwanie: ${f.rodzaj === "prawdziwy" ? f.oczekiwanyBlad : "cisza"}`);
      continue;
    }

    process.stdout.write(`${f.nazwa} … `);
    try {
      execFileSync(
        "claude",
        [
          "-p", "/ai-pr-guardian:przeglad --baza baza",
          "--plugin-dir", KORZEN,
          "--max-turns", "30",
          // Bez tego w trybie -p zapis findings.json jest odrzucany:
          // nie ma komu potwierdzić zgody, a pytanie nie ma gdzie się pojawić.
          "--permission-mode", "acceptEdits",
        ],
        { cwd: kat, stdio: "pipe", timeout: 15 * 60 * 1000 },
      );
    } catch (e) {
      console.log("BŁĄD WYWOŁANIA");
      wyniki.push({ f, ocena: { trafienie: false, powod: `claude zakończył się błędem: ${e.message.split("\n")[0]}` } });
      continue;
    }

    const raport = wczytajWynik(kat);
    if (!raport) {
      console.log("BRAK WYNIKU");
      wyniki.push({ f, ocena: { trafienie: false, powod: "strażnik nie zapisał findings.json" } });
      continue;
    }
    const ocena = ocen(f, raport);
    console.log(ocena.trafienie ? "OK" : "NIE");
    wyniki.push({ f, ocena });
  }

  if (sucho) {
    console.log(`\nPlan: ${fixtury.length} fixture'ów. Uruchom bez --sucho, żeby zmierzyć.`);
    return;
  }

  console.log("\n═══ WYNIK POMIARU ═══\n");
  for (const { f, ocena } of wyniki) {
    console.log(`${ocena.trafienie ? "✓" : "✗"} ${f.nazwa}`);
    console.log(`   ${ocena.powod}`);
  }

  const trafione = wyniki.filter((w) => w.ocena.trafienie).length;
  const falszyweAlarmy = wyniki.filter((w) => w.f.rodzaj === "falszywy" && !w.ocena.trafienie).length;
  const przeoczenia = wyniki.filter((w) => w.f.rodzaj === "prawdziwy" && !w.ocena.trafienie).length;

  console.log(`\n${trafione}/${wyniki.length} zgodnych z oczekiwaniem`);
  console.log(`przeoczenia: ${przeoczenia}   fałszywe alarmy: ${falszyweAlarmy}`);
  if (falszyweAlarmy > 0) {
    console.log("\nFałszywy alarm waży więcej niż przeoczenie. Popraw agenta, zanim dołożysz kolejnego.");
  }
  process.exit(trafione === wyniki.length ? 0 : 1);
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) main();
