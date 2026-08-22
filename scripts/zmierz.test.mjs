// Testy oceny i czyszczenia fixture'ów. node --test, bez wołania modelu.
// Uruchomienie:  node --test scripts/zmierz.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { ocen, oczysc, zbierzFixtury, zbierzKontekst, kontekstDla } from "./zmierz.mjs";

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
  assert.match(o.powod, /PRZEOCZENIE STRAŻNIKA/);
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

// Rozróżnienie „strażnik nic nie znalazł" od „krytyk obalił" decyduje o tym,
// co kalibrować. Zlanie obu w jeden komunikat kosztowało nas jeden przebieg
// diagnozy w pomiarze z 2026-08-22.
test("znalezisko odrzucone przez krytyka nie jest przeoczeniem strażnika", () => {
  const odrzucone = z({ werdykt_krytyka: { utrzymane: false, uzasadnienie: "brak dowodu" } });
  const o = ocen(PRAWDZIWY, raport([odrzucone]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /ODRZUCONE PRZEZ KRYTYKA/);
  assert.match(o.powod, /brak dowodu/);
  assert.equal(/PRZEOCZENIE/.test(o.powod), false);
});

test("wyłącznie obce klasy, wszystkie obalone, to przeoczenie strażnika", () => {
  const obca = z({ blad_id: "BLAD-002", werdykt_krytyka: { utrzymane: false, uzasadnienie: "nie ta klasa" } });
  const o = ocen(PRAWDZIWY, raport([obca]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /PRZEOCZENIE STRAŻNIKA/);
  assert.match(o.powod, /BLAD-002/);
});

test("za niska waga niesie uzasadnienie krytyka", () => {
  const obnizone = z({ waga: "HIGH", werdykt_krytyka: { utrzymane: true, uzasadnienie: "martwy kod", korekta_wagi: "LOW" } });
  const o = ocen(PRAWDZIWY, raport([obnizone]));
  assert.equal(o.trafienie, false);
  assert.match(o.powod, /ZA NISKA WAGA/);
  assert.match(o.powod, /martwy kod/);
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

// --- kontekst ---------------------------------------------------------------

test("każdy plik kontekstu ma oba nagłówki i wskazuje istniejący fixture", () => {
  const kontekst = zbierzKontekst();
  const cele = new Set(zbierzFixtury().map((f) => f.celowaSciezka));
  for (const k of kontekst) {
    assert.ok(k.celowaSciezka, `${k.nazwa}: brak ścieżki docelowej`);
    assert.ok(
      cele.has(k.dla),
      `${k.nazwa}: DLA wskazuje ${k.dla}, a żaden fixture tam nie celuje — kontekst byłby martwy`,
    );
  }
});

test("kontekst nigdy nie ląduje pod tą samą ścieżką co fixture", () => {
  const cele = new Set(zbierzFixtury().map((f) => f.celowaSciezka));
  for (const k of zbierzKontekst()) {
    assert.equal(
      cele.has(k.celowaSciezka),
      false,
      `${k.nazwa}: nadpisałby fixture pod ${k.celowaSciezka}`,
    );
  }
});

// Asymetria byłaby wadą pomiaru: fixture fałszywy bez miejsca użycia ma
// łatwiej o ciszę, bo krytyk sam z siebie obniża wagę martwemu kodowi.
test("fixture'y celujące w ten sam plik dostają ten sam kontekst", () => {
  const kontekst = zbierzKontekst();
  const wgCelu = new Map();
  for (const f of zbierzFixtury()) {
    const lista = wgCelu.get(f.celowaSciezka) ?? [];
    lista.push(f);
    wgCelu.set(f.celowaSciezka, lista);
  }
  for (const [cel, grupa] of wgCelu) {
    if (grupa.length < 2) continue;
    const podpisy = grupa.map((f) => kontekstDla(f, kontekst).map((k) => k.nazwa).sort().join("|"));
    assert.equal(new Set(podpisy).size, 1, `${cel}: fixture'y dostają różny kontekst — pomiar byłby nierówny`);
  }
});

test("kontekst przechodzi czyszczenie bez śladu po nagłówkach", async () => {
  const { readFileSync } = await import("node:fs");
  for (const k of zbierzKontekst()) {
    const czysty = oczysc(readFileSync(k.plik, "utf8"));
    for (const slowo of ["SCIEZKA", "DLA:", "KONTEKST"]) {
      assert.equal(czysty.includes(slowo), false, `${k.nazwa}: przeciekło słowo ${slowo}`);
    }
  }
});
