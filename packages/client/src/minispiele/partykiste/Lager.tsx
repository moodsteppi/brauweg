/**
 * Team-Abend am Bildschirm: die Aufstellung vor der ersten Runde und die
 * Tabelle je Lager.
 *
 * Wie ueberall in der Kiste bildet diese Datei keine Regel nach. Wer
 * aufstellt und wen er gerade verschieben darf, steht in der Sicht
 * (`aufstellung.wechselbar`) — die Regel "kein Lager ohne Anwesenden" lebt
 * nur im Modul. Wer vorn liegt, steht in `lagerTabelle`, auch der Platz.
 */

import type { SeatInfo } from '../../protocol';
import { lagerName } from './modi';
import { Regelzeile } from './Regelzeile';
import { namenFuer } from './Runden';
import { zaehlerWort, type PartyAktion, type PartykisteSicht } from './sicht';

/**
 * Die Aufstellung: zwei Spalten, eine je Lager. Der Tischoeffner tippt einen
 * Namen an und setzt ihn damit hinueber, "Los geht's" beendet die
 * Aufstellung. Alle anderen sehen dieselben Spalten und warten.
 *
 * Eine ganze Seite und keine Runde: Die erste Runde steht im Modul zwar
 * schon bereit, nimmt aber keine Aktion an, bis die Lager stehen — ihre
 * Reihenfolge haengt an ihnen.
 */
export function AufstellungSeite({
  sicht,
  sitze,
  sende,
  onVerlassen,
}: {
  sicht: PartykisteSicht;
  sitze: SeatInfo[];
  sende: (aktion: PartyAktion) => void;
  onVerlassen?: () => void;
}): React.JSX.Element | null {
  const aufstellung = sicht.aufstellung;
  const lager = sicht.lager;
  if (!aufstellung || !lager) return null;
  const ichStelleAuf = sicht.sitz === aufstellung.aufsteller;

  return (
    <main className="pk-seite pk-tisch" data-pk-aufstellung="">
      <header className="pk-kopf">
        {onVerlassen ? (
          <button className="pk-zurueck is-klein" type="button" onClick={onVerlassen} aria-label="Verlassen">
            ←
          </button>
        ) : null}
        <span className="pk-rundenzahl">Vor Runde 1</span>
        <strong className="pk-spielname">Lager aufstellen</strong>
      </header>
      <Regelzeile regeln={sicht} />
      <p className="pk-ansage">
        {ichStelleAuf
          ? 'Tippe auf einen Namen, um ihn ins andere Lager zu setzen.'
          : `${namenFuer(sitze, aufstellung.aufsteller)} stellt die Lager auf …`}
      </p>
      <div className="pk-lagerspalten">
        {[0, 1].map((welches) => (
          <section key={welches} className="pk-lagerspalte" data-lager={welches} aria-label={lagerName(welches)}>
            <h3 className="pk-lagertitel">{lagerName(welches)}</h3>
            <ul>
              {lager.map((l, sitz) =>
                l === welches ? (
                  <li key={sitz} data-ich={sitz === sicht.sitz ? '' : undefined} data-weg={sicht.ausgestiegen.includes(sitz) ? '' : undefined}>
                    {ichStelleAuf ? (
                      <button
                        type="button"
                        className="pk-person"
                        data-pk-lagerwechsel={sitz}
                        disabled={!aufstellung.wechselbar.includes(sitz)}
                        onClick={() => sende({ art: 'lagerwechsel', sitz })}
                      >
                        {namenFuer(sitze, sitz)}
                      </button>
                    ) : (
                      <span className="pk-person is-still">{namenFuer(sitze, sitz)}</span>
                    )}
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ))}
      </div>
      {ichStelleAuf ? (
        <div className="pk-wahl">
          <button className="pk-knopf is-haupt" type="button" data-pk-lager-los="" onClick={() => sende({ art: 'bereit' })}>
            Los geht’s
          </button>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Die Tabelle je Lager — im Stand und als Endtafel. Steht ueber der Tabelle
 * je Person (`Tabelle` in Wertung.tsx haengt sie ein) und zeichnet ohne
 * Lager nichts.
 */
export function LagerTabelle({ sicht, sitze }: { sicht: PartykisteSicht; sitze: SeatInfo[] }): React.JSX.Element | null {
  const tabelle = sicht.lagerTabelle;
  if (!tabelle) return null;
  const reihen = [...tabelle].sort((a, b) => a.platz - b.platz || a.lager - b.lager);
  const ungleich = tabelle.length === 2 && tabelle[0]!.sitze.length !== tabelle[1]!.sitze.length;
  return (
    <div className="pk-lagertafel">
      <ol className="pk-tabelle pk-lagertabelle" aria-label="Stand der Lager">
        {reihen.map((zeile) => (
          <li
            key={zeile.lager}
            data-lager={zeile.lager}
            data-ich={zeile.sitze.includes(sicht.sitz) ? '' : undefined}
          >
            <span className="pk-platz">{zeile.platz}</span>
            <span className="pk-tabellenname">
              {lagerName(zeile.lager)}
              <small className="pk-lagerleute">{zeile.sitze.map((s) => namenFuer(sitze, s)).join(', ')}</small>
            </span>
            <span className="pk-schluck">
              {zeile.schlucke} {zaehlerWort(sicht.trinkmodus, zeile.schlucke)}
            </span>
            <strong className="pk-punkte">{zeile.punkte}</strong>
          </li>
        ))}
      </ol>
      {ungleich ? <p className="pk-warten">Die Lager sind ungleich groß — es entscheidet der Schnitt je Kopf.</p> : null}
    </div>
  );
}
