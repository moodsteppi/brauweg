package de.brauweg.app

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException

/**
 * Liefert den gebuendelten Client aus `assets/web` unter [Huelle.HERKUNFT] aus.
 *
 * Zwei Dinge macht er anders als der fertige `AssetsPathHandler`:
 *
 * - **Jeder Pfad ohne Dateiendung ist die index.html.** Genau so macht es der
 *   Server (`setNotFoundHandler` in app.ts): `/beitritt/K7X9MQ`, `/verify`,
 *   `/probe/kampf` sind Adressen des Clients, keine Dateien.
 * - **In die index.html kommt der [Huelle.vorspann]** — vor das erste Skript,
 *   damit `window.BRAUWEG_APP` steht, bevor `laufzeit.ts` es liest.
 */
class PaketLader(private val context: Context) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        val pfad = path.trimStart('/')
        val istDatei = pfad.substringAfterLast('/').contains('.')
        if (!istDatei) return index()
        return try {
            val strom = context.assets.open("web/$pfad")
            WebResourceResponse(typVon(pfad), null, strom)
        } catch (_: FileNotFoundException) {
            // Ehrlich 404 statt der index.html: Ein fehlendes Bild soll nicht
            // als HTML-Seite in einem <img> landen.
            WebResourceResponse(
                "text/plain", "utf-8", 404, "Not Found", emptyMap(),
                ByteArrayInputStream(ByteArray(0)),
            )
        }
    }

    private fun index(): WebResourceResponse {
        val html = try {
            context.assets.open("web/index.html").bufferedReader().use { it.readText() }
        } catch (_: FileNotFoundException) {
            // Wie in der iOS-Huelle: lieber ein Satz als ein weisser Schirm.
            val hinweis = "<meta charset=utf-8><body style='background:#1a3f7a;color:#fff;" +
                "font:16px sans-serif;padding:2em'>Im App-Paket liegt kein Client. Vor dem " +
                "Bauen einmal <code>node apps/android/werkzeug/web-uebernehmen.mjs</code> laufen lassen."
            return WebResourceResponse("text/html", "utf-8", ByteArrayInputStream(hinweis.toByteArray()))
        }
        val mitVorspann = html.replaceFirst("<head>", "<head>\n" + Huelle.vorspann())
        return WebResourceResponse("text/html", "utf-8", ByteArrayInputStream(mitVorspann.toByteArray()))
    }

    private fun typVon(pfad: String): String = when (pfad.substringAfterLast('.').lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json", "map" -> "application/json"
        "webmanifest" -> "application/manifest+json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "ico" -> "image/x-icon"
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "ogg" -> "audio/ogg"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "ttf" -> "font/ttf"
        "wasm" -> "application/wasm"
        "glb" -> "model/gltf-binary"
        "gltf" -> "model/gltf+json"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }
}
