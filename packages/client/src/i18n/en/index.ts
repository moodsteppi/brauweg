/**
 * Das englische Wörterbuch: jede Datei dieses Ordners ein Bereich, derselbe
 * Name wie in `de/`.
 *
 * Noch lückenhaft — mit Absicht. Ein Bereich wird hier erst angelegt, wenn er
 * vollständig ist: Gibt es `en/<bereich>.ts`, hält die Probe (`i18n.test.ts`)
 * sie Schlüssel für Schlüssel gegen `de/<bereich>.ts`. Fehlt die Datei, gilt
 * der Bereich als offen; `t()` zeigt dort Deutsch. Wer welchen Bereich
 * übersetzt, steht in der Tabelle in `de/index.ts`.
 *
 * Hier wird nichts eingetragen: Die Dateien sammelt `import.meta.glob` selbst
 * ein (Begründung in `../bereiche.ts`).
 */
import { bereicheAus } from '../bereiche';

export const en = bereicheAus(
  import.meta.glob(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true }),
);
