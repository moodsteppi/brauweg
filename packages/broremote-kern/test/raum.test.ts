import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BroRaum, lesen, aktionLesen, einladungLesen, einladungsLink, lokaleAdresse, EINLADUNG_MS, type Nachricht, type ServerNachricht } from '../src/index.js';

function aufbau() {
  let zeit = 100_000, zaehler = 1;
  const post: { v: string; n: ServerNachricht }[] = [], getrennt: string[] = [];
  const raum = new BroRaum({ raum: 'A12BC345', jetzt: () => zeit,
    zufall: () => (zaehler++).toString(16).padStart(8, '0').padEnd(32, '0'), senden: (v, n) => post.push({ v, n }), trennen: v => getrennt.push(v) });
  const anmelden = (v: string, n: Nachricht): boolean => raum.anmelden(v, { v: 1, ...n });
  const senden = (v: string, n: Nachricht): void => raum.empfangen(v, { v: 1, ...n });
  anmelden('h', { art: 'gastgeber', schluessel: raum.hostSchluessel });
  const host = post.find(p => p.v === 'h' && p.n.art === 'willkommen')!.n as Extract<ServerNachricht, { art: 'willkommen' }>;
  const gast = (v: string) => {
    assert.equal(anmelden(v, { art: 'beitreten', einladung: host.einladung, name: `Spieler ${v}` }), true);
    return post.find(p => p.v === v && p.n.art === 'willkommen')!.n as Extract<ServerNachricht, { art: 'willkommen' }>;
  };
  const start = (...gaeste: string[]) => { gaeste.forEach(v => senden(v, { art: 'bereit', bereit: true })); senden('h', { art: 'starten' }); };
  const eingabe = (v: string, folge = 1, aktion: unknown = { art: 'steuerung', x: 1, y: 0, tasten: ['drehen'] }) => senden(v, { art: 'eingabe', folge, abschnitt: raum.sicht().abschnitt, aktion });
  return { raum, post, getrennt, anmelden, senden, gast, start, eingabe, host, zeit: (n: number) => { zeit += n; } };
}

test('Building Battle startet nur bereit, bindet den Modus und verwirft Eingaben der vorigen Runde', () => {
  const a = aufbau(); a.gast('1'); a.gast('2');
  a.senden('1', { art: 'baumodus', modus: 'standfest' });
  assert.equal(a.raum.sicht().baumodus, 'rennen');
  a.senden('1', { art: 'bereit', bereit: true }); a.senden('2', { art: 'bereit', bereit: true });
  a.senden('h', { art: 'baumodus', modus: 'standfest' });
  a.senden('h', { art: 'spielen' }); assert.equal(a.raum.sicht().phase, 'lobby');
  a.senden('1', { art: 'bereit', bereit: true }); a.senden('2', { art: 'bereit', bereit: true });
  a.senden('h', { art: 'spielen' });
  const alt = a.raum.sicht(); assert.equal(alt.phase, 'spiel'); assert.equal(alt.partie?.modus, 'standfest'); assert.equal(alt.layout, 'bauen');
  a.post.length = 0; a.eingabe('1'); assert.ok(a.post.some(p => p.n.art === 'eingabe' && p.n.aktion.art === 'steuerung'));
  a.senden('h', { art: 'layout', layout: 'auswahl' }); assert.equal(a.raum.sicht().layout, 'bauen');
  a.senden('h', { art: 'lobby' }); assert.equal(a.raum.sicht().partie, undefined);
  a.post.length = 0; a.senden('1', { art: 'eingabe', abschnitt: alt.abschnitt, folge: 2, aktion: { art: 'steuerung', x: 1, y: 0, tasten: [] } });
  assert.equal(a.post.length, 0);
});

test('Bau-Status bleibt privat, ist begrenzt und wird nach Reconnect wiederhergestellt', () => {
  const a = aufbau(), g = a.gast('1'); a.gast('2'); a.start('1', '2');
  const bau = { form: 2, hoehe: 12.4, restzeit: 120, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 48, gebaut: 41, verloren: 44 };
  a.post.length = 0;
  a.senden('h', { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { bau, leben: 3 } });
  assert.equal(a.post.length, 1); assert.equal(a.post[0].v, '1');
  a.post.length = 0; a.anmelden('neu', { art: 'fortsetzen', schluessel: g.schluessel });
  assert.ok(a.post.some(p => p.v === 'neu' && p.n.art === 'privat' && p.n.daten.bau?.hoehe === 12.4));
  assert.ok(a.post.some(p => p.v === 'neu' && p.n.art === 'privat' && p.n.daten.bau?.verbraucht === 48));
  a.post.length = 0;
  a.senden('h', { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { bau: { ...bau, form: 99 } } });
  assert.ok(a.post.every(p => p.n.art !== 'privat'));
  a.senden('h', { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { bau: { ...bau, verbraucht: 301 } } });
  assert.ok(a.post.every(p => p.n.art !== 'privat'));
});

test('vier unabhängige Sitze, Farben und persönliche Schlüssel; fünfter Gast abgewiesen', () => {
  const a = aufbau(); const gaeste = ['1', '2', '3', '4'].map(a.gast);
  assert.equal(new Set(gaeste.map(g => g.spieler)).size, 4);
  assert.equal(new Set(gaeste.map(g => g.schluessel)).size, 4);
  assert.equal(new Set(a.raum.sicht().spieler.map(s => s.farbe)).size, 4);
  assert.equal(a.anmelden('5', { art: 'beitreten', einladung: a.host.einladung, name: 'Noch einer' }), false);
  const sicht = JSON.stringify(a.raum.sicht());
  for (const g of [...gaeste, a.host]) assert.equal(sicht.includes(g.schluessel), false);
});

test('nur Gastgeber sperrt und startet; alle müssen bereit und verbunden sein', () => {
  const a = aufbau(); a.gast('1'); a.gast('2');
  a.senden('1', { art: 'starten' }); assert.equal(a.raum.sicht().phase, 'lobby');
  a.senden('1', { art: 'sperren', gesperrt: true }); assert.equal(a.raum.sicht().gesperrt, false);
  a.start('1'); assert.equal(a.raum.sicht().phase, 'lobby');
  a.start('1', '2'); assert.equal(a.raum.sicht().phase, 'test');
  assert.equal(a.raum.sicht().gesperrt, true);
});

test('Einladung läuft ab; Verlängerung widerruft alten QR; Resume funktioniert ohne Einladung', () => {
  const a = aufbau(); const g = a.gast('1'); a.zeit(EINLADUNG_MS + 1);
  assert.equal(a.anmelden('2', { art: 'beitreten', einladung: a.host.einladung, name: 'Zwei' }), false);
  a.senden('h', { art: 'einladen' });
  assert.equal(a.anmelden('2', { art: 'beitreten', einladung: a.host.einladung, name: 'Zwei' }), false);
  a.senden('h', { art: 'sperren', gesperrt: true });
  assert.equal(a.anmelden('neu', { art: 'fortsetzen', schluessel: g.schluessel }), true);
  assert.equal(a.raum.sicht().spieler[0].id, g.spieler);
});

test('entfernter Spieler verliert Resume und alten QR, Platz wird frei', () => {
  const a = aufbau(), g = a.gast('1');
  a.senden('h', { art: 'entfernen', spieler: g.spieler });
  assert.equal(a.anmelden('neu', { art: 'fortsetzen', schluessel: g.schluessel }), false);
  assert.equal(a.anmelden('neu', { art: 'beitreten', einladung: a.host.einladung, name: 'Wieder da' }), false);
  assert.equal(a.raum.sicht().spieler.length, 0);
});

test('private Daten erreichen genau ihren Empfänger, nie andere Controller', () => {
  const a = aufbau(), g = a.gast('1'); a.gast('2'); a.start('1', '2'); a.post.length = 0;
  const n = { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { hinweis: 'Geheim', leben: 3 } };
  a.senden('2', n); assert.equal(a.post.length, 0);
  a.senden('h', n); assert.equal(a.post.length, 1); assert.equal(a.post[0].v, '1');
  a.post.length = 0; a.senden('h', { art: 'sperren', gesperrt: true });
  assert.equal(JSON.stringify(a.post).includes('Geheim'), false);
});

test('Sitz wird aus der Leitung abgeleitet; doppelte, verspätete und falsche Eingaben greifen nicht', () => {
  const a = aufbau(), g = a.gast('1'), g2 = a.gast('2'); a.start('1', '2'); a.post.length = 0;
  a.senden('1', { art: 'eingabe', spieler: g2.spieler, abschnitt: a.raum.sicht().abschnitt, folge: 3, aktion: { art: 'steuerung', x: 1, y: 0, tasten: [] } });
  assert.equal(a.post.length, 1);
  assert.equal((a.post[0].n as Extract<ServerNachricht, { art: 'eingabe' }>).spieler, g.spieler);
  a.eingabe('1', 3); a.eingabe('1', 2); assert.equal(a.post.length, 1);
  a.eingabe('1', 4, { art: 'steuerung', x: 99, y: 0, tasten: [] });
  assert.equal(a.post.filter(p => p.n.art === 'eingabe').length, 1);
  const alt = a.raum.sicht().abschnitt;
  a.senden('h', { art: 'layout', layout: 'auswahl' }); a.post.length = 0;
  a.senden('1', { art: 'eingabe', abschnitt: alt, folge: 5, aktion: { art: 'wahl', wert: 1 } });
  assert.equal(a.post.length, 0);
  a.eingabe('1', 6, { art: 'wahl', wert: 2 }); assert.equal(a.post.length, 1);
});

test('Reconnect ersetzt alte Verbindung; verspätetes Schließen und Eingaben können keinen neuen Sitz abmelden', () => {
  const a = aufbau(), g = a.gast('1'); a.start('1');
  assert.equal(a.anmelden('neu', { art: 'fortsetzen', schluessel: g.schluessel }), true);
  a.raum.abmelden('1'); a.post.length = 0; a.eingabe('1', 99);
  assert.equal(a.post.length, 0); assert.equal(a.raum.sicht().spieler[0].verbunden, true);
  a.eingabe('neu', 1); assert.equal(a.post.length, 1); assert.ok(a.getrennt.includes('1'));
});

test('gehaltene Eingaben werden bei Timeout, Disconnect, Phasenwechsel neutralisiert', () => {
  const a = aufbau(); a.gast('1'); a.start('1'); a.eingabe('1'); a.post.length = 0;
  a.zeit(601); a.raum.tick();
  assert.equal((a.post[0].n as Extract<ServerNachricht, { art: 'eingabe' }>).aktion.art, 'reset');
  a.eingabe('1', 2); a.post.length = 0; a.raum.abmelden('1');
  assert.ok(a.post.some(p => p.n.art === 'eingabe' && p.n.aktion.art === 'reset'));
  assert.equal(a.raum.sicht().spieler[0].bereit, false);
});

test('Host kehrt mit demselben Raum zurück; nach 90 Sekunden ohne Host endet der Raum', () => {
  const a = aufbau(); a.gast('1'); a.raum.abmelden('h'); a.zeit(1000);
  assert.equal(a.anmelden('h2', { art: 'gastgeber', schluessel: a.host.schluessel }), true);
  assert.equal(a.raum.sicht().gastgeberDa, true);
  a.raum.abmelden('h2'); a.zeit(60_000); a.raum.tick(); assert.equal(a.raum.beendet, false);
  a.zeit(30_001); a.raum.tick(); assert.equal(a.raum.beendet, true);
});

test('Nachrichtenrate begrenzt, unbekannte Aktionen und riesige Nachrichten verworfen', () => {
  const a = aufbau(); a.gast('1');
  for (let i = 0; i < 82; i++) a.senden('1', { art: 'ping' });
  assert.ok(a.getrennt.includes('1'));
  assert.equal(lesen('{'), null); assert.equal(lesen(JSON.stringify({ v: 2, art: 'ping' })), null);
  assert.equal(lesen(JSON.stringify({ v: 1, art: 'ping', text: 'x'.repeat(8192) })), null);
  assert.equal(aktionLesen({ art: 'steuerung', x: NaN, y: 0, tasten: [] }, 'bauen'), null);
  assert.equal(aktionLesen({ art: 'zahl', wert: -1 }, 'auswahl'), null);
  assert.equal(aktionLesen({ art: 'steuerung', x: 0, y: 0, tasten: ['hacken'] }, 'bauen'), null);
});

test('QR enthält nur kurzlebige Einladung, erlaubte Ziele und funktioniert für beide Wege', () => {
  for (const transport of ['relay', 'lan'] as const) {
    const e = { transport, adresse: transport === 'lan' ? 'ws://192.168.1.3:42111/broremote' : 'wss://staging.brauweg-spielen.de/ws/broremote', raum: 'ABC12345', schluessel: 'a'.repeat(32), bis: 160_000 };
    const link = einladungsLink(e);
    assert.ok(link.length <= 213); assert.deepEqual(einladungLesen(link, 100_000), e);
    assert.equal(einladungLesen(link, 160_001), null);
    assert.equal(einladungLesen(link.replace(e.raum, '../fremd'), 100_000), null);
  }
  for (const url of ['ws://8.8.8.8:80/broremote', 'ws://127.0.0.1:80/broremote', 'ws://192.168.1.1:80/admin', 'ws://user@192.168.1.1:80/broremote', 'http://192.168.1.1:80/broremote']) assert.equal(lokaleAdresse(url), false, url);
});

test('vier gleichzeitig aktive Controller bleiben eine halbe Stunde stabil', () => {
  const a = aufbau(); ['1', '2', '3', '4'].forEach(a.gast); a.start('1', '2', '3', '4');
  for (let folge = 1; folge <= 9000; folge++) {
    a.zeit(200); a.post.length = 0;
    a.senden('h', { art: 'ping' });
    for (const id of ['1', '2', '3', '4']) a.eingabe(id, folge, { art: 'steuerung', x: Math.sin(folge) * .8, y: 0, tasten: folge % 2 ? ['drehen'] : [] });
    a.raum.tick();
    assert.equal(a.post.filter(p => p.n.art === 'eingabe' && p.v === 'h').length, 4);
  }
  assert.equal(a.raum.beendet, false);
  assert.equal(a.raum.sicht().spieler.filter(s => s.verbunden).length, 4);
  assert.equal(a.getrennt.length, 0);
});

test('Zauber werden einmal adressiert und nur im Baucontroller akzeptiert', () => {
  const a = aufbau(), g = a.gast('1'), ziel = a.gast('2'); a.start('1', '2'); a.post.length = 0;
  a.eingabe('1', 1, { art: 'zauber', zauber: 'schwere', item: 1, ziel: ziel.spieler });
  assert.ok(a.post.some(p => p.v === 'h' && p.n.art === 'eingabe' && p.n.spieler === g.spieler && p.n.aktion.art === 'zauber'));
  assert.equal(aktionLesen({ art: 'zauber', zauber: 'unbegrenzt' }, 'bauen'), null);
  assert.equal(aktionLesen({ art: 'zauber', zauber: 'anker' }, 'auswahl'), null);
  assert.equal(aktionLesen({ art: 'zauber', zauber: 'schwere', item: 1, ziel: 'x'.repeat(25) }, 'bauen'), null);
});


test('Ping-Kennung wird begrenzt gespiegelt; ältere Clients bleiben kompatibel', () => {
  const a = aufbau(); a.post.length = 0;
  a.senden('h', { art: 'ping', kennung: 'netz-2-43' });
  assert.deepEqual(a.post.at(-1)?.n, { art: 'pong', zeit: 100_000, kennung: 'netz-2-43' });
  for (const kennung of [undefined, 'x'.repeat(49), '<img>', 42]) {
    a.senden('h', { art: 'ping', kennung });
    assert.deepEqual(a.post.at(-1)?.n, { art: 'pong', zeit: 100_000 });
  }
});

test('längerer Host-Netzwechsel bewahrt Partie und neutralisiert gehaltene Eingaben', () => {
  const a = aufbau(), gast = a.gast('1');
  a.senden('1', { art: 'bereit', bereit: true }); a.senden('h', { art: 'spielen' });
  const partie = a.raum.sicht().partie;
  a.eingabe('1'); a.raum.abmelden('h');
  for (let i = 0; i < 20; i++) { a.zeit(3000); a.senden('1', { art: 'ping' }); a.raum.tick(); }
  assert.equal(a.raum.beendet, false);
  a.post.length = 0; assert.equal(a.anmelden('h2', { art: 'gastgeber', schluessel: a.host.schluessel }), true);
  assert.deepEqual(a.raum.sicht().partie, partie);
  assert.equal(a.raum.sicht().spieler[0].id, gast.spieler);
  assert.ok(a.post.every(p => p.n.art !== 'eingabe' || p.n.aktion.art === 'reset'));
});


test('Item-Aktionen brauchen bekannte Art und Kennung; Plattform sendet keine freien Koordinaten', () => {
  for (const zauber of ['anker', 'plattform', 'stein', 'schwere', 'eis']) {
    assert.deepEqual(aktionLesen({ art: 'zauber', zauber, item: 7, extra: 'weg' }, 'bauen'), { art: 'zauber', zauber, item: 7 });
    for (const item of [undefined, 0, -1, 1.5, Infinity, 1001]) assert.equal(aktionLesen({ art: 'zauber', zauber, item }, 'bauen'), null);
  }
  assert.deepEqual(aktionLesen({ art: 'plattform', item: 4, schritt: 'platzieren', y: 999 }, 'bauen'), { art: 'plattform', item: 4, schritt: 'platzieren' });
  assert.equal(aktionLesen({ art: 'plattform', item: 4, schritt: 'platzieren' }, 'auswahl'), null);
  assert.equal(aktionLesen({ art: 'plattform', item: 4, schritt: 'fliegen' }, 'bauen'), null);
});

test('Vorrat und Platzierung bleiben beim Wiederverbinden erhalten, fremde Felder werden entfernt', () => {
  const a = aufbau(), g = a.gast('1'); a.start('1');
  const bau = { form: 5, hoehe: 8, restzeit: 110, phase: 'spiel', countdown: 0, platz: 1, fertig: false, gewonnen: false, verbraucht: 9, item: { art: 'plattform', nummer: 3, extra: 'weg' }, itemIn: 0, itemBereit: false, platzierung: { x: 3, y: 5, gueltig: true, rest: 6, extra: 'weg' } };
  a.senden('h', { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { bau } });
  a.post.length = 0; a.anmelden('neu', { art: 'fortsetzen', schluessel: g.schluessel });
  const status = a.post.find(p => p.v === 'neu' && p.n.art === 'privat')?.n;
  assert.ok(status?.art === 'privat');
  assert.deepEqual(status.daten.bau?.item, { art: 'plattform', nummer: 3 });
  assert.deepEqual(status.daten.bau?.platzierung, { x: 3, y: 5, gueltig: true, rest: 6 });
  for (const falsch of [{ item: { art: 'unendlich', nummer: 1 } }, { item: { art: 'eis', nummer: 1 } }, { platzierung: { x: 999, y: 5, gueltig: true, rest: 6 } }, { itemIn: NaN }]) {
    a.post.length = 0;
    a.senden('h', { art: 'privat', abschnitt: a.raum.sicht().abschnitt, spieler: g.spieler, daten: { bau: { ...bau, ...falsch } } });
    assert.ok(a.post.every(p => p.n.art !== 'privat'));
  }
});
