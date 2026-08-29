import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMarketSnapshot } from "../worker/src/market.js";

const outputIndex = process.argv.indexOf("--output");
const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : "market-data.json");
const snapshot = await buildMarketSnapshot();
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, generatedAt: snapshot.generatedAt, status: snapshot.status, quotes: Object.keys(snapshot.quotes).length }));

