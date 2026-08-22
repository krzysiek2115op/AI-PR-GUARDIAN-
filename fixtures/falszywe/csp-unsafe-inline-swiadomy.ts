// FIXTURE — oczekiwane: CISZA
//
// 'unsafe-inline' w style-src to JEDYNE świadome osłabienie CSP w tym
// projekcie, udokumentowane i przyjęte decyzją właściciela: React hoistuje
// @font-face i zdejmuje nonce, plus 19 atrybutów style=.
//
// Strażnik ma milczeć. Zgłoszenie tego to nieznajomość projektu podana
// jako znalezisko bezpieczeństwa — najgorszy możliwy rodzaj fałszywego alarmu.
//
// Granica: słowo unieważniające ochronę wolno postawić w style-src
// I NIGDZIE INDZIEJ. Gdyby pojawiło się w script-src — to już jest CRITICAL.

export function politykaCSP(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "frame-ancestors 'none'",
  ].join("; ");
}
