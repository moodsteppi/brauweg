/**
 * Clankrieg.
 *
 * Ein Bildschirm, vier Zustaende: kein Krieg, Suche laeuft, Herausforderung
 * offen, Krieg laeuft. Dazu das Ergebnis des letzten.
 *
 * Die Regel steht sichtbar auf dem Bildschirm und nicht in einer Hilfe:
 * Wer nicht weiss, wofuer es Punkte gibt, spielt nicht danach.
 */

import { useCallback, useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import { type ClubSummary, type WarState, type WarView, api } from '../api';
import { restzeit, t, zahl } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { mitFett } from './ClanTeile';
import { HbBlatt, Zurueck } from './HbBlatt';

const WAPPEN_UNBEKANNT = '/hub/clan-wappen.png';

function wappenBild(crest: string): string {
  return /^wappen-\d+$/.test(crest) ? `/hub/${crest}.webp` : WAPPEN_UNBEKANNT;
}

export function ClanKrieg({
  clubId,
  onClose,
  neu = false,
}: {
  clubId: string;
  onClose: () => void;
  /** Neues Hub: Stil des Kriegsblocks aus der Halle (VS, Wappen, Balken). */
  neu?: boolean;
}): React.JSX.Element {
  const [stand, setStand] = useState<WarState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [gegnerwahl, setGegnerwahl] = useState(false);

  const laden = useCallback(() => {
    void api
      .clubWar(clubId)
      .then(setStand)
      .catch(() => setFehler(t('clankrieg.fehler.laden')));
  }, [clubId]);

  useEffect(laden, [laden]);

  // Waehrend ein Krieg laeuft, halten sich Punktestand und Restzeit selbst
  // aktuell — ein Wettstreit, den man erst durch Neuladen sieht, ist keiner.
  useEffect(() => {
    if (stand?.aktuell?.status !== 'laeuft') return;
    const uhr = window.setInterval(laden, 15_000);
    return () => window.clearInterval(uhr);
  }, [stand?.aktuell?.status, laden]);

  const tue = (aktion: Promise<unknown>): void => {
    if (beschaeftigt) return;
    setBeschaeftigt(true);
    setFehler(null);
    void aktion
      .then(() => {
        setGegnerwahl(false);
        laden();
      })
      .catch((e: unknown) => setFehler(fehlertext(e)))
      .finally(() => setBeschaeftigt(false));
  };

  if (neu) {
    const aktuell = stand?.aktuell ?? null;
    return (
      <div className="hb-spiele hb-krieg-voll">
        <header className="hb-kopfzeile is-zurueck">
          <Zurueck onClick={onClose} label={t('clankrieg.zurueckAria')} />
          <span className="hb-kopf-titel">
            <h1 className="hb-titel">{t('clankrieg.titel')}</h1>
            <small>{t('clankrieg.untertitel')}</small>
          </span>
        </header>
        <div className="hb-spiele-rolle">
          {stand === null && !fehler && <p className="hb-laden">{t('clan.laden')}</p>}
          {fehler && <p className="hb-fehler">{fehler}</p>}

          {aktuell?.status === 'laeuft' && <SchlachtNeu krieg={aktuell} />}

          {(aktuell?.status === 'suche' || aktuell?.status === 'angefragt') && stand && (
            <section className="hb-karte hb-warten">
              <span className="hb-warten-punkt" aria-hidden="true" />
              <h2 className="hb-ab">
                {aktuell.status === 'suche'
                  ? t('clankrieg.suche.titel')
                  : tf('clankrieg.angefragt.titel', { name: aktuell.gegner?.name ?? t('clankrieg.einenClan') })}
              </h2>
              <p className="hb-text">
                {aktuell.status === 'suche'
                  ? t('clankrieg.suche.text')
                  : t('clankrieg.angefragt.text')}
              </p>
              {stand.darfFuehren && (
                <button
                  type="button"
                  className="hb-kn is-zweit is-breit"
                  disabled={beschaeftigt}
                  onClick={() => tue(api.cancelWar(clubId, aktuell.id))}
                >
                  {aktuell.status === 'suche' ? t('clankrieg.suche.beenden') : t('clankrieg.zuruecknehmen')}
                </button>
              )}
            </section>
          )}

          {/* Herausforderungen anderer Clans: Annehmen ist hier der eine
              Hauptknopf, weil es das Einzige ist, das eine Antwort verlangt. */}
          {stand?.offeneAnfragen.map((anfrage) => (
            <section className="hb-karte hb-kr-anfrage" key={anfrage.id}>
              <span className="hb-kr-anfrage-kopf">
                <img src={wappenBild(anfrage.gegner?.crest ?? '')} alt="" draggable={false} />
                <span>
                  <strong>{anfrage.gegner?.name ?? t('clankrieg.einClan')}</strong>
                  <small>{t('clankrieg.fordertHeraus')}</small>
                </span>
              </span>
              {stand.darfFuehren && (
                <span className="hb-knopfreihe">
                  <button
                    type="button"
                    className="hb-kn is-zweit"
                    disabled={beschaeftigt}
                    onClick={() => tue(api.cancelWar(clubId, anfrage.id))}
                  >
                    {t('clankrieg.ablehnen')}
                  </button>
                  <button
                    type="button"
                    className="hb-kn is-gold"
                    disabled={beschaeftigt}
                    onClick={() => tue(api.acceptWar(clubId, anfrage.id))}
                  >
                    {t('clankrieg.annehmen')}
                  </button>
                </span>
              )}
            </section>
          ))}

          {/* Kein Krieg, keine Anfrage: der Einstieg. */}
          {stand && !aktuell && (
            <section className="hb-karte hb-kr-start">
              <img src="/hub/icon-krieg.webp" alt="" draggable={false} />
              <h2 className="hb-ab">{t('clankrieg.start.titel')}</h2>
              <p className="hb-text">
                {t('clankrieg.start.text')}
              </p>
              {stand.darfFuehren ? (
                <>
                  {/* Liegt eine Herausforderung oben, ist „Annehmen" der
                      Hauptknopf; die Suche tritt dann zurück (ein Gold je Ansicht). */}
                  <button
                    type="button"
                    className={`hb-kn ${stand.offeneAnfragen.length > 0 ? 'is-zweit' : 'is-gold is-haupt'} is-breit`}
                    disabled={beschaeftigt}
                    onClick={() => tue(api.searchWar(clubId))}
                  >
                    {t('clankrieg.gegnerSuchen')}
                  </button>
                  <button
                    type="button"
                    className="hb-kn is-zweit is-breit"
                    disabled={beschaeftigt}
                    onClick={() => setGegnerwahl(true)}
                  >
                    {t('clankrieg.herausfordern')}
                  </button>
                </>
              ) : (
                <p className="hb-klein hb-ohne-rand">{t('clankrieg.nurLeitung')}</p>
              )}
            </section>
          )}

          {/* Die Regel gehört auf den Bildschirm, nicht in eine Hilfe. */}
          <section className="hb-blk">
            <h2 className="hb-ab">{t('clankrieg.regel.titel')}</h2>
            <ul className="hb-karte hb-regelliste">
              <li>{mitFett(t('clankrieg.regel.platz'), 'b')}</li>
              <li>{mitFett(t('clankrieg.regel.hoechstens'), 'b')}</li>
              <li>{mitFett(t('clankrieg.regel.menschen'), 'b')}</li>
            </ul>
          </section>

          {stand?.letzter && (
            <section className="hb-blk">
              <h2 className="hb-ab">{t('clankrieg.letzter.titel')}</h2>
              <p className={`hb-karte hb-kr-letzter is-${stand.letzter.ergebnis ?? 'unentschieden'}`}>
                {letzterSatz(stand.letzter)}
              </p>
            </section>
          )}
        </div>

        {gegnerwahl && (
          <Gegnerwahl
            neu
            eigenerClub={clubId}
            onClose={() => setGegnerwahl(false)}
            onWaehlen={(gegnerId) => tue(api.challengeWar(clubId, gegnerId))}
          />
        )}
      </div>
    );
  }

  return (
    <div className="clan-voll">
      <header className="clan-voll-kopf">
        <button className="hub-zurueck" onClick={onClose} type="button">
          {t('clan.zurueckPfeil')}
        </button>
        <h2>{t('clankrieg.titel')}</h2>
      </header>

      <div className="clan-krieg-inhalt">
        {stand === null && <Ladekreis />}
        {fehler && <p className="clan-fehler">{fehler}</p>}

        {stand?.aktuell?.status === 'laeuft' && <Schlacht krieg={stand.aktuell} />}

        {stand?.aktuell?.status === 'suche' && (
          <Wartefeld
            titel={t('clankrieg.suche.titel')}
            text={t('clankrieg.suche.text')}
            darfFuehren={stand.darfFuehren}
            knopf={t('clankrieg.suche.beenden')}
            onKnopf={() => tue(api.cancelWar(clubId, stand.aktuell!.id))}
          />
        )}

        {stand?.aktuell?.status === 'angefragt' && (
          <Wartefeld
            titel={tf('clankrieg.angefragt.titel', { name: stand.aktuell.gegner?.name ?? t('clankrieg.einenClan') })}
            text={t('clankrieg.angefragt.text')}
            darfFuehren={stand.darfFuehren}
            knopf={t('clankrieg.zuruecknehmen')}
            onKnopf={() => tue(api.cancelWar(clubId, stand.aktuell!.id))}
          />
        )}

        {/* Herausforderungen anderer Clans stehen oben — sie sind das
            Dringlichste auf diesem Bildschirm. */}
        {stand?.offeneAnfragen.map((anfrage) => (
          <section className="clan-krieg-anfrage" key={anfrage.id}>
            <img src={wappenBild(anfrage.gegner?.crest ?? '')} alt="" draggable={false} />
            <div>
              <strong>{anfrage.gegner?.name ?? t('clankrieg.einClan')}</strong>
              <span className="muted">{t('clankrieg.fordertHeraus')}</span>
            </div>
            {stand.darfFuehren && (
              <div className="clan-krieg-anfrage-knoepfe">
                <button
                  className="primary"
                  disabled={beschaeftigt}
                  onClick={() => tue(api.acceptWar(clubId, anfrage.id))}
                >
                  {t('clankrieg.annehmen')}
                </button>
                <button
                  disabled={beschaeftigt}
                  onClick={() => tue(api.cancelWar(clubId, anfrage.id))}
                >
                  {t('clankrieg.ablehnen')}
                </button>
              </div>
            )}
          </section>
        ))}

        {/* Kein Krieg, keine Anfrage: der Einstieg. */}
        {stand && !stand.aktuell && (
          <section className="clan-krieg-start">
            {/* Dasselbe Zeichen wie auf dem Knopf in der Halle — und als
                .webp, so heisst die Datei. Ein .png-Verweis darauf war ein
                weisser Kasten. */}
            <img className="clan-krieg-bild" src="/hub/icon-krieg.webp" alt="" draggable={false} />
            <h3>{t('clankrieg.start.titel')}</h3>
            <p className="muted">
              {t('clankrieg.start.text')}
            </p>
            {stand.darfFuehren ? (
              <div className="clan-krieg-startknoepfe">
                <button
                  className="primary"
                  disabled={beschaeftigt}
                  onClick={() => tue(api.searchWar(clubId))}
                >
                  {t('clankrieg.gegnerSuchen')}
                </button>
                <button disabled={beschaeftigt} onClick={() => setGegnerwahl(true)}>
                  {t('clankrieg.herausfordern')}
                </button>
              </div>
            ) : (
              <p className="muted">
                {t('clankrieg.nurLeitung')}
              </p>
            )}
          </section>
        )}

        <Spielregel />

        {stand?.letzter && <LetzterKrieg krieg={stand.letzter} />}
      </div>

      {gegnerwahl && (
        <Gegnerwahl
          eigenerClub={clubId}
          onClose={() => setGegnerwahl(false)}
          onWaehlen={(gegnerId) => tue(api.challengeWar(clubId, gegnerId))}
        />
      )}
    </div>
  );
}

/** Der laufende Krieg: zwei Wappen, ein Balken, die Beitraege darunter. */
function Schlacht({ krieg }: { krieg: WarView }): React.JSX.Element {
  const gesamt = krieg.wir.score + (krieg.gegner?.score ?? 0);
  // Bei 0:0 stehen beide Haelften gleich — ein leerer Balken waere ehrlicher,
  // sieht aber nach Fehler aus.
  const anteil = gesamt === 0 ? 50 : Math.round((krieg.wir.score / gesamt) * 100);
  const fuehrend =
    krieg.wir.score > (krieg.gegner?.score ?? 0)
      ? 'wir'
      : krieg.wir.score < (krieg.gegner?.score ?? 0)
        ? 'gegner'
        : 'gleich';

  return (
    <section className="clan-krieg-schlacht">
      <div className="clan-krieg-uhr">{restzeit(krieg.endsAt)}</div>

      <div className="clan-krieg-seiten">
        <Seite seite={krieg.wir} eigen fuehrt={fuehrend === 'wir'} />
        <span className="clan-krieg-gegen">{t('clankrieg.gegen')}</span>
        {krieg.gegner && <Seite seite={krieg.gegner} fuehrt={fuehrend === 'gegner'} />}
      </div>

      <div className="clan-krieg-balken" role="img" aria-label={tf('clankrieg.stand', { wir: krieg.wir.score, gegner: krieg.gegner?.score ?? 0 })}>
        <span className="clan-krieg-balken-wir" style={{ width: `${anteil}%` }} />
      </div>

      <h3 className="clan-krieg-untertitel">{t('clankrieg.gepunktet')}</h3>
      {krieg.beitraege.length === 0 && (
        <p className="muted">
          {t('clankrieg.keinePunkte')}
        </p>
      )}
      <ul className="clan-krieg-beitraege">
        {krieg.beitraege.map((b) => (
          <li key={b.accountId}>
            <span className="clan-krieg-beitrag-name">{b.displayName}</span>
            <span className="muted">{tf('clankrieg.partien', { n: b.games })}</span>
            <strong>{b.points}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Der laufende Krieg im neuen Hub: derselbe Block wie in der Halle, größer. */
function SchlachtNeu({ krieg }: { krieg: WarView }): React.JSX.Element {
  const gegner = krieg.gegner?.score ?? 0;
  const gesamt = krieg.wir.score + gegner;
  // Bei 0:0 stehen beide Hälften gleich, sonst sähe der Balken nach Fehler aus.
  const anteil = gesamt === 0 ? 50 : Math.round((krieg.wir.score / gesamt) * 100);
  return (
    <>
      <section className="hb-krieg is-gross">
        <span className="hb-kr-kopf">
          <strong>{t('clankrieg.laeuft')}</strong>
          <small>{restzeit(krieg.endsAt)}</small>
        </span>
        <span className="hb-kr-vs">
          <span className="hb-kr-seite">
            <img src={wappenBild(krieg.wir.crest)} alt="" />
            <b>{krieg.wir.score}</b>
            <small>{krieg.wir.name}</small>
          </span>
          <span className="hb-vs">VS</span>
          {krieg.gegner && (
            <span className="hb-kr-seite is-gegner">
              <img src={wappenBild(krieg.gegner.crest)} alt="" />
              <b>{krieg.gegner.score}</b>
              <small>{krieg.gegner.name}</small>
            </span>
          )}
        </span>
        <span className="hb-kr-balken" role="img" aria-label={tf('clankrieg.stand', { wir: krieg.wir.score, gegner })}>
          <span style={{ width: `${anteil}%` }} />
        </span>
      </section>

      <section className="hb-blk">
        <h2 className="hb-ab">
          {t('clankrieg.gepunktet')}
          {krieg.beitraege.length > 0 && <span className="hb-ab-zusatz">{krieg.beitraege.length}</span>}
        </h2>
        {krieg.beitraege.length === 0 ? (
          <p className="hb-klein hb-ohne-rand">
            {t('clankrieg.keinePunkte')}
          </p>
        ) : (
          <ul className="hb-liste">
            {krieg.beitraege.map((b, i) => (
              <li className="hb-mg" key={b.accountId}>
                <span className="hb-rl-rang">{i + 1}</span>
                <span className="hb-mg-name">
                  <strong>{b.displayName}</strong>
                  <small className="is-leise">{tf('clankrieg.partien', { n: b.games })}</small>
                </span>
                <b className="hb-kr-punkte">{b.points}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Seite({
  seite,
  eigen,
  fuehrt,
}: {
  seite: { name: string; crest: string; score: number };
  eigen?: boolean;
  fuehrt: boolean;
}): React.JSX.Element {
  return (
    <div className={`clan-krieg-seite${eigen ? ' is-eigen' : ''}${fuehrt ? ' is-fuehrt' : ''}`}>
      <img src={wappenBild(seite.crest)} alt="" draggable={false} />
      <strong className="clan-krieg-punkte">{seite.score}</strong>
      <span className="clan-krieg-name">{seite.name}</span>
    </div>
  );
}

function Wartefeld({
  titel,
  text,
  darfFuehren,
  knopf,
  onKnopf,
}: {
  titel: string;
  text: string;
  darfFuehren: boolean;
  knopf: string;
  onKnopf: () => void;
}): React.JSX.Element {
  return (
    <section className="clan-krieg-warten">
      <span className="clan-krieg-punkt" aria-hidden="true" />
      <h3>{titel}</h3>
      <p className="muted">{text}</p>
      {darfFuehren && <button onClick={onKnopf}>{knopf}</button>}
    </section>
  );
}

/** Die Regel gehoert auf den Bildschirm, nicht in eine Hilfe. */
function Spielregel(): React.JSX.Element {
  return (
    <section className="clan-krieg-regel">
      <h3>{t('clankrieg.regel.titel')}</h3>
      <ul>
        <li>{mitFett(t('clankrieg.regel.platz'), 'strong')}</li>
        <li>{mitFett(t('clankrieg.regel.hoechstens'), 'strong')}</li>
        <li>{mitFett(t('clankrieg.regel.menschen'), 'strong')}</li>
      </ul>
    </section>
  );
}

/** Ausgang des letzten Kriegs als ganzer Satz, das Ergebniswort fett. */
function letzterSatz(krieg: WarView): React.ReactNode[] {
  const ausgang = krieg.ergebnis === 'wir' ? 'wir' : krieg.ergebnis === 'gegner' ? 'gegner' : 'gleich';
  return mitFett(
    tf(`clankrieg.letzter.${ausgang}`, {
      name: krieg.gegner?.name ?? t('clankrieg.einenClan'),
      wir: krieg.wir.score,
      gegner: krieg.gegner?.score ?? 0,
    }),
    'strong',
  );
}

function LetzterKrieg({ krieg }: { krieg: WarView }): React.JSX.Element {
  return (
    <section className={`clan-krieg-letzter is-${krieg.ergebnis ?? 'unentschieden'}`}>
      <h3>{t('clankrieg.letzter.titel')}</h3>
      <p>{letzterSatz(krieg)}</p>
    </section>
  );
}

/** Einen Clan aus der Liste herausfordern. */
function Gegnerwahl({
  eigenerClub,
  onClose,
  onWaehlen,
  neu = false,
}: {
  eigenerClub: string;
  onClose: () => void;
  onWaehlen: (clubId: string) => void;
  /** Neues Hub: Blatt von unten. */
  neu?: boolean;
}): React.JSX.Element {
  const [clans, setClans] = useState<ClubSummary[] | null>(null);
  const [suche, setSuche] = useState('');

  useEffect(() => {
    void api
      .clubs(suche || undefined)
      .then((a) => setClans(a.clubs.filter((c) => c.id !== eigenerClub)))
      .catch(() => setClans([]));
  }, [suche, eigenerClub]);

  if (neu) {
    return (
      <HbBlatt titel={t('clankrieg.herausfordern')} onClose={onClose}>
        <input
          className="hb-feld is-suche"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t('clan.suche.platzhalter')}
          aria-label={t('clan.suche.aria')}
        />
        <div className="hb-liste">
          {clans === null && <p className="hb-klein hb-liste-leer">{t('clan.laden')}</p>}
          {clans?.length === 0 && <p className="hb-klein hb-liste-leer">{t('clankrieg.keinGegner')}</p>}
          {clans?.map((c) => (
            <button type="button" key={c.id} className="hb-mg" onClick={() => onWaehlen(c.id)} aria-label={tf('clankrieg.herausfordern.aria', { name: c.name })}>
              <img className="hb-mg-wappen" src={wappenBild(c.crest)} alt="" draggable={false} />
              <span className="hb-mg-name">
                <strong>{c.name}</strong>
                <small className="is-leise">
                  {tf('clankrieg.mitglieder', { n: c.members, max: c.maxMembers })}
                </small>
              </span>
              <span className="hb-pk">
                <img src="/hub/symbol-pokal.webp" alt="" />
                {zahl(c.trophies)}
              </span>
            </button>
          ))}
        </div>
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{t('clankrieg.herausfordern')}</h2>
        <div className="lobby-suche">
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t('clan.suche.platzhalter')}
            aria-label={t('clan.suche.aria')}
          />
        </div>
        <div className="clan-krieg-gegnerliste">
          {clans === null && <Ladekreis />}
          {clans?.length === 0 && <p className="muted">{t('clankrieg.keinGegner')}</p>}
          {clans?.map((c) => (
            <button key={c.id} className="clan-zeile" onClick={() => onWaehlen(c.id)}>
              <img className="clan-avatar" src={wappenBild(c.crest)} alt="" draggable={false} />
              <span className="clan-zeile-name">{c.name}</span>
              <span className="clan-zeile-trophaeen">
                <img src="/hub/pokal.png" alt="" aria-hidden="true" />
                {c.trophies}
              </span>
            </button>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          {t('clan.abbrechen')}
        </button>
      </div>
    </div>
  );
}

function fehlertext(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'warAlreadyActive':
      return t('clankrieg.fehler.warAlreadyActive');
    case 'warOpponentBusy':
      return t('clankrieg.fehler.warOpponentBusy');
    case 'warSelfChallenge':
      return t('clankrieg.fehler.warSelfChallenge');
    case 'warRunning':
      return t('clankrieg.fehler.warRunning');
    case 'notClubAdmin':
      return t('clankrieg.fehler.notClubAdmin');
    default:
      return t('clan.fehler.sonst');
  }
}
