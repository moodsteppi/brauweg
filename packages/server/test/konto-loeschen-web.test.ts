/**
 * Loeschen, wie es die Stores pruefen (seit dem 23.09.2026, Store-Unterlagen).
 *
 * Zwei Zusagen aus docs/store/DATENSCHUTZ-ANGABEN.md, die sonst niemand
 * festhaelt:
 *
 * - Das Profilbild geht mit dem Konto. Bis zum 23.09.2026 blieb es in der
 *   Zeile stehen, und /api/avatars/:id lieferte das Foto eines geloeschten
 *   Kontos weiter an jeden aus — obwohl Datenschutzerklaerung und
 *   Store-Angaben „geloescht" sagen.
 * - Google Play verlangt eine Seite, auf der man die Loeschung ohne App
 *   anstossen kann. Sie liegt unter /konto-loeschen und ist die echte Datei
 *   aus packages/client/public, nicht die index.html der App.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/http/app.js';
import { PartyRuntime } from '../src/runtime/party.js';
import { createSession } from '../src/auth/service.js';
import { createTestContext, schema } from './helpers.js';

/** Aus dist/test/ gesehen: packages/client/public. */
const OEFFENTLICH = fileURLToPath(new URL('../../../client/public/', import.meta.url));

/** Ein 1x1-PNG als data-URL, so wie der Client das Profilbild speichert. */
const BILD =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

async function setup() {
  const ctx = await createTestContext();
  const runtime = new PartyRuntime(ctx.db, { botDelayMs: 0 });
  const app = await buildApp({
    db: ctx.db,
    runtime,
    auth: ctx.auth,
    cookieSecure: false,
    sessionTtlDays: 30,
    clientDir: OEFFENTLICH,
  });
  return {
    ctx,
    app,
    async close() {
      runtime.shutdown();
      await app.close();
      await ctx.close();
    },
  };
}

test('Loeschen nimmt Profilbild und Figurbemalung mit', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  // Ein Gast: ohne Mail und Passwort, bestaetigt wird mit dem Wort.
  const [zeile] = await s.ctx.db
    .insert(schema.account)
    .values({
      displayName: 'Kiebitz',
      gastSeit: new Date(),
      avatar: BILD,
      figurBemalung: '{"design":1,"striche":[]}',
    })
    .returning({ id: schema.account.id });
  const id = zeile!.id;
  const kopf = { authorization: `Bearer ${await createSession(s.ctx.auth, id)}` };

  const vorher = await s.app.inject({ method: 'GET', url: `/api/avatars/${id}` });
  assert.equal(vorher.statusCode, 200, 'vor dem Loeschen ist das Bild da');

  const weg = await s.app.inject({
    method: 'DELETE',
    url: '/api/me',
    headers: kopf,
    payload: { bestaetigung: 'LÖSCHEN' },
  });
  assert.equal(weg.statusCode, 200, weg.body);

  const [danach] = await s.ctx.db
    .select({ avatar: schema.account.avatar, bemalung: schema.account.figurBemalung })
    .from(schema.account)
    .where(eq(schema.account.id, id));
  assert.equal(danach?.avatar, null);
  assert.equal(danach?.bemalung, null);

  const bild = await s.app.inject({ method: 'GET', url: `/api/avatars/${id}` });
  assert.equal(bild.statusCode, 404, 'das Foto eines geloeschten Kontos liefert niemand mehr aus');
});

test('/konto-loeschen ist die Loesch-Anleitung, nicht die App', async (t) => {
  const s = await setup();
  t.after(() => s.close());
  for (const pfad of ['/konto-loeschen', '/rechtliches/konto-loeschen.html']) {
    const antwort = await s.app.inject({ method: 'GET', url: pfad });
    assert.equal(antwort.statusCode, 200, pfad);
    assert.match(String(antwort.headers['content-type']), /text\/html/, pfad);
    // Was Google Play auf der Seite sehen will: App-Name, der Weg, was geloescht wird.
    assert.match(antwort.body, /<h1>Konto löschen<\/h1>/, pfad);
    assert.match(antwort.body, /Brauweg/, pfad);
    assert.match(antwort.body, /Was gelöscht wird/, pfad);
    assert.match(antwort.body, /Was ohne Personenbezug bleibt/, pfad);
  }
});
