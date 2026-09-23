import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * Signierschluessel fuer Release-Builds: NIE im Repo. Liegt er als
 * `keystore.properties` neben dieser Datei (in .gitignore), wird damit
 * signiert; sonst entsteht ein unsigniertes Bundle, das Play nicht annimmt.
 * Anleitung: docs/APP-RELEASE.md, Abschnitt Android.
 */
val schluessel = Properties().apply {
    val datei = rootProject.file("keystore.properties")
    if (datei.exists()) datei.inputStream().use { load(it) }
}

/** Serveradresse je Build; mit -PapiBase=… ueberschreibbar (etwa fuer Staging). */
fun apiBase(vorgabe: String): String = (project.findProperty("apiBase") as String?) ?: vorgabe

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
        versionName = "1.0"
    }

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
    testImplementation("junit:junit:4.13.2")
}
