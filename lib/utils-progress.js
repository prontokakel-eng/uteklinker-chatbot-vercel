// /lib/utils-progress.js
// Enkel progressbar för terminalen
// Exempel: updateProgress(42, 100, "SE")

export function createProgressBar(total, lang) {
  let current = 0;
  return {
    tick: (increment = 1) => {
      current += increment;
      const percent = Math.min(100, Math.round((current / total) * 100));
      const filled = Math.round((percent / 100) * 20);
      const bar = "▰".repeat(filled) + "▱".repeat(20 - filled);
      process.stdout.write(
        `\r[${bar}] ${percent}% (${current}/${total}) – ${lang}   `
      );
      if (current >= total) process.stdout.write("\n");
    },
  };
}
