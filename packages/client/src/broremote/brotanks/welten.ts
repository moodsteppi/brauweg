/** Weltgestaltung und Beschreibung gehören gemeinsam zur Kartenauswahl. */
export const WELTEN = [
 { name: 'Polarinsel', bild: '/broremote/ausbau/himmel.webp', text: 'Sanfte Hügel unter dem Polarlicht. Ein guter Einstieg.', farben: ['#2d7f92','#1d4f66','#3a4256','#232838'], kruste: '#eaf7ff' },
 { name: 'Bernsteindünen', bild: '/broremote/welten/wueste.webp', text: 'Ein hoher Kamm trennt die Teams. Nutze steile Schusswinkel.', farben: ['#c68a45','#986338','#654132','#352939'], kruste: '#ffdb97' },
 { name: 'Kristalltal', bild: '/broremote/welten/kristall.webp', text: 'Erhöhte Ränder und eine tiefe Mulde. Rückstoß wird gefährlich.', farben: ['#9770cf','#584783','#34375f','#20233f'], kruste: '#c9b5ff' },
 {name:'Zwillingsinseln',bild:'/broremote/welten/inseln.webp',text:'Zwei Inseln, ein tiefer Meereskanal. Sichere deinen Rand.',farben:['#4f987b','#3e7860','#4c5146','#25383d'],kruste:'#b6dfbd'},
 {name:'Gipfelfeste',bild:'/broremote/welten/gipfel.webp',text:'Ein hoher Berg in der Mitte. Finde einen Bogen über den Gipfel.',farben:['#8e94af','#5c6486','#3d4666','#262f49'],kruste:'#e0e9ff'},
] as const;
