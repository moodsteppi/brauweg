import { useEffect, useRef, useState } from "react";
import { apiBase, wsUrl } from "../laufzeit";
import { api } from "../api";
import type { Getragen } from "../api";
import { Pinguin } from "../pinguin";
import { spiele } from "../klang";
import "./ice.css";
import type { Stand } from "./sicht";
const farben = ["#4af2dc", "#ffcf63", "#bf9cff", "#ff8da4"];
const items: Record<string, string> = {
  anker: "Eisanker",
  schneeball: "Schneeball",
  wind: "Windstoß",
};
function Symbol({ art }: { art: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="ice-symbol">
      <defs>
        <linearGradient id={"g" + art} x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#69dce9" />
        </linearGradient>
      </defs>
      {art === "anker" ? (
        <g fill="none" stroke="#aef8ff" strokeWidth="4" strokeLinecap="round">
          <circle cx="24" cy="10" r="5" />
          <path d="M24 15v25M12 23h24M7 29q17 22 34 0M7 29v9M41 29v9" />
        </g>
      ) : art === "wind" ? (
        <g fill="none" stroke="#aef8ff" strokeWidth="4" strokeLinecap="round">
          <path d="M5 17h26q14 0 7-9M5 25h33M12 33h16q14 0 7 9" />
        </g>
      ) : (
        <circle
          cx="24"
          cy="24"
          r="17"
          fill={"url(#g" + art + ")"}
          stroke="#fff"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
export default function IceClash() {
  const [stand, setStand] = useState<Stand | null>(null),
    [avatar, setAvatar] = useState<Getragen>({}),
    [fortsetzen, setFortsetzen] = useState(() => {
      try {
        const z = JSON.parse(sessionStorage.getItem("ice-zugang") ?? "null");
        return z && typeof z.code === "string" && typeof z.token === "string"
          ? z
          : null;
      } catch {
        return null;
      }
    }),
    [name, setName] = useState(
      () => localStorage.getItem("ice-name") ?? "Pinguin",
    ),
    [code, setCode] = useState(
      () => new URLSearchParams(location.search).get("raum") ?? "",
    ),
    [fehler, setFehler] = useState(""),
    [verbunden, setVerbunden] = useState(false),
    [aktiv, setAktiv] = useState(false),
    [ping, setPing] = useState(0),
    [info, setInfo] = useState(false),
    [stick, setStick] = useState({ x: 0, y: 0 });
  const ws = useRef<WebSocket | null>(null),
    zugang = useRef<{
      code: string;
      token: string;
    } | null>(null),
    aktion = useRef({ x: 0, y: 0, laden: false, item: false }),
    start = useRef<Record<string, unknown>>({}),
    beenden = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const senden = (n: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify(n));
  };
  function verbinden() {
    if (beenden.current) return;
    const w = new WebSocket(wsUrl().replace(/\/ws$/, "/ws/ice"));
    ws.current = w;
    w.onopen = () => {
      setVerbunden(true);
      setFehler("");
      w.send(
        JSON.stringify(
          zugang.current ? { art: "weiter", ...zugang.current } : start.current,
        ),
      );
    };
    w.onmessage = (e) => {
      const n = JSON.parse(e.data);
      if (n.art === "stand") setStand(n);
      if (n.art === "zugang") {
        zugang.current = { code: n.code, token: n.token };
        sessionStorage.setItem(
          "ice-zugang",
          JSON.stringify({ code: n.code, token: n.token }),
        );
      }
      if (n.art === "pong") setPing(Math.max(0, Date.now() - n.zeit));
      if (n.art === "fehler") {
        setFehler(n.text);
        if (n.fatal) {
          beenden.current = true;
          w.close();
          setAktiv(false);
          zugang.current = null;
          sessionStorage.removeItem("ice-zugang");
          setStand(null);
          setFortsetzen(null);
        }
      }
    };
    w.onclose = () => {
      if (ws.current !== w) return;
      setVerbunden(false);
      aktion.current = { x: 0, y: 0, laden: false, item: false };
      setStick({ x: 0, y: 0 });
      if (!beenden.current) timer.current = setTimeout(verbinden, 1500);
    };
    w.onerror = () => w.close();
  }
  function los(art: string) {
    spiele("tipp");
    setFortsetzen(null);
    beenden.current = false;
    zugang.current = null;
    setStand(null);
    setFehler("");
    localStorage.setItem("ice-name", name);
    start.current = {
      art,
      name: name.trim() || "Pinguin",
      code: code.trim().toUpperCase(),
    };
    setAktiv(true);
    verbinden();
  }
  function wiederaufnehmen() {
    zugang.current = fortsetzen;
    beenden.current = false;
    setAktiv(true);
    setFortsetzen(null);
    verbinden();
  }
  function verlassen() {
    setFortsetzen(null);
    beenden.current = true;
    senden({ art: "verlassen" });
    ws.current?.close();
    ws.current = null;
    clearTimeout(timer.current);
    zugang.current = null;
    sessionStorage.removeItem("ice-zugang");
    setStand(null);
    setAktiv(false);
    aktion.current = { x: 0, y: 0, laden: false, item: false };
  }
  useEffect(() => {
    const eingabe = setInterval(() => {
        senden({ art: "eingabe", ...aktion.current });
        aktion.current.item = false;
      }, 50),
      herz = setInterval(() => senden({ art: "ping", zeit: Date.now() }), 3000);
    const neutral = () => {
      aktion.current = { x: 0, y: 0, laden: false, item: false };
      setStick({ x: 0, y: 0 });
    };
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const an = e.type === "keydown";
      if (["ArrowLeft", "a"].includes(e.key)) aktion.current.x = an ? -1 : 0;
      if (["ArrowRight", "d"].includes(e.key)) aktion.current.x = an ? 1 : 0;
      if (["ArrowUp", "w"].includes(e.key)) aktion.current.y = an ? -1 : 0;
      if (["ArrowDown", "s"].includes(e.key)) aktion.current.y = an ? 1 : 0;
      if (e.code === "Space") {
        e.preventDefault();
        aktion.current.laden = an;
      }
      if (e.key === "e" && an) aktion.current.item = true;
    };
    window.addEventListener("blur", neutral);
    document.addEventListener("visibilitychange", neutral);
    window.addEventListener("keydown", taste);
    window.addEventListener("keyup", taste);
    return () => {
      beenden.current = true;
      ws.current?.close();
      clearTimeout(timer.current);
      clearInterval(eingabe);
      clearInterval(herz);
      window.removeEventListener("blur", neutral);
      document.removeEventListener("visibilitychange", neutral);
      window.removeEventListener("keydown", taste);
      window.removeEventListener("keyup", taste);
    };
  }, []);
  useEffect(() => {
    let lebt = true;
    void api
      .me()
      .then((me) => {
        if (lebt) {
          setAvatar(me.avatar);
          setName((v) => (v === "Pinguin" ? me.displayName : v));
        }
      })
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, []);
  useEffect(() => {
    if (stand?.phase === "pause") spiele("runde-ende");
    if (stand?.phase === "ende") spiele("sieg");
    if (stand?.phase === "countdown") spiele("dran", 0.6);
  }, [stand?.phase]);
  const ich = stand?.spieler.find((p) => p.id === stand.ich),
    sieger = stand?.spieler.find((p) => p.id === stand.gewinner),
    spiel = !!stand && !["lobby", "ende"].includes(stand.phase);
  const link = stand
    ? `${apiBase || location.origin}/ice-clash?raum=${stand.code}`
    : "";
  const bewegen = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / 45,
      y = (e.clientY - r.top - r.height / 2) / 45,
      l = Math.max(1, Math.hypot(x, y));
    aktion.current.x = x / l;
    aktion.current.y = y / l;
    setStick({ x: x / l, y: y / l });
  };
  return (
    <main className={"ice-app " + (spiel ? "ice-im-spiel" : "")}>
      <header className="ice-kopf">
        <button
          onClick={() => (aktiv ? verlassen() : location.assign("/"))}
          aria-label="Zurück"
        >
          ‹
        </button>
        <strong>Bro Ice Clash</strong>
        <span>
          {aktiv
            ? verbunden
              ? `${ping} ms`
              : "Verbinde erneut…"
            : "ONLINE · 2–4 SPIELER"}
        </span>
        <button onClick={() => setInfo(!info)} aria-label="Spielregeln">
          ?
        </button>
      </header>
      {fehler && (
        <p role="alert" className="ice-fehler">
          {fehler}
        </p>
      )}
      {info && (
        <aside className="ice-regeln">
          <h2>Bleib auf dem Eis!</h2>
          <p>
            Links bewegen. Rechts halten und loslassen zum Schubsen. Sammle eine
            Fähigkeit und setze sie gezielt ein. Der Eisanker schützt dich drei
            Sekunden vor starken Schubsern. Ein Schneeball trifft auf
            Entfernung. Der Windstoß schiebt Gegner vor dir zurück. Risse warnen
            drei Sekunden vor abbrechendem Eis.
          </p>
          <p>
            Wer fällt, schaut zu. Der letzte Pinguin gewinnt die Runde. Drei
            Rundensiege gewinnen die Partie. Tastatur: WASD, Leertaste, E.
          </p>
          <button onClick={() => setInfo(false)}>Verstanden</button>
        </aside>
      )}
      {!aktiv && (
        <section className="ice-start">
          <div className="ice-titelbild">
            <img
              src="/ice-clash/titel.webp"
              alt="Pinguine schubsen sich auf einer brechenden Eisscholle"
            />
            <div>
              <span>DAS EIS WIRD DÜNN</span>
              <h1>
                Ein Schubs.
                <br />
                Alles offen.
              </h1>
              <p>Bleib cool. Bleib oben.</p>
            </div>
          </div>
          <div className="ice-startwahl">
            {fortsetzen && (
              <button className="ice-gold" onClick={wiederaufnehmen}>
                Zur laufenden Partie zurück
              </button>
            )}
            <label>
              Dein Name
              <input
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="ice-gold" onClick={() => los("online")}>
              Online spielen{" "}
              <small>Vier Spieler · freie Plätze nach 30 s mit Bots</small>
            </button>
            <button onClick={() => los("privat")}>
              Mit Freunden · Raum erstellen
            </button>
            <div className="ice-code">
              <input
                aria-label="Einladungscode"
                maxLength={8}
                placeholder="Raumcode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                disabled={code.length !== 8}
                onClick={() => los("beitreten")}
              >
                Beitreten
              </button>
            </div>
            <button onClick={() => los("ueben")}>Gegen Bots üben</button>
            <p>◉ Vogelperspektive · Querformat · Zuerst 3 Siege</p>
          </div>
        </section>
      )}
      {aktiv && !stand && (
        <section className="ice-warten">
          <img src="/ice-clash/pinguin.webp" alt="" />
          <h2>Wir holen deine Eisscholle…</h2>
          <button onClick={verlassen}>Abbrechen</button>
        </section>
      )}
      {stand?.phase === "lobby" && (
        <section className="ice-lobby">
          <div className="ice-lobbytitel">
            <span>DEINE EISCREW</span>
            <h1>
              {stand.offen ? "Mitspieler werden gesucht" : "Zusammen aufs Eis"}
            </h1>
            <p>
              {stand.offen
                ? `Freie Plätze werden in ${stand.warte} Sekunden mit Bots gefüllt.`
                : `Raum ${stand.code}`}
            </p>
          </div>
          <div className="ice-sitze">
            {Array.from({ length: 4 }, (_, i) => {
              const p = stand.spieler[i];
              return (
                <article key={i} style={{ borderColor: farben[i] }}>
                  <div
                    className="ice-lobbyfigur"
                    style={{ opacity: p ? 1 : 0.25 }}
                  >
                    {p?.id === stand.ich ? (
                      <Pinguin
                        getragen={avatar}
                        groesse={5}
                        titel="Dein Pinguin aus dem Kleiderschrank"
                      />
                    ) : (
                      <Pinguin getragen={{}} groesse={5} />
                    )}
                  </div>
                  <h3>{p?.name ?? "Freier Platz"}</h3>
                  <p>
                    {p
                      ? p.bot
                        ? "Computer"
                        : !p.verbunden
                          ? "Verbindung verloren"
                          : p.bereit
                            ? "Bereit ✓"
                            : "Noch nicht bereit"
                      : "Wartet auf einen Freund"}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="ice-lobbyaktionen">
            {!stand.offen && (
              <>
                <button
                  onClick={async () => {
                    try {
                      if (navigator.share)
                        await navigator.share({
                          title: "Bro Ice Clash",
                          url: link,
                        });
                      else {
                        await navigator.clipboard.writeText(link);
                        setFehler("Einladungslink kopiert.");
                      }
                    } catch {
                      setFehler(`Einladung: ${link}`);
                    }
                  }}
                >
                  Freunde einladen ↗
                </button>
                <button
                  className="ice-gold"
                  onClick={() =>
                    senden({ art: "bereit", bereit: !ich?.bereit })
                  }
                >
                  {ich?.bereit ? "Bereit ✓" : "Ich bin bereit"}
                </button>
                {stand.host === stand.ich && (
                  <>
                    <button onClick={() => senden({ art: "bots" })}>
                      Bots auffüllen
                    </button>
                    <button
                      disabled={
                        stand.spieler.length < 2 ||
                        stand.spieler.some((p) => !p.bereit)
                      }
                      onClick={() => senden({ art: "start" })}
                    >
                      Runde starten
                    </button>
                  </>
                )}
              </>
            )}
            <button onClick={verlassen}>Verlassen</button>
          </div>
        </section>
      )}
      {spiel && stand && (
        <>
          <div className="ice-punkte">
            {stand.spieler.map((p, i) => (
              <span
                key={p.id}
                style={{ borderColor: farben[i], opacity: p.lebt ? 1 : 0.5 }}
              >
                {p.name}
                {p.id === stand.ich ? " · Du" : ""}
                {p.bot ? " · Bot" : !p.verbunden ? " · Bot vertritt" : ""}
                <b>
                  {"♛".repeat(p.siege)}
                  {"○".repeat(3 - p.siege)}
                </b>
              </span>
            ))}
          </div>
          <div className="ice-arena">
            <svg
              viewBox="-420 -290 840 580"
              aria-label="Eisarena aus der Vogelperspektive"
            >
              <defs>
                <clipPath id="ice-flaeche">
                  <circle r={stand.radius} />
                </clipPath>
                <radialGradient id="ice-meer">
                  <stop stopColor="#1592aa" />
                  <stop offset="1" stopColor="#06334d" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect
                x="-420"
                y="-290"
                width="840"
                height="580"
                fill="url(#ice-meer)"
              />
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  d={`M-420 ${i * 55 - 290}q120 -15 240 0t240 0t240 0`}
                  fill="none"
                  stroke="#8eeaff"
                  opacity=".12"
                />
              ))}
              <circle cy="6" r={stand.radius + 3} fill="#187f9c" />
              <image
                href="/ice-clash/eis.webp"
                x="-280"
                y="-280"
                width="560"
                height="560"
                clipPath="url(#ice-flaeche)"
              />
              <circle
                r={stand.radius}
                fill="none"
                stroke="#d4fdff"
                strokeWidth="5"
              />
              {stand.warnung && (
                <circle
                  r={Math.max(0, stand.radius - 27)}
                  fill="none"
                  stroke="#ffb666"
                  strokeWidth="4"
                  strokeDasharray="12 8"
                  className="ice-riss"
                />
              )}
              {stand.fund && (
                <g transform={`translate(${stand.fund.x} ${stand.fund.y})`}>
                  <circle
                    r="18"
                    fill="#133959"
                    stroke="#ffe397"
                    strokeWidth="3"
                  />
                  <text textAnchor="middle" y="6" fill="white" fontSize="21">
                    {stand.fund.art === "anker"
                      ? "⚓"
                      : stand.fund.art === "wind"
                        ? "≋"
                        : "❄"}
                  </text>
                </g>
              )}
              {stand.spieler.map(
                (p, i) =>
                  p.lebt && (
                    <g
                      key={p.id}
                      style={{
                        transform: `translate(${p.x}px,${p.y}px)`,
                        transition: "transform 80ms linear",
                      }}
                    >
                      <circle
                        r={p.anker ? 25 : 19}
                        fill={p.anker ? "#66ebff55" : "#09233b44"}
                        stroke={farben[i]}
                        strokeWidth={p.id === stand.ich ? 4 : 2}
                      />
                      <g
                        transform={`rotate(${(p.winkel * 180) / Math.PI + 90})`}
                      >
                        <image
                          href="/ice-clash/pinguin.webp"
                          x="-29"
                          y="-29"
                          width="58"
                          height="58"
                        />
                        {p.laden > 0 && (
                          <path
                            d={`M0 -28v-${15 + p.laden * 35}m-6 6l6 -6 6 6`}
                            stroke="#ffce67"
                            strokeWidth="5"
                            fill="none"
                          />
                        )}
                      </g>
                      <text
                        y="38"
                        textAnchor="middle"
                        fill="white"
                        stroke="#123"
                        strokeWidth="3"
                        paintOrder="stroke"
                        fontSize="12"
                      >
                        {p.id === stand.ich ? "Du" : p.name}
                      </text>
                    </g>
                  ),
              )}
              {stand.geschosse.map((g, i) => (
                <g key={i}>
                  <path
                    d={`M${g.x - g.vx * 0.07} ${g.y - g.vy * 0.07}L${g.x} ${g.y}`}
                    stroke="#c0faff"
                    strokeWidth="5"
                    opacity=".6"
                  />
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r="8"
                    fill="white"
                    stroke="#95e8f7"
                    strokeWidth="2"
                  />
                </g>
              ))}
              {stand.effekte.map((e) => (
                <g
                  key={`${stand.runde}-${e.bis}-${e.x}-${e.y}`}
                  className={e.art === "wasser" ? "ice-platsch" : "ice-treffer"}
                  transform={`translate(${e.x} ${e.y})`}
                >
                  <circle
                    r={e.art === "wasser" ? 30 : 22}
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    opacity=".7"
                  />
                  <circle r="12" fill="#dcfcff88" />
                </g>
              ))}
            </svg>
          </div>
          <div className="ice-meldung" aria-live="polite">
            {!verbunden
              ? "Verbindung wird wiederhergestellt. Ein Bot vertritt dich."
              : stand.phase === "countdown"
                ? `Runde ${stand.runde} · ${Math.ceil(stand.zeit)}`
                : stand.phase === "pause"
                  ? sieger
                    ? `${sieger.name} gewinnt!`
                    : "Gleichstand. Neue Runde!"
                  : !ich?.lebt
                    ? "Du schaust zu. Nächste Runde bist du wieder dabei."
                    : stand.warnung
                      ? "Vorsicht! Das Eis bricht gleich."
                      : ""}
          </div>
          {stand.phase === "spiel" && ich?.lebt && verbunden && (
            <div className="ice-steuerung">
              <div
                className="ice-stick"
                role="application"
                aria-label="Bewegen"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  bewegen(e);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    bewegen(e);
                }}
                onPointerUp={() => {
                  aktion.current.x = 0;
                  aktion.current.y = 0;
                  setStick({ x: 0, y: 0 });
                }}
                onPointerCancel={() => {
                  aktion.current.x = 0;
                  aktion.current.y = 0;
                  setStick({ x: 0, y: 0 });
                }}
              >
                <i
                  style={{
                    transform: `translate(${stick.x * 30}px,${stick.y * 30}px)`,
                  }}
                />
              </div>
              <div className="ice-rechts">
                <button
                  className="ice-item"
                  disabled={!ich.item}
                  onClick={() => (aktion.current.item = true)}
                >
                  <Symbol art={ich.item || "schneeball"} />
                  <small>{items[ich.item] ?? "Kein Item"}</small>
                </button>
                <button
                  className="ice-schubs"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    aktion.current.laden = true;
                  }}
                  onPointerUp={() => (aktion.current.laden = false)}
                  onPointerCancel={() => (aktion.current.laden = false)}
                >
                  ↑<small>{ich.laden > 0 ? "Loslassen!" : "Schubsen"}</small>
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {stand?.phase === "ende" && (
        <section className="ice-ende">
          <span>DEIN EISCHAMPION</span>
          <div className="ice-siegerfigur">
            <Pinguin
              getragen={sieger?.id === stand.ich ? avatar : {}}
              groesse={7}
              titel="Siegerpinguin"
            />
          </div>
          <h1>
            {sieger?.name ?? stand.spieler.find((p) => p.siege >= 3)?.name}{" "}
            gewinnt!
          </h1>
          <p>Drei Kronen. Eine eisige Meisterleistung.</p>
          <div className="ice-ergebnis">
            {[...stand.spieler]
              .sort((a, b) => b.siege - a.siege)
              .map((p) => (
                <p key={p.id}>
                  {p.name}
                  <b>{p.siege} ♛</b>
                </p>
              ))}
          </div>
          <button className="ice-gold" onClick={verlassen}>
            Zur Spielseite
          </button>
        </section>
      )}
      <div className="ice-drehen">
        <div className="ice-telefon">▯</div>
        <h2>
          Dreh dein iPhone,
          <br />
          um zu spielen
        </h2>
        <p>Im Querformat hast du die ganze Eisscholle im Blick.</p>
        <small>Eine laufende Online-Runde läuft weiter.</small>
        <button
          onClick={() => {
            verlassen();
            location.assign("/");
          }}
        >
          Zur Spielauswahl
        </button>
      </div>
    </main>
  );
}
