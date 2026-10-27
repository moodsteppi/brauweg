/**
 * Serverstart.
 *
 * Reihenfolge: Konfiguration, Datenbank, Laufzeit, HTTP, WebSocket. Der
 * WebSocket-Server haengt sich an denselben HTTP-Server, damit Railway nur
 * einen Port braucht und das Sitzungs-Cookie ohne Sonderfall mitkommt.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadConfig } from './config.js';
import { connect } from './db/connect.js';
import * as s from './db/schema.js';
import { waehleMailer } from './mail/index.js';
import { APP_ORIGINS, buildApp } from './http/app.js';
import { appInhaltAusUmgebung, registry } from './games/registry.js';
import { umfangAusUmgebung, umfangZeile } from './umfang.js';
import { appVerknuepfungAusUmgebung } from './http/app-verknuepfung.js';
import { Gateway } from './realtime/gateway.js';
import { PartyRuntime } from './runtime/party.js';
import { Vermittlung } from './suche/vermittlung.js';
import { applyStaffEmails } from './staff.js';
import { aufraeumen } from './diagnose.js';
import { faelligeErinnerungen } from './lernpfad.js';
import { faelligeBrowortErinnerungen } from './browort/dienst.js';
import { statistikSchreiben } from './statistik.js';
import { expireStaleTables } from './tables/service.js';
import { PushAnlaesse } from './push/anlaesse.js';
import { leseAbgeschaltet } from './push/kennungen.js';
import { waehlePushVersand } from './push/versand.js';

const HOUR = 3600_000;
const MINUTE = 60_000;

const here = dirname(fileURLToPath(import.meta.url));
/** dist/src -> packages/server/drizzle */
const MIGRATIONS = resolve(here, '../../drizzle');
/**
 * dist/src -> packages/client/dist
 *
 * Der Server liefert den gebauten Client mit aus. Daraus folgt eine Regel fuer
 * das Deployment: Die Watch Paths des Dienstes duerfen NICHT auf
 * `/packages/server/**` stehen, sonst werden Aenderungen am Client
 * stillschweigend uebersprungen und nie ausgeliefert. Festgelegt ist das in
 * `railway.json` unter `build.watchPatterns`.
 */
const CLIENT_DIR = resolve(here, '../../../client/dist');

async function main(): Promise<void> {
  const config = loadConfig();
  const connection = await connect(config.databaseUrl, config.env);
  const { db } = connection;

  if (config.env !== 'production' || process.env.MIGRATE_ON_BOOT === 'true') {
    await connection.migrate(MIGRATIONS);
  }

  // Der Beta-Zugang laeuft ueber einen gemeinsamen, mehrfach nutzbaren
  // Einladungscode. Ihn aus der Umgebung anzulegen ist idempotent und erspart
  // es, nach jedem Aufsetzen von Hand in die Datenbank zu greifen.
  if (process.env.INVITE_CODE) {
    await db
      .insert(s.inviteCode)
      .values({
        code: process.env.INVITE_CODE,
        maxUses: Number(process.env.INVITE_CODE_MAX_USES ?? 100),
      })
      .onConflictDoNothing();
  }

  // Testkonten aus der Umgebung. Idempotent, und die Variable ist die einzige
  // Wahrheit: Wer heruntergenommen wird, verliert das Merkmal beim naechsten
  // Start. Auf staging steht hier die Liste der Erprober, in der Produktion
  // hoechstens das Demokonto fuer die App-Store-Pruefung.
  const staff = await applyStaffEmails(db, config.staffEmails);
  if (config.staffEmails.length > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `Testkonten: ${staff.gesetzt.length} gesetzt` +
        (staff.entzogen.length > 0 ? `, ${staff.entzogen.length} entzogen` : '') +
        (staff.unbekannt.length > 0
          ? `, ohne Konto: ${staff.unbekannt.join(', ')}`
          : '') +
        // Getrennt gemeldet: Hier fehlt nur der Tipp auf den
        // Bestaetigungslink, kein Konto.
        (staff.unbestaetigt.length > 0
          ? `, E-Mail noch nicht bestaetigt: ${staff.unbestaetigt.join(', ')}`
          : ''),
    );
  }

  // EINE Zeile: welcher Mailer laeuft und warum — "gesetzt/leer/fehlt",
  // nie der Wert. Die alte Warnung sagte bei leerem Wert "fehlt", und im
  // Railway-Dashboard stand die Variable doch da (docs/MAIL.md).
  const { mailer, zeile: mailerZeile } = waehleMailer(
    config.resendApiKey,
    config.mailFrom,
    config.publicUrl,
  );
  // eslint-disable-next-line no-console
  (mailer.art === 'resend' ? console.info : console.warn)(mailerZeile);
  /**
   * Bestaetigung nur verlangen, wenn eine Mail sie auch ueberbringen kann.
   *
   * Ohne Versanddienst kommt in der Produktion kein Link an; eine Pflicht
   * darauf sperrt jeden Neuen aus, und nur wer ins Betriebslog sieht, kommt
   * noch hinein. Lokal bleibt die Pflicht: Dort steht das Log im eigenen
   * Terminal, und der Ablauf soll so geprueft werden, wie er mit Resend
   * laeuft. Das Testkonto-Merkmal haengt weiter an einer BESTAETIGTEN
   * Adresse (staff.ts) — die Lockerung oeffnet dort nichts.
   */
  const bestaetigungPflicht = mailer.art === 'resend' || config.env !== 'production';
  const runtime = new PartyRuntime(db);
  /* Rueckweg fuer die App, Vorgabe AUS (App = Web) — siehe AppInhalt in
     games/registry.ts. Beim Start einmal sagen, wenn er an ist: Sonst sucht
     man spaeter, warum in der App kein Glas mehr steht. */
  const appInhalt = appInhaltAusUmgebung();
  if (appInhalt.trinkmodusAus || appInhalt.haerteMax < 3) {
    // eslint-disable-next-line no-console
    console.log(
      `App-Rueckweg aktiv: Partykiste ${appInhalt.trinkmodusAus ? 'ohne Trinkmodus' : 'mit Trinkmodus'}, Textschaerfe hoechstens ${appInhalt.haerteMax}`,
    );
  }
  /* Was diese Ausgabe anbietet (src/umfang.ts) — ohne UMFANG alles. Immer
     eine Zeile: Fehlt auf der Produktion ein Spiel, ist das die erste Stelle,
     an der man nachsieht, und ein vertippter Name steht gleich mit da. */
  const { umfang, unbekannt: umfangUnbekannt } = umfangAusUmgebung(
    process.env.UMFANG,
    registry.all().map((meta) => meta.id),
  );
  // eslint-disable-next-line no-console
  (umfangUnbekannt.length > 0 ? console.warn : console.info)(umfangZeile(umfang, umfangUnbekannt));
  const vermittlung = new Vermittlung(db, runtime, {
    beiFehler: (gameId, fehler) =>
      // eslint-disable-next-line no-console
      console.error(`Mitspielersuche ${gameId}: kein Tisch zustande gekommen`, fehler),
  });

  /*
   * Push-Mitteilungen (docs/PUSH.md). EINE Startzeile: welcher Sender je
   * Plattform laeuft und welche Anlaesse server-weit aus sind — nie ein Wert.
   * Ohne APNS_* bzw. FCM_SERVICE_ACCOUNT schreibt der Server nur ins Log.
   */
  const { versand: pushVersand, zeile: pushZeile } = waehlePushVersand();
  const pushAus = leseAbgeschaltet(process.env.PUSH_AUS);
  // eslint-disable-next-line no-console
  console.info(
    pushZeile +
      (pushAus.aus.length > 0 ? `; Anlaesse aus: ${pushAus.aus.join(', ')}` : '') +
      (pushAus.unbekannt.length > 0 ? `; PUSH_AUS unbekannt: ${pushAus.unbekannt.join(', ')}` : ''),
  );
  const push = new PushAnlaesse({ db, versand: pushVersand, aus: pushAus.aus });
  push.beobachte(runtime);

  const app = await buildApp({
    db,
    runtime,
    vermittlung,
    push,
    auth: {
      db,
      mailer,
      publicUrl: config.publicUrl,
      sessionTtlDays: config.sessionTtlDays,
      bestaetigungPflicht,
    },
    cookieSecure: config.cookieSecure,
    sessionTtlDays: config.sessionTtlDays,
    stage: config.stage,
    diagnoseSchluessel: config.diagnoseSchluessel,
    herkunftSchluessel: config.herkunftSchluessel,
    googleClientId: config.googleClientId,
    appInhalt,
    umfang,
    appVerknuepfung: appVerknuepfungAusUmgebung(),
    appleClientId: config.appleClientId,
    appleAppId: config.appleAppId,
    appleRedirectUri: config.appleRedirectUri,
    appleDomainVerknuepfung: config.appleDomainVerknuepfung,
    feedbackZielUrl: config.feedbackZielUrl,
    feedbackZielToken: config.feedbackZielToken,
    // In der Entwicklung liefert Vite den Client aus, dann gibt es hier nichts
    // auszuliefern und der Server bleibt reine API.
    clientDir: existsSync(CLIENT_DIR) ? CLIENT_DIR : undefined,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  const gateway = new Gateway(app.server, db, runtime, {
    /**
     * In der Entwicklung keine Herkunftspruefung (leer = aus, wie in den
     * Tests): Zum Testen des Netzspiels sitzen zwei Konten im selben Browser,
     * getrennt ueber zwei Urspruenge (localhost und app.localhost) — mit
     * fester Liste kaeme der zweite nie an den Tisch.
     */
    allowedOrigins:
      config.env === 'development' ? [] : [config.publicUrl, ...APP_ORIGINS],
    appOrigins: APP_ORIGINS,
    appInhalt,
    push,
  });
  push.setzeVordergrund((accountId) => gateway.imVordergrund(accountId));

  // Tische ohne Aktivitaet verfallen nach 24 Stunden; Feldherr-Mitschnitte
  // nach zwei Wochen (docs/FELDHERR-DIAGNOSE.md). Beides im selben Takt: Es
  // ist dieselbe Art Aufraeumen, und ein zweiter Timer waere nur ein
  // zweiter Ort, an dem man ihn vergessen kann.
  //
  // Fehler per console.error wie im 500er-Weg (http/app.ts): `app.log` ist
  // bei `logger: false` stumm, und ein Aufraeumen, das stundenlang scheitert,
  // fiel so niemandem auf.
  const sweeper = setInterval(() => {
    // eslint-disable-next-line no-console
    void expireStaleTables(db).catch((err) => console.error('Aufraeumen (Tische):', err));
    // eslint-disable-next-line no-console
    void aufraeumen(db).catch((err) => console.error('Aufraeumen (Feldherr-Diagnose):', err));
  }, HOUR);

  // Abend-Erinnerung an die Lernserie (lernpfad.ts). Eigener, kurzer Takt:
  // Im Stundentakt des Aufraeumens kaeme sie je nach Startzeit erst um kurz
  // vor acht. Wer schon erinnert wurde, steht in `erinnert_tag` — ein
  // Neustart schickt also nichts doppelt. Fehler wie beim Aufraeumen per
  // console.error — `app.log` schweigt hier ebenso.
  const serienWecker = setInterval(() => {
    void faelligeErinnerungen(db)
      .then((konten) => push.serieErinnern(konten))
      // eslint-disable-next-line no-console
      .catch((err) => console.error('Erinnerung (Lernserie):', err));
    // Browort im selben Takt und nach derselben Regel (browort/dienst.ts).
    void faelligeBrowortErinnerungen(db)
      .then((konten) => push.browortErinnern(konten))
      // eslint-disable-next-line no-console
      .catch((err) => console.error('Erinnerung (Browort):', err));
  }, 15 * MINUTE);

  // Tagesstatistik (statistik.ts): Gezaehlt wird im Speicher, abgelegt im
  // Minutentakt. Ein Absturz kostet so hoechstens eine Minute Zaehlung.
  const statistikTakt = setInterval(() => void statistikSchreiben(db), MINUTE);

  const stop = async (): Promise<void> => {
    clearInterval(sweeper);
    clearInterval(serienWecker);
    clearInterval(statistikTakt);
    runtime.shutdown();
    pushVersand.schliessen();
    await app.close();
    // Nach `app.close`, damit auch die letzten Anfragen noch mitzaehlen, und
    // vor der Datenbank. Wirft nie, haelt das Herunterfahren also nicht auf.
    await statistikSchreiben(db);
    await connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());

  // eslint-disable-next-line no-console
  console.info(`Brauweg laeuft auf Port ${config.port}`);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Serverstart fehlgeschlagen:', err);
  process.exit(1);
});
