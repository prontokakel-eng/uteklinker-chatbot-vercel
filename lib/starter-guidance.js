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
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase().trim().replace(/[.!?]+$/u, '').trim();
  // Parse whole preference utterances only. Unknown words, negations, named
  // products and specifications must fall through to the factual/safety path.
  const grammar = {
    SE: { prefix: /^(?:ja[, ]+)?(?:(?:jag (?:tänkte mig|vill ha)|gärna|helst)\s+)?(?:en\s+)?/u, grey: /^grå(?:tt|a)?(?:\s+platt(?:a|or))?(?=$|[\s,])/u, style: /^(stenkänsla|betongkänsla|träkänsla)(?=$|[\s,])/u, join: /^(?:\s*,?\s+|,\s*)(?:(?:och|med|i|formatet)\s+)?(?:formatet\s+)?/u, labels: ['stenkänsla', 'betongkänsla', 'träkänsla'] },
    DA: { prefix: /^(?:ja[, ]+)?(?:(?:jeg (?:tænkte på|vil gerne have|vil have)|gerne|helst)\s+)?(?:en\s+)?/u, grey: /^grå(?:\s+fliser?)?(?=$|[\s,])/u, style: /^(stenlook|betonlook|trælook)(?=$|[\s,])/u, join: /^(?:\s*,?\s+|,\s*)(?:(?:og|med|i|formatet)\s+)?(?:formatet\s+)?/u, labels: ['stenlook', 'betonlook', 'trælook'] },
    DE: { prefix: /^(?:ja[, ]+)?(?:(?:ich (?:möchte|hätte gerne)|gerne)\s+)?(?:eine?\s+)?/u, grey: /^grau(?:e|en|es)?(?:\s+fliesen?)?(?=$|[\s,])/u, style: /^(steinoptik|betonoptik|holzoptik)(?=$|[\s,])/u, join: /^(?:\s*,?\s+|,\s*)(?:(?:und|mit|in|im|format)\s+)?(?:format\s+)?/u, labels: ['Steinoptik', 'Betonoptik', 'Holzoptik'] },
    EN: { prefix: /^(?:yes[, ]+)?(?:(?:i (?:was thinking of|would like|want)|preferably)\s+)?(?:a\s+)?/u, grey: /^gr[ae]y(?:\s+tiles?)?(?=$|[\s,])/u, style: /^(stone look|concrete look|wood look)(?=$|[\s,])/u, join: /^(?:\s*,?\s+|,\s*)(?:(?:and|with|in|format)\s+)?(?:the\s+)?(?:format\s+)?/u, labels: ['stone look', 'concrete look', 'wood look'] },
  }[lang];
  if (!grammar) return null;
  const parse = text => {
    let rest = normalize(text).replace(grammar.prefix, '');
    const preference = {};
    for (let i = 0; i < 3; i++) {
      let match;
      if ((match = rest.match(grammar.grey)) && !preference.grey) preference.grey = true;
      else if ((match = rest.match(grammar.style)) && !preference.style) {
        preference.style = grammar.labels[match[1] === grammar.labels[0].toLocaleLowerCase() ? 0 : match[1] === grammar.labels[1].toLocaleLowerCase() ? 1 : 2];
      } else if ((match = rest.match(/^(\d{1,3})\s*[x×–−-]\s*(\d{1,3})(?:\s*cm)?(?=$|[\s,])/u)) && !preference.format && match.slice(1).every(n => Number(n) > 0 && Number(n) <= 300)) {
        preference.format = `${Number(match[1])} × ${Number(match[2])}`;
      } else return null;
      rest = rest.slice(match[0].length);
      if (!rest) return preference;
      const separator = rest.match(grammar.join);
      if (!separator) return null;
      rest = rest.slice(separator[0].length);
      if (!rest) return null;
    }
    return null;
  };
  const prior = turns.slice(anchorIndex + 1).map(parse);
  const current = parse(question);
  if (!current || prior.some(value => !value)) return null;
  const chosen = Object.assign({}, ...prior, current);
  // These are customer preferences, not a claim that a matching SKU exists.
  const summary = {
    SE: [chosen.grey && 'grått', chosen.style, chosen.format && `formatet ${chosen.format}`].filter(Boolean).join(', '),
    DA: [chosen.grey && 'grå', chosen.style, chosen.format && `formatet ${chosen.format}`].filter(Boolean).join(', '),
    DE: [chosen.grey && 'Grau', chosen.style, chosen.format && `Format ${chosen.format}`].filter(Boolean).join(', '),
    EN: [chosen.grey && 'grey', chosen.style, chosen.format && `the ${chosen.format} format`].filter(Boolean).join(', '),
  }[lang];
  const next = !chosen.format ? {
    SE: 'Vilket format har du i åtanke?', DA: 'Hvilket format har du i tankerne?', DE: 'Welches Format haben Sie im Sinn?', EN: 'What format do you have in mind?',
  } : !chosen.grey && !chosen.style ? {
    SE: 'Vilken färg eller känsla vill du ha?', DA: 'Hvilken farve eller stil ønsker du?', DE: 'Welche Farbe oder welchen Stil wünschen Sie sich?', EN: 'What colour or style would you like?',
  } : {
    SE: 'Är det en ny uteplats eller ett befintligt underlag som du ska arbeta vidare med?', DA: 'Er det en ny terrasse eller et eksisterende underlag, du skal arbejde videre med?', DE: 'Geht es um eine neue Terrasse oder einen vorhandenen Untergrund?', EN: 'Is this a new patio or an existing base you want to work with?',
  };
  return {
    SE: `Då utgår vi från ditt önskemål: ${summary}. ${next.SE}`,
    DA: `Så tager vi udgangspunkt i dit ønske: ${summary}. ${next.DA}`,
    DE: `Dann halten wir Ihren Wunsch fest: ${summary}. ${next.DE}`,
    EN: `Let’s start with your preference: ${summary}. ${next.EN}`,
  }[lang];
}
