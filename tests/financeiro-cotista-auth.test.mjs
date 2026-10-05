import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/lib/financeiro-share-api.ts", import.meta.url), "utf8");

test("chamadas do Financeiro Cotista enviam Bearer e apikey Supabase", () => {
  assert.match(source, /headers\.set\("Authorization", `Bearer \$\{session\.access_token\}`\)/);
  assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /headers\.set\("apikey", supabasePublishableKey\)/);
});
