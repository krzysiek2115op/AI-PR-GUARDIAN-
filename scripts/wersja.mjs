#!/usr/bin/env node
// Kontrola spójności wersji. Wersja żyje w trzech plikach i rozjeżdża się
// po cichu — ten skrypt nie pozwala. Odpowiednik straznik-wersji.mjs
// z repozytorium sprawdzanego, dostosowany do układu pluginu.
//
// Użycie:  node scripts/wersja.mjs
// Kod:     0 = spójne, 1 = rozjazd

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const czytaj = (p) => readFileSync(resolve(KORZEN, p), "utf8");

const bledy = [];

// 1. Źródło prawdy: manifest pluginu.
const manifest = JSON.parse(czytaj(".claude-plugin/plugin.json"));
const wersja = manifest.version;
if (!/^\d+\.\d+\.\d+$/.test(wersja ?? "")) {
  console.error(`plugin.json: wersja "${wersja}" nie jest w formacie X.Y.Z`);
  process.exit(1);
}

// 2. CHANGELOG — separator MUSI być em dash U+2014.
//    ASCII "-" i en dash "–" wyglądają podobnie i przechodzą niezauważone.
const changelog = czytaj("CHANGELOG.md");
const naglowek = changelog.match(/^## \[(\d+\.\d+\.\d+)\] (.) (\d{4}-\d{2}-\d{2})$/m);

if (!naglowek) {
  bledy.push(
    "CHANGELOG.md: nie znalazłem nagłówka w formacie `## [X.Y.Z] — RRRR-MM-DD`.\n" +
    "  Separator to em dash U+2014. Nie ASCII `-`, nie en dash `–`.",
  );
} else {
  const [, wersjaChangelog, separator] = naglowek;
  if (separator !== "—") {
    const nazwy = { "-": "ASCII hyphen U+002D", "–": "en dash U+2013" };
    bledy.push(
      `CHANGELOG.md: separator w nagłówku to ${nazwy[separator] ?? `U+${separator.codePointAt(0).toString(16).toUpperCase()}`}, ` +
      "a musi być em dash U+2014.",
    );
  }
  if (wersjaChangelog !== wersja) {
    bledy.push(`Rozjazd: plugin.json ma ${wersja}, najwyższy nagłówek CHANGELOG ma ${wersjaChangelog}.`);
  }
}

// 3. README — wersja w komórce tabeli, dokładnie jak w repozytorium sprawdzanym.
const readme = czytaj("README.md");
if (!readme.includes(`**${wersja}**`)) {
  bledy.push(`README.md: brak \`**${wersja}**\` w tabeli. Wersja w README nie zgadza się z plugin.json.`);
}

if (bledy.length > 0) {
  console.error("KONTROLA WERSJI: rozjazd\n");
  for (const b of bledy) console.error(`  - ${b}`);
  console.error("");
  process.exit(1);
}

console.log(`Kontrola wersji: spójne (${wersja}) — plugin.json, CHANGELOG.md, README.md`);
