import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import manifest from "../../src/app/manifest";

afterEach(() => vi.unstubAllEnvs());

describe("PWA manifest", () => {
  it.each(["", "/AppFinanza"])("keeps identity, launch, scope and icons under %s", (base) => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", base);
    const result = manifest();
    expect(result).toMatchObject({ id: `${base}/`, start_url: `${base}/`, scope: `${base}/`, display: "standalone", prefer_related_applications: false });
    for (const size of [192, 512]) {
      for (const purpose of ["any", "maskable"]) expect(result.icons).toContainEqual({ src: `${base}/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose });
    }
  });
});

function worker(base = "/AppFinanza/") {
  const handlers: Record<string, (event: any) => void> = {};
  const match = vi.fn().mockResolvedValue(undefined);
  const put = vi.fn().mockResolvedValue(undefined);
  const addAll = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(true);
  const cache = { match, put, addAll };
  const fetch = vi.fn().mockResolvedValue({ ok: true, type: "basic", clone: () => "copy" });
  const skipWaiting = vi.fn();
  const claim = vi.fn();
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue([]), delete: remove };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL, Response, caches, fetch,
    self: { location: { href: `https://example.com${base}sw.js` }, clients: { claim }, skipWaiting,
      addEventListener: (name: string, callback: (event: any) => void) => { handlers[name] = callback; } },
  });
  async function request(path: string, mode = "cors", method = "GET") {
    const event = { request: { url: new URL(path, "https://example.com").href, mode, method }, respondWith: vi.fn(), waitUntil: vi.fn() };
    handlers.fetch(event);
    const response = event.respondWith.mock.calls[0]?.[0];
    if (response) await response;
    for (const [promise] of event.waitUntil.mock.calls) await promise;
    return event;
  }
  return { handlers, caches, fetch, match, put, addAll, skipWaiting, claim, request };
}

describe("service worker", () => {
  it.each(["/", "/AppFinanza/"])("precaches only public offline resources at %s", async (base) => {
    const sw = worker(base);
    const waitUntil = vi.fn();
    sw.handlers.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(sw.addAll).toHaveBeenCalledWith(["offline.html", "icon-192.png", "icon-512.png"].map((file) => `https://example.com${base}${file}`));
    expect(sw.skipWaiting).not.toHaveBeenCalled();
  });
  it("bypasses external APIs, private routes, query strings, other apps and writes", async () => {
    const sw = worker();
    for (const [path, method] of [
      ["https://project.supabase.co/rest/v1/transactions", "GET"],
      ["/OtherApp/_next/static/a.js", "GET"],
      ["/AppFinanza/api/private.js", "GET"],
      ["/AppFinanza/_next/static/a.js?token=secret", "GET"],
      ["/AppFinanza/_next/static/a.js", "POST"],
    ]) expect((await sw.request(path, "cors", method)).respondWith).not.toHaveBeenCalled();
    expect(sw.put).not.toHaveBeenCalled();
  });
  it("caches successful immutable assets and reuses them", async () => {
    const sw = worker();
    await sw.request("/AppFinanza/_next/static/a.js");
    expect(sw.put).toHaveBeenCalledOnce();
    sw.match.mockResolvedValue("cached");
    sw.fetch.mockClear();
    await sw.request("/AppFinanza/_next/static/a.js");
    expect(sw.fetch).not.toHaveBeenCalled();
  });
  it("does not cache failed asset responses", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValue({ ok: false, type: "basic", clone: () => "404" });
    await sw.request("/AppFinanza/_next/static/missing.js");
    expect(sw.put).not.toHaveBeenCalled();
  });
  it("uses the offline page only when navigation fails and never caches HTML", async () => {
    const sw = worker();
    await sw.request("/AppFinanza/auth/callback/?code=private", "navigate");
    expect(sw.put).not.toHaveBeenCalled();
    sw.fetch.mockRejectedValue(new Error("offline"));
    sw.match.mockResolvedValue("offline page");
    const event = await sw.request("/AppFinanza/dashboard/", "navigate");
    expect(await event.respondWith.mock.calls[0][0]).toBe("offline page");
    expect(sw.match).toHaveBeenCalledWith("https://example.com/AppFinanza/offline.html");
    expect(sw.put).not.toHaveBeenCalled();
  });
  it("cleans only its own obsolete caches and activates updates on request", async () => {
    const sw = worker();
    sw.caches.keys.mockResolvedValue(["appfinanza-/AppFinanza/-old", "appfinanza-/AppFinanza/-__BUILD_VERSION__", "appfinanza-/OtherApp/-old", "unrelated", "appfinanza-static-v2"]);
    const waitUntil = vi.fn();
    sw.handlers.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(sw.caches.delete.mock.calls.map(([name]) => name)).toEqual(["appfinanza-/AppFinanza/-old", "appfinanza-static-v2"]);
    expect(sw.claim).toHaveBeenCalledOnce();
    sw.handlers.message({ data: { type: "OTHER" } });
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    sw.handlers.message({ data: { type: "SKIP_WAITING" } });
    expect(sw.skipWaiting).toHaveBeenCalledOnce();
  });
});

