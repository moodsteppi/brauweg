package de.brauweg.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Die ganze Android-Huelle: ein WebView mit dem gebuendelten Client.
 *
 * Vorbild ist die iOS-Huelle (docs/APPSTORE.md): Client aus dem Paket, der
 * Server im Netz, Anmeldung per Token. Keine zweite Oberflaeche — mit einer
 * Ausnahme, der Meldung ohne Netz (siehe [zeigeOffline]).
 */
class MainActivity : ComponentActivity() {

    private lateinit var ansicht: WebView
    private lateinit var offlineSchild: View

    private val netz by lazy { getSystemService(ConnectivityManager::class.java) }
    private val takt = Handler(Looper.getMainLooper())

    /**
     * Lief der Client ohne Netz an? Dann hat sein erster Abruf (`api.me()`)
     * nichts bekommen, und er zeigt den Anmeldeschirm, obwohl ein Token da
     * ist. Kommt das Netz zurueck, wird deshalb neu geladen. Geht das Netz
     * dagegen MITTEN im Spiel weg, bleibt die Seite stehen: Der Client baut
     * seine Verbindung selbst neu auf, und ein Neuladen wuerfe nur die
     * Ansicht zurueck.
     */
    private var ohneNetzGeladen = false

    /** Das zuletzt von Firebase geholte Token (nur mit Push an). */
    private var pushToken: String? = null

    private val erlaubnisFrage =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { pushHolen() }

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
            setBackgroundColor(BLAU)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // Kein Zugriff auf Dateien des Geraets: Der Client kommt ueber den
            // Lader, nicht ueber file://.
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            // target="_blank" oeffnet im selben Fenster statt gar nicht.
            settings.setSupportMultipleWindows(false)
            addJavascriptInterface(Bruecke(this@MainActivity) { pushErlauben() }, "BrauwegNativ")
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

                override fun onPageFinished(view: WebView, url: String) {
                    // Nach jedem Laden neu melden: Ein Neuladen (Einladungslink,
                    // Netz zurueck) wirft das window-Objekt samt Token weg.
                    tokenMelden()
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    // Der Client selbst kommt aus dem Paket und scheitert nicht
                    // am Netz. Scheitert trotzdem die Seite als Ganzes, lieber die
                    // Meldung als ein weisser Schirm.
                    if (request.isForMainFrame) {
                        ohneNetzGeladen = true
                        zeigeOffline(true)
                    }
                }
            }
        }

        offlineSchild = baueOfflineSchild()
        val wurzel = FrameLayout(this).apply {
            setBackgroundColor(BLAU)
            addView(ansicht, FrameLayout.LayoutParams(MATCH, MATCH))
            addView(offlineSchild, FrameLayout.LayoutParams(MATCH, MATCH))
        }
        ViewCompat.setOnApplyWindowInsetsListener(wurzel) { v, insets ->
            val r = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            v.setPadding(r.left, r.top, r.right, r.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(wurzel)

        /*
         * Die Zurueck-Taste.
         *
         * Der Client blaettert nicht ueber den Verlauf des WebViews — seine
         * Schirme sind Zustand in App.tsx, `canGoBack()` ist fast nie wahr.
         * Deshalb zuerst der Client: Er bekommt `brauweg:zurueck` und sagt mit
         * `preventDefault()`, dass er zurueckgeblaettert hat (zuruecktaste.ts).
         * Sonst der Verlauf des WebViews, und zuletzt tritt die App in den
         * Hintergrund, statt sich zu beenden: So bricht ein Tipp daneben keine
         * laufende Partie ab — die App ist beim naechsten Oeffnen genau da,
         * wo sie war. Genau so verhaelt sich Android 12+ auch von selbst bei
         * einer Start-Activity ohne eigenen Rueckruf.
         */
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                ansicht.evaluateJavascript(Huelle.ZURUECK_SKRIPT) { ergebnis ->
                    when {
                        ergebnis == "true" -> Unit
                        ansicht.canGoBack() -> ansicht.goBack()
                        else -> moveTaskToBack(true)
                    }
                }
            }
        })

        if (!online()) {
            ohneNetzGeladen = true
            zeigeOffline(true)
        }

        if (savedInstanceState != null) {
            ansicht.restoreState(savedInstanceState)
        } else {
            ansicht.loadUrl(Huelle.HERKUNFT + (Huelle.pfadFuerLink(intent?.data) ?: "/"))
        }

        // Das Token braucht keine Erlaubnis — nur das Anzeigen einer
        // Benachrichtigung (Android 13+). Um die bittet erst der Client.
        if (PushQuelle.AKTIV) pushHolen()
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

    override fun onStart() {
        super.onStart()
        netz.registerDefaultNetworkCallback(netzWache)
        // Im Hintergrund hoert niemand zu — ging das Netz dort weg, sagt es
        // kein Rueckruf mehr.
        if (!online()) zeigeOffline(true)
    }

    override fun onStop() {
        super.onStop()
        runCatching { netz.unregisterNetworkCallback(netzWache) }
        takt.removeCallbacks(nachsehen)
    }

    // ---- Ohne Netz ---------------------------------------------------------

    private fun online(): Boolean {
        val n = netz.activeNetwork ?: return false
        return netz.getNetworkCapabilities(n)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    private val netzWache = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            takt.post { netzZurueck() }
        }

        override fun onLost(network: Network) {
            // Nicht sofort: Beim Wechsel WLAN → Mobilfunk ist das Netz fuer
            // einen Moment weg, und die Meldung soll nicht aufblitzen.
            takt.removeCallbacks(nachsehen)
            takt.postDelayed(nachsehen, GNADENFRIST_MS)
        }
    }

    private val nachsehen = Runnable { if (!online()) zeigeOffline(true) }

    private fun netzZurueck() {
        takt.removeCallbacks(nachsehen)
        if (offlineSchild.visibility != View.VISIBLE) return
        zeigeOffline(false)
        if (ohneNetzGeladen) {
            ohneNetzGeladen = false
            ansicht.reload()
        }
    }

    /**
     * Die Meldung ohne Netz — nativ, weil ohne Server nichts im Client
     * funktioniert, was sie anzeigen koennte: Er startete sonst auf dem
     * Anmeldeschirm (erster Abruf gescheitert) oder zeigte einen Tisch, an
     * dem nichts passiert. Das Schild liegt ueber dem WebView und faengt die
     * Beruehrungen ab; darunter bleibt alles stehen.
     */
    private fun zeigeOffline(an: Boolean) {
        offlineSchild.visibility = if (an) View.VISIBLE else View.GONE
    }

    private fun baueOfflineSchild(): View {
        fun dp(wert: Int): Int =
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, wert.toFloat(), resources.displayMetrics).toInt()

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(BLAU)
            setPadding(dp(32), dp(32), dp(32), dp(32))
            isClickable = true
            isFocusable = true
            visibility = View.GONE
            addView(TextView(context).apply {
                setText(R.string.offline_titel)
                setTextColor(WEISS)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                gravity = Gravity.CENTER
            })
            addView(TextView(context).apply {
                setText(R.string.offline_text)
                setTextColor(WEISS)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                gravity = Gravity.CENTER
                setPadding(0, dp(12), 0, dp(24))
            })
            addView(
                Button(context).apply {
                    setText(R.string.offline_nochmal)
                    setOnClickListener {
                        if (online()) {
                            zeigeOffline(false)
                            ohneNetzGeladen = false
                            ansicht.reload()
                        }
                    }
                },
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT),
            )
        }
    }

    // ---- Push (nur mit -Ppush=an, siehe PushQuelle) -------------------------

    private fun pushErlauben() {
        if (!PushQuelle.AKTIV) return
        val gefragt = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        if (gefragt) erlaubnisFrage.launch(Manifest.permission.POST_NOTIFICATIONS) else pushHolen()
    }

    private fun pushHolen() {
        PushQuelle.tokenHolen(this) { token ->
            runOnUiThread {
                pushToken = token
                tokenMelden()
            }
        }
    }

    private fun tokenMelden() {
        val token = pushToken ?: return
        ansicht.evaluateJavascript(Huelle.pushTokenSkript(token), null)
    }

    private companion object {
        val BLAU = 0xFF1A3F7A.toInt()
        val WEISS = 0xFFFFFFFF.toInt()
        const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        const val GNADENFRIST_MS = 2000L
    }
}
