// 🧩 withTimeout.js
// En enkel timeout-wrapper som garanterar att inga AI-anrop kan hänga

export async function withTimeout(promise, ms = 15000) {
  let timer;

  function startTimer(reject) {
    timer = setTimeout(() => reject(new Error(`⏳ Timeout efter ${ms / 1000}s`)), ms);
  }

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => startTimer(reject)),
  ]);
}
