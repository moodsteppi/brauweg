import { useCallback, useEffect, useState } from 'react';
import { api, SLOTS, type Me, type RegalWare, type Shop, type Slot } from '../api';
import { cardImage, deckBack, decksFor } from '../decks';
import { t } from '../i18n';
import { PAKET_NAME } from '../minispiele/partykiste/wahl';
import { Pinguin } from '../pinguin';

/**
 * Der Reiter „Sammlung" im neuen Hub (Entwurf Fassung 4): nach Spielen
 * getrennt, nur der Pinguin gilt für alle.
 *
 * Ein eigenes Blatt wird mit einem Tipp gewählt, ein fremdes nach Rückfrage
 * gekauft (DESIGN.md: jeder Kauf hat eine Rückfrage). Rückseite, Tisch und die
 * große Vorschau stehen hinter „Alles ›" in der bisherigen Auswahl, damit
 * nichts verloren geht, bis auch die neu gestaltet ist.
 */

const SLOT_NAME: Record<Slot, string> = {
  hut: 'Kopf',
  brille: 'Augen',
  oberteil: 'Oberteil',
  schuhe: 'Schuhe',
  hand: 'Flosse',
  aura: 'Aura',
};
const SLOT_ICON: Record<Slot, React.JSX.Element> = {
  hut: <path d="M5 14c0-4 3-8 7-8s7 4 7 8M3 14h18v3H3z" />,
  brille: (
    <>
      <circle cx="7.5" cy="12" r="3.5" />
      <circle cx="16.5" cy="12" r="3.5" />
      <path d="M11 12h2" />
    </>
  ),
  oberteil: <path d="M8 4l-5 4 3 3 2-1v10h8V10l2 1 3-3-5-4c-1 2-5 2-6 0z" />,
  schuhe: <path d="M4 16V8h5v5l9 1c2 0 3 1 3 2v2H4z" />,
  hand: <path d="M6 20c0-8 4-14 12-16-2 6-2 10 0 16z" />,
  aura: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
};

/** Spiele mit Kartenblättern, in dieser Reihenfolge. */
const BLATT_SPIELE = ['doppelkopf', 'skat', 'wizard'] as const;
/** Schlichte, freie Grundblätter; sie stehen unter „Alles ›". */
const GRUNDBLAETTER = new Set(['minimal2', 'minimal4']);
/** Themenpakete der Partykiste, die jeder hat (FAKTENBLATT.md, Abschnitt 6). */
const FREIE_PAKETE = ['wg-abend', 'studenten', 'arbeit'];

function Symbol({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Schloss(): React.JSX.Element {
  return (
    <span className="hb-ding-schloss" aria-hidden="true">
      <Symbol>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </Symbol>
    </span>
  );
}

export function SammlungNeu({
  me,
  onThemeChange,
  onGekauft,
  onSchrank,
  onWerkstatt,
  details,
}: {
  me: Me;
  onThemeChange: (gameId: string, teil: { cardDeck?: string }) => void;
  /** Nach einem Kauf Guthaben neu laden. */
  onGekauft: () => void;
  onSchrank: () => void;
  onWerkstatt: () => void;
  /** Die bisherige, vollständige Auswahl (Blatt, Rückseite, Tisch, Vorschau) für ein Spiel. */
  details: (gameId: string, zurueck: () => void) => React.ReactNode;
}): React.JSX.Element {
  const [shop, setShop] = useState<Shop | null>(null);
  const [filter, setFilter] = useState('alle');
  const [offen, setOffen] = useState<string | null>(null);
  const [kauft, setKauft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    void api
      .shop()
      .then(setShop)
      .catch(() => setShop(null));
  }, []);
  useEffect(laden, [laden]);

  if (offen) return <>{details(offen, () => setOffen(null))}</>;

  const ware = (art: RegalWare['art'], wert: string): RegalWare | undefined =>
    shop?.tischware.find((w) => w.art === art && w.wert === wert);
  const hat = (art: RegalWare['art'], wert: string): boolean => ware(art, wert)?.besessen ?? true;

  const kaufen = (w: RegalWare, name: string, danach: () => void): void => {
    if (!window.confirm(`„${name}" für ${w.preis.coins.toLocaleString('de-DE')} Münzen kaufen?`)) return;
    setKauft(w.id);
    setFehler(null);
    void api
      .buyItem(w.id, 'coins')
      .then(() => {
        laden();
        onGekauft();
        danach();
      })
      .catch((e: unknown) =>
        setFehler((e as { code?: string })?.code === 'coinsInsufficient' ? 'Dafür fehlen dir Münzen.' : 'Der Kauf hat nicht geklappt.'),
      )
      .finally(() => setKauft(null));
  };

  const teile = shop?.regale.flatMap((r) => r.stuecke) ?? [];
  const tische = shop?.tischware.filter((w) => w.art === 'szene') ?? [];
  const zeige = (id: string): boolean => filter === 'alle' || filter === id;
  const chips = [
    { id: 'alle', titel: 'Alle' },
    { id: 'pinguin', titel: 'Pinguin' },
    ...BLATT_SPIELE.map((id) => ({ id, titel: t(`game.${id}`) })),
    { id: 'partykiste', titel: t('game.partykiste') },
  ];

  return (
    <div className="hb-spiele">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">Sammlung</h1>
      </header>
      <div className="hb-chips" role="tablist" aria-label="Bereiche">
        {chips.map((c) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            key={c.id}
            className={`hb-chip${filter === c.id ? ' is-an' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.titel}
          </button>
        ))}
      </div>

      <div className="hb-spiele-rolle">
        {fehler && <p className="hb-fehler">{fehler}</p>}

        {zeige('pinguin') && (
          <div className="hb-held hb-pinguin-held">
            <button type="button" className="hb-ph-figur" onClick={onSchrank} aria-label="Kleiderschrank öffnen">
              <Pinguin getragen={me.avatar} groesse={8.4} />
            </button>
            <div className="hb-ph-text">
              <span className="hb-label">Dein Pinguin · für alle Spiele</span>
              <strong>
                {shop ? `${teile.filter((s) => s.besessen).length} von ${teile.length} Teilen` : 'Dein Pinguin'}
              </strong>
              <div className="hb-plaetze">
                {SLOTS.map((slot) => {
                  const traegt = me.avatar[slot];
                  return (
                    <button
                      type="button"
                      key={slot}
                      className={`hb-platz${traegt ? ' is-an' : ''}`}
                      onClick={onSchrank}
                      aria-label={`${SLOT_NAME[slot]}${traegt ? `: ${t(`kosmetik.${traegt}`)}` : ', leer'}`}
                    >
                      <Symbol>{SLOT_ICON[slot]}</Symbol>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="hb-kn is-gold" onClick={onWerkstatt}>
                <Symbol>
                  <path d="M14 4l6 6-8 8H6v-6z M12 6l6 6" />
                </Symbol>
                Bemalen
              </button>
            </div>
          </div>
        )}

        {BLATT_SPIELE.filter(zeige).map((spiel) => {
          const blaetter = decksFor(spiel).filter((d) => d.id !== 'text');
          const aktiv = me.themes[spiel]?.cardDeck ?? 'text';
          // Die schlichten Grundblätter stehen unter „Alles", hier nur, wenn eines aktiv ist.
          const gezeigt = blaetter.filter((d) => !GRUNDBLAETTER.has(d.id) || d.id === aktiv);
          const eigene = blaetter.filter((d) => hat('blatt', d.id)).length;
          // Aktives zuerst, dann eigene, dann der Rest nach Preis.
          const reihe = [...gezeigt].sort((a, b) => {
            const wert = (id: string): number => (id === aktiv ? 0 : hat('blatt', id) ? 1 : 2);
            return wert(a.id) - wert(b.id) || (ware('blatt', a.id)?.preis.coins ?? 0) - (ware('blatt', b.id)?.preis.coins ?? 0);
          });
          return (
            <section className="hb-blk" key={spiel}>
              <h2 className="hb-ab">
                {t(`game.${spiel}`)}
                <span className="hb-ab-zusatz">
                  Blätter {eigene} von {blaetter.length}
                  {spiel !== 'wizard' && tische.length > 0 ? ` · Tische ${tische.filter((w) => w.besessen).length} von ${tische.length}` : ''}
                </span>
              </h2>
              <div className="hb-reihe">
                {reihe.map((deck) => {
                  const w = ware('blatt', deck.id);
                  const mein = hat('blatt', deck.id);
                  const bild = cardImage(deck, { suit: 'H', rank: 'Q' }) ?? deckBack(deck);
                  return (
                    <button
                      type="button"
                      key={deck.id}
                      className={`hb-ding${deck.id === aktiv ? ' is-aktiv' : ''}${mein ? '' : ' is-zu'}`}
                      disabled={kauft === w?.id}
                      aria-pressed={deck.id === aktiv}
                      onClick={() => {
                        if (mein) onThemeChange(spiel, { cardDeck: deck.id });
                        else if (w) kaufen(w, t(deck.nameKey), () => onThemeChange(spiel, { cardDeck: deck.id }));
                      }}
                    >
                      <span className="hb-ding-bild is-blatt" style={bild ? { backgroundImage: `url(${bild})` } : undefined}>
                        {deck.id === aktiv && (
                          <span className="hb-ding-ok" aria-hidden="true">
                            ✓
                          </span>
                        )}
                        {!mein && <Schloss />}
                      </span>
                      <strong>{t(deck.nameKey)}</strong>
                      <small>
                        {deck.id === aktiv ? 'aktiv' : mein ? 'gehört dir' : `${(w?.preis.coins ?? 0).toLocaleString('de-DE')} Münzen`}
                      </small>
                    </button>
                  );
                })}
                <button type="button" className="hb-ding hb-ding-mehr" onClick={() => setOffen(spiel)}>
                  <span className="hb-ding-bild">
                    <Symbol>
                      <path d="M9 5l7 7-7 7" />
                    </Symbol>
                  </span>
                  <strong>Alles</strong>
                  <small>Rückseite, Tisch, Vorschau</small>
                </button>
              </div>
            </section>
          );
        })}

        {zeige('partykiste') && (
          <section className="hb-blk">
            <h2 className="hb-ab">
              {t('game.partykiste')}
              <span className="hb-ab-zusatz">
                Themenpakete{' '}
                {FREIE_PAKETE.length +
                  (shop?.tischware.filter((w) => w.inhalt?.spiel === 'partykiste' && w.besessen).length ?? 0)}{' '}
                von {Object.keys(PAKET_NAME).length}
              </span>
            </h2>
            <div className="hb-reihe">
              {Object.entries(PAKET_NAME)
                .sort(([a], [b]) => Number(!FREIE_PAKETE.includes(a)) - Number(!FREIE_PAKETE.includes(b)))
                .map(([id, name]) => {
                  const w = shop?.tischware.find((x) => x.inhalt?.spiel === 'partykiste' && x.wert === id);
                  const mein = FREIE_PAKETE.includes(id) || (w?.besessen ?? false);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`hb-ding${mein ? '' : ' is-zu'}`}
                      disabled={mein || kauft === w?.id}
                      onClick={() => w && !mein && kaufen(w, `Partykiste: ${name}`, () => undefined)}
                    >
                      <span className="hb-ding-bild" style={{ backgroundImage: `url(/hub/paket-${id}.webp)` }}>
                        {mein ? (
                          <span className="hb-ding-ok is-gruen" aria-hidden="true">
                            ✓
                          </span>
                        ) : (
                          <Schloss />
                        )}
                      </span>
                      <strong>{name}</strong>
                      <small>
                        {FREIE_PAKETE.includes(id) ? 'frei' : mein ? 'gehört dir' : `${(w?.preis.coins ?? 0).toLocaleString('de-DE')} Münzen`}
                      </small>
                    </button>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
