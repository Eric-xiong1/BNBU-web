import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("bounds staging portal json-file logs", async () => {
  const compose = await readFile(
    new URL("../docker-compose.staging.yml", import.meta.url),
    "utf8",
  );

  assert.match(compose, /logging:\s*\n\s+driver: json-file/);
  assert.match(compose, /max-size: ['"]10m['"]/);
  assert.match(compose, /max-file: ['"]5['"]/);
  assert.match(compose, /cpus: 0\.75/);
  assert.match(compose, /mem_limit: 768m/);
  assert.match(compose, /pids_limit: 256/);
});
