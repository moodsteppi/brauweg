import { useEffect, useRef, useState } from "react";
import { api, type Me, type Shop, type RegalWare } from "../api";
import { decksFor, RUECKEN } from "../decks";
import { SZENEN } from "../szenen";
import { t, zahl } from "../i18n";
import { tf } from "../i18n/einsetzen";
import { FIGURENSAETZE } from "../minispiele/brochess/figurensatz";
import { Pinguin } from "../pinguin";
import { useRueckfrage } from "./HbBlatt";
import { marktName } from "./MarktBild";
import { bannerFuer } from "./StartNeu";
import {
  SammlungVorschau,
  SammelIcon,
  type SammelBereich,
} from "./SammlungVorschau";
import "./tagesmarkt.css";
import "./sammlung.css";

type Offen = { spiel: string; art: SammelBereich };
/** Spielübersicht → aktuell ausgerüstete Bereiche → gezielte Auswahl. Kaufen bleibt im Shop. */
export function SammlungNeu({
  me,
  onThemeChange,
  onSchrank,
  onShop,
  spiel = "alle",
  onSpiel,
}: {
  me: Me;
  onThemeChange: (
    gameId: string,
    teil: { cardDeck?: string; tableScene?: string; cardBack?: string },
  ) => void;
  onSchrank: () => void;
  onShop?: (spiel: string, artikel?: string) => void;
  spiel?: string;
  onSpiel?: (spiel: string) => void;
  onGekauft?: () => void;
  onWerkstatt?: () => void;
  details?: (gameId: string, zurueck: () => void) => React.ReactNode;
}) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [filter, setFilter] = useState(spiel);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [spiele, setSpiele] = useState<string[]>([
    "doppelkopf",
    "skat",
    "brochess",
  ]);
  const [fehler, setFehler] = useState(false);
  const rolle = useRef<HTMLDivElement>(null),
    titel = useRef<HTMLHeadingElement>(null),
    rueckkehr = useRef<HTMLButtonElement | null>(null),
    position = useRef(0);
  const [frage, rueckfrage] = useRueckfrage();
  const laden = () => {
    setFehler(false);
    void api
      .shop()
      .then(setShop)
      .catch(() => setFehler(true));
  };
  useEffect(laden, [me.coins]);
  useEffect(() => {
    setFilter(spiel);
    setOffen(null);
  }, [spiel]);
  useEffect(() => {
    void api
      .games()
      .then((liste) => {
        const ids = liste
          .filter(
            (g) =>
              g.availability === "playable" &&
              [
                "doppelkopf",
                "skat",
                "brochess",
                "wizard",
                "cambio",
                "easypoker",
              ].includes(g.id),
          )
          .map((g) => g.id);
        if (ids.length) setSpiele(ids);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (rolle.current) rolle.current.scrollTop = offen ? 0 : position.current;
    if (offen) titel.current?.focus({ preventScroll: true });
    else if (rueckkehr.current)
      document
        .getElementById(rueckkehr.current.id)
        ?.focus({ preventScroll: true });
  }, [offen]);
  const ware = (art: SammelBereich, wert: string) =>
    shop?.tischware.find((w) => w.art === art && w.wert === wert);
  const imShop = (gameId: string, w: RegalWare) =>
    w.nurErspielt
      ? frage(
          {
            titel: marktName(w),
            text: t("sammlung.nurErspielt"),
            ja: t("sammlung.verstanden"),
          },
          () => {},
        )
      : frage(
          {
            titel: marktName(w),
            text: t("sammlung.nichtBesessen"),
            ja: t("sammlung.zumShopJa"),
          },
          () => onShop?.(gameId, w.id),
        );
  const bereiche = (id: string): SammelBereich[] =>
    id === "brochess" ? ["blatt"] : ["blatt", "szene", "ruecken"];
  const bereichName = (id: string, art: SammelBereich) =>
    t(
      art === "szene"
        ? "sammlung.tisch"
        : art === "ruecken"
          ? "sammlung.ruecken"
          : id === "brochess"
            ? "sammlung.figuren"
            : "sammlung.blaetter",
    );
  const gewaehlt = (id: string, art: SammelBereich) => {
    const thema = me.themes[id];
    return art === "szene"
      ? thema?.tableScene || "stube"
      : art === "ruecken"
        ? thema?.cardBack || "standard"
        : thema?.cardDeck || "text";
  };
  const auswahlName = (id: string, art: SammelBereich, wert: string) =>
    id === "brochess"
      ? (FIGURENSAETZE.find((s) => s.id === wert)?.name ?? "Klassisch")
      : marktName({ art, wert, nameKey: "" });
  const waehlen = (id: string, art: SammelBereich, wert: string) =>
    onThemeChange(
      id,
      art === "szene"
        ? { tableScene: wert }
        : art === "ruecken"
          ? { cardBack: wert }
          : { cardDeck: wert },
    );
  const liste = (id: string, art: SammelBereich) =>
    (art === "szene"
      ? SZENEN
      : art === "ruecken"
        ? RUECKEN
        : id === "brochess"
          ? FIGURENSAETZE
          : decksFor(id)
    ).map((e) => e.id);
  const gewechselt = (id: string) => {
    position.current = 0;
    rueckkehr.current = null;
    setOffen(null);
    setFilter(id);
    onSpiel?.(id);
    if (rolle.current) rolle.current.scrollTop = 0;
  };
  const oeffnen = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string,
    art: SammelBereich,
  ) => {
    position.current = rolle.current?.scrollTop ?? 0;
    rueckkehr.current = e.currentTarget;
    setOffen({ spiel: id, art });
  };
  const vorschau = (id: string, art: SammelBereich, wert: string) => (
    <SammlungVorschau
      spiel={id}
      art={art}
      wert={wert}
      deck={gewaehlt(id, "blatt")}
    />
  );
  return (
    <div className="hb-spiele sammlung-neu">
      <header className="hb-kopfzeile">
        <h1 className="hb-titel">{t("sammlung.titel")}</h1>
        <button
          className="sam-shoplink"
          onClick={() => onShop?.(offen?.spiel ?? filter)}
        >
          {t("sammlung.zumShop")}
        </button>
      </header>
      <div
        className="hb-chips sam-spielchips"
        role="tablist"
        aria-label={t("sammlung.chips")}
      >
        {["alle", ...spiele, "pinguin"].map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            className={`hb-chip${filter === id ? " is-an" : ""}`}
            onClick={() => gewechselt(id)}
          >
            {id === "alle" || id === "pinguin" ? (
              <SammelIcon art={id} />
            ) : (
              <img src={bannerFuer(id)} alt="" />
            )}
            {id === "alle"
              ? t("sammlung.alle")
              : id === "pinguin"
                ? t("sammlung.meinPinguin")
                : t(`game.${id}`)}
          </button>
        ))}
      </div>
      <div className="hb-spiele-rolle sam-rolle" ref={rolle}>
        {fehler && (
          <p role="alert">
            {t("sammlung.ladeFehler")}{" "}
            <button onClick={laden}>{t("sammlung.erneut")}</button>
          </p>
        )}
        {!shop && !fehler && <p role="status">{t("sammlung.laedt")}</p>}
        {!offen && (
          <>
            <p className="sam-hinweis">{t("sammlung.uebersichtText")}</p>

            {shop &&
              spiele
                .filter((id) => filter === "alle" || filter === id)
                .map((gameId) => (
                  <section className="sam-spiel" key={gameId}>
                    <h2 className="sam-spieltitel">
                      <img src={bannerFuer(gameId)} alt="" />
                      <span>
                        {t(`game.${gameId}`)}
                        <small>{t("sammlung.deinStil")}</small>
                      </span>
                    </h2>
                    <div
                      className="sam-bereichskacheln"
                      aria-label={tf("sammlung.designbereiche", {
                        spiel: t(`game.${gameId}`),
                      })}
                    >
                      {bereiche(gameId).map((art) => {
                        const wert = gewaehlt(gameId, art),
                          name = bereichName(gameId, art);
                        return (
                          <button
                            type="button"
                            id={`sam-einstieg-${gameId}-${art}`}
                            className={`sam-bereichskachel ist-${art}`}
                            key={art}
                            onClick={(e) => oeffnen(e, gameId, art)}
                          >
                            <span className="sam-kachelkopf">
                              <SammelIcon
                                art={gameId === "brochess" ? "figuren" : art}
                              />
                              <strong>{name}</strong>
                              <span aria-hidden="true">›</span>
                            </span>
                            {vorschau(gameId, art, wert)}
                            <span className="sam-ausgeruestet">
                              <small>{t("sammlung.aktuell")}</small>
                              <b>{auswahlName(gameId, art, wert)}</b>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
            {(filter === "alle" || filter === "pinguin") && (
              <section className="sam-pinguin">
                <Pinguin getragen={me.avatar} groesse={6} />
                <div>
                  <h2>
                    <SammelIcon art="pinguin" />
                    {t("sammlung.pinguin.titel")}
                  </h2>
                  <p>{t("sammlung.pinguin.text")}</p>
                  <button className="markt-knopf" onClick={onSchrank}>
                    {t("sammlung.pinguin.schrank")}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
        {offen && shop && (
          <section className="sam-auswahl">
            <button className="sam-zurueck" onClick={() => setOffen(null)}>
              ‹ {t("sammlung.zurUebersicht")}
            </button>
            <div className="sam-detailtitel">
              <SammelIcon
                art={offen.spiel === "brochess" ? "figuren" : offen.art}
              />
              <div>
                <small>{t(`game.${offen.spiel}`)}</small>
                <h2 tabIndex={-1} ref={titel}>
                  {bereichName(offen.spiel, offen.art)}
                </h2>
              </div>
            </div>
            <nav
              className="sam-bereichwechsel"
              aria-label={tf("sammlung.designbereiche", {
                spiel: t(`game.${offen.spiel}`),
              })}
            >
              {bereiche(offen.spiel).map((art) => (
                <button
                  key={art}
                  aria-pressed={offen.art === art}
                  onClick={() => setOffen({ ...offen, art })}
                >
                  <SammelIcon
                    art={offen.spiel === "brochess" ? "figuren" : art}
                  />
                  {bereichName(offen.spiel, art)}
                </button>
              ))}
            </nav>
            <p className="sam-hinweis">{t("sammlung.auswahlText")}</p>
            <div
              className={`sam-raster${offen.art === "szene" ? " ist-tische" : ""}`}
            >
              {liste(offen.spiel, offen.art).map((wert) => {
                const w = ware(offen.art, wert),
                  klassisch = offen.spiel === "brochess" && wert === "text";
                if (!w && !klassisch) return null;
                const aktiv = gewaehlt(offen.spiel, offen.art) === wert,
                  besessen = klassisch || w?.besessen;
                return (
                  <button
                    type="button"
                    key={wert}
                    className={`sam-design${aktiv ? " ist-aktiv" : ""}${besessen ? "" : " ist-zu"}`}
                    aria-pressed={aktiv}
                    onClick={() =>
                      besessen
                        ? waehlen(offen.spiel, offen.art, wert)
                        : w && imShop(offen.spiel, w)
                    }
                  >
                    {vorschau(offen.spiel, offen.art, wert)}
                    <strong>
                      {w
                        ? marktName(w)
                        : auswahlName(offen.spiel, offen.art, wert)}
                    </strong>
                    <small>
                      {aktiv
                        ? t("sammlung.ausgewaehlt")
                        : besessen
                          ? t("sammlung.auswaehlen")
                          : w?.nurErspielt
                            ? t("sammlung.erspielen")
                            : tf("sammlung.gesperrt", {
                                preis: zahl(w?.preis.coins ?? 0),
                              })}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {rueckfrage}
    </div>
  );
}
