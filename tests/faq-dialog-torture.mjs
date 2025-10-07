// tests/faq-dialog-torture.mjs
// Mini-torture test för att testa faq-dialog.js logik separat (färger & format)
// Nu som ESM-import

import { handleFaqDialog } from "../lib/faq-dialog.js";

function runTest(inputQ, answer, steps = []) {
  const session = {};
  console.log(`\n❓ ${inputQ}`);
  let reply = handleFaqDialog(session, inputQ, answer);
  console.log("👉 Bot:", reply);

  for (const step of steps) {
    reply = handleFaqDialog(session, step, "");
    console.log(`🙋 ${step} → Bot: ${reply}`);
  }
}

const longColors =
  "Antique finns i Beige, Grey, Konjak, Dark, Ivory, Silver, " +
  "och fler nyanser som sträcker sig över en lång lista av färger " +
  "för att testa truncering och interaktiv fortsättning. " +
  "Här lägger vi till ännu mer text för att passera 200 tecken så " +
  "att vi kan trigga logiken för färger i faq-dialog.js.";

const longFormats =
  "20 mm tjocklek finns i 60x60 cm, 45x90 cm, 30x120 cm, 90x90 cm, " +
  "120x120 cm, 40x80 cm, och fler format som utökar listan ytterligare " +
  "för att överskrida 200 tecken så att truncerings- och fortsättningslogiken triggas.";

// Test 1: kort svar
runTest("Vilka fogar finns?", "Fog = grout");

// Test 2: färger med interaktiv fortsättning
runTest("Vilka färger finns i serien Antique?", longColors, ["ja", "ja", "ja"]);

// Test 3: format med interaktiv fortsättning
runTest("Vilka format finns i 20 mm tjocklek?", longFormats, ["yes", "yes", "yes"]);
