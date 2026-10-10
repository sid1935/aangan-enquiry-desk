// Runs all 20 calls through the brain and compares to data/expected.json. Writes data/results.json.
import fs from 'node:fs';
import { qualify } from './qualify.mjs';

const calls = JSON.parse(fs.readFileSync('data/calls.json', 'utf8'));
const expected = JSON.parse(fs.readFileSync('data/expected.json', 'utf8'));
const only = process.argv.slice(2);
const out = [];
let ok = 0, totalCost = 0;

for (const c of calls.filter(c => !only.length || only.includes(c.id))) {
  try {
    const { result, usage } = await qualify(c);
    const match = result.decision === expected[c.id];
    if (match) ok++;
    totalCost += usage.costUsd;
    out.push({ id: c.id, header: c.header, expected: expected[c.id], ...result, usage, match });
    console.log(`${match ? 'OK  ' : 'DIFF'} ${c.id}  expected=${expected[c.id].padEnd(15)} got=${result.decision.padEnd(15)} flags=[${result.flags.join(',')}]`);
  } catch (e) {
    out.push({ id: c.id, error: e.message, match: false });
    console.log(`ERR  ${c.id}  ${e.message}`);
  }
}
fs.writeFileSync('data/results.json', JSON.stringify(out, null, 2));
console.log(`\n${ok}/${out.length} match expected. Est. LLM cost: $${totalCost.toFixed(4)} ($${(totalCost / out.length).toFixed(4)} per call)`);
