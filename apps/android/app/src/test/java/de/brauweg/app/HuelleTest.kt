package de.brauweg.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Welche Links die App oeffnet. Nur der Einladungslink (#203) — und genau in
 * der Form, die der Client selbst liest (einladungslink.ts: 4 bis 24 Zeichen
 * aus Buchstaben, Ziffern und Bindestrich).
 */
class HuelleTest {
    @Test
    fun einladungWirdZumPfadDerHuelle() {
        assertEquals("/beitritt/K7X9MQ", Huelle.pfadFuerPfad("/beitritt/K7X9MQ"))
        assertEquals("/beitritt/k7x-9mq", Huelle.pfadFuerPfad("/beitritt/k7x-9mq/"))
    }

    @Test
    fun allesAndereBleibtAussen() {
        for (pfad in listOf(null, "/", "/beitritt/", "/beitritt/ab", "/beitritt/K7X9MQ/mehr", "/verify", "/beitritt/<x>")) {
            assertNull(pfad, Huelle.pfadFuerPfad(pfad))
        }
    }

    /*
     * Die Namen der Ereignisse sind eine Absprache mit dem Client und mit der
     * iOS-Huelle. Wer sie hier aendert, bricht beide, ohne dass es knallt —
     * deshalb stehen sie woertlich in der Probe.
     */
    @Test
    fun pushTokenGehtAlsEreignisUndBleibtLiegen() {
        val skript = Huelle.pushTokenSkript("abc:DEF_123")
        assertTrue(skript.contains("new CustomEvent('brauweg:push-token'"))
        assertTrue(skript.contains("plattform: 'android'"))
        assertTrue(skript.contains("""token: "abc:DEF_123""""))
        assertTrue(skript.contains("window.BRAUWEG_APP.pushToken = d"))
    }

    @Test
    fun einFremdesTokenBrichtNichtAusDerZeichenkette() {
        val skript = Huelle.pushTokenSkript("a\"; alert(1); \"\n")
        assertTrue(skript.contains("""token: "a\"; alert(1); \"\n""""))
    }

    @Test
    fun zurueckFragtErstDenClient() {
        assertTrue(Huelle.ZURUECK_SKRIPT.contains("new CustomEvent('brauweg:zurueck', { cancelable: true })"))
        assertTrue(Huelle.ZURUECK_SKRIPT.contains("return e.defaultPrevented"))
    }

    @Test
    fun derVorspannSagtObEsPushGibt() {
        assertTrue(Huelle.vorspann(push = false).contains("plattform: 'android', push: false"))
        assertTrue(Huelle.vorspann(push = true).contains("push: true"))
        assertFalse(Huelle.vorspann(push = false).contains("pushToken"))
    }
}
