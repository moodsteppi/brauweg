import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { api, type Suchstand } from '../api';
import { motivBildPfad } from '../minispiele/mememory/bildpfad';
import { Ecken } from '../minispiele/mememory/Ecken';
import { eckeVon, farbeVon, sitzeAus, type Ecke } from '../minispiele/mememory/eckenplan';
import { Einstellungsfenster } from '../minispiele/mememory/Einstellungsfenster';
import { Heim } from '../minispiele/mememory/Heim';
import { ladeMemeToene, spieleKlang, spieleMemeTon } from '../minispiele/mememory/klaenge';
import { KiMatch } from '../minispiele/mememory/KiMatch';
import { MehrSeite } from '../minispiele/mememory/MehrSeite';
import { SammlungSeite } from '../minispiele/mememory/SammlungSeite';
import {
  Stufenregler,
  botLevelAus,
  stufenName,
  type Stufe,
} from '../minispiele/mememory/Stufenregler';
import { Vorschlagskasten } from '../minispiele/mememory/Vorschlagskasten';
import type { ReaktionMessage } from '../protocol';
import { PfeilLinks } from '../zeichen';
import { useTable } from '../useTable';

/**
 * Mememory — Memory-Duell zu zweit.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie beim Feldherr: ohne Tisch das
 * Hauptmenue mit der Match-Suche, mit Tisch das Brett. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Suche reicht ihre
 * Tischkennung mitten im Bildschirm nach, und ein Wechsel ueber zwei
 * Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Der Bildschirm bildet KEINE Regel nach.
 * Er schickt genau das, was der Spieler antippt, und zeichnet, was in der
 * Sicht steht. Die einzige Ausnahme ist die Vorwegnahme des eigenen Tipps
 * (`getippt`) — sie dreht die Karte sofort, damit die Bewegung nicht auf die
 * Funkstrecke wartet, und wird von der naechsten Sicht bestaetigt oder
 * zurueckgenommen.
 */

/** Sicht des Moduls, siehe packages/game-mememory/src/sicht.ts. */
interface MememorySicht {
  spalten: number;
  zeilen: number;
  /** Die Motive dieser Partie, sortiert — Grundlage des Vorladens. */
  motive: string[];
  /** Motivkennung je Platz, oder null solange die Karte verdeckt liegt. */
  feld: (string | null)[];
  besitzer: (number | null)[];
  offen: number[];
  punkte: Record<number, number>;
  namen: Record<number, string>;
  dran: number;
  pause: 'treffer' | 'daneben' | 'mischen' | null;
  merkzeitMs: number;
  /** Karten, die noch auf dem Nachschubstapel warten. Zu zweit immer 0. */
  vorrat: number;
  /** Wie oft schon gemischt wurde. Steigt, wird das Brett neu verteilt. */
  mischung: number;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
  /**
   * Welcher Sitz von einem Bot welcher Staerke gespielt wird. Fehlt, wenn
   * kein Bot am Tisch sitzt.
   *
   * Sie steht in JEDER Sicht (siehe sicht.ts im Modul) und nicht nur im
   * Gedaechtnis dieses Bildschirms: Wer nach einem Neuladen an seinen Tisch
   * zurueckkommt, soll an der Ecke weiterhin lesen, gegen wen er spielt.
   */
  stufen?: Record<number, Stufe>;
}


/**
 * Regelsatz, mit dem der KI-Tisch aufgemacht wird.
 *
 * Muss zu DEFAULT_REGELN in packages/game-mememory/src/regeln.ts passen —
 * dort steht auch, warum es vier Spalten sind und nicht fuenf. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Der Knopf soll nicht
 * auf eine zusaetzliche Antwort warten, bevor er den Tisch aufmacht.
 *
 * Nur noch hier und nicht mehr in der Mitspielersuche: Die baut ihren Tisch
 * seit dem 06.09.2026 serverseitig und nimmt dort `defaultConfig()` des
 * Moduls. Was dabei WEGFAELLT, ist `zusatz` — die hochgeladenen Motive kommen
 * an einem Tisch aus der Schlange nicht vor. Das steht als Karte auf dem
 * Issueboard und laesst sich hier nicht heilen: Der Client hat gar keine
 * Gelegenheit mehr, dem Tisch etwas mitzugeben.
 */
const REGELSATZ = { spalten: 4, zeilen: 6, merkzeitMs: 1100 };

/**
 * Takt, in dem der Stand der Suche abgefragt wird.
 *
 * Eine Sekunde, weil daneben ein Countdown laeuft: Bei einem traegeren Takt
 * springt die Zahl. Der Abruf ist zugleich das Lebenszeichen an den Server —
 * hoert er auf, faellt man von selbst aus der Schlange (siehe
 * packages/server/src/suche/schlange.ts).
 */
const SUCH_TAKT_MS = 1000;

/**
 * Zeichenvorrat der Reaktionen.
 *
 * Die REIHENFOLGE ist Protokoll: Ueber die Leitung geht nur die Nummer, nicht
 * das Zeichen (der Server soll gar nicht wissen, was da fliegt — aus einer
 * Zahl laesst sich niemand beleidigen). Wer hier etwas einfuegt, verschiebt
 * die Bedeutung aller folgenden Nummern und muss die Modulversion hochsetzen.
 * Anhaengen ist gefahrlos.
 */
const REAKTIONEN = ['😂', '😮', '😎', '😭', '🔥'] as const;

/** Viermal je Sekunde, so wie es der Server auch deckelt. */
const REAKTION_PAUSE_MS = 250;

/**
 * Ein Meme je Sekunde und Spieler.
 *
 * Deutlich strenger als beim Emoji, und das hat einen Grund: Ein Emoji ist
 * ein Zeichen von 34 px, ein Meme ist ein Bild von 92 px, das quer ueber das
 * Brett fliegt. Viermal je Sekunde waeren vier davon gleichzeitig in der
 * Luft — waehrend der Gegner sich Karten merken will. Der Server deckelt
 * dasselbe noch einmal; hier steht es, damit die Leitung gar nicht erst
 * belastet wird.
 */
const MOTIV_PAUSE_MS = 1000;

/** Muss zu GURT_MAX in packages/server/src/sammlung.ts passen. */
const GURT_FAECHER = 3;

/**
 * Der erste Teil der Mischbewegung: die Karten zur Mitte zusammenschieben.
 *
 * Die Mischpause des Moduls dauert 2200 ms (`pauseDauerMs` in partie.ts) und
 * teilt sich in zwei Haelften: dieses Zusammenschieben, und danach das
 * Austeilen der neuen Lage, sobald sie vom Server kommt. Wer die eine Zahl
 * aendert, ohne die andere anzusehen, laesst die Bewegung entweder ins Leere
 * laufen oder schneidet sie ab.
 */
const MISCH_SAMMELN_MS = 820;

/** So viele Emojis duerfen hoechstens gleichzeitig fliegen. */
const FLIEGER_MAX = 12;

/**
 * Wie oft gefragt wird, ob ein Bot dazwischenruft — und wie oft er es tut.
 *
 * 35 % alle dreieinhalb Sekunden sind im Schnitt ein Zwischenruf je zehn
 * Sekunden, also etwa ein halbes Dutzend in einer Partie. Genug, dass der
 * Gegner lebendig wirkt; wenig genug, dass niemand deswegen ein Paar
 * vergisst. Gewuerfelt wird und kein fester Takt: Ein Meme alle zehn
 * Sekunden auf die Sekunde genau ist eine Uhr, kein Gegenueber.
 */
const SPAM_TAKT_MS = 3500;
const SPAM_CHANCE = 0.35;

/**
 * Die drei Memes eines Bots.
 *
 * Eins zum Jubeln, eins zum Verlieren, eins zum Dazwischenrufen. Gezogen
 * werden sie aus den Motiven DIESER Partie (`sicht.motive`) — das ist der
 * einzige Topf, den beide Seiten kennen und der garantiert Bilder enthaelt,
 * die auch geladen sind. Eine eigene Sammlung hat ein Bot nicht: Sammeln
 * setzt ein Konto voraus.
 */
interface BotGurt {
  readonly gut: string;
  readonly schlecht: string;
  readonly spam: string;
}

/**
 * Die Gurte ALLER Bots in einem Zug ziehen.
 *
 * In einem Zug und nicht je Bot einzeln, weil der Topf ein gemeinsamer ist:
 * Zwoelf Motive liegen auf dem Brett, drei Gegner brauchen neun. Zoege jeder
 * fuer sich, saehe man denselben Frosch von zwei Ecken kommen — und das ist
 * genau die Verwechslung, die ein eigener Gurt je Gegner verhindern soll.
 *
 * Geht der Topf doch aus (kleines Brett, viele Bots), wird er neu gefuellt,
 * statt einen Anlass leer zu lassen: Ein Bot ohne Jubel-Meme jubelte gar
 * nicht, und das faellt mehr auf als ein doppeltes Bild.
 */
function ziehGurte(motive: readonly string[], sitze: readonly number[]): Record<number, BotGurt> {
  if (motive.length === 0) return {};
  let topf: string[] = [];
  const nimm = (): string => {
    if (topf.length === 0) topf = [...motive];
    return topf.splice(Math.floor(Math.random() * topf.length), 1)[0] ?? '';
  };
  const gurte: Record<number, BotGurt> = {};
  for (const sitz of sitze) gurte[sitz] = { gut: nimm(), schlecht: nimm(), spam: nimm() };
  return gurte;
}

interface Flieger {
  readonly id: number;
  readonly zeichen: number;
  /** Gesammeltes Motiv statt des Emojis. Siehe den Gurt weiter unten. */
  readonly motiv?: string;
  /** Ecke des Absenders — dort startet der Flug, das Ziel ist die Mitte. */
  readonly ecke: Ecke;
  /** Seitlicher Versatz, damit zwei schnelle Reaktionen nicht uebereinander liegen. */
  readonly ab: number;
}

export function Mememory({
  startTisch,
  istAufsicht = false,
  onBack,
}: {
  /** Tisch aus dem "Weiterspielen" des Hubs. Sonst faengt alles im Menue an. */
  startTisch?: string | null;
  /**
   * Testkonto: darf im Vorschlagskasten freigeben, ablehnen und direkt
   * aufnehmen. Kommt fertig aus App.tsx — der Client rechnet nichts aus
   * Rechten aus, und der Server prueft es ohnehin ein zweites Mal.
   */
  istAufsicht?: boolean;
  onBack: () => void;
}): React.JSX.Element {
  const [tischId, setTischId] = useState<string | null>(startTisch ?? null);
  /** Stand der Mitspielersuche. `null` heisst: es wird nicht gesucht. */
  const [suchstand, setSuchstand] = useState<Suchstand | null>(null);
  /** Ein Knopf ist gedrueckt, die Antwort steht noch aus. */
  const [sucht, setSucht] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Das Einstellungsfenster liegt ueber dem Menue, sobald es offen ist. */
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  /**
   * Die Staerke, mit der ein wartender Tisch aufgefuellt wird.
   *
   * Sie lebt nur in diesem Bildschirm: Am Tisch steht sie in den Filtern
   * (`setBotLevel`), und dort ist sie die Wahrheit — hier steht nur, was der
   * Regler zeigen soll.
   */
  const [fuellStufe, setFuellStufe] = useState<Stufe>('mittel');
  /** Der Vorschlagskasten liegt ueber dem Menue, sobald er offen ist. */
  const [kastenOffen, setKastenOffen] = useState(false);
  /** Wie viele Vorschlaege warten. Nur die Aufsicht bekommt die Zahl. */
  const [warten, setWarten] = useState(0);
  /**
   * Namen der hochgeladenen Motive, Kennung -> Name.
   *
   * Nur die hochgeladenen haben einen; die 88 Grundmotive heissen nirgends
   * anders als in ihrer Kennung, und eine aus `dj-katze` gebastelte
   * Beschriftung waere geraten, nicht benannt. Steht kein Name da, blendet
   * das Brett auch nichts ein — besser als ein leeres Band.
   */
  const [motivNamen, setMotivNamen] = useState<Record<string, string>>({});
  /**
   * Der ganze Motivtopf, wie ihn der Server kennt: fester Katalog plus
   * freigegebene Einsendungen.
   *
   * Er wird nur von der Sammlungsseite gebraucht — sie zeigt auch, was noch
   * FEHLT, und dafuer reicht die eigene Sammlung nicht aus. Der Client
   * fuehrt den Katalog ausdruecklich NICHT selbst (er kennt keine
   * Spielregeln, siehe game-mememory/src/regeln.ts); er bekommt ihn vom
   * Server durchgereicht.
   */
  const [katalog, setKatalog] = useState<{ grund: string[]; hochgeladen: string[] }>({
    grund: [],
    hochgeladen: [],
  });
  /**
   * Was gerade ueber dem Brett aufblitzt: der Name des Paares, der Hinweis
   * auf die Sammlung, oder beides. Die Nummer ist der Schluessel der
   * Animation — zwei Treffer hintereinander mit demselben Namen muessen sie
   * neu starten, und dafuer muss sich der Schluessel aendern.
   *
   * `name` kann fehlen: Die 88 Grundmotive heissen nirgends. Dann blitzt
   * nur der Sammlungshinweis auf, und der steht ohne Namen genauso richtig.
   */
  const [namensblitz, setNamensblitz] = useState<{
    nr: number;
    name?: string;
    neu?: boolean;
  } | null>(null);
  const blitzNr = useRef(0);
  /**
   * Die bis zu drei gewaehlten Motive. Sind welche da, ersetzen sie den
   * Emoji-Knopf am Tisch — so hat der Nutzer es sich gewuenscht. Ist der Gurt
   * leer (frisches Konto, nichts gewaehlt), bleibt es beim Emoji: lieber der
   * alte Knopf als gar keine Reaktion.
   */
  const [gurt, setGurt] = useState<string[]>([]);
  /** Der Bildschirm "KI-Match erstellen" liegt STATT des Menues da. */
  const [kiOffen, setKiOffen] = useState(false);
  /** Das Brett, auf dem gerade gezeichnet wird — Grundlage der Mischbewegung. */
  const brettRef = useRef<HTMLDivElement | null>(null);
  /**
   * Die eigene Sammlung, wie sie beim Aufschlagen des Bildschirms stand.
   *
   * Sie steht hier, damit "das ist neu" SOFORT feststeht und nicht erst,
   * wenn der Server geantwortet hat: Der Hinweis blitzt zusammen mit dem
   * Namen auf, und der blitzt in dem Moment, in dem das Paar liegt. Eine
   * Antwort, die 300 ms spaeter kommt, waere zu spaet fuer dieselbe
   * Animation.
   */
  const gesammelt = useRef(new Set<string>());
  /**
   * Zufallsgurt an? Und welche Faecher sind festgehalten?
   *
   * Beides in Refs: Gezeichnet wird davon nichts, gefragt wird es genau
   * einmal — beim Betreten eines Tisches. Ein Zustand loeste hier nur ein
   * Neuzeichnen des Bretts aus.
   */
  const zufall = useRef(false);
  const schloesser = useRef<readonly boolean[]>([]);
  /**
   * Welche Motive einen Ton haben — die Auskunft des Servers.
   *
   * Ebenfalls eine Schachtel: Gezeichnet wird davon nichts, gefragt wird sie
   * beim Vorladen. Sie kommt mit der Motivliste und ist meistens kurz — die
   * 88 Grundmotive stehen nie darin, sie liegen als Dateien im Client und
   * koennen deshalb gar keinen Ton haben.
   */
  const mitTon = useRef(new Set<string>());
  /**
   * Der Gurt DIESER Partie.
   *
   * `null` heisst: der gespeicherte Gurt gilt. Sonst steht hier die
   * Ziehung fuer die laufende Partie — festgehaltene Faecher unveraendert,
   * die anderen neu aus der Sammlung.
   */
  const [partieGurt, setPartieGurt] = useState<string[] | null>(null);
  /**
   * Motive, deren Meldung nicht durchkam. Sie reisen bei der naechsten
   * Meldung mit — eine verlorene Anfrage kostet sonst ein Bild in der
   * Sammlung, und der naechste Treffer meldet seit dem 27. August nicht
   * mehr alles noch einmal mit.
   */
  const nachtrag = useRef<string[]>([]);
  /**
   * Platz, den ich gerade angetippt habe — dreht sofort, ohne auf den Server
   * zu warten.
   *
   * Mit der Revision, die zum Zeitpunkt des Tipps galt: Sobald irgendeine
   * neuere Sicht eintrifft, hat der Server den Tipp verarbeitet (oder
   * abgelehnt), und die Vorwegnahme hat ausgedient.
   *
   * Der erste Anlauf verglich stattdessen, ob der Platz in `offen` auftaucht —
   * und blieb haengen, sobald zwei Sichten im selben Takt eintrafen: React
   * fasst sie zusammen, die Zwischenstufe mit dem eigenen Platz wird nie
   * gerendert, und die Karte blieb fuer den Rest der Partie umgedreht.
   */
  const [getippt, setGetippt] = useState<{ platz: number; revision: number } | null>(null);

  /**
   * Motive, deren Bild fertig geladen UND entpackt ist.
   *
   * Der Grund ist die Umdreh-Bewegung: Wer eine Karte antippt, sieht die
   * Rueckseite wegdrehen — und dahinter lag bis eben eine weisse Flaeche,
   * weil das Bild erst mit der Serverantwort kommt und danach noch entpackt
   * werden muss. Die Karte dreht deshalb in zwei Stufen (siehe `data-halb`).
   */
  const [bereiteBilder, setBereiteBilder] = useState<ReadonlySet<string>>(new Set());

  /** Emojis, die gerade ueber den Tisch fliegen. */
  const [flieger, setFlieger] = useState<readonly Flieger[]>([]);
  const fliegerNr = useRef(0);
  const letzteReaktion = useRef(0);
  /**
   * Das Zeichen, das der Knopf gerade anbietet.
   *
   * Es wandert von selbst weiter (siehe unten). Gesendet wird GENAU dieses —
   * der erste Anlauf wuerfelte beim Tippen, und dann stand auf dem Knopf
   * etwas anderes, als beim Gegner ankam.
   */
  const [angeboten, setAngeboten] = useState(0);
  const letzteMotivReaktion = useRef(0);
  /**
   * Laeuft die Sperre nach einem geworfenen Meme gerade?
   *
   * Ein Merker neben `letzteMotivReaktion` und keine Ableitung daraus: Die
   * Ref sagt der Bremse, ob ein Wurf durchgeht, aber sie loest kein Zeichnen
   * aus. Ohne den Zustand haette die Kachel keinen Anlass, den Film wieder
   * abzunehmen.
   */
  const [kuehlt, setKuehlt] = useState(false);
  const knopfRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Ecke eines Sitzes — als Ref, weil die Antwort erst feststeht, wenn der
   * Tisch da ist, und `beiReaktion` VOR dem Tisch gebaut werden muss (es
   * geht als Rueckruf in `useTable` hinein). Gesetzt wird beim Zeichnen,
   * gelesen beim Eintreffen einer Reaktion.
   */
  const eckeRef = useRef<(sitz: number) => Ecke>(() => 'or');

  const zeigeFlieger = useCallback(
    (zeichen: number, ecke: Ecke, motiv?: string): void => {
      const id = (fliegerNr.current += 1);
      // Weniger Streuung als frueher: Die Fluege laufen jetzt alle auf die
      // Mitte zu, und dort wuerde ein grosser Versatz sie am Ziel vorbeiziehen.
      const ab = Math.round((Math.random() - 0.5) * 52);
      // Der Ton haengt am Motiv und wird deshalb HIER gespielt und nicht an
      // den drei Stellen, die etwas werfen: Ein eigener Wurf, einer der
      // Gegenseite und einer der KI kommen alle hier vorbei. Wer keinen Ton
      // hat, bleibt stumm; nachgeladen wird nichts (siehe klaenge.ts).
      if (motiv) spieleMemeTon(motiv);
      // Der Deckel ist kein Schoenheitsfehler: Ohne ihn haelt ein Dauerklicker
      // beliebig viele Knoten am Leben, und der Bildschirm ruckelt.
      setFlieger((alt) => [...alt, { id, zeichen, motiv, ecke, ab }].slice(-FLIEGER_MAX));
      window.setTimeout(() => setFlieger((alt) => alt.filter((f) => f.id !== id)), 1450);
    },
    [],
  );

  /**
   * Eine Reaktion der Gegenseite.
   *
   * Sie startet in der Ecke DESSEN, DER SIE GESCHICKT HAT, und fliegt in die
   * Mitte. Der Sitz steht in der Nachricht und wird vom Server gestempelt —
   * behauptet wird er nie vom Client. Bis zum 27. August fiel jede fremde
   * Reaktion einfach von oben herein; das ging, solange es genau einen
   * Gegner gab, und sagt bei dreien nichts mehr darueber, wer da ruft.
   */
  const beiReaktion = useCallback(
    (nachricht: ReaktionMessage): void =>
      zeigeFlieger(nachricht.zeichen, eckeRef.current(nachricht.seat), nachricht.motiv),
    [zeigeFlieger],
  );

  const tisch = useTable<MememorySicht>(
    tischId,
    'mememory',
    undefined,
    undefined,
    undefined,
    beiReaktion,
  );
  const sicht = tisch.view?.view ?? null;
  /**
   * Der eigene Sitz — als Zuschauer bewusst -1 und nicht 0.
   *
   * Ein Zuschauer sitzt nirgends. Mit 0 saehe er sich selbst als Sitz 0
   * unten links, wuerde dessen Paare in die eigene Sammlung buchen und
   * bekaeme "Du bist dran" angezeigt.
   */
  const eigenerSitz = sicht?.zuschauer ? -1 : (tisch.view?.seat ?? 0);
  /** Die Sitze dieses Tisches, aufsteigend. Grundlage der Ecken. */
  const sitze = sicht ? sitzeAus(sicht.punkte) : [];
  // Beim Zeichnen gesetzt, beim Eintreffen einer fremden Reaktion gelesen.
  eckeRef.current = (sitz: number): Ecke => eckeVon(sitz, eigenerSitz, sitze);

  // -------------------------------------------------------------------------
  // Die KI wirft Memes
  // -------------------------------------------------------------------------

  /**
   * Jeder Bot bekommt drei Memes und drei Anlaesse.
   *
   * **Das passiert rein im Client, und das ist die richtige Stelle.** Eine
   * Reaktion ist kein Zustand (siehe gateway.ts): nicht gespeichert, in keiner
   * Sicht, ueberlebt kein Neuladen. Ein Bot koennte sie also gar nicht
   * schicken — er hat keine Verbindung. Und er braucht auch keine: An einem
   * KI-Tisch sitzt genau ein Mensch (`visibility: 'on_request'`,
   * `fillWithBots`), es gibt also niemanden, dem etwas entginge. Das
   * Spielmodul bleibt damit unberuehrt — es weiss nichts von Memes, und ein
   * Zwischenruf ist keine Regel.
   *
   * Welche drei es sind, wird je Tisch EINMAL gewuerfelt. Bei jedem Wurf neu
   * zu ziehen hiesse, dass der Gegner kein Gesicht hat; so hat jede Partie
   * ihren eigenen Gegner mit seinen drei Spruechen.
   */
  const botGurte = useRef<Record<number, BotGurt>>({});
  const gurtTisch = useRef<string | null>(null);
  const stufenListe = sicht?.stufen;

  useEffect(() => {
    if (!tischId || !sicht || sicht.motive.length === 0) {
      if (!tischId) {
        gurtTisch.current = null;
        botGurte.current = {};
      }
      return;
    }
    if (gurtTisch.current === tischId) return;
    gurtTisch.current = tischId;
    botGurte.current = ziehGurte(
      sicht.motive,
      Object.keys(stufenListe ?? {}).map(Number),
    );
  }, [tischId, sicht?.motive.length, stufenListe]);

  /**
   * Ein Bot wirft eines seiner drei Memes.
   *
   * Ohne Gurt passiert nichts — dann sitzt an diesem Platz ein Mensch, oder
   * die Motive der Partie waren beim Ziehen noch nicht da.
   */
  const wirfBotMeme = useCallback(
    (sitz: number, anlass: keyof BotGurt): void => {
      const kennung = botGurte.current[sitz]?.[anlass];
      if (!kennung) return;
      zeigeFlieger(0, eckeRef.current(sitz), kennung);
    },
    [zeigeFlieger],
  );

  /**
   * Der Zwischenruf: waehrend ANDERE am Zug sind, immer mal wieder eines.
   *
   * Nur wer gerade nicht dran ist, ruft dazwischen — wer selbst aufdeckt, hat
   * zu tun. Und nur, solange die Partie laeuft: Zum Schluss kommt ohnehin das
   * Meme zum Ausgang, und zwei gleichzeitig waeren Laerm.
   */
  const dranJetzt = sicht?.dran ?? null;
  const fertig = sicht?.fertig ?? false;
  useEffect(() => {
    if (!sicht || fertig) return;
    const takt = window.setInterval(() => {
      if (Math.random() > SPAM_CHANCE) return;
      const wartende = Object.keys(botGurte.current)
        .map(Number)
        .filter((sitz) => sitz !== dranJetzt);
      const wer = wartende[Math.floor(Math.random() * wartende.length)];
      if (wer !== undefined) wirfBotMeme(wer, 'spam');
    }, SPAM_TAKT_MS);
    return () => window.clearInterval(takt);
  }, [sicht !== null, fertig, dranJetzt, wirfBotMeme]);

  /**
   * Das Meme zum Ausgang: Wer gewonnen hat, jubelt; alle anderen nicht.
   *
   * Gestaffelt, damit bei drei Gegnern nicht drei Bilder im selben Bild
   * losfliegen — das saehe nach einem Fehler aus und nicht nach drei
   * Meinungen.
   */
  const endeGeworfen = useRef(false);
  useEffect(() => {
    if (!fertig) {
      endeGeworfen.current = false;
      return;
    }
    if (endeGeworfen.current) return;
    endeGeworfen.current = true;
    const sieger = sicht?.sieger ?? null;
    const uhren = Object.keys(botGurte.current)
      .map(Number)
      .map((sitz, i) =>
        window.setTimeout(
          () => wirfBotMeme(sitz, sitz === sieger ? 'gut' : 'schlecht'),
          260 + i * 380,
        ),
      );
    return () => uhren.forEach((uhr) => window.clearTimeout(uhr));
  }, [fertig, sicht?.sieger, wirfBotMeme]);

  // -------------------------------------------------------------------------
  // Aktive Spieler
  // -------------------------------------------------------------------------

  // Auch im Wartebereich weiterzaehlen: Dort steht die Zahl noch einmal, und
  // eine eingefrorene Null waehrend der Suche sieht aus, als suchte man allein.
  // Erst wenn die Partie laeuft, hoert die Abfrage auf.
  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('mememory')
        .then((antwort) => {
          if (lebt) setAktiv(antwort.aktiv);
        })
        .catch(() => {
          /* Die Zahl ist Beiwerk. Ein Fehlversuch darf das Menue nicht stoeren. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 5000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [sicht !== null]);

  /**
   * Die Namen der hochgeladenen Motive.
   *
   * Einmal beim Aufschlagen des Bildschirms, fuer BEIDE Seiten — nicht nur
   * fuer den, der den Tisch aufmacht. Faellt der Abruf aus, bleibt es beim
   * stummen Brett; ein Name ist Beiwerk und darf keine Partie aufhalten.
   */
  useEffect(() => {
    let lebt = true;
    void api
      .mememoryMotive()
      .then((antwort) => {
        if (!lebt) return;
        setMotivNamen(antwort.namen ?? {});
        setKatalog({ grund: antwort.grund ?? [], hochgeladen: antwort.hochgeladen ?? [] });
        // In eine Schachtel und nicht in den Zustand: Die Liste wird nie
        // gezeichnet, sondern nur gefragt ("hat das einen Ton?"). Ein Zustand
        // loeste bei jeder Antwort ein Neuzeichnen des Bretts aus.
        mitTon.current = new Set(antwort.toene ?? []);
      })
      .catch(() => {
        /* ohne Namen weiterspielen */
      });
    return () => {
      lebt = false;
    };
  }, []);

  /**
   * Der eigene Gurt UND die eigene Sammlung. Beim Aufschlagen und immer
   * dann, wenn man vom Tisch ins Menue zurueckkommt — dort ist die Sammlung
   * gewachsen, und dort steht auch der Gurt zur Wahl.
   *
   * Die Sammlung landet in einem Ref und nicht im Zustand: Sie wird nicht
   * gezeichnet, sondern nur gefragt ("kenne ich das schon?"), und ein
   * Zustand mit zweitausend Eintraegen loeste bei jeder Antwort ein
   * ueberfluessiges Neuzeichnen des Bretts aus.
   */
  useEffect(() => {
    if (tischId) return;
    let lebt = true;
    void api
      .mememorySammlung()
      .then((antwort) => {
        if (!lebt) return;
        setGurt(antwort.gurt);
        zufall.current = antwort.zufall === true;
        schloesser.current = antwort.gesperrt ?? [];
        gesammelt.current = new Set(antwort.gesammelt.map((zeile) => zeile.kennung));
      })
      .catch(() => {
        /* Ohne Gurt bleibt der Emoji-Knopf. */
      });
    return () => {
      lebt = false;
    };
  }, [tischId]);

  /**
   * Beim Betreten eines Tisches wird der Gurt gezogen — wenn der Zufallsgurt
   * an ist.
   *
   * Festgehaltene Faecher bleiben, die uebrigen bekommen ein anderes Motiv
   * aus der eigenen Sammlung. Gezogen wird EINMAL je Partie und nicht bei
   * jedem Zeichnen: Sonst wechselten die Knoepfe unter dem Daumen.
   *
   * Das passiert rein im Client, und das ist kein Versehen: Der Gurt geht
   * ohnehin nie an den Server: Ans Brett kommt immer nur das eine geworfene
   * Motiv (siehe `wirfMotiv`). Es gibt also gar keine Stelle, an der ein
   * Server etwas zu ziehen haette.
   */
  useEffect(() => {
    if (!tischId) {
      setPartieGurt(null);
      return;
    }
    if (!zufall.current) return;
    const topf = [...gesammelt.current];
    if (topf.length === 0) return;
    const gezogen: string[] = [];
    for (let fach = 0; fach < GURT_FAECHER; fach += 1) {
      const gehalten = schloesser.current[fach] === true ? gurt[fach] : undefined;
      if (gehalten) {
        gezogen.push(gehalten);
        continue;
      }
      // Kein Motiv zweimal in denselben Gurt: Drei gleiche Knoepfe waeren
      // keine Auswahl.
      const frei = topf.filter((k) => !gezogen.includes(k));
      if (frei.length === 0) break;
      gezogen.push(frei[Math.floor(Math.random() * frei.length)] ?? '');
    }
    setPartieGurt(gezogen.filter(Boolean));
  }, [tischId]);

  /**
   * Die Zahl am Briefkasten: wie viele Vorschlaege warten.
   *
   * Nur fuer die Aufsicht und nur im Menue — und bewusst OHNE Takt. Ein
   * Vorschlagskasten ist nichts, was im Sekundentakt neu gezaehlt werden
   * muesste; einmal beim Aufschlagen des Menues und nach jedem Schliessen
   * des Kastens reicht.
   */
  useEffect(() => {
    if (!istAufsicht || tischId || kastenOffen) return;
    let lebt = true;
    void api
      .mememoryOffen()
      .then((antwort) => {
        if (lebt) setWarten(antwort.offen);
      })
      .catch(() => {
        /* Kein Recht, kein Netz: Dann steht am Knopf eben keine Zahl. */
      });
    return () => {
      lebt = false;
    };
  }, [istAufsicht, tischId, kastenOffen]);

  // -------------------------------------------------------------------------
  // Match-Suche
  // -------------------------------------------------------------------------

  /**
   * Mitspieler finden — seit dem 06.09.2026 ueber die Suchschlange des Servers
   * und nicht mehr ueber die Tischliste.
   *
   * Der alte Weg (offenen Tisch suchen, sonst selbst einen aufmachen, und ein
   * Wettrennen zweier gleichzeitig aufgemachter Tische per Kennungsvergleich
   * im 2,5-Sekunden-Takt aufloesen) ist damit weg. Er konnte zwei Menschen in
   * zwei getrennten Tischen festsetzen, und vor allem hatte er kein Ende: Wer
   * als Einziger suchte, wartete bis zum Verfall seines Tisches.
   *
   * Mit ihm faellt auch die Frage "gegen wie viele?" weg, und das ist kein
   * Verlust, sondern der Kern der Sache: Jede Gegnerzahl war ein eigener Topf,
   * und drei Toepfe auf einer Plattform mit einer Handvoll Leuten heisst, dass
   * in jedem einzelnen niemand steht. Die Schlange hat nur einen. Sie baut
   * einen Tisch fuer VIER — die groesste Sitzzahl, die das Modul zulaesst
   * (SEAT_COUNTS in packages/game-mememory/src/regeln.ts), damit keiner der
   * Gefundenen abgewiesen wird. Laenger wird die Partie davon nicht: Ab dem
   * dritten Spieler bringt jeder acht Karten mit, die vom Stapel nachruecken,
   * statt das Brett zu vergroessern (`vorrat` in partie.ts). Wer lieber zu
   * zweit spielt, findet das unter "Gegen die KI spielen".
   */
  const starteSuche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const stand = await api.sucheStarten('mememory');
      if (stand.tischId) setTischId(stand.tischId);
      else setSuchstand(stand);
    } catch {
      setFehler('Die Suche ist fehlgeschlagen. Noch einmal versuchen?');
    } finally {
      setSucht(false);
    }
  }, []);

  /**
   * Nachfragen, solange gesucht wird.
   *
   * Abhaengig ist der Effekt vom SCHLUESSEL `suchstand !== null` und nicht vom
   * Objekt: Er setzt bei jedem Takt einen neuen Stand, und mit dem Objekt in
   * der Liste raeumte er dabei jedes Mal seinen eigenen Zeitgeber ab (siehe
   * CLAUDE.md).
   */
  const suchtGerade = suchstand !== null;
  useEffect(() => {
    if (!suchtGerade) return;
    let lebt = true;
    const frage = (): void => {
      void api
        .sucheStand('mememory')
        .then((stand) => {
          if (!lebt) return;
          if (stand.tischId) {
            // Ohne Rueckfrage hinueber: Wer 30 Sekunden gewartet hat, will
            // spielen und keinen zweiten Knopf.
            setSuchstand(null);
            setTischId(stand.tischId);
            return;
          }
          if (!stand.sucht) {
            // Die Schlange kennt uns nicht mehr — etwa nach einem Neustart des
            // Servers. Lieber ehrlich melden als stumm weiterdrehen.
            setSuchstand(null);
            setFehler('Die Suche wurde beendet. Noch einmal versuchen?');
            return;
          }
          setSuchstand(stand);
        })
        .catch(() => {
          /* Ein einzelner Fehlversuch ist kein Abbruch: Der Server wirft uns
             erst nach mehreren stillen Sekunden aus der Schlange. */
        });
    };
    const takt = window.setInterval(frage, SUCH_TAKT_MS);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [suchtGerade]);

  /**
   * Den Bildschirm verlassen heisst die Suche verlassen.
   *
   * Ohne das stuende man nach dem Weggehen noch bis zu acht Sekunden in der
   * Schlange und wuerde womoeglich an einen Tisch gesetzt, den niemand mehr
   * ansieht.
   */
  const suchtRef = useRef(false);
  suchtRef.current = suchtGerade;
  useEffect(
    () => () => {
      if (suchtRef.current) void api.sucheAbbrechen('mememory').catch(() => {});
    },
    [],
  );

  const brichSucheAb = useCallback((): void => {
    setSuchstand(null);
    void api.sucheAbbrechen('mememory').catch(() => {});
  }, []);

  /**
   * Einen Tisch gegen die KI aufmachen.
   *
   * `fillWithBots` besetzt jeden freien Platz — der Ersteller sitzt auf 0,
   * die Bots also ab 1. Genau so wandern die Stufen in die `config`:
   * Sitz 1 bekommt den ersten Eintrag, Sitz 2 den zweiten. Damit steht die
   * Erweiterung auf vier Spieler schon: eine laengere Liste, sonst nichts.
   *
   * `on_request` und nicht oeffentlich: Ein Bot-Tisch in der Lobbyliste
   * faenge Leute ab, die einen Menschen suchen — dieselbe Ueberlegung wie bei
   * Easy Poker.
   */
  const starteKi = useCallback(async (stufen: Stufe[]): Promise<void> => {
    setSucht(true);
    setFehler(null);
    try {
      const zusatz = await api
        .mememoryMotive()
        .then((antwort) => antwort.hochgeladen)
        .catch(() => []);
      const botStufen = Object.fromEntries(stufen.map((stufe, i) => [i + 1, stufe]));
      const { id } = await api.createTable({
        gameId: 'mememory',
        config: {
          ...REGELSATZ,
          ...(zusatz.length > 0 ? { zusatz } : {}),
          botStufen,
        },
        seats: 1 + stufen.length,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setKiOffen(false);
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setSucht(false);
    }
  }, []);

  const brichAb = useCallback((): void => {
    const id = tischId;
    setSucht(false);
    setTischId(null);
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  /**
   * Zurueck zur Spielauswahl — und dem Server sagen, dass man weg ist.
   *
   * Der Client entscheidet dabei NICHT, ob der Tisch geschlossen wird; das
   * tut der Server (verlasseKiTisch in tables/service.ts). Er schliesst einen
   * laufenden Tisch nur, wenn danach ausser Bots niemand mehr sitzt — bei
   * einem Online-Match antwortet er mit einem Konflikt, und der ist hier
   * genau richtig: Die Partie laeuft weiter, ein Bot uebernimmt, und wer
   * wiederkommt, findet seinen Platz.
   *
   * Deshalb steht hier auch kein `await`: Zurueck geht es sofort. Eine
   * abgebrochene Anfrage kostet hoechstens einen Tisch, den die
   * Verfallslogik spaeter ohnehin einsammelt.
   */
  const verlasseUndZurueck = useCallback((): void => {
    const id = tischId;
    if (id) void api.leaveTable(id).catch(() => {});
    onBack();
  }, [tischId, onBack]);

  // -------------------------------------------------------------------------
  // Vorladen, Klang
  // -------------------------------------------------------------------------

  /**
   * Bilder vorladen UND entpacken, sobald die Motivliste da ist.
   *
   * `decode()` statt `onload` ist hier der Unterschied, auf den es ankommt:
   * Ein geladenes, aber noch nicht entpacktes Bild erscheint erst einen
   * Bildlauf spaeter — und genau dieser eine Bildlauf ist das Aufblitzen der
   * leeren Karte mitten in der Drehung.
   *
   * Ein Fehlschlag zaehlt ausdruecklich auch als "fertig". Sonst bliebe eine
   * Karte, deren Datei fehlt, fuer immer halb gedreht stehen — ein fehlendes
   * Bild darf das Spiel nicht anhalten.
   */
  useEffect(() => {
    if (!sicht) return;
    let lebt = true;
    for (const kennung of sicht.motive) {
      const bild = new Image();
      const fertig = (): void => {
        if (!lebt) return;
        setBereiteBilder((alt) => (alt.has(kennung) ? alt : new Set(alt).add(kennung)));
      };
      bild.src = motivBildPfad(kennung);
      if (typeof bild.decode === 'function') void bild.decode().then(fertig, fertig);
      else {
        bild.onload = fertig;
        bild.onerror = fertig;
      }
    }
    return () => {
      lebt = false;
    };
  }, [sicht?.motive.join(',')]);

  /**
   * Ein Motiv in die Sammlung melden.
   *
   * Einzeln und sofort, seit dem 27. August: Gemeldet wird nur noch das
   * selbst geholte Paar, und davon gibt es je Partie hoechstens zwoelf. Der
   * alte Bund mit Verzoegerung war noetig, solange JEDE umgedrehte Karte
   * eine Meldung ausloeste.
   *
   * Was nicht durchkommt, reist beim naechsten Mal mit. Der Deckel von 40
   * ist der des Servers (MELDUNG_MAX).
   */
  const melde = useCallback((kennung: string): void => {
    const stapel = [...new Set([kennung, ...nachtrag.current])].slice(-40);
    nachtrag.current = [];
    void api.mememoryGesehen(stapel).catch(() => {
      nachtrag.current = [...new Set([...stapel, ...nachtrag.current])].slice(-40);
    });
  }, []);

  /**
   * Die Toene dieser Partie vorladen, sobald Brett und Tonliste da sind.
   *
   * Vorladen und nicht beim Wurf holen: Ein Flug dauert 1450 ms, ein Ton, der
   * erst danach ankommt, gehoert zu einem Bild, das nicht mehr da ist.
   * Geladen wird, was auf dem Brett liegt UND was im eigenen Gurt steckt —
   * das Zweite ist nicht dasselbe: Ein gesammeltes Meme muss in dieser Partie
   * nicht vorkommen.
   *
   * Bei ausgeschaltetem Ton passiert nichts (siehe `ladeMemeToene`): kein
   * Kontext, kein Abruf, kein Byte.
   */
  const gurtJetzt = (partieGurt ?? gurt).join(',');
  useEffect(() => {
    if (!sicht) return;
    const topf = [...new Set([...sicht.motive, ...(partieGurt ?? gurt)])].filter((kennung) =>
      mitTon.current.has(kennung),
    );
    if (topf.length > 0) void ladeMemeToene(topf);
  }, [sicht?.motive.join(','), gurtJetzt]);

  /** Klangausloeser. Verglichen wird gegen den vorigen Stand, nicht gegen die Zeit. */
  const vorigeOffen = useRef<number[]>([]);
  const vorigePause = useRef<MememorySicht['pause']>(null);
  const siegGespielt = useRef(false);
  useEffect(() => {
    if (!sicht) return;
    // Fremde Karte umgedreht: der eigene Tipp hat schon beim Antippen geklungen.
    const neu = sicht.offen.filter((platz) => !vorigeOffen.current.includes(platz));
    if (neu.length > 0 && sicht.dran !== eigenerSitz) spieleKlang('dreh');
    vorigeOffen.current = [...sicht.offen];

    if (sicht.pause !== vorigePause.current) {
      if (sicht.pause === 'treffer') {
        /*
         * Der Name des gefundenen Paares blitzt auf, und wenn es das eigene
         * war, wandert das Motiv in die Sammlung.
         *
         * Die Kennung steht in der Sicht an jedem der beiden offenen
         * Plaetze — waehrend der Schaupause sind sie aufgedeckt. Wem das
         * Paar gehoert, steht in `besitzer` und nicht in `dran`: Das ist
         * dasselbe, solange die Schaupause laeuft, aber `besitzer` sagt es
         * ueber den Platz und haelt auch dann noch, wenn irgendwann einmal
         * jemand anderes den Zug bekommt.
         */
        const platz = sicht.offen[0];
        const kennung = platz === undefined ? null : sicht.feld[platz];
        const wer = platz === undefined ? null : sicht.besitzer[platz];
        const meins = wer !== null && wer === eigenerSitz;
        spieleKlang(meins ? 'treffer' : 'gefunden');

        /*
         * Geht das Paar an einen Bot, wirft er sein Jubel-Meme.
         *
         * Der Anlass ist der Besitzer des Platzes und nicht `dran`: Beides
         * sagt waehrend der Schaupause dasselbe, aber der Besitzer sagt es
         * ueber die KARTE — und die ist es, um die es geht.
         */
        if (wer !== null && !meins) wirfBotMeme(wer, 'gut');

        /*
         * Gesammelt wird NUR das selbst geholte Paar.
         *
         * Bis zum 27. August zaehlte jede umgedrehte Karte — auch die
         * einzelne, auch die des Gegners. Damit war die Sammlung nach drei
         * Partien voll und bedeutete nichts mehr. Jetzt kostet ein Bild
         * einen Punkt.
         */
        let frisch = false;
        if (meins && kennung && !gesammelt.current.has(kennung)) {
          gesammelt.current.add(kennung);
          frisch = true;
          melde(kennung);
        }

        // Ohne Namen und ohne Sammlungshinweis blitzt gar nichts auf — ein
        // leeres Band ueber dem Brett waere schlechter als nichts.
        const name = kennung ? motivNamen[kennung] : undefined;
        if (name || frisch) {
          setNamensblitz({ nr: (blitzNr.current += 1), name, neu: frisch });
        }
      } else if (sicht.pause === 'daneben') {
        spieleKlang('daneben');
      } else if (sicht.pause === 'mischen') {
        // Dasselbe Geraeusch wie beim Umdrehen: Es ist derselbe Vorgang,
        // nur mit dem ganzen Brett auf einmal.
        spieleKlang('dreh');
      }
      vorigePause.current = sicht.pause;
    }

    if (sicht.fertig && !siegGespielt.current) {
      siegGespielt.current = true;
      if (sicht.sieger !== null) {
        spieleKlang(sicht.sieger === eigenerSitz ? 'sieg' : 'niederlage');
      }
    }
  }, [sicht, eigenerSitz, motivNamen, melde, wirfBotMeme]);

  /**
   * Der Namensblitz raeumt sich selbst weg.
   *
   * Etwas laenger als die Animation (1500 ms), damit sie sicher zu Ende
   * gelaufen ist, bevor der Knoten verschwindet — sonst bricht sie im
   * letzten Bild ab. Der Schluessel ist die Nummer: Ein neuer Treffer setzt
   * eine neue, und der alte Zeitgeber wird beim Aufraeumen abgeraeumt.
   */
  useEffect(() => {
    if (!namensblitz) return;
    const uhr = window.setTimeout(() => setNamensblitz(null), 1600);
    return () => window.clearTimeout(uhr);
  }, [namensblitz]);

  /**
   * Die Sperre nimmt sich nach einer Sekunde selbst zurueck.
   *
   * Die Uhr steht hier und nicht in der Bewegung: Eine CSS-Animation friert
   * in einem verdeckten Tab ein (siehe Mischbewegung weiter unten), ein
   * `setTimeout` wird dort zwar auf eine Sekunde gedeckelt, kommt aber. Wer
   * das Handy waehrend der Sperre sperrt, findet die Kacheln danach also
   * frei — und nicht unter einem Film, der nie verschwindet.
   */
  useEffect(() => {
    if (!kuehlt) return;
    const uhr = window.setTimeout(() => setKuehlt(false), MOTIV_PAUSE_MS);
    return () => window.clearTimeout(uhr);
  }, [kuehlt]);

  /**
   * Das Angebot wandert im Zweisekundentakt weiter.
   *
   * Damit ist der Knopf ein kleines Spiel im Spiel: Wer ein bestimmtes Zeichen
   * schicken will, muss den Moment abpassen. Der Reihe nach und nicht
   * gewuerfelt — nur so laesst sich abwarten, dass das gewuenschte Zeichen
   * gleich kommt.
   *
   * Laeuft nur am Brett: Im Menue gibt es keinen Knopf, und ein Takt, der
   * dort weiterliefe, zeichnete den Bildschirm alle zwei Sekunden umsonst neu.
   */
  useEffect(() => {
    if (!sicht) return;
    const takt = window.setInterval(
      () => setAngeboten((n) => (n + 1) % REAKTIONEN.length),
      2000,
    );
    return () => window.clearInterval(takt);
  }, [sicht !== null]);

  // -------------------------------------------------------------------------
  // Mischen
  // -------------------------------------------------------------------------

  /**
   * Die Mischbewegung, in zwei Haelften.
   *
   * Sie laeuft ueber die Web-Animations-Schnittstelle und nicht ueber CSS,
   * und der Grund ist der Weg: Jede Karte muss aus IHRER Ecke zur Mitte —
   * das sind vierundzwanzig verschiedene Strecken, die kein Blatt kennt.
   * Gemessen wird deshalb einmal je Haelfte, bewegt wird nur `transform`.
   *
   * Erste Haelfte: Sobald das Modul die Mischpause meldet, laufen alle
   * Karten zur Mitte zusammen und BLEIBEN dort (`fill: forwards`). Waehrend
   * der Pause aendert sich am Zustand nichts mehr, es wird also auch nicht
   * neu gezeichnet.
   */
  const mischt = sicht?.pause === 'mischen';
  const mischNr = sicht?.mischung ?? 0;
  const ruhig = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Mitte des Bretts in Bildschirmkoordinaten. */
  const brettMitte = (brett: HTMLElement): { x: number; y: number } => {
    const kasten = brett.getBoundingClientRect();
    return { x: kasten.left + kasten.width / 2, y: kasten.top + kasten.height / 2 };
  };

  useLayoutEffect(() => {
    const brett = brettRef.current;
    if (!mischt || !brett) return;
    const karten = [...brett.querySelectorAll<HTMLElement>('.mm-karte')];
    /*
     * **Erst abbrechen, dann messen** — dieselbe Regel wie unten, und hier
     * kostete ihr Fehlen einen halben Nachmittag.
     *
     * Eine Bewegung mit `fill: forwards` haelt die Karten dort fest, wo sie
     * geendet hat. Laeuft sie nicht zu Ende — weil das Telefon gesperrt wird
     * oder der Reiter in den Hintergrund geht, dann steht die Uhr der
     * Animation still —, kleben sie in der Mitte. Die naechste Messung
     * bekaeme dann fuer JEDE Karte die Mitte, jede Strecke waere null, und
     * das Einsammeln sah aus wie blosses Schrumpfen.
     */
    for (const karte of karten) for (const lauf of karte.getAnimations()) lauf.cancel();
    if (ruhig()) return;

    const ziel = brettMitte(brett);
    for (const karte of karten) {
      const kasten = karte.getBoundingClientRect();
      const dx = ziel.x - (kasten.left + kasten.width / 2);
      const dy = ziel.y - (kasten.top + kasten.height / 2);
      karte.animate(
        [
          { transform: 'translate(0, 0) scale(1)' },
          { transform: `translate(${dx}px, ${dy}px) scale(0.8)` },
        ],
        {
          duration: MISCH_SAMMELN_MS,
          easing: 'cubic-bezier(.55, 0, .25, 1)',
          fill: 'forwards',
        },
      );
    }

    /*
     * Beim Aufraeumen zurueck an den Platz.
     *
     * React raeumt diesen Effekt ab, sobald die Mischpause vorbei ist — also
     * genau bevor der Austeil-Effekt misst. Ohne das Abbrechen haengt die
     * `forwards`-Fuellung noch an den Karten, und auch der zweite Teil
     * measste die Mitte. Ausserdem loest es den Haenger, wenn die neue Lage
     * gar nicht mehr kommt (Verbindung weg): Dann stehen die Karten wieder
     * da, wo sie hingehoeren, statt fuer immer in der Mitte.
     */
    return () => {
      for (const karte of karten) for (const lauf of karte.getAnimations()) lauf.cancel();
    };
  }, [mischt]);

  /**
   * Zweite Haelfte: Die neue Lage ist da (`mischung` ist gestiegen), die
   * Karten fliegen aus der Mitte auf ihre Plaetze.
   *
   * **Erst abbrechen, dann messen.** Die Bewegung der ersten Haelfte haelt
   * die Karten in der Mitte fest; ohne `cancel()` bekaeme die Messung genau
   * diese Mitte und jede Strecke waere null — die Karten stuenden einfach da.
   */
  useLayoutEffect(() => {
    const brett = brettRef.current;
    if (mischNr === 0 || !brett) return;
    const karten = [...brett.querySelectorAll<HTMLElement>('.mm-karte')];
    for (const karte of karten) for (const lauf of karte.getAnimations()) lauf.cancel();
    if (ruhig()) return;
    const ziel = brettMitte(brett);
    karten.forEach((karte, i) => {
      const kasten = karte.getBoundingClientRect();
      const dx = ziel.x - (kasten.left + kasten.width / 2);
      const dy = ziel.y - (kasten.top + kasten.height / 2);
      karte.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.8)` },
          { transform: 'translate(0, 0) scale(1)' },
        ],
        {
          duration: 560,
          // Gestaffelt austeilen — alle auf einmal saehe aus wie ein Schnitt,
          // nicht wie Karten, die verteilt werden.
          delay: i * 16,
          easing: 'cubic-bezier(.2, .8, .25, 1)',
          fill: 'backwards',
        },
      );
    });
  }, [mischNr]);

  /** Die Vorwegnahme faellt mit der naechsten Sicht — bestaetigt oder nicht. */
  const revision = tisch.view?.revision ?? -1;
  useEffect(() => {
    if (getippt !== null && revision !== getippt.revision) setGetippt(null);
  }, [revision, getippt]);

  // -------------------------------------------------------------------------
  // Hauptmenue
  // -------------------------------------------------------------------------

  /**
   * Das Zahnrad, oben rechts.
   *
   * Es hat den Lautsprecher unten rechts abgeloest. Ein Schalter am Rand
   * traegt genau eine Einstellung; sobald die zweite kommt, braucht es
   * ohnehin eine Stelle, an der man nachsieht — und die soll schon da sein,
   * bevor man sie sucht.
   */
  const einstellungsKnopf = (
    <button
      className="mm-zahnrad"
      type="button"
      onClick={() => setEinstellungenOffen(true)}
      aria-label="Einstellungen öffnen"
      title="Einstellungen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {/*
          * Ein Zahnrad aus acht Zaehnen am Rand und einem Kranz — mit einem
          * LOCH in der Mitte, so wie ein Zahnrad eins hat.
          *
          * Der erste Anlauf war ein von Hand geschriebener Umriss und sass
          * gemessene 6,3 % zu hoch. Der zweite waren vier durchgehende
          * Balken; die lagen mittig, fuellten aber die Mitte aus. Jetzt sind
          * es acht kurze Zaehne, die AUSSEN am Kranz sitzen: Jeder ist
          * dasselbe Rechteck, nur um (12,12) gedreht — damit kann die
          * Zeichnung gar nicht schief liegen, und innerhalb des Kranzes
          * bleibt nichts stehen.
          *
          * Der Kranz ist ein Ring aus Strichstaerke und nicht zwei gefuellte
          * Kreise: Das Loch muss durchsichtig sein, denn dahinter liegt der
          * Knopf und keine bekannte Farbe.
          */}
        <g fill="currentColor">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((winkel) => (
            <rect
              key={winkel}
              x="10.6"
              y="1.9"
              width="2.8"
              height="4.8"
              rx="1"
              transform={`rotate(${winkel} 12 12)`}
            />
          ))}
        </g>
        <circle cx="12" cy="12" r="6.1" fill="none" stroke="currentColor" strokeWidth="3.2" />
      </svg>
    </button>
  );

  if (!tischId && kiOffen) {
    return (
      <KiMatch
        laeuft={sucht}
        fehler={fehler}
        onStart={(stufen) => void starteKi(stufen)}
        onBack={() => {
          setKiOffen(false);
          setFehler(null);
        }}
      />
    );
  }

  if (!tischId && suchstand) {
    const sekunden = Math.ceil(suchstand.restMs / 1000);
    const gefunden = suchstand.suchende;
    return (
      <main className="mm-menue">
        <button className="mm-zurueck" type="button" onClick={brichSucheAb}>
          ← Abbrechen
        </button>
        <div className="mm-menue-mitte">
          <h1 className="mm-titel mm-titel-klein">Mitspieler suchen</h1>
          {/* Die Zahl gross und ohne Einheit: Sie zaehlt sichtbar herunter und
              beantwortet damit die einzige Frage, die man hier hat. */}
          <p className="mm-countdown" aria-live="polite">
            {sekunden}
          </p>
          <p className="mm-untertitel">
            {gefunden === 1
              ? 'Noch niemand sonst — bleibt es dabei, wird mit Bots aufgefüllt.'
              : `${gefunden} Spieler gefunden`}
          </p>
          <div className="mm-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="mm-untertitel">{aktiv ?? '…'} Spieler gerade in Mememory</p>
        </div>
      </main>
    );
  }

  if (!tischId) {
    return (
      <>
        {/*
          * Drei Seiten nebeneinander statt Knoepfen am Rand.
          *
          * Der Briefkasten und die Sammlung sassen bis zum 27. August als
          * kleine runde Knoepfe unten links und oeffneten je ein Blatt ueber
          * dem Menue. Beides ist jetzt eine ganze Seite: Die Sammlung
          * braucht die Flaeche (ueber hundert Bilder wollen einzeln
          * erkennbar sein), und "Mehr" ist der Platz, an dem Freunde und
          * alles Weitere dazukommen, ohne dass der Rand voller Knoepfe wird.
          */}
        <Heim
          sammlung={
            <SammlungSeite
              grund={katalog.grund}
              hochgeladen={katalog.hochgeladen}
              namen={motivNamen}
              onGurt={setGurt}
            />
          }
          mehr={<MehrSeite wartende={warten} onKasten={() => setKastenOffen(true)} />}
          menue={
            <div className="mm-menue">
              {/* Der Zurueck-Knopf sitzt bewusst nicht ganz oben: Auf iPhones
                  mit Notch liegt die obere Ecke unter der Statusleiste. */}
              <button className="mm-zurueck" type="button" onClick={onBack}>
                ← Zurück
              </button>
              {einstellungsKnopf}

              <div className="mm-menue-mitte">
                <h1 className="mm-titel">Mememory</h1>
                <p className="mm-untertitel">Zwei Bilder, ein Paar, zwei bis vier Spieler.</p>

                {/* Der Knopf sucht seit dem 06.09.2026 wieder selbst. Der
                    Zwischenschritt "gegen wie viele?" hing an den drei
                    getrennten Toepfen der alten Suche; die Schlange hat nur
                    einen und setzt alle Gefundenen an einen Vierertisch. */}
                <button
                  className="mm-suchen"
                  type="button"
                  onClick={() => void starteSuche()}
                  disabled={sucht}
                >
                  <span>Online Match suchen…</span>
                  {/* Die Zahl steht in Klammern daneben und nicht im Satz:
                      Sie aendert sich alle fuenf Sekunden, und ein
                      springendes Wort mitten im Text liest sich wie ein
                      Fehler. */}
                  <em>({aktiv ?? '…'})</em>
                </button>

                {/* Mit Abstand unter der Match-Suche: Es sind zwei
                    verschiedene Entscheidungen, und der Zwischenraum sagt das
                    ohne Worte. */}
                <button
                  className="mm-ki-knopf"
                  type="button"
                  onClick={() => {
                    setFehler(null);
                    setKiOffen(true);
                  }}
                  disabled={sucht}
                >
                  <span>Gegen die KI spielen</span>
                </button>

                {fehler && <p className="mm-fehler">{fehler}</p>}
              </div>
            </div>
          }
        />

        {/* Die beiden Fenster liegen ueber ALLEN Seiten und nicht in einer
            davon: Ein Blatt, das mit dem Streifen mitwischt, waere kein
            Fenster mehr. */}
        {kastenOffen && (
          <Vorschlagskasten istAufsicht={istAufsicht} onFertig={() => setKastenOffen(false)} />
        )}
        {einstellungenOffen && (
          <Einstellungsfenster onFertig={() => setEinstellungenOffen(false)} />
        )}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Wartebereich
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    /** Plaetze, auf denen weder ein Mensch noch ein Bot sitzt. */
    const freiePlaetze = (tisch.table?.seats ?? []).filter(
      (platz) => !platz.accountId && !platz.isBot,
    );
    return (
      <main className="mm-menue">
        <button className="mm-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="mm-menue-mitte">
          <h1 className="mm-titel">Tisch wird aufgebaut</h1>
          <p className="mm-untertitel">
            {/* Die Platzzahl kommt vom Tisch und steht nicht als 2 im Text:
                Sobald es Tische zu dritt und zu viert gibt, stimmt eine
                festgeschriebene Zwei nur noch manchmal. */}
            {tisch.status === 'open'
              ? `${besetzt} von ${tisch.table?.seats.length ?? 2} Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
          </p>
          <div className="mm-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="mm-untertitel">{aktiv ?? '…'} Spieler gerade in Mememory</p>

          {/*
            * "Mit Bots auffuellen" — nur an Tischen fuer drei oder vier.
            *
            * Zu zweit gibt es dafuer schon "Gegen die KI spielen" im Menue.
            * An einem Vierertisch dagegen ist das Warten der Regelfall,
            * solange nicht gerade vier Leute gleichzeitig dasselbe wollen —
            * und ohne diesen Knopf saehe man nur zu, wie nichts passiert.
            *
            * Aufgefuellt wird ueber `addBot` je freiem Platz, denselben Weg
            * nimmt der Wartebereich der anderen Spiele auch.
            */}
          {freiePlaetze.length > 0 && (tisch.table?.seats.length ?? 2) > 2 && (
            <div className="mm-fuellblock">
              {/*
                * Die Staerke steht ÜBER dem Knopf und nicht dahinter: Sie
                * gilt fuer alle Bots dieses Tisches, und wer sie erst nach
                * dem Auffuellen sieht, hat sie zu spaet gesehen.
                *
                * Gesetzt wird sie ueber `setBotLevel` — das ist eine
                * TISCHeinstellung und keine Regel, sie laesst sich also
                * aendern, solange gewartet wird. Der Regelsatz des Tisches
                * steht dagegen seit dem Erstellen fest; ihm eine Stufe
                * nachzureichen ginge gar nicht.
                */}
              <Stufenregler
                wert={fuellStufe}
                onWert={(stufe) => {
                  setFuellStufe(stufe);
                  tisch.setBotLevel(botLevelAus(stufe));
                }}
                beschriftung="Spielstärke der Bots"
              />
              <button
                className="mm-zweitknopf mm-fuellen"
                type="button"
                onClick={() => {
                  // Erst die Stufe, dann die Bots: Sie liegt danach am Tisch
                  // und gilt fuer die Partie, die gleich startet.
                  tisch.setBotLevel(botLevelAus(fuellStufe));
                  for (const platz of freiePlaetze) tisch.addBot(platz.seat);
                }}
              >
                Mit Bots auffüllen ({freiePlaetze.length})
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Brett
  // -------------------------------------------------------------------------

  const meinZug = sicht.dran === eigenerSitz && sicht.pause === null && !sicht.fertig;
  const offenLokal =
    getippt === null || sicht.offen.includes(getippt.platz)
      ? sicht.offen
      : [...sicht.offen, getippt.platz];
  const deckeFarbe = sicht.fertig ? 'weiss' : farbeVon(sicht.dran);
  /**
   * Nur die Decken, die dieser Tisch brauchen kann.
   *
   * Es gibt fuenf Dateien (weiss und vier Spielerfarben), aber ein Tisch zu
   * zweit sieht nie mehr als drei davon. Alle fuenf ins Blatt zu haengen
   * kostete den Spieler 50 kB Ladezeit fuer Bilder, die nie zu sehen sind —
   * und die Ladezeit ist bei diesem Spiel die Zahl, an der alles haengt
   * (docs/ASSETS-MEMEMORY.md).
   */
  const decken = [...new Set(['weiss', ...sitze.map(farbeVon)])];
  /**
   * Der Gegner ist am Zug — dann liegt das ganze Brett blasser da.
   *
   * Das war vorher ein Zufall: Solange man nicht dran war, trugen ALLE Karten
   * das `disabled`-Merkmal, und WebKit zeichnet deaktivierte Knoepfe blasser.
   * Der Nebeneffekt (auch die gerade selbst umgedrehte Karte war blass) ist
   * weg, die Anzeige bleibt — jetzt als eigene Regel, die auch sagt, was sie
   * meint. Massgeblich ist `dran`, nicht `meinZug`: Waehrend der eigenen
   * Schaupause ist man nicht am Zug, aber eben auch nicht am Warten.
   */
  const wartend = !sicht.fertig && sicht.dran !== eigenerSitz;

  const tippe = (platz: number): void => {
    if (!meinZug || offenLokal.length >= 2) return;
    if (sicht.besitzer[platz] !== null || offenLokal.includes(platz)) return;
    setGetippt({ platz, revision });
    spieleKlang('dreh');
    tisch.send({ typ: 'aufdecken', platz });
  };

  /** Die eigene Ecke — von dort starten die eigenen Reaktionen. */
  const eigeneEcke = eckeVon(eigenerSitz, eigenerSitz, sitze);

  /** Die Sitze fuer den Abschlussstand: der eigene zuerst, dann der Reihe nach. */
  const ich = sitze.indexOf(eigenerSitz);
  const standReihe = ich < 0 ? sitze : [...sitze.slice(ich), ...sitze.slice(0, ich)];

  /**
   * Der eigene Platz: einer mehr, als es Bessere gibt.
   *
   * Gleiche Punkte ergeben denselben Platz — bei zwoelf Paaren koennen zwei
   * Leute sechs haben, und dann sind beide Zweiter (bzw. Erster).
   */
  const eigenerPlatz =
    sitze.filter((sitz) => (sicht.punkte[sitz] ?? 0) > (sicht.punkte[eigenerSitz] ?? 0)).length + 1;
  const abschlussTitel =
    eigenerSitz < 0
      ? 'Partie zu Ende'
      : sitze.length <= 2
        ? sicht.sieger === null
          ? 'Unentschieden'
          : sicht.sieger === eigenerSitz
            ? 'Gewonnen!'
            : 'Verloren'
        : sicht.sieger === eigenerSitz
          ? 'Gewonnen!'
          : eigenerPlatz === 1
            ? 'Geteilter Sieg'
            : `${eigenerPlatz}. Platz`;

  /**
   * Ein gewaehltes Motiv ueber den Tisch schicken.
   *
   * Eines je Sekunde, nicht viermal wie beim Emoji: Ein Meme ist ein Bild
   * quer ueber das Brett, kein Zeichen am Rand. Der Server deckelt dasselbe.
   */
  const wirfMotiv = (kennung: string): void => {
    const jetzt = Date.now();
    if (jetzt - letzteMotivReaktion.current < MOTIV_PAUSE_MS) return;
    letzteMotivReaktion.current = jetzt;
    setKuehlt(true);
    zeigeFlieger(0, eigeneEcke, kennung);
    tisch.sendeReaktion(0, kennung);
  };

  const reagiere = (): void => {
    const jetzt = Date.now();
    // Die Bremse steht auch hier, nicht nur im Server: Was ohnehin verworfen
    // wuerde, muss die Leitung gar nicht erst belasten.
    if (jetzt - letzteReaktion.current < REAKTION_PAUSE_MS) return;
    letzteReaktion.current = jetzt;

    // Genau das, was auf dem Knopf steht. Beide Seiten schlagen dieselbe
    // Nummer im selben Vorrat nach, also fliegt drueben dasselbe Zeichen.
    const zeichen = angeboten;
    zeigeFlieger(zeichen, eigeneEcke);
    tisch.sendeReaktion(zeichen);

    /*
     * Der Knopfdruck wird ueber die Web-Animations-Schnittstelle gespielt und
     * nicht ueber CSS: Eine CSS-Animation startet nur dann neu, wenn sich der
     * Animationsname aendert oder das Element neu entsteht — beim vierten
     * Tipp je Sekunde also gar nicht. `animate()` beginnt jedes Mal von vorn.
     */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      knopfRef.current?.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(.86)', offset: 0.35 },
          { transform: 'scale(1.06)', offset: 0.7 },
          { transform: 'scale(1)' },
        ],
        { duration: 280, easing: 'cubic-bezier(.2,.8,.25,1)' },
      );
    }
  };

  /**
   * Am Tisch steht der Name des KONTOS, nicht ein selbstgewaehlter.
   *
   * Bis zum 26. August gab es im Menue ein Feld dafuer, und die Sicht traegt
   * mit `namen` weiterhin die Moeglichkeit — das Spielmodul kann es, es
   * benutzt hier nur niemand mehr. Ein zweiter Name je Spiel war eine
   * Einladung, sich am selben Abend unter drei Namen zu zeigen; die
   * Plattform hat ohnehin einen, und der steht auch auf jeder Rangliste.
   */
  const namenVon = (sitz: number): string => {
    const platz = tisch.table?.seats.find((eintrag) => eintrag.seat === sitz);
    if (platz?.displayName) return platz.displayName;
    // Ein Bot hat keinen Anzeigenamen. "Sitz 2" waere richtig und nichtssagend
    // — an der Ecke soll stehen, gegen WEN man spielt.
    if (platz?.isBot) return 'KI';
    return sitz === eigenerSitz ? 'Du' : `Sitz ${sitz + 1}`;
  };

  return (
    <main className="mm-buehne" data-dran={deckeFarbe}>
      {/* Mehrere Bilder uebereinander statt eines eingefaerbten: Der
          Farbwechsel beim Zugwechsel wird so eine Ueberblendung und kein
          Bildsprung. */}
      <div className="mm-grund" aria-hidden="true">
        {decken.map((farbe) => (
          <img
            key={farbe}
            src={`/mememory/decke-${farbe}.webp`}
            alt=""
            data-an={deckeFarbe === farbe}
          />
        ))}
      </div>

      <button
        className="mm-raus"
        type="button"
        onClick={verlasseUndZurueck}
        aria-label="Spiel verlassen"
      >
        <PfeilLinks />
      </button>

      {/*
        * Vier Ecken statt zweier Leisten.
        *
        * Jeder sieht sich selbst unten links, der Gegner sitzt gegenueber.
        * Der Puck steht bei dem, der am Zug ist.
        *
        * Massgeblich ist `dran` und NICHT `amZug`: Waehrend der Schaupause
        * ist streng genommen niemand am Zug, aber der Puck verschwaende dann
        * nach jedem zweiten Aufdecker fuer eine Sekunde und kaeme wieder —
        * ein Blinken, kein Wandern. Die Tischdecke haelt es genauso.
        */}
      <Ecken
        sitze={sitze}
        eigenerSitz={eigenerSitz}
        punkte={sicht.punkte}
        nameVon={namenVon}
        stufeVon={(sitz) => stufenName(sicht.stufen?.[sitz])}
        dran={sicht.fertig ? null : sicht.dran}
      />

      {/*
        * Der Nachschubstapel, oben in der Mitte zwischen den beiden oberen
        * Ecken. Er steht nur da, wenn wirklich noch Karten warten — zu zweit
        * also nie.
        *
        * Drei uebereinanderliegende Karten und eine Zahl: Ein Stapel ist ein
        * Bild, das niemand erklaeren muss, und die Zahl beantwortet die
        * einzige Frage, die man daran hat.
        */}
      {sicht.vorrat > 0 && (
        <div className="mm-stapel" data-mischt={sicht.pause === 'mischen' ? '' : undefined}>
          <span className="mm-stapel-bild" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <em>{sicht.vorrat}</em>
          <span className="mm-verborgen">Karten warten auf dem Stapel</span>
        </div>
      )}

      <div className="mm-mitte">
        <div
          className="mm-brett"
          ref={brettRef}
          data-warten={wartend || undefined}
          data-mischt={sicht.pause === 'mischen' ? '' : undefined}
          style={
            {
              '--mm-spalten': sicht.spalten,
              '--mm-zeilen': sicht.zeilen,
            } as React.CSSProperties
          }
        >
          {sicht.feld.map((kennung, platz) => {
            const besitzer = sicht.besitzer[platz];
            /** Die Karte SOLL gedreht sein — ob sie es ganz kann, steht darunter. */
            const gewuenscht = kennung !== null || offenLokal.includes(platz);
            /** Ganz drehen darf sie erst, wenn das Bild auch zeigbar ist. */
            const zeigbar = kennung !== null && bereiteBilder.has(kennung);
            return (
              <button
                key={platz}
                type="button"
                className="mm-karte"
                data-offen={zeigbar || undefined}
                data-halb={(gewuenscht && !zeigbar) || undefined}
                data-besitz={besitzer === null ? undefined : farbeVon(besitzer)}
                /*
                 * KEIN `disabled`.
                 *
                 * Ein deaktivierter Knopf wird von Safari halbdurchsichtig
                 * gezeichnet — und damit sah jede gerade umgedrehte Karte
                 * blass aus, weil sie in dem Moment nicht mehr anklickbar
                 * ist. Ob ein Tipp zaehlt, entscheidet ohnehin `tippe`.
                 */
                aria-disabled={!meinZug || gewuenscht || undefined}
                onClick={() => tippe(platz)}
                aria-label={gewuenscht ? `Karte ${platz + 1}, aufgedeckt` : `Karte ${platz + 1}`}
              >
                <span className="mm-innen">
                  <span className="mm-rueck" />
                  <span className="mm-vorn">
                    {/* Kein <img> auf eine Datei, die es noch nicht gibt: Bis
                        die Sicht die Kennung liefert, bleibt die Flaeche leer. */}
                    {kennung && <img src={motivBildPfad(kennung)} alt="" draggable={false} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        * Der Name des gefundenen Paares.
        *
        * Liegt ueber dem Brett und nimmt keine Tipper an (`pointer-events`
        * steht im Blatt auf none) — waehrend der Schaupause darf man weiter
        * auf Karten zielen. Der Schluessel ist die Blitznummer: Ohne ihn
        * bliebe React beim selben Knoten, und ein zweiter Treffer mit
        * demselben Namen liefe die Animation gar nicht noch einmal.
        */}
      {namensblitz && (
        <div className="mm-namensblitz" aria-hidden="true">
          <span key={namensblitz.nr}>
            {namensblitz.name}
            {/* Der Sammlungshinweis haengt UNTER dem Namen und laeuft in
                derselben Animation mit — zwei getrennte Einblendungen
                uebereinander waeren zwei Dinge, die um denselben Blick
                streiten. */}
            {namensblitz.neu && <em className="mm-blitz-neu">Gesammelt</em>}
          </span>
        </div>
      )}

      {/* Reaktionen: ein Tipp, ein Emoji, kein Menue. Der Knopf bietet alle
          zwei Sekunden ein anderes Zeichen an — wer ein bestimmtes schicken
          will, passt den Moment ab. Eine Auswahlliste waere mitten in der
          Partie zu lange Beschaeftigung, ein fester Zufall waere Willkuer. */}
      {/*
        * Die Leiste zeigt den GURT, wenn einer belegt ist — bis zu drei
        * gesammelte Memes, jedes ein eigener Knopf. Ist er leer (frisches
        * Konto, noch nichts gewaehlt), bleibt es beim wandernden Emoji:
        * lieber der alte Knopf als gar keine Reaktion.
        */}
      {/*
        * Am Tisch gilt der Gurt DIESER Partie, wenn einer gezogen wurde —
        * sonst der gespeicherte. Beides ist dieselbe Leiste; nur die Liste
        * dahinter wechselt.
        */}
      {(partieGurt ?? gurt).length > 0 ? (
        <div className="mm-reaktionsleiste" data-gurt="">
          {(partieGurt ?? gurt).map((kennung) => (
            <button
              key={kennung}
              className="mm-reaktion mm-reaktion-motiv"
              type="button"
              onClick={() => wirfMotiv(kennung)}
              aria-label={`${motivNamen[kennung] ?? 'Meme'} werfen`}
              /*
               * Angezeigt, aber nicht gesperrt: `disabled` naehme dem Knopf
               * den Tastaturfokus mitten im Tippen, und der Browser haette
               * ihn danach an keiner sinnvollen Stelle wieder abgelegt. Die
               * Bremse sitzt ohnehin in `wirfMotiv`.
               */
              aria-disabled={kuehlt || undefined}
            >
              <img src={motivBildPfad(kennung)} alt="" draggable={false} />
              {/*
               * Der graue Film der Sperre.
               *
               * Er entsteht erst beim Wurf und verschwindet mit ihr — und
               * genau darum laeuft die Uhr als CSS-Animation: Sie beginnt
               * von selbst von vorn, weil der Knoten neu ist. (Ein
               * wiederholter Start waere das Problem, aber ein zweiter Wurf
               * kommt waehrend der Sperre gar nicht durch.)
               *
               * Zwei Haelften und kein Kegelverlauf: Ein `conic-gradient`
               * als Maske liesse sich nur ueber eine mit `@property`
               * angemeldete Winkelvariable bewegen, und die faellt bei
               * aelteren Geraeten auf den Startwert zurueck — dort bliebe
               * der Film dann ganz stehen. Zwei gedrehte Halbscheiben sind
               * reines `transform` und laufen ueberall.
               */}
              {kuehlt && (
                <span className="mm-kuehler" aria-hidden="true">
                  <i className="mm-kuehler-halb mm-kuehler-rechts" />
                  <i className="mm-kuehler-halb mm-kuehler-links" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
      <div className="mm-reaktionsleiste">
        <button
          ref={knopfRef}
          className="mm-reaktion"
          type="button"
          onClick={reagiere}
          aria-label={`Reaktion ${REAKTIONEN[angeboten] ?? ''} senden`}
        >
          {/*
           * Das Zeichen sitzt in einem eigenen Kasten, der den Knopf ganz
           * ausfuellt, und wird DARIN zentriert — nicht vom Knopf selbst.
           * Ein <button> bringt eine eigene Polsterung mit und legt seinen
           * Inhalt in einen anonymen Kasten; beides zusammen hat das Emoji
           * sichtbar aus der Mitte geschoben.
           */}
          <span className="mm-reaktion-zeichen" aria-hidden="true">
            {REAKTIONEN[angeboten] ?? REAKTIONEN[0]}
          </span>
        </button>
      </div>
      )}

      {/*
        * Jeder Flug ist ZWEI Knoten, und das ist kein Versehen.
        *
        * Aussen ein Kasten ueber die ganze Buehne, innen das Zeichen an der
        * Ecke des Absenders. Bewegt wird der aeussere: Seine
        * Prozentangaben rechnen gegen die Buehne, ein Weg von "Ecke zur
        * Mitte" ist damit derselbe Bruchteil auf jedem Geraet. Der innere
        * traegt nur die Lage. Ohne diese Teilung muesste die Strecke in
        * Pixeln ausgerechnet und bei jeder Drehung des Handys neu gemessen
        * werden.
        */}
      <div className="mm-flug" aria-hidden="true">
        {flieger.map((f) => (
          <span
            key={f.id}
            className="mm-flieger"
            data-ecke={f.ecke}
            style={{ '--mm-ab': `${f.ab}px` } as React.CSSProperties}
          >
            <span className="mm-flieger-koerper" data-motiv={f.motiv ? '' : undefined}>
              {f.motiv ? (
                <img src={motivBildPfad(f.motiv)} alt="" draggable={false} />
              ) : (
                (REAKTIONEN[f.zeichen] ?? REAKTIONEN[0])
              )}
            </span>
          </span>
        ))}
      </div>

      {tisch.status !== 'open' && <div className="mm-funk">Verbindung…</div>}

      {sicht.fertig && (
        <div className="mm-ende">
          <div className="mm-ende-blatt">
            {/*
              * Zu zweit gibt es Sieg, Niederlage und Unentschieden. Ab drei
              * Spielern ist "Verloren" fuer den Zweiten von vier schlicht
              * falsch — dort steht der Platz.
              */}
            <h2>{abschlussTitel}</h2>
            {/* Der eigene Stand zuerst, dann die anderen in Sitzreihenfolge —
                dieselbe Drehung wie bei den Ecken. "7 : 5" liest sich
                anders als "5 : 7", und gemeint ist immer das eigene zuerst. */}
            <p className="mm-ende-stand">
              {standReihe.map((sitz, i) => (
                <Fragment key={sitz}>
                  {i > 0 && <span>:</span>}
                  <b data-farbe={farbeVon(sitz)}>{sicht.punkte[sitz] ?? 0}</b>
                </Fragment>
              ))}
            </p>
            <button
              className="mm-suchen"
              type="button"
              onClick={() => {
                siegGespielt.current = false;
                vorigeOffen.current = [];
                vorigePause.current = null;
                setGetippt(null);
                setFlieger([]);
                setTischId(null);
                setSucht(false);
              }}
            >
              <span>Noch eine Runde</span>
            </button>
            <button className="mm-zweitknopf" type="button" onClick={verlasseUndZurueck}>
              Zurück zur Spielauswahl
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
