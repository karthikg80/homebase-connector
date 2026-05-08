import { describe, it, expect, vi } from "vitest";
import { createConnector } from "./index";
import type { LaunchPayload } from "./types";

function fakeLaunch(extra: Partial<LaunchPayload> = {}): LaunchPayload {
  return {
    app_key: "dosebuddy",
    aud: "homebase-app-launch",
    email: "v@x.com",
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    sub: "user-1",
    circle_ids: ["circle-1"],
    ...extra
  };
}

describe("registerResource", () => {
  it("no-ops when serviceSecret is missing", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      resourceType: "tracker",
      fetch
    });
    const r = await c.registerResource({
      circleId: "c-1",
      createdBy: "u-1",
      label: "Med X",
      slug: "med-x",
      url: "/m/med-x"
    });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no-ops when resourceType is missing", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      fetch
    });
    const r = await c.registerResource({
      circleId: "c-1",
      createdBy: "u-1",
      label: "x",
      slug: "x",
      url: "/x"
    });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no-ops when input.circleId is missing", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      resourceType: "tracker",
      fetch
    });
    const r = await c.registerResource({
      circleId: "",
      createdBy: "u-1",
      label: "x",
      slug: "x",
      url: "/x"
    });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no-ops when url config is missing", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      appKey: "dosebuddy",
      serviceSecret: "svc",
      resourceType: "tracker",
      fetch
    });
    const r = await c.registerResource({
      circleId: "c-1",
      createdBy: "u-1",
      label: "x",
      slug: "x",
      url: "/x"
    });
    expect(r).toEqual({ ok: true, status: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs the right body and headers when fully configured", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc-secret",
      resourceType: "tracker",
      fetch
    });
    const r = await c.registerResource({
      circleId: "c-1",
      createdBy: "u-1",
      label: "Med X",
      slug: "med-x",
      url: "/m/med-x"
    });
    expect(r.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://h/api/app-resources");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer svc-secret");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      appKey: "dosebuddy",
      circleId: "c-1",
      resourceType: "tracker",
      resourceLabel: "Med X",
      resourceUrl: "/m/med-x",
      externalId: "med-x",
      createdBy: "u-1",
      metadata: { slug: "med-x" }
    });
  });

  it("returns ok:false on non-2xx without throwing", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "nope" }), { status: 500 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      resourceType: "tracker",
      fetch
    });
    const r = await c.registerResource({
      circleId: "c-1",
      createdBy: "u-1",
      label: "x",
      slug: "x",
      url: "/x"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });
});

describe("hasAppEntitlement", () => {
  it("returns true when accessRequired is false (short-circuits even with null launch)", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: false,
      fetch
    });
    expect(await c.hasAppEntitlement(null)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns false when accessRequired and launch is null", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: true,
      fetch
    });
    expect(await c.hasAppEntitlement(null)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns false when serviceSecret is missing", async () => {
    const fetch = vi.fn();
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      accessRequired: true,
      fetch
    });
    expect(await c.hasAppEntitlement(fakeLaunch())).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs correct body shape and parses { allowed: true }", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ allowed: true }), { status: 200 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: true,
      fetch
    });
    const r = await c.hasAppEntitlement(fakeLaunch({ sub: "user-9", email: "a@b" }));
    expect(r).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://h/api/app-access/check");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer svc");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      appKey: "dosebuddy",
      circleId: "circle-1",
      email: "a@b",
      userId: "user-9"
    });
  });

  it("parses { allowed: false } as false", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ allowed: false }), { status: 200 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: true,
      fetch
    });
    expect(await c.hasAppEntitlement(fakeLaunch())).toBe(false);
  });

  it("returns false on non-2xx response", async () => {
    const fetch = vi.fn(async () =>
      new Response("nope", { status: 500 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: true,
      fetch
    });
    expect(await c.hasAppEntitlement(fakeLaunch())).toBe(false);
  });

  it("omits circleId when no circle_ids on launch", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ allowed: true }), { status: 200 })
    );
    const c = createConnector({
      url: "https://h",
      appKey: "dosebuddy",
      serviceSecret: "svc",
      accessRequired: true,
      fetch
    });
    await c.hasAppEntitlement(fakeLaunch({ circle_ids: undefined }));
    const body = JSON.parse(fetch.mock.calls[0]![1]?.body as string);
    expect(body.circleId).toBeUndefined();
  });
});
