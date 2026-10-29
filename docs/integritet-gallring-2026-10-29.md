# Sol: integritet och gallring inför publicering

Status 29 oktober 2026: tekniskt underlag och förslag. Ingen automatisk radering är aktiverad och detta är inte en färdig juridisk bedömning. Mobilkontroll görs separat.

## Bindande arbetsinstruktion från användaren

**Kontroll först, radering efter separat godkännande.** Inget får raderas innan ansvarig har hunnit granska underlaget. Trettio dagar är en gräns för att ta upp uppgifter till manuell gallringskontroll, inte en timer som utlöser radering. En granskad FAQ innebär inte ett godkännande av radering av råloggen. Varje konkret raderingsomgång ska godkännas separat efter granskning av arbetsbok, berörda rader, kvarvarande FAQ-källor, kopior och historik. Uteblivet svar eller passerad tidsgräns räknas aldrig som godkännande.

Teknisk spärr: förhandskontrollen returnerar alltid `deletionAllowed:false`, `manualReviewRequired:true` och `workflowStatus:awaiting-human-review`. Den begär endast läsbehörighet och saknar raderingsfunktion, publik endpoint och automatiskt raderingsschema. `--apply` och `--delete` avvisas. Ingen miljövariabel kan slå på radering i detta verktyg. Framtida införande av en separat raderingsfunktion får inte kringgå denna arbetsinstruktion.

## Genomförda förbättringar i kandidaten

- Kort kundinformation på svenska, danska, tyska och engelska beskriver nu att kundfrågan och AI-svaret sparas för kvalitetsgranskning. En lokal informationssida `/privacy.html` är uttryckligen märkt som testunderlag.
- Språkidentifieringen begär `store:false`, liksom svarsgenerering och svarskontroll redan gör. Parametern är inte ett löfte om att leverantören saknar säkerhetsloggar.
- Modellens svars-ID och interna felkoder skickas inte i kundens API-svar utanför Preview. Granskningslagringen behåller intern spårbarhet.
- Ett lokalt verktyg kan föreslå vilka granskningsrader som passerat en uttryckligen vald tidsgräns. Det har endast läsbehörighet, hämtar rubriker, datum och ursprung och skriver bara radnummer och antal. Det saknar raderingsfunktion och publik endpoint.

## Faktiska dataflöden

Webbläsaren håller upp till 32 meddelanden i minnet. AI-delen begränsar varje meddelande till 2 400 tecken och sammanhanget till 24 000 tecken. Aktuell fråga, historik och relevanta källor kan skickas till OpenAI; ett separat anrop kan kontrollera svaret. Återställning av chatten rensar visningen men återkallar inte redan överförda uppgifter.

Endast levererade AI-svar skrivs av granskningsfunktionen till AI_REVIEW, tillsammans med kundfrågan, tid, språk, modell, svars-ID, källreferenser, granskningsfält, förfrågnings-ID och miljö. FAQ-, kontakt- och felsvar omfattas inte av den funktionen. Maskering av e-post och vissa nummer sker efter AI-behandling och är inte anonymisering. Namn och adresser kan exempelvis finnas kvar.

Vercel-körningar skriver bara händelsemetadata genom den gemensamma loggern. Lokal utveckling kan skriva kundtext till loggfiler; använd därför fiktiva uppgifter och hantera befintliga lokala loggar separat. FAQ-cache i Google Cloud Storage innehåller källmaterial, inte denna granskningslogg. Vercels plattformsloggar, byggloggar och leverantörernas egna uppgifter omfattas av respektive avtal och inställningar.

## Föreslagen rutin att besluta om

1. Utse ansvarig hos Pronto Klinkerdäck AB. Användaren har valt 30 dagar som målsättning för råa frågor och svar, efter nödvändig kvalitetsgranskning. Perioden är ett verksamhetsval, inte en generell lagfrist. Genomförandet, inklusive historik, återstår att verifiera. En rättighetsbegäran kan behöva hanteras tidigare.
2. Kör förhandskontrollen när ansvarig ska granska gallringsunderlaget. Använd en uttryckligen angiven arbetsbok, aldrig en automatisk reservdestination. Kontrollera avvikande datum och rapportera endast antal, körningstid och resultat i driftprotokollet. Lägg fram resultatet för ansvarig. Ingen radering får följa utan separat godkännande av den konkreta omgången.
3. För en framtida radering ska hela råa raden A:O hanteras, även rättade svar, länkar och identifierare. Bevara radpositionen eftersom godkända FAQ kan hänvisa till AI_REVIEW-radnummer. Ta inte bort rader så att hänvisningar förskjuts. Behåll högst en innehållsfri markering om gallring om den behövs för spårbarhet.
4. **Att tömma celler är inte bevis på fullständig radering.** Verifiera hur Workspace-administrationen hanterar versionshistorik, eventuella Vault-regler, säkerhetskopior och återställning. Google beskriver en särskild historikradering för personliga konton; stöd och verkan i den här delade driven är inte fastställda. Om historiken inte kan gallras enligt behovet måste råloggen flyttas till en lagringslösning med verifierad livscykel innan en fast raderingsfrist utlovas.
5. Omfatta även den äldre Gmail-arbetsboken, gamla fasta Preview-adresser som kan skriva dit, exportfiler och lokala rapporter/loggar. Stoppa gamla skrivvägar först. Radera inte originalet innan alla behövliga källor och godkända FAQ kontrollerats och exakt åtgärd godkänts. Ägarskap och behörigheter är en separat fråga från gallring.
6. Behåll enbart redigerad, generell och källkontrollerad produktinformation i godkända FAQ. Ett godkännande av ett AI-svar ger inte automatiskt skäl att spara den ursprungliga kundfrågan längre.
7. Rättighetsbegäran tas emot via info@klinkerdack.se. Använd minsta nödvändiga uppgifter för att hitta och verifiera ärendet; kontrollera aktiva kopior, historik, exporter och relevanta leverantörer. Dokumentera åtgärd och begränsningar utan att skapa en ny rådialogkopia.

## Kontroll före lansering

### Kartläggning av historik och gamla skrivvägar

Metadata bekräftar att både originalet och Impresa-kopian är native Google Sheets, och att Impresa-kopian ligger i en delad drive. Googles Drive-API kan inte radera revisioner av native Sheets. Den separata funktionen för historikradering i redigeraren dokumenteras endast för personliga Google-konton. Därför finns ännu ingen verifierad raderingsväg för revisionshistoriken i den delade driven. Filmetadata från anslutningen gav inget besked om eventuell Vault-regel eller administrativ lagring; detta är inte en kontroll av de reglerna.

Läskontroll av Vercel bekräftar två inställningar: `SHEET_ID_MAIN` gäller bara Preview-grenen `work/pilot-review-2026-10-22`, medan den äldre `SHEET_ID` gäller All Environments. Tidigare verifierade värden pekar på Impresa-kopian respektive Gmail-originalet. Gamla byggen tar inte emot nya miljövariabler i efterhand, enligt Vercels dokumentation. Tidigare Preview-adresser kan därför behålla den äldre destinationen. Ingen sådan adress har fått testfrågor i denna kontroll, eftersom ett AI-svar då skulle kunna skapa en ny rålogg i Gmail.

Efter användarens instruktion att fortsätta begränsades det verifierade servicekontot från redigerare till läsare i Gmail-originalet. Impresa-kopian behåller samma servicekonto som redigerare. Befintliga celler, filer och versioner raderades inte. Det stoppar den identifierade gamla skrivvägen utan att ta bort läsåtkomst. Andra identiteter eller framtida nya behörigheter omfattas inte av denna spärr.

Kontroll efter ändringen: produktionen svarade på en befintlig FAQ-fråga. En opersonlig AI-testfråga i aktuell Preview ökade Impresa-arkets granskningslogg från 164 till 165 rader; Gmail-originalet låg kvar på 161. Produktionskod, driftsättning och miljövariabler ändrades inte. Ingen gammal testadress fick en AI-testfråga och inget avsiktligt skrivförsök gjordes mot originalet.

100 driftsättningar inventerades i Vercels gränssnitt, från 15 till 29 oktober. Där ingår 48 äldre pilotbyggen före Impresa-bytet. Inventeringen är ett avgränsat underlag, inte en fullständig lista över projektets hela historik. Inga byggen raderades eller återställdes i arbetet.

**Separat plattformsbegränsning:** Vercel hade redan en automatisk bevaranderegel på 30 dagar för samtliga byggkategorier. För Pre-Production och avbrutna byggen visade det befintliga Hobby-kontot bara 1 dag, 1 vecka, 2 veckor och 30 dagar; inget avstängningsval. Regeln ändrades inte och ingen betald uppgradering gjordes. Den manuella spärren för kunddialoger kan inte stoppa Vercels egen städning av byggartefakter. Äldre byggen fanns redan i Recently Deleted med återställningsfrister; det säger inget om radering av Google-arkets innehåll. Vercels undantag för bland annat aktuell produktion och aktiv grens senaste Preview är dokumenterade av leverantören. Bevarandet av äldre byggartefakter måste därför hanteras separat om de behövs för granskning.

Gamla filer och kundloggar ska ligga kvar tills användaren granskat och godkänt ett konkret åtgärdsunderlag. Ingen automatisk radering av kunddialoger införs.

Fastställ ändamål, rättslig grund och eventuell intresseavvägning samt publicerad information om rättigheter, mottagare, lagring och internationella överföringar. Verifiera personuppgiftsbiträdesavtal och överföringsvillkor för OpenAI, Google och Vercel mot de konton/projekt som appen faktiskt använder. Inga nya villkor har accepterats i denna genomgång.

I det inloggade OpenAI-kontot visades API-loggning ”Enabled per call” och alla tre delningsval som Disabled. Det är en observation av det öppna kontot, inte ett bevis på att appens hemliga nyckel hör till samma organisation eller att Zero Data Retention gäller. Ingen inställning ändrades och inga nycklar lästes.

Kontrollera slutligen Cookiebot och faktisk inbäddning på butikssidan. Den fristående Preview-sidan visar inte vilka cookies eller nätverksanrop hela butiken gör. Publicera inte utkastet som slutlig policy innan punkterna ovan är avgjorda.

## Verktyg och kontroll

`node scripts/review-retention-preview.mjs --sheet-id ID --days 30`

Kräver befintlig Google-konfiguration lokalt och begär endast `spreadsheets.readonly`. Verktyget saknar `--apply`. Körningens resultat innebär inte att någon uppgift har raderats, och giltigt schema är obligatoriskt.

## Officiella källor

- https://developers.openai.com/api/docs/guides/your-data — `store:false`, API-data och separata säkerhetsloggar.
- https://www.imy.se/vanliga-fragor-och-svar/hur-lange-far-vi-spara-uppgifter/ — lagring får inte vara längre än ändamålet kräver.
- https://www.imy.se/privatperson/dataskydd/dina-rattigheter/ — registrerades rättigheter.
- https://support.google.com/docs/answer/190843?hl=en — versionshistorik och kontoberoende historikradering.
- https://vercel.com/docs/logs/runtime — runtime-loggarnas visningsperiod beror på plan; detta är inte ett löfte om all plattformsdata.
- https://developers.google.com/workspace/drive/api/guides/manage-revisions — API-radering av revisioner stöds för binära filer, inte native Sheets.
- https://vercel.com/docs/environment-variables — ändrade variabler gäller nya byggen, inte tidigare driftsättningar.
- https://vercel.com/docs/deployment-retention — Vercels separata byggstädning och dess undantag.
