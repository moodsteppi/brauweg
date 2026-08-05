/**
 * HTML-Fassung der Mails.
 *
 * Bewusst altmodisch: Tabellen statt Flexbox, Stile direkt am Element
 * statt im Kopf, feste Breite 600 Pixel. Outlook rendert ueber die
 * Word-Engine und kennt weder Flexbox noch Grid noch `<style>` verlaesslich
 * — was hier modern aussaehe, saehe dort kaputt aus.
 *
 * Jede Mail geht in beiden Fassungen hinaus, Text und HTML. Das erwarten
 * Spamfilter ohnehin, und wer reinen Text bevorzugt, bekommt weiter reinen
 * Text.
 */

const RAHMEN = '#12181c';
const PAPIER = '#fbf6ec';
const SCHRIFT = '#241a10';
const LEISE = '#6b5a45';
const GRUEN = '#3f7d5c';

/** HTML-Sonderzeichen entschaerfen. Namen und Adressen kommen von aussen. */
function sicher(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface Vorlage {
  /** Basis fuer Bild- und Linkadressen, ohne Schraegstrich am Ende. */
  readonly publicUrl: string;
  readonly ueberschrift: string;
  /** Absaetze vor dem Knopf. */
  readonly absaetze: readonly string[];
  readonly knopfText: string;
  readonly knopfLink: string;
  /** Kleingedrucktes unter dem Knopf, etwa die Gueltigkeitsdauer. */
  readonly fussnote: string;
}

export function baueHtml(v: Vorlage): string {
  const absaetze = v.absaetze
    .map(
      (a) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${SCHRIFT}">${sicher(a)}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${sicher(v.ueberschrift)}</title></head>
<body style="margin:0;padding:0;background:${RAHMEN}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${RAHMEN}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${PAPIER};border-radius:12px;overflow:hidden">

<tr><td style="padding:0;line-height:0">
<img src="${v.publicUrl}/hub/mail-kopf.jpg" width="600" alt="Brauweg"
 style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>

<tr><td style="padding:26px 28px 8px">
<!-- Die Ueberschrift steht als Text da, nicht nur im Bild: Viele
     Mailprogramme laden Bilder erst nach Bestaetigung, und dann waere
     oben sonst nichts. -->
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:${SCHRIFT};font-family:Georgia,'Times New Roman',serif">${sicher(v.ueberschrift)}</h1>
${absaetze}
</td></tr>

<tr><td align="center" style="padding:6px 28px 4px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${GRUEN}" style="border-radius:8px">
<a href="${v.knopfLink}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${sicher(v.knopfText)}</a>
</td></tr></table></td></tr>

<tr><td style="padding:16px 28px 6px">
<p style="margin:0;font-size:13px;line-height:1.5;color:${LEISE}">${sicher(v.fussnote)}</p></td></tr>

<!-- Der Link auch zum Abtippen: Manche Programme machen aus Knoepfen
     nichts Klickbares, und dann waere die Mail eine Sackgasse. -->
<tr><td style="padding:4px 28px 26px">
<p style="margin:0;font-size:12px;line-height:1.5;color:${LEISE};word-break:break-all">
Falls der Knopf nicht geht:<br>${sicher(v.knopfLink)}</p></td></tr>

</table>
<p style="margin:14px 0 0;font-size:12px;color:#7b8b95;font-family:Arial,sans-serif">Brauweg — spielt nach euren Regeln.</p>
</td></tr></table></body></html>`;
}
