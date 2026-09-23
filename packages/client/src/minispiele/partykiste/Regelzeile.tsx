/**
 * Die Regelzeile: Mit welchen Regeln spielt dieser Tisch?
 *
 * Bis zum 22.09.2026 sah das im Spiel niemand — nur der Tischoeffner hatte
 * die Regler vor Augen, und auch der nur im Bot-Zweig. Robins Entscheidung
 * (P6): Der Oeffner stellt ein, und JEDER sieht den Regelsatz, bevor er
 * beitritt bzw. bevor es losgeht. Also steht die Zeile an zwei Stellen: im
 * Wartesaal (Regelsatz von `/tables/:id/rules`, weil es noch keine Sicht
 * gibt) und im Spielkopf (Regelsatz aus der Sicht). Beide Male dieselbe
 * Komponente, damit die Woerter nicht auseinanderlaufen.
 *
 * Sie bildet keine Regel nach: Sie liest drei Felder und benennt sie.
 */

import { createContext, useContext } from 'react';

import { eskalationsHinweis, modusChip } from './modi';
import { HAERTE_NAME, MINISPIEL_NAME, type PartyRegelsatz } from './sicht';

export function Regelzeile({
  regeln,
  runden,
}: {
  regeln: PartyRegelsatz;
  /** Die Rundenzahl steht nicht im Regelsatz (sie ist Sache des Tisches). */
  runden?: number;
}): React.JSX.Element {
  const alle = Object.keys(MINISPIEL_NAME).length;
  const anzahl = regeln.minispiele.length;
  const spiele =
    anzahl >= alle
      ? `alle ${alle} Minispiele`
      : `${anzahl} von ${alle} Minispielen`;
  const spieleTitel = regeln.minispiele.map((id) => MINISPIEL_NAME[id]).join(', ');
  /* Der Modus (seit 22.09.2026) steht vorn; das Turnier bekommt keinen Chip. */
  const modus = modusChip(regeln);
  const hinweis = eskalationsHinweis(regeln);
  /* In der Eskalation gilt nicht die eingestellte Haerte, sondern die der
     Runde — und vor der ersten Runde (Wartesaal) steht nur fest, dass sie steigt. */
  const haerte = regeln.modus === 'eskalation' ? (regeln.eskalation?.schluckFaktor ?? null) : regeln.schluckFaktor;
  return (
    <p className="pk-regelzeile" aria-label="Regelsatz dieses Tisches">
      {modus ? (
        <span className="pk-regelchip" data-pk-modus={regeln.modus}>
          {modus}
        </span>
      ) : null}
      {runden !== undefined ? <span className="pk-regelchip">{runden} Runden</span> : null}
      <span className="pk-regelchip" title={spieleTitel}>
        {spiele}
      </span>
      <span className="pk-regelchip">
        Härte {haerte === null ? 'steigt' : (HAERTE_NAME[haerte] ?? haerte)}
      </span>
      <span className="pk-regelchip" data-alkoholfrei={regeln.trinkmodus ? undefined : ''}>
        {regeln.trinkmodus ? 'Trinkmodus' : 'alkoholfrei'}
      </span>
      {hinweis ? <span className="pk-regelhinweis">{hinweis}</span> : null}
    </p>
  );
}

/**
 * Der Regelsatz fuer den Wartesaal, per Kontext statt als Prop.
 *
 * Der Grund ist die Baustelle vom 22.09.2026: Am Wartesaal-Block in
 * `screens/Partykiste.tsx` arbeitete gleichzeitig eine zweite Hand (Einladung).
 * Eine einzelne JSX-Zeile laesst sich zusammenfuehren, eine geaenderte
 * Signatur samt Aufrufer nicht — also bekommt die Lobby EINE Zeile
 * (`<LobbyRegelzeile />`), und der Bildschirm reicht den Regelsatz aussen
 * herum. `null` heisst "noch nicht geladen": Dann steht nichts da, keine
 * Vorgabe, die wie die Wahrheit aussaehe.
 */
export const RegelsatzKontext = createContext<{ regeln: PartyRegelsatz | null; runden: number } | null>(null);

export function LobbyRegelzeile(): React.JSX.Element | null {
  const stand = useContext(RegelsatzKontext);
  if (!stand || !stand.regeln) return null;
  return <Regelzeile regeln={stand.regeln} runden={stand.runden} />;
}
