/**
 * Der Umfang: welche Spiele und Funktionen diese Ausgabe ueberhaupt anbietet.
 *
 * Eine Umgebungsvariable, `UMFANG`, kommagetrennt — Spielkennungen aus der
 * Registry und die Funktionen unten:
 *
 *   UMFANG=doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad
 *
 * **Ohne Variable ist alles an.** Das ist `staging`: Dort soll jeder Teil
 * laufen, auch der, der fuer die Produktion noch nicht freigegeben ist. Auf
 * `main` steht die Liste dessen, was zum Release gehoert (Projekt
 * „Brauweg-Spielen Release-Fertig", docs/release/ios-web-abgleich.md §7 C).
 *
 * Warum ein Schalter im Server und keine Weiche im Client: Die App bringt den
 * Client im Paket mit. Ein Wert, der dort einkompiliert ist, liesse sich nur
 * mit einem neuen Build samt Pruefung bei Apple aendern — hier genuegt ein
 * Deploy. Und Web und App lesen dieselbe Liste: Genau daran, dass Funktionen
 * nur fuer `inApp` eingeschaltet wurden, sind die beiden auseinandergelaufen.
 *
 * Der Umfang ist eine OBERGRENZE ueber `FREIGABE` (games/registry.ts), kein
 * Ersatz dafuer: Was nicht im Umfang steht, ist auf beiden Plattformen `aus`.
 * Was drinsteht, ist so frei, wie `FREIGABE` und die bestehenden Weichen es
 * je Plattform sagen — `UMFANG=brochess` macht BroChess auf der Webseite
 * nicht spielbar, solange es dort auf `bald` steht.
 *
 * Bewusst kein Schalter in der Oberflaeche und keine Einstellung je Konto
 * oder fuer die Aufsicht: Was zum Angebot gehoert, ist eine Entscheidung je
 * Ausgabe und gehoert in deren Umgebung.
 */

/**
 * Was ausser den Spielen der Registry ein- und ausgeschaltet wird.
 *
 * Nur Teile mit eigenem Einstieg UND eigenen Routen — die Sperre steht im
 * Server (`FUNKTION_ZU_ROUTE` in http/app.ts), nicht nur in der Auswahl.
 * Wer eine Funktion ergaenzt, traegt dort ihre Routen ein und im Client die
 * Stelle, an der ihr Einstieg verschwindet (umfang.ts im Client).
 */
export const FUNKTIONEN = [
  /** Das Idle-Spiel, allein (packages/manufaktur-kern). */
  'kartenmanufaktur',
  /** Tageswort, allein. */
  'browort',
  /** Das Tageswort des Clans. */
  'clanwort',
  /** Doppelkopf lernen: Lernpfad und Uebungsrunde. */
  'lernpfad',
  /** Der Solo-Runner. */
  'prosubway',
  /** Clankrieg: Suche, Herausforderung, Stand. */
  'clankrieg',
  /** Der Clan-Chat. */
  'clanchat',
] as const;

export type Funktion = (typeof FUNKTIONEN)[number];

export interface Umfang {
  /** Keine Liste gesetzt: alles an. */
  readonly alles: boolean;
  /** Was freigeschaltet ist — bei `alles` leer und ohne Bedeutung. */
  readonly frei: ReadonlySet<string>;
}

/** Die Vorgabe ohne Variable — und in jedem Test, der keinen Umfang braucht. */
export const ALLES: Umfang = { alles: true, frei: new Set() };

/** Ist dieses Spiel bzw. diese Funktion hier freigeschaltet? */
export function imUmfang(umfang: Umfang, kennung: string): boolean {
  return umfang.alles || umfang.frei.has(kennung);
}

/**
 * Den Umfang aus `UMFANG` lesen.
 *
 * Eine LEERE Variable zaehlt wie eine fehlende — also alles an. Andersherum
 * waere ein versehentlich geleertes Feld im Dashboard ein Deploy, nach dem
 * die Produktion kein einziges Spiel mehr anbietet. Wer wirklich alles
 * abschalten will, schreibt einen Namen hinein, den es nicht gibt (und
 * bekommt ihn beim Start als unbekannt gemeldet).
 *
 * `bekannt` sind die Spielkennungen der Registry; sie kommen von aussen,
 * damit diese Datei die Registry nicht importiert (die Registry importiert
 * diese Datei).
 */
export function umfangAusUmgebung(
  roh: string | undefined,
  bekannt: readonly string[],
): { readonly umfang: Umfang; readonly unbekannt: readonly string[] } {
  const teile = (roh ?? '')
    .split(',')
    .map((teil) => teil.trim().toLowerCase())
    .filter((teil) => teil.length > 0);
  if (teile.length === 0) return { umfang: ALLES, unbekannt: [] };
  const gueltig = new Set<string>([...bekannt, ...FUNKTIONEN]);
  return {
    // Unbekanntes bleibt drin: Es schaltet nichts frei, und eine Kennung,
    // die erst mit dem naechsten Deploy dazukommt, wirkt dann sofort.
    umfang: { alles: false, frei: new Set(teile) },
    unbekannt: teile.filter((teil) => !gueltig.has(teil)),
  };
}

/**
 * Wie der Client den Umfang bekommt (`/api/me`): `null` heisst alles an,
 * sonst die Liste. Die Liste und keine fertig ausgewerteten Ja/Nein je
 * Funktion, weil die App ihren Client mitbringt und dabei an einen Server
 * mit einer neueren Funktion geraten kann — die steht dann einfach nicht
 * drin und bleibt aus.
 */
export function umfangFuerClient(umfang: Umfang): string[] | null {
  return umfang.alles ? null : [...umfang.frei].sort();
}

/** Eine Zeile fuer das Startprotokoll. */
export function umfangZeile(umfang: Umfang, unbekannt: readonly string[]): string {
  if (umfang.alles) return 'Umfang: alles an (UMFANG nicht gesetzt)';
  return (
    `Umfang: ${umfangFuerClient(umfang)?.join(', ')}` +
    (unbekannt.length > 0 ? `; UMFANG unbekannt: ${unbekannt.join(', ')}` : '')
  );
}
