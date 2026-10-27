package de.brauweg.app

import android.app.Activity
import android.content.Intent
import android.view.WindowManager
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Die Handgriffe, die der Client nativ braucht (siehe
 * [Huelle.vorspann]): Teilen, den Bildschirm anlassen und — nur mit
 * eingeschaltetem Push — um Erlaubnis fuer Benachrichtigungen bitten.
 *
 * Bewusst nur das. Alles, was die Oberflaeche ausmacht, bleibt im Client —
 * eine zweite Oberflaeche in Kotlin waere eine zweite Wahrheit.
 *
 * Nur die eigene Seite sieht diese Schnittstelle: Fremde Adressen oeffnet
 * [MainActivity] im Browser, nie im WebView.
 */
class Bruecke(
    private val activity: Activity,
    private val pushErlaubnis: () -> Unit,
) {

    /** `navigator.share({title, text, url})` — der Teilen-Dialog des Systems. */
    @JavascriptInterface
    fun teilen(daten: String) {
        val d = runCatching { JSONObject(daten) }.getOrElse { JSONObject() }
        val text = listOf(d.optString("text"), d.optString("url"))
            .filter { it.isNotBlank() }
            .joinToString(" ")
        if (text.isBlank()) return
        val titel = d.optString("title").ifBlank { null }
        val senden = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            if (titel != null) putExtra(Intent.EXTRA_SUBJECT, titel)
        }
        activity.runOnUiThread { activity.startActivity(Intent.createChooser(senden, titel)) }
    }

    /**
     * Bildschirm anlassen, solange der Client es will (Partykiste: das Handy
     * liegt auf dem Tisch, useTischwache.ts). Der WebView kennt die Wake-Lock-
     * Schnittstelle nicht; das Fensterflag ist ihr Gegenstueck und gilt nur,
     * solange die App vorne ist.
     */
    @JavascriptInterface
    fun wachHalten(an: Boolean) {
        activity.runOnUiThread {
            if (an) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    /**
     * `BrauwegNativ.pushErlauben()` — der Client bittet um Benachrichtigungen,
     * etwa wenn jemand „Sag mir, wenn ich dran bin" einschaltet. Erst dann
     * fragt Android 13+ den Nutzer; beim Start ungefragt zu fragen, lehnen
     * die meisten ab, und ein zweites Mal fragt das System nicht mehr.
     *
     * Danach (und ohne Frage unter Android 12) kommt das Token als Ereignis
     * `brauweg:push-token`. Mit ausgeschaltetem Push tut der Aufruf nichts.
     */
    @JavascriptInterface
    fun pushErlauben() {
        activity.runOnUiThread { pushErlaubnis() }
    }
}
