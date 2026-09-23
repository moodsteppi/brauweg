import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * Signierschluessel fuer Release-Builds: NIE im Repo. Liegt er als
 * `keystore.properties` neben dieser Datei (in .gitignore), wird damit
 * signiert; sonst entsteht ein unsigniertes Bundle, das Play nicht annimmt.
 * In der CI schreibt der Workflow „Android-APK" diese Datei aus den
 * GitHub-Secrets `ANDROID_UPLOAD_*` und loescht sie danach wieder.
 * Signiert wird mit dem UPLOAD-Schluessel; den eigentlichen App-Schluessel
 * haelt Google (Play App Signing).
 * Anleitung: docs/APP-RELEASE.md, Abschnitt Android.
 */
val schluessel = Properties().apply {
    val datei = rootProject.file("keystore.properties")
    if (datei.exists()) datei.inputStream().use { load(it) }
}

/** Serveradresse je Build; mit -PapiBase=… ueberschreibbar (etwa fuer Staging). */
fun apiBase(vorgabe: String): String = (project.findProperty("apiBase") as String?) ?: vorgabe

/**
 * Die Versionsbezeichnung, die im Store steht, kommt aus `apps/android/VERSION`
 * — eine Zeile, von Hand gepflegt, im Repo nachvollziehbar. Die Nummer, die
 * Play fuer jeden Upload hoeher verlangt (versionCode), setzt dagegen der Bau
 * selbst (-PversionCode=…, in der CI die Laufnummer): Von Hand gezaehlt ginge
 * sie bei zwei Laeufen am selben Tag doppelt raus, und Play lehnt das ab.
 */
val versionsName: String = rootProject.file("VERSION").readText().trim().ifEmpty { "0.0.0" }

/**
 * Push (Firebase Cloud Messaging) — STANDARDMAESSIG AUS.
 *
 * Eingeschaltet mit `-Ppush=an`. Dann kommt Firebase als Abhaengigkeit dazu,
 * und statt `src/pushAus` wird `src/pushAn` uebersetzt. So traegt die
 * gewoehnliche App weder Firebase noch dessen Berechtigung fuer
 * Benachrichtigungen mit sich — das Data-Safety-Formular bleibt ehrlich, und
 * nichts laeuft, wofuer es noch kein Firebase-Projekt gibt.
 *
 * Die vier Werte des Firebase-Projekts kommen als Gradle-Eigenschaften
 * (`-PfirebaseAppId=…` usw.) oder aus `apps/android/firebase.properties`
 * (ignoriert). Eine `google-services.json` samt Plugin braucht es dafuer
 * nicht: Die Huelle meldet Firebase selbst an (pushAn/PushQuelle.kt). Fehlen
 * die Werte, wird trotzdem gebaut — die App holt dann nur kein Token; das
 * haelt den Schalter in der CI uebersetzbar, ohne dass es ein Projekt gibt.
 */
val pushAn: Boolean = (project.findProperty("push") as String?) == "an"
val firebase = Properties().apply {
    val datei = rootProject.file("firebase.properties")
    if (datei.exists()) datei.inputStream().use { load(it) }
}
fun firebaseWert(name: String): String =
    ((project.findProperty(name) as String?) ?: firebase.getProperty(name) ?: "").trim()
if (pushAn && firebaseWert("firebaseAppId").isEmpty()) {
    logger.warn("Push ist an, aber die Firebase-Werte fehlen — die App baut, holt aber kein Token.")
}

android {
    namespace = "de.brauweg.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "de.brauweg.app"
        minSdk = 26
        targetSdk = 36
        // Play verlangt fuer jeden Upload eine hoehere Nummer. Der Bau setzt sie
        // mit -PversionCode=… (siehe docs/APP-RELEASE.md), sonst 1.
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = versionsName

        buildConfigField("boolean", "PUSH", pushAn.toString())
        if (pushAn) {
            for (name in listOf("firebaseAppId", "firebaseApiKey", "firebaseProjektId", "firebaseSenderId")) {
                buildConfigField("String", name.uppercase(), "\"${firebaseWert(name)}\"")
            }
        }
    }

    // Genau eine der beiden Fassungen von PushQuelle.kt wird uebersetzt.
    sourceSets.getByName("main").java.srcDir(if (pushAn) "src/pushAn/java" else "src/pushAus/java")

    signingConfigs {
        if (schluessel.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(schluessel.getProperty("storeFile"))
                storePassword = schluessel.getProperty("storePassword")
                keyAlias = schluessel.getProperty("keyAlias")
                keyPassword = schluessel.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Die Debug-APK spricht mit Staging: Sie geht zum Testen herum,
            // und niemand soll aus Versehen Produktionsdaten anlegen.
            buildConfigField("String", "API_BASE", "\"${apiBase("https://staging.brauweg-spielen.de")}\"")
            applicationIdSuffix = ".debug"
            resValue("string", "app_name", "Brauweg Test")
        }
        release {
            buildConfigField("String", "API_BASE", "\"${apiBase("https://www.brauweg-spielen.de")}\"")
            resValue("string", "app_name", "Brauweg")
            isMinifyEnabled = false
            if (schluessel.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // Der Client liegt unter assets/web. Vorgabe von aapt ignoriert Dateien
        // mit fuehrendem Unterstrich — Vite erzeugt solche (_plugin-vue…) nicht,
        // aber sicher ist sicher: nichts aus dem Buendel verwerfen.
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~"
    }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
    if (pushAn) {
        // Die Messaging-Bibliothek bringt ihre eigenen Manifest-Eintraege mit
        // (Dienst, Empfaenger, POST_NOTIFICATIONS) — sie landen nur in der
        // App, wenn der Schalter an ist.
        implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
        implementation("com.google.firebase:firebase-messaging")
    }
    testImplementation("junit:junit:4.13.2")
}
