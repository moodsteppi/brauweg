/**
 * Der Ladekreis — ein ruhiger drehender Ring, überall derselbe.
 *
 * Löst das plumpe „Wird geladen…" ab, das an einem Dutzend Stellen als nackter
 * Text stand. Eine Stelle, ein Aussehen: Ändert sich der Ladeindikator, ändert
 * er sich überall. Denselben Ring zeigen die Tische schon beim Öffnen.
 */
export function Ladekreis({ text }: { text?: string }): React.JSX.Element {
  return (
    <div className="ladekreis" role="status">
      <span className="ladekreis-ring" aria-hidden="true" />
      <span className="ladekreis-text muted">{text ?? 'Wird geladen…'}</span>
    </div>
  );
}
