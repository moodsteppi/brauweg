import { api, SLOTS, type Kauftruhe, type Slot, type WegGrad, type WegStufe } from '../../api';
import { GameSelect, type Tab } from '../../screens/GameSelect';
import { probeKonto } from '../../screens/probe-konto';

/**
 * Probe: das neue Hub mit dem Beispielkonto aus dem Entwurf (Fassung 4).
 *
 * Nur im Dev-Server (`/?dev=hub`). Der Zweck ist der Vergleich mit dem
 * Bauplan: dieselben Zahlen wie im Entwurf, damit man Seite und Bild
 * nebeneinanderlegen kann und nur noch die Gestaltung vergleicht. Spiele,
 * Online-Zahl und Rangliste kommen weiter vom (lokalen) Server.
 */
/*
 * Ohne Anmeldung liefert der Server keine Aufgaben und Truhen. Die Probe setzt
 * deshalb Beispieldaten ein — die Aufgaben und Truhen, die es laut Code wirklich
 * gibt (FAKTENBLATT.md), mit dem Stand des Beispielkontos (Stufe 12).
 */
const AUFGABE = (id: string, ziel: number, fortschritt: number, betrag: number, abgeholt = false) => ({
  id,
  nameKey: `quest.${id}`,
  hinweisKey: `quest.${id}.hint`,
  ziel,
  fortschritt,
  fertig: fortschritt >= ziel,
  abgeholt,
  belohnung: { waehrung: 'coins' as const, betrag },
});
api.quests = async () => ({
  tag: '2026-09-26',
  offeneBelohnung: 10,
  aufgaben: [
    AUFGABE('partie-spielen', 1, 1, 5),
    AUFGABE('drei-partien', 3, 2, 15),
    AUFGABE('partie-gewinnen', 1, 0, 10),
    AUFGABE('doppelkopf-am-tag', 1, 1, 5),
    AUFGABE('zauberer-am-tag', 1, 0, 5),
    AUFGABE('karten-legen', 60, 42, 10),
    AUFGABE('pro-subway-laufen', 1, 1, 5, true),
    AUFGABE('pro-subway-muenzen', 15, 6, 10),
  ],
});
const TRUHE = (id: string, art: 'tag' | 'stufe', grad: 'holz' | 'bronze' | 'silber' | 'gold' | 'diamant', von: number, bis: number, abStufe: number | null, zustand: 'offen' | 'geholt' | 'zu') => ({
  id,
  art,
  grad,
  von,
  bis,
  offen: zustand !== 'zu',
  geholt: zustand === 'geholt',
  coins: zustand === 'geholt' ? Math.round((von + bis) / 2) : null,
  abStufe,
  fehltStufen: zustand === 'zu' && abStufe !== null ? abStufe - 12 : null,
});
api.chests = async () => ({
  tag: TRUHE('tag', 'tag', 'holz', 1, 3, null, 'offen'),
  stufen: [
    TRUHE('s12', 'stufe', 'silber', 10, 20, 12, 'geholt'),
    TRUHE('s16', 'stufe', 'silber', 10, 20, 16, 'zu'),
    TRUHE('s20', 'stufe', 'gold', 25, 45, 20, 'zu'),
  ],
});

/*
 * Trophäenweg für die Probe: Stand 773 (die Summe der Beispielstatistik
 * unten), Stufen und Belohnungen wie im Katalog des Servers
 * (server/src/trophaeenweg-katalog.ts). Bis 500 ist alles geholt; 600, 700
 * und Schneefeld (750) warten, damit „Holen" an Checkpoint und Station zu
 * sehen ist. Holen verändert nur diese Liste — ohne Anmeldung gibt es am
 * Server nichts zu holen.
 */
const WEG_SPANNE = { bronze: [4, 8], silber: [10, 20], gold: [25, 45], diamant: [60, 100] } as const;
const WEG_STUFE = (
  schwelle: number,
  art: WegStufe['art'],
  grad: WegGrad | null,
  gegenstand: string | null,
  geholt: boolean,
): WegStufe => ({
  schwelle,
  art,
  truhe: grad ? { grad, von: WEG_SPANNE[grad][0], bis: WEG_SPANNE[grad][1] } : null,
  muenzen: grad ? null : 25,
  gegenstand,
  erreicht: schwelle <= 773,
  geholt,
  coins: geholt ? (grad ? WEG_SPANNE[grad][0] + 2 : 25) : null,
});
const probeWeg: WegStufe[] = [
  WEG_STUFE(100, 'station', 'bronze', 'hut-strohhut', true),
  WEG_STUFE(200, 'checkpoint', null, null, true),
  WEG_STUFE(250, 'station', 'silber', 'ruecken-sommerwiese', true),
  WEG_STUFE(300, 'checkpoint', null, null, true),
  WEG_STUFE(400, 'checkpoint', null, null, true),
  WEG_STUFE(500, 'station', 'gold', 'szene-kaminzimmer', true),
  WEG_STUFE(600, 'checkpoint', null, null, false),
  WEG_STUFE(700, 'checkpoint', null, null, false),
  WEG_STUFE(750, 'station', 'gold', 'blatt-winterhof', false),
  WEG_STUFE(800, 'checkpoint', null, null, false),
  WEG_STUFE(900, 'checkpoint', null, null, false),
  WEG_STUFE(1000, 'station', 'diamant', 'aura-sterne', false),
  WEG_STUFE(1250, 'weiter', 'silber', null, false),
];
api.weg = async () => ({
  trophaeen: 773,
  stufen: probeWeg.map((s) => ({ ...s })),
  bereit: probeWeg.filter((s) => s.erreicht && !s.geholt).length,
});
api.wegHolen = async (schwelle) => {
  const stufe = probeWeg.find((s) => s.schwelle === schwelle)!;
  const coins = stufe.truhe ? Math.round((stufe.truhe.von + stufe.truhe.bis) / 2) : (stufe.muenzen ?? 0);
  Object.assign(stufe, { geholt: true, coins });
  return { schwelle, grad: stufe.truhe?.grad ?? null, coins, gegenstand: stufe.gegenstand, gegenstandNeu: true, stand: 2480 + coins };
};

/*
 * Shop-Daten für die Probe: Preise und Namen wie im Code (FAKTENBLATT.md,
 * Abschnitt 6 und 10), Besitz wie beim Beispielkonto.
 */
const BLATT_PREIS: Record<string, number> = {
  text: 0, minimal2: 0, minimal4: 0, klassisch: 0, zauberwald: 0,
  eiche: 600, winterhof: 600, sommerwiese: 600, kupferstich: 800, schiefer: 800,
  nachthimmel: 1000, rubin: 1200, smaragd: 1200, koeniglich: 1600, pinguin: 2000,
};
const EIGENE_BLAETTER = new Set(['text', 'minimal2', 'minimal4', 'klassisch', 'zauberwald', 'nachthimmel']);
const SZENEN_PREIS: [string, number][] = [
  ['stube', 0], ['filz-blau', 0], ['filz-rot', 0], ['filz-grau', 0], ['holz-hell', 0], ['winter', 0], ['sommer', 0],
  ['nacht', 0], ['zauberturm', 0], ['sternenwiese', 0], ['wirtshaus', 250], ['kaminzimmer', 250], ['bibliothek', 350],
  ['berghuette', 350], ['gartenlaube', 350], ['herbst', 450], ['marmor', 600], ['samt-blau', 600], ['kapitaen', 600], ['basar', 900],
];
const TEILE: [Slot, string, number, boolean][] = [
  ['hut', 'hut-wollmuetze', 0, true], ['hut', 'hut-strohhut', 120, false], ['hut', 'hut-zylinder', 250, true], ['hut', 'hut-bergsteiger', 400, false], ['hut', 'hut-krone', 0, false], ['hut', 'hut-partyhut', 0, false],
  ['brille', 'brille-keine', 0, true], ['brille', 'brille-sonnenbrille', 140, true], ['brille', 'brille-lesebrille', 140, false], ['brille', 'brille-taucherbrille', 220, false], ['brille', 'brille-skibrille', 320, false], ['brille', 'brille-monokel', 0, false],
  ['oberteil', 'oberteil-pulli', 0, true], ['oberteil', 'oberteil-trikot', 120, false], ['oberteil', 'oberteil-weste', 200, false], ['oberteil', 'oberteil-regenjacke', 320, false], ['oberteil', 'oberteil-frack', 0, false],
  ['schuhe', 'schuhe-flossen', 0, true], ['schuhe', 'schuhe-gummistiefel', 100, false], ['schuhe', 'schuhe-turnschuhe', 180, false], ['schuhe', 'schuhe-schlittschuhe', 260, false], ['schuhe', 'schuhe-goldstiefel', 0, false],
  ['hand', 'hand-kakao', 0, true], ['hand', 'hand-kartenfaecher', 150, true], ['hand', 'hand-wanderstab', 220, false], ['hand', 'hand-laterne', 300, false], ['hand', 'hand-zauberstab', 0, false],
  ['aura', 'aura-glitzer', 0, true], ['aura', 'aura-blaetter', 200, false], ['aura', 'aura-schneeflocken', 280, false], ['aura', 'aura-funken', 380, false], ['aura', 'aura-sterne', 0, false], ['aura', 'aura-konfetti', 0, false],
];
const preis = (coins: number) => ({ coins, gems: Math.ceil(coins / 15) });
api.shop = async () => ({
  muenzpakete: [{"id":"muenzen-klein","nameKey":"shop.muenzen-klein","gibt":{"waehrung":"coins","betrag":500},"cents":null,"gems":35,"coins":null,"bonus":null,"kaufbar":true},{"id":"muenzen-mittel","nameKey":"shop.muenzen-mittel","gibt":{"waehrung":"coins","betrag":1500},"cents":null,"gems":100,"coins":null,"bonus":5,"kaufbar":true},{"id":"muenzen-gross","nameKey":"shop.muenzen-gross","gibt":{"waehrung":"coins","betrag":4000},"cents":null,"gems":250,"coins":null,"bonus":12,"kaufbar":true}],
  jetonpakete: [{"id":"brojetons-klein","nameKey":"shop.brojetons-klein","gibt":{"waehrung":"broJetons","betrag":500},"cents":null,"gems":null,"coins":40,"bonus":null,"kaufbar":true},{"id":"brojetons-mittel","nameKey":"shop.brojetons-mittel","gibt":{"waehrung":"broJetons","betrag":1500},"cents":null,"gems":null,"coins":100,"bonus":20,"kaufbar":true},{"id":"brojetons-gross","nameKey":"shop.brojetons-gross","gibt":{"waehrung":"broJetons","betrag":5000},"cents":null,"gems":null,"coins":280,"bonus":43,"kaufbar":true}],
  edelsteinpakete: [{"id":"edelsteine-klein","nameKey":"shop.edelsteine-klein","gibt":{"waehrung":"gems","betrag":50},"cents":299,"gems":null,"coins":null,"bonus":null,"kaufbar":false},{"id":"edelsteine-mittel","nameKey":"shop.edelsteine-mittel","gibt":{"waehrung":"gems","betrag":150},"cents":799,"gems":null,"coins":null,"bonus":12,"kaufbar":false},{"id":"edelsteine-gross","nameKey":"shop.edelsteine-gross","gibt":{"waehrung":"gems","betrag":400},"cents":1899,"gems":null,"coins":null,"bonus":26,"kaufbar":false}],
  paesse: [{"id":"vip-pass","nameKey":"shop.vip-pass","gibt":null,"cents":499,"gems":null,"coins":null,"bonus":null,"kaufbar":false},{"id":"season-pass","nameKey":"shop.season-pass","gibt":null,"cents":null,"gems":150,"coins":null,"bonus":null,"kaufbar":false}],
  truhen: [{"id":"truhe-silber","grad":"silber","nameKey":"truhe.silber","gems":25,"von":250,"bis":500},{"id":"truhe-gold","grad":"gold","nameKey":"truhe.gold","gems":60,"von":650,"bis":1150},{"id":"truhe-diamant","grad":"diamant","nameKey":"truhe.diamant","gems":150,"von":1700,"bis":2800}] as Kauftruhe[],
  kurs: 15,
  regale: SLOTS.map((slot) => ({
    slot,
    stuecke: TEILE.filter(([s]) => s === slot).map(([s, id, coins, besessen]) => ({
      id, slot: s, nameKey: `kosmetik.${id}`, seltenheit: 'gewoehnlich' as const, preis: preis(coins), besessen, geschenk: false,
    })),
  })),
  tischware: [
    ...Object.entries(BLATT_PREIS).map(([wert, coins]) => ({
      id: `blatt-${wert}`, art: 'blatt' as const, wert, nameKey: `deck.${wert}`, seltenheit: 'gewoehnlich', preis: preis(coins), besessen: coins === 0 || EIGENE_BLAETTER.has(wert),
    })),
    ...SZENEN_PREIS.map(([wert, coins]) => ({
      id: `szene-${wert}`, art: 'szene' as const, wert, nameKey: `szene.${wert}`, seltenheit: 'gewoehnlich', preis: preis(coins), besessen: coins === 0 || wert === 'wirtshaus',
    })),
    ...([['weihnachten', 600], ['jga', 800]] as const).map(([wert, coins]) => ({
      id: `party-paket-${wert}`, art: 'inhaltspaket' as const, wert, nameKey: `paket.${wert}`, seltenheit: 'selten', preis: preis(coins), besessen: false,
      inhalt: { spiel: 'partykiste', feld: 'paket' },
    })),
  ],
});

/* Clan für die Probe: Name, Wahlspruch und Kriegsstand wie im Entwurf, Regeln wie im Code. */
const MITGLIED = (accountId: string, displayName: string, role: 'admin' | 'vize' | 'elder' | 'member', trophies: number) => ({
  accountId, displayName, role, trophies, since: '2026-08-01', hasAvatar: false,
});
api.club = async () => ({
  id: 'probe-clan',
  name: 'Die Stichhaltigen',
  crest: 'wappen-12',
  motto: 'Wer bedient, gewinnt.',
  joinMode: 'on_request' as const,
  minTrophies: 200,
  members: 18,
  maxMembers: 50,
  trophies: 8420,
  myRole: 'admin' as const,
  memberList: [
    MITGLIED('a1', 'Eisvogel', 'admin', 1840),
    MITGLIED('a2', 'Kiebitz', 'vize', 1612),
    MITGLIED('a3', 'Zaunkönig', 'elder', 1377),
    MITGLIED('a4', 'Rotkehlchen', 'member', 1102),
  ],
  requests: [MITGLIED('r1', 'Stieglitz', 'member', 310), MITGLIED('r2', 'Dohle', 'member', 245)],
  defaultRuleSetId: null,
});
api.clubWar = async () => ({
  aktuell: {
    id: 'krieg',
    status: 'laeuft' as const,
    wir: { clubId: 'probe-clan', name: 'Die Stichhaltigen', crest: 'wappen-12', score: 31 },
    gegner: { clubId: 'gegner', name: 'Die Asse', crest: 'wappen-7', score: 24 },
    wirHabenGefordert: true,
    endsAt: new Date(Date.now() + 31 * 3600000).toISOString(),
    ergebnis: null,
    beitraege: [],
  },
  offeneAnfragen: [],
  letzter: null,
  darfFuehren: true,
});

export function ProbeHub(): React.JSX.Element {
  const me = probeKonto({
    displayName: 'Eisvogel',
    coins: 2480,
    gems: 35,
    avatar: { hut: 'hut-zylinder', brille: 'brille-sonnenbrille', hand: 'hand-kartenfaecher' },
    level: { stufe: 12, xp: 1720, imLevel: 180, fuerLevel: 260 },
    bereit: { truhen: 1, aufgaben: 2, weg: 3 },
    stats: [
      { gameId: 'doppelkopf', trophies: 412, parties: 146, wins: 71 },
      { gameId: 'skat', trophies: 188, parties: 64, wins: 29 },
      { gameId: 'partykiste', trophies: 96, parties: 18, wins: 7 },
      { gameId: 'wizard', trophies: 54, parties: 22, wins: 6 },
      { gameId: 'golf', trophies: 23, parties: 9, wins: 2 },
    ],
    clubs: [{ id: 'probe-clan', name: 'Die Stichhaltigen' }],
    themes: { doppelkopf: { cardDeck: 'klassisch', tableScene: 'stube', cardBack: '' } },
    activeTable: {
      tableId: 'probe-tisch',
      gameId: 'doppelkopf',
      status: 'running',
      paused: false,
      visibility: 'public',
      maxRounds: 8,
      seats: 4,
    },
  });
  const nichts = (): void => undefined;
  const suche = new URLSearchParams(window.location.search);
  const anfangsTab = (suche.get('tab') as Tab | null) ?? undefined;
  const anfangsSpiel = suche.get('spiel') ?? undefined;
  const anfangsWeg = suche.has('weg');
  const anfangsHeute = suche.has('heute');
  // Im Browser gibt es keine Safe Area. Mit ?iphone stellt die Probe die eines
  // iPhone 14 (47 pt oben, 34 pt unten) nach, damit sie zum Bauplan passt.
  if (new URLSearchParams(window.location.search).has('iphone')) {
    document.documentElement.style.setProperty('--hb-probe-oben', '47px');
    document.documentElement.style.setProperty('--hb-probe-unten', '34px');
    // Genau 390 pt breit und links, damit ein Bildschirmfoto 1:1 neben den
    // Bauplan passt — auch wenn das Fenster breiter ist.
    if (!document.getElementById('probe-iphone')) {
      const stil = document.createElement('style');
      stil.id = 'probe-iphone';
      stil.textContent = '.hb{right:auto;width:390px;max-width:390px;margin:0}';
      document.head.appendChild(stil);
    }
  }
  return (
    <GameSelect
      me={me}
      onPick={nichts}
      onSolo={nichts}
      onResume={nichts}
      onThemeChange={nichts}
      onAvatarChange={nichts}
      onShowProfile={nichts}
      onSignOut={nichts}
      onDeleted={nichts}
      anfangsTab={anfangsTab}
      anfangsSpiel={anfangsSpiel}
      anfangsWeg={anfangsWeg}
      anfangsHeute={anfangsHeute}
    />
  );
}
