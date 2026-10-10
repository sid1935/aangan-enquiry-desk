// Extracts the 20 phone transcripts (Section 1) from the enquiries PDF into data/calls.json
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const pdf = process.argv[2] || 'C:/Users/HP/AppData/Local/Temp/Aangan_Sep 2026_Enquiries.pdf';
let txt = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 1e8 });
txt = txt.replace(/\f/g, '\n'); // page breaks glue the next header onto the previous line
txt = txt.slice(txt.indexOf('SECTION 1'), txt.indexOf('SECTION 2'));
const parts = txt.split(/^(?=T\d\d\s)/m).filter(p => /^T\d\d\s/.test(p));
const calls = parts.map(p => {
  const [header, ...rest] = p.trim().split('\n');
  return { id: header.slice(0, 3), header: header.replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, '-').trim(), transcript: rest.join('\n').trim() };
});
fs.writeFileSync('data/calls.json', JSON.stringify(calls, null, 2));
console.log(calls.length, 'calls extracted');
