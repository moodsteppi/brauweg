import UIKit

/// Wie stark ein Puls sich anfuehlt.
enum Staerke: Equatable {
    /// Ein Ticken wie am Drehrad — fuer `vibrate(4)` am Poker-Regler.
    case tick
    case leicht
    /// "Du bist dran" (useTischwache: `[120, 80, 120]`).
    case stark
}

/// Ein Puls, `nach` Sekunden nach dem Aufruf.
struct Puls: Equatable {
    let nach: TimeInterval
    let staerke: Staerke
}

/// `navigator.vibrate` auf dem iPhone.
///
/// WebKit kennt `vibrate` nicht, und ein iPhone hat keinen Motor, den man
/// Millisekunden lang laufen laesst — nur die Taptic Engine mit kurzen,
/// festen Anschlaegen. Das Muster der Vibration-API (an, aus, an, …) wird
/// deshalb in Anschlaege uebersetzt: je Einschaltphase einer, zu ihrem
/// Beginn, stark oder leicht nach ihrer Laenge.
final class Haptik {

    /// Obergrenzen: Ein Muster aus dem Web soll das Handy nicht minutenlang
    /// beschaeftigen koennen.
    static let hoechstensPulse = 10
    static let hoechstensSekunden: TimeInterval = 5

    /// Die Anschlaege zu einem Wert, wie er aus `postMessage` kommt: eine Zahl
    /// oder eine Liste von Zahlen (NSNumber). `0`, `[]` und Unsinn heissen:
    /// nichts (bei der Vibration-API bricht `vibrate(0)` ab).
    static func pulse(aus wert: Any?) -> [Puls] {
        let muster: [Double]
        if let zahl = wert as? NSNumber {
            muster = [zahl.doubleValue]
        } else if let liste = wert as? [Any] {
            muster = liste.compactMap { ($0 as? NSNumber)?.doubleValue }
        } else {
            return []
        }
        var ergebnis: [Puls] = []
        var zeitMs: Double = 0
        for (stelle, roh) in muster.enumerated() {
            if zeitMs / 1000 > hoechstensSekunden || ergebnis.count >= hoechstensPulse { break }
            let dauer = roh.isFinite ? max(0, roh) : 0
            if stelle % 2 == 0 && dauer > 0 {
                ergebnis.append(Puls(nach: zeitMs / 1000, staerke: staerke(fuerMs: dauer)))
            }
            zeitMs += dauer
        }
        return ergebnis
    }

    static func staerke(fuerMs dauer: Double) -> Staerke {
        if dauer <= 20 { return .tick }
        if dauer < 60 { return .leicht }
        return .stark
    }

    // MARK: - Abspielen

    /// Zaehlt Muster hoch: Ein neues Muster (oder `stoppen`) verwirft die
    /// noch ausstehenden Anschlaege des alten, wie ein neuer `vibrate`-Aufruf.
    private var lauf = 0

    func spielen(_ pulse: [Puls]) {
        lauf += 1
        let dieser = lauf
        for puls in pulse {
            if puls.nach <= 0 {
                anschlagen(puls.staerke)
                continue
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + puls.nach) { [weak self] in
                guard let self, self.lauf == dieser else { return }
                self.anschlagen(puls.staerke)
            }
        }
    }

    func stoppen() {
        lauf += 1
    }

    private func anschlagen(_ staerke: Staerke) {
        switch staerke {
        case .tick:
            UISelectionFeedbackGenerator().selectionChanged()
        case .leicht:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .stark:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }
}
