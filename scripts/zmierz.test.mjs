// Testy oceny i czyszczenia fixture'ów. node --test, bez wołania modelu.
// Uruchomienie:  node --test scripts/zmierz.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { ocen, oczysc, zbierzFixtury } from "./zmierz.mjs";

const PRAWDZIWY = { nazwa: "blad-005-x.ts", rodzaj: "prawdziwy", oczekiwanyBlad: "BLAD-005" };
const FALSZYWY = { nazwa: "cena-ok.ts", rodzaj: "falszywy", oczekiwanyBlad: null };

function z(nadpisania = {}) {
  return {
    waga: "HIGH",
    blad_id: "BLAD-005",
    lokalizacja: { plik: "modules/m1-sklep/cennik.ts", linia: 12 },
    werdykt_krytyka: { utrzymane: true, uzasadnienie: "ok" },
    ...nadpisania,
  };
}
const raport = (znaleziska) => ({ znaleziska });

// --- ocena fixture'ów prawdziwych -------------------------------------------

test("trafienie: właściwa klasa i waga", () => {
  assert.equal(ocen(PRAWDZIWY, raport([z()])).trafienie, true);
});

test("przeoczenie: brak znalezisk", () => {
  const o = ocen(PRAWDZIWY, raport([]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /PRZEOCZENIE/);
});

test("pomyłka klasy: zgłoszono inny BLAD", () => {
  const o = ocen(PRAWDZIWY, raport([z({ blad_id: "BLAD-011" })]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /POMYŁKA KLASY/);
});

test("za niska waga: właściwa klasa, ale LOW", () => {
  const o = ocen(PRAWDZIWY, raport([z({ waga: "LOW" })]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /ZA NISKA WAGA/);
});

test("korekta wagi w górę ratuje znalezisko", () => {
  const podniesione = z({ waga: "LOW", werdykt_krytyka: { utrzymane: true, uzasadnienie: "ok", korekta_wagi: "HIGH" } });
  assert.equal(ocen(PRAWDZIWY, raport([podniesione])).trafienie, true);
});

test("korekta wagi w dół psuje znalezisko", () => {
  const obnizone = z({ waga: "HIGH", werdykt_krytyka: { utrzymane: true, uzasadnienie: "ok", korekta_wagi: "LOW" } });
  assert.equal(ocen(PRAWDZIWY, raport([obnizone])).trafienie, false);
});

test("znalezisko odrzucone przez krytyka liczy się jak brak", () => {
  const odrzucone = z({ werdykt_krytyka: { utrzymane: false, uzasadnienie: "brak dowodu" } });
  const o = ocen(PRAWDZIWY, raport([odrzucone]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /PRZEOCZENIE/);
});

// --- ocena fixture'ów fałszywych --------------------------------------------

test("cisza na poprawnym kodzie to trafienie", () => {
  assert.equal(ocen(FALSZYWY, raport([])).trafienie, true);
});

test("znalezisko na poprawnym kodzie to fałszywy alarm", () => {
  const o = ocen(FALSZYWY, raport([z()]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /FAŁSZYWY ALARM/);
});

test("krytyk, który odrzucił znalezisko, ratuje fixture fałszywy", () => {
  const odrzucone = z({ werdykt_krytyka: { utrzymane: false, uzasadnienie: "świadoma decyzja projektu" } });
  assert.equal(ocen(FALSZYWY, raport([odrzucone])).trafienie, true);
});

// --- czyszczenie ------------------------------------------------------------

test("komentarz zajmujący całą linię jest usuwany", () => {
  assert.equal(oczysc("// BŁĄD: tu jest wyciek\nconst x = 1;\n").trim(), "const x = 1;");
});

test("komentarz na końcu linii kodu jest usuwany", () => {
  assert.equal(oczysc("const x = 1; // to jest błąd\n").trim(), "const x = 1;");
});

test("adres https w łańcuchu przeżywa czyszczenie", () => {
  const wynik = oczysc('const a = "https://example.com/x";\n');
  assert.match(wynik, /https:\/\/example\.com\/x/);
});

test("ścieżka w JSX przeżywa czyszczenie", () => {
  const wynik = oczysc('<img src="/okladki/kurs.svg" />\n');
  assert.match(wynik, /\/okladki\/kurs\.svg/);
});

test("szablon literalny przeżywa czyszczenie", () => {
  const wynik = oczysc("const a = `script-src 'nonce-${n}'`;\n");
  assert.match(wynik, /nonce-\$\{n\}/);
});

test("żaden znacznik odpowiedzi nie przecieka do wyniku", () => {
  const brudny = [
    "// FIXTURE — oczekiwane: BLAD-005",
    "// SCIEZKA: modules/m1-sklep/cennik.ts",
    "//",
    "// Operator || traktuje 0 jak brak wartości.",
    "",
    "export const c = (k) => k.price_grosze || 9900; // BŁĄD: kasuje zero",
  ].join("\n");
  const czysty = oczysc(brudny);
  for (const slowo of ["FIXTURE", "SCIEZKA", "BŁĄD", "oczekiwane", "Operator"]) {
    assert.equal(czysty.includes(slowo), false, `przeciekło słowo: ${slowo}`);
  }
  assert.match(czysty, /price_grosze \|\| 9900/, "kod musi zostać nienaruszony");
});

// --- zbieranie fixture'ów ---------------------------------------------------

test("każdy fixture ma nagłówek SCIEZKA i przechodzi filtr kodu", async () => {
  const { readFileSync } = await import("node:fs");
  const routing = JSON.parse(readFileSync(new URL("../config/routing.json", import.meta.url), "utf8"));
  const filtr = new RegExp(routing.filtr_kodu);
  const nigdy = routing.nigdy.map((w) => new RegExp(w));

  const fixtury = zbierzFixtury();
  assert.ok(fixtury.length >= 8, "spodziewane co najmniej 8 fixture'ów");
  for (const f of fixtury) {
    assert.ok(f.celowaSciezka, `${f.nazwa}: brak ścieżki docelowej`);
    assert.ok(filtr.test(f.celowaSciezka), `${f.nazwa}: ${f.celowaSciezka} nie przechodzi filtru kodu`);
    assert.ok(!nigdy.some((r) => r.test(f.celowaSciezka)), `${f.nazwa}: ${f.celowaSciezka} jest na liście "nigdy"`);
  }
});

test("każdy fixture prawdziwy niesie w nazwie numer błędu", () => {
  for (const f of zbierzFixtury().filter((x) => x.rodzaj === "prawdziwy")) {
    assert.match(f.oczekiwanyBlad ?? "", /^BLAD-\d{3}$/, `${f.nazwa}: nie da się odczytać oczekiwanej klasy`);
  }
});
