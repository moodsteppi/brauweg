import { describe, expect, it } from 'vitest';
import { Messung, Uhrabgleich, messung, quantil } from './messen';

describe('Messschalter', () => {
  it('ist ohne ?messen=1 aus — der Normalbetrieb bekommt nichts davon', () => {
    expect(messung).toBeNull();
  });
});

describe('Uhrabgleich', () => {
  it('nimmt den Versatz aus der schnellsten Probe', () => {
    const u = new Uhrabgleich();
    u.gesendet(1000); u.pong(5060, 1100); // rtt 100, versatz 4010
    u.gesendet(2000); u.pong(6020, 2020); // rtt 20, versatz 4010
    u.gesendet(3000); u.pong(7100, 3200); // rtt 200, versatz 4000
    expect(u.versatz()).toBe(4010);
    expect(u.abgeglichen()).toBe(true);
  });
  it('verwirft eine Probe, wenn ein fremder Pong (Ping der Verbindung) dazwischenkam', () => {
    const u = new Uhrabgleich();
    u.gesendet(1000); u.pong(5050, 1100);
    u.gesendet(2000); u.pong(5900, 2005); // fremder Pong: viel zu kurz
    u.pong(6050, 2100);                   // unser eigener kommt ohne offenen Ping
    expect(u.proben).toHaveLength(1);
    expect(u.versatz()).toBe(4000);
  });
});

describe('Messung', () => {
  it('gibt streng steigende Folgen aus, auch wenn die Uhr zurückspringt', () => {
    const m = new Messung();
    const a = m.folge(0), b = m.folge(a), c = m.folge(b + 10_000_000);
    expect(b).toBeGreaterThan(a);
    expect(c).toBe(b + 10_000_001);
  });
  it('zählt jede Folge beim Gastgeber nur einmal und ordnet Schritt und Bild zu', () => {
    const m = new Messung();
    for (let i = 0; i < 3; i++) { m.uhr.gesendet(); m.pong(Date.now()); }
    const folge = Math.round(performance.timeOrigin + performance.now() + m.uhr.versatz()) - 40;
    m.ankunft('a', folge, 'steuerung');
    m.ankunft('a', folge, 'reset'); // Server-Reset wiederholt die letzte Folge
    m.ankunft('b', 7, 'steuerung'); // Handy ohne Messschalter: kleine Zählfolge
    expect(m.eintraege).toHaveLength(1);
    const t = m.eintraege[0].ankunft;
    m.angewendet(t + 10); m.gezeichnet(t + 12);
    const e = m.eintraege[0];
    expect(e.angewendet! - e.ankunft).toBe(10);
    expect(e.gezeichnet! - e.angewendet!).toBe(2);
    expect(m.tabelle()).toContain('Druck → gezeichnet\tn=1');
  });
  it('rechnet Quantile nach dem Rangverfahren', () => {
    expect(quantil([5, 1, 3, 2, 4], .5)).toBe(3);
    expect(quantil(Array.from({ length: 100 }, (_, i) => i + 1), .95)).toBe(95);
    expect(quantil([], .5)).toBeNaN();
  });
});
