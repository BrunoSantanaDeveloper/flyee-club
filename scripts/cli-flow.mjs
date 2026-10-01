#!/usr/bin/env node
// End-to-end smoke test of the CLI contract (docs/CLI-CONTRACT.md) against a
// running deployment, playing the part of `npx flyee`:
//
//   device login → register the machine → /me → catalog → download the first
//   module the account may install → verify size and SHA-256 → report an event
//   → refresh (rotation) → logout → the old token is refused.
//
// Usage:
//   node scripts/cli-flow.mjs [--base https://flyee.club] [--device <device_id>]
//
// It prints a code and waits for a human to approve it at /ativar with a real
// member account. Nothing here touches the database directly.

import { createHash, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const BASE = option("base", process.env.FLYEE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const DEVICE = option("device", `smoke-${randomUUID().replace(/-/g, "").slice(0, 24)}`);
const CLIENT = "flyee-cli";
const SCOPES = "profile:read catalog:read modules:download telemetry:write";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
  return ok;
}

async function form(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function api(path, token, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Flyee-Device": DEVICE,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

console.log(`flyee CLI contract smoke test against ${BASE} (device ${DEVICE})\n`);

// 1. Device authorization.
const start = await form("/api/oauth/device", { client_id: CLIENT, scope: SCOPES, device_id: DEVICE });
if (!check("device authorization started", start.status === 200, JSON.stringify(start.json))) process.exit(1);
console.log(`\n  Open ${start.json.verification_uri_complete}\n  and approve the code ${start.json.user_code}.\n`);

let interval = start.json.interval * 1000;
let tokens = null;
const deadline = Date.now() + start.json.expires_in * 1000;
while (Date.now() < deadline) {
  await sleep(interval);
  const poll = await form("/api/oauth/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: CLIENT,
    device_code: start.json.device_code,
  });
  if (poll.status === 200) {
    tokens = poll.json;
    break;
  }
  if (poll.json?.error === "slow_down") interval += 5000;
  else if (poll.json?.error !== "authorization_pending") {
    check("device code approved", false, JSON.stringify(poll.json));
    process.exit(1);
  }
}
if (!check("tokens issued", Boolean(tokens?.access_token?.startsWith("mcat_")))) process.exit(1);
check("refresh lives 30 days", tokens.refresh_token_expires_in === 30 * 24 * 60 * 60);

// 2. Register the machine.
const install = await api("/api/cli/installs", tokens.access_token, {
  method: "POST",
  body: JSON.stringify({ device_id: DEVICE, name: "smoke test", os: "other", cli_version: "0.0.1" }),
});
check("machine registered", install.status === 200 || install.status === 201, JSON.stringify(install.json));

// 3. Who am I.
const me = await api("/api/cli/me", tokens.access_token);
check("/me answers", me.status === 200, `tier ${me.json?.access?.tier ?? "none"}`);
check("revalidation in about 30 days", me.json?.token?.days_until_revalidation >= 29);

// 4. Catalog, then a download of the first module the account may install.
const catalog = await api("/api/cli/catalog", tokens.access_token);
check("catalog answers", catalog.status === 200, `${catalog.json?.modules?.length ?? 0} modules`);
const target = catalog.json?.modules?.find((module) => module.entitled && module.latest);
if (target) {
  const download = await api(
    `/api/cli/modules/${target.slug}/versions/${target.latest.version}/download`,
    tokens.access_token,
  );
  if (check(`download link for ${target.slug}@${target.latest.version}`, download.status === 200)) {
    const bytes = new Uint8Array(await (await fetch(download.json.url)).arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    check("size matches", bytes.byteLength === download.json.size_bytes);
    check("SHA-256 matches", sha256 === download.json.sha256);
    const verify = await fetch(download.json.verify_url);
    check("verification page answers", verify.status === 200);
  }
} else {
  console.log("- no installable module published yet: download skipped");
}

// 5. Telemetry.
const events = await api("/api/cli/events", tokens.access_token, {
  method: "POST",
  body: JSON.stringify({ events: [{ name: "tool.executed", properties: { module: target?.slug ?? "none" } }] }),
});
check("events accepted", events.status === 200, JSON.stringify(events.json));

// 6. Refresh rotates; the old refresh token is dead afterwards.
const refreshed = await form("/api/oauth/token", {
  grant_type: "refresh_token",
  client_id: CLIENT,
  refresh_token: tokens.refresh_token,
});
check("refresh rotates", refreshed.status === 200 && refreshed.json.refresh_token !== tokens.refresh_token);

// 7. Logout revokes the family: the new access token stops working.
await form("/api/oauth/revoke", { client_id: CLIENT, token: refreshed.json?.refresh_token ?? "" });
const after = await api("/api/cli/me", refreshed.json?.access_token ?? "");
check("logout revokes the machine's tokens", after.status === 401);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
