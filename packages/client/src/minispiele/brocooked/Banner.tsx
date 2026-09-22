/**
 * Das Banner von BroCooked in der Spielauswahl: eine Küche, die sich selbst
 * bekocht.
 *
 * Dasselbe Motiv wie bei Golf, und aus demselben Grund: BroCookeds Kern liegt
 * im Client (`kueche.ts`, `bot.ts`, `zeichnen.ts`) und nicht in einem
 * Spielpaket — das Banner darf ihn deshalb einfach benutzen, statt ihn
 * abzuschreiben. Zwei Hilfsköche arbeiten eine kleine Schicht ab, mit
 * derselben Rechnung und demselben Zeichner wie in der Partie. Was hier läuft,
 * läuft im Spiel genauso.
 *
 * Für dieses Spiel gibt es noch kein gemaltes Banner (die Lieferung ist
 * bestellt, docs/ASSETS-BROCOOKED.md). Ohne eigenes Bild fiele
 * `spielBanner(game.id)` auf „kommt bald" zurück — ausgerechnet das Bild, das
 * sagt, man könne das Spiel nicht spielen. Ein `<img>` auf eine Datei, die es
 * noch nicht gibt, wäre der andere Fehler aus der CLAUDE.md.
 *
 * „Weniger Bewegung" heißt deshalb nicht „anderes Bild", sondern EIN Bild: Es
 * wird ein einziges Mal gezeichnet und danach nichts mehr — genau wie bei
 * GolfBanner. Bei verdecktem Tab passiert nichts.
 */

import { useEffect, useRef, useState } from 'react';

import { botEingabe } from './bot';
import { neueKueche, schritt, type Kueche } from './kueche';
import { kameraFuer, zeichne } from './zeichnen';

/**
 * Die Gartenküche, und das ist keine Geschmacksfrage: Sie ist die einzige der
 * vier Vorlagen, in der zwei Hilfsköche in einer Schicht auch wirklich etwas
 * ausliefern (gemessen, siehe Saat unten). In Kantine, Insel und Brandwache
 * kommen sie über das Schneiden nicht hinaus — ein Banner, in dem nie ein
 * Teller durch die Durchreiche geht, wäre Werbung gegen das Spiel.
 */
const PLAN = 'wiese';
/** Zwei Köche: In einer Küche für vier stünden zwei davon die meiste Zeit im Weg. */
const SITZE = 2;
const BOT_SITZE = [0, 1] as const;
/** Der Takt der Küche — dieselben 50 ms wie im Spiel (`kueche.ts`). */
const TAKT_MS = 50;
/** Eine Schicht im Banner: eine Minute, dann fängt sie von vorn an. */
const RUNDE_TAKTE = 1200;
/**
 * Feste Saat statt `Math.random` — auf jedem Gerät dieselbe Schicht.
 *
 * Und zwar GENAU diese, auch beim Neuaufsetzen: Mit zwei Hilfsköchen liefert
 * nur etwa jede zweite Saat überhaupt einen Teller aus (mit dieser hier: der
 * erste nach rund 20 Sekunden, zwei je Schicht). Eine hochgezählte Saat träfe
 * also regelmäßig eine Schicht, in der die beiden eine Minute lang nur
 * schnippeln. Dass sich die Schicht wiederholt, sieht an einer Kachel in der
 * Spielauswahl niemand.
 */
const SAAT = 20260923;
/**
 * So viele Takte holt ein Bild höchstens nach. Ohne Deckel rechnet die Küche
 * nach einem verdeckten Tab Minuten am Stück durch und hängt die Seite fest;
 * ein Sprung im Banner sieht dagegen niemand.
 */
const TAKTE_JE_BILD_MAX = 4;

function neueSchicht(): Kueche {
  return neueKueche({ plan: PLAN, saat: SAAT, sitze: SITZE, dauer: RUNDE_TAKTE });
}

export function BroCookedBanner(): React.JSX.Element {
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const leinwandRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (leinwand === null) return;

    let k = neueSchicht();
    let t0 = 0;
    let laeuft = true;
    let bild = 0;

    const male = (): void => {
      /*
       * Die Leinwand wird je Bild nachgemessen und nicht einmal beim Aufbau:
       * Die Kachel wächst mit der Spalte mit, und eine Leinwand, deren
       * Pufferbreite nicht zur angezeigten Breite passt, zeigt ein
       * verschmiertes Bild. Die Dichte wird bei 2 gedeckelt — darüber kostet
       * sie nur noch Pixel.
       */
      const dichte = Math.min(window.devicePixelRatio || 1, 2);
      const breite = Math.max(1, Math.round(leinwand.clientWidth * dichte));
      const hoehe = Math.max(1, Math.round(leinwand.clientHeight * dichte));
      if (leinwand.width !== breite || leinwand.height !== hoehe) {
        leinwand.width = breite;
        leinwand.height = hoehe;
      }
      const ctx = leinwand.getContext('2d');
      if (ctx === null) return;
      /*
       * Die ganze Küche ins Bild, auch wenn dabei links und rechts Grund frei
       * bleibt: Eine Küche ist ein geschlossener Raum. Wer sie auf 4:1
       * beschneidet, schneidet Theken und Kisten weg — und die Köche liefen im
       * Banner aus dem Bild heraus. Lieber Luft am Rand als eine halbe Küche.
       */
      const sicht = kameraFuer(k, breite, hoehe);
      // -1: niemand sieht zu, also kein heller Ring um einen der Köche.
      zeichne(ctx, k, sicht, -1, document.documentElement.dataset.thema !== 'hell');
    };

    const takt = (jetzt: number): void => {
      if (!laeuft) return;
      bild = requestAnimationFrame(takt);
      if (typeof document !== 'undefined' && document.hidden) return;
      if (t0 === 0) t0 = jetzt;
      const ziel = Math.floor((jetzt - t0) / TAKT_MS);
      let nachgeholt = 0;
      while (k.takt < ziel && nachgeholt < TAKTE_JE_BILD_MAX) {
        // Keine menschlichen Eingaben: beide Sitze gehören dem Hilfskoch.
        schritt(k, [], BOT_SITZE, botEingabe);
        nachgeholt += 1;
      }
      if (k.takt >= k.endTakt) {
        // Sonst stünde das Banner nach einer Minute still — und ein Standbild
        // sagt dasselbe wie „kommt bald".
        k = neueSchicht();
        t0 = jetzt;
      }
      male();
    };

    if (ruhig) {
      /*
       * Ein einziges Bild: die aufgestellte Küche vor dem ersten Ticket. Erst
       * im nächsten Bild und nicht sofort — beim Aufbau hat die Leinwand noch
       * keine Größe, und ein Bild in eine 0 × 0 große Fläche zu malen heißt,
       * dass danach nie wieder eines kommt.
       */
      bild = requestAnimationFrame(() => male());
      return () => cancelAnimationFrame(bild);
    }
    bild = requestAnimationFrame(takt);
    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
    };
  }, [ruhig]);

  /*
   * `gf-banner` ist die Klasse der bewegten Bannerfläche (styles.css:
   * `display:block`, volle Breite, 4:1 wie die gemalten Banner). Sie steht
   * unter Golf, beschreibt aber die Fläche und nicht das Spiel — und ohne feste
   * Form wäre die Leinwand null Pixel hoch und das Banner unsichtbar. Bekommt
   * BroCooked seinen eigenen Abschnitt in styles.css, gehört hier eine eigene
   * Klasse mit denselben drei Zeilen hin.
   */
  return <canvas className="gf-banner" ref={leinwandRef} aria-hidden="true" />;
}
