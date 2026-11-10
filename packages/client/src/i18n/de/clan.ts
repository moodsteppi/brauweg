import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „clan": Clanhalle, Suche, Gründen, Chat und Krieg
 * (`Clan.tsx`, `ClanChat.tsx`, `ClanKrieg.tsx`, `ClanTeile.ts`).
 *
 * `<b>…</b>` in einem Text ist Fettschrift, die `mitFett` aus `ClanTeile.ts`
 * zeichnet — so bleibt der Satz ganz, auch wenn ein Teil davon fett steht.
 */
export default {
  // Rangstufen; die Kennungen dahinter bleiben englisch wie im Schema.
  'clan.rolle.admin': 'Anführer',
  'clan.rolle.vize': 'Vizeanführer',
  'clan.rolle.elder': 'Ältester',
  'clan.rolle.member': 'Mitglied',
  'clan.rolle.guest': 'Gast',
  'clan.rang.hinweis.leitung': 'Darf alles',
  'clan.rang.hinweis.elder': 'Auszeichnung, keine Rechte',

  'clan.fehler.alreadyInClub': 'Du bist schon in einem Clan. Tritt erst aus.',
  'clan.fehler.clubNameTaken': 'Diesen Namen gibt es schon.',
  'clan.fehler.clubNameLength': 'Der Name braucht 3 bis 24 Zeichen.',
  'clan.fehler.clubMottoLength': 'Der Spruch ist zu lang.',
  'clan.fehler.clubFull': 'Der Clan ist voll.',
  'clan.fehler.clubTrophiesTooLow': 'Dafür fehlen dir noch Trophäen.',
  'clan.fehler.notClubAdmin': 'Das darf nur der Admin.',
  'clan.fehler.lastAdmin': 'Das ist der letzte Admin. Der Clan braucht mindestens einen.',
  'clan.fehler.cannotChangeOwnRole': 'Die eigene Rolle kann man nicht ändern. Lass es einen anderen Admin tun.',
  'clan.fehler.cannotKickSelf': 'Dich selbst wirfst du nicht raus. Dafür gibt es „Clan verlassen“.',
  'clan.fehler.sonst': 'Hat nicht geklappt. Versuch es nochmal.',

  'clan.bald': 'Bald',
  'clan.laden': 'Wird geladen…',
  'clan.zurueck': 'Zurück',
  'clan.zurueckPfeil': '← Zurück',
  'clan.abbrechen': 'Abbrechen',
  'clan.fertig': 'Fertig',
  'clan.speichern': 'Speichern',

  // Halle
  'clan.icon.chat': 'Chat',
  'clan.icon.truhe': 'Truhe',
  'clan.icon.krieg': 'Krieg',
  'clan.icon.clan': 'Clan',
  'clan.anfragen': 'Anfragen',
  'clan.anfragen.offen': 'Anfragen, {n} offen',
  'clan.truhe': 'Clantruhe',
  'clan.truhe.text': 'Gemeinsam füllen, gemeinsam öffnen',
  'clan.mottoLeer': 'Für alle Spiele',
  'clan.motto.zitat': '„{motto}"',
  'clan.mitglieder': 'Mitglieder',
  'clan.verlassen': 'Clan verlassen',
  'clan.verlassen.frage': 'Den Clan „{name}" wirklich verlassen?',
  'clan.verlassen.titel': '„{name}“ verlassen?',
  'clan.verlassen.text': 'Du kannst danach einem anderen Clan beitreten oder selbst einen gründen.',
  'clan.chatAria': 'Clanchat',
  'clan.einstellungenAria': 'Clanregeln und Einstellungen',
  'clan.kz.offen': 'offen',
  'clan.kz.aufAnfrage': 'auf Anfrage',
  'clan.kz.ohneSchwelle': 'ohne Schwelle',
  'clan.kz.clanTrophaeen': 'Clan-Trophäen',
  'clan.abTrophaeen': 'ab {n} Trophäen',
  'clan.ab': 'ab {n}',

  // Clankrieg-Block in der Halle
  'clan.krieg.restUndZaehlen': 'noch {n} h · alle Spiele zählen',
  'clan.krieg.alleZaehlen': 'alle Spiele zählen',
  'clan.krieg.suche': 'Gegner wird gesucht',
  'clan.krieg.angefragt': 'Herausforderung offen',
  'clan.krieg.einstieg': '48 Stunden, alle Spiele zählen',
  'clan.krieg.wir': 'Wir',
  'clan.krieg.regel': 'Platz 1 = 3 Punkte, Platz 2 = 1 · je Mitglied bis 10 Partien',
  'clan.krieg.letzter.wir': 'Letzter Krieg: gewonnen',
  'clan.krieg.letzter.gegner': 'Letzter Krieg: verloren',
  'clan.krieg.letzter.gleich': 'Letzter Krieg: unentschieden',
  'clan.krieg.keiner': 'Gerade läuft kein Krieg.',
  'clan.krieg.starten': 'Krieg starten',
  'clan.krieg.ansehen': 'Ansehen',
  'clan.clanwort.text': 'Ein Mitglied wählt, alle raten - heute',

  // Mitglied
  'clan.mitglied.zeile': '{rolle} · {trophaeen} Trophäen',
  'clan.profilAnsehen': 'Profil ansehen',
  'clan.rang': 'Rang',
  'clan.befoerdern.frage': '{name} zum {rang} machen?',
  'clan.befoerdern.leitung': 'Damit darf er aufnehmen, rauswerfen und die Clanregeln ändern.',
  'clan.befoerdern.ja': 'Zum {rang} machen',
  'clan.rauswerfen': 'Rauswerfen',
  'clan.rauswerfen.frage': '{name} aus dem Clan werfen?',

  // Anfragen
  'clan.anfragen.leer': 'Gerade will niemand rein.',
  'clan.aufnehmen': 'Aufnehmen',
  'clan.aufnehmen.aria': '{name} aufnehmen',
  'clan.nein': 'Nein',
  'clan.ablehnen.aria': '{name} ablehnen',

  // Einstellungen
  'clan.regeln': 'Clanregeln',
  'clan.einstellungen': 'Einstellungen',
  'clan.nurLeitung': 'Ändern dürfen das nur Anführer und Vize.',

  // Suche
  'clan.clans': 'Clans',
  'clan.suche.untertitel': 'Such dir einen Clan - oder gründe deinen eigenen.',
  'clan.suche.platzhalter': 'Clan suchen…',
  'clan.suche.aria': 'Clan suchen',
  'clan.suche.keinTreffer': 'Kein Clan mit diesem Namen.',
  'clan.suche.leer': 'Noch kein Clan da. Gründe den ersten.',
  'clan.beitritt.offen': 'Offen',
  'clan.beitritt.aufAnfrage': 'Auf Anfrage',
  'clan.angefragt': 'Angefragt',
  'clan.zuruecknehmen': 'Zurücknehmen',
  'clan.zuruecknehmen.aria': 'Anfrage an {name} zurücknehmen',
  'clan.beitreten': 'Beitreten',
  'clan.beitreten.aria': '{name}: beitreten',
  'clan.beitrittAnfragen': 'Anfragen',
  'clan.beitrittAnfragen.aria': '{name}: Beitritt anfragen',

  // Gründen und Felder
  'clan.gruenden': 'Clan gründen',
  'clan.gruenden.zurueckAria': 'Zurück zur Clansuche',
  'clan.gruenden.vorschau': 'Name, Wahlspruch und Wappen',
  'clan.gruenden.laeuft': 'Wird gegründet…',
  'clan.gruenden.knopf': 'Gründen',
  'clan.feld.name': 'Name',
  'clan.feld.nameBeispiel': 'Kegelclub Nord',
  'clan.feld.nameHinweis': '3 bis 24 Zeichen',
  'clan.feld.wahlspruch': 'Wahlspruch',
  'clan.feld.spruch': 'Spruch',
  'clan.feld.optional': 'Optional',
  'clan.feld.wappen': 'Wappen',
  'clan.feld.beitritt': 'Beitritt',
  'clan.feld.abTrophaeen': 'Ab Trophäen',
  'clan.feld.schwelleHinweis': '0 heißt: keine Schwelle',
  'clan.wappen.imShop': 'Im Shop erhältlich',
  'clan.wappen.imShopHinweis': 'Dieses Wappen gibt es im Shop unter „Clanwappen".',
  'clan.wappen.aria': 'Wappen {n}',
  'clan.wappen.ariaShop': 'Wappen {n}, im Shop erhältlich',

  // Chat
  'clanchat.titel': 'Clanchat',
  'clanchat.fehler.laden': 'Der Chat ließ sich nicht laden.',
  'clanchat.fehler.senden': 'Die Nachricht ging nicht raus. Nochmal?',
  'clanchat.fehler.loeschen': 'Löschen hat nicht geklappt.',
  'clanchat.loeschen.frage': 'Diese Nachricht löschen?',
  'clanchat.leer': 'Noch nichts gesagt. Fang an - die anderen sehen es sofort.',
  'clanchat.platzhalter': 'Nachricht an den Clan…',
  'clanchat.nachricht': 'Nachricht',
  'clanchat.senden': 'Senden',
  'clanchat.geloescht': 'Nachricht gelöscht',
  'clanchat.loeschen.aria': 'Nachricht löschen',
} satisfies Woerterbuch;
