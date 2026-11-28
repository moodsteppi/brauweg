import { useEffect, useRef, useState } from "react";
import { apiBase, wsUrl } from "../laufzeit";
import { api } from "../api";
import type { Getragen } from "../api";
import { Pinguin } from "../pinguin";
import { spiele } from "../klang";
import "./ice.css";
import { EisArena } from "./EisArena";
import type { Stand } from "./sicht";
import { useZuletztMelden } from "../zuletzt";
const farben = ["#4af2dc", "#ffcf63", "#bf9cff", "#ff8da4"];
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
    [kontoGeladen, setKontoGeladen] = useState(false);
  const ws = useRef<WebSocket | null>(null),
    zugang = useRef<{
      code: string;
      token: string;
    } | null>(null),
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
        JSON.stringify({
          ...(zugang.current
            ? { art: "weiter", ...zugang.current }
            : start.current),
          version: 2,
        }),
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
  }
  useEffect(() => {
    const herz = setInterval(
      () => senden({ art: "ping", zeit: Date.now() }),
      3000,
    );
    return () => {
      beenden.current = true;
      ws.current?.close();
      clearTimeout(timer.current);
      clearInterval(herz);
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
      .catch(() => {})
      .finally(() => {
        if (lebt) setKontoGeladen(true);
      });
    return () => {
      lebt = false;
    };
  }, []);
  // „Zuletzt gespielt" (seit dem 28.11.2026): Die Arena hat keinen Tisch,
  // den der Server sieht, also meldet sie sich beim Öffnen selbst.
  useZuletztMelden("ice-clash");
  /*
   * Quick-Play schickt mit `?schnell=1` hierher (Startseite, Plan Abschnitt 4):
   * dann sofort die Online-Suche, dieselbe Aktion wie der Knopf — ohne
   * Zwischenmenü. Erst nach dem Kontoladen, damit der Pinguin unter dem
   * Kontonamen antritt statt als „Pinguin"; genau einmal; und nicht über eine
   * Partie hinweg, die sich fortsetzen ließe — die gehört dem Spieler.
   */
  const schnellGestartet = useRef(false);
  useEffect(() => {
    if (schnellGestartet.current || !kontoGeladen || aktiv || fortsetzen) return;
    if (new URLSearchParams(location.search).get("schnell") !== "1") return;
    schnellGestartet.current = true;
    los("online");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kontoGeladen, aktiv, fortsetzen]);
  useEffect(() => {
    if (stand?.phase === "pause") spiele("runde-ende");
    if (stand?.phase === "ende") spiele("sieg");
    if (stand?.phase === "planung") spiele("dran", 0.6);
  }, [stand?.phase]);
  const ich = stand?.spieler.find((p) => p.id === stand.ich),
    sieger = stand?.spieler.find((p) => p.id === stand.gewinner),
    spiel = !!stand && !["lobby", "ende"].includes(stand.phase);
  const link = stand
    ? `${apiBase || location.origin}/ice-clash?raum=${stand.code}`
    : "";
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
            Zeichne mit einem Finger deine Richtung ein. Je länger der Pfeil,
            desto stärker gleitest du. Du hast 15 Sekunden. „Festlegen“
            bestätigt deinen Zug. Danach bewegen sich alle gleichzeitig. Dein
            Plan bleibt bis dahin geheim. Ohne Eingabe bleibst du stehen. Ein
            nicht bestätigter Pfeil wird beim Ablauf der Zeit automatisch
            übernommen.
          </p>
          <p>
            Wer fällt, schaut zu. Der letzte Pinguin gewinnt die Runde. Drei
            Rundensiege gewinnen die Partie. Mit zwei Fingern kannst du die
            Arena zoomen und verschieben. Items setzt du zusammen mit deinem Zug
            ein.
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
            <p>◉ Hochkant · Geheime Züge · Zuerst 3 Siege</p>
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
        <EisArena stand={stand} verbunden={verbunden} senden={senden} />
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
    </main>
  );
}
