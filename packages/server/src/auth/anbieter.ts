/**
 * Anmeldung ueber fremde Anbieter (Google, Apple) — wer zu welchem Konto gehoert.
 *
 * Die Token-Pruefung steht in google.ts und apple.ts; hier kommt nur noch ein
 * geprueftes Profil an. Die Regeln, nach denen daraus ein Konto wird, sind fuer
 * beide Anbieter dieselben und stehen deshalb genau einmal hier:
 *
 * 1. **Gebunden wird ueber `sub`, nie ueber die Mail.** Wer einmal verknuepft
 *    ist, kommt ueber `account_identity` herein, auch wenn sich seine Adresse
 *    beim Anbieter inzwischen geaendert hat.
 * 2. **Ueber die Mail wird nur verknuepft, wenn sie bestaetigt ist** — sonst
 *    legt jemand ein Google-Konto mit fremder, unbestaetigter Adresse an und
 *    uebernimmt damit das Brauweg-Konto dahinter.
 * 3. **Eine Apple-Weiterleitungsadresse verknuepft nie automatisch.** Sie
 *    gehoert Apple und leitet nur weiter; dass ein vorhandenes Konto dieselbe
 *    Zeichenkette traegt, beweist nicht, dass es dieselbe Person ist. Wer
 *    beides zusammen haben will, meldet sich an und verknuepft in den
 *    Einstellungen — dann ist die Zugehoerigkeit durch die Sitzung belegt.
 * 4. **Wer ueber die Mail an ein Konto mit UNBESTAETIGTER Adresse kommt,
 *    nimmt es ohne dessen Passwort in Besitz.** Dieses Passwort hat nie
 *    jemand mit Zugriff auf das Postfach gesetzt — es kann genauso gut von
 *    jemandem stammen, der die Adresse vorab registriert hat, um spaeter
 *    mitzulesen. Passwort weg, alle Sitzungen weg; ein neues geht ueber
 *    "Passwort vergessen".
 * 5. **Ein neues Konto entsteht erst mit Geburtsdatum** — dieselbe
 *    Altersgrenze wie bei der Registrierung, sonst waere der Anbieter-Knopf
 *    der Weg um sie herum. Dasselbe gilt fuer einen Gast, der sichert.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { randomBytes } from 'node:crypto';

import { assertValidBirthday } from '../birthday.js';
import { ensureBetaClubMembership } from '../clubs/service.js';
import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';
import { createSession, type AuthDeps } from './service.js';

export const ANBIETER = ['google', 'apple'] as const;
export type Anbieter = (typeof ANBIETER)[number];

export function istAnbieter(wert: unknown): wert is Anbieter {
  return typeof wert === 'string' && (ANBIETER as readonly string[]).includes(wert);
}

/** Was aus einem geprueften ID-Token gebraucht wird — fuer beide Anbieter gleich. */
export interface AnbieterProfil {
  readonly anbieter: Anbieter;
  /** Stabile Kennung beim Anbieter. Die Mail kann wechseln, `sub` nie. */
  readonly sub: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  /** Apple "E-Mail-Adresse verbergen": eine Weiterleitungsadresse. */
  readonly relay: boolean;
  /** Vorschlag fuer den Anzeigenamen — nur beim Anlegen eines Kontos benutzt. */
  readonly name: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Wie in service.ts: Der Postgres-Fehler steckt unter der Drizzle-Meldung. */
function constraintOf(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    const candidate = (current as { constraint?: unknown }).constraint;
    if (typeof candidate === 'string') return candidate;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

async function bindungVon(db: Db, anbieter: Anbieter, sub: string) {
  const [zeile] = await db
    .select()
    .from(s.accountIdentity)
    .where(and(eq(s.accountIdentity.provider, anbieter), eq(s.accountIdentity.subject, sub)));
  return zeile ?? null;
}

// ---------------------------------------------------------------------------
// Anmelden
// ---------------------------------------------------------------------------

/**
 * Anmeldung oder Erstanmeldung vom Anmeldebildschirm aus.
 *
 * Eine laufende Sitzung spielt hier keine Rolle: Wer auf dem Anmeldebildschirm
 * steht, hat keine. Ein Gast sichert sein Konto ueber `verknuepfeAnbieter`
 * aus den Einstellungen — mit der Sitzung als Beleg, dass es seins ist.
 */
export type AnmeldeErgebnis =
  | { readonly token: string; readonly accountId: string; readonly neu: boolean }
  /** Es entstuende ein neues Konto — erst das Geburtsdatum, siehe `Anmeldescheine`. */
  | { readonly geburtstagNoetig: true; readonly schein: string };

/**
 * Wie oben — aber ein NEUES Konto entsteht hier noch nicht.
 *
 * Die Registrierung verlangt ein Geburtsdatum und weist unter 18 ab
 * (`assertValidBirthday`). Ueber einen Anbieter an ihr vorbei ein Konto zu
 * bekommen, hiesse, die Altersgrenze mit einem Klick zu umgehen. Also wird
 * der gepruefte Anbieter-Ausweis als Schein zurueckgelegt, der Client fragt
 * das Geburtsdatum, und erst `schliesseAnmeldungAb` legt das Konto an — mit
 * derselben Pruefung und derselben Spalte wie die Registrierung.
 *
 * Ein vorhandenes Konto (schon verknuepft oder ueber die bestaetigte Mail
 * gefunden) hat sein Alter schon und wird nicht gefragt.
 */
export async function anmeldenMitAnbieter(
  deps: AuthDeps,
  profil: AnbieterProfil,
  scheine: Anmeldescheine,
): Promise<AnmeldeErgebnis> {
  return anmelden(deps, profil, { scheine });
}

/**
 * Zweiter Schritt einer Erstanmeldung: das Geburtsdatum.
 *
 * Unter 18 fliegt der Schein weg — dieselbe Absage wie bei der Registrierung
 * (`birthdayTooYoung`), und es bleibt nichts zurueck, weder Konto noch
 * Bindung. Ein unlesbares Datum laesst ihn liegen: Das ist ein Tippfehler,
 * kein Alter, und dafuer soll niemand noch einmal durch den Anbieter-Dialog.
 */
export async function schliesseAnmeldungAb(
  deps: AuthDeps,
  scheine: Anmeldescheine,
  schein: string,
  birthday: string,
): Promise<{ token: string; accountId: string; neu: boolean }> {
  const profil = scheine.ansehen(schein);
  if (!profil) throw badRequest('anmeldescheinUngueltig');
  let geburtstag: string;
  try {
    geburtstag = assertValidBirthday(birthday);
  } catch (err) {
    if (err instanceof AppError && err.code === 'birthdayTooYoung') scheine.verwerfen(schein);
    throw err;
  }
  // Einloesen nach der Pruefung, aber vor dem Anlegen: Zwei Klicks auf
  // "Konto anlegen" duerfen nicht zwei Konten machen.
  if (!scheine.einloesen(schein)) throw badRequest('anmeldescheinUngueltig');
  const ergebnis = await anmelden(deps, profil, { geburtstag });
  if ('schein' in ergebnis) throw badRequest('anmeldescheinUngueltig');
  return ergebnis;
}

async function anmelden(
  deps: AuthDeps,
  profil: AnbieterProfil,
  weiter: { scheine: Anmeldescheine } | { geburtstag: string },
): Promise<AnmeldeErgebnis> {
  const { db } = deps;

  // 1. Schon verknuepft: der Normalfall ab dem zweiten Mal.
  const bindung = await bindungVon(db, profil.anbieter, profil.sub);
  if (bindung) {
    const [konto] = await db
      .select({ anonymizedAt: s.account.anonymizedAt })
      .from(s.account)
      .where(eq(s.account.id, bindung.accountId));
    if (konto && !konto.anonymizedAt) {
      if (profil.email && profil.email !== bindung.email) {
        await db
          .update(s.accountIdentity)
          .set({ email: profil.email })
          .where(
            and(
              eq(s.accountIdentity.provider, profil.anbieter),
              eq(s.accountIdentity.subject, profil.sub),
            ),
          );
      }
      const token = await createSession(deps, bindung.accountId);
      return { token, accountId: bindung.accountId, neu: false };
    }
    // Eine Bindung an ein geloeschtes Konto darf es nicht geben
    // (`anonymizeAccount` raeumt sie ab). Steht doch eine da, ist sie ein
    // Rest und wird entfernt — die Person bekommt ein neues Konto.
    await db
      .delete(s.accountIdentity)
      .where(
        and(
          eq(s.accountIdentity.provider, profil.anbieter),
          eq(s.accountIdentity.subject, profil.sub),
        ),
      );
  }

  // Ohne bestaetigte Adresse weder Verknuepfung noch neues Konto — Regel 2.
  if (!profil.email || !profil.emailVerified) throw forbidden('emailNotVerified');
  const email = normalizeEmail(profil.email);

  // 2. Konto mit derselben Adresse.
  const [perMail] = await db.select().from(s.account).where(eq(s.account.email, email));
  if (perMail && !perMail.anonymizedAt) {
    // Regel 3: nicht ueber eine Weiterleitungsadresse.
    if (profil.relay) throw conflict('anbieterMailVergeben');

    const [schon] = await db
      .select({ subject: s.accountIdentity.subject })
      .from(s.accountIdentity)
      .where(
        and(
          eq(s.accountIdentity.accountId, perMail.id),
          eq(s.accountIdentity.provider, profil.anbieter),
        ),
      );
    // Das Brauweg-Konto haengt schon an einem ANDEREN Konto dieses Anbieters
    // (etwa einem zweiten Google-Konto mit derselben Adresse). Still
    // umhaengen hiesse, der ersten Bindung den Zugang zu nehmen.
    if (schon) throw conflict('anbieterSchonVerknuepft');

    await db.transaction(async (tx) => {
      if (!perMail.emailVerifiedAt) {
        // Regel 4: Das Passwort stammt nicht nachweislich vom Postfachinhaber.
        await tx
          .update(s.account)
          .set({ passwordHash: null })
          .where(eq(s.account.id, perMail.id));
        await tx
          .update(s.session)
          .set({ revokedAt: new Date() })
          .where(and(eq(s.session.accountId, perMail.id), isNull(s.session.revokedAt)));
      }
      await tx
        .update(s.account)
        // Wer ueber den Anbieter kommt, hat die Adresse belegt — ein noch
        // offener Bestaetigungslink wird damit gegenstandslos.
        .set({ emailVerifiedAt: perMail.emailVerifiedAt ?? new Date() })
        .where(eq(s.account.id, perMail.id));
      await tx.insert(s.accountIdentity).values({
        provider: profil.anbieter,
        subject: profil.sub,
        accountId: perMail.id,
        email: profil.email,
      });
    });
    const token = await createSession(deps, perMail.id);
    return { token, accountId: perMail.id, neu: false };
  }

  // 3. Neues Konto — erst mit Geburtsdatum.
  if (!('geburtstag' in weiter)) {
    return { geburtstagNoetig: true, schein: weiter.scheine.ausstellen(profil) };
  }
  let accountId: string;
  try {
    accountId = await legeKontoAn(db, profil, email, weiter.geburtstag);
  } catch (err) {
    // Zwei Klicks gleichzeitig beim allerersten Mal: Der erste hat die
    // Bindung angelegt, der zweite landet hier und nimmt dessen Konto.
    if (constraintOf(err) === 'account_identity_pkey') {
      const gewonnen = await bindungVon(db, profil.anbieter, profil.sub);
      if (gewonnen) {
        const token = await createSession(deps, gewonnen.accountId);
        return { token, accountId: gewonnen.accountId, neu: false };
      }
    }
    throw err;
  }
  await ensureBetaClubMembership(db, accountId);
  const token = await createSession(deps, accountId);
  return { token, accountId, neu: true };
}

/**
 * Anzeigename fuer ein neues Konto.
 *
 * Der Vorname, nicht der ganze Name: Der Anzeigename steht am Tisch und in
 * Ranglisten fuer alle sichtbar, und wer sich per Knopfdruck anmeldet, hat
 * nicht zugestimmt, dass sein Nachname dort erscheint. Ohne Namen der Teil der
 * Mail vor dem @ — ausser bei einer Weiterleitungsadresse, deren Vorderteil
 * eine Zufallskennung ist.
 */
export function namensvorschlag(profil: AnbieterProfil, email: string): string {
  const aufbereitet = (wert: string | null | undefined): string =>
    (wert ?? '').replace(/\s+/g, ' ').trim().slice(0, 26).trim();
  const ausName = aufbereitet(profil.name?.split(' ')[0]);
  if (ausName.length >= 2) return ausName;
  if (!profil.relay) {
    const ausMail = aufbereitet(email.split('@')[0]);
    if (ausMail.length >= 2) return ausMail;
  }
  return 'Spieler';
}

/**
 * Konto und Bindung in EINER Transaktion: Ein Konto ohne Bindung waere eines,
 * an das niemand mehr herankommt — kein Passwort, und der Anbieter fuehrt
 * nicht hin.
 *
 * Ein belegter Anzeigename bekommt eine Zahl angehaengt, statt zu scheitern;
 * aendern laesst er sich spaeter im Profil. Kein Passwort: `verifyPassword`
 * lehnt bei `passwordHash null` jede Eingabe ab, das Konto ist also nicht ueber
 * das Formular zu uebernehmen. Ein Passwort laesst sich jederzeit ueber
 * "Passwort vergessen" setzen.
 */
async function legeKontoAn(
  db: Db,
  profil: AnbieterProfil,
  email: string,
  birthday: string,
): Promise<string> {
  const basis = namensvorschlag(profil, email);
  for (let versuch = 0; versuch < 6; versuch++) {
    const displayName =
      versuch === 0 ? basis : `${basis}-${Math.floor(Math.random() * 9000) + 1000}`;
    try {
      return await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(s.account)
          .values({
            email,
            passwordHash: null,
            displayName,
            birthday,
            emailVerifiedAt: new Date(),
          })
          .returning({ id: s.account.id });
        await tx.insert(s.accountIdentity).values({
          provider: profil.anbieter,
          subject: profil.sub,
          accountId: row!.id,
          email: profil.email,
        });
        return row!.id;
      });
    } catch (err) {
      if (constraintOf(err) === 'account_display_name_key') continue;
      if (constraintOf(err) === 'account_email_key') throw conflict('emailTaken');
      throw err;
    }
  }
  throw conflict('displayNameTaken');
}

/**
 * Zurueckgelegte Erstanmeldungen, bis das Geburtsdatum kommt.
 *
 * Im Speicher wie die Nonces (nonce.ts) und aus demselben Grund: ein Prozess,
 * und ein verlorener Schein kostet einen zweiten Klick. Er traegt das schon
 * GEPRUEFTE Profil — das ID-Token ist dann verbraucht (Nonce) und liesse sich
 * nicht noch einmal vorzeigen. Der Schein selbst ist ein Zufallswert, den nur
 * der Client kennt, der die Anmeldung begonnen hat, und verfaellt nach
 * fuenfzehn Minuten.
 */
export class Anmeldescheine {
  private readonly offen = new Map<string, { profil: AnbieterProfil; bis: number }>();
  private readonly gueltigMs: number;
  private readonly hoechstens: number;
  private readonly jetzt: () => number;

  constructor(optionen: { gueltigMs?: number; hoechstens?: number; jetzt?: () => number } = {}) {
    this.gueltigMs = optionen.gueltigMs ?? 15 * 60_000;
    // Ausgestellt wird nur nach einem echten, gueltigen ID-Token — die Grenze
    // ist ein Riegel gegen Ueberlauf, keiner gegen gewoehnlichen Betrieb.
    this.hoechstens = optionen.hoechstens ?? 5_000;
    this.jetzt = optionen.jetzt ?? Date.now;
  }

  ausstellen(profil: AnbieterProfil): string {
    const jetzt = this.jetzt();
    // Einfuegereihenfolge = Alter: vorn die abgelaufenen und bei voller Liste
    // die aeltesten.
    for (const [schein, eintrag] of this.offen) {
      if (eintrag.bis > jetzt && this.offen.size < this.hoechstens) break;
      this.offen.delete(schein);
    }
    const schein = randomBytes(24).toString('base64url');
    this.offen.set(schein, { profil, bis: jetzt + this.gueltigMs });
    return schein;
  }

  ansehen(schein: string): AnbieterProfil | null {
    const eintrag = this.offen.get(schein);
    if (!eintrag) return null;
    if (eintrag.bis <= this.jetzt()) {
      this.offen.delete(schein);
      return null;
    }
    return eintrag.profil;
  }

  einloesen(schein: string): boolean {
    const da = this.ansehen(schein) !== null;
    this.offen.delete(schein);
    return da;
  }

  verwerfen(schein: string): void {
    this.offen.delete(schein);
  }
}

// ---------------------------------------------------------------------------
// Verknuepfen und Trennen (Einstellungen)
// ---------------------------------------------------------------------------

/**
 * Einen Anbieter an das angemeldete Konto haengen.
 *
 * Die Mail des Anbieters muss hier NICHT zur Kontoadresse passen: Die Sitzung
 * belegt, wem das Konto gehoert, das Token, wem das Anbieterkonto gehoert —
 * mehr braucht es nicht. So laesst sich auch eine Apple-Weiterleitungsadresse
 * an ein vorhandenes Konto haengen (Regel 3 oben verweist genau hierher).
 *
 * Fuer einen **Gast** ist das zugleich das Sichern: Die Adresse des Anbieters
 * wird die Kontoadresse, `gast_seit` faellt weg, und ab da zaehlen seine
 * Tische. Dafuer muss die Adresse bestaetigt und noch frei sein — ein Gast,
 * dessen Adresse schon ein Konto hat, gehoert in dieses Konto, nicht in ein
 * zweites.
 */
export async function verknuepfeAnbieter(
  db: Db,
  accountId: string,
  profil: AnbieterProfil,
  /** Nur fuer einen Gast gebraucht: Er hat keins, und Sichern ist fuer ihn Registrieren. */
  birthday?: string | null,
): Promise<{ gesichert: boolean }> {
  const [konto] = await db
    .select({
      email: s.account.email,
      gastSeit: s.account.gastSeit,
      anonymizedAt: s.account.anonymizedAt,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto || konto.anonymizedAt) throw unauthorized();

  const bindung = await bindungVon(db, profil.anbieter, profil.sub);
  if (bindung) {
    if (bindung.accountId === accountId) return { gesichert: false };
    throw conflict('anbieterFremdVerknuepft');
  }

  const [schon] = await db
    .select({ subject: s.accountIdentity.subject })
    .from(s.accountIdentity)
    .where(
      and(
        eq(s.accountIdentity.accountId, accountId),
        eq(s.accountIdentity.provider, profil.anbieter),
      ),
    );
  if (schon) throw conflict('anbieterSchonVerknuepft');

  const sichern = konto.gastSeit !== null;
  if (sichern && (!profil.email || !profil.emailVerified)) throw forbidden('emailNotVerified');
  // Wie `gastSichern` mit Passwort: Aus dem Gast wird ein richtiges Konto,
  // also gilt dieselbe Altersgrenze wie beim Registrieren. Ein Gast hat
  // bisher kein Alter angegeben (gastKonto fragt nicht danach).
  if (sichern && !birthday) throw badRequest('geburtstagFehlt');
  const geburtstag = sichern ? assertValidBirthday(birthday!) : null;

  try {
    await db.transaction(async (tx) => {
      if (sichern) {
        /*
         * `isNull(email)` ist derselbe Riegel wie in `gastSichern`: Zwei
         * gleichzeitige Versuche, und der zweite trifft keine Zeile mehr.
         */
        const betroffen = await tx
          .update(s.account)
          .set({
            email: normalizeEmail(profil.email!),
            emailVerifiedAt: new Date(),
            birthday: geburtstag,
            gastSeit: null,
          })
          .where(and(eq(s.account.id, accountId), isNull(s.account.email)))
          .returning({ id: s.account.id });
        if (betroffen.length === 0) throw conflict('keinGastkonto');
      }
      await tx.insert(s.accountIdentity).values({
        provider: profil.anbieter,
        subject: profil.sub,
        accountId,
        email: profil.email,
      });
    });
  } catch (err) {
    if (constraintOf(err) === 'account_email_key') throw conflict('emailTaken');
    if (constraintOf(err) === 'account_identity_pkey') throw conflict('anbieterFremdVerknuepft');
    if (constraintOf(err) === 'account_identity_konto_anbieter_key') {
      throw conflict('anbieterSchonVerknuepft');
    }
    throw err;
  }

  // Wie bei `gastSichern`: Erst ein richtiges Konto kommt in den Beta-Clan.
  if (sichern) await ensureBetaClubMembership(db, accountId);
  return { gesichert: sichern };
}

/**
 * Einen Anbieter vom Konto trennen — ausser es ist die letzte Anmeldeart.
 *
 * Ohne diese Sperre gaebe es Konten ohne jeden Weg hinein: kein Passwort, kein
 * Anbieter. Die laufende Sitzung hielte noch bis zum Ablauf, danach waere das
 * Konto verloren, samt allem, was darin gekauft wurde.
 *
 * Unter Zeilensperre am Konto: Zwei gleichzeitige Trennungen (Google hier,
 * Apple auf dem Handy) saehen sonst beide noch die jeweils andere Bindung und
 * ließen gemeinsam nichts uebrig.
 */
export async function trenneAnbieter(
  db: Db,
  accountId: string,
  anbieter: Anbieter,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [konto] = await tx
      .select({ email: s.account.email, passwordHash: s.account.passwordHash })
      .from(s.account)
      .where(eq(s.account.id, accountId))
      .for('update');
    if (!konto) throw unauthorized();

    const bindungen = await tx
      .select({ provider: s.accountIdentity.provider })
      .from(s.accountIdentity)
      .where(eq(s.accountIdentity.accountId, accountId));
    if (!bindungen.some((b) => b.provider === anbieter)) {
      throw notFound('anbieterNichtVerknuepft');
    }

    const passwort = konto.passwordHash !== null && konto.email !== null;
    const andere = bindungen.filter((b) => b.provider !== anbieter).length;
    if (!passwort && andere === 0) throw conflict('letzteAnmeldeart');

    await tx
      .delete(s.accountIdentity)
      .where(
        and(eq(s.accountIdentity.accountId, accountId), eq(s.accountIdentity.provider, anbieter)),
      );
  });
}

export interface Anmeldearten {
  /** Mail und Passwort gesetzt — der Weg ueber das Formular steht offen. */
  readonly passwort: boolean;
  readonly email: string | null;
  readonly gast: boolean;
  readonly anbieter: readonly { anbieter: Anbieter; email: string | null; seit: string }[];
}

/** Wie man in dieses Konto kommt — fuer den Abschnitt in den Einstellungen. */
export async function anmeldeartenVon(db: Db, accountId: string): Promise<Anmeldearten> {
  const [konto] = await db
    .select({
      email: s.account.email,
      passwordHash: s.account.passwordHash,
      gastSeit: s.account.gastSeit,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  const bindungen = await db
    .select()
    .from(s.accountIdentity)
    .where(eq(s.accountIdentity.accountId, accountId))
    .orderBy(s.accountIdentity.createdAt);

  return {
    passwort: konto.passwordHash !== null && konto.email !== null,
    email: konto.email,
    gast: konto.gastSeit !== null,
    anbieter: bindungen.map((b) => ({
      anbieter: b.provider,
      email: b.email,
      seit: b.createdAt.toISOString(),
    })),
  };
}
