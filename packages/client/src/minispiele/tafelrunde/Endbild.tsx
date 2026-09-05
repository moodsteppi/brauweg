/**
 * Das Endbild von Tafelrunde — was man sieht, wenn man ausscheidet oder
 * gewinnt.
 *
 * Vorher stand an dieser Stelle eine Zeile im Ladenbereich („Gewonnen!",
 * Rundenzahl, Zurück). Damit fehlte gerade das, was eine Partie abschließt:
 * die eigene Platzierung im Feld, die Aufstellung, mit der man angetreten
 * ist, und ein Moment, in dem der Bildschirm den Sieg auch als solchen
 * behandelt.
 *
 * ES IST EIN ÜBERBLENDER UND KEIN NEUER BILDSCHIRM. Der Tisch bleibt
 * darunter stehen, und wer ausgeschieden ist, kann ihn mit „Weiter zusehen"
 * zurückholen — Zuschauen ist bei einem Auto-Battler kein Trostpreis,
 * sondern die Fortsetzung: Man sieht, gegen wen man verloren hätte.
 *
 * Der Ton folgt dem Startbildschirm der Plattform (DESIGN.md): Gold auf
 * dunklem Grund, ruhige Bewegung, kein Konfettiregen. Bei Platz 1 kommt ein
 * langsamer Schein hinter dem Kranz dazu und sonst nichts — „darf feiern, im
 * Ton des Startbildschirms, nicht bunter".
 *
 * Alle Zahlen kommen aus der Sicht. Die einzige Rechnung ist die
 * Platzierung; sie steht in platzierung.ts und ist dort begründet (die Sicht
 * liefert nur `sieger`, nicht den Platz).
 */

import { type Einheitenbild, Figurbild } from './KampfAnzeige';
import { type Sitzstand, eigenerPlatz, platzTabelle } from './platzierung';
import { type Sitzzeile, sitzname } from './Mitspieler';
import stil from './Endbild.module.css';

/** Eine Einheit auf dem Brett — dieselbe Form wie `Kaempfer` in zuege.ts. */
export interface Aufsteller {
  id: string;
  stufe: number;
}

/**
 * Der Satz über der Platzierung.
 *
 * Drei Ausgänge, und der dritte ist keiner: `sieger === null` heißt bei
 * dieser Partie nicht „niemand hat gewonnen", sondern „zwei Sitze teilen sich
 * Platz 1" (siehe `sieger` in partie.ts). Deshalb hängt der Satz am eigenen
 * PLATZ und nicht am Siegersitz — sonst läse jemand mit Platz 1 im
 * Gleichstand „Verloren".
 */
export function abschlusswort(platz: number | null, geteilt: boolean): string {
  if (platz === null) return 'Partie beendet';
  if (platz === 1) return geteilt ? 'Geteilter Sieg' : 'Gewonnen!';
  if (platz === 2) return 'Knapp vorbei';
  return 'Ausgeschieden';
}

/** „Platz 3 von 8" — ausgeschrieben, weil „3/8" nach einem Bruch aussieht. */
export function platzsatz(platz: number | null, von: number): string {
  if (platz === null) return `${von} Spieler am Tisch`;
  return `Platz ${platz} von ${von}`;
}

/**
 * Die überstandenen Runden.
 *
 * Wer ausgeschieden ist, hat seine `ausRunde` NICHT überstanden — in ihr ist
 * er gefallen. Wer bis zum Schluss stand, hat die laufende Runde voll
 * mitgespielt. Genau diese Unterscheidung macht das Modul in
 * `platzierungen` (points = ausRunde ?? runde), hier steht sie als Satz.
 */
export function rundensatz(ausRunde: number | null, runde: number): string {
  const gestanden = ausRunde ?? runde;
  const zahl = gestanden === 1 ? '1 Runde' : `${gestanden} Runden`;
  return ausRunde === null ? `${zahl} durchgestanden` : `${zahl} überstanden`;
}

export function Endbild({
  sitz,
  brett,
  katalog,
  eigenes,
  gegner,
  runde,
  fertig,
  sitze,
  onZurueck,
  onZusehen,
}: {
  /** Der eigene Sitz. Ohne ihn gibt es kein Endbild — Zuschauer sehen keins. */
  sitz: number;
  /** Die eigene Aufstellung, so wie sie zuletzt stand. */
  brett: readonly (Aufsteller | null)[];
  /* `Einheitenbild` fuehrt die Rolle inzwischen selbst (KampfAnzeige.tsx):
     Sie entscheidet dort, welches 3D-Blatt eine Figur spielt. Das Endbild
     braucht sie nicht, nimmt sie aber mit — ein zweiter Katalogtyp waere die
     Stelle, an der beim naechsten Feld nachgezogen werden muesste. */
  katalog: Record<string, Einheitenbild>;
  eigenes: Sitzstand;
  gegner: readonly Sitzstand[];
  runde: number;
  /** Ist die ganze Partie vorbei, oder bin nur ich raus? */
  fertig: boolean;
  sitze: readonly Sitzzeile[];
  onZurueck: () => void;
  /**
   * Den Überblender wegklicken und weiter zusehen. Fehlt, wenn es nichts mehr
   * zu sehen gibt — dann bleibt nur der Weg zurück.
   */
  onZusehen?: () => void;
}): React.JSX.Element {
  const tabelle = platzTabelle([eigenes, ...gegner], runde);
  const meiner = eigenerPlatz(tabelle, sitz);
  const platz = meiner?.platz ?? null;
  const geteilt = platz !== null && tabelle.filter((p) => p.platz === platz).length > 1;
  const gesiegt = platz === 1;

  const aufstellung = brett
    .map((k, feld) => ({ k, feld }))
    .filter((e): e is { k: Aufsteller; feld: number } => e.k !== null);

  return (
    <div
      className={stil.ueberblender}
      role="dialog"
      aria-modal="true"
      aria-label={fertig ? 'Partie beendet' : 'Ausgeschieden'}
    >
      <div className={stil.tafel} data-sieg={gesiegt ? '' : undefined}>
        {/* Der Kranz: bei Platz 1 mit Schein, sonst schlicht. Gezeichnet und
            nicht geladen — ein `<img>` auf eine Datei, die es nicht gibt,
            wäre ein weißer Kasten (CLAUDE.md). */}
        <div className={stil.kranz} aria-hidden="true">
          {gesiegt && <span className={stil.schein} />}
          <svg viewBox="0 0 48 48" className={stil.kranzbild}>
            <path d="M24 6 27.7 17.3H39.6L30 24.3 33.7 35.6 24 28.6 14.3 35.6 18 24.3 8.4 17.3H20.3Z" />
          </svg>
          <strong className={stil.platzzahl}>{platz ?? '–'}</strong>
        </div>

        <h2 className={stil.wort}>{abschlusswort(platz, geteilt)}</h2>
        <p className={stil.unterzeile}>
          {platzsatz(platz, tabelle.length)} · {rundensatz(eigenes.ausRunde, runde)}
        </p>

        {/* Wer gewonnen hat, wenn nicht ich. Ohne diese Zeile endet die Partie
            mit „Ausgeschieden" und ohne Antwort auf die erste Frage danach. */}
        {fertig && !gesiegt && <p className={stil.sieger}>{siegerzeile(tabelle, sitze)}</p>}

        <h3 className={stil.titel}>Deine letzte Aufstellung</h3>
        {aufstellung.length === 0 ? (
          <p className={stil.leer}>Am Ende stand kein Recke mehr auf dem Feld.</p>
        ) : (
          <ul className={stil.aufstellung}>
            {aufstellung.map(({ k, feld }) => {
              const einheit = katalog[k.id];
              return (
                <li key={feld} className={stil.recke}>
                  <span className={stil.figur}>
                    {einheit ? (
                      <Figurbild
                        einheit={einheit}
                        klasse={stil.figurbild}
                        /* Ohne Bild bleibt der Anfangsbuchstabe stehen — ein
                           leerer Kasten sähe nach Fehler aus, ein Buchstabe
                           nach Absicht (CLAUDE.md). */
                        ersatz={<span className={stil.ersatz}>{einheit.name.slice(0, 1)}</span>}
                      />
                    ) : (
                      <span className={stil.ersatz}>?</span>
                    )}
                  </span>
                  <span className={stil.reckenname}>{einheit?.name ?? k.id}</span>
                  <span className={stil.sterne} aria-label={`Stufe ${k.stufe}`}>
                    {'★'.repeat(k.stufe)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className={stil.knoepfe}>
          <button type="button" className={stil.hauptknopf} onClick={onZurueck}>
            Zur Spielauswahl
          </button>
          {onZusehen && (
            <button type="button" className={stil.nebenknopf} onClick={onZusehen}>
              Weiter zusehen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * „Gewonnen hat Robin" — oder bei geteiltem Platz 1 alle Namen.
 *
 * Aus der PLATZTABELLE und nicht aus `sicht.sieger`: Das Feld ist bei einem
 * Gleichstand null (siehe partie.ts), und dann stünde hier gar nichts,
 * obwohl es zwei Sieger gibt.
 */
export function siegerzeile(
  tabelle: readonly { sitz: number; platz: number }[],
  sitze: readonly Sitzzeile[],
): string {
  const erste = tabelle.filter((p) => p.platz === 1);
  if (erste.length === 0) return '';
  const namen = erste.map((p) =>
    sitzname(
      sitze.find((s) => s.seat === p.sitz),
      p.sitz,
    ),
  );
  return erste.length === 1
    ? `Gewonnen hat ${namen[0]}.`
    : `Geteilter Sieg: ${namen.join(' und ')}.`;
}
