import { Ladebildschirm } from './Ladebildschirm';
import { useVorladen } from './vorladen';

/**
 * Der Rueckfall fuer `<Suspense>`, solange das Spielpaket unterwegs ist.
 *
 * Bis zum 6.9.2026 stand hier der Lade-Pinguin des Clients („Einen Moment…"),
 * und danach kam der Ladebildschirm mit dem Balken noch einmal: zwei Vorhaenge
 * hintereinander fuer eine Wartezeit. Jetzt ist es derselbe Bildschirm, von
 * Anfang an und mit demselben Balken — der Wechsel vom Rueckfall zum
 * nachgeladenen Schirm ist fuer den Spieler nicht zu sehen, weil beide
 * denselben Lauf mitlesen (`useVorladen` haelt ihn modulweit, siehe
 * vorladen.ts).
 *
 * DIESES BAUTEIL LIEGT IM HAUPTPAKET, und zwar notwendigerweise: Ein Rueckfall,
 * der erst nachgeladen werden muss, ist kein Rueckfall. Teuer ist das nicht —
 * Ladebildschirm, `vorladen.ts` und `figuren.ts` sind zusammen wenige
 * Kilobyte, und die `tr-`Klassen des Aussehens stehen ohnehin in styles.css,
 * die jeder Besucher schon hat. Wer hier etwas aus dem Schirm dazunimmt, zieht
 * den Schirm ins Hauptpaket zurueck und hebt Teil 1 auf.
 *
 * Angestossen wird der Lauf von `useVorladen` — also erst, wenn dieser
 * Rueckfall wirklich zu sehen ist. `lazy()` in App.tsx hat das Paket zu
 * diesem Zeitpunkt schon angefragt; der Posten haengt sich an dieselbe
 * Anfrage (paket.ts).
 */
export function Ladevorhang({
  onAbbrechen,
}: {
  /** Zurueck ins Menue. Ohne Rueckweg waere der Vorhang eine Sackgasse. */
  onAbbrechen?: () => void;
}): React.JSX.Element {
  return <Ladebildschirm stand={useVorladen()} onAbbrechen={onAbbrechen} />;
}
