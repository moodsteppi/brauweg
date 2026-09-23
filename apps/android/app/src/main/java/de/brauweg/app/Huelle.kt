package de.brauweg.app

import android.net.Uri

/**
 * Was die Huelle ueber sich weiss — an einer Stelle, wie `Huelle.swift` in
 * der iOS-Huelle.
 *
 * Der Client liegt im App-Paket (assets/web, siehe werkzeug/web-uebernehmen.mjs)
 * und wird unter [HERKUNFT] ausgeliefert. Dass es genau diese Adresse ist,
 * hat einen Grund, der im Server steht (`APP_ORIGIN_ANDROID` in
 * packages/server/src/http/app.ts): Nur an diese Herkunft und an
 * `brauweg://app` gibt der Server das Sitzungstoken heraus.
 */
object Huelle {
    const val HERKUNFT = "https://appassets.androidplatform.net"
    const val HOST = "appassets.androidplatform.net"

    /** Wo der Server steht. Debug: Staging, Release: Produktion (app/build.gradle.kts). */
    val apiBasis: String = BuildConfig.API_BASE.trimEnd('/')

    /** Der Host, unter dem die Einladungslinks stehen. */
    const val LINK_HOST = "www.brauweg-spielen.de"

    private val BEITRITT = Regex("^/beitritt/([A-Za-z0-9-]{4,24})/?$")

    /**
     * Welcher Pfad der Huelle zu einem geoeffneten Link gehoert, oder null.
     *
     * Nur `/beitritt/<CODE>`: Der Client liest ihn beim Start selbst
     * (einladungslink.ts) — hier wird er nur von der Webadresse in die der
     * Huelle umgesetzt. Alles andere oeffnet die App ganz normal.
     */
    fun pfadFuerLink(link: Uri?): String? {
        if (link == null || link.scheme != "https" || link.host != LINK_HOST) return null
        return pfadFuerPfad(link.path)
    }

    /** Der reine Pfadteil von [pfadFuerLink] — ohne Android, also pruefbar. */
    fun pfadFuerPfad(pfad: String?): String? {
        val code = BEITRITT.find(pfad ?: return null)?.groupValues?.get(1) ?: return null
        return "/beitritt/$code"
    }

    /**
     * Was dem Client vor seiner ersten Zeile eingespritzt wird.
     *
     * `window.BRAUWEG_APP` ist die Absprache mit `laufzeit.ts`: Steht es da,
     * spricht der Client den Server unter `apiBase` an und traegt sein Token
     * selbst. Dazu zwei Nachbauten fuer Web-Schnittstellen, die der
     * Android-WebView nicht kennt — Teilen und Wach-Halten — ueber
     * [Bruecke]. Wo der WebView sie doch kennt, bleibt seine eigene.
     */
    fun vorspann(): String = listOf(
        "<script>",
        "window.BRAUWEG_APP = { apiBase: ${jsText(apiBasis)} };",
        "(function () {",
        "  var b = window.BrauwegNativ;",
        "  if (!b) return;",
        "  if (typeof navigator.share !== 'function') {",
        "    navigator.share = function (d) { b.teilen(JSON.stringify(d || {})); return Promise.resolve(); };",
        "  }",
        "  if (!('wakeLock' in navigator)) {",
        "    navigator.wakeLock = { request: function () {",
        "      b.wachHalten(true);",
        "      var s = { released: false, release: function () { s.released = true; b.wachHalten(false); return Promise.resolve(); } };",
        "      return Promise.resolve(s);",
        "    } };",
        "  }",
        "})();",
        "</script>",
    ).joinToString("\n")

    private fun jsText(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
}
