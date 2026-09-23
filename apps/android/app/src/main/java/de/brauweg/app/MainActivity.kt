package de.brauweg.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Die ganze Android-Huelle: ein WebView mit dem gebuendelten Client.
 *
 * Vorbild ist die iOS-Huelle (docs/APPSTORE.md): Client aus dem Paket, der
 * Server im Netz, Anmeldung per Token. Keine zweite Oberflaeche.
 */
class MainActivity : ComponentActivity() {

    private lateinit var ansicht: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        /*
         * Ab targetSdk 35 zeichnet Android randlos, abwaehlen geht nicht mehr.
         * Statt den Client die Raender rechnen zu lassen (env(safe-area-inset-*)
         * liefert in aelteren WebViews 0), bekommt die Ansicht die Raender als
         * Innenabstand — dahinter liegt das Brauweg-Blau des Fensters, und die
         * Symbole der Leisten stehen hell darauf.
         */
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        val lader = WebViewAssetLoader.Builder()
            .setDomain(Huelle.HOST)
            .addPathHandler("/", PaketLader(this))
            .build()

        ansicht = WebView(this).apply {
            setBackgroundColor(0xFF1A3F7A.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // Kein Zugriff auf Dateien des Geraets: Der Client kommt ueber den
            // Lader, nicht ueber file://.
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            // target="_blank" oeffnet im selben Fenster statt gar nicht.
            settings.setSupportMultipleWindows(false)
            addJavascriptInterface(Bruecke(this@MainActivity), "BrauwegNativ")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = lader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val ziel = request.url
                    if (ziel.host == Huelle.HOST) return false
                    // Ein Einladungslink innerhalb der App bleibt in der App.
                    Huelle.pfadFuerLink(ziel)?.let {
                        view.loadUrl(Huelle.HERKUNFT + it)
                        return true
                    }
                    // Alles Fremde im Browser: Der WebView soll nie eine fremde
                    // Seite tragen, die dann die Bruecke saehe.
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, ziel))
                    } catch (_: ActivityNotFoundException) {
                        // Kein Browser installiert — dann eben nicht.
                    }
                    return true
                }
            }
        }
        ViewCompat.setOnApplyWindowInsetsListener(ansicht) { v, insets ->
            val r = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            v.setPadding(r.left, r.top, r.right, r.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(ansicht)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (ansicht.canGoBack()) ansicht.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            ansicht.restoreState(savedInstanceState)
        } else {
            ansicht.loadUrl(Huelle.HERKUNFT + (Huelle.pfadFuerLink(intent?.data) ?: "/"))
        }
    }

    /**
     * Ein Einladungslink, waehrend die App schon laeuft (launchMode
     * singleTask). Der Client liest den Code beim Start aus der Adresse — also
     * wird die Adresse neu geladen. Die Sitzung liegt im localStorage und
     * ueberlebt das.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Huelle.pfadFuerLink(intent.data)?.let { ansicht.loadUrl(Huelle.HERKUNFT + it) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        ansicht.saveState(outState)
    }
}
