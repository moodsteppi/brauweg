/** Testdaten ohne Netzaufruf. Die Vorlage wurde aus dem Serverkatalog erzeugt. */
import VORLAGE from '../proben/hub/markt-probe.json';
import type { Tagesmarkt, MarktAngebot } from '../api';
export function probeTagesmarkt(): Tagesmarkt {
  return { tag: '2026-10-27', serverZeit: new Date().toISOString(), wechseltAm: new Date(Date.now() + 3600000).toISOString(), gratisMuenzen: { betrag: 25, geholt: false },
    angebote: (VORLAGE as MarktAngebot[]).map(a => ({ ...a, artikel: a.aufgedeckt ? a.artikel : null, preis: a.aufgedeckt ? a.preis : null, normalpreis: a.aufgedeckt ? a.normalpreis : null })) };
}
