#!/usr/bin/env node
// Pomiar strażnika na fixture'ach. Buduje dla każdego fixture'a tymczasowe
// repozytorium git, puszcza przegląd i zestawia wynik z oczekiwaniem.
//
// Użycie:
//   node scripts/zmierz.mjs                 wszystkie fixture'y
//   node scripts/zmierz.mjs --tylko 005     tylko pasujące nazwą
//   node scripts/zmierz.mjs --sucho         plan bez wołania modelu
//   node scripts/zmierz.mjs --powtorz 3     każdy fixture trzy razy — pomiar stabilności
//
// Kod: 0 = wszystkie oczekiwania spełnione, 1 = choć jedno niespełnione
//
// WYMAGA: claude CLI + ANTHROPIC_API_KEY albo CLAUDE_CODE_OAUTH_TOKEN.
// Bez tego użyj --sucho, żeby sprawdzić samo rusztowanie.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const KORZEN = resolve(KATALOG, "..");

// ---------------------------------------------------------------------------
// Ocena — funkcja czysta, testowana osobno bez wołania modelu.
// ---------------------------------------------------------------------------
export function ocen(fixture, raport) {
  const wszystkie = raport?.znaleziska ?? [];
  const utrzymane = wszystkie.filter((z) => z.werdykt_krytyka?.utrzymane === true);

  if (fixture.rodzaj === "falszywy") {
    return utrzymane.length === 0
      ? { trafienie: true, powod: "cisza, zgodnie z oczekiwaniem" }
      : {
          trafienie: false,
          powod: `FAŁSZYWY ALARM: ${utrzymane.length} znalezisk na poprawnym kodzie ` +
                 `(${utrzymane.map((z) => `${z.waga} ${z.lokalizacja.plik}:${z.lokalizacja.linia}`).join("; ")})`,
        };
  }

  const trafione = utrzymane.filter((z) => z.blad_id === fixture.oczekiwanyBlad);

  // Trzy różne awarie dają dziś ten sam objaw „brak znalezisk utrzymanych".
  // Rozróżnienie jest tu po to, żeby dało się odpowiedzieć na pytanie
  // „kalibrować strażnika czy krytyka" bez grzebania w katalogu tymczasowym.
  if (trafione.length === 0) {
    const obalone = wszystkie.filter(
      (z) => z.blad_id === fixture.oczekiwanyBlad && z.werdykt_krytyka?.utrzymane === false,
    );
    if (obalone.length > 0) {
      return {
        trafienie: false,
        powod: `ODRZUCONE PRZEZ KRYTYKA: strażnik zgłosił ${fixture.oczekiwanyBlad}, krytyk je obalił — ` +
               `„${obalone[0].werdykt_krytyka.uzasadnienie}"`,
      };
    }
    if (utrzymane.length > 0) {
      return {
        trafienie: false,
        powod: `POMYŁKA KLASY: zgłoszono ${utrzymane.map((z) => z.blad_id ?? "bez blad_id").join(", ")}, ` +
               `oczekiwano ${fixture.oczekiwanyBlad}`,
      };
    }
    if (wszystkie.length > 0) {
      return {
        trafienie: false,
        powod: `PRZEOCZENIE STRAŻNIKA: oczekiwano ${fixture.oczekiwanyBlad}, padły wyłącznie inne klasy ` +
               `(${wszystkie.map((z) => z.blad_id ?? "bez blad_id").join(", ")}) i wszystkie odrzucił krytyk`,
      };
    }
    return {
      trafienie: false,
      powod: `PRZEOCZENIE STRAŻNIKA: zero znalezisk, oczekiwano ${fixture.oczekiwanyBlad}`,
    };
  }

  const WAZNE = ["CRITICAL", "HIGH", "MEDIUM"];
  const waga = (z) => z.werdykt_krytyka.korekta_wagi ?? z.waga;
  const dosc = trafione.some((z) => WAZNE.includes(waga(z)));
  if (dosc) return { trafienie: true, powod: `wykryte jako ${waga(trafione[0])}` };

  const zanizone = trafione.find((z) => z.werdykt_krytyka.korekta_wagi);
  return {
    trafienie: false,
    powod: `ZA NISKA WAGA: ${fixture.oczekiwanyBlad} zgłoszone i utrzymane, ale ocenione na ${waga(trafione[0])}` +
           (zanizone ? ` — krytyk zszedł z ${zanizone.waga}: „${zanizone.werdykt_krytyka.uzasadnienie}"` : ""),
  };
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
// Kontekst — miejsca użycia kładzione w commicie BAZOWYM.
//
// Repozytorium pomiarowe z jednym plikiem czyni z każdego fixture'a martwy kod.
// Krytyk sprawdza ścieżkę wykonania (krok 2 jego procedury) i słusznie obniża
// wtedy wagę — więc mierzylibyśmy artefakt rusztowania, nie właściwość kodu.
//
// Plik kontekstu ma dwa nagłówki:
//   // SCIEZKA: <gdzie go położyć>
//   // DLA:     <ścieżka docelowa fixture'a, któremu służy>
//
// Dopasowanie idzie po ŚCIEŻCE DOCELOWEJ, nie po nazwie fixture'a: para
// fixture'ów celująca w ten sam plik (prawdziwy i fałszywy alarm) dostaje
// ten sam kontekst automatycznie. Asymetria byłaby tu wadą pomiaru —
// fixture fałszywy bez miejsca użycia miałby łatwiej o ciszę.
//
// Kontekst siedzi w commicie bazowym, więc nie ma go w diffie. Diff pozostaje
// minimalny: jeden zmieniony plik, dokładnie jak w Pull Requeście dotykającym
// komponentu w aplikacji, która już go używa.
// ---------------------------------------------------------------------------
export function zbierzKontekst(korzen = KORZEN) {
  const sciezka = join(korzen, "fixtures", "kontekst");
  if (!existsSync(sciezka)) return [];
  const wynik = [];
  for (const nazwa of readdirSync(sciezka).sort()) {
    if (nazwa === "README.md") continue;
    const pelna = join(sciezka, nazwa);
    const tresc = readFileSync(pelna, "utf8");
    const gdzie = tresc.match(/^\/\/ SCIEZKA:\s*(.+)$/m);
    const dla = tresc.match(/^\/\/ DLA:\s*(.+)$/m);
    if (!gdzie) throw new Error(`kontekst/${nazwa}: brak nagłówka "// SCIEZKA:" — harness nie wie, gdzie go położyć`);
    if (!dla) throw new Error(`kontekst/${nazwa}: brak nagłówka "// DLA:" — harness nie wie, któremu fixture'owi służy`);
    wynik.push({ nazwa, plik: pelna, celowaSciezka: gdzie[1].trim(), dla: dla[1].trim() });
  }
  return wynik;
}

export function kontekstDla(fixture, kontekst) {
  return kontekst.filter((k) => k.dla === fixture.celowaSciezka);
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
function polozOczyszczony(kat, sciezkaWRepo, plikZrodlowy) {
  const cel = join(kat, sciezkaWRepo);
  mkdirSync(dirname(cel), { recursive: true });
  writeFileSync(cel, oczysc(readFileSync(plikZrodlowy, "utf8")));
}

function przygotujRepo(fixture, kontekst = zbierzKontekst()) {
  const kat = mkdtempSync(join(tmpdir(), "zmierz-"));
  const git = (...a) => execFileSync("git", a, { cwd: kat, encoding: "utf8" });

  git("init", "-q", "-b", "baza");
  git("config", "user.email", "pomiar@example.invalid");
  git("config", "user.name", "pomiar");

  // Rejestr znanych błędów — strażnik czyta go jako źródło prawdy.
  mkdirSync(join(kat, "rejestr"), { recursive: true });
  cpSync(join(KORZEN, "fixtures/rejestr-testowy/znane-bledy.json"), join(kat, "rejestr/znane-bledy.json"));
  writeFileSync(join(kat, "README.md"), "# Repozytorium pomiarowe\n");

  // Miejsca użycia idą do bazy, nie do diffu — inaczej strażnik dostałby
  // do przeglądu plik, o który nikt go nie prosił.
  const wniesiony = kontekstDla(fixture, kontekst);
  for (const k of wniesiony) polozOczyszczony(kat, k.celowaSciezka, k.plik);

  git("add", "-A");
  git("commit", "-q", "-m", "baza");

  git("checkout", "-q", "-b", "praca");
  polozOczyszczony(kat, fixture.celowaSciezka, fixture.plik);
  git("add", "-A");
  git("commit", "-q", "-m", `zmiana: ${fixture.celowaSciezka}`);

  return { kat, kontekst: wniesiony };
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

// Jeden przebieg jednego fixture'a: świeże repozytorium, świeży proces.
// Przebiegi są niezależne — stąd bierze się rozrzut, który mierzy --powtorz.
function przebieg(f, kontekst) {
  const { kat } = przygotujRepo(f, kontekst);
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
    return { trafienie: false, powod: `claude zakończył się błędem: ${e.message.split("\n")[0]}` };
  }

  const raport = wczytajWynik(kat);
  if (!raport) return { trafienie: false, powod: "strażnik nie zapisał findings.json" };
  return ocen(f, raport);
}

function main() {
  const tylko = process.argv.indexOf("--tylko");
  const filtr = tylko !== -1 ? process.argv[tylko + 1] : null;
  const sucho = process.argv.includes("--sucho");
  const iPowtorz = process.argv.indexOf("--powtorz");
  const powtorz = iPowtorz !== -1 ? Math.max(1, Number(process.argv[iPowtorz + 1]) || 1) : 1;

  let fixtury = zbierzFixtury();
  if (filtr) fixtury = fixtury.filter((f) => f.nazwa.includes(filtr));
  if (fixtury.length === 0) {
    console.error("Brak fixture'ów do zmierzenia.");
    process.exit(2);
  }
  const kontekst = zbierzKontekst();

  if (sucho) {
    for (const f of fixtury) {
      const { kat, kontekst: wniesiony } = przygotujRepo(f, kontekst);
      console.log(`${f.rodzaj === "prawdziwy" ? "+" : "-"} ${f.nazwa}`);
      console.log(`    ${f.celowaSciezka}  →  ${kat}`);
      console.log(`    oczekiwanie: ${f.rodzaj === "prawdziwy" ? f.oczekiwanyBlad : "cisza"}`);
      console.log(
        `    kontekst w bazie: ${wniesiony.length === 0 ? "brak" : wniesiony.map((k) => k.celowaSciezka).join(", ")}`,
      );
    }
    console.log(`\nPlan: ${fixtury.length} fixture'ów × ${powtorz}. Uruchom bez --sucho, żeby zmierzyć.`);
    return;
  }

  const wyniki = [];
  for (const f of fixtury) {
    process.stdout.write(`${f.nazwa} … `);
    const oceny = [];
    for (let i = 0; i < powtorz; i++) {
      const ocena = przebieg(f, kontekst);
      oceny.push(ocena);
      process.stdout.write(ocena.trafienie ? "OK " : "NIE ");
    }
    console.log("");
    wyniki.push({ f, oceny });
  }

  console.log("\n═══ WYNIK POMIARU ═══\n");
  for (const { f, oceny } of wyniki) {
    // Fixture zalicza się tylko wtedy, gdy zalicza się w KAŻDYM przebiegu.
    // Strażnik trafiający dwa razy na trzy nie jest strażnikiem, na którym
    // da się oprzeć bramkę.
    const wszystkieOk = oceny.every((o) => o.trafienie);
    const rozrzut = new Set(oceny.map((o) => o.powod)).size > 1;
    console.log(`${wszystkieOk ? "✓" : "✗"} ${f.nazwa}${rozrzut ? "   ⚠ NIESTABILNY" : ""}`);
    for (const [i, o] of oceny.entries()) {
      console.log(powtorz === 1 ? `   ${o.powod}` : `   [${i + 1}] ${o.powod}`);
    }
  }

  const zaliczone = wyniki.filter((w) => w.oceny.every((o) => o.trafienie));
  const falszyweAlarmy = wyniki.filter(
    (w) => w.f.rodzaj === "falszywy" && !w.oceny.every((o) => o.trafienie),
  ).length;
  const przeoczenia = wyniki.filter(
    (w) => w.f.rodzaj === "prawdziwy" && !w.oceny.every((o) => o.trafienie),
  ).length;
  const niestabilne = wyniki.filter((w) => new Set(w.oceny.map((o) => o.trafienie)).size > 1).length;

  console.log(`\n${zaliczone.length}/${wyniki.length} zgodnych z oczekiwaniem` + (powtorz > 1 ? ` (× ${powtorz} przebiegi)` : ""));
  console.log(`przeoczenia: ${przeoczenia}   fałszywe alarmy: ${falszyweAlarmy}`);
  if (powtorz > 1) console.log(`niestabilne między przebiegami: ${niestabilne}`);
  if (falszyweAlarmy > 0) {
    console.log("\nFałszywy alarm waży więcej niż przeoczenie. Popraw agenta, zanim dołożysz kolejnego.");
  }
  process.exit(zaliczone.length === wyniki.length ? 0 : 1);
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) main();
