import { BAHNEN_KATALOG, golf, waehleBahnen } from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import { KARTEN } from '../minispiele/golf/karten';

/*
 * Vertrag zwischen dem Bahnkatalog des Moduls (Kennung + Schwierigkeit,
 * packages/game-golf/src/bahnen.ts) und den Geometrien des Clients
 * (minispiele/golf/karten/, eine Datei je Bahn). Seit dem 22.09.2026 zieht
 * das Modul die Bahnfolge einer Partie und schickt Kennungen — steht eine
 * Bahn nur auf einer Seite, merkt man es sonst erst am Tisch:
 *
 *   - nur im Modul: jede Partie, die sie zieht, zeigt „Neue Bahnen, bitte
 *     neu laden", und Neuladen hilft nicht;
 *   - nur im Client: sie wird nie gespielt, und niemand fragt, warum.
 *
 * Eine neue Bahn braucht deshalb beide Hälften im selben Pull Request.
 */
describe('Vertrag Golf-Bahnen', () => {
  const imModul = BAHNEN_KATALOG.map((b) => b.id);
  const imClient = KARTEN.map((k) => k.id);

  it('jede Kennung im Modul hat eine Geometrie im Client', () => {
    expect(imModul.filter((id) => !imClient.includes(id))).toEqual([]);
  });

  it('jede Geometrie im Client steht im Katalog des Moduls', () => {
    expect(imClient.filter((id) => !imModul.includes(id))).toEqual([]);
  });

  it('beide Seiten nennen dieselbe Schwierigkeit — die Rampe rechnet mit der des Moduls', () => {
    const imClientStufe = new Map(KARTEN.map((k) => [k.id, k.schwierigkeit]));
    const abweichend = BAHNEN_KATALOG.filter((b) => imClientStufe.get(b.id) !== b.schwierigkeit).map(
      (b) => `${b.id}: Modul ${b.schwierigkeit}, Client ${imClientStufe.get(b.id)}`,
    );
    expect(abweichend).toEqual([]);
  });

  it('jede Partie, die das Modul anlegt, laesst sich im Client vollstaendig aufloesen', () => {
    for (const saat of [1, 7, 4711, 20260922]) {
      for (const loecher of [2, 9, 15]) {
        const sicht = golf.viewFor(
          golf.createParty({ config: {}, seats: 2, rounds: loecher, seed: saat }),
          0,
        );
        expect(sicht.bahnen).toEqual(waehleBahnen(sicht.saat, loecher));
        for (const id of sicht.bahnen) expect(imClient, id).toContain(id);
      }
    }
  });
});
