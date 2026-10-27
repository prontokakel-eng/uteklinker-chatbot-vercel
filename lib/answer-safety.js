// Shared output checks: model labels and previous assistant text are not evidence.
const awayFromHouse = /från\s+(?:huset|fasaden)|væk\s+fra\s+(?:huset|facaden)|vom\s+(?:Haus|Gebäude)\s+weg|away\s+from\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
const towardsHouse = /mot\s+(?:huset|fasaden)|mod\s+(?:huset|facaden)|zum\s+(?:Haus|Gebäude)|(?:towards?|to)\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
export const reversesDrainage = (reply, rows) => rows.some(r => awayFromHouse.test(r.answer || '')) && towardsHouse.test(reply);

const property = /frost|halk|skridsikker|rutsch|slip.resistan|\bUV\b|uv.best|blek|färg|farve|farbe|colou?r|tjock|tykk|dick|thick|vikt|vægt|gewicht|weight|tål|tåler|beständig|resistan|absorpti|porös|porous|hållbar|durab|belast|kapacit|capacity|impregner|specifik|specifi|egenskap|property|properties|lämplig|egnet|geeignet|suitable|utomhusbruk|outdoor use|slitstyr|hårdhet|hardness/iu;
const predicate = /(?<!\p{L})(?:är|har|tål|klarar|passar|fungerar|kan|er|har|tåler|ist|hat|sind|eignet|is|are|has|have|can|resists?|withstands?)(?!\p{L})/iu;
const genericExplanation = /förklara|skillnad|vad (?:är|innebär|betyder)|generellt|allmänt|explain|what is|difference|in general|generally|erkläre|unterschied|allgemein|forklar|forskel|generelt/iu;
const material = /granitkeramik|natursten|keramiska plattor|keramiske fliser|feinsteinzeug|porcelain(?: stoneware)?|ceramic tiles|natural stone/iu;
const commonCapital = /^(?:Jag|Du|Vi|Ni|Den|Det|De|Ja|Nej|Hur|Vad|Vilken|Vilka|Är|Har|Kan|Finns|Behöver|Granitkeramik|Natursten|Keramiska|Keramiske|Feinsteinzeug|Keramik|Porcelain|Ceramic|Natural|Stoneware|Halkklassning|Halkklassningen|Halksäkerhet|Klassning|Klassningen|Ytan|Ytstruktur|Ytor|Materialet|Vatten|Fukt|Smuts|Is|Rengöring|Porositet|Säkerhet|Skillnaden|Underlaget|En|Ett|För|På|Om|Vid|Med|Till|När|Generellt|I|You|We|They|It|The|Is|Are|What|Which|How|Yes|No|Der|Die|Das|Ist|Sind|Hvad|Er|UV)$/u;
function names(text) {
  return [...text.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{N}-]*/gu)].filter(m => {
    if (commonCapital.test(m[0]) || /^R(?:9|10|11|12|13|-klass\p{L}*)$/iu.test(m[0])) return false;
    // A capital at the start of ordinary prose is not a product identifier.
    // Keep single named subjects ("Xyloria är ...") and multiword names.
    if (m.index === 0) {
      const next = text.slice(m[0].length).trimStart();
      if (next && !predicate.test(next.split(/[,.!?]/u)[0]?.split(/\s/u)[0] || '') && !/^\p{Lu}/u.test(next)) return false;
    }
    return true;
  }).map(m => m[0]);
}
const properties = [
  /frost|freez|minusgrad/iu, /halk|skridsikker|rutsch|slip.resistan|\bR(?:9|10|11|12|13)\b/iu,
  /\bUV\b|uv.best|blek/iu, /färg|farve|farbe|colou?r/iu,
  /tjock|tykk|dick|thick/iu, /vikt|vægt|gewicht|weight/iu,
  /absorpti|porös|porous/iu, /impregner/iu,
  /belast|kapacit|capacity/iu,
];

export function unsupportedProductClaim({question, reply, cited, conversation=[]}) {
  const assertions = reply.split(/(?<=[.!?])\s+/u).filter(s => !s.trim().endsWith('?'));
  const customerContext = [question, ...conversation.filter(t => t.role === 'user').map(t => t.content)].join(' ');
  const questionNames = names(question);
  const contextualNames = names(customerContext);
  const genericIntent = (genericExplanation.test(question) || material.test(question)) && !questionNames.length;
  const specificPropertyQuestion = property.test(question) && !genericIntent;
  return assertions.some(sentence => {
    if (!sentence.trim()) return false;
    const subjects = names(sentence);
    const propertyAssertion = property.test(sentence) && (predicate.test(sentence) || subjects.length || specificPropertyQuestion);
    const pronoun = /(?<!\p{L})(?:den|det|de|it|they|er|sie|es)(?!\p{L})/iu.test(sentence);
    // General explanations are not product certification. Neither an old product
    // topic nor initial capitalisation makes every sentence a product claim.
    const productBound = subjects.length || (specificPropertyQuestion || questionNames.length) && (pronoun || propertyAssertion) && !material.test(sentence);
    if (!propertyAssertion && !(specificPropertyQuestion && pronoun && predicate.test(sentence))) return false;
    if (!productBound) return false;
    const boundNames = subjects.length ? subjects : questionNames.length ? questionNames : contextualNames;
    const relevant = cited.filter(r => {
      const tokens = new Set((`${r.question} ${r.answer}`.toLocaleLowerCase().match(/[\p{L}\p{N}-]+/gu) || []));
      return boundNames.every(w => tokens.has(w.toLocaleLowerCase()));
    });
    if (!relevant.length) return true;
    // A genuine colour source cannot certify frost. R-class evidence does,
    // however, support reporting the published slip classification itself.
    return properties.some(p => p.test(sentence) && !relevant.some(r => p.test(`${r.question} ${r.answer}`)));
  });
}
