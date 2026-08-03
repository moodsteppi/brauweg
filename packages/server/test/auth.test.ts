import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import {
  anonymizeAccount,
  login,
  logout,
  register,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  sessionFromToken,
  verifyEmail,
} from '../src/auth/service.js';
import { AppError } from '../src/errors.js';
import { INVITE, createTestContext, createVerifiedAccount, schema, seedInvite } from './helpers.js';

const PASSWORD = 'geheim-genug-1234';

async function ctxWithInvite(maxUses = 50) {
  const ctx = await createTestContext();
  await seedInvite(ctx.db, maxUses);
  return ctx;
}

test('Migration legt alle Tabellen an', async (t) => {
  const ctx = await createTestContext();
  t.after(() => ctx.close());

  const rows = await ctx.db.execute(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const names = new Set(
    (rows.rows as { table_name: string }[]).map((r) => r.table_name),
  );

  for (const expected of ['account', 'table_', 'party', 'party_snapshot', 'session']) {
    assert.ok(names.has(expected), `Tabelle ${expected} fehlt`);
  }
});

test('Registrierung braucht einen gueltigen Einladungscode', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await assert.rejects(
    () =>
      register(ctx.auth, {
        email: 'a@example.org',
        password: PASSWORD,
        displayName: 'Anna',
        inviteCode: 'FALSCH',
      }),
    (err: AppError) => err.code === 'inviteCodeInvalid',
  );
});

test('der Einladungscode gilt nur so oft wie erlaubt', async (t) => {
  const ctx = await ctxWithInvite(2);
  t.after(() => ctx.close());

  await createVerifiedAccount(ctx, 'Anna');
  await createVerifiedAccount(ctx, 'Bert');

  await assert.rejects(
    () =>
      register(ctx.auth, {
        email: 'c@example.org',
        password: PASSWORD,
        displayName: 'Cara',
        inviteCode: INVITE,
      }),
    (err: AppError) => err.code === 'inviteCodeInvalid',
  );
});

test('vor der Bestaetigung ist keine Anmeldung moeglich', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });

  await assert.rejects(
    () => login(ctx.auth, 'anna@example.org', PASSWORD),
    (err: AppError) => err.code === 'emailNotVerified',
  );

  await verifyEmail(ctx.db, ctx.mailer.tokenFrom('anna@example.org'));
  const { token } = await login(ctx.auth, 'anna@example.org', PASSWORD);
  assert.ok(token.length > 20);
});

test('ein Bestaetigungstoken gilt nur einmal', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });
  const token = ctx.mailer.tokenFrom('anna@example.org');

  await verifyEmail(ctx.db, token);
  await assert.rejects(
    () => verifyEmail(ctx.db, token),
    (err: AppError) => err.code === 'tokenInvalid',
  );
});

test('ein gescheiterter Versand wirft die Registrierung nicht um', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  // Der Versanddienst faellt aus. Genau das passiert im Betrieb bei falschem
  // Schluessel oder erreichtem Tageslimit.
  ctx.mailer.failNext = true;

  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });

  // Das Konto ist da. Waere hier durchgeworfen worden, saesse die Person in
  // der Sackgasse: kein Link, und die Adresse gilt als vergeben.
  const [acc] = await ctx.db
    .select()
    .from(schema.account)
    .where(eq(schema.account.email, 'anna@example.org'));
  assert.ok(acc, 'das Konto muss trotz Versandfehler bestehen');
  assert.equal(acc.emailVerifiedAt, null);
});

test('der Bestaetigungslink laesst sich erneut anfordern', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  ctx.mailer.failNext = true;
  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });
  assert.equal(ctx.mailer.sent.length, 0, 'die erste Mail ging verloren');

  await requestVerification(ctx.auth, 'anna@example.org');
  assert.equal(ctx.mailer.sent.length, 1);

  await verifyEmail(ctx.db, ctx.mailer.tokenFrom('anna@example.org'));
  const { token } = await login(ctx.auth, 'anna@example.org', PASSWORD);
  assert.ok(token, 'nach dem zweiten Link muss die Anmeldung gehen');
});

test('der neue Link entwertet den alten', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });
  const alt = ctx.mailer.tokenFrom('anna@example.org');

  // Die Sperrfrist zurueckdrehen, damit die zweite Anforderung durchgeht.
  await ctx.db
    .update(schema.authToken)
    .set({ createdAt: new Date(Date.now() - 5 * 60_000) })
    .where(eq(schema.authToken.purpose, 'email_verify'));

  await requestVerification(ctx.auth, 'anna@example.org');
  const neu = ctx.mailer.tokenFrom('anna@example.org');
  assert.notEqual(neu, alt);

  await assert.rejects(
    () => verifyEmail(ctx.db, alt),
    (err: AppError) => err.code === 'tokenInvalid',
  );
  await verifyEmail(ctx.db, neu);
});

test('die Sperrfrist verhindert das Zumuellen fremder Postfaecher', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await register(ctx.auth, {
    email: 'anna@example.org',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });
  const vorher = ctx.mailer.sent.length;

  for (let i = 0; i < 5; i++) await requestVerification(ctx.auth, 'anna@example.org');
  assert.equal(ctx.mailer.sent.length, vorher, 'innerhalb der Sperrfrist geht nichts raus');
});

test('erneut anfordern verraet nicht, welche Adressen es gibt', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');
  const vorher = ctx.mailer.sent.length;

  // Unbekannte Adresse und bereits bestaetigtes Konto: beide still.
  await requestVerification(ctx.auth, 'niemand@example.org');
  await requestVerification(ctx.auth, 'anna@example.org');
  assert.equal(ctx.mailer.sent.length, vorher);
});

test('falsches Passwort und unbekannte Adresse melden dasselbe', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');

  const codeOf = async (email: string, password: string): Promise<string> => {
    try {
      await login(ctx.auth, email, password);
      return 'kein Fehler';
    } catch (err) {
      return (err as AppError).code;
    }
  };

  assert.equal(await codeOf('anna@example.org', 'falsch'), 'credentialsInvalid');
  assert.equal(await codeOf('niemand@example.org', PASSWORD), 'credentialsInvalid');
});

test('Anzeigename und Adresse sind eindeutig', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');

  await assert.rejects(
    () =>
      register(ctx.auth, {
        email: 'andere@example.org',
        password: PASSWORD,
        displayName: 'Anna',
        inviteCode: INVITE,
      }),
    (err: AppError) => err.code === 'displayNameTaken',
  );

  await assert.rejects(
    () =>
      register(ctx.auth, {
        email: 'anna@example.org',
        password: PASSWORD,
        displayName: 'Andere',
        inviteCode: INVITE,
      }),
    (err: AppError) => err.code === 'emailTaken',
  );
});

test('Abmelden entwertet die Sitzung sofort', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');

  const { token } = await login(ctx.auth, 'anna@example.org', PASSWORD);
  const session = await sessionFromToken(ctx.db, token);
  assert.ok(session);

  await logout(ctx.db, session.sessionId);
  assert.equal(await sessionFromToken(ctx.db, token), null);
});

test('Passwort zuruecksetzen beendet alle offenen Sitzungen', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');

  const alt = (await login(ctx.auth, 'anna@example.org', PASSWORD)).token;
  await requestPasswordReset(ctx.auth, 'anna@example.org');
  await resetPassword(ctx.db, ctx.mailer.tokenFrom('anna@example.org'), 'neues-passwort-9');

  assert.equal(await sessionFromToken(ctx.db, alt), null);
  await assert.rejects(() => login(ctx.auth, 'anna@example.org', PASSWORD));

  const neu = await login(ctx.auth, 'anna@example.org', 'neues-passwort-9');
  assert.ok(neu.token);
});

test('eine unbekannte Adresse verraet sich beim Zuruecksetzen nicht', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());

  await requestPasswordReset(ctx.auth, 'niemand@example.org');
  assert.equal(ctx.mailer.sent.length, 0);
});

test('Kontoloeschung anonymisiert, statt Zeilen zu entfernen', async (t) => {
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  const { accountId } = await createVerifiedAccount(ctx, 'Anna');
  const { token } = await login(ctx.auth, 'anna@example.org', PASSWORD);

  await anonymizeAccount(ctx.db, accountId);

  const [acc] = await ctx.db
    .select()
    .from(schema.account)
    .where(eq(schema.account.id, accountId));

  assert.ok(acc, 'die Zeile muss erhalten bleiben');
  assert.equal(acc.email, null);
  assert.equal(acc.passwordHash, null);
  assert.ok(acc.anonymizedAt);
  assert.equal(await sessionFromToken(ctx.db, token), null);
});

test('eine gescheiterte Registrierung verbraucht keine Einladung', async (t) => {
  // Frueher zaehlte jeder Fehlversuch eine Nutzung hoch. Wer den Beta-Code
  // kannte, konnte damit in Sekunden alle Nutzungen verbrennen und die
  // Registrierung fuer alle sperren.
  const ctx = await ctxWithInvite(3);
  t.after(() => ctx.close());

  await register(ctx.auth, {
    email: 'erste@example.com',
    password: PASSWORD,
    displayName: 'Anna',
    inviteCode: INVITE,
  });

  // Derselbe Anzeigename: schlaegt fehl, darf aber nichts kosten.
  for (let i = 0; i < 5; i++) {
    await assert.rejects(
      () =>
        register(ctx.auth, {
          email: `spam${i}@example.com`,
          password: PASSWORD,
          displayName: 'Anna',
          inviteCode: INVITE,
        }),
      (err: AppError) => err.code === 'displayNameTaken',
    );
  }

  const [code] = await ctx.db
    .select()
    .from(schema.inviteCode)
    .where(eq(schema.inviteCode.code, INVITE));
  assert.equal(code?.uses, 1, 'nur die erfolgreiche Registrierung zaehlt');

  // Und die verbleibenden Nutzungen stehen echten Leuten noch zur Verfuegung.
  await register(ctx.auth, {
    email: 'zweite@example.com',
    password: PASSWORD,
    displayName: 'Bert',
    inviteCode: INVITE,
  });
});

test('die Anmeldung verraet ueber die Dauer nicht, ob es das Konto gibt', async (t) => {
  // Ohne Blindvergleich kehrte die Pruefung bei unbekannter Adresse sofort
  // zurueck, waehrend ein echtes Konto Argon2 kostet - der Unterschied war
  // ueber das Netz messbar.
  const ctx = await ctxWithInvite();
  t.after(() => ctx.close());
  await createVerifiedAccount(ctx, 'Anna');

  const messen = async (email: string): Promise<number> => {
    const start = process.hrtime.bigint();
    await login(ctx.auth, email, 'falsches-passwort-123').catch(() => undefined);
    return Number(process.hrtime.bigint() - start) / 1e6;
  };

  // Aufwaermen, damit der erste Argon2-Lauf die Messung nicht verzerrt.
  await messen('anna@example.com');
  const bekannt = await messen('anna@example.com');
  const unbekannt = await messen('gibtesnicht@example.com');

  // Beide Wege muessen rechnen. Ein Faktor 5 waere ein klares Leck.
  assert.ok(
    unbekannt > bekannt / 5,
    `unbekannt ${unbekannt.toFixed(1)}ms darf nicht viel schneller sein als bekannt ${bekannt.toFixed(1)}ms`,
  );
});
