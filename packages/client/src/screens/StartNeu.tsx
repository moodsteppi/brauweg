import type { ActiveTable, Me } from '../api';
import { t } from '../i18n';
import { BIOME } from './Pfad';

/**
 * Der Start im neuen Hub (Entwurf „Nachtblau & Gold", Fassung 4 vom 26.09.2026).
 *
 * Eine Viewport-Höhe, wie DESIGN.md es für Hub-Seiten verlangt: der
 * Trophäenweg als Held, darunter „Weiterspielen", die eigenen Spiele und der
 * Knopf „Heute", hinter dem Aufgaben und Truhen als Blatt liegen. Maße und
 * Farben kommen 1:1 aus dem Bauplan (`hub-neu.css`), damit die Seite aussieht
 * wie der Entwurf und nicht wie eine Nacherzählung davon.
 */

/** Banner je Spiel. Drei Spiele heißen im Bild anders als im Code. */
export function bannerFuer(gameId: string): string {
  const name: Record<string, string> = { wizard: 'zauberer', easypoker: 'poker', golf: 'minigolf' };
  return `/hub/banner-${name[gameId] ?? gameId}.webp`;
}

/** Die Trophäenweg-Kacheln des neuen Hubs, gleiche Reihenfolge wie `BIOME`. */
export function wegBild(datei: string): string {
  return `/hub/weg-${datei}.webp`;
}

/** Die höchste 100er-Marke, unter die man nicht mehr fällt (bis 1.000; danach 250er). */
export function sicherAb(trophies: number): number {
  if (trophies < 1000) return Math.floor(trophies / 100) * 100;
  return 1000 + Math.floor((trophies - 1000) / 250) * 250;
}

export function StartNeu({
  me,
  trophies,
  activeTable,
  bereit,
  wegBereit,
  onResume,
  onPick,
  onAlleSpiele,
  onHeute,
  onWeg,
}: {
  me: Me;
  trophies: number;
  activeTable: ActiveTable | null;
  /** Truhen und Aufgaben, die abgeholt werden können. */
  bereit: number;
  /** Belohnungen des Trophäenwegs, die abgeholt werden können (`me.bereit.weg`). */
  wegBereit: number;
  onResume: (gameId: string, tableId: string) => void;
  onPick: (gameId: string) => void;
  onAlleSpiele: () => void;
  onHeute: () => void;
  /** Öffnet den Trophäenweg als Vollbild. */
  onWeg: () => void;
}): React.JSX.Element {
  const stufe = [...BIOME].reverse().find((b) => trophies >= b.cp) ?? BIOME[0]!;
  const naechstes = BIOME.find((b) => b.cp > trophies) ?? null;
  const anteil = naechstes
    ? Math.min(1, Math.max(0, (trophies - stufe.cp) / (naechstes.cp - stufe.cp)))
    : 1;
  const eigene = [...me.stats]
    .filter((s) => s.parties > 0 || s.trophies > 0)
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, 6);

  return (
    <div className="hb-start">
      <button
        type="button"
        className="hb-held hb-weg"
        style={{ backgroundImage: `url(${wegBild(stufe.datei)})` }}
        onClick={onWeg}
        aria-label={`Trophäenweg öffnen. Du bist in ${stufe.name} mit ${trophies} Trophäen.${
          wegBereit > 0 ? ` ${belohnungen(wegBereit)} bereit.` : ''
        }`}
      >
        <img className="hb-weg-marke" src="/hub/pinguin-marke.webp" alt="" />
        {wegBereit > 0 && (
          // Nur fürs Auge; der Vorlesetext steht im Namen des Knopfes
          // (DESIGN.md, Bereitschaftspunkt: nicht als aria-label am Kind).
          <span className="hb-weg-bereit" aria-hidden="true">
            {belohnungen(wegBereit)}
          </span>
        )}
        <span className="hb-held-unten">
          <span className="hb-label">Dein Trophäenweg · alle Spiele</span>
          <strong className="hb-weg-biom">{stufe.name}</strong>
          <span className="hb-weg-zeile">
            <span className="hb-pk">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {trophies.toLocaleString('de-DE')}
            </span>
            {naechstes ? (
              <span>
                von {naechstes.cp.toLocaleString('de-DE')} bis {naechstes.name === 'Sternenhafen' ? 'zum' : 'nach'}{' '}
                {naechstes.name}
              </span>
            ) : (
              <span>am Ziel des Weges</span>
            )}
          </span>
          <span className="hb-balken" aria-hidden="true">
            <span style={{ width: `${Math.round(anteil * 100)}%` }} />
          </span>
          {trophies >= 100 && (
            <span className="hb-weg-sicher">
              <Haken />
              Sicher ab {sicherAb(trophies).toLocaleString('de-DE')}: darunter fällst du nicht mehr
            </span>
          )}
        </span>
      </button>

      {activeTable && (
        <button
          type="button"
          className="hb-weiter"
          onClick={() => onResume(activeTable.gameId, activeTable.tableId)}
        >
          <span className="hb-weiter-bild" style={{ backgroundImage: `url(${bannerFuer(activeTable.gameId)})` }} />
          <span className="hb-weiter-text">
            <span className="hb-label">Weiterspielen</span>
            <strong>{t(`game.${activeTable.gameId}`)}</strong>
            <span>
              {activeTable.paused
                ? 'Pausiert · zurück an den Tisch'
                : activeTable.status === 'waiting'
                  ? 'Wartet auf Mitspieler'
                  : 'Läuft · zurück an den Tisch'}
            </span>
          </span>
          <span className="hb-weiter-los" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      <section className="hb-blk">
        <h2 className="hb-ab">
          Deine Spiele
          <button type="button" className="hb-ab-mehr" onClick={onAlleSpiele}>
            Alle ›
          </button>
        </h2>
        <div className="hb-reihe">
          {eigene.length === 0 ? (
            <button type="button" className="hb-leer" onClick={onAlleSpiele}>
              Noch keine Partie gespielt. Such dir ein Spiel aus.
            </button>
          ) : (
            eigene.map((s) => (
              <button type="button" className="hb-sk" key={s.gameId} onClick={() => onPick(s.gameId)}>
                <span className="hb-sk-bild" style={{ backgroundImage: `url(${bannerFuer(s.gameId)})` }} />
                <strong>{t(`game.${s.gameId}`)}</strong>
                <span className="hb-pk">
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {s.trophies.toLocaleString('de-DE')}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <button
        type="button"
        className="hb-heute"
        onClick={onHeute}
        aria-label={bereit > 0 ? `Heute: Aufgaben und Truhen, ${bereit} bereit` : 'Heute: Aufgaben und Truhen'}
      >
        <img src="/hub/truhe-holz.webp" alt="" />
        <span className="hb-heute-text">
          <strong>Heute</strong>
          <span>Tagesaufgaben und Truhen</span>
        </span>
        {bereit > 0 && (
          <span className="hb-heute-bereit" aria-hidden="true">
            {bereit} bereit
          </span>
        )}
        <span className="hb-pf" aria-hidden="true">
          ›
        </span>
      </button>

    </div>
  );
}

/** „1 Belohnung", „2 Belohnungen". */
function belohnungen(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Belohnung' : 'Belohnungen'}`;
}

export function Haken(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
