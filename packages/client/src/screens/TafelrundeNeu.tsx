/**
 * TafelrundeNeu — die neue Oberflaeche des Auto-Battlers, hinter dem
 * Schalter `?tafelrunde=neu` (src/tafelrundeNeu.ts). Bis zu Robins Abnahme
 * bleibt screens/Tafelrunde.tsx der Standard (docs/TAFELRUNDE-NEU-
 * UMSETZUNG.md, Abschnitt 7).
 *
 * DIESE DATEI IST DIE HUELLE: Tisch halten (`useTable`), Lobby
 * (`useLobby`), das einmalige Wissen der ersten Sicht festhalten, Bilder
 * nachladen. Gezeichnet wird in den Bausteinen unter
 * minispiele/tafelrunde/neu/ — dort steht auch jeweils, warum.
 *
 * DER BILDSCHIRM BILDET KEINE REGEL NACH, genau wie der alte: Kaufen,
 * Wuerfeln, Rang und Verkaufen kommen aus `legalActions`, Mana, Faehigkeiten,
 * Markeneffekte und ihre Saetze aus der Sicht. Fehlt dort etwas, ist die
 * Antwort ein neues Feld in der Sicht, keine Rechnung hier (CLAUDE.md).
 */

import { useEffect, useMemo, useState } from 'react';

import {
  feldBild,
  kartenRahmen,
  schauplatzFuerRunde,
  zeichenBild,
} from '../figuren3d/grafik-neu';
import type { Einheit, Faehigkeit, Stufenwerte, TafelrundeSicht } from '../minispiele/tafelrunde/sicht';
import type { Synergie } from '../minispiele/tafelrunde/Synergien';
import type { BotLevel } from '../protocol';
import { BeitretenSeite, EinstiegSeite, ErstellenSeite } from '../minispiele/tafelrunde/neu/Einstieg';
import { ROLLEN, figurBlatt } from '../minispiele/tafelrunde/neu/grafik';
import { Ladebild } from '../minispiele/tafelrunde/neu/Ladebild';
import { useNachladen } from '../minispiele/tafelrunde/neu/nachladen';
import { KEIN_REGELWISSEN } from '../minispiele/tafelrunde/neu/Regelblatt';
import { type Aktion, Spieltisch, type Tischwissen } from '../minispiele/tafelrunde/neu/Spieltisch';
import { SucheSeite } from '../minispiele/tafelrunde/neu/Suche';
import { SITZ_WAHL, botStufen, useLobby } from '../minispiele/tafelrunde/neu/useLobby';
import { WartesaalSeite } from '../minispiele/tafelrunde/neu/Wartesaal';
import { useTable } from '../useTable';

/**
 * Welche Bilder diese Sicht braucht — nur, was gerade zu sehen ist
 * (Umsetzungsplan, Abschnitt 4): die Figuren in Laden, Bank, Brett und Kampf,
 * der Schauplatz dieser und der naechsten Runde, Rahmen und Zeichen.
 *
 * Was `grafik-neu.ts` noch nicht kennt, liefert dort null und faellt hier
 * heraus; fuer die Figuren tritt dann das alte Rollenblatt ein, und das wird
 * geholt.
 */
export function benoetigteBilder(
  sicht: TafelrundeSicht,
  katalog: Record<string, Einheit>,
  synergieTabelle: readonly Synergie[],
): string[] {
  const ids = new Set<string>();
  const e = sicht.eigenes;
  if (e) {
    for (const id of e.laden) if (id) ids.add(id);
    for (const k of [...e.bank, ...e.brett]) if (k) ids.add(k.id);
  }
  for (const g of sicht.gegner) for (const k of g.brett) if (k) ids.add(k.id);
  for (const kampf of sicht.kaempfe ?? []) for (const s of kampf.bericht.start) ids.add(s.einheitId);
  const pfade: (string | null)[] = [];
  for (const id of ids) {
    const einheit = katalog[id];
    if (einheit) pfade.push(figurBlatt(einheit));
  }
  pfade.push(feldBild(schauplatzFuerRunde(sicht.runde)));
  // Die naechste Runde schon mitnehmen: Der Schauplatz wechselt, und ein
  // Kampf-Ende ist kein guter Moment fuer ein Ladebild.
  pfade.push(feldBild(schauplatzFuerRunde(sicht.runde + 1)));
  for (const kosten of [1, 2, 3]) pfade.push(kartenRahmen(kosten));
  for (const rolle of ROLLEN) pfade.push(zeichenBild(`rolle-${rolle}`));
  for (const s of synergieTabelle) pfade.push(zeichenBild(`marke-${s.marke}`));
  for (const name of ['stern', 'gold', 'leben']) pfade.push(zeichenBild(name));
  return pfade.filter((p): p is string => p !== null);
}

export function TafelrundeNeu({
  startTisch,
  onBack,
}: {
  startTisch?: string | null;
  onBack: () => void;
}): React.JSX.Element {
  // Erst der Tisch, dann die Lobby: Die Lobby muss wissen, ob schon eine
  // Sicht da ist (sie zaehlt die Mitspieler nur davor). `useTable` haengt an
  // der Kennung, die die Lobby haelt — deshalb der Umweg ueber einen Zustand.
  const [sichtDa, setSichtDa] = useState(false);
  const lobby = useLobby(startTisch ?? null, sichtDa);
  const tisch = useTable<TafelrundeSicht>(lobby.tischId, 'tafelrunde');
  const sicht = tisch.view?.view ?? null;
  useEffect(() => {
    setSichtDa(sicht !== null);
  }, [sicht !== null]);

  /*
   * Das einmalige Wissen: Katalog, Synergietabelle, Stufenwerte, Faehigkeiten
   * kommen NUR in der ersten Sicht (`seit === 0`). Jeder Effekt haengt an
   * seinem Feld — es ist danach `undefined`, und der Effekt laeuft nicht mehr.
   */
  const [katalog, setKatalog] = useState<Record<string, Einheit>>({});
  useEffect(() => {
    if (sicht?.katalog) setKatalog(Object.fromEntries(sicht.katalog.map((e) => [e.id, e])));
  }, [sicht?.katalog]);
  const [synergieTabelle, setSynergieTabelle] = useState<Synergie[]>([]);
  useEffect(() => {
    if (sicht?.synergieTabelle) setSynergieTabelle(sicht.synergieTabelle);
  }, [sicht?.synergieTabelle]);
  const [stufenwerte, setStufenwerte] = useState<Record<string, Stufenwerte[]>>({});
  useEffect(() => {
    if (sicht?.stufenwerte) setStufenwerte(sicht.stufenwerte);
  }, [sicht?.stufenwerte]);
  const [faehigkeiten, setFaehigkeiten] = useState<Record<string, Faehigkeit | null>>({});
  useEffect(() => {
    if (sicht?.faehigkeiten) setFaehigkeiten(sicht.faehigkeiten);
  }, [sicht?.faehigkeiten]);
  const wissen: Tischwissen = useMemo(
    () => ({ katalog, synergieTabelle, stufenwerte, faehigkeiten }),
    [katalog, synergieTabelle, stufenwerte, faehigkeiten],
  );

  /* Bilder nach Bedarf. Das Ladebild steht nur VOR der ersten Ruestphase;
     danach laedt alles still im Hintergrund weiter. */
  const pfade = sicht ? benoetigteBilder(sicht, katalog, synergieTabelle) : [];
  const geladen = useNachladen(pfade);
  const [erstesBild, setErstesBild] = useState(false);
  const bereitZumZeigen = sicht !== null && Object.keys(katalog).length > 0 && geladen.fertig;
  useEffect(() => {
    if (bereitZumZeigen) setErstesBild(true);
  }, [bereitZumZeigen]);

  const verlasseUndZurueck = (): void => {
    if (lobby.tischId) lobby.brichAb();
    onBack();
  };

  // --- Vor dem Tisch -------------------------------------------------------

  if (!lobby.tischId && lobby.suchstand) {
    return (
      <SucheSeite
        sekunden={Math.ceil(lobby.suchstand.restMs / 1000)}
        wartende={lobby.suchstand.wartende ?? []}
        suchende={lobby.suchstand.suchende}
        onAbbrechen={lobby.brichSucheAb}
      />
    );
  }
  if (!lobby.tischId && lobby.menue === 'erstellen') {
    const f = lobby.formular;
    return (
      <ErstellenSeite
        sitzWahl={SITZ_WAHL}
        sitze={f.sitze}
        oeffentlich={f.oeffentlich}
        botsFuellen={f.botsFuellen}
        botStufe={f.botStufe}
        botStufen={botStufen()}
        startet={lobby.startet}
        fehler={lobby.fehler}
        onSitze={f.setSitze}
        onOeffentlich={f.setOeffentlich}
        onBotsFuellen={f.setBotsFuellen}
        onBotStufe={f.setBotStufe}
        onErstellen={() => void lobby.erstelleTisch()}
        onZurueck={() => lobby.setMenue('start')}
      />
    );
  }
  if (!lobby.tischId && lobby.menue === 'beitreten') {
    const b = lobby.beitreten;
    return (
      <BeitretenSeite
        code={b.code}
        codeFertig={b.codeFertig}
        vorschau={b.vorschau}
        offeneTische={b.offeneTische}
        startet={lobby.startet}
        fehler={lobby.fehler}
        onCode={b.setCode}
        onPerCode={() => void lobby.treteBeiPerCode()}
        onTisch={(id) => void lobby.treteBeiTisch(id)}
        onZurueck={() => lobby.setMenue('start')}
      />
    );
  }
  if (!lobby.tischId) {
    return (
      <EinstiegSeite
        aktiv={lobby.aktiv}
        startet={lobby.startet}
        fehler={lobby.fehler}
        regelwissen={Object.keys(katalog).length > 0 ? { katalog, faehigkeiten, synergieTabelle } : KEIN_REGELWISSEN}
        onBack={onBack}
        onSuche={() => void lobby.starteSuche()}
        onErstellen={() => lobby.setMenue('erstellen')}
        onBeitreten={() => lobby.setMenue('beitreten')}
        onBots={() => void lobby.starteBots()}
      />
    );
  }

  // --- Der Tisch steht, die Partie laeuft an -------------------------------

  if (!sicht && lobby.wartesaal) {
    const saal = lobby.wartesaal;
    return (
      <WartesaalSeite
        tischId={lobby.tischId}
        wartesaal={saal}
        sitze={tisch.table?.seats ?? []}
        botStufe={tisch.table?.botLevel ?? lobby.formular.botStufe}
        botStufen={botStufen()}
        onBotStufe={(stufe: BotLevel) => {
          lobby.formular.setBotStufe(stufe);
          tisch.setBotLevel(stufe);
        }}
        onBotsFuellen={(an) => lobby.setWartesaal({ ...saal, botsFuellen: an })}
        onStart={() => {
          // Dieselben Zurufe wie im alten Wartesaal: freie Plaetze mit Bots
          // besetzen (dann startet der Server von selbst), sonst sofort.
          if (saal.botsFuellen) {
            for (const platz of tisch.table?.seats ?? []) {
              if (!platz.accountId && !platz.isBot) tisch.addBot(platz.seat);
            }
          } else {
            tisch.startNow();
          }
        }}
        onAbbrechen={lobby.brichAb}
      />
    );
  }

  if (!sicht) {
    // Der Tisch der Schnellsuche oder der Bot-Tisch baut sich auf: nichts zu
    // bedienen, nur warten — mit dem Ladebild statt einer leeren Seite.
    return <Ladebild onAbbrechen={lobby.brichAb} />;
  }

  if (!erstesBild) {
    return <Ladebild erledigt={geladen.erledigt} gesamt={geladen.gesamt} onAbbrechen={lobby.brichAb} />;
  }

  return (
    <Spieltisch
      sicht={sicht}
      wissen={wissen}
      /* `legalActions` ist im Protokoll als Kartenspiel-Aktion typisiert;
         dieses Modul schickt seine eigene Form, der Server reicht sie
         unveraendert durch (siehe alter Bildschirm). */
      legaleZuege={(tisch.view?.legalActions ?? []) as unknown as Aktion[]}
      revision={tisch.view?.revision ?? -1}
      frist={tisch.view?.interludeDeadline ?? null}
      rundenfrist={tisch.view?.phaseDeadline ?? null}
      sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
      trophaeen={tisch.party?.trophies}
      onAktion={(aktion) => tisch.send(aktion)}
      onZurueck={verlasseUndZurueck}
      onNochmal={lobby.nochmal}
    />
  );
}

