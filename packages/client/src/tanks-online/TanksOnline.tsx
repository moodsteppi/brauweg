import { useEffect, useState } from 'react';
import { api } from '../api';
import { apiBase } from '../laufzeit';
import { useTanksOnline } from './useTanksOnline';
import { OnlineLeinwand } from './OnlineLeinwand';
import { OnlineSteuerung } from './OnlineSteuerung';
import { wort } from './text';
import './online.css';
export default function TanksOnline() {
  const netz = useTanksOnline();
  const [name, setName] = useState('Bro'),
    [code, setCode] = useState(
      () => new URLSearchParams(location.search).get('raum') ?? '',
    ),
    [ohneBots, setOhneBots] = useState(false),
    [kopiert, setKopiert] = useState(false);
  useEffect(() => {
    let da = true;
    void api
      .me()
      .then((me) => {
        if (da) setName(me.displayName);
      })
      .catch(() => {});
    return () => {
      da = false;
    };
  }, []);
  const { stand, verbunden, aktiv } = netz,
    partie = stand?.partie;
  useEffect(() => {
    if (!partie) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = vorher;
    };
  }, [!!partie]);
  const los = (art: string) =>
    netz.los({ art, name, code: code.trim().toUpperCase(), ohneBots });
  const bots = (wert: boolean) => {
    setOhneBots(wert);
    netz.senden({ art: 'bots', ohneBots: wert });
  };
  const botWahl = (
    <label className="to-botwahl">
      <input
        type="checkbox"
        checked={
          stand?.spieler.find((p) => p.id === stand.ich)?.ohneBots ?? ohneBots
        }
        onChange={(e) => bots(e.target.checked)}
      />
      {wort('Nicht mit Bots auffüllen', 'Do not fill with bots')}
    </label>
  );
  if (partie && stand) {
    const dran = partie.bros.find((b) => b.id === partie.amZug),
      ich = partie.bros.find((b) => b.id === stand.ich),
      ende = partie.phase === 'ende';
    return (
      <main className="to-partie">
        <OnlineLeinwand partie={partie} />
        <header className="to-hud">
          <button onClick={netz.verlassen}>{wort('Verlassen', 'Leave')}</button>
          <b>
            BroTanks <span>Online</span>
          </b>
          <span role="status">
            {!verbunden
              ? wort('Verbinde erneut…', 'Reconnecting…')
              : ende
                ? wort('Runde beendet', 'Round finished')
                : `${dran?.name ?? '…'} · ${Math.ceil(partie.rest)}s`}
          </span>
          <small>{netz.ping} ms</small>
        </header>
        <div className="to-spielerstand">
          {partie.bros.map((b) => (
            <span
              key={b.id}
              className={b.id === stand.ich ? 'ist-du' : ''}
              style={{ borderColor: b.farbe, opacity: b.raus ? 0.5 : 1 }}
            >
              <b>{b.name}</b>
              <small>
                {b.lp} ♥{b.schild ? ' ◈' : ''}
              </small>
            </span>
          ))}
        </div>
        {!ende && (
          <div className="to-zughinweis">
            {stand.privat?.amZug && partie.phase === 'zielen'
              ? wort('Du bist am Zug', 'Your turn')
              : partie.phase === 'countdown'
                ? wort('Mach dich bereit!', 'Get ready!')
                : ich?.raus
                  ? wort('Du schaust zu', 'Spectating')
                  : wort('Beobachte deinen Gegner', 'Watch your opponent')}
          </div>
        )}
        {!ende && stand.privat && (
          <OnlineSteuerung
            arti={stand.privat}
            verbunden={verbunden}
            senden={netz.senden}
          />
        )}
        {ende && (
          <section className="to-ergebnis">
            <img src="/hub/symbol-pokal.webp" alt="" />
            <h1>
              {partie.gewinner.includes(stand.ich)
                ? wort('Gewonnen!', 'You won!')
                : partie.gewinner.length
                  ? `${partie.bros.find((b) => b.id === partie.gewinner[0])?.name} ${wort('gewinnt', 'wins')}`
                  : wort('Gleichstand', 'Draw')}
            </h1>
            <p>
              {wort(
                'Eine neue Arena wartet auf dich.',
                'Your next arena awaits.',
              )}
            </p>
            <button onClick={netz.verlassen}>
              {wort('Zur Lobby-Auswahl', 'Back to lobbies')}
            </button>
          </section>
        )}
        <div className="to-drehen">
          <span aria-hidden="true">↻</span>
          <h2>{wort('Bitte quer halten', 'Turn your device sideways')}</h2>
          <p>
            {wort(
              'Spielfeld und Steuerung passen gemeinsam ins Querformat.',
              'Play and aim together in landscape.',
            )}
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="to-menue">
      <div className="to-menue-innen">
        <header className="to-titel">
          <a href="/">‹ {wort('Startseite', 'Home')}</a>
          <img src="/broremote/ausbau/tanks.webp" alt="BroTanks" />
          <div>
            <small>ONLINE ARENA · 2–4</small>
            <h1>BroTanks Online</h1>
            <p>
              {wort(
                'Dein Panzer. Dein Bildschirm. Eure Arena.',
                'Your tank. Your screen. Your arena.',
              )}
            </p>
          </div>
        </header>
        {netz.fehler && (
          <p className="to-fehler" role="alert">
            {netz.fehler}
          </p>
        )}
        {!aktiv ? (
          <section className="to-tafel">
            <h2>{wort('Bereit zum Duell?', 'Ready to battle?')}</h2>
            <label>
              {wort('Dein Name', 'Your name')}
              <input
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {botWahl}
            <button className="to-haupt" onClick={() => los('online')}>
              <img src="/broremote/knoepfe/start.webp" alt="" />
              <span>
                Quick Play
                <small>
                  {wort(
                    '30 Sekunden suchen, dann gemeinsam starten',
                    'Search for 30 seconds, then play together',
                  )}
                </small>
              </span>
            </button>
            <div className="to-freunde">
              <button onClick={() => los('privat')}>
                {wort('Freundeslobby erstellen', 'Create a friends lobby')}
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  los('beitreten');
                }}
              >
                <input
                  aria-label={wort('Raumcode', 'Room code')}
                  placeholder="A1B2C3D4"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button disabled={!/^[A-F0-9]{8}$/.test(code.trim())}>
                  {wort('Beitreten', 'Join')}
                </button>
              </form>
            </div>
            {netz.fortsetzen && (
              <button onClick={() => netz.los({}, true)}>
                {wort('Partie fortsetzen', 'Resume match')}
              </button>
            )}
            <p className="to-hinweis">
              {wort(
                'Spiele im Querformat. Ziele mit Winkel und Kraft, fahre mit den Pfeilen und tippe auf Feuer. Jeder spielt auf seinem eigenen Gerät.',
                'Play in landscape. Set angle and power, drive with the arrows, then fire. Everyone plays on their own device.',
              )}
            </p>
          </section>
        ) : (
          <section className="to-tafel">
            <div className="to-lobbykopf">
              <h2>
                {stand?.offen
                  ? wort('Gegner werden gesucht', 'Finding opponents')
                  : wort('Deine Freundeslobby', 'Your friends lobby')}
              </h2>
              <b>
                {verbunden
                  ? `${netz.ping} ms`
                  : wort('Verbinde…', 'Connecting…')}
              </b>
            </div>
            {stand && (
              <>
                <div className="to-suche">
                  <strong>
                    {stand.offen
                      ? stand.warte
                        ? `${stand.warte}s`
                        : '…'
                      : stand.code}
                  </strong>
                  <p>
                    {stand.offen
                      ? stand.warte
                        ? wort('Gleich geht’s los', 'Starting soon')
                        : wort(
                            'Warten auf einen weiteren Spieler. Du kannst Bots wieder erlauben.',
                            'Waiting for another player. You can allow bots again.',
                          )
                      : wort(
                          'Teile diesen Code mit deinen Freunden.',
                          'Share this code with your friends.',
                        )}
                  </p>
                </div>
                {!stand.offen && (
                  <button
                    onClick={() => {
                      const link = `${apiBase || location.origin}/tanks-online?raum=${stand.code}`;
                      void navigator.clipboard
                        ?.writeText(link)
                        .then(() => setKopiert(true))
                        .catch(() => setKopiert(false));
                    }}
                  >
                    {kopiert
                      ? wort('Link kopiert', 'Link copied')
                      : wort('Einladungslink kopieren', 'Copy invite link')}
                  </button>
                )}
                <div className="to-lobbyspieler">
                  {stand.spieler.map((p) => (
                    <div key={p.id} style={{ borderColor: p.farbe }}>
                      <img src="/broremote/ausbau/panzer.webp" alt="" />
                      <span>
                        {p.name}
                        <small>
                          {p.verbunden
                            ? p.id === stand.ich
                              ? wort('Du', 'You')
                              : wort('Verbunden', 'Connected')
                            : wort('Verbindung unterbrochen', 'Disconnected')}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                {botWahl}
                <p className="to-hinweis">
                  {stand.botsErlaubt
                    ? wort(
                        'Freie Plätze werden mit Bots aufgefüllt.',
                        'Empty seats will be filled with bots.',
                      )
                    : wort(
                        'Keine Bots: Mindestens zwei echte Spieler sind nötig. Ein Spieler hat die Bot-Auffüllung ausgeschaltet.',
                        'No bots: at least two real players are needed. A player has disabled bot filling.',
                      )}
                </p>
                {!stand.offen && stand.host === stand.ich && (
                  <button
                    className="to-haupt"
                    disabled={
                      !verbunden ||
                      (!stand.botsErlaubt && stand.spieler.length < 2)
                    }
                    onClick={() => netz.senden({ art: 'start' })}
                  >
                    {wort('Partie starten', 'Start match')}
                  </button>
                )}
              </>
            )}
            <button onClick={netz.verlassen}>
              {wort('Abbrechen', 'Cancel')}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
