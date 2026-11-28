import {
  type EigeneSicht as ModulEigene,
  type FremdeSicht as ModulFremde,
  type TafelrundeSicht as ModulSicht,
  DEFAULT_REGELN,
  botZug,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  sichtFuer,
  tafelrunde,
} from '@brauweg/game-tafelrunde';
import { describe, expect, it } from 'vitest';

import type { Kaempferstand, Kampfereignis } from '../minispiele/tafelrunde/kampfbericht';
import type {
  EigeneSicht,
  FremdeSicht,
  TafelrundeSicht,
} from '../minispiele/tafelrunde/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Tafelrunde und dem Modul.
 *
 * Tafelrunde ist der Fall, an dem die Lücke am meisten kostet, weil die Sicht
 * ZAHLEN trägt, die anderswo Regeln wären: `feldplaetze` und `belegt`
 * entscheiden, ob eine Einheit aufs Brett darf, `verschmelzZahl` beschriftet
 * den Fortschritt („zwei von drei"), `feldplaetzeNaechsteRunde` sagt an, ob
 * das Feld zur nächsten Runde wächst. Der Bildschirm rechnet keine davon nach — fällt
 * eine weg, zeigt er stumm etwas Falsches.
 *
 * Drei Ebenen, drei Zusicherungen: die Partiesicht, die eigene Sicht und die
 * eines Gegners. Die beiden unteren stehen als eigene Typen im Client und
 * fielen aus einer Prüfung der obersten Ebene sonst heraus.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;
type EchteEigene = Beweglich<ModulEigene>;
type EchteFremde = Beweglich<ModulFremde>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<TafelrundeSicht, EchteSicht>;
type _eigenePasst = PasstAuf<EigeneSicht, EchteEigene>;
type _fremdePasst = PasstAuf<FremdeSicht, EchteFremde>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben den Zuweisungen
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge — und davon
 * gibt es hier sieben (`kaempfe`, `paarungen`, `katalog`, `synergieTabelle`,
 * `stufenwerte`, `faehigkeiten`, `synergien`), alle aus der Rücksicht auf Tische, die vor der
 * jeweiligen Erweiterung aufgemacht wurden.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof TafelrundeSicht, keyof EchteSicht>>;
type _keinEigenesNurImClient = Leer<Exclude<keyof EigeneSicht, keyof EchteEigene>>;
type _keinFremdesNurImClient = Leer<Exclude<keyof FremdeSicht, keyof EchteFremde>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `TafelrundeSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'ich',
  'runde',
  'rundenGrenze',
  'phase',
  'fertig',
  'sieger',
  'platzierung',
  'zuschauer',
  'ladenPlaetze',
  'bankPlaetze',
  'brettFelder',
  'brettReihen',
  'brettSpalten',
  'arenaReihen',
  'verschmelzZahl',
  'maxStufe',
  'vorrat',
  'eigenes',
  'gegner',
  'leftSeats',
  'zeitraffer',
  'schrittMs',
  'kaempfe',
  'paarungen',
  'katalog',
  'synergieTabelle',
  'stufenwerte',
  'faehigkeiten',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof TafelrundeSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof TafelrundeSicht>>;

const EIGENE_FELDER = [
  'sitz',
  'leben',
  'gold',
  'level',
  'laden',
  'bank',
  'brett',
  'serie',
  'bereit',
  'ausRunde',
  'feldplaetze',
  'belegt',
  'einkommen',
  'feldplaetzeNaechsteRunde',
  'naechsterGegner',
  'kampfZuege',
  'darfHandeln',
  'synergien',
] as const;
type _eigeneVollstaendig = Leer<Exclude<keyof EigeneSicht, (typeof EIGENE_FELDER)[number]>>;
type _eigeneOhneKarteileichen = Leer<Exclude<(typeof EIGENE_FELDER)[number], keyof EigeneSicht>>;

const FREMDE_FELDER = [
  'sitz',
  'leben',
  'level',
  'serie',
  'brett',
  'bereit',
  'ausRunde',
  'verlassen',
  'synergien',
] as const;
type _fremdeVollstaendig = Leer<Exclude<keyof FremdeSicht, (typeof FREMDE_FELDER)[number]>>;
type _fremdeOhneKarteileichen = Leer<Exclude<(typeof FREMDE_FELDER)[number], keyof FremdeSicht>>;

describe('Vertrag Tafelrunde', () => {
  /*
   * Vier Sitze und eine Runde — dieselbe Besetzung wie der Knopf „Gegen Bots
   * spielen". Bei Tafelrunde rüsten alle gleichzeitig; `currentActor` nennt
   * trotzdem einen Sitz, und daran hangelt sich die Schleife entlang
   * (CLAUDE.md).
   */
  const gesehen = felderEinerPartie(tafelrunde as unknown as Spielmodul, {
    sitze: 4,
    runden: 1,
    // Die halbe Rüstkammer hängt an `eigenes`, die Mitspielerleiste an
    // `gegner`. Ohne diesen Durchgriff bliebe ungeprüft, was der Bildschirm
    // am meisten liest.
    unterobjekte: ['eigenes', 'gegner'],
  });

  it('liefert jedes Feld der Partiesicht, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('liefert jedes Feld der eigenen Sicht', () => {
    expect(fehlendeFelder(EIGENE_FELDER, gesehen.unter.eigenes ?? new Set())).toEqual([]);
  });

  it('liefert jedes Feld eines fremden Sitzes', () => {
    expect(fehlendeFelder(FREMDE_FELDER, gesehen.unter.gegner ?? new Set())).toEqual([]);
  });

  it('schickt Katalog, Synergie-Tabelle, Stufenwerte und Faehigkeiten in der ersten Sicht mit', () => {
    // Alle drei kommen nur beim ersten Ausliefern (`seit === 0`, siehe sicht.ts
    // im Modul). Wer sie nicht festhält, hat ab dem zweiten Rundruf weder
    // Einheitennamen noch Schwellen noch Werte — und der Bildschirm zeigt
    // leere Karten und ein leeres Blatt.
    expect(gesehen.oben.has('katalog')).toBe(true);
    expect(gesehen.oben.has('synergieTabelle')).toBe(true);
    expect(gesehen.oben.has('stufenwerte')).toBe(true);
    // Seit dem 27.11.2026: Ohne die Faehigkeiten kennt TafelrundeNeu weder
    // Namen noch volles Mana — der Manabalken haette keinen Massstab.
    expect(gesehen.oben.has('faehigkeiten')).toBe(true);
  });

  /*
   * Die Felder IM Kampfbericht stehen eine Ebene tiefer, als `felderEinerPartie`
   * schaut — und genau an ihnen haengen Mana- und Schildbalken von
   * TafelrundeNeu. Fehlen sie, beginnt jeder Balken bei null, und der Schild
   * bleibt nach dem ersten Treffer stehen, ohne dass etwas rot wird. Deshalb
   * hier eine echte Kampfphase mit Bots, und die Felder werden nachgesehen.
   */
  it('liefert im Kampfbericht Mana und Schild im Start und den Restschild am Treffer', () => {
    let p = erstellePartie(DEFAULT_REGELN, [0, 1, 2, 3], 'vertrag-kampf');
    for (const sitz of lebendeSitze(p)) {
      for (let i = 0; i < 200 && darfHandeln(p, sitz); i++) p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), 'normal'));
    }
    const kaempfe = sichtFuer(p, 0).kaempfe ?? [];
    expect(kaempfe.length).toBeGreaterThan(0);
    const start: readonly Kaempferstand[] = kaempfe[0]!.bericht.start;
    expect(start.length).toBeGreaterThan(0);
    for (const k of start) {
      expect(typeof k.mana).toBe('number');
      expect(typeof k.schild).toBe('number');
    }
    const treffer = (kaempfe.flatMap((k) => k.bericht.ereignisse) as readonly Kampfereignis[]).filter(
      (e) => e.art === 'treffer',
    );
    expect(treffer.length).toBeGreaterThan(0);
    for (const t of treffer) {
      if (t.art !== 'treffer') continue;
      expect(typeof t.schildDanach).toBe('number');
      expect(typeof t.manaWer).toBe('number');
      expect(typeof t.manaZiel).toBe('number');
    }
  });

  /*
   * Seit dem 27.11.2026 nachts zaehlt jede Einheit fuer eine Marke nur einmal,
   * und die Sicht nennt die gezaehlten Einheiten (`traeger`). Daran haengt im
   * Laden das Leuchten (eine schon gezaehlte Einheit bringt nichts) und im
   * Marken-Pop-up das „zählt". Fehlte das Feld, leuchtete jede Kopie wieder.
   */
  it('liefert an jedem Markenstand die gezaehlten Traeger, je Einheit einmal', () => {
    let p = erstellePartie(DEFAULT_REGELN, [0, 1, 2, 3], 'vertrag-marken');
    for (const sitz of lebendeSitze(p)) {
      for (let i = 0; i < 200 && darfHandeln(p, sitz); i++) p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), 'normal'));
    }
    const staende = [0, 1, 2, 3].flatMap((sitz) => sichtFuer(p, sitz).eigenes?.synergien ?? []);
    expect(staende.length).toBeGreaterThan(0);
    for (const s of staende) {
      expect(Array.isArray(s.traeger)).toBe(true);
      expect(new Set(s.traeger).size).toBe(s.traeger.length);
      expect(s.traeger.length).toBe(s.anzahl);
    }
  });
});
