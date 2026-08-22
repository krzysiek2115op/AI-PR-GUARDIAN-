// Testy ustalania zakresu. node --test, zero zależności.
// Każdy przypadek buduje własne, tymczasowe repozytorium git.
// Uruchomienie:  node --test scripts/zakres.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const ZAKRES = resolve(KATALOG, "zakres.mjs");
const CONFIG = resolve(KATALOG, "../config/routing.json");

function repo() {
  const kat = mkdtempSync(join(tmpdir(), "zakres-"));
  const git = (...a) => execFileSync("git", a, { cwd: kat, encoding: "utf8" });
  git("init", "-q", "-b", "baza");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  writeFileSync(join(kat, "README.md"), "start\n");
  git("add", "-A");
  git("commit", "-q", "-m", "start");
  git("checkout", "-q", "-b", "praca");
  return { kat, git };
}

function zapisz(kat, sciezka, tresc) {
  mkdirSync(dirname(join(kat, sciezka)), { recursive: true });
  writeFileSync(join(kat, sciezka), tresc);
}

function uruchom(kat) {
  execFileSync("node", [ZAKRES, "--baza", "baza", "--head", "HEAD", "--config", CONFIG], {
    cwd: kat,
    stdio: "pipe",
  });
  return JSON.parse(readFileSync(join(kat, ".straznik-ai/zakres.json"), "utf8"));
}

test("plik kodu uruchamia strażnika", () => {
  const { kat, git } = repo();
  zapisz(kat, "modules/m1-sklep/odczyt.ts", "export const x = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "kod");

  const w = uruchom(kat);
  assert.equal(w.kod, true);
  assert.equal(w.plikow, 1);
  assert.deepEqual(w.straznicy, ["straznik-regresji"]);
  assert.equal(w.pominieto, null);
});

test("sam Markdown treści nie uruchamia strażnika", () => {
  const { kat, git } = repo();
  zapisz(kat, "tresc-kursow/modul-1/lekcja.md", "# Lekcja\n");
  git("add", "-A");
  git("commit", "-q", "-m", "tresc");

  const w = uruchom(kat);
  assert.equal(w.kod, false);
  assert.equal(w.plikow, 0);
  assert.deepEqual(w.straznicy, []);
  assert.match(w.pominieto, /filtr kodu/);
});

test("docs poza filtrem, ale kod obok — strażnik rusza tylko na kodzie", () => {
  const { kat, git } = repo();
  zapisz(kat, "docs/notatka.md", "notatka\n");
  zapisz(kat, "app/szkolenia/widok.tsx", "export default function W() { return null; }\n");
  git("add", "-A");
  git("commit", "-q", "-m", "mieszany");

  const w = uruchom(kat);
  assert.equal(w.kod, true);
  assert.equal(w.plikow, 1, "tylko plik kodu wchodzi do zakresu");
  assert.ok(w.pominiete_sciezki.includes("docs/notatka.md"));
});

test("package-lock.json nigdy nie wchodzi do zakresu", () => {
  const { kat, git } = repo();
  zapisz(kat, "package-lock.json", '{"lockfileVersion":3}\n');
  git("add", "-A");
  git("commit", "-q", "-m", "lock");

  const w = uruchom(kat);
  assert.equal(w.kod, false, "lock jest w filtrze kodu, ale lista nigdy ma pierwszeństwo");
  assert.ok(w.pominiete_sciezki.includes("package-lock.json"));
});

test("plik .env nigdy nie wchodzi do zakresu", () => {
  const { kat, git } = repo();
  zapisz(kat, "lib/.env.local", "DB1_URL=postgres://tajne\n");
  git("add", "-A");
  git("commit", "-q", "-m", "env");

  const w = uruchom(kat);
  assert.equal(w.plikow, 0);
  assert.ok(w.pominiete_sciezki.some((p) => p.includes(".env")));
});

test("przekroczony limit plików zatrzymuje analizę zamiast obcinać", () => {
  const { kat, git } = repo();
  for (let i = 0; i < 61; i++) zapisz(kat, `lib/plik-${i}.ts`, "export const x = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "duzo");

  const w = uruchom(kat);
  assert.equal(w.kod, false);
  assert.deepEqual(w.straznicy, []);
  assert.match(w.pominieto, /Podziel Pull Requesta/);
});

test("przekroczony limit linii zatrzymuje analizę", () => {
  const { kat, git } = repo();
  zapisz(kat, "lib/duzy.ts", "export const x = 1;\n".repeat(4100));
  git("add", "-A");
  git("commit", "-q", "-m", "dlugi");

  const w = uruchom(kat);
  assert.equal(w.kod, false);
  assert.match(w.pominieto, /linii kodu/);
});

test("pusty diff nie uruchamia strażnika", () => {
  const { kat } = repo();
  const w = uruchom(kat);
  assert.equal(w.kod, false);
  assert.equal(w.plikow_wszystkich, 0);
});

test("zmiany z gałęzi bazowej nie wchodzą do zakresu", () => {
  const { kat, git } = repo();
  zapisz(kat, "lib/moje.ts", "export const x = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "moja zmiana");

  // Ktoś inny dokłada commit na bazie — trzykropek ma go pominąć.
  git("checkout", "-q", "baza");
  zapisz(kat, "lib/cudze.ts", "export const y = 2;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "cudza zmiana");
  git("checkout", "-q", "praca");

  const w = uruchom(kat);
  assert.deepEqual(w.pliki, ["lib/moje.ts"], "cudza zmiana z bazy nie należy do tego PR-a");
});
