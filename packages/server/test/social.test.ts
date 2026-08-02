import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptFriendship,
  listFriendships,
  playerProfile,
  relationshipBetween,
  removeFriendship,
  requestFriendship,
  searchPlayers,
} from '../src/social/service.js';
import { anonymizeAccount } from '../src/auth/service.js';
import { AppError } from '../src/errors.js';
import { createTestContext, createVerifiedAccount, seedInvite } from './helpers.js';

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

test('Anfrage und Annahme ergeben eine Freundschaft', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const anfrage = await requestFriendship(c.db, anna.accountId, bert.accountId);
  assert.equal(anfrage.status, 'pending');
  assert.equal(await relationshipBetween(c.db, anna.accountId, bert.accountId), 'outgoing');
  assert.equal(await relationshipBetween(c.db, bert.accountId, anna.accountId), 'incoming');

  await acceptFriendship(c.db, bert.accountId, anna.accountId);
  assert.equal(await relationshipBetween(c.db, anna.accountId, bert.accountId), 'friends');

  const listen = await listFriendships(c.db, anna.accountId);
  assert.deepEqual(
    listen.friends.map((f) => f.displayName),
    ['Bert'],
  );
});

test('fragen beide unabhaengig an, gilt das als Annahme', async (t) => {
  // Wer selbst anfragt, waehrend die Anfrage des anderen offen ist, will
  // offenkundig dasselbe. Ihn auf den Annehmen-Knopf umzuleiten waere
  // Pedanterie.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await requestFriendship(c.db, anna.accountId, bert.accountId);
  const gegenrichtung = await requestFriendship(c.db, bert.accountId, anna.accountId);

  assert.equal(gegenrichtung.status, 'accepted');
  assert.equal(await relationshipBetween(c.db, anna.accountId, bert.accountId), 'friends');
});

test('doppelte Anfrage bleibt eine Anfrage, keine zweite Zeile', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await requestFriendship(c.db, anna.accountId, bert.accountId);
  await requestFriendship(c.db, anna.accountId, bert.accountId);

  const listen = await listFriendships(c.db, bert.accountId);
  assert.equal(listen.incoming.length, 1);
});

test('sich selbst anfragen geht nicht', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  await assert.rejects(
    () => requestFriendship(c.db, anna.accountId, anna.accountId),
    (err: AppError) => err.code === 'friendSelf',
  );
});

test('entfernen wirkt in beide Richtungen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await requestFriendship(c.db, anna.accountId, bert.accountId);
  await acceptFriendship(c.db, bert.accountId, anna.accountId);

  // Bert beendet - auch wenn Anna damals gefragt hatte.
  await removeFriendship(c.db, bert.accountId, anna.accountId);
  assert.equal(await relationshipBetween(c.db, anna.accountId, bert.accountId), 'none');
});

test('die Suche findet Namensteile, aber keine Anonymisierten und nicht einen selbst', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Annegret');
  await createVerifiedAccount(c, 'Annika');
  const weg = await createVerifiedAccount(c, 'Annalena');
  await anonymizeAccount(c.db, weg.accountId);

  const treffer = await searchPlayers(c.db, anna.accountId, 'ann');
  assert.deepEqual(
    treffer.map((row) => row.displayName),
    ['Annika'],
    'nur Annika: Annegret sucht selbst, Annalena ist anonymisiert',
  );

  // % ist in LIKE ein Platzhalter und darf keiner sein.
  assert.deepEqual(await searchPlayers(c.db, anna.accountId, '%%'), []);
});

test('das Profil eines anonymisierten Kontos ist weg', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  await anonymizeAccount(c.db, bert.accountId);

  await assert.rejects(
    () => playerProfile(c.db, anna.accountId, bert.accountId),
    (err: AppError) => err.code === 'playerUnknown',
  );
});

test('das Profil verraet nur den Monat des Beitritts', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const profil = await playerProfile(c.db, anna.accountId, anna.accountId);
  assert.match(profil.memberSince, /^\d{4}-\d{2}$/);
  assert.equal(profil.relationship, 'self');
  assert.equal(profil.totals.parties, 0);
});
