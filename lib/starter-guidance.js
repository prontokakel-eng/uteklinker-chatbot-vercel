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
export function starterGuidance(question, lang, conversation = []) {
  const normalized = question.normalize('NFKC').trim().toLocaleLowerCase();
  const direct = starts[lang]?.find(([prompt]) => prompt.normalize('NFKC').toLocaleLowerCase() === normalized)?.[1];
  if (direct) return direct;
  // A preference is customer dialogue, never evidence about a product. Keep the
  // follow-up narrow; specifications, negations and named products still use the
  // factual pipeline and its existing guards.
  const turns = conversation.filter(turn => turn.role === 'user').map(turn => turn.content);
  const anchorIndex = turns.lastIndexOf(starts[lang]?.[0][0]);
  if (anchorIndex < 0 || turns.length - anchorIndex > 3) return null;
  const grey = {
    SE: /^(?:ja[, ]+)?(?:(?:jag (?:tänkte mig|vill ha)|gärna|helst)\s+)?(?:en\s+)?grå(?:tt|a)?(?:\s+platt(?:a|or))?$/u,
    DA: /^(?:ja[, ]+)?(?:(?:jeg (?:tænkte på|vil gerne have|vil have)|gerne|helst)\s+)?(?:en\s+)?grå(?:\s+fliser?)?$/u,
    DE: /^(?:ja[, ]+)?(?:(?:ich (?:möchte|hätte gerne)|gerne)\s+)?(?:eine?\s+)?grau(?:e|en|es)?(?:\s+fliesen?)?$/u,
    EN: /^(?:yes[, ]+)?(?:(?:i (?:was thinking of|would like|want)|preferably)\s+)?(?:a\s+)?gr[ae]y(?:\s+tiles?)?$/u,
  };
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase().trim().replace(/[.!?]+$/u,'').trim();
  const format = text => {
    const match = normalize(text).match(/^(\d{1,3})\s*[x×–−-]\s*(\d{1,3})(?:\s*cm)?$/u);
    return match && match.slice(1).every(n => Number(n) > 0 && Number(n) <= 300) ? `${Number(match[1])} × ${Number(match[2])}` : null;
  };
  const prior = turns.slice(anchorIndex + 1);
  if (prior.some(text => !grey[lang]?.test(normalize(text)) && !format(text))) return null;
  const isGrey = grey[lang]?.test(normalize(question));
  const chosenFormat = format(question) || prior.map(format).find(Boolean);
  const chosenGrey = isGrey || prior.some(text => grey[lang]?.test(normalize(text)));
  if (!isGrey && !format(question)) return null;
  if (chosenFormat) return {
    SE: `Då utgår vi från ${chosenGrey ? 'grått och ' : ''}formatet ${chosenFormat}. ${chosenGrey ? 'Är det en ny uteplats eller ett befintligt underlag som du ska arbeta vidare med?' : 'Vilken färg eller känsla vill du ha?'}`,
    DA: `Så tager vi udgangspunkt i ${chosenGrey ? 'grå og ' : ''}formatet ${chosenFormat}. ${chosenGrey ? 'Er det en ny terrasse eller et eksisterende underlag, du skal arbejde videre med?' : 'Hvilken farve eller stil ønsker du?'}`,
    DE: `Dann gehen wir von ${chosenGrey ? 'Grau und dem ' : 'dem '}Format ${chosenFormat} aus. ${chosenGrey ? 'Geht es um eine neue Terrasse oder einen vorhandenen Untergrund?' : 'Welche Farbe oder welchen Stil wünschen Sie sich?'}`,
    EN: `Let’s start with ${chosenGrey ? 'grey and ' : ''}the ${chosenFormat} format. ${chosenGrey ? 'Is this a new patio or an existing base you want to work with?' : 'What colour or style would you like?'}`,
  }[lang];
  return {
    SE: 'Då utgår vi från grått. Har du ett särskilt format i åtanke, eller vill du börja med att välja känsla och stil?',
    DA: 'Så tager vi udgangspunkt i grå. Har du et bestemt format i tankerne, eller vil du begynde med at vælge stil?',
    DE: 'Dann gehen wir von Grau aus. Haben Sie ein bestimmtes Format im Sinn, oder möchten Sie zunächst den Stil eingrenzen?',
    EN: 'Let’s start with grey. Do you have a particular format in mind, or would you like to begin by narrowing down the style?',
  }[lang];
}
