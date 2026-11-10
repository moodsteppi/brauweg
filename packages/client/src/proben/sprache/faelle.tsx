/**
 * Die Fälle des Sprach-Schaukastens (BroCooked und Browort) — erfundene
 * Daten, echte Bildschirme.
 *
 * Eine eigene Datei, damit zwei Leser dieselben Fälle sehen: die Seite
 * `sprachprobe-schaukasten.html` (Schaukasten.tsx) und die Sprachproben
 * `BroCooked.sprache.test.tsx` und `Browort.sprache.test.tsx`. Die Probe
 * prüft genau das, was ein Mensch im Schaukasten ansieht.
 *
 * **Hier stehen keine Oberflächentexte.** Alles Sichtbare kommt aus den
 * Bildschirmen; erfunden sind nur Daten (Namen, Wörter, Zahlen). Eine
 * Meldung, die im Betrieb aus einem Fehlerschlüssel entsteht, kommt auch hier
 * über `t()` — sonst stünde im englischen Bild ein deutscher Satz, den der
 * Schaukasten selbst hineingeschrieben hat. Deshalb sitzt der Bot der Gruppe
 * ohne Namen am Tisch: Den Namen „Hilfskoch" setzt der Bildschirm.
 *
 * Die `was`-Zeilen sind Notizen für den Entwickler über dem Rahmen, keine
 * Oberfläche.
 */

import { useState } from 'react';

import { BrowortBild } from '../../browort/Browort';
import { BrowortImProfil } from '../../browort/BrowortImProfil';
import { BrowortKarte } from '../../browort/BrowortKarte';
import { ClanwortBild } from '../../browort/Clanwort';
import type { BrowortAnsicht, ClanwortAnsicht, Versuch, WortSerie } from '../../browort/sicht';
import type { WortEingabe } from '../../browort/Spielfeld';
import { t } from '../../i18n';
import { BroCookedBanner } from '../../minispiele/brocooked/Banner';
import { Gleichschritt, type Lauf } from '../../minispiele/brocooked/gleichschritt';
import { KUECHEN } from '../../minispiele/brocooked/kuechen';
import { Rezeptkarte } from '../../minispiele/brocooked/Rezeptzeile';
import { kuechenName } from '../../minispiele/brocooked/text';
import {
  BroCookedFeierabend,
  BroCookedGruppe,
  BroCookedKueche,
  BroCookedMenue,
} from '../../screens/BroCooked';
import type { SeatInfo } from '../../protocol';
import { SpielAbschnitt } from '../../screens/SpielEinstieg';

const nichts = (): void => undefined;

/* --------------------------------------------------------------------------
 * BroCooked: erfundene Daten
 * ----------------------------------------------------------------------- */

const STERNE: Record<string, number> = { wiese: 3, kantine: 2, insel: 1 };

/**
 * Eine Küche mitten in der Schicht: zwei Hilfsköche haben eine Weile
 * gearbeitet, damit Tickets hängen und Teller auf der Theke stehen. Feste
 * Saat, damit das Vorher- und das Nachher-Bild dieselbe Küche zeigen.
 */
function laufMitten(takte: number): Lauf {
  const motor = new Gleichschritt({
    saat: 20260923,
    sitze: 2,
    runden: 3,
    kuechen: KUECHEN.map((k) => k.id),
    rundeTakte: 2400,
    botSitze: [0, 1],
    vorlauf: 0,
  });
  // `rechneBis` holt je Aufruf nur ein Häppchen nach — so lange rufen, bis er da ist.
  for (let i = 0; i < 20 && motor.stand().takt < takte; i += 1) motor.rechneBis(takte);
  return motor.stand();
}

function Kueche({ stand, rezepte = false }: { stand: Lauf; rezepte?: boolean }): React.JSX.Element {
  // Ein eigenes Array je Küche, und zwar EINMAL: `eigeneSitze` steht in den
  // Abhängigkeiten der Tastatur-Effekte.
  const [sitze] = useState<readonly number[]>([0]);
  return (
    <BroCookedKueche
      onVerlassen={nichts}
      lies={() => stand}
      takte={nichts}
      sende={nichts}
      eigeneSitze={sitze}
      eigenerSitz={0}
      onEnde={nichts}
      rezepteAnfangs={rezepte}
    />
  );
}

function Menue({ laedt = false, rezepte = false }: { laedt?: boolean; rezepte?: boolean }): React.JSX.Element {
  const [runden, setRunden] = useState(2);
  const [rezepteOffen, setRezepteOffen] = useState(rezepte);
  return (
    <BroCookedMenue
      sterne={STERNE}
      runden={runden}
      onRunden={setRunden}
      laedt={laedt}
      fehler={null}
      rezepteOffen={rezepteOffen}
      onRezepteOffen={setRezepteOffen}
      onAllein={nichts}
      onZuZweit={nichts}
      onTisch={nichts}
      onBack={nichts}
    />
  );
}

function sitz(seat: number, displayName: string | null, isBot = false): SeatInfo {
  return { seat, displayName, accountId: null, isBot, avatarUrl: null } as SeatInfo;
}

const GRUPPE: SeatInfo[] = [sitz(0, 'Robin'), sitz(1, 'Emile'), sitz(2, null, true), sitz(3, null)];

function feierabend(sterne: number[], punkte: number): Lauf {
  return { ...laufMitten(0), sterne, punkte, fertig: true, pause: false };
}

/* --------------------------------------------------------------------------
 * Browort: erfundene Daten (deutsche Wörter — das Spiel bleibt deutsch)
 * ----------------------------------------------------------------------- */

const SERIE: WortSerie = { serie: 12, beste: 31, heuteGespielt: false, brauchtSchutz: false, schutzFrei: true };

const V_LAUFEND: Versuch[] = [
  { wort: 'STEIN', farben: ['x', 'v', 'x', 'x', 'g'] },
  { wort: 'LAMPE', farben: ['x', 'g', 'x', 'x', 'v'] },
];
const V_GELOEST: Versuch[] = [
  ...V_LAUFEND,
  { wort: 'BAUEN', farben: ['x', 'g', 'v', 'g', 'g'] },
  { wort: 'HAFEN', farben: ['g', 'g', 'g', 'g', 'g'] },
];
const V_VERLOREN: Versuch[] = [
  ...V_LAUFEND,
  { wort: 'BAUEN', farben: ['x', 'g', 'v', 'g', 'g'] },
  { wort: 'RADEN', farben: ['x', 'g', 'x', 'g', 'g'] },
  { wort: 'WAGEN', farben: ['x', 'g', 'x', 'g', 'g'] },
  { wort: 'SAGEN', farben: ['x', 'g', 'x', 'g', 'g'] },
];

const STATISTIK = { gespielt: 47, geloest: 43, schnitt: 3.8, verteilung: [1, 5, 12, 14, 8, 3] };

function browort(versuche: Versuch[], fertig: boolean, geloest: boolean): BrowortAnsicht {
  return {
    tag: '2026-11-06',
    versuche,
    maxVersuche: 6,
    fertig,
    geloest,
    loesung: fertig ? 'HAFEN' : null,
    serie: { ...SERIE, heuteGespielt: fertig, serie: fertig && !geloest ? 0 : SERIE.serie },
    statistik: STATISTIK,
  };
}

function eingabe(text: string, meldung: string | null = null): WortEingabe {
  return { eingabe: text, wackelt: false, meldung, aufdecken: null, laeuft: false, taste: nichts };
}

const RANGLISTE: ClanwortAnsicht['rangliste'] = [
  { accountId: 'a', name: 'Emile', versuche: 3, geloest: true, fertig: true },
  { accountId: 'b', name: 'Robin', versuche: 4, geloest: true, fertig: true },
  { accountId: 'c', name: 'Steppi', versuche: 1, geloest: false, fertig: false },
  { accountId: 'd', name: 'Kalle', versuche: 6, geloest: false, fertig: true },
];

function clanwort(teil: Partial<ClanwortAnsicht>): ClanwortAnsicht {
  return {
    tag: '2026-11-06',
    versuche: [],
    maxVersuche: 6,
    fertig: false,
    geloest: false,
    loesung: null,
    clubId: 'club-1',
    phase: 'raten',
    waehler: { id: 'w', name: 'Emile' },
    wahlBis: 12,
    zufall: false,
    rangliste: RANGLISTE,
    serie: { ...SERIE, serie: 5 },
    ...teil,
  };
}

/* --------------------------------------------------------------------------
 * Die Fälle
 * ----------------------------------------------------------------------- */

export interface Fall {
  name: string;
  /** Was man sieht — steht nur in der Gesamtansicht über dem Rahmen. */
  was: string;
  /** Höhe des Rahmens; Vollbilder bekommen Handyhöhe. */
  hoehe?: number;
  zeige: () => React.ReactNode;
}

function BrowortHub({ children }: { children: React.ReactNode }): React.JSX.Element {
  // `.hb` ist die Wurzel des Hubs: Farben, Schriften, Knöpfe gelten nur darin.
  return (
    <div className="hb">
      <div className="sk-spalte">{children}</div>
    </div>
  );
}

export const FAELLE: Fall[] = [
  /* --- BroCooked ---------------------------------------------------- */
  { name: 'brocooked-menue', was: 'Einstieg: Menü mit Runden, Küchen, Sternen', zeige: () => <Menue /> },
  { name: 'brocooked-menue-sucht', was: 'Einstieg: Tisch wird gesucht', zeige: () => <Menue laedt /> },
  { name: 'brocooked-rezepte', was: 'Einstieg: Rezeptblatt offen', zeige: () => <Menue rezepte /> },
  {
    name: 'brocooked-gruppe',
    was: 'Lobby: Küche füllt sich (2 Menschen, 1 Hilfskoch, 1 frei)',
    zeige: () => <BroCookedGruppe plaetze={GRUPPE} fehler={null} onStart={nichts} onHilfskoch={nichts} onVerlassen={nichts} />,
  },
  {
    name: 'brocooked-kueche',
    was: 'Küche: Kopfzeile mit Tickets, Zeit, Punkten; Steuerung',
    zeige: () => <Kueche stand={laufMitten(700)} />,
  },
  {
    name: 'brocooked-kueche-pause',
    was: 'Küche: Runde 2 · Pause, Kombo',
    zeige: () => {
      const l = laufMitten(700);
      return <Kueche stand={{ ...l, runde: 1, pause: true, kueche: { ...l.kueche, kombo: 5 } }} />;
    },
  },
  {
    name: 'brocooked-kueche-rezepte',
    was: 'Küche: Rezepttafel offen',
    zeige: () => <Kueche stand={laufMitten(700)} rezepte />,
  },
  {
    name: 'brocooked-rezeptzeile',
    was: 'Rezeptkarten aller Küchen (Name, Kette, Garstation)',
    zeige: () => (
      <div className="spe">
        <div className="sk-spalte">
          {KUECHEN.map((k) => (
            <SpielAbschnitt key={k.id} titel={kuechenName(k.id)}>
              <ul className="bc-rezepte">
                {k.rezepte.map((id) => (
                  <Rezeptkarte key={id} rezeptId={id} />
                ))}
              </ul>
            </SpielAbschnitt>
          ))}
        </div>
      </div>
    ),
  },
  {
    name: 'brocooked-feierabend',
    was: 'Ergebnis am Gerät: 3 Runden, Noch einmal',
    zeige: () => <BroCookedFeierabend abschluss={feierabend([3, 2, 1], 412)} nochmal={nichts} onVerlassen={nichts} />,
  },
  {
    name: 'brocooked-feierabend-tisch',
    was: 'Ergebnis am Tisch: 1 Runde (Einzahl)',
    zeige: () => <BroCookedFeierabend abschluss={feierabend([2], 138)} nochmal={null} onVerlassen={nichts} />,
  },
  {
    name: 'brocooked-banner',
    was: 'Banner der Spielauswahl (Leinwand, ohne Text)',
    hoehe: 120,
    zeige: () => <BroCookedBanner />,
  },

  /* --- Browort ------------------------------------------------------ */
  {
    name: 'browort-laedt',
    was: 'Browort: lädt',
    zeige: () => (
      <BrowortHub>
        <BrowortBild runde={null} fehler={null} belohnung={null} geschuetzt={false} spiel={eingabe('')} onClose={nichts} onNochmal={nichts} />
      </BrowortHub>
    ),
  },
  {
    name: 'browort-laufend',
    was: 'Browort: Tagesrunde läuft (2 Versuche, Eingabe)',
    zeige: () => (
      <BrowortHub>
        <BrowortBild runde={browort(V_LAUFEND, false, false)} fehler={null} belohnung={null} geschuetzt={false} spiel={eingabe('HA')} onClose={nichts} onNochmal={nichts} />
      </BrowortHub>
    ),
  },
  {
    name: 'browort-meldung',
    was: 'Browort: Wort unbekannt (Meldung aus dem Fehlerschlüssel)',
    zeige: () => (
      <BrowortHub>
        <BrowortBild
          runde={browort(V_LAUFEND, false, false)}
          fehler={null}
          belohnung={null}
          geschuetzt={false}
          spiel={eingabe('QXZPT', t('error.browortUnbekannt'))}
          onClose={nichts}
          onNochmal={nichts}
        />
      </BrowortHub>
    ),
  },
  {
    name: 'browort-geloest',
    was: 'Browort: gelöst in 4, Belohnung, Statistik',
    zeige: () => (
      <BrowortHub>
        <BrowortBild runde={browort(V_GELOEST, true, true)} fehler={null} belohnung={{ muenzen: 30, xp: 20 }} geschuetzt={false} spiel={eingabe('')} onClose={nichts} onNochmal={nichts} />
      </BrowortHub>
    ),
  },
  {
    name: 'browort-erster',
    was: 'Browort: im ersten Versuch, Wochenschutz',
    zeige: () => (
      <BrowortHub>
        <BrowortBild
          runde={browort([{ wort: 'HAFEN', farben: ['g', 'g', 'g', 'g', 'g'] }], true, true)}
          fehler={null}
          belohnung={{ muenzen: 50, xp: 30 }}
          geschuetzt
          spiel={eingabe('')}
          onClose={nichts}
          onNochmal={nichts}
        />
      </BrowortHub>
    ),
  },
  {
    name: 'browort-verloren',
    was: 'Browort: heute nicht geschafft, Statistik',
    zeige: () => (
      <BrowortHub>
        <BrowortBild runde={browort(V_VERLOREN, true, false)} fehler={null} belohnung={null} geschuetzt={false} spiel={eingabe('')} onClose={nichts} onNochmal={nichts} />
      </BrowortHub>
    ),
  },

  /* --- Clanwort ----------------------------------------------------- */
  ...(
    [
      ['clanwort-waehlen', 'Clanwort: selbst ausgelost, Wort wählen', clanwort({ phase: 'waehlen', waehler: { id: 'ich', name: 'Robin' }, rangliste: [] }), eingabe('BRO')],
      ['clanwort-warten', 'Clanwort: wartet auf die Wahl', clanwort({ phase: 'warten', rangliste: [] }), eingabe('')],
      ['clanwort-zufall', 'Clanwort: vom Zufall gewählt, raten läuft', clanwort({ phase: 'raten', waehler: null, zufall: true, versuche: V_LAUFEND }), eingabe('')],
      ['clanwort-raten', 'Clanwort: raten läuft, Rangliste', clanwort({ phase: 'raten', versuche: V_LAUFEND }), eingabe('HAF')],
      ['clanwort-geloest', 'Clanwort: gelöst, Belohnung, Rangliste', clanwort({ phase: 'raten', versuche: V_GELOEST, fertig: true, geloest: true, loesung: 'HAFEN' }), eingabe('')],
      ['clanwort-verloren', 'Clanwort: nicht geschafft', clanwort({ phase: 'raten', versuche: V_VERLOREN, fertig: true, loesung: 'HAFEN' }), eingabe('')],
      ['clanwort-wortgeber', 'Clanwort: als Wortgeber zuschauen', clanwort({ phase: 'wortgeber', waehler: { id: 'ich', name: 'Robin' }, loesung: 'HAFEN' }), eingabe('')],
      ['clanwort-wortgeber-leer', 'Clanwort: Wortgeber, noch niemand geraten', clanwort({ phase: 'wortgeber', waehler: { id: 'ich', name: 'Robin' }, loesung: 'HAFEN', rangliste: [] }), eingabe('')],
      ['clanwort-ohne-clan', 'Clanwort: ohne Clan', null, eingabe('')],
      ['clanwort-laedt', 'Clanwort: lädt', undefined, eingabe('')],
    ] as const
  ).map(
    ([name, was, stand, spiel]): Fall => ({
      name,
      was,
      zeige: () => (
        <BrowortHub>
          <ClanwortBild
            stand={stand}
            fehler={null}
            belohnung={name === 'clanwort-geloest' ? { muenzen: 40, xp: 25 } : null}
            spiel={spiel}
            rueckfrage={null}
            onClose={nichts}
            onNochmal={nichts}
          />
        </BrowortHub>
      ),
    }),
  ),

  /* --- Startkarte und Profil ---------------------------------------- */
  {
    name: 'browort-karte',
    was: 'Startkarte: neu · Serie offen · heute gespielt · 1 Tag',
    hoehe: 540,
    zeige: () => (
      <BrowortHub>
        {/* `.hb-start` wie in StartNeu: Erst darin wird die Karte zur Karte. */}
        <div className="hb-start" style={{ display: 'grid', gap: 12 }}>
        <BrowortKarte stand={undefined} onOeffnen={nichts} />
        <BrowortKarte stand={{ serie: 12, heuteGespielt: false, schnitt: 3.8, geloest: 43 }} onOeffnen={nichts} />
        <BrowortKarte stand={{ serie: 12, heuteGespielt: true, schnitt: 3.8, geloest: 43 }} onOeffnen={nichts} />
        <BrowortKarte stand={{ serie: 1, heuteGespielt: true, schnitt: 4, geloest: 1 }} onOeffnen={nichts} />
        </div>
      </BrowortHub>
    ),
  },
  {
    name: 'browort-profil',
    was: 'Profil: eigenes ohne Spiel · eigenes · fremdes mit bester Serie',
    hoehe: 560,
    zeige: () => (
      <BrowortHub>
        <BrowortImProfil du serie={0} schnitt={null} geloest={0} />
        <BrowortImProfil du serie={12} schnitt={3.8} geloest={43} />
        <BrowortImProfil du={false} serie={4} schnitt={4.2} geloest={19} beste={21} />
      </BrowortHub>
    ),
  },
];
