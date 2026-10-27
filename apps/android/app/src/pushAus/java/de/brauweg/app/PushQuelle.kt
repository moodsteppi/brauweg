package de.brauweg.app

import android.content.Context

/**
 * Push ist AUS (Vorgabe, siehe `pushAn` in app/build.gradle.kts).
 *
 * Diese Fassung gibt es, damit [MainActivity] ohne Firebase uebersetzt: Die
 * gewoehnliche App traegt weder die Bibliothek noch die Berechtigung fuer
 * Benachrichtigungen. Das Gegenstueck mit Firebase liegt unter `src/pushAn`
 * und muss dieselbe Oberflaeche haben.
 */
object PushQuelle {
    const val AKTIV = false

    @Suppress("UNUSED_PARAMETER")
    fun tokenHolen(context: Context, weiter: (String) -> Unit) {
        // Ohne Push gibt es kein Token.
    }
}
