// Safe discovery questions, not product facts or approved FAQ knowledge.
// Match only the exact welcome shortcuts; all safety gates still run first.
const starts = {
  SE: [
    ['Vad bör jag tänka på när jag väljer uteklinker?', 'Vi börjar med hur uteplatsen ska användas. Vilken färg eller känsla söker du, och har du något format i åtanke?'],
    ['Hur fungerar montering av klinkerdäck?', 'För att hjälpa dig till rätt monteringsinformation behöver vi börja med underlaget. Är det en befintlig träkonstruktion, betong eller mark som ska förberedas?'],
    ['Jag planerar en uteplats. Vad behöver jag tänka på?', 'Berätta gärna om platsen: ungefär hur stor är uteplatsen, och finns det redan ett underlag? Då kan vi ta nästa fråga steg för steg.'],
  ],
  DA: [
    ['Hvad skal jeg tænke på, når jeg vælger udendørsfliser?', 'Lad os begynde med, hvordan terrassen skal bruges. Hvilken farve eller stil ønsker du, og har du et format i tankerne?'],
    ['Hvordan fungerer montering af udendørsfliser på fødder?', 'For at finde den rette monteringsinformation skal vi begynde med underlaget. Er det en eksisterende trækonstruktion, beton eller jord, der skal forberedes?'],
    ['Jeg planlægger en terrasse. Hvad skal jeg tænke på?', 'Fortæl gerne om stedet: Hvor stor skal terrassen cirka være, og findes der allerede et underlag? Så kan vi tage næste spørgsmål trin for trin.'],
  ],
  DE: [
    ['Worauf sollte ich bei der Auswahl von Außenfliesen achten?', 'Beginnen wir damit, wie die Terrasse genutzt werden soll. Welche Farbe oder welchen Stil wünschen Sie sich, und haben Sie schon ein Format im Sinn?'],
    ['Wie funktioniert die Verlegung von Außenfliesen auf Stelzlagern?', 'Für passende Verlegeinformationen müssen wir zunächst den Untergrund kennen. Geht es um eine vorhandene Holzkonstruktion, Beton oder einen Boden, der erst vorbereitet werden muss?'],
    ['Ich plane eine Terrasse. Was sollte ich beachten?', 'Erzählen Sie uns etwas über den Platz: Wie groß soll die Terrasse ungefähr sein, und gibt es bereits einen Untergrund? Dann können wir Schritt für Schritt weitergehen.'],
  ],
  EN: [
    ['What should I consider when choosing outdoor tiles?', 'Let’s start with how you want to use your patio. What colour or style are you looking for, and do you have a tile format in mind?'],
    ['How does installation of outdoor tiles on pedestals work?', 'To find suitable installation information, we first need to know the base. Is it an existing timber structure, concrete, or ground that needs preparation?'],
    ['I am planning a patio. What should I consider?', 'Tell us about the space: approximately how large will the patio be, and is there already a base? Then we can take the next question step by step.'],
  ],
};
export function starterGuidance(question, lang) {
  const normalized = question.normalize('NFKC').trim().toLocaleLowerCase();
  return starts[lang]?.find(([prompt]) => prompt.normalize('NFKC').toLocaleLowerCase() === normalized)?.[1] || null;
}
