import { useEffect, useState } from 'react';

import {
  ApiError,
  WAPPEN,
  api,
  type ClubDetail,
  type ClubMemberView,
  type ClubSummary,
  type JoinMode,
} from '../api';
import { HubBanner, HubSzene } from '../hub';

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

const ROLLE: Record<string, string> = {
  admin: 'Admin',
  member: 'Mitglied',
  guest: 'Gast',
};

/**
 * Bild eines Mitglieds: das eigene, sonst ein Pinguin.
 *
 * `hasAvatar` kommt vom Server, damit nicht je Mitglied eine Anfrage auf
 * /api/avatars ins Leere laeuft — bei 50 Mitgliedern waeren das 50 Fehler.
 * Der Pinguin wechselt mit der Position, damit vier Zeilen untereinander
 * nicht viermal dasselbe Bild zeigen.
 */
function bildFuer(m: { accountId: string; hasAvatar: boolean }, i: number): string {
  return m.hasAvatar ? `/api/avatars/${m.accountId}` : `/hub/pinguin-${(i % 4) + 1}.png`;
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
        {bald && <span className="front-bald-tag">Bald</span>}
      </span>
      <span className="clan-icon-wort">{label}</span>
    </button>
  );
}

export function Clan({
  clanId,
  onBald,
  onShowProfile,
  onMeChange,
}: {
  /** Der eine Clan des Kontos, oder `null`. */
  clanId: string | null;
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

  return (
    <Halle
      detail={detail}
      fehler={fehler}
      onBald={onBald}
      onShowProfile={onShowProfile}
      onAktion={tue}
    />
  );
}

/** Macht aus einem Fehler einen Satz, den man lesen kann. */
function fehlertext(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'alreadyInClub':
      return 'Du bist schon in einem Clan. Tritt erst aus.';
    case 'clubNameTaken':
      return 'Diesen Namen gibt es schon.';
    case 'clubNameLength':
      return 'Der Name braucht 3 bis 24 Zeichen.';
    case 'clubMottoLength':
      return 'Der Spruch ist zu lang.';
    case 'clubFull':
      return 'Der Clan ist voll.';
    case 'clubTrophiesTooLow':
      return 'Dafür fehlen dir noch Trophäen.';
    case 'notClubAdmin':
      return 'Das darf nur der Admin.';
    default:
      return 'Hat nicht geklappt. Versuch es nochmal.';
  }
}

// ---------------------------------------------------------------------------
// Die Halle: man ist im Clan
// ---------------------------------------------------------------------------

function Halle({
  detail,
  fehler,
  onBald,
  onShowProfile,
  onAktion,
}: {
  detail: ClubDetail | null;
  fehler: string | null;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  /** Angetipptes Mitglied — oeffnet die Aktionen des Admins. */
  const [gewaehlt, setGewaehlt] = useState<ClubMemberView | null>(null);
  const [blatt, setBlatt] = useState<'anfragen' | 'einstellungen' | null>(null);

  const istAdmin = detail?.myRole === 'admin';
  const offen = detail?.requests.length ?? 0;

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
            {detail?.motto ?? (detail ? 'Für alle Spiele' : 'Wird geladen…')}
          </span>
          <div className="hub-clanschild-zahlen">
            <span>
              <img src="/hub/tab-clan.webp" alt="" aria-hidden="true" />
              {detail ? `${detail.members}/${detail.maxMembers}` : '–'}
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
        drei ersten sind ehrliche Platzhalter: Sie sagen beim Antippen, dass
        es sie noch nicht gibt — die Halle soll aber schon aussehen wie eine
        Halle und nicht wie eine Baustelle. Die beiden letzten arbeiten und
        stehen nur beim Admin.
      */}
      <div className="clan-icons">
        <IconKnopf icon="chat" label="Chat" bald onClick={() => onBald('Clanchat')} />
        <IconKnopf icon="truhe" label="Truhe" bald onClick={() => onBald('Clantruhe')} />
        <IconKnopf icon="krieg" label="Krieg" bald onClick={() => onBald('Clankrieg')} />
        {istAdmin && (
          <IconKnopf
            icon="anfragen"
            label="Anfragen"
            zaehler={offen}
            onClick={() => setBlatt('anfragen')}
          />
        )}
        {istAdmin && (
          <IconKnopf
            icon="einstellungen"
            label="Clan"
            onClick={() => setBlatt('einstellungen')}
          />
        )}
      </div>

      {fehler && <p className="clan-fehler">{fehler}</p>}

      <section className="clan-liste">
        <header className="clan-liste-kopf">
          <h2>Mitglieder</h2>
          {detail && (
            <span className="clan-liste-zahl">
              {detail.members}/{detail.maxMembers}
            </span>
          )}
        </header>

        <div className="clan-rollen">
          {detail === null && <p className="muted">Wird geladen…</p>}
          {detail?.memberList.map((m, i) => (
            <button
              key={m.accountId}
              className="clan-zeile"
              onClick={() => (istAdmin ? setGewaehlt(m) : onShowProfile(m.accountId))}
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
              <span className={`clan-rolle is-${m.role}`}>{ROLLE[m.role]}</span>
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
            if (!window.confirm(`Den Clan „${detail.name}" wirklich verlassen?`)) return;
            onAktion(api.leaveClub(detail.id));
          }}
        >
          Clan verlassen
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
}: {
  mitglied: ClubMemberView;
  clubId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{mitglied.displayName}</h2>
        <p className="muted">
          {ROLLE[mitglied.role]} · {mitglied.trophies} Trophäen
        </p>
        <button className="clan-blattknopf" onClick={() => onShowProfile(mitglied.accountId)}>
          Profil ansehen
        </button>
        {mitglied.role !== 'admin' && (
          <button
            className="clan-blattknopf"
            onClick={() => {
              if (
                !window.confirm(
                  `${mitglied.displayName} zum Admin machen? Du gibst das Amt damit ab.`,
                )
              ) {
                return;
              }
              onAktion(api.setClubRole(clubId, mitglied.accountId, 'admin'), onClose);
            }}
          >
            Zum Admin machen
          </button>
        )}
        <button
          className="clan-blattknopf is-gefahr"
          onClick={() => {
            if (!window.confirm(`${mitglied.displayName} aus dem Clan werfen?`)) return;
            onAktion(api.kickClubMember(clubId, mitglied.accountId), onClose);
          }}
        >
          Rauswerfen
        </button>
        <button className="hub-mini" onClick={onClose}>
          Abbrechen
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
}: {
  detail: ClubDetail;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>Anfragen</h2>
        {detail.requests.length === 0 && <p className="muted">Gerade will niemand rein.</p>}
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
              Aufnehmen
            </button>
            <button
              className="hub-mini"
              onClick={() => onAktion(api.rejectClubRequest(detail.id, r.accountId))}
            >
              Nein
            </button>
          </div>
        ))}
        <button className="hub-mini" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}

function EinstellungenBlatt({
  detail,
  onClose,
  onAktion,
}: {
  detail: ClubDetail;
  onClose: () => void;
  onAktion: (aktion: Promise<unknown>, danach?: () => void) => void;
}): React.JSX.Element {
  const [name, setName] = useState(detail.name);
  const [motto, setMotto] = useState(detail.motto ?? '');
  const [crest, setCrest] = useState(detail.crest);
  const [joinMode, setJoinMode] = useState<JoinMode>(detail.joinMode);
  const [minTrophies, setMinTrophies] = useState(String(detail.minTrophies));

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card clan-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>Einstellungen</h2>
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
        />
        <button
          className="primary"
          onClick={() =>
            onAktion(
              api.updateClub(detail.id, {
                name,
                motto: motto.trim() === '' ? null : motto,
                crest,
                joinMode,
                minTrophies: Number(minTrophies) || 0,
              }),
              onClose,
            )
          }
        >
          Speichern
        </button>
        <button className="hub-mini" onClick={onClose}>
          Abbrechen
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
}: {
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

  return (
    <HubSzene bg="/hub/bg-clan-suche.webp" className="front-clan">
      <HubBanner />

      <h1 className="lobby-schild">Clans</h1>

      <div className="lobby-suche">
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Clan suchen…"
          aria-label="Clan suchen"
        />
      </div>

      {fehler && <p className="clan-fehler">{fehler}</p>}

      <div className="clan-rollen clan-rollen--suche">
        {clubs === null && <p className="muted">Wird geladen…</p>}
        {clubs?.length === 0 && (
          <p className="muted">
            {suche.trim()
              ? 'Kein Clan mit diesem Namen.'
              : 'Noch kein Clan da. Gründe den ersten.'}
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
                  {c.joinMode === 'open' ? 'Offen' : 'Auf Anfrage'}
                  {c.minTrophies > 0 ? ` · ab ${c.minTrophies} Trophäen` : ''}
                </span>
              </span>
              {angefragt ? (
                <button className="hub-mini" onClick={() => onZuruecknehmen(c.id)}>
                  Angefragt
                </button>
              ) : (
                <button className="hub-mini hub-mini--ja" onClick={() => onBeitreten(c.id)}>
                  {c.joinMode === 'open' ? 'Beitreten' : 'Anfragen'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="lobby-fuss">
        <button className="lobby-grossknopf" onClick={onGruenden}>
          Clan gründen
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
}: {
  fehler: string | null;
  onFehler: (text: string | null) => void;
  onAbbruch: () => void;
  onFertig: () => void;
}): React.JSX.Element {
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

  return (
    <HubSzene bg="/hub/bg-clan-gruenden.webp" className="front-clan">
      <HubBanner />

      <h1 className="lobby-schild">Clan gründen</h1>

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
        />
        {fehler && <p className="clan-fehler">{fehler}</p>}
      </div>

      <div className="lobby-fuss">
        <button className="hub-mini" onClick={onAbbruch}>
          Zurück
        </button>
        <button
          className="lobby-grossknopf"
          disabled={laeuft || name.trim().length < 3}
          onClick={gruenden}
        >
          Gründen
        </button>
      </div>
    </HubSzene>
  );
}

/** Die Felder, die Gruenden und Einstellungen gemeinsam haben. */
function ClanFelder({
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
}: {
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
}): React.JSX.Element {
  return (
    <>
      <label className="clan-feld">
        <span>Name</span>
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kegelclub Nord"
        />
      </label>

      <label className="clan-feld">
        <span>Spruch</span>
        <input
          value={motto}
          maxLength={120}
          onChange={(e) => setMotto(e.target.value)}
          placeholder="Optional"
        />
      </label>

      <fieldset className="clan-wappenwahl">
        <legend>Wappen</legend>
        <div className="clan-wappenraster">
          {WAPPEN.map((w) => (
            <button
              key={w}
              type="button"
              className={`clan-wappen${crest === w ? ' is-an' : ''}`}
              aria-pressed={crest === w}
              onClick={() => setCrest(w)}
            >
              <img src={wappenBild(w)} alt="" draggable={false} />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="clan-feld">
        <span>Beitritt</span>
        <div className="lobby-chips">
          <button
            type="button"
            className={`lobby-chip${joinMode === 'open' ? ' is-an' : ''}`}
            aria-pressed={joinMode === 'open'}
            onClick={() => setJoinMode('open')}
          >
            Offen
          </button>
          <button
            type="button"
            className={`lobby-chip${joinMode === 'on_request' ? ' is-an' : ''}`}
            aria-pressed={joinMode === 'on_request'}
            onClick={() => setJoinMode('on_request')}
          >
            Auf Anfrage
          </button>
        </div>
      </div>

      <label className="clan-feld">
        <span>Ab Trophäen</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={minTrophies}
          onChange={(e) => setMinTrophies(e.target.value)}
        />
      </label>
    </>
  );
}
