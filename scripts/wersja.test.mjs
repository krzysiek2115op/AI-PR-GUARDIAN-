// Testy kontroli wersji. Każdy przypadek pozytywny ma odpowiednik negatywny.
// Uruchomienie:  node --test scripts/wersja.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Kopia repozytorium w miniaturze — tylko trzy pliki, które skrypt czyta.
function repo({ wersja = "0.1.0", separator = "—", wersjaChangelog = null, wersjaReadme = null } = {}) {
  const kat = mkdtempSync(join(tmpdir(), "wersja-"));
  mkdirSync(join(kat, ".claude-plugin"), { recursive: true });
  mkdirSync(join(kat, "scripts"), { recursive: true });
  cpSync(join(KORZEN, "scripts/wersja.mjs"), join(kat, "scripts/wersja.mjs"));

  writeFileSync(join(kat, ".claude-plugin/plugin.json"), JSON.stringify({ name: "x", version: wersja }));
  writeFileSync(
    join(kat, "CHANGELOG.md"),
    `# CHANGELOG\n\n## [${wersjaChangelog ?? wersja}] ${separator} 2026-08-22\n\n### Dodane\n\n- coś\n`,
  );
  writeFileSync(join(kat, "README.md"), `# X\n\n| **Wersja** | **${wersjaReadme ?? wersja}** |\n`);
  return kat;
}

function uruchom(kat) {
  try {
    const out = execFileSync("node", [join(kat, "scripts/wersja.mjs")], { encoding: "utf8", stdio: "pipe" });
    return { kod: 0, wyjscie: out };
  } catch (e) {
    return { kod: e.status, wyjscie: (e.stderr ?? "") + (e.stdout ?? "") };
  }
}

test("trzy zgodne wersje przechodzą", () => {
  assert.equal(uruchom(repo()).kod, 0);
});

test("rozjazd plugin.json vs CHANGELOG blokuje", () => {
  const w = uruchom(repo({ wersja: "0.2.0", wersjaChangelog: "0.1.0" }));
  assert.equal(w.kod, 1);
  assert.match(w.wyjscie, /Rozjazd/);
});

test("rozjazd plugin.json vs README blokuje", () => {
  const w = uruchom(repo({ wersja: "0.2.0", wersjaReadme: "0.1.0" }));
  assert.equal(w.kod, 1);
  assert.match(w.wyjscie, /README/);
});

test("ASCII hyphen zamiast em dash blokuje", () => {
  const w = uruchom(repo({ separator: "-" }));
  assert.equal(w.kod, 1);
  assert.match(w.wyjscie, /ASCII hyphen/);
});

test("en dash zamiast em dash blokuje", () => {
  const w = uruchom(repo({ separator: "–" }));
  assert.equal(w.kod, 1);
  assert.match(w.wyjscie, /en dash/);
});

test("em dash przechodzi", () => {
  assert.equal(uruchom(repo({ separator: "—" })).kod, 0);
});
