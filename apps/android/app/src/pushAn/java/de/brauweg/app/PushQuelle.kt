package de.brauweg.app

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Push ist AN (`-Ppush=an`, siehe app/build.gradle.kts): das Geraete-Token
 * von Firebase Cloud Messaging.
 *
 * Firebase wird hier von Hand angemeldet statt ueber `google-services.json`
 * und das Gradle-Plugin: Die vier Werte kommen als BuildConfig-Felder, in der
 * CI also als Secrets — keine weitere Datei, die man ins Repo legen oder
 * vergessen kann. Der `FirebaseInitProvider` der Bibliothek findet beim Start
 * keine Werte und tut nichts (eine Warnzeile im Log); angemeldet wird erst hier.
 *
 * Was die App mit dem Token tut, entscheidet sie nicht selbst: [MainActivity]
 * reicht es als Ereignis `brauweg:push-token` an den Client, und der meldet
 * es dem Server. Ein eigener `FirebaseMessagingService` fehlt bewusst — ein
 * neues Token holt die App bei jedem Start, und Benachrichtigungen im
 * Hintergrund zeigt Firebase selbst an. Im Vordergrund faellt eine
 * „du bist dran"-Meldung weg; dort sieht man es ohnehin am Tisch.
 */
object PushQuelle {
    const val AKTIV = true

    fun tokenHolen(context: Context, weiter: (String) -> Unit) {
        if (BuildConfig.FIREBASEAPPID.isEmpty()) {
            Log.w("Brauweg", "Push ist an, aber ohne Firebase-Werte gebaut — kein Token.")
            return
        }
        val app = context.applicationContext
        if (FirebaseApp.getApps(app).isEmpty()) {
            val optionen = FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASEAPPID)
                .setApiKey(BuildConfig.FIREBASEAPIKEY)
                .setProjectId(BuildConfig.FIREBASEPROJEKTID)
                .setGcmSenderId(BuildConfig.FIREBASESENDERID)
                .build()
            FirebaseApp.initializeApp(app, optionen)
        }
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> if (!token.isNullOrBlank()) weiter(token) }
            .addOnFailureListener { Log.w("Brauweg", "Kein Push-Token", it) }
    }
}
