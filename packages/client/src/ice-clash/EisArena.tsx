import { useEffect, useRef, useState } from "react";
import type { Stand } from "./sicht";
const farben = ["#4af2dc", "#ffcf63", "#bf9cff", "#ff8da4"];
const emotes = { hallo: "Hallo", haha: "Haha", ups: "Ups", jubel: "Jubel" };
const items: Record<string, string> = {
  anker: "Eisanker",
  schneeball: "Schneeball",
  wind: "Windstoß",
};
type Punkt = { x: number; y: number };
export function EisArena({
  stand,
  verbunden,
  senden,
}: {
  stand: Stand;
  verbunden: boolean;
  senden: (n: unknown) => void;
}) {
  const svg = useRef<SVGSVGElement>(null),
    finger = useRef(new Map<number, Punkt>()),
    anfang = useRef<Punkt | null>(null),
    mehrfach = useRef(false);
  const [format, setFormat] = useState({ w: 600, h: 1000 }),
    [kamera, setKamera] = useState({ x: 0, y: 0, zoom: 1 }),
    [menue, setMenue] = useState(false);
  const [entwurf, setEntwurf] = useState({
    zug: stand.zug,
    x: 0,
    y: 0,
    item: false,
  });
  const ich = stand.spieler.find((p) => p.id === stand.ich),
    plan = stand.plan?.fest
      ? stand.plan
      : entwurf.zug === stand.zug
        ? entwurf
        : (stand.plan ?? { x: 0, y: 0, item: false });
  const offen =
    stand.phase === "planung" && ich?.lebt && !stand.plan?.fest && verbunden;
  const planRef = useRef(plan);
  const vorGeste = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const r = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      if (w && h)
        setFormat(
          w < h ? { w: 600, h: (600 * h) / w } : { w: (600 * w) / h, h: 600 },
        );
    });
    r.observe(el);
    return () => r.disconnect();
  }, []);
  useEffect(() => {
    finger.current.clear();
    anfang.current = null;
    setEntwurf({
      zug: stand.zug,
      x: stand.plan?.x ?? 0,
      y: stand.plan?.y ?? 0,
      item: stand.plan?.item ?? false,
    });
  }, [stand.zug]);
  const speichern = (p: typeof plan, fest = false) =>
    senden({ art: "plan", zug: stand.zug, x: p.x, y: p.y, item: p.item, fest });
  const welt = (p: Punkt) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return p;
    const q = new DOMPoint(p.x, p.y).matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  };
  function runter(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (finger.current.size === 1) {
      vorGeste.current = planRef.current;
      anfang.current = welt({ x: e.clientX, y: e.clientY });
      mehrfach.current = false;
    } else {
      setEntwurf({ zug: stand.zug, ...vorGeste.current });
      planRef.current = vorGeste.current;
      mehrfach.current = true;
      anfang.current = null;
    }
  }
  function bewegen(e: React.PointerEvent<SVGSVGElement>) {
    if (!finger.current.has(e.pointerId)) return;
    const vorher = [...finger.current.values()];
    finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const jetzt = [...finger.current.values()];
    if (jetzt.length >= 2) {
      const dist = (a: Punkt[]) => Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      const mitte = (a: Punkt[]) => ({
        x: (a[0].x + a[1].x) / 2,
        y: (a[0].y + a[1].y) / 2,
      });
      const a = mitte(vorher),
        b = mitte(jetzt),
        r = e.currentTarget.getBoundingClientRect();
      setKamera((k) => ({
        zoom: Math.max(
          1,
          Math.min(3, (k.zoom * dist(jetzt)) / Math.max(1, dist(vorher))),
        ),
        x: Math.max(
          -260,
          Math.min(
            260,
            k.x - ((b.x - a.x) * format.w) / Math.max(1, r.width) / k.zoom,
          ),
        ),
        y: Math.max(
          -260,
          Math.min(
            260,
            k.y - ((b.y - a.y) * format.h) / Math.max(1, r.height) / k.zoom,
          ),
        ),
      }));
      return;
    }
    if (!offen || mehrfach.current || !anfang.current) return;
    const q = welt({ x: e.clientX, y: e.clientY }),
      dx = (q.x - anfang.current.x) / 150,
      dy = (q.y - anfang.current.y) / 150,
      l = Math.max(1, Math.hypot(dx, dy));
    const p = {
      zug: stand.zug,
      x: dx / l,
      y: dy / l,
      item: planRef.current.item,
    };
    planRef.current = p;
    setEntwurf(p);
  }
  function hoch(e: React.PointerEvent<SVGSVGElement>) {
    if (!finger.current.has(e.pointerId)) return;
    if (
      offen &&
      !mehrfach.current &&
      anfang.current &&
      e.type !== "pointercancel"
    )
      speichern(planRef.current);
    if (e.type === "pointercancel" && !mehrfach.current)
      setEntwurf({ zug: stand.zug, ...vorGeste.current });
    finger.current.delete(e.pointerId);
    if (!finger.current.size) anfang.current = null;
  }
  const w = format.w / kamera.zoom,
    h = format.h / kamera.zoom;
  return (
    <>
      <div className="ice-punkte">
        {stand.spieler.map((p, i) => (
          <span
            key={p.id}
            style={{ borderColor: farben[i], opacity: p.lebt ? 1 : 0.5 }}
          >
            {p.id === stand.ich ? "Du" : p.name}
            <b>
              {"♛".repeat(p.siege)}
              {"○".repeat(Math.max(0, 3 - p.siege))}
            </b>
            {stand.phase === "planung" && p.lebt && (
              <small>{p.geplant ? "✓ bereit" : "plant"}</small>
            )}
          </span>
        ))}
      </div>
      <div className="ice-arena">
        <svg
          ref={svg}
          viewBox={`${kamera.x - w / 2} ${kamera.y - h / 2} ${w} ${h}`}
          aria-label="Eisarena: Richtung mit einem Finger zeichnen, mit zwei Fingern zoomen"
          onPointerDown={runter}
          onPointerMove={bewegen}
          onPointerUp={hoch}
          onPointerCancel={hoch}
        >
          <defs>
            <clipPath id="ice-flaeche">
              <circle r={stand.radius} />
            </clipPath>
            <radialGradient id="ice-meer">
              <stop stopColor="#168aa4" />
              <stop offset="1" stopColor="#041b37" />
            </radialGradient>
            <marker
              id="ice-pfeil"
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0 0L5 2.5L0 5Z" fill="#ffd36b" />
            </marker>
          </defs>
          <rect
            x="-3000"
            y="-3000"
            width="6000"
            height="6000"
            fill="url(#ice-meer)"
          />
          {Array.from({ length: 30 }, (_, i) => (
            <path
              key={i}
              d={`M-1000 ${i * 70 - 1000}q125 -18 250 0t250 0t250 0t250 0t250 0t250 0t250 0t250 0`}
              fill="none"
              stroke="#9af4ff"
              opacity=".08"
            />
          ))}
          <circle cy="10" r={stand.radius + 4} fill="#12657e" />
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
            strokeWidth="4"
          />
          {stand.warnung && (
            <circle
              r={Math.max(0, stand.radius - 35)}
              fill="none"
              stroke="#ffb666"
              strokeWidth="3"
              strokeDasharray="12 8"
              className="ice-riss"
            />
          )}
          {stand.fund && (
            <g transform={`translate(${stand.fund.x} ${stand.fund.y})`}>
              <circle r="18" fill="#133959" stroke="#ffe397" strokeWidth="2" />
              <text textAnchor="middle" y="7" fill="white" fontSize="22">
                {stand.fund.art === "anker"
                  ? "⚓"
                  : stand.fund.art === "wind"
                    ? "≋"
                    : "❄"}
              </text>
            </g>
          )}
          {ich?.lebt &&
            stand.phase === "planung" &&
            Math.hypot(plan.x, plan.y) > 0.03 && (
              <g>
                <path
                  d={`M${ich.x} ${ich.y}l${plan.x * 150} ${plan.y * 150}`}
                  stroke="#09283c"
                  strokeWidth="9"
                />
                <path
                  d={`M${ich.x} ${ich.y}l${plan.x * 150} ${plan.y * 150}`}
                  stroke="#ffd36b"
                  strokeWidth="5"
                  markerEnd="url(#ice-pfeil)"
                />
                <circle
                  cx={ich.x + plan.x * 150}
                  cy={ich.y + plan.y * 150}
                  r="18"
                  fill="none"
                  stroke="#ffd36b"
                  strokeDasharray="3 5"
                />
              </g>
            )}
          {stand.spieler.map((p, i) => (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              opacity={p.lebt ? 1 : 0.4}
            >
              {p.lebt && (
                <>
                  <circle
                    r={p.anker ? 26 : 20}
                    fill={p.anker ? "#66ebff55" : "#09233b44"}
                    stroke={farben[i]}
                    strokeWidth={p.id === stand.ich ? 4 : 2}
                  />
                  <image
                    href="/ice-clash/pinguin.webp"
                    x="-29"
                    y="-29"
                    width="58"
                    height="58"
                    transform={`rotate(${(p.winkel * 180) / Math.PI + 90})`}
                  />
                  <text
                    y="40"
                    textAnchor="middle"
                    fill="white"
                    stroke="#123"
                    strokeWidth="3"
                    paintOrder="stroke"
                    fontSize="13"
                  >
                    {p.id === stand.ich ? "Du" : p.name}
                  </text>
                </>
              )}
              {p.emote && p.emote in emotes && (
                <image
                  className="ice-emoteblase"
                  href={`/ice-clash/emotes/${p.emote}.webp`}
                  x="-32"
                  y="-92"
                  width="64"
                  height="64"
                />
              )}
            </g>
          ))}
          {stand.geschosse.map((g, i) => (
            <g key={i}>
              <path
                d={`M${g.x - g.vx * 0.07} ${g.y - g.vy * 0.07}L${g.x} ${g.y}`}
                stroke="#c0faff"
                strokeWidth="5"
                opacity=".6"
              />
              <circle cx={g.x} cy={g.y} r="8" fill="white" />
            </g>
          ))}
          {stand.effekte.map((e, i) => (
            <g
              key={`${stand.runde}-${e.bis}-${i}`}
              className={e.art === "wasser" ? "ice-platsch" : "ice-treffer"}
              transform={`translate(${e.x} ${e.y})`}
            >
              <circle
                r={e.art === "wasser" ? 30 : 22}
                fill="none"
                stroke="white"
                strokeWidth="4"
              />
              <circle r="12" fill="#dcfcff88" />
            </g>
          ))}
        </svg>
      </div>
      <div className="ice-zoom">
        <button
          aria-label="Vergrößern"
          onClick={() =>
            setKamera((k) => ({ ...k, zoom: Math.min(3, k.zoom + 0.25) }))
          }
        >
          +
        </button>
        <button
          aria-label="Ganze Arena anzeigen"
          onClick={() => setKamera({ x: 0, y: 0, zoom: 1 })}
        >
          ⤢
        </button>
        <button
          aria-label="Verkleinern"
          onClick={() =>
            setKamera((k) => ({ ...k, zoom: Math.max(1, k.zoom - 0.25) }))
          }
        >
          −
        </button>
      </div>
      <div className="ice-emotes">
        {menue && (
          <div className="ice-emotewahl">
            {Object.entries(emotes).map(([id, titel]) => (
              <button
                key={id}
                aria-label={`Emote ${titel}`}
                disabled={!verbunden}
                onClick={() => {
                  senden({ art: "emote", emote: id });
                  setMenue(false);
                }}
              >
                <img src={`/ice-clash/emotes/${id}.webp`} alt="" />
                <small>{titel}</small>
              </button>
            ))}
          </div>
        )}
        <button
          className="ice-emoteoeffner"
          aria-label="Emotes"
          aria-expanded={menue}
          onClick={() => setMenue(!menue)}
        >
          <img src="/ice-clash/emotes/hallo.webp" alt="" />
        </button>
      </div>
      <div className="ice-planleiste">
        <div className="ice-zugkopf">
          <span>
            RUNDE {stand.runde} · ZUG {stand.zug}
          </span>
          <b>
            {stand.phase === "planung"
              ? `${Math.ceil(stand.zeit)} s`
              : stand.phase === "gleiten"
                ? "Alle gleiten"
                : "Rundenende"}
          </b>
        </div>
        {!verbunden ? (
          <p role="status">Verbindung wird wiederhergestellt…</p>
        ) : stand.phase === "pause" ? (
          <h2>
            {stand.spieler.find((p) => p.id === stand.gewinner)?.name ??
              "Niemand"}{" "}
            gewinnt diese Runde
          </h2>
        ) : !ich?.lebt ? (
          <p>Du schaust zu. Nächste Runde bist du wieder dabei.</p>
        ) : stand.phase === "planung" ? (
          <>
            <p>
              {stand.plan?.fest
                ? "Dein Zug ist festgelegt. Gleich geht’s los!"
                : "Wische deine Richtung. Länger = stärker."}
            </p>
            {ich.item && (
              <button
                className="ice-itemwahl"
                disabled={!offen}
                aria-pressed={plan.item}
                onClick={() => {
                  const p = { ...plan, zug: stand.zug, item: !plan.item };
                  setEntwurf(p);
                  speichern(p);
                }}
              >
                {plan.item ? "✓ " : ""}
                {items[ich.item]} mit diesem Zug einsetzen
              </button>
            )}
            <button
              className="ice-gold"
              disabled={!offen}
              onClick={() => speichern(plan, true)}
            >
              {stand.plan?.fest
                ? "Festgelegt ✓"
                : Math.hypot(plan.x, plan.y) < 0.03
                  ? "Stehen bleiben & festlegen"
                  : "Richtung festlegen"}
            </button>
          </>
        ) : (
          <p>Alle Züge werden gleichzeitig ausgeführt.</p>
        )}
        {stand.warnung && (
          <small className="ice-eiswarnung">
            Nach diesem Zug bricht der markierte Eisrand ab.
          </small>
        )}
      </div>
    </>
  );
}
