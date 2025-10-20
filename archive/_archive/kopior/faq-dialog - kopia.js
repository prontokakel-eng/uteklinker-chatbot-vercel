// /lib/faq-dialog.js
// Dialoglogik för FAQ med interaktiv hantering av färger och format
// Exporteras som ESM (eftersom package.json har "type": "module")

function splitLongAnswer(answer, chunkSize = 200) {
  const parts = [];
  let current = "";

  answer.split(" ").forEach(word => {
    if ((current + " " + word).length > chunkSize) {
      parts.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  });
  if (current) parts.push(current.trim());
  return parts;
}

export function handleFaqDialog(session, question, answer) {
  // Reset state om en ny fråga ställs (dvs inte bara "ja/yes/y")
  const normalizedQ = question.toLowerCase();
  const isYes = normalizedQ === "ja" || normalizedQ === "yes" || normalizedQ === "y";

  if (!isYes) {
    // Ny fråga => återställ state
    session.pendingAnswerParts = [];
    session.answerStep = 0;
    session.fallbackShown = false;
  }

  // Initiera state om saknas
  if (!session.pendingAnswerParts) session.pendingAnswerParts = [];
  if (!session.answerStep) session.answerStep = 0;
  if (!session.fallbackShown) session.fallbackShown = false;

  // Om användaren svarar ja/yes/y
  if (isYes) {
    if (session.pendingAnswerParts.length > 0) {
      // Visa nästa block
      session.answerStep++;
      const nextPart = session.pendingAnswerParts.shift();
      let reply = nextPart;

      if (session.answerStep >= 3 || session.pendingAnswerParts.length === 0) {
        reply += " … för fler se hela listan på vår webbplats.";
        session.pendingAnswerParts = [];
        session.answerStep = 3; // säkerställ cutoff-läge
      } else {
        reply += " … Vill du se fler?";
      }
      return reply;
    } else if (session.answerStep >= 3) {
      // Efter cutoff
      if (!session.fallbackShown) {
        session.fallbackShown = true;
        return "Jag har visat alla jag kan här i chatten 😊 För fler detaljer, kika gärna på vår webbplats.";
      } else {
        return ""; // tyst efter första fallback
      }
    }
  }

  // Om svaret är långt -> dela upp
  if (answer && answer.length > 200) {
    const parts = splitLongAnswer(answer, 200);
    const firstPart = parts.shift();
    session.pendingAnswerParts = parts;
    session.answerStep = 1;

    // Bestäm om det är färger eller format för rätt följdfråga
    let followUp = "Vill du se fler?";
    if (normalizedQ.includes("färg")) {
      followUp = "Vill du se fler färger?";
    } else if (
      normalizedQ.includes("format") ||
      normalizedQ.includes("storlek")
    ) {
      followUp = "Vill du se fler format?";
    }

    if (session.answerStep >= 3 || session.pendingAnswerParts.length === 0) {
      session.answerStep = 3; // markera cutoff-läge direkt
      return firstPart + " … för fler se hela listan på vår webbplats.";
    } else {
      return firstPart + " … " + followUp;
    }
  }

  // Standard: returnera svaret rakt av
  return answer;
}
