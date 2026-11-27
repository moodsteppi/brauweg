import { useState } from "react";
import type { Spiel } from "@brauweg/broremote-kern";
import { BroIcon, type BroSymbol } from "./BroIcon";

export function BroEinstieg({
  spiel,
  eroeffnen,
  beitreten,
  solo,
  netzwerk,
}: {
  spiel: Spiel;
  eroeffnen(): void;
  beitreten(): void;
  solo(): void;
  netzwerk: React.ReactNode;
}): React.JSX.Element {
  const [hilfe, setHilfe] = useState(false);
  const aktionen: {
    titel: string;
    text: string;
    icon: BroSymbol;
    klick(): void;
  }[] = [
    {
      titel: "Lobby eröffnen",
      text: "Dieses Gerät zeigt das Spiel.",
      icon: "bildschirm",
      klick: eroeffnen,
    },
    {
      titel: "Lobby beitreten",
      text: "Dein Handy ist der Controller.",
      icon: "qr",
      klick: beitreten,
    },
    {
      titel: "Solo Play",
      text:
        spiel === "building"
          ? "Playground auf diesem Gerät."
          : "Auf diesem Gerät gegen Bots.",
      icon: "solo",
      klick: solo,
    },
    {
      titel: "Spielanleitung",
      text: "So funktioniert’s.",
      icon: "anleitung",
      klick: () => setHilfe((v) => !v),
    },
  ];
  return (
    <>
      <div className="br-aktionsraster">
        {aktionen.map((a) => (
          <button
            type="button"
            className="br-aktionskarte"
            key={a.titel}
            onClick={a.klick}
            aria-expanded={a.icon === "anleitung" ? hilfe : undefined}
            aria-controls={
              a.icon === "anleitung" ? "br-spielanleitung" : undefined
            }
          >
            <BroIcon name={a.icon} />
            <strong>{a.titel}</strong>
            <span>{a.text}</span>
          </button>
        ))}
      </div>
      {hilfe && (
        <section className="br-anleitung br-panel" id="br-spielanleitung">
          <h2>Zusammen spielen</h2>
          <ol>
            <li>Öffne die Lobby auf einem großen Bildschirm oder iPad.</li>
            <li>
              Alle scannen den QR-Code mit ihrem Handy und wählen einen Namen.
            </li>
            <li>
              Auf den Handys „Ich bin bereit“ tippen. Der Gastgeber startet.
            </li>
          </ol>
          <h3>{spiel === "building" ? "Bro Building Battle" : "BroTanks"}</h3>
          <p>
            {spiel === "building"
              ? "Verschiebe und drehe die Teile. Erreiche 16 Meter und halte deinen Turm drei Sekunden im Ziel. Ein erhaltenes Item setzt du ein, bevor du weiterbaust."
              : "Stelle Winkel und Stärke ein, wähle eine Waffe und feuere. Achte auf den Wind. Fahren und taktische Items helfen dir, deinen Panzer im Spiel zu halten."}
          </p>
          <p className="br-leise">
            Du kannst den Controller hochkant oder quer halten.
          </p>
          <button className="br-link" onClick={() => setHilfe(false)}>
            Anleitung schließen
          </button>
        </section>
      )}
      <details className="br-optionen">
        <summary>Verbindung einstellen</summary>
        {netzwerk}
      </details>
    </>
  );
}
