#!/usr/bin/env node
// Ustala zakres przeglądu: które pliki, ilu strażników, czy w ogóle ruszać.
// Zero zależności. Zero tokenów. Uruchamiany przed jakimkolwiek wywołaniem modelu.
//
// Użycie:  node scripts/zakres.mjs --baza <ref> [--head <ref>] [--config <plik>]
// Wyjście: JSON na stdout + .straznik-ai/zakres.json
// Kod:     0 zawsze (skrypt informacyjny, nie bramka)

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));

function argument(nazwa, domyslna = null) {
  const i = process.argv.indexOf(`--${nazwa}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : domyslna;
}

const baza = argument("baza");
const head = argument("head", "HEAD");
const plikConfig = argument("config", resolve(KATALOG, "../config/routing.json"));

if (!baza) {
  console.error("zakres: brakuje --baza <ref>");
  console.error("Baza to gałąź bazowa Pull Requesta. Nigdy main — main jest celowo nieaktualny.");
  process.exit(2);
}

const config = JSON.parse(readFileSync(plikConfig, "utf8"));
const filtrKodu = new RegExp(config.filtr_kodu);
const nigdy = config.nigdy.map((w) => new RegExp(w));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// Trzykropek: zmiany na gałęzi PR-a względem punktu rozejścia, bez zmian z bazy.
const zakresDiffu = `${baza}...${head}`;

let numstat;
try {
  numstat = git("diff", "--numstat", zakresDiffu).trim();
} catch (e) {
  console.error(`zakres: git diff ${zakresDiffu} nie powiódł się.`);
  console.error("Sprawdź, czy gałąź bazowa jest pobrana (fetch-depth: 0).");
  process.exit(2);
}

const wiersze = numstat === "" ? [] : numstat.split("\n");
const wszystkie = [];
let liniiRazem = 0;

for (const wiersz of wiersze) {
  const [dodane, usuniete, plik] = wiersz.split("\t");
  if (!plik) continue;
  // "-" w numstat oznacza plik binarny.
  const d = dodane === "-" ? 0 : Number(dodane);
  const u = usuniete === "-" ? 0 : Number(usuniete);
  wszystkie.push({ plik, dodane: d, usuniete: u, binarny: dodane === "-" });
  liniiRazem += d + u;
}

const pominiete = wszystkie.filter((w) => nigdy.some((r) => r.test(w.plik)));
const rozwazane = wszystkie.filter((w) => !nigdy.some((r) => r.test(w.plik)));
const kodowe = rozwazane.filter((w) => filtrKodu.test(w.plik));

const liniiKodu = kodowe.reduce((s, w) => s + w.dodane + w.usuniete, 0);

let powodPominiecia = null;
if (kodowe.length === 0) {
  powodPominiecia =
    "Brak plików przechodzących filtr kodu. PR treściowy lub dokumentacyjny — model nie recenzuje.";
} else if (kodowe.length > config.limity.max_plikow) {
  powodPominiecia =
    `Diff obejmuje ${kodowe.length} plików kodu, limit to ${config.limity.max_plikow}. ` +
    "Podziel Pull Requesta — przegląd na tej objętości nie byłby rzetelny.";
} else if (liniiKodu > config.limity.max_linii_diffa) {
  powodPominiecia =
    `Diff obejmuje ${liniiKodu} linii kodu, limit to ${config.limity.max_linii_diffa}. ` +
    "Podziel Pull Requesta — przegląd na tej objętości nie byłby rzetelny.";
}

const straznicy = powodPominiecia
  ? []
  : config.straznicy.filter((s) => s.gdy !== "kod" || kodowe.length > 0).map((s) => s.nazwa);

const wynik = {
  baza,
  head,
  kod: kodowe.length > 0 && !powodPominiecia,
  plikow: kodowe.length,
  linii: liniiKodu,
  plikow_wszystkich: wszystkie.length,
  linii_wszystkich: liniiRazem,
  pliki: kodowe.map((w) => w.plik),
  pominiete_sciezki: pominiete.map((w) => w.plik),
  straznicy,
  pominieto: powodPominiecia,
};

mkdirSync(".straznik-ai", { recursive: true });
writeFileSync(".straznik-ai/zakres.json", JSON.stringify(wynik, null, 2) + "\n");
console.log(JSON.stringify(wynik, null, 2));
