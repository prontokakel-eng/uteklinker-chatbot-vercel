// Business routing decision. A technical classification is not a warranty.
export const WARRANTY_POLICY_ID = 'policy:warranty-contact:v1';
export const warrantyContact = {
  SE: 'Kontakta vår personal via kontaktalternativen nedan för frågor om garantins längd, omfattning eller eventuell ersättning. Vi behöver bedöma din produkt och ditt ärende innan vi kan lämna besked.',
  DA: 'Kontakt vores personale via kontaktmulighederne nedenfor ved spørgsmål om garantiens varighed, omfang eller eventuel erstatning. Vi skal vurdere dit produkt og din sag, før vi kan give et svar.',
  DE: 'Bitte wenden Sie sich über die untenstehenden Kontaktmöglichkeiten an unser Personal, wenn Sie Fragen zur Dauer oder zum Umfang der Garantie oder zu einer möglichen Entschädigung haben. Wir müssen Ihr Produkt und Ihren Fall prüfen, bevor wir Auskunft geben können.',
  EN: 'Please contact our staff using the contact options below with questions about warranty duration, coverage or possible compensation. We need to assess your product and your case before we can give an answer.',
};
export const warrantyIntent = text => /garanti\p{L}*|warrant\p{L}*|guarantee\p{L}*|gewährleistung\p{L}*|gewaehrleistung\p{L}*|reklam\p{L}*|complaint\p{L}*|compensat\p{L}*|ersätt\p{L}*|erstatning\p{L}*|entschädig\p{L}*|(?:mina|min|våra|vores|mine|my|our|meine|unsere).{0,40}(?:spruck|revne|crack|gerissen|risse)|produktionsfel|produktionsfejl|production defects?|herstellungsfehler/iu.test(text || '');
export const warrantyMaterial = text => warrantyIntent(text)
  || /(?:jag|vi) har.{0,25}(?:kontaktat|meddelat|skickat.{0,20}vidare)|(?:I|we) (?:have|already).{0,20}(?:contacted|notified)|(?:jeg|vi) har.{0,20}(?:kontaktet|sendt)|(?:ich|wir) habe[n]?.{0,20}(?:kontaktiert|informiert)/iu.test(text || '')
  || /(?:halkskydd|skridsikr|anti[- ]?slip|rutschschutz).{0,100}(?:livslängd|livet ut|livstid|levetid|livsvarig|hele livet|lifespan|lifetime|for life|lebensdauer|ein leben lang)|(?:livslång|livsvarig|lebenslang|lifetime).{0,80}(?:halk|slip|rutsch)/iu.test(text || '');
const followUp = /^(?:gäller\b|gælder\b|gilt\b|does (?:it|that) apply|och\b|og\b|und\b|and\b|hur många år|hvor mange år|wie viele jahre|how many years|ja\b|yes\b|vad (?:gäller|ingår)|what (?:about|is covered))|arbetskost|arbejdsløn|arbejdsomkost|labou?r cost|arbeitskosten|(?:byta|byte|udskift|replace|replacement|austausch|tausch\p{L}*|ersetz\p{L}*).{0,40}(?:hela|hele|whole|entire|gesamte|ganze)|(?:gesamte|ganze).{0,30}(?:terrasse|deck|belag).{0,30}(?:austausch|tausch\p{L}*|ersetz\p{L}*)/iu;
export function warrantyConversation(question, conversation = []) {
  if (warrantyIntent(question) || warrantyMaterial(question)) return true;
  if (/frost|r[- ]?(?:klass|class|rating)/iu.test(question)) return false;
  if (!followUp.test(question)) return false;
  // Only the latest meaningful customer topic carries warranty context forward.
  const previous = [...conversation].reverse().find(t => t.role === 'user' && (warrantyMaterial(t.content) || !followUp.test(t.content)));
  return !!previous && warrantyMaterial(previous.content);
}
