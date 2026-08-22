// FIXTURE — oczekiwane: BLAD-007, waga HIGH, pewność wysoka
//
// Artefakt wdrożeniowy musi powstawać z tego, co jest w commicie.
// Ten skrypt kopiuje z katalogu roboczego, więc wynosi na produkcję
// niezacommitowane zmiany — a --no-verify omija hooki, które by to złapały.

import { execSync } from "node:child_process";
import { cpSync } from "node:fs";

const WYDANIE = "out";

// BŁĄD: źródłem jest katalog roboczy, nie wynik czystego builda.
cpSync("./public", `${WYDANIE}/public`, { recursive: true });
cpSync("./app", `${WYDANIE}/app`, { recursive: true });

execSync(`git add -f ${WYDANIE}`, { stdio: "inherit" });
// BŁĄD: --no-verify wyłącza pre-commit, który blokuje .env i wzorce tokenów.
execSync('git commit --no-verify -m "deploy"', { stdio: "inherit" });
execSync("git push origin gh-pages", { stdio: "inherit" });
