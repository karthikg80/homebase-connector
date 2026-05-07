import { describe, it, expect, vi } from "vitest";
import { createConnector } from "./index";

describe("createConnector", () => {
  it("returns connected: false when any env var is missing", () => {
    expect(createConnector({}).connected).toBe(false);
    expect(createConnector({ url: "https://h" }).connected).toBe(false);
    expect(createConnector({ url: "https://h", appKey: "k" }).connected).toBe(false);
    expect(createConnector({ url: "https://h", appKey: "k", circleId: "c" }).connected).toBe(false);
  });

  it("returns connected: true when all four required fields are present", () => {
    const c = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t"
    });
    expect(c.connected).toBe(true);
  });
});

describe("reportEvent disconnected", () => {
  it("returns { ok: true, status: 0 } and does not call fetch", async () => {
    const fetch = vi.fn();
    const c = createConnector({ fetch });
    const r = await c.reportEvent({ kind: "test.kind" });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("linkPerson disconnected", () => {
  it("returns { ok: true, status: 0 } and does not call fetch", async () => {
    const fetch = vi.fn();
    const c = createConnector({ fetch });
    const r = await c.linkPerson({ externalEmail: "x@x" });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("reportEvent connected", () => {
  function setup() {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, eventId: "evt-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const connector = createConnector({
      url: "https://h.example",
      appKey: "chorewheel",
      circleId: "circle-1",
      token: "tok-secret",
      fetch
    });
    return { connector, fetch };
  }

  it("POSTs to /api/connector/events with bearer token and body", async () => {
    const { connector, fetch } = setup();
    const result = await connector.reportEvent({
      kind: "chore.due",
      occursAt: "2026-05-08T13:00:00Z",
      subjectExternalId: "user_42",
      title: "Take out trash",
      sourceAppEventId: "chore_8821",
      sourceUrl: "/chores/8821",
      payload: { weekly: true }
    });

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://h.example/api/connector/events");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok-secret");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      kind: "chore.due",
      occursAt: "2026-05-08T13:00:00.000Z",
      subjectExternalId: "user_42",
      title: "Take out trash",
      sourceAppEventId: "chore_8821",
      sourceUrl: "/chores/8821",
      payload: { weekly: true }
    });
  });

  it("normalizes Date occursAt to ISO 8601", async () => {
    const { connector, fetch } = setup();
    await connector.reportEvent({
      kind: "x.y",
      occursAt: new Date("2026-05-08T13:00:00Z")
    });
    const init = fetch.mock.calls[0]![1];
    const body = JSON.parse(init?.body as string);
    expect(body.occursAt).toBe("2026-05-08T13:00:00.000Z");
  });

  it("strips appKey/circleId from the body (server uses credential)", async () => {
    const { connector, fetch } = setup();
    await connector.reportEvent({ kind: "x.y" });
    const body = JSON.parse(fetch.mock.calls[0]![1]?.body as string);
    expect(body.appKey).toBeUndefined();
    expect(body.circleId).toBeUndefined();
  });
});

describe("reportEvent connected error handling", () => {
  it("returns { ok: false, status, error } on 4xx without throwing", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "ambiguous_identity_match" }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    );
    const connector = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch
    });
    const result = await connector.reportEvent({ kind: "x.y" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toEqual({ error: "ambiguous_identity_match" });
    }
  });

  it("returns { ok: false, error } on network failure without throwing", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const connector = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch
    });
    const result = await connector.reportEvent({ kind: "x.y" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(TypeError);
    }
  });
});

describe("reportEvent connected timeout", () => {
  it("aborts after timeoutMs and returns ok:false", async () => {
    let abortReason: unknown;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener("abort", () => {
          abortReason = (signal as AbortSignal).reason;
          reject(abortReason ?? new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const connector = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch,
      timeoutMs: 50
    });

    const start = Date.now();
    const result = await connector.reportEvent({ kind: "x.y" });
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(false);
    expect(elapsed).toBeLessThan(500);
    expect(abortReason).toBeDefined();
  });

  it("defaults timeoutMs to 2000 when not configured", async () => {
    const c = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch: vi.fn(async () => new Response("{}", { status: 200 }))
    });
    const r = await c.reportEvent({ kind: "x.y" });
    expect(r.ok).toBe(true);
  });
});

describe("reportEvent throwOnError", () => {
  it("throws when option set and response is non-OK", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "bad" }), { status: 422 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch
    });
    await expect(
      c.reportEvent({ kind: "x.y" }, { throwOnError: true })
    ).rejects.toBeInstanceOf(Error);
  });

  it("does not throw when option is false (default)", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "bad" }), { status: 422 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t",
      fetch
    });
    const result = await c.reportEvent({ kind: "x.y" });
    expect(result.ok).toBe(false);
  });
});
