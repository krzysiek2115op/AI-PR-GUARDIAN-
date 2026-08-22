// Testy bramki jakości. node --test, zero zależności.
// Uruchomienie:  node --test scripts/brama.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const BRAMA = resolve(KATALOG, "brama.mjs");
const CONFIG = resolve(KATALOG, "../config/severity.json");

function znalezisko(nadpisania = {}) {
  return {
    waga: "CRITICAL",
    kategoria: "regresja",
    lokalizacja: { plik: "modules/m1-sklep/odczyt.ts", linia: 42 },
    problem: "Cena 0 groszy podmieniana na domyślną.",
    skutek: "Kurs darmowy zostaje sprzedany za 99 zł.",
    dowod: { cytat: "price_grosze || CENA_DOMYSLNA", plik: "modules/m1-sklep/odczyt.ts", linia: 42 },
    naprawa: "Zamienić || na ??.",
    pewnosc: "wysoka",
    straznik: "straznik-regresji",
    blad_id: "BLAD-005",
    werdykt_krytyka: { utrzymane: true, uzasadnienie: "Cytat zgodny z plikiem." },
    ...nadpisania,
  };
}

function uruchom(znaleziska, { plikIstnieje = true } = {}) {
  const katalog = mkdtempSync(join(tmpdir(), "brama-"));
  const plik = join(katalog, "findings.json");
  if (plikIstnieje) {
    writeFileSync(
      plik,
      JSON.stringify({
        wersja: "1",
        zakres: { baza: "plugin-1-sklep-kursow", head: "HEAD", plikow: 1, linii: 10, straznicy: ["straznik-regresji"] },
        znaleziska,
        podsumowanie: { blokujace: 0, razem: znaleziska.length, odrzucone_przez_krytyka: 0 },
      }),
    );
  }
  try {
    execFileSync("node", [BRAMA, "--findings", plik, "--config", CONFIG, "--cichy"], { stdio: "pipe" });
    return 0;
  } catch (e) {
    return e.status;
  }
}

test("brak znalezisk przepuszcza", () => {
  assert.equal(uruchom([]), 0);
});

test("CRITICAL o wysokiej pewności blokuje", () => {
  assert.equal(uruchom([znalezisko()]), 1);
});

test("HIGH o wysokiej pewności blokuje", () => {
  assert.equal(uruchom([znalezisko({ waga: "HIGH" })]), 1);
});

test("MEDIUM nie blokuje", () => {
  assert.equal(uruchom([znalezisko({ waga: "MEDIUM" })]), 0);
});

test("niska pewność degraduje blokadę do INFO", () => {
  assert.equal(uruchom([znalezisko({ pewnosc: "niska" })]), 0);
});

test("średnia pewność też nie blokuje przy progu wysoka", () => {
  assert.equal(uruchom([znalezisko({ pewnosc: "srednia" })]), 0);
});

test("znalezisko odrzucone przez krytyka nie blokuje", () => {
  const odrzucone = znalezisko({
    werdykt_krytyka: { utrzymane: false, uzasadnienie: "Klasę łapie straznik-limitow." },
  });
  assert.equal(uruchom([odrzucone]), 0);
});

test("korekta wagi przez krytyka zdejmuje blokadę", () => {
  const zlagodzone = znalezisko({
    werdykt_krytyka: { utrzymane: true, uzasadnienie: "Realny, ale z obejściem.", korekta_wagi: "LOW" },
  });
  assert.equal(uruchom([zlagodzone]), 0);
});

test("korekta wagi w górę zakłada blokadę", () => {
  const zaostrzone = znalezisko({
    waga: "LOW",
    werdykt_krytyka: { utrzymane: true, uzasadnienie: "Wyciek towaru zza bramki.", korekta_wagi: "CRITICAL" },
  });
  assert.equal(uruchom([zaostrzone]), 1);
});

test("jedno blokujące wśród nieblokujących nadal blokuje", () => {
  assert.equal(uruchom([znalezisko({ waga: "LOW" }), znalezisko({ waga: "INFO" }), znalezisko()]), 1);
});

test("brak pliku findings przepuszcza przy polityce przepusc", () => {
  assert.equal(uruchom([], { plikIstnieje: false }), 0);
});
