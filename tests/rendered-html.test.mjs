import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the 3DP for Good replica", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>3DP for Good — Tools for more independent care<\/title>/i);
  assert.match(html, /3DP FOR GOOD/);
  assert.match(html, /Make/);
  assert.match(html, /printer-loop\.mp4/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("ships the reference media and downloadable models", async () => {
  const assets = [
    "../public/assets/bach-logo.png",
    "../public/assets/printer-loop.mp4",
    "../public/assets/class-workshop-01.png",
    "../public/assets/ohlone-cad-club.png",
    "../public/assets/kaavin-prasanna.png",
    "../public/assets/dr-ramchandani.png",
    "../public/assets/button-hook-zipper-pull.stl",
    "../public/assets/book-page-holder.stl",
  ];

  await Promise.all(assets.map((asset) => access(new URL(asset, import.meta.url))));
});
