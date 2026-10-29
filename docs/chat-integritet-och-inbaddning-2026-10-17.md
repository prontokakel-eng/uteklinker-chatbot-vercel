# Integritet och inbäddning – arbetsunderlag 17 oktober 2026

Detta är ett historiskt granskningsunderlag för PR #12, inte en publicerad eller färdig integritetspolicy.

**Teknisk uppdatering 27 oktober:** Den senare Preview-versionen skickar upp till 32 tidigare meddelanden, högst 2 400 tecken per meddelande och totalt 24 000 tecken, till AI-delen när den behövs. Ett separat modellanrop kan kontrollera svarsförslaget. Godkända källor kan skickas med; kundens tidigare AI-svar är inte faktaunderlag. Publicerade AI-svar och kundfrågan sparas i en separat privat Google-flik som ”Ej granskat”. E-postadresser och vissa nummer maskeras före denna lagring; detta är inte fullständig anonymisering och maskeringen sker inte före AI-anropet. Koden har ingen automatisk gallring av granskningsrader. FAQ-cache i privat Google Cloud Storage innehåller källmaterial, inte kunddialoger. Textförslaget nedan behöver anpassas till dessa faktiska dataflöden före publicering. Kontovillkor, gallringstid och publicerad kundinformation är inte verifierade genom kodtesterna.

## Kort information före första meddelandet

PR #12 visar en kort upplysning på svenska, danska, tyska och engelska före inmatningsfältet:

> Du chattar med en AI-assistent. Text kan behandlas av OpenAI. Skriv inte personnummer, betalningsuppgifter eller känsliga uppgifter. Svaren kan innehålla fel.

När den fullständiga informationen är färdig ska denna kompletteras med en länk till den publicerade informationen. Knappen för att öppna chatten ska inte beskrivas som ett generellt GDPR-samtycke.

## Förslag till längre kundtext – kompletteras före publicering

**Om vår AI-chatt.** Pronto Klinkerdäck AB, org.nr 559028-0771, ansvarar för behandlingen av personuppgifter i vår kundchatt. Du kan kontakta oss på info@klinkerdack.se eller Norra Leden 1, 235 37 Vellinge.

**Varför och vilka uppgifter?** Chatten hjälper dig med frågor om våra produkter och allmän vägledning. Vi behandlar den text du skickar, de svar som behövs för att förstå följdfrågor och tekniska uppgifter som behövs för att leverera och skydda tjänsten, exempelvis IP-adress och tidpunkt. Skriv inte känsliga personuppgifter, personnummer eller betalningsuppgifter. För personliga ärenden kan du kontakta oss via e-post eller de kontaktalternativ som visas.

**AI och leverantörer.** När en fråga behöver AI skickas frågan, ett begränsat samtalssammanhang och relevanta FAQ-uppgifter till OpenAI. Språkidentifiering kan också använda OpenAI för otydlig text. Tjänsten levereras via Vercel. Google Places används för att kontrollera öppettider när den kopplingen är aktiverad; våra serveranrop för öppettider skickar butikens plats-ID och valt språk, inte din frågetext. Om du följer en extern länk gäller även den tjänstens information.

**Samtalet på din enhet.** Den föreslagna versionen håller samtalet i den öppna chattens minne och sparar inte samtalet eller visningsval i localStorage. När sidan laddas om eller chatten stängs med stängknappen försvinner det visade samtalet. Detta raderar inte uppgifter som redan har behandlats hos tjänsteleverantörer. Till en AI-förfrågan följer upp till 32 tidigare meddelanden, högst 2 400 tecken per meddelande och 24 000 tecken totalt; det är inte ett löfte att äldre skickad text aldrig har behandlats.

**Lagring hos leverantörer.** Vi använder inställningen store:false för AI-svar, vilket begränsar lagring av svar som applikationstillstånd. OpenAI beskriver normalt upp till 30 dagars säkerhetsloggning, med vissa undantag. Vi måste bekräfta vilka villkor och kontoinställningar som gäller för vår tjänst innan vi anger exakta lagringstider. Vercels tekniska loggar omfattas av separata lagringsinställningar. PR #12 tar bort kundtext och IP-adresser från appens logMessage-utskrifter men raderar inte tidigare loggar eller driftleverantörens loggar.

**Dina rättigheter.** Du kan kontakta oss för frågor om dina uppgifter och för att begära tillgång, rättelse eller radering. Beroende på behandlingen har du också rätt att invända, begära begränsning eller få ut uppgifter i ett överförbart format. Du kan lämna klagomål till Integritetsskyddsmyndigheten, imy.se.

Följande måste färdigställas i kundtexten före publicering:

- Rättslig grund för kundservice respektive säkerhet. Ett möjligt underlag är berättigat intresse för att besvara besökarens frågor och skydda tjänsten; det kräver dokumenterad bedömning. Avtal kan vara relevant för vissa konkreta kundärenden. Inget av alternativen är automatiskt fastställt här.
- Faktiska lagringstider för Vercel, OpenAI och eventuell e-postkontakt samt rutin för radering och åtkomst. Inga löften om noll lagring.
- Personuppgiftsbiträdesavtal, avtalsparter, eventuell behandling utanför EU/EES och relevanta överföringsskydd. Serverregion är inte bevis för att all behandling sker inom EU.
- Vilken separat tjänst och behandling som gäller om bemannad chatt införs. Den är ännu inte aktiverad av detta arbete.

## Tekniska förändringar och avgränsning

Gamla embed.js skapade en dold iframe direkt vid sidladdning och hade oskyddade message-lyssnare för gamla spar-API:er. PR #12 ersätter detta med en knapp som skapar en iframe först vid öppning och tar bort dokumentet vid stängning. Gamla sparmeddelanden hanteras inte längre. Ingen FAQ eller produktfakta ändras.

Startkoden använder inga cookies, localStorage, sessionStorage, analys- eller annonstaggar. Om embed.js hämtas från Vercel görs ändå ett statiskt anrop dit när skriptet laddas. För att undvika även det anropet före öppning ska startkoden ligga hos NEH eller inline i värdsidan, med data-chat-url till den godkända chattsidan. Sätt inte iframe src i förväg, inte heller i en dold iframe.

Exempel på integration efter godkänd publicering av aktuell version:

```html
<!-- /assets/pronto-chat-launcher.js är den granskade embed.js, serverad av NEH. -->
<script src="/assets/pronto-chat-launcher.js"
  data-chat-url="https://uteklinker-chatbot-vercel.vercel.app/" defer></script>
```

Att chatten inte själv behöver sparade visningsval avgör inte om plattformens säkerhetskakor är nödvändiga. Klassificering måste utgå från faktiskt beteende och ändamål. Cookiebot-samtycke för statistik/marknadsföring får inte kringgås av chatten. Eventuell röstinmatning ska bedömas separat innan den erbjuds i den färdiga designen.

## Teststatus och sista kontrollen på NEH

Automatiserade tester kör den verkliga startkoden med blockerad webbläsarlagring och verifierar:

- Ingen iframe eller API-begäran före explicit öppning.
- HTTPS och korrekt chattursprung även när startkoden ligger på butikens domän.
- Stängning tar bort iframe; återöppning skapar ett nytt dokument.
- Inga gamla message-hanterare för sparfunktioner.
- Ingen dubblerad knapp vid upprepad laddning och korrekt montering vid sen skriptladdning.

Detta är simulerade DOM-tester och bevisar inte Cookiebots beteende eller Vercels säkerhetskakor i en riktig webbläsare. public/embed-privacy-check.html är en teknisk testyta, inte den slutliga NEH-inbäddningen eller en Cookiebot-simulator.

Följande ska köras på en icke-publicerad NEH-testsida med den faktiska Cookiebot-konfigurationen:

| Läge | Kontroll |
| --- | --- |
| Före cookieval, chatten stängd | Ingen iframe och inga chatt-API-anrop. Om startkoden ligger hos NEH: inget anrop till chatthosten. |
| Avvisa valfria kakor | Inga statistik- eller marknadsföringstaggar från chatten; dokumentera eventuella säkerhetskakor och ändamål. |
| Öppna chatten | Information visas före inmatning, kontaktalternativ fungerar och ett hälsningssvar fungerar. |
| Blockerad tredjepartslagring | Chatten startar utan lagringsfel. |
| Godkänn, sedan återkalla valfria kakor | Inga fortsatta valfria spårningsanrop. Chatten får inte återaktivera dem. |
| Stäng, öppna igen | Inget tidigare samtal visas; iframe tas bort medan chatten är stängd. |

Spara nätverks- och cookiebevis utan kundinnehåll eller nyckelvärden. Enbart avsaknad av Set-Cookie i ett HTTP-svar räcker inte som sluttest. Ingen NEH-layout, cookieinställning eller produktionskod har publicerats av denna ändring.

## Källor kontrollerade 17 oktober 2026

- Företag och kontakt: https://klinkerdack.se/kopvillkor
- Information och rättigheter: https://www.imy.se/privatperson/dataskydd/vi-guidar-dig/for-dig-som-kund/
- Rättslig grund: https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/
- Kakor och samtycke: https://pts.se/internet-och-telefoni/kakor-cookies/
- OpenAI datahantering: https://developers.openai.com/api/docs/guides/your-data
