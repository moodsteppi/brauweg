package de.brauweg.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
}
