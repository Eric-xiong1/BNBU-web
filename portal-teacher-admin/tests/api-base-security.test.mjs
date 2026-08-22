import assert from "node:assert/strict";
import test from "node:test";

import { apiBaseUrl } from "../app/api-client.ts";

function installWindow({ protocol, hostname, origin, stored }) {
  let value = stored;
  globalThis.window = {
    location: { protocol, hostname, origin },
    localStorage: {
      getItem() {
        return value;
      },
      removeItem() {
        value = null;
      },
    },
  };
  return () => value;
}

test("public origins reject and clear an arbitrary stored API base", () => {
  const stored = installWindow({
    protocol: "https:",
    hostname: "admin.verityai.cn",
    origin: "https://admin.verityai.cn",
    stored: "https://attacker.invalid/collect",
  });

  assert.equal(apiBaseUrl(), "/api/v1");
  assert.equal(stored(), null);
});

test("loopback development accepts only a loopback API base", () => {
  installWindow({
    protocol: "http:",
    hostname: "127.0.0.1",
    origin: "http://127.0.0.1:3001",
    stored: "http://127.0.0.1:3000/api/v1/",
  });
  assert.equal(apiBaseUrl(), "http://127.0.0.1:3000/api/v1");

  const rejected = installWindow({
    protocol: "http:",
    hostname: "localhost",
    origin: "http://localhost:3001",
    stored: "https://attacker.invalid/collect",
  });
  assert.equal(apiBaseUrl(), "/api/v1");
  assert.equal(rejected(), null);
});
