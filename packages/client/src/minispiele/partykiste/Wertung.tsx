/**
 * Abrechnung einer Runde und die Turniertabelle.
 *
 * Beides stand bis zum 22.09.2026 im Bildschirm (`screens/Partykiste.tsx`)
 * und war damit fuer den Schaukasten unsichtbar — genau die zwei Ansichten,
 * an denen der Trinkmodus etwas aendert. Hier liegen sie neben den
 * Minispiel-Ansichten, und der Schaukasten zeigt beide in beiden Fassungen.
 *
 * Der Zaehler heisst "Schluck" oder "Strafpunkt" (`zaehlerWort`), nie 🍺:
 * Robins Entscheidung P2 vom selben Tag. Ausgeblendet wird NICHTS mehr —
 * gezaehlt wird in beiden Modi, also wird auch in beiden gezeigt.
 */

import type { SeatInfo } from '../../protocol';
import { Wartet, namenFuer } from './Runden';
import { zaehlerWort, type PartyAktion, type PartykisteSicht } from './sicht';

/**
 * Was diese Runde gebracht hat — und der Weiter-Knopf.
 *
 * Er ist Pflicht, keine Abkürzung: Es geht erst weiter, wenn JEDER Anwesende
 * getippt hat. Bis zum 19.09.2026 lief daneben eine Schaupause von zwölf
 * Sekunden — zu zwölft war sie vorbei, bevor die Hälfte gelesen hatte, wer
 * trinkt. Wer wegbleibt, fällt nach der Zugzeit (fünf Minuten) an den Bot,
 * der für ihn tippt. Keine eigene Uhr im Client — sie liefe der echten davon.
 */
export function Abrechnung({
  sicht,
  sitze,
  binFertig,
  sende,
}: {
  sicht: PartykisteSicht;
  sitze: SeatInfo[];
  binFertig: boolean;
  sende: (aktion: PartyAktion) => void;
}): React.JSX.Element {
  const punkte = sicht.rundenPunkte ?? [];
  const schlucke = sicht.rundenSchlucke ?? [];
  const meinePunkte = punkte[sicht.sitz] ?? 0;
  const meineSchlucke = schlucke[sicht.sitz] ?? 0;

  return (
    <div className="pk-abrechnung">
      <p className="pk-ausbeute">
        <span data-gut={meinePunkte > 0 ? '' : undefined}>
          {meinePunkte > 0 ? `+${meinePunkte} Punkte` : 'keine Punkte'}
        </span>
        {meineSchlucke > 0 ? (
          <span className="pk-schluck">
            {meineSchlucke} {zaehlerWort(sicht.trinkmodus, meineSchlucke)} für dich
          </span>
        ) : null}
      </p>
      <ul className="pk-liste is-schmal">
        {schlucke.map((zahl, sitz) =>
          zahl > 0 && !sicht.ausgestiegen.includes(sitz) ? (
            <li key={sitz}>
              <span>{namenFuer(sitze, sitz)}</span>
              <span className="pk-schluck">
                {zahl} {zaehlerWort(sicht.trinkmodus, zahl)}
              </span>
            </li>
          ) : null,
        )}
      </ul>
      <div className="pk-wahl">
        <button
          type="button"
          className="pk-knopf is-haupt"
          disabled={binFertig}
          onClick={() => sende({ art: 'bereit' })}
        >
          {binFertig ? 'Warten auf die anderen …' : 'Weiter'}
        </button>
      </div>
      {/* Es geht erst weiter, wenn ALLE getippt haben — keine Uhr mehr.
          Die Zahl sagt, auf wen die Runde wartet. */}
      {binFertig ? <Wartet sicht={sicht} /> : null}
    </div>
  );
}

/** Der Turnierstand. Punkte entscheiden, der Zaehler steht nur daneben. */
export function Tabelle({ sicht, sitze }: { sicht: PartykisteSicht; sitze: SeatInfo[] }): React.JSX.Element {
  const reihen = [...sicht.tabelle].sort((a, b) => a.platz - b.platz || a.sitz - b.sitz);
  return (
    <ol className="pk-tabelle">
      {reihen.map((zeile) => (
        <li
          key={zeile.sitz}
          data-ich={zeile.sitz === sicht.sitz ? '' : undefined}
          data-weg={sicht.ausgestiegen.includes(zeile.sitz) ? '' : undefined}
        >
          <span className="pk-platz">{zeile.platz}</span>
          <span className="pk-tabellenname">{namenFuer(sitze, zeile.sitz)}</span>
          <span className="pk-schluck">
            {zeile.schlucke} {zaehlerWort(sicht.trinkmodus, zeile.schlucke)}
          </span>
          <strong className="pk-punkte">{zeile.punkte}</strong>
        </li>
      ))}
    </ol>
  );
}
