import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const pdf = readFileSync("scripts/tmp/bill.pdf");
createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/pdf" });
  res.end(pdf);
}).listen(3311, () => console.log("serving on 3311"));
