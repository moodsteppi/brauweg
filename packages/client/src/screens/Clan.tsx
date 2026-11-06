import { useEffect, useState } from 'react';
import { Ladekreis } from '../Ladekreis';

import {
  ApiError,
  WAPPEN,
  api,
  type ClubDetail,
  type ClubMemberView,
  type ClubRole,
  type ClubSummary,
  type JoinMode,
  type WarState,
} from '../api';
import { HubBanner, HubSzene } from '../hub';
import { t } from '../i18n';
import { tf } from '../i18n/einsetzen';
import { ClanChat } from './ClanChat';
import { ClanKrieg } from './ClanKrieg';
import { HbBlatt, Zurueck, useRueckfrage } from './HbBlatt';
import { inApp, serverAdresse } from '../laufzeit';
import { imUmfang } from '../umfang';

/**
 * Clan-Tab (Plan 9.3).
 *
 * Der Tab ist kein Schaufenster aus Kacheln, sondern eine Liste: Ein Clan ist
 * in erster Linie die Frage, wer dazugehoert. Alles andere — aufnehmen,
 * befoerdern, rauswerfen, Regeln setzen — haengt an genau dieser Liste und
 * steht deshalb daneben statt in einem eigenen Raum.
 *
 * Drei Ansichten, nie gleichzeitig:
 *   - `halle`     man ist im Clan: Wappen, Zahlen, Mitglieder, Verwaltung
 *   - `suche`     man ist in keinem: Clanliste mit Suche zum Beitreten
 *   - `gruenden`  Formular fuer den eigenen Clan
 *
 * Beitreten und Austreten aendern `me`, deshalb meldet jede erfolgreiche
 * Aktion nach oben (`onMeChange`) — sonst zeigt die Kopfzeile weiter den
 * alten Clan.
 */

type Ansicht = 'halle' | 'suche' | 'gruenden';

/** Bild zu einer Wappenkennung. Unbekanntes faellt auf das Brauweg-Wappen. */
function wappenBild(crest: string | null | undefined): string {
  return crest && (WAPPEN as readonly string[]).includes(crest)
    ? `/hub/${crest}.webp`
    : '/hub/clan-wappen.png';
}

/**
 * Rangstufen im Clan.
 *
 * Die Kennungen bleiben englisch wie im Schema; die Woerter, die am Tisch
 * fallen, stehen im Woerterbuch (`clan.rolle.*`). "Aeltester" ist bisher
 * eine Auszeichnung ohne Sonderrechte — vergeben laesst sie sich trotzdem.
 * Eine unbekannte Kennung bleibt leer, wie zuvor ohne Eintrag.
 */
const ROLLEN = new Set(['admin', 'vize', 'elder', 'member', 'guest']);

function rolle(kennung: string): string {
  return ROLLEN.has(kennung) ? t(`clan.rolle.${kennung}`) : '';
}

/** Anfuehrer und Vize duerfen dasselbe. */
function istLeitung(rolle: string | null | undefined): boolean {
  return rolle === 'admin' || rolle === 'vize';
}

/**
 * Bild eines Mitglieds: das eigene, sonst ein Pinguin.
 *
 * `hasAvatar` kommt vom Server, damit nicht je Mitglied eine Anfrage auf
 * /api/avatars ins Leere laeuft — bei 50 Mitgliedern waeren das 50 Fehler.
 * Der Pinguin wechselt mit der Position, damit vier Zeilen untereinander
 * nicht viermal dasselbe Bild zeigen.
 */
function bildFuer(m: { accountId: string; hasAvatar: boolean }, i: number): string {
  return m.hasAvatar ? serverAdresse(`/api/avatars/${m.accountId}`) : `/hub/pinguin-${(i % 4) + 1}.png`;
}

/**
 * Wappen, die dem Konto gehoeren.
 *
 * `null`, solange nichts geladen ist — dann gilt alles als erlaubt. Ein
 * Raster, das beim Oeffnen kurz komplett gesperrt aussieht, waere schlimmer
 * als eines, das eine Sekunde zu freundlich ist; die Wahrheit steht ohnehin
 * beim Speichern im Server.
 */
function useMeineWappen(): Set<string> | null {
  const [wappen, setWappen] = useState<Set<string> | null>(null);
  useEffect(() => {
    void api
      .shop()
      .then((s) =>
        setWappen(
          new Set(s.tischware.filter((w) => w.art === 'wappen' && w.besessen).map((w) => w.wert)),
        ),
      )
      .catch(() => setWappen(null));
  }, []);
  return wappen;
}

/** Runder Knopf mit gemaltem Zeichen und Wort darunter. */
function IconKnopf({
  icon,
  label,
  bald,
  zaehler,
  onClick,
}: {
  icon: string;
  label: string;
  /** Zeigt das Bald-Schild und daempft das Bild. */
  bald?: boolean;
  /** Rote Zahl an der Ecke, wenn etwas auf Antwort wartet. */
  zaehler?: number;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button className={`clan-icon${bald ? ' is-bald' : ''}`} onClick={onClick}>
      <span className="clan-icon-scheibe">
        <img src={`/hub/icon-${icon}.webp`} alt="" draggable={false} />
        {zaehler !== undefined && zaehler > 0 && (
          <span className="clan-zaehler">{zaehler}</span>
        )}
        {bald && <span className="front-bald-tag">{t('clan.bald')}</span>}
      </span>
      <span className="clan-icon-wort">{label}</span>
    </button>
  );
}

export function Clan({
  clanId,
  meId,
  onBald,
  onShowProfile,
  onMeChange,
  onClanwort,
  neu = false,
}: {
  /** Neues Hub (Nachtblau & Gold): die neu angeordnete Halle. */
  neu?: boolean;
  /** Clanwort oeffnen (nur im Umfang gesetzt) — ohne steht die Zeile nicht da. */
  onClanwort?: () => void;
  /** Der eine Clan des Kontos, oder `null`. */
  clanId: string | null;
  /** Eigenes Konto — im Chat stehen die eigenen Zeilen rechts. */
  meId: string | null;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
  onMeChange: () => void;
}): React.JSX.Element {
  const [ansicht, setAnsicht] = useState<Ansicht>(clanId ? 'halle' : 'suche');
  const [detail, setDetail] = useState<ClubDetail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const ladeDetail = (): void => {
    if (!clanId) {
      setDetail(null);
      return;
    }
    void api
      .club(clanId)
      .then(setDetail)
      .catch(() => setDetail(null));
  };
  useEffect(ladeDetail, [clanId]);

  // Wechselt der Clan (beigetreten, gegruendet, ausgetreten), passt sich die
  // Ansicht an: In der Halle ohne Clan stuende nichts.
  useEffect(() => {
    setAnsicht(clanId ? 'halle' : 'suche');
  }, [clanId]);

  /** Wickelt eine Aktion ab und macht den Fehlercode lesbar. */
  const tue = (aktion: Promise<unknown>, danach: () => void = () => undefined): void => {
    setFehler(null);
    void aktion
      .then(() => {
        danach();
        ladeDetail();
        onMeChange();
      })
      .catch((e: unknown) => setFehler(fehlertext(e)));
  };

  if (ansicht === 'gruenden') {
    return (
      <Gruenden
        neu={neu}
        fehler={fehler}
        onFehler={setFehler}
        onAbbruch={() => {
          setFehler(null);
          setAnsicht('suche');
        }}
        onFertig={() => {
          setFehler(null);
          onMeChange();
        }}
      />
    );
  }

  if (ansicht === 'suche' || !clanId) {
    return (
      <Suche
        neu={neu}
        fehler={fehler}
        onBeitreten={(id) => tue(api.joinClub(id))}
        onZuruecknehmen={(id) => tue(api.cancelClubRequest(id))}
        onGruenden={() => {
          setFehler(null);
          setAnsicht('gruenden');
        }}
      />
    );
  }

  const HalleArt = neu ? HalleNeu : Halle;
  return (
    <HalleArt
      detail={detail}
      meId={meId}
      fehler={fehler}
      onBald={onBald}
      onShowProfile={onShowProfile}
      onAktion={tue}
      onClanwort={onClanwort}
    />
  );
}

/** Macht aus einem Fehler einen Satz, den man lesen kann. */
function fehlertext(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'alreadyInClub':
      return t('clan.fehler.alreadyInClub');
    case 'clubNameTaken':
      return t('clan.fehler.clubNameTaken');
    case 'clubNameLength':
      return t('clan.fehler.clubNameLength');
    case 'clubMottoLength':
      return t('clan.fehler.clubMottoLength');
    case 'clubFull':
      return t('clan.fehler.clubFull');
    case 'clubTrophiesTooLow':
      return t('clan.fehler.clubTrophiesTooLow');
    case 'notClubAdmin':
      return t('clan.fehler.notClubAdmin');
    case 'lastAdmin':
      return t('clan.fehler.lastAdmin');
    case 'cannotChangeOwnRole':
      return t('clan.fehler.cannotChangeOwnRole');
    case 'cannotKickSelf':
      return t('clan.fehler.cannotKickSelf');
    default:
      return t('clan.fehler.sonst');
  }
}

// ---------------------------------------------------------------------------
// Die Halle: man ist im Clan
// ---------------------------------------------------------------------------

function Halle({
  detail,
  meId,
  fehler,
  onBald,
  onShowProfile,
  onAktion,
}: {
  detail: ClubDetail | null;
  meId: string | null;
  fehler: string | null;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  /** Angetipptes Mitglied — oeffnet die Aktionen des Admins. */
  const [gewaehlt, setGewaehlt] = useState<ClubMemberView | null>(null);
  const [blatt, setBlatt] = useState<'anfragen' | 'einstellungen' | null>(null);
  /** Chat und Krieg fuellen den Bildschirm, sie sind kein Blatt darueber. */
  const [voll, setVoll] = useState<'chat' | 'krieg' | null>(null);

  const darfVerwalten = istLeitung(detail?.myRole);
  const offen = detail?.requests.length ?? 0;
  // Chat und Krieg nur, wenn die Ausgabe sie anbietet (umfang.ts) — die
  // Routen sperrt der Server dann ohnehin.
  const mitChat = !inApp && imUmfang('clanchat');
  const mitKrieg = imUmfang('clankrieg');

  if (voll === 'chat' && detail && mitChat) {
    return (
      <ClanChat
        clubId={detail.id}
        meId={meId}
        darfLoeschen={darfVerwalten}
        onClose={() => setVoll(null)}
        onShowProfile={onShowProfile}
      />
    );
  }

  if (voll === 'krieg' && detail && mitKrieg) {
    return <ClanKrieg clubId={detail.id} onClose={() => setVoll(null)} />;
  }

  return (
    <HubSzene bg="/hub/bg-clan.webp" className="front-clan">
      <HubBanner />

      <div className="hub-clanschild">
        <img
          className="hub-clanschild-wappen"
          src={wappenBild(detail?.crest)}
          alt=""
          draggable={false}
        />
        <div className="hub-clanschild-text">
          <strong>{detail?.name ?? '…'}</strong>
          <span className="muted">
            {detail?.motto ?? (detail ? t('clan.mottoLeer') : t('clan.laden'))}
          </span>
          <div className="hub-clanschild-zahlen">
            <span>
              <img src="/hub/tab-clan.webp" alt="" aria-hidden="true" />
              {detail ? `${detail.members}/${detail.maxMembers}` : '-'}
            </span>
            <span>
              <img src="/hub/pokal.png" alt="" aria-hidden="true" />
              {detail?.trophies ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/*
        Eine Reihe gleich grosser Knoepfe statt Text hier und Text dort. Die
        Truhe ist noch ein ehrlicher Platzhalter: Sie sagt beim Antippen, dass
        es sie noch nicht gibt — die Halle soll aber schon aussehen wie eine
        Halle und nicht wie eine Baustelle. Alles andere arbeitet; Anfragen
        bleiben der Leitung vorbehalten.
      */}
      <div className="clan-icons">
        {/* Kein Chat in der App, bis es eine Moderation gibt: Apple verlangt
            fuer freien Text zwischen Fremden (1.2) Filter, Melden und eine
            Reaktion binnen kurzer Zeit. Melden und Blockieren gibt es jetzt,
            einen Filter und jemanden, der die Meldungen abarbeitet, noch
            nicht. Auf der Webseite bleibt der Chat. */}
        {mitChat && <IconKnopf icon="chat" label={t('clan.icon.chat')} onClick={() => setVoll('chat')} />}
        <IconKnopf icon="truhe" label={t('clan.icon.truhe')} bald onClick={() => onBald(t('clan.truhe'))} />
        {mitKrieg && <IconKnopf icon="krieg" label={t('clan.icon.krieg')} onClick={() => setVoll('krieg')} />}
        {/* Anfragen sind Bewerberdaten - die sieht nur die Leitung. */}
        {darfVerwalten && (
          <IconKnopf
            icon="anfragen"
            label={t('clan.anfragen')}
            zaehler={offen}
            onClick={() => setBlatt('anfragen')}
          />
        )}
        {/* Die Clanregeln sieht jeder: Wer beitritt, soll nachlesen koennen,
            was hier gilt. Aendern duerfen sie nur Anfuehrer und Vize. */}
        <IconKnopf
          icon="einstellungen"
          label={t('clan.icon.clan')}
          onClick={() => setBlatt('einstellungen')}
        />
      </div>

      {fehler && <p className="clan-fehler">{fehler}</p>}

      <section className="clan-liste">
        <header className="clan-liste-kopf">
          <h2>{t('clan.mitglieder')}</h2>
          {detail && (
            <span className="clan-liste-zahl">
              {detail.members}/{detail.maxMembers}
            </span>
          )}
        </header>

        <div className="clan-rollen">
          {detail === null && <Ladekreis />}
          {detail?.memberList.map((m, i) => (
            <button
              key={m.accountId}
              className="clan-zeile"
              onClick={() => (darfVerwalten ? setGewaehlt(m) : onShowProfile(m.accountId))}
            >
              {/* Die Liste steht nach Trophaeen — dann ist die Position eine
                  Aussage und kein Zierrat. */}
              <span className="clan-platz">{i + 1}</span>
              <img
                className="clan-avatar"
                src={bildFuer(m, i)}
                alt=""
                draggable={false}
              />
              <span className="clan-zeile-name">{m.displayName}</span>
              <span className={`clan-rolle is-${m.role}`}>{rolle(m.role)}</span>
              <span className="clan-zeile-trophaeen">
                <img src="/hub/pokal.png" alt="" aria-hidden="true" />
                {m.trophies}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Austreten steht unten und klein: Es ist selten richtig und nie eilig. */}
      {detail && (
        <button
          className="clan-austritt"
          onClick={() => {
            if (!window.confirm(tf('clan.verlassen.frage', { name: detail.name }))) return;
            onAktion(api.leaveClub(detail.id));
          }}
        >
          {t('clan.verlassen')}
        </button>
      )}

      {gewaehlt && detail && (
        <MitgliedBlatt
          mitglied={gewaehlt}
          clubId={detail.id}
          onClose={() => setGewaehlt(null)}
          onShowProfile={onShowProfile}
          onAktion={onAktion}
        />
      )}
      {blatt === 'anfragen' && detail && (
        <AnfragenBlatt
          detail={detail}
          onClose={() => setBlatt(null)}
          onShowProfile={onShowProfile}
          onAktion={onAktion}
        />
      )}
      {blatt === 'einstellungen' && detail && (
        <EinstellungenBlatt
          darfAendern={darfVerwalten}
          detail={detail}
          onClose={() => setBlatt(null)}
          onAktion={onAktion}
        />
      )}
    </HubSzene>
  );
}

/** Was der Admin mit einem Mitglied tun kann. */
function MitgliedBlatt({
  mitglied,
  clubId,
  onClose,
  onShowProfile,
  onAktion,
  neu = false,
}: {
  /** Neues Hub: Blatt von unten, dieselben Rückfragen. */
  neu?: boolean;
  mitglied: ClubMemberView;
  clubId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  /**
   * Die Raenge zur Auswahl.
   *
   * Anfuehrer und Vize duerfen dasselbe; "Aeltester" ist eine Auszeichnung
   * ohne Sonderrechte. Der aktuelle Rang steht nicht als Knopf da — man
   * waehlt einen anderen, nicht denselben.
   */
  const RAENGE: { id: ClubRole; wort: string; hinweis: string }[] = [
    { id: 'admin', wort: rolle('admin'), hinweis: t('clan.rang.hinweis.leitung') },
    { id: 'vize', wort: rolle('vize'), hinweis: t('clan.rang.hinweis.leitung') },
    { id: 'elder', wort: rolle('elder'), hinweis: t('clan.rang.hinweis.elder') },
    { id: 'member', wort: rolle('member'), hinweis: '' },
  ];

  /**
   * Rückfragen: im neuen Hub als eigenes Blatt (useRueckfrage), sonst wie
   * bisher. `window.confirm` zeigte in der App den grauen iOS-Dialog.
   */
  const [frage, rueckfrage] = useRueckfrage();
  const bestaetige = (titel: string, text: string | undefined, ja: string, gefahr: boolean, dann: () => void): void => {
    if (neu) frage({ titel, text, ja, gefahr }, dann);
    else if (window.confirm(text ? `${titel} ${text}` : titel)) dann();
  };
  const befoerdern = (r: (typeof RAENGE)[number]): void => {
    bestaetige(
      tf('clan.befoerdern.frage', { name: mitglied.displayName, rang: r.wort }),
      istLeitung(r.id) ? t('clan.befoerdern.leitung') : undefined,
      tf('clan.befoerdern.ja', { rang: r.wort }),
      false,
      () => onAktion(api.setClubRole(clubId, mitglied.accountId, r.id), onClose),
    );
  };
  const rauswerfen = (): void => {
    bestaetige(tf('clan.rauswerfen.frage', { name: mitglied.displayName }), undefined, t('clan.rauswerfen'), true, () =>
      onAktion(api.kickClubMember(clubId, mitglied.accountId), onClose),
    );
  };

  if (neu) {
    return (
      <HbBlatt titel={mitglied.displayName} onClose={onClose}>
        <p className="hb-klein hb-ohne-rand">
          {tf('clan.mitglied.zeile', { rolle: rolle(mitglied.role), trophaeen: mitglied.trophies.toLocaleString('de-DE') })}
        </p>
        <button type="button" className="hb-kn is-zweit is-breit" onClick={() => onShowProfile(mitglied.accountId)}>
          {t('clan.profilAnsehen')}
        </button>
        <section className="hb-blk">
          <h3 className="hb-ab">{t('clan.rang')}</h3>
          <div className="hb-liste">
            {RAENGE.filter((r) => r.id !== mitglied.role).map((r) => (
              <button type="button" key={r.id} className="hb-mg" onClick={() => befoerdern(r)}>
                <span className="hb-mg-name">
                  <strong>{r.wort}</strong>
                  {r.hinweis && <small className="is-leise">{r.hinweis}</small>}
                </span>
                <span className="hb-pf" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>
        <button type="button" className="hb-kn is-gefahr is-breit" onClick={rauswerfen}>
          {t('clan.rauswerfen')}
        </button>
        {rueckfrage}
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{mitglied.displayName}</h2>
        <p className="muted">
          {tf('clan.mitglied.zeile', { rolle: rolle(mitglied.role), trophaeen: mitglied.trophies })}
        </p>
        <button className="clan-blattknopf" onClick={() => onShowProfile(mitglied.accountId)}>
          {t('clan.profilAnsehen')}
        </button>

        <h3 className="hub-abschnitt">{t('clan.rang')}</h3>
        {RAENGE.filter((r) => r.id !== mitglied.role).map((r) => (
          <button
            key={r.id}
            className="clan-blattknopf"
            onClick={() => befoerdern(r)}
          >
            {r.wort}
            {r.hinweis && <span className="muted"> · {r.hinweis}</span>}
          </button>
        ))}

        <button
          className="clan-blattknopf is-gefahr"
          onClick={rauswerfen}
        >
          {t('clan.rauswerfen')}
        </button>
        <button className="hub-mini" onClick={onClose}>
          {t('clan.abbrechen')}
        </button>
      </div>
    </div>
  );
}

function AnfragenBlatt({
  detail,
  onClose,
  onShowProfile,
  onAktion,
  neu = false,
}: {
  detail: ClubDetail;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
  /** Neues Hub: Blatt von unten. */
  neu?: boolean;
}): React.JSX.Element {
  if (neu) {
    return (
      <HbBlatt titel={t('clan.anfragen')} onClose={onClose}>
        {detail.requests.length === 0 ? (
          <p className="hb-klein hb-ohne-rand">{t('clan.anfragen.leer')}</p>
        ) : (
          <div className="hb-liste">
            {detail.requests.map((r, i) => (
              <div className="hb-mg" key={r.accountId}>
                <img src={bildFuer(r, i)} alt="" draggable={false} />
                <button type="button" className="hb-mg-name hb-mg-knopf" onClick={() => onShowProfile(r.accountId)}>
                  <strong>{r.displayName}</strong>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {r.trophies.toLocaleString('de-DE')}
                  </span>
                </button>
                <span className="hb-mg-knoepfe">
                  <button
                    type="button"
                    className="hb-kn is-kontur is-klein"
                    onClick={() => onAktion(api.acceptClubRequest(detail.id, r.accountId))}
                    aria-label={tf('clan.aufnehmen.aria', { name: r.displayName })}
                  >
                    {t('clan.aufnehmen')}
                  </button>
                  <button
                    type="button"
                    className="hb-kn is-zweit is-klein"
                    onClick={() => onAktion(api.rejectClubRequest(detail.id, r.accountId))}
                    aria-label={tf('clan.ablehnen.aria', { name: r.displayName })}
                  >
                    {t('clan.nein')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </HbBlatt>
    );
  }
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{t('clan.anfragen')}</h2>
        {detail.requests.length === 0 && <p className="muted">{t('clan.anfragen.leer')}</p>}
        {detail.requests.map((r, i) => (
          <div className="clan-anfrage" key={r.accountId}>
            <img className="clan-avatar" src={bildFuer(r, i)} alt="" draggable={false} />
            <button className="clan-zeile-name" onClick={() => onShowProfile(r.accountId)}>
              {r.displayName}
            </button>
            <span className="clan-zeile-trophaeen">
              <img src="/hub/pokal.png" alt="" aria-hidden="true" />
              {r.trophies}
            </span>
            <button
              className="hub-mini hub-mini--ja"
              onClick={() => onAktion(api.acceptClubRequest(detail.id, r.accountId))}
            >
              {t('clan.aufnehmen')}
            </button>
            <button
              className="hub-mini"
              onClick={() => onAktion(api.rejectClubRequest(detail.id, r.accountId))}
            >
              {t('clan.nein')}
            </button>
          </div>
        ))}
        <button className="hub-mini" onClick={onClose}>
          {t('clan.fertig')}
        </button>
      </div>
    </div>
  );
}

function EinstellungenBlatt({
  darfAendern,
  detail,
  onClose,
  onAktion,
  neu = false,
}: {
  detail: ClubDetail;
  /**
   * Aendern duerfen nur Anfuehrer und Vize — sehen darf jeder.
   *
   * Wer in einem Clan ist, soll nachlesen koennen, was dort gilt:
   * Beitrittsart, Trophaeenschwelle, Name. Diese Angaben zu verstecken,
   * weil man sie nicht aendern darf, waere unnoetige Heimlichtuerei.
   */
  darfAendern: boolean;
  onClose: () => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
  /** Neues Hub: Blatt von unten mit den neuen Feldern. */
  neu?: boolean;
}): React.JSX.Element {
  const meineWappen = useMeineWappen();
  const [name, setName] = useState(detail.name);
  const [motto, setMotto] = useState(detail.motto ?? '');
  const [crest, setCrest] = useState(detail.crest);
  const [joinMode, setJoinMode] = useState<JoinMode>(detail.joinMode);
  const [minTrophies, setMinTrophies] = useState(String(detail.minTrophies));

  const speichern = (): void =>
    onAktion(
      api.updateClub(detail.id, {
        name,
        motto: motto.trim() === '' ? null : motto,
        crest,
        joinMode,
        minTrophies: Number(minTrophies) || 0,
      }),
      onClose,
    );
  const felder = (mitNeu: boolean): React.JSX.Element => (
    <ClanFelder
      neu={mitNeu}
      gesperrt={!darfAendern}
      name={name}
      setName={setName}
      motto={motto}
      setMotto={setMotto}
      crest={crest}
      setCrest={setCrest}
      joinMode={joinMode}
      setJoinMode={setJoinMode}
      minTrophies={minTrophies}
      setMinTrophies={setMinTrophies}
      meineWappen={meineWappen}
    />
  );

  if (neu) {
    return (
      <HbBlatt titel={t('clan.regeln')} onClose={onClose}>
        {felder(true)}
        {darfAendern ? (
          <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={speichern}>
            {t('clan.speichern')}
          </button>
        ) : (
          <p className="hb-klein hb-ohne-rand">{t('clan.nurLeitung')}</p>
        )}
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{t('clan.einstellungen')}</h2>
        <ClanFelder
          gesperrt={!darfAendern}
          name={name}
          setName={setName}
          motto={motto}
          setMotto={setMotto}
          crest={crest}
          setCrest={setCrest}
          joinMode={joinMode}
          setJoinMode={setJoinMode}
          minTrophies={minTrophies}
          setMinTrophies={setMinTrophies}
          meineWappen={meineWappen}
        />
        {!darfAendern && (
          <p className="muted">{t('clan.nurLeitung')}</p>
        )}
        {darfAendern && (
        <button className="primary" onClick={speichern}>
          {t('clan.speichern')}
        </button>
        )}
        <button className="hub-mini" onClick={onClose}>
          {t('clan.abbrechen')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suche: man ist in keinem Clan
// ---------------------------------------------------------------------------

function Suche({
  fehler,
  onBeitreten,
  onZuruecknehmen,
  onGruenden,
  neu = false,
}: {
  /** Neues Hub: Burghalle als Kopf, Liste und Gold-Hauptknopf „Clan gründen". */
  neu?: boolean;
  fehler: string | null;
  onBeitreten: (clubId: string) => void;
  onZuruecknehmen: (clubId: string) => void;
  onGruenden: () => void;
}): React.JSX.Element {
  const [clubs, setClubs] = useState<ClubSummary[] | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [suche, setSuche] = useState('');

  // Beim Tippen mitsuchen, aber erst nach einer kurzen Pause — sonst laeuft
  // je Buchstabe eine Abfrage.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void api
        .clubs(suche.trim() || undefined)
        .then((antwort) => {
          setClubs(antwort.clubs);
          setPending(antwort.pending);
        })
        .catch(() => setClubs([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [suche]);

  if (neu) {
    return (
      <div className="hb-clan">
        <div className="hb-clan-held is-kurz" style={{ backgroundImage: 'url(/hub/bg-clanhalle.webp)' }}>
          <h1>{t('clan.clans')}</h1>
          <small>{t('clan.suche.untertitel')}</small>
        </div>
        <div className="hb-clan-inhalt">
          <input
            className="hb-feld is-suche"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t('clan.suche.platzhalter')}
            aria-label={t('clan.suche.aria')}
          />
          {fehler && <p className="hb-fehler">{fehler}</p>}

          <div className="hb-liste">
            {clubs === null && <p className="hb-klein hb-liste-leer">{t('clan.laden')}</p>}
            {clubs?.length === 0 && (
              <p className="hb-klein hb-liste-leer">
                {suche.trim() ? t('clan.suche.keinTreffer') : t('clan.suche.leer')}
              </p>
            )}
            {clubs?.map((c) => {
              const angefragt = pending.includes(c.id);
              return (
                <div className="hb-mg" key={c.id}>
                  <img className="hb-mg-wappen" src={wappenBild(c.crest)} alt="" draggable={false} />
                  <span className="hb-mg-name">
                    <strong>{c.name}</strong>
                    <small className="is-leise">
                      {c.members}/{c.maxMembers} · {c.joinMode === 'open' ? t('clan.beitritt.offen') : t('clan.beitritt.aufAnfrage')}
                      {c.minTrophies > 0 ? ` · ${tf('clan.ab', { n: c.minTrophies.toLocaleString('de-DE') })}` : ''}
                    </small>
                    {angefragt && <small>{t('clan.angefragt')}</small>}
                  </span>
                  {/* Goldkontur statt Goldfläche: Gefüllt ist nur der eine
                      Hauptknopf der Seite, hier „Clan gründen" (DESIGN.md). */}
                  {angefragt ? (
                    <button
                      type="button"
                      className="hb-kn is-zweit is-klein"
                      onClick={() => onZuruecknehmen(c.id)}
                      aria-label={tf('clan.zuruecknehmen.aria', { name: c.name })}
                    >
                      {t('clan.zuruecknehmen')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hb-kn is-kontur is-klein"
                      onClick={() => onBeitreten(c.id)}
                      aria-label={tf(c.joinMode === 'open' ? 'clan.beitreten.aria' : 'clan.beitrittAnfragen.aria', { name: c.name })}
                    >
                      {c.joinMode === 'open' ? t('clan.beitreten') : t('clan.beitrittAnfragen')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hb-fuss-haftend">
            <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onGruenden}>
              {t('clan.gruenden')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HubSzene bg="/hub/bg-clan-suche.webp" className="front-clan">
      <HubBanner />

      <h1 className="lobby-schild">{t('clan.clans')}</h1>

      <div className="lobby-suche">
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t('clan.suche.platzhalter')}
          aria-label={t('clan.suche.aria')}
        />
      </div>

      {fehler && <p className="clan-fehler">{fehler}</p>}

      <div className="clan-rollen clan-rollen--suche">
        {clubs === null && <Ladekreis />}
        {clubs?.length === 0 && (
          <p className="muted">
            {suche.trim()
              ? t('clan.suche.keinTreffer')
              : t('clan.suche.leer')}
          </p>
        )}
        {clubs?.map((c) => {
          const angefragt = pending.includes(c.id);
          return (
            <div className="lobby-tisch clan-treffer" key={c.id}>
              <img className="clan-treffer-wappen" src={wappenBild(c.crest)} alt="" />
              <span className="clan-treffer-text">
                <strong>{c.name}</strong>
                <span className="muted">
                  {c.members}/{c.maxMembers} ·{' '}
                  {c.joinMode === 'open' ? t('clan.beitritt.offen') : t('clan.beitritt.aufAnfrage')}
                  {c.minTrophies > 0 ? ` · ${tf('clan.abTrophaeen', { n: c.minTrophies })}` : ''}
                </span>
              </span>
              {angefragt ? (
                <button className="hub-mini" onClick={() => onZuruecknehmen(c.id)}>
                  {t('clan.angefragt')}
                </button>
              ) : (
                <button className="hub-mini hub-mini--ja" onClick={() => onBeitreten(c.id)}>
                  {c.joinMode === 'open' ? t('clan.beitreten') : t('clan.beitrittAnfragen')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="lobby-fuss">
        <button className="lobby-grossknopf" onClick={onGruenden}>
          {t('clan.gruenden')}
        </button>
      </div>
    </HubSzene>
  );
}

// ---------------------------------------------------------------------------
// Gruenden
// ---------------------------------------------------------------------------

function Gruenden({
  fehler,
  onFehler,
  onAbbruch,
  onFertig,
  neu = false,
}: {
  /** Neues Hub: Vorschau von Wappen und Name auf der Burghalle, Felder darunter. */
  neu?: boolean;
  fehler: string | null;
  onFehler: (text: string | null) => void;
  onAbbruch: () => void;
  onFertig: () => void;
}): React.JSX.Element {
  const meineWappen = useMeineWappen();
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [crest, setCrest] = useState<string>(WAPPEN[0]);
  const [joinMode, setJoinMode] = useState<JoinMode>('on_request');
  const [minTrophies, setMinTrophies] = useState('0');
  const [laeuft, setLaeuft] = useState(false);

  const gruenden = (): void => {
    setLaeuft(true);
    onFehler(null);
    void api
      .createClub({
        name,
        crest,
        motto: motto.trim() === '' ? null : motto,
        joinMode,
        minTrophies: Number(minTrophies) || 0,
      })
      .then(onFertig)
      .catch((e: unknown) => onFehler(fehlertext(e)))
      .finally(() => setLaeuft(false));
  };

  if (neu) {
    return (
      <div className="hb-clan">
        {/* Oben steht schon, wie der Clan aussehen wird: Wappen, Name,
            Wahlspruch wandern beim Tippen mit — wie die Halle danach. */}
        <div className="hb-clan-held is-kurz" style={{ backgroundImage: 'url(/hub/bg-clanhalle.webp)' }}>
          <div className="hb-clan-zurueck">
            <Zurueck onClick={onAbbruch} label={t('clan.gruenden.zurueckAria')} />
          </div>
          <img className="hb-wappen" src={wappenBild(crest)} alt="" draggable={false} />
          <h1>{name.trim() || t('clan.gruenden')}</h1>
          <small>{motto.trim() ? tf('clan.motto.zitat', { motto: motto.trim() }) : t('clan.gruenden.vorschau')}</small>
        </div>
        <div className="hb-clan-inhalt">
          <ClanFelder
            neu
            name={name}
            setName={setName}
            motto={motto}
            setMotto={setMotto}
            crest={crest}
            setCrest={setCrest}
            joinMode={joinMode}
            setJoinMode={setJoinMode}
            minTrophies={minTrophies}
            setMinTrophies={setMinTrophies}
            meineWappen={meineWappen}
          />
          {fehler && <p className="hb-fehler">{fehler}</p>}
          <button
            type="button"
            className="hb-kn is-gold is-haupt is-breit"
            disabled={laeuft || name.trim().length < 3}
            onClick={gruenden}
          >
            {laeuft ? t('clan.gruenden.laeuft') : t('clan.gruenden.knopf')}
          </button>
          <button type="button" className="hb-leise-knopf" onClick={onAbbruch}>
            {t('clan.zurueck')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <HubSzene bg="/hub/bg-clan-gruenden.webp" className="front-clan">
      <HubBanner />

      <h1 className="lobby-schild">{t('clan.gruenden')}</h1>

      <div className="lobby-tafel clan-tafel">
        <ClanFelder
          name={name}
          setName={setName}
          motto={motto}
          setMotto={setMotto}
          crest={crest}
          setCrest={setCrest}
          joinMode={joinMode}
          setJoinMode={setJoinMode}
          minTrophies={minTrophies}
          setMinTrophies={setMinTrophies}
          meineWappen={meineWappen}
        />
        {fehler && <p className="clan-fehler">{fehler}</p>}
      </div>

      <div className="lobby-fuss">
        <button className="hub-mini" onClick={onAbbruch}>
          {t('clan.zurueck')}
        </button>
        <button
          className="lobby-grossknopf"
          disabled={laeuft || name.trim().length < 3}
          onClick={gruenden}
        >
          {t('clan.gruenden.knopf')}
        </button>
      </div>
    </HubSzene>
  );
}

/** Die Felder, die Gruenden und Einstellungen gemeinsam haben. */
function ClanFelder({
  gesperrt,
  name,
  setName,
  motto,
  setMotto,
  crest,
  setCrest,
  joinMode,
  setJoinMode,
  minTrophies,
  setMinTrophies,
  meineWappen,
  neu = false,
}: {
  /** Neues Hub: dieselben Felder als dunkle Eingaben und Chips. */
  neu?: boolean;
  /** Nur-Lesen-Ansicht: Felder stehen da, lassen sich aber nicht aendern. */
  gesperrt?: boolean;
  name: string;
  setName: (v: string) => void;
  motto: string;
  setMotto: (v: string) => void;
  crest: string;
  setCrest: (v: string) => void;
  joinMode: JoinMode;
  setJoinMode: (v: JoinMode) => void;
  minTrophies: string;
  setMinTrophies: (v: string) => void;
  /** Wappen, die dem Konto gehoeren. `null` = noch nicht geladen. */
  meineWappen: Set<string> | null;
}): React.JSX.Element {
  // Gesperrte Wappen stehen trotzdem da — sonst erfaehrt niemand, dass es sie
  // gibt. Antippen fuehrt nicht ins Leere, sondern sagt, wo man sie bekommt.
  const waehleWappen = (w: string, mein: boolean): void => {
    if (!mein) {
      window.alert(t('clan.wappen.imShopHinweis'));
      return;
    }
    setCrest(w);
  };

  if (neu) {
    return (
      <div className="hb-felder">
        <label className="hb-feldzeile">
          <span>{t('clan.feld.name')}</span>
          <input
            className="hb-feld"
            disabled={gesperrt}
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('clan.feld.nameBeispiel')}
          />
          <small>{t('clan.feld.nameHinweis')}</small>
        </label>
        <label className="hb-feldzeile">
          <span>{t('clan.feld.wahlspruch')}</span>
          <input
            className="hb-feld"
            disabled={gesperrt}
            value={motto}
            maxLength={120}
            onChange={(e) => setMotto(e.target.value)}
            placeholder={t('clan.feld.optional')}
          />
        </label>
        <fieldset className="hb-feldzeile hb-wappenwahl">
          <legend>{t('clan.feld.wappen')}</legend>
          <div className="hb-wappenraster">
            {/* In der App gibt es den Wappen-Shop nicht — dort nur, was dem
                Konto gehört, statt Schlösser, die nirgendwohin führen. Auf
                der Webseite ebenso ohne Shop im Umfang. */}
            {WAPPEN.filter((w) => (!inApp && imUmfang('shop')) || meineWappen === null || meineWappen.has(w)).map((w) => {
              const mein = meineWappen === null || meineWappen.has(w);
              return (
                <button
                  key={w}
                  type="button"
                  className={`hb-wappenknopf${crest === w ? ' is-an' : ''}${mein ? '' : ' is-zu'}`}
                  disabled={gesperrt}
                  aria-pressed={crest === w}
                  aria-label={tf(mein ? 'clan.wappen.aria' : 'clan.wappen.ariaShop', { n: w.replace('wappen-', '') })}
                  onClick={() => waehleWappen(w, mein)}
                >
                  <img src={wappenBild(w)} alt="" draggable={false} />
                  {!mein && (
                    <span className="hb-wappen-schloss" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="hb-ic" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="hb-feldzeile">
          <span>{t('clan.feld.beitritt')}</span>
          <div className="hb-chips is-innen">
            {(
              [
                ['open', 'clan.beitritt.offen'],
                ['on_request', 'clan.beitritt.aufAnfrage'],
              ] as const
            ).map(([modus, wort]) => (
              <button
                key={modus}
                type="button"
                disabled={gesperrt}
                className={`hb-chip${joinMode === modus ? ' is-an' : ''}`}
                aria-pressed={joinMode === modus}
                onClick={() => setJoinMode(modus)}
              >
                {t(wort)}
              </button>
            ))}
          </div>
        </div>
        <label className="hb-feldzeile">
          <span>{t('clan.feld.abTrophaeen')}</span>
          <input
            className="hb-feld"
            type="number"
            disabled={gesperrt}
            min={0}
            inputMode="numeric"
            value={minTrophies}
            onChange={(e) => setMinTrophies(e.target.value)}
          />
          <small>{t('clan.feld.schwelleHinweis')}</small>
        </label>
      </div>
    );
  }

  return (
    <>
      <label className="clan-feld">
        <span>{t('clan.feld.name')}</span>
        <input
          disabled={gesperrt}
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('clan.feld.nameBeispiel')}
        />
      </label>

      <label className="clan-feld">
        <span>{t('clan.feld.spruch')}</span>
        <input
          disabled={gesperrt}
          value={motto}
          maxLength={120}
          onChange={(e) => setMotto(e.target.value)}
          placeholder={t('clan.feld.optional')}
        />
      </label>

      <fieldset className="clan-wappenwahl">
        <legend>{t('clan.feld.wappen')}</legend>
        <div className="clan-wappenraster">
          {WAPPEN.map((w) => {
            const mein = meineWappen === null || meineWappen.has(w);
            return (
              <button
                key={w}
                type="button"
                className={`clan-wappen${crest === w ? ' is-an' : ''}${mein ? '' : ' is-zu'}`}
                disabled={gesperrt}
                aria-pressed={crest === w}
                title={mein ? undefined : t('clan.wappen.imShop')}
                onClick={() => waehleWappen(w, mein)}
              >
                <img src={wappenBild(w)} alt="" draggable={false} />
                {!mein && <span className="clan-wappen-schloss">🔒</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="clan-feld">
        <span>{t('clan.feld.beitritt')}</span>
        <div className="lobby-chips">
          <button
            type="button"
            disabled={gesperrt}
            className={`lobby-chip${joinMode === 'open' ? ' is-an' : ''}`}
            aria-pressed={joinMode === 'open'}
            onClick={() => setJoinMode('open')}
          >
            {t('clan.beitritt.offen')}
          </button>
          <button
            type="button"
            disabled={gesperrt}
            className={`lobby-chip${joinMode === 'on_request' ? ' is-an' : ''}`}
            aria-pressed={joinMode === 'on_request'}
            onClick={() => setJoinMode('on_request')}
          >
            {t('clan.beitritt.aufAnfrage')}
          </button>
        </div>
      </div>

      <label className="clan-feld">
        <span>{t('clan.feld.abTrophaeen')}</span>
        <input
          type="number"
          disabled={gesperrt}
          min={0}
          inputMode="numeric"
          value={minTrophies}
          onChange={(e) => setMinTrophies(e.target.value)}
        />
      </label>
    </>
  );
}

/**
 * Die Clanhalle im neuen Hub (Entwurf „Nachtblau & Gold", Fassung 4).
 *
 * Dieselben Funktionen wie `Halle`, nur neu angeordnet: Wappen und Name auf
 * der Burghalle, oben rechts Chat (nur Web), Anfragen (Leitung) und die
 * Clanregeln, darunter der Clankrieg mit Stand, dann die Mitglieder.
 * Mitglieds-, Anfragen- und Regelblatt sind dieselben wie in der alten Halle
 * (dieselben Aufrufe und Rückfragen), nur als Blatt des neuen Hubs (`neu`).
 *
 * „Clantisch starten" und „Einladen" aus dem Entwurf gibt es im Code nicht —
 * sie stehen deshalb hier nicht (FAKTENBLATT.md: nichts erfinden).
 */
function HalleNeu({
  detail,
  meId,
  fehler,
  onBald,
  onShowProfile,
  onAktion,
  onClanwort,
}: {
  detail: ClubDetail | null;
  meId: string | null;
  fehler: string | null;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
  onClanwort?: () => void;
}): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState<ClubMemberView | null>(null);
  const [blatt, setBlatt] = useState<'anfragen' | 'einstellungen' | null>(null);
  const [voll, setVoll] = useState<'chat' | 'krieg' | null>(null);
  const [krieg, setKrieg] = useState<WarState | null>(null);
  const [frage, rueckfrage] = useRueckfrage();

  useEffect(() => {
    // Clankrieg in der App vorerst raus (Emile, 22.10.2026) — dann auch nicht
    // laden. Ebenso, wenn er nicht im Umfang der Ausgabe steht (umfang.ts).
    if (!detail || inApp || !imUmfang('clankrieg')) return;
    let lebt = true;
    void api
      .clubWar(detail.id)
      .then((k) => lebt && setKrieg(k))
      .catch(() => lebt && setKrieg(null));
    return () => {
      lebt = false;
    };
  }, [detail?.id]);

  const darfVerwalten = istLeitung(detail?.myRole);
  const offen = detail?.requests.length ?? 0;
  // Chat und Krieg nur, wenn die Ausgabe sie anbietet (umfang.ts) — die
  // Routen sperrt der Server dann ohnehin.
  const mitChat = !inApp && imUmfang('clanchat');
  const mitKrieg = imUmfang('clankrieg');

  if (voll === 'chat' && detail && mitChat) {
    return (
      <ClanChat clubId={detail.id} meId={meId} darfLoeschen={darfVerwalten} onClose={() => setVoll(null)} onShowProfile={onShowProfile} />
    );
  }
  if (voll === 'krieg' && detail && mitKrieg) {
    return <ClanKrieg neu clubId={detail.id} onClose={() => setVoll(null)} />;
  }

  const k = krieg?.aktuell ?? null;
  const laeuft = k?.status === 'laeuft' && k.gegner;
  const restStunden = k?.endsAt ? Math.max(0, Math.round((new Date(k.endsAt).getTime() - Date.now()) / 3600000)) : null;
  const summe = laeuft ? Math.max(1, k.wir.score + k.gegner!.score) : 1;

  const symbol = (d: React.ReactNode): React.JSX.Element => (
    <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );

  return (
    <div className="hb-clan">
      <div className="hb-clan-held" style={{ backgroundImage: 'url(/hub/bg-clanhalle.webp)' }}>
        <div className="hb-clan-knoepfe">
          {mitChat && (
            <button type="button" className="hb-rund" onClick={() => setVoll('chat')} aria-label={t('clan.chatAria')}>
              {symbol(<path d="M4 5h16v11H9l-5 4z" />)}
            </button>
          )}
          {darfVerwalten && (
            <button type="button" className="hb-rund" onClick={() => setBlatt('anfragen')} aria-label={offen > 0 ? tf('clan.anfragen.offen', { n: offen }) : t('clan.anfragen')}>
              {symbol(
                <>
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M16 14c3 0 5 2 5 5" />
                </>,
              )}
              {offen > 0 && (
                <span className="hb-badge" aria-hidden="true">
                  {offen}
                </span>
              )}
            </button>
          )}
          <button type="button" className="hb-rund" onClick={() => setBlatt('einstellungen')} aria-label={t('clan.einstellungenAria')}>
            {symbol(
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
              </>,
            )}
          </button>
        </div>
        <img className="hb-wappen" src={wappenBild(detail?.crest)} alt="" draggable={false} />
        <h1>{detail?.name ?? '…'}</h1>
        <small>{detail?.motto ? tf('clan.motto.zitat', { motto: detail.motto }) : detail ? t('clan.mottoLeer') : t('clan.laden')}</small>
        {detail && (
          <div className="hb-kz">
            <span>
              <b>
                {detail.members} / {detail.maxMembers}
              </b>
              {t('clan.mitglieder')}
            </span>
            {/* Beitrittsart oben, Schwelle darunter. Vorher stand hier nur die
                Schwelle, bei 0 als „offen / für alle" — und ein Clan „auf
                Anfrage" sah damit aus wie ein offener. */}
            <span>
              <b>{detail.joinMode === 'open' ? t('clan.kz.offen') : t('clan.kz.aufAnfrage')}</b>
              {detail.minTrophies > 0
                ? tf('clan.abTrophaeen', { n: detail.minTrophies.toLocaleString('de-DE') })
                : t('clan.kz.ohneSchwelle')}
            </span>
            <span>
              <b>{detail.trophies.toLocaleString('de-DE')}</b>
              {t('clan.kz.clanTrophaeen')}
            </span>
          </div>
        )}
      </div>

      <div className="hb-clan-inhalt">
        {fehler && <p className="hb-fehler">{fehler}</p>}

        {!inApp && mitKrieg && (
        <button type="button" className="hb-krieg" onClick={() => setVoll('krieg')}>
          <span className="hb-kr-kopf">
            <strong>{t('clankrieg.titel')}</strong>
            <small>
              {laeuft
                ? restStunden !== null
                  ? tf('clan.krieg.restUndZaehlen', { n: restStunden })
                  : t('clan.krieg.alleZaehlen')
                : k?.status === 'suche'
                  ? t('clan.krieg.suche')
                  : k?.status === 'angefragt'
                    ? t('clan.krieg.angefragt')
                    : t('clan.krieg.einstieg')}
            </small>
          </span>
          {laeuft ? (
            <>
              <span className="hb-kr-vs">
                <span className="hb-kr-seite">
                  <img src={wappenBild(k.wir.crest)} alt="" />
                  <b>{k.wir.score}</b>
                  <small>{t('clan.krieg.wir')}</small>
                </span>
                <span className="hb-vs">VS</span>
                <span className="hb-kr-seite is-gegner">
                  <img src={wappenBild(k.gegner!.crest)} alt="" />
                  <b>{k.gegner!.score}</b>
                  <small>{k.gegner!.name}</small>
                </span>
              </span>
              <span className="hb-kr-balken" aria-hidden="true">
                <span style={{ width: `${Math.round((k.wir.score / summe) * 100)}%` }} />
              </span>
              <small className="hb-kr-regel">{t('clan.krieg.regel')}</small>
            </>
          ) : (
            <span className="hb-kr-leer">
              {krieg?.letzter?.ergebnis
                ? t(
                    krieg.letzter.ergebnis === 'wir'
                      ? 'clan.krieg.letzter.wir'
                      : krieg.letzter.ergebnis === 'gegner'
                        ? 'clan.krieg.letzter.gegner'
                        : 'clan.krieg.letzter.gleich',
                  )
                : t('clan.krieg.keiner')}
              <span className="hb-kn is-gold">{krieg?.darfFuehren ? t('clan.krieg.starten') : t('clan.krieg.ansehen')}</span>
            </span>
          )}
        </button>
        )}

        {/* Clanwort (Emile, 23.10.2026): ein ausgelostes Mitglied waehlt, alle raten. */}
        {onClanwort && (
          <button type="button" className="hb-zeile hb-clanwort-zeile" onClick={onClanwort}>
            <span className="hb-zeile-bild hb-clanwort-bild" aria-hidden="true">
              <i>W</i>
              <i>O</i>
              <i>R</i>
            </span>
            <span>
              <strong>Clanwort</strong>
              <small>{t('clan.clanwort.text')}</small>
            </span>
            <span className="hb-pf" aria-hidden="true">
              ›
            </span>
          </button>
        )}

        <button type="button" className="hb-zeile" onClick={() => onBald(t('clan.truhe'))}>
          <img className="hb-zeile-bild" src="/hub/truhe-gold.webp" alt="" />
          <span>
            <strong>{t('clan.truhe')}</strong>
            <small>{t('clan.truhe.text')}</small>
          </span>
          <span className="hb-bald-marke">{t('clan.bald')}</span>
        </button>

        <section className="hb-blk">
          <h2 className="hb-ab">
            {t('clan.mitglieder')}
            {detail && <span className="hb-ab-zusatz">{detail.members}</span>}
          </h2>
          <div className="hb-liste">
            {detail === null && <p className="hb-klein hb-liste-leer">{t('clan.laden')}</p>}
            {detail?.memberList.map((m, i) => (
              <button
                type="button"
                key={m.accountId}
                className={`hb-mg${m.accountId === meId ? ' is-du' : ''}`}
                onClick={() => (darfVerwalten ? setGewaehlt(m) : onShowProfile(m.accountId))}
              >
                <span className="hb-rl-rang">{i + 1}</span>
                <img src={bildFuer(m, i)} alt="" draggable={false} />
                <span className="hb-mg-name">
                  <strong>{m.displayName}</strong>
                  <small>{rolle(m.role)}</small>
                </span>
                <span className="hb-pk">
                  <img src="/hub/symbol-pokal.webp" alt="" />
                  {m.trophies.toLocaleString('de-DE')}
                </span>
              </button>
            ))}
          </div>
        </section>

        {detail && (
          <button
            type="button"
            className="hb-leise-knopf"
            onClick={() =>
              frage({ titel: tf('clan.verlassen.titel', { name: detail.name }), text: t('clan.verlassen.text'), ja: t('clan.verlassen'), gefahr: true }, () =>
                onAktion(api.leaveClub(detail.id)),
              )
            }
          >
            {t('clan.verlassen')}
          </button>
        )}
      </div>
      {rueckfrage}

      {gewaehlt && detail && (
        <MitgliedBlatt neu mitglied={gewaehlt} clubId={detail.id} onClose={() => setGewaehlt(null)} onShowProfile={onShowProfile} onAktion={onAktion} />
      )}
      {blatt === 'anfragen' && detail && (
        <AnfragenBlatt neu detail={detail} onClose={() => setBlatt(null)} onShowProfile={onShowProfile} onAktion={onAktion} />
      )}
      {blatt === 'einstellungen' && detail && (
        <EinstellungenBlatt neu darfAendern={darfVerwalten} detail={detail} onClose={() => setBlatt(null)} onAktion={onAktion} />
      )}
    </div>
  );
}
