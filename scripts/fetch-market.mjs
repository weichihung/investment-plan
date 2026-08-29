import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMarketSnapshot } from "../worker/src/market.js";

const outputIndex = process.argv.indexOf("--output");
const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : "market-data.json");
let snapshot;
try {
  snapshot = await buildMarketSnapshot();
} catch (primaryError) {
  const response = await fetch("https://investment-plan-market-api.weichihung.workers.dev/market/refresh");
  if (!response.ok) throw primaryError;
  snapshot = await response.json();
  snapshot.status = "partial";
  snapshot.failures = [
    ...(snapshot.failures || []),
    `Scheduled primary source failed: ${primaryError.message}`
  ];
}
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, generatedAt: snapshot.generatedAt, status: snapshot.status, quotes: Object.keys(snapshot.quotes).length }));
