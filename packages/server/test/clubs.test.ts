import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import {
  BETA_CLUB_NAME,
  acceptJoinRequest,
  cancelJoinRequest,
  clubDetail,
  clubOf,
  clubsFor,
  createClub,
  joinClub,
  kickMember,
  leaveClub,
  listClubs,
  pendingRequestsOf,
  rejectJoinRequest,
  releaseClubMemberships,
  setMemberRole,
  updateClub,
} from '../src/clubs/service.js';
import { anonymizeAccount } from '../src/auth/service.js';
import { AppError } from '../src/errors.js';
import * as s from '../src/db/schema.js';
import { createTestContext, createVerifiedAccount, seedInvite, schema } from './helpers.js';

async function ctx() {
  const context = await createTestContext();
  await seedInvite(context.db);
  return context;
}

/**
 * Jedes frische Konto landet bei der Registrierung im Beta-Clan. Wer selbst
 * gruenden will, muss also erst austreten — genau wie in der Oberflaeche.
 */
async function austreten(c: Awaited<ReturnType<typeof ctx>>, accountId: string): Promise<void> {
  const clubs = await clubsFor(c.db, accountId);
  for (const club of clubs) await leaveClub(c.db, club.id, accountId);
}

async function gruende(
  c: Awaited<ReturnType<typeof ctx>>,
  accountId: string,
  name: string,
  extra: { joinMode?: 'open' | 'on_request'; minTrophies?: number } = {},
): Promise<string> {
  await austreten(c, accountId);
  const { id } = await createClub(c.db, accountId, {
    name,
    crest: 'wappen-2',
    joinMode: extra.joinMode ?? 'on_request',
    minTrophies: extra.minTrophies,
  });
  return id;
}

/** Setzt Trophaeen, damit Mindestwerte pruefbar werden. */
async function gibTrophaeen(
  c: Awaited<ReturnType<typeof ctx>>,
  accountId: string,
  trophies: number,
): Promise<void> {
  await c.db
    .insert(s.accountGameStat)
    .values({ accountId, gameId: 'doppelkopf', trophies })
    .onConflictDoUpdate({
      target: [s.accountGameStat.accountId, s.accountGameStat.gameId],
      set: { trophies },
    });
}

test('gruenden macht den Gruender zum Admin', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord');
  const detail = await clubDetail(c.db, clubId, anna.accountId);

  assert.equal(detail.name, 'Kegelclub Nord');
  assert.equal(detail.crest, 'wappen-2');
  assert.equal(detail.myRole, 'admin');
  assert.equal(detail.members, 1);
  assert.deepEqual(
    detail.memberList.map((m) => m.displayName),
    ['Anna'],
  );
});

test('man ist in genau einem Clan', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');

  // Ohne Austritt aus dem Beta-Clan geht das Gruenden nicht.
  await assert.rejects(
    () => createClub(c.db, anna.accountId, { name: 'Zweitclan', crest: 'wappen-1' }),
    (e: AppError) => e.status === 409 && e.code === 'alreadyInClub',
  );
});

test('Name wird auf Laenge geprueft und darf nicht doppelt vorkommen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await austreten(c, anna.accountId);
  await assert.rejects(
    () => createClub(c.db, anna.accountId, { name: 'ab', crest: 'wappen-1' }),
    (e: AppError) => e.code === 'clubNameLength',
  );
  await assert.rejects(
    () => createClub(c.db, anna.accountId, { name: 'Nord', crest: 'gibtsnicht' }),
    (e: AppError) => e.code === 'clubCrestUnknown',
  );

  await createClub(c.db, anna.accountId, { name: 'Kegelclub Nord', crest: 'wappen-1' });
  await austreten(c, bert.accountId);
  await assert.rejects(
    () => createClub(c.db, bert.accountId, { name: '  Kegelclub   Nord ', crest: 'wappen-1' }),
    (e: AppError) => e.status === 409 && e.code === 'clubNameTaken',
  );
});

test('offener Clan nimmt sofort auf, auf Anfrage erst nach Zustimmung', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const offen = await gruende(c, anna.accountId, 'Offene Runde', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  assert.deepEqual(await joinClub(c.db, offen, bert.accountId), { status: 'joined' });

  const zu = await gruende(c, cora.accountId, 'Geschlossene Runde', { joinMode: 'on_request' });
  const dora = await createVerifiedAccount(c, 'Dora');
  await austreten(c, dora.accountId);
  assert.deepEqual(await joinClub(c.db, zu, dora.accountId), { status: 'requested' });

  // Bewerber ist noch kein Mitglied.
  assert.equal(await clubOf(c.db, dora.accountId), null);
  assert.deepEqual(await pendingRequestsOf(c.db, dora.accountId), [zu]);

  const vorher = await clubDetail(c.db, zu, cora.accountId);
  assert.deepEqual(
    vorher.requests.map((r) => r.displayName),
    ['Dora'],
  );

  await acceptJoinRequest(c.db, zu, cora.accountId, dora.accountId);
  const nachher = await clubDetail(c.db, zu, cora.accountId);
  assert.equal(nachher.members, 2);
  assert.deepEqual(nachher.requests, []);
});

test('Bewerberliste sieht nur der Admin', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch');
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);
  await acceptJoinRequest(c.db, clubId, anna.accountId, bert.accountId);

  await austreten(c, cora.accountId);
  await joinClub(c.db, clubId, cora.accountId);

  // Bert ist Mitglied, aber kein Admin - er sieht keine Bewerber.
  const alsMitglied = await clubDetail(c.db, clubId, bert.accountId);
  assert.deepEqual(alsMitglied.requests, []);
  assert.equal(alsMitglied.myRole, 'member');

  const alsAdmin = await clubDetail(c.db, clubId, anna.accountId);
  assert.equal(alsAdmin.requests.length, 1);
});

test('Ablehnen entfernt die Anfrage, ohne aufzunehmen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch');
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);

  await rejectJoinRequest(c.db, clubId, anna.accountId, bert.accountId);
  assert.deepEqual(await pendingRequestsOf(c.db, bert.accountId), []);
  assert.equal((await clubDetail(c.db, clubId, anna.accountId)).members, 1);
});

test('eigene Anfrage laesst sich zuruecknehmen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch');
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);
  await cancelJoinRequest(c.db, clubId, bert.accountId);

  assert.deepEqual(await pendingRequestsOf(c.db, bert.accountId), []);
});

test('Trophaeen-Mindestwert haelt zu schwache Konten drauasen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Fortgeschritten', {
    joinMode: 'open',
    minTrophies: 500,
  });

  await austreten(c, bert.accountId);
  await assert.rejects(
    () => joinClub(c.db, clubId, bert.accountId),
    (e: AppError) => e.status === 403 && e.code === 'clubTrophiesTooLow',
  );

  await gibTrophaeen(c, bert.accountId, 500);
  assert.deepEqual(await joinClub(c.db, clubId, bert.accountId), { status: 'joined' });
});

test('nur der Admin darf verwalten', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);
  await austreten(c, cora.accountId);
  await joinClub(c.db, clubId, cora.accountId);

  await assert.rejects(
    () => updateClub(c.db, clubId, bert.accountId, { name: 'Umbenannt' }),
    (e: AppError) => e.status === 403 && e.code === 'notClubAdmin',
  );
  await assert.rejects(
    () => kickMember(c.db, clubId, bert.accountId, cora.accountId),
    (e: AppError) => e.status === 403 && e.code === 'notClubAdmin',
  );

  // Wer gar nicht drin ist, kommt nicht einmal bis zur Rollenpruefung.
  const dora = await createVerifiedAccount(c, 'Dora');
  await assert.rejects(
    () => kickMember(c.db, clubId, dora.accountId, bert.accountId),
    (e: AppError) => e.status === 403 && e.code === 'notClubMember',
  );

  await kickMember(c.db, clubId, anna.accountId, cora.accountId);
  assert.equal((await clubDetail(c.db, clubId, anna.accountId)).members, 2);
});

test('der Admin kann sich nicht selbst rauswerfen oder herabstufen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const clubId = await gruende(c, anna.accountId, 'Stammtisch');

  await assert.rejects(
    () => kickMember(c.db, clubId, anna.accountId, anna.accountId),
    (e: AppError) => e.code === 'cannotKickSelf',
  );
  await assert.rejects(
    () => setMemberRole(c.db, clubId, anna.accountId, anna.accountId, 'member'),
    (e: AppError) => e.code === 'cannotChangeOwnRole',
  );
});

test('befoerdern macht einen zweiten Admin - der erste bleibt es', async (t) => {
  // Admins sind gleichberechtigt: Befoerdern gibt das Amt nicht ab, es
  // kommt einer dazu. Vorher wanderte es weiter und der Verein hatte
  // immer genau einen Verantwortlichen - fuer einen Doppelkopfverein mit
  // zwei, drei Organisatoren war das zu eng.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);

  await setMemberRole(c.db, clubId, anna.accountId, bert.accountId, 'admin');

  const detail = await clubDetail(c.db, clubId, bert.accountId);
  assert.equal(detail.myRole, 'admin');
  assert.equal(detail.memberList.find((m) => m.accountId === anna.accountId)?.role, 'admin');
});

test('Admins duerfen einander herabstufen und rauswerfen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  for (const wer of [bert, cora]) {
    await austreten(c, wer.accountId);
    await joinClub(c.db, clubId, wer.accountId);
    await setMemberRole(c.db, clubId, anna.accountId, wer.accountId, 'admin');
  }

  // Bert stuft Anna herab - unter Gleichen ist das erlaubt.
  await setMemberRole(c.db, clubId, bert.accountId, anna.accountId, 'member');
  let detail = await clubDetail(c.db, clubId, bert.accountId);
  assert.equal(detail.memberList.find((m) => m.accountId === anna.accountId)?.role, 'member');

  // Und Cora wirft Bert raus, obwohl er Admin ist.
  await kickMember(c.db, clubId, cora.accountId, bert.accountId);
  detail = await clubDetail(c.db, clubId, cora.accountId);
  assert.equal(detail.members, 2);
  assert.equal(detail.myRole, 'admin');
});

test('der letzte Admin laesst sich weder herabstufen noch rauswerfen', async (t) => {
  // Sonst bliebe ein Clan zurueck, den niemand mehr verwalten kann: kein
  // Aufnehmen, kein Rauswerfen, keine Regelaenderung.
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);
  await setMemberRole(c.db, clubId, anna.accountId, bert.accountId, 'admin');
  // Anna herabstufen geht noch - Bert ist ja auch Admin.
  await setMemberRole(c.db, clubId, bert.accountId, anna.accountId, 'member');

  // Jetzt ist Bert der einzige. Anna kann ihn nicht antasten, weil sie
  // selbst kein Admin mehr ist; und Bert kann sich nicht selbst herabstufen.
  await assert.rejects(
    () => setMemberRole(c.db, clubId, bert.accountId, bert.accountId, 'member'),
    (e: AppError) => e.code === 'cannotChangeOwnRole',
  );

  // Ueber einen dritten Admin laesst es sich pruefen: kommt Cora dazu und
  // wird Admin, darf sie Bert herabstufen - danach ist sie die letzte.
  const cora = await createVerifiedAccount(c, 'Cora');
  await austreten(c, cora.accountId);
  await joinClub(c.db, clubId, cora.accountId);
  await setMemberRole(c.db, clubId, bert.accountId, cora.accountId, 'admin');
  await setMemberRole(c.db, clubId, cora.accountId, bert.accountId, 'member');

  await assert.rejects(
    () => kickMember(c.db, clubId, cora.accountId, cora.accountId),
    (e: AppError) => e.code === 'cannotKickSelf',
  );
});

test('geht ein Admin, rueckt niemand nach solange ein anderer bleibt', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  for (const wer of [bert, cora]) {
    await austreten(c, wer.accountId);
    await joinClub(c.db, clubId, wer.accountId);
  }
  await setMemberRole(c.db, clubId, anna.accountId, bert.accountId, 'admin');

  await leaveClub(c.db, clubId, anna.accountId);

  const detail = await clubDetail(c.db, clubId, bert.accountId);
  assert.equal(detail.myRole, 'admin');
  // Cora bleibt Mitglied - sie rueckt nicht nach, weil Bert noch da ist.
  assert.equal(detail.memberList.find((m) => m.accountId === cora.accountId)?.role, 'member');
});

test('tritt der Admin aus, rueckt das aelteste Mitglied nach', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');
  const cora = await createVerifiedAccount(c, 'Cora');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);
  await austreten(c, cora.accountId);
  await joinClub(c.db, clubId, cora.accountId);

  await leaveClub(c.db, clubId, anna.accountId);

  const detail = await clubDetail(c.db, clubId, bert.accountId);
  assert.equal(detail.myRole, 'admin');
  assert.equal(detail.members, 2);
});

test('der letzte, der geht, loescht den Clan', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const clubId = await gruende(c, anna.accountId, 'Einzelkaempfer');

  await leaveClub(c.db, clubId, anna.accountId);

  assert.equal(await clubOf(c.db, anna.accountId), null);
  const uebrig = await c.db.select().from(schema.club).where(eq(schema.club.id, clubId));
  assert.equal(uebrig.length, 0);
});

test('Kontoloeschung gibt den Clan frei statt ihn fuehrerlos zu lassen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);

  await releaseClubMemberships(c.db, anna.accountId);
  await anonymizeAccount(c.db, anna.accountId);

  const detail = await clubDetail(c.db, clubId, bert.accountId);
  assert.equal(detail.myRole, 'admin');
  assert.equal(detail.members, 1);
});

test('austreten bleibt ausgetreten - der Beta-Clan holt niemanden zurueck', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  // Anna gruendet den Beta-Clan mit, Bert kommt hinzu. Bert tritt aus.
  const [beta] = await clubsFor(c.db, bert.accountId);
  assert.equal(beta?.name, BETA_CLUB_NAME);
  await leaveClub(c.db, beta!.id, bert.accountId);

  // Frueher trug ihn das naechste Lesen wieder ein.
  assert.deepEqual(await clubsFor(c.db, bert.accountId), []);
  assert.equal(await clubOf(c.db, bert.accountId), null);
  assert.notEqual(anna.accountId, bert.accountId);
});

test('die Clanliste zaehlt Mitglieder und Trophaeen und findet ueber den Namen', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  await gibTrophaeen(c, anna.accountId, 300);
  await gibTrophaeen(c, bert.accountId, 120);

  const clubId = await gruende(c, anna.accountId, 'Kegelclub Nord', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);

  const treffer = await listClubs(c.db, { search: 'kegel' });
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0]?.members, 2);
  assert.equal(treffer[0]?.trophies, 420);

  assert.deepEqual(await listClubs(c.db, { search: 'gibtsnicht' }), []);
});

test('anonymisierte Konten verschwinden aus der Mitgliederliste', async (t) => {
  const c = await ctx();
  t.after(() => c.close());
  const anna = await createVerifiedAccount(c, 'Anna');
  const bert = await createVerifiedAccount(c, 'Bert');

  const clubId = await gruende(c, anna.accountId, 'Stammtisch', { joinMode: 'open' });
  await austreten(c, bert.accountId);
  await joinClub(c.db, clubId, bert.accountId);

  await anonymizeAccount(c.db, bert.accountId);

  const detail = await clubDetail(c.db, clubId, anna.accountId);
  assert.equal(detail.members, 1);
  assert.deepEqual(
    detail.memberList.map((m) => m.displayName),
    ['Anna'],
  );
});
