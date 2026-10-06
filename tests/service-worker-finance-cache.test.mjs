import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function loadServiceWorker({ cacheNames = [] } = {}) {
  const handlers = new Map();
  const deletedCaches = [];
  let networkFetches = 0;
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const caches = {
    keys: async () => cacheNames,
    delete: async (name) => { deletedCaches.push(name); return true; },
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    match: async () => undefined,
  };

  runInNewContext(serviceWorker, {
    self,
    caches,
    URL,
    Promise,
    fetch: async () => {
      networkFetches += 1;
      return new Response("ok");
    },
    Response,
  });

  return { handlers, deletedCaches, getNetworkFetches: () => networkFetches };
}

test("a versão nova do service worker apaga o cache anterior", async () => {
  assert.match(serviceWorker, /const CACHE_NAME = "share-brasil-v2";/);
  const { handlers, deletedCaches } = loadServiceWorker({ cacheNames: ["share-brasil-v1", "share-brasil-v2"] });
  let activation;
  handlers.get("activate")({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(deletedCaches, ["share-brasil-v1"]);
});

test("GET financeiro não é interceptado nem armazenado pelo service worker", () => {
  const { handlers, getNetworkFetches } = loadServiceWorker();
  let intercepted = false;
  handlers.get("fetch")({
    request: new Request("https://api.share-brasil.com/api/financeiro/cotista/dashboard?inicio=2026-10-01", { method: "GET" }),
    respondWith: () => { intercepted = true; },
  });
  assert.equal(intercepted, false);
  assert.equal(getNetworkFetches(), 0);
});
