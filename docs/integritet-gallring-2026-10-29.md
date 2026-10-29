# Sol: integritet och gallring inför publicering

Status 29 oktober 2026: tekniskt underlag och förslag. Ingen automatisk radering är aktiverad och detta är inte en färdig juridisk bedömning. Mobilkontroll görs separat.

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

1. Utse ansvarig hos Pronto Klinkerdäck AB. Föreslagen period: högst 30 dagar för råa frågor och svar, efter nödvändig kvalitetsgranskning. Perioden är ett verksamhetsval och måste beslutas, inte en generell lagfrist. En rättighetsbegäran kan behöva hanteras tidigare.
2. Kör förhandskontrollen dagligen när rutinen införs. Använd en uttryckligen angiven arbetsbok, aldrig en automatisk reservdestination. Kontrollera avvikande datum och rapportera endast antal, körningstid och resultat i driftprotokollet.
3. För en framtida radering ska hela råa raden A:O hanteras, även rättade svar, länkar och identifierare. Bevara radpositionen eftersom godkända FAQ kan hänvisa till AI_REVIEW-radnummer. Ta inte bort rader så att hänvisningar förskjuts. Behåll högst en innehållsfri markering om gallring om den behövs för spårbarhet.
4. **Att tömma celler är inte bevis på fullständig radering.** Verifiera hur Workspace-administrationen hanterar versionshistorik, eventuella Vault-regler, säkerhetskopior och återställning. Google beskriver en särskild historikradering för personliga konton; stöd och verkan i den här delade driven är inte fastställda. Om historiken inte kan gallras enligt behovet måste råloggen flyttas till en lagringslösning med verifierad livscykel innan en fast raderingsfrist utlovas.
5. Omfatta även den äldre Gmail-arbetsboken, gamla fasta Preview-adresser som kan skriva dit, exportfiler och lokala rapporter/loggar. Stoppa gamla skrivvägar först. Radera inte originalet innan alla behövliga källor och godkända FAQ kontrollerats och exakt åtgärd godkänts. Ägarskap och behörigheter är en separat fråga från gallring.
6. Behåll enbart redigerad, generell och källkontrollerad produktinformation i godkända FAQ. Ett godkännande av ett AI-svar ger inte automatiskt skäl att spara den ursprungliga kundfrågan längre.
7. Rättighetsbegäran tas emot via info@klinkerdack.se. Använd minsta nödvändiga uppgifter för att hitta och verifiera ärendet; kontrollera aktiva kopior, historik, exporter och relevanta leverantörer. Dokumentera åtgärd och begränsningar utan att skapa en ny rådialogkopia.

## Kontroll före lansering

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
