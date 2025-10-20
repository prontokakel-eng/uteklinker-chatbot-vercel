import { Bench } from "tinybench";

// Byt till din verkliga sökfunktion via en liten adapter,
// så vi inte behöver importera interna paths här.
async function searchAdapter(query) {
  // TODO: koppla till er publika sökentry (t.ex. lib/search/index.js) utan att ändra logik.
  return { hits: [] };
}

const bench = new Bench({ time: 500 });

bench.add("faq search top-10", async () => {
  await searchAdapter("installera kakel");
});

await bench.run();
console.table(bench.table());
