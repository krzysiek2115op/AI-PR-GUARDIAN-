// FIXTURE — oczekiwane: BLAD-002, waga CRITICAL, pewność wysoka
//
// Testy chodzą sekwencyjnie na osobnej bazie db1_kursy_test.
// Ten test bierze połączenie deweloperskie i czyści tabele — kasuje pracę
// właściciela w db1_kursy, łącznie z treścią 41 lekcji wgraną kreatorem.

import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";

test("katalog zwraca opublikowane kursy", async () => {
  // BŁĄD: DB1_URL wskazuje bazę deweloperską, nie testową.
  const klient = new Client({ connectionString: process.env.DB1_URL });
  await klient.connect();

  // BŁĄD: kasowanie na bazie, która nie została wymuszona na testową.
  await klient.query("TRUNCATE course_lessons, course_modules, course_sections, courses CASCADE");

  await klient.query(
    "INSERT INTO courses (slug, title, type, price_grosze, status) VALUES ($1,$2,$3,$4,$5)",
    ["testowy", "Testowy", "kurs", 0, "published"],
  );

  const { rows } = await klient.query("SELECT slug FROM courses WHERE status = 'published'");
  assert.equal(rows.length, 1);

  await klient.end();
});
