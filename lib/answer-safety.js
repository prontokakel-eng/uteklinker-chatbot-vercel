// Shared output checks: model labels and previous assistant text are not evidence.
const awayFromHouse = /från\s+(?:huset|fasaden)|væk\s+fra\s+(?:huset|facaden)|vom\s+(?:Haus|Gebäude)\s+weg|away\s+from\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
const towardsHouse = /mot\s+(?:huset|fasaden)|mod\s+(?:huset|facaden)|zum\s+(?:Haus|Gebäude)|(?:towards?|to)\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
export const reversesDrainage = (reply, rows) => rows.some(r => awayFromHouse.test(r.answer || '')) && towardsHouse.test(reply);

const property = /frost|halk|skridsikker|rutsch|slip.resistan|\bUV\b|uv.best|blek|färg|farve|farbe|colou?r|tjock|tykk|dick|thick|vikt|vægt|gewicht|weight|tål|tåler|beständig|resistan|absorpti|porös|porous|hållbar|durab|belast|kapacit|capacity|impregner|specifik|specifi|egenskap|property|properties|lämplig|egnet|geeignet|suitable|utomhusbruk|outdoor use|slitstyr|hårdhet|hardness/iu;
const predicate = /(?<!\p{L})(?:är|har|tål|klarar|passar|fungerar|kan|er|har|tåler|ist|hat|sind|eignet|is|are|has|have|can|resists?|withstands?)(?!\p{L})/iu;
const genericSubject = /^(?:(?:ja|nej|yes|no)[, ]+)?(?:(?:vanlig|vanliga|generellt|generally|ordinary|der|die|das)\s+)*(?:granitkeramik|keramiska plattor|keramiske fliser|feinsteinzeug|keramik|porcelain(?: stoneware)?|ceramic tiles)\s+(?:är|har|kan|er|ist|hat|is|are|has|can)\b/iu;
const material = /granitkeramik|keramiska plattor|keramiske fliser|feinsteinzeug|porcelain(?: stoneware)?|ceramic tiles/iu;
const commonCapital = /^(?:Jag|Du|Vi|Ni|Den|Det|De|Ja|Nej|Hur|Vad|Vilken|Vilka|Är|Har|Kan|Finns|Behöver|Granitkeramik|Keramiska|Keramiske|Feinsteinzeug|Keramik|Porcelain|Ceramic|I|You|We|They|It|The|Is|Are|What|Which|How|Yes|No|Der|Die|Das|Ist|Sind|Hvad|Er|UV)$/u;
const names = text => (text.match(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{N}-]*/gu) || []).filter(w => !commonCapital.test(w));
const properties = [
  /frost|freez|minusgrad/iu, /halk|skridsikker|rutsch|slip.resistan/iu,
  /\bUV\b|uv.best|blek/iu, /färg|farve|farbe|colou?r/iu,
  /tjock|tykk|dick|thick/iu, /vikt|vægt|gewicht|weight/iu,
  /absorpti|porös|porous/iu, /impregner/iu,
  /belast|kapacit|capacity/iu,
];

export function unsupportedProductClaim({question, reply, cited, conversation=[]}) {
  // A property's missing source cannot be hidden by calling the response
  // "general" or "clarify". Pure preference questions remain conversational.
  const assertions = reply.split(/(?<=[.!?])\s+/u).filter(s => !s.trim().endsWith('?'));
  const context = [question, ...conversation.filter(t => t.role === 'user').map(t => t.content)].join(' ');
  const specificPropertyQuestion = property.test(context) && !material.test(question);
  return assertions.some(sentence => {
    if (!sentence.trim()) return false;
    if (property.test(sentence) && (predicate.test(sentence) || names(sentence).length || specificPropertyQuestion)) {
      const subjects = names(sentence);
      // An unrelated, genuine source ID cannot bless a different named product.
      const relevant = cited.filter(r => {
        const tokens = new Set((`${r.question} ${r.answer}`.toLocaleLowerCase().match(/[\p{L}\p{N}-]+/gu) || []));
        return subjects.every(w => tokens.has(w.toLocaleLowerCase()));
      });
      if (subjects.length && !relevant.length) return true;
      // Knowing a product's colour is not evidence of its frost/slip properties.
      if (cited.length && properties.some(p => p.test(sentence) && !relevant.some(r => p.test(`${r.question} ${r.answer}`)))) return true;
      if (genericSubject.test(sentence)) return false;
      return !cited.length;
    }
    // Product attributes, including pronoun answers such as "Ja, den tål det",
    // need evidence. Customer preferences are acknowledged, not certified.
    return !cited.length && specificPropertyQuestion && /\b(?:ja|nej|yes|no|den|det|de|it|they|er|sie|es)\b/iu.test(sentence) && predicate.test(sentence);
  });
}
