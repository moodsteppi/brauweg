import { brochess } from '@brauweg/game-brochess';
import { cambio } from '@brauweg/game-cambio';
import { doppelkopf } from '@brauweg/game-doppelkopf';
import { easypoker } from '@brauweg/game-easypoker';
import { eiland } from '@brauweg/game-eiland';
import { filler } from '@brauweg/game-filler';
import { golf } from '@brauweg/game-golf';
import { partykiste } from '@brauweg/game-partykiste';
import { skat } from '@brauweg/game-skat';
import { wizard } from '@brauweg/game-wizard';
import { describe, expect, it } from 'vitest';

import { de } from '../i18n/de';
import { en } from '../i18n/en';
import type { Variante } from '../minispiele/filler/sicht';
import { MODI as PARTY_MODI } from '../minispiele/partykiste/wahl';
import { SPIELART_BILDER_VORHANDEN, spielartBild } from '../spielarten/bilder';

/*
 * Vertrag der Spielarten (seit dem 28.11.2026) zwischen Modul und Client.
 *
 * Die Spielarten stehen im Modul (`GameMeta.spielarten`); der Client kennt
 * nur ihre Kennungen — als Schlüssel im Wörterbuch und als Dateinamen der
 * Kartenbilder. Läuft beides auseinander, steht am Bildschirm ein roher
 * Schlüssel oder das Banner statt des bestellten Bildes, und kein Build wird
 * rot. Der Server prüft die deutschen Schlüssel auch (spielarten.test.ts
 * dort); hier kommen Englisch und die Bilder dazu.
 */

const MODULE = [brochess, cambio, doppelkopf, easypoker, eiland, filler, golf, partykiste, skat, wizard];

/** Spiele, deren Karte gezeichnet wird statt geladen (Vorschaubrett, Bahnminiatur). */
const GEZEICHNET = new Set(['filler', 'golf']);

function flach(bereiche: Record<string, Record<string, string>>): Record<string, string> {
  return Object.assign({}, ...Object.values(bereiche)) as Record<string, string>;
}

describe('Spielarten: Modul und Client', () => {
  const woerter = { de: flach(de as never), en: flach(en as never) };

  it.each(MODULE.map((m) => [m.meta.id, m] as const))('%s: Name und Satz in beiden Sprachen', (id, modul) => {
    for (const art of modul.meta.spielarten ?? []) {
      for (const sprache of ['de', 'en'] as const) {
        expect(woerter[sprache][`spielart.${id}.${art.id}.name`], `${sprache} ${art.id}.name`).toBeTruthy();
        expect(woerter[sprache][`spielart.${id}.${art.id}.text`], `${sprache} ${art.id}.text`).toBeTruthy();
      }
    }
  });

  it.each(MODULE.filter((m) => !GEZEICHNET.has(m.meta.id)).map((m) => [m.meta.id, m] as const))(
    '%s: jede Spielart hat ihr Bild',
    (_id, modul) => {
      for (const art of modul.meta.spielarten ?? []) {
        expect(spielartBild(modul.meta.id, art.id), art.id).not.toBeNull();
      }
    },
  );

  it('kein Bild ohne Spielart dahinter', () => {
    const erwartet = new Set(
      MODULE.flatMap((m) =>
        (m.meta.spielarten ?? []).map((art) => spielartBild(m.meta.id, art.id)?.replace(/^.*\/|\.webp$/g, '')),
      ),
    );
    for (const name of SPIELART_BILDER_VORHANDEN) expect(erwartet.has(name), name).toBe(true);
  });

  it('Farbduell: die gezeichneten Spielarten sind die des Moduls, in derselben Reihenfolge', () => {
    // Dieselbe Folge wie `SPIELARTEN` in screens/Filler.tsx (Raster und
    // Wischen). Nicht von dort importiert: Ein Vertrag, der aus einer .tsx
    // liest, zoege React in den Test (CLAUDE.md).
    const imBildschirm: readonly Variante[] = ['nebel', 'klar', 'build', 'extreme'];
    expect(filler.meta.spielarten!.map((a) => a.id)).toEqual(imBildschirm);
  });

  it('Partykiste: die Modus-Kacheln sind die Spielarten des Moduls', () => {
    expect(PARTY_MODI.map((m) => m.kennung)).toEqual(partykiste.meta.spielarten!.map((a) => a.id));
  });
});
