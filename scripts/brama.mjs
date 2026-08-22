#!/usr/bin/env node
// Bramka jakości: zamienia znaleziska na kod wyjścia wg config/severity.json.
// Zero zależności. Zero tokenów. Cała polityka siedzi w konfiguracji.
//
// Użycie:  node scripts/brama.mjs [--findings <plik>] [--config <plik>] [--cichy]
// Kod:     0 = przechodzi, 1 = blokuje, 2 = błąd użycia

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));

function argument(nazwa, domyslna = null) {
  const i = process.argv.indexOf(`--${nazwa}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : domyslna;
}
const cichy = process.argv.includes("--cichy");

const plikFindings = argument("findings", ".straznik-ai/findings.json");
const config = JSON.parse(readFileSync(argument("config", resolve(KATALOG, "../config/severity.json")), "utf8"));

const RANGA_PEWNOSCI = { niska: 0, srednia: 1, wysoka: 2 };
const progPewnosci = RANGA_PEWNOSCI[config.minimalna_pewnosc_blokady];
if (progPewnosci === undefined) {
  console.error(`brama: nieznana wartość minimalna_pewnosc_blokady: ${config.minimalna_pewnosc_blokady}`);
  process.exit(2);
}

if (!existsSync(plikFindings)) {
  // Strażnik nie wyprodukował wyniku — awaria narzędzia, nie znalezisko.
  const blokuj = config.przy_awarii === "blokuj";
  if (!cichy) {
    console.log(`STRAŻNIK AI: brak pliku ${plikFindings} — strażnik nie dokończył pracy.`);
    console.log(`Polityka "przy_awarii": ${config.przy_awarii} → ${blokuj ? "blokada" : "przepuszczam"}.`);
  }
  process.exit(blokuj ? 1 : 0);
}

const raport = JSON.parse(readFileSync(plikFindings, "utf8"));
const wszystkie = raport.znaleziska ?? [];

// Krytyk ma prawo weta i prawo korekty wagi — WYTYCZNE §N1.
const utrzymane = wszystkie.filter((z) => z.werdykt_krytyka?.utrzymane === true);
const odrzucone = wszystkie.length - utrzymane.length;

const ocenione = utrzymane.map((z) => {
  const poKrytyku = z.werdykt_krytyka.korekta_wagi ?? z.waga;
  // Degradacja przy zbyt niskiej pewności — nigdy blokada na przeczuciu.
  const zaNiskaPewnosc = (RANGA_PEWNOSCI[z.pewnosc] ?? 0) < progPewnosci;
  const dzialanie = config.polityka[poKrytyku] ?? "raport";
  const waga = zaNiskaPewnosc && dzialanie === "blokuj" ? "INFO" : poKrytyku;
  return { ...z, waga_koncowa: waga, zdegradowane: waga !== poKrytyku };
});

const blokujace = ocenione.filter((z) => config.polityka[z.waga_koncowa] === "blokuj");

if (!cichy) {
  const KOLEJNOSC = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
  ocenione.sort((a, b) => KOLEJNOSC.indexOf(a.waga_koncowa) - KOLEJNOSC.indexOf(b.waga_koncowa));

  console.log("");
  console.log("═══ STRAŻNIK AI ═══");
  if (raport.zakres?.pominieto) {
    console.log(`Pominięto: ${raport.zakres.pominieto}`);
  }
  if (ocenione.length === 0) {
    console.log("Brak znalezisk.");
    if (odrzucone > 0) console.log(`Krytyk odrzucił ${odrzucone} — fałszywe alarmy nie dotarły do Ciebie.`);
  } else {
    const doPokazania = ocenione.slice(0, config.max_znalezisk_w_raporcie);
    for (const z of doPokazania) {
      const l = z.lokalizacja;
      const blad = z.blad_id ? ` [${z.blad_id}]` : "";
      const deg = z.zdegradowane ? "  (zdegradowane — pewność poniżej progu)" : "";
      console.log("");
      console.log(`${z.waga_koncowa} — ${z.kategoria}${blad}${deg}`);
      console.log(`  ${l.plik}:${l.linia}`);
      console.log(`  Problem: ${z.problem}`);
      console.log(`  Skutek:  ${z.skutek}`);
      console.log(`  Dowód:   ${z.dowod.plik}:${z.dowod.linia}  ${JSON.stringify(z.dowod.cytat)}`);
      console.log(`  Naprawa: ${z.naprawa}`);
      console.log(`  Pewność: ${z.pewnosc}`);
    }
    const reszta = ocenione.length - doPokazania.length;
    if (reszta > 0) console.log(`\n… oraz ${reszta} dalszych znalezisk w ${plikFindings}`);
    if (odrzucone > 0) console.log(`\nKrytyk odrzucił ${odrzucone} znalezisk jako fałszywe alarmy.`);
  }
  console.log("");
  if (blokujace.length > 0) {
    console.log(`BLOKADA: ${blokujace.length} ${blokujace.length === 1 ? "znalezisko blokujące" : "znalezisk blokujących"}.`);
    console.log("To strażnik AI, nie lint ani testy. Napraw albo uzasadnij i użyj --no-verify.");
  } else {
    console.log("Przechodzi.");
  }
  console.log("");
}

process.exit(blokujace.length > 0 ? 1 : 0);
