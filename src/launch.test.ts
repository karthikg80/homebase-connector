import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createConnector } from "./index";
import type { LaunchPayload } from "./types";

const SECRET = "test-secret";
const APP_KEY = "dosebuddy";

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function mintToken(
  payload: Partial<LaunchPayload> & { app_key?: string },
  secret: string = SECRET
): string {
  const fullPayload: LaunchPayload = {
    app_key: payload.app_key ?? APP_KEY,
    aud: payload.aud ?? "homebase-app-launch",
    email: payload.email ?? "user@example.com",
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 60,
    iat: payload.iat ?? Math.floor(Date.now() / 1000),
    sub: payload.sub ?? "user-1",
    circle_ids: payload.circle_ids,
    resource_external_id: payload.resource_external_id,
    resource_id: payload.resource_id,
    resource_role: payload.resource_role,
    resource_type: payload.resource_type
  };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(fullPayload));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function baseConfig(extra: Record<string, unknown> = {}) {
  return {
    appKey: APP_KEY,
    jwtSecret: SECRET,
    resourceType: "tracker",
    ...extra
  };
}

describe("verifyLaunchToken", () => {
  it("returns payload for a valid signature + app_key + aud + non-expired exp", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({ sub: "user-42", email: "v@x.com" });
    const result = c.verifyLaunchToken(token);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe("user-42");
    expect(result?.email).toBe("v@x.com");
  });

  it("returns null on bad signature", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({}, "wrong-secret");
    expect(c.verifyLaunchToken(token)).toBeNull();
  });

  it("returns null when expired", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({ exp: Math.floor(Date.now() / 1000) - 1 });
    expect(c.verifyLaunchToken(token)).toBeNull();
  });

  it("returns null when app_key does not match config", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({ app_key: "chorewheel" });
    expect(c.verifyLaunchToken(token)).toBeNull();
  });

  it("returns null when jwtSecret config is missing", () => {
    const c = createConnector({ appKey: APP_KEY, resourceType: "tracker" });
    const token = mintToken({});
    expect(c.verifyLaunchToken(token)).toBeNull();
  });

  it("returns null when appKey config is missing", () => {
    const c = createConnector({ jwtSecret: SECRET, resourceType: "tracker" });
    const token = mintToken({});
    expect(c.verifyLaunchToken(token)).toBeNull();
  });

  it("returns null when token is undefined", () => {
    const c = createConnector(baseConfig());
    expect(c.verifyLaunchToken(undefined)).toBeNull();
  });

  it("returns null on malformed token (not 3 parts)", () => {
    const c = createConnector(baseConfig());
    expect(c.verifyLaunchToken("not.a.jwt.token")).toBeNull();
    expect(c.verifyLaunchToken("only-one-part")).toBeNull();
  });

  it("returns null when aud is wrong", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({ aud: "something-else" as unknown as "homebase-app-launch" });
    expect(c.verifyLaunchToken(token)).toBeNull();
  });
});

describe("hasResourceAccess", () => {
  it("returns true when type, slug, and family role match", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({
      resource_type: "tracker",
      resource_external_id: "med-x",
      resource_role: "family"
    });
    expect(c.hasResourceAccess(token, "med-x", "family")).toBe(true);
  });

  it("family role accepts admin role on the token", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({
      resource_type: "tracker",
      resource_external_id: "med-x",
      resource_role: "admin"
    });
    expect(c.hasResourceAccess(token, "med-x", "family")).toBe(true);
  });

  it("admin role rejects family role on the token", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({
      resource_type: "tracker",
      resource_external_id: "med-x",
      resource_role: "family"
    });
    expect(c.hasResourceAccess(token, "med-x", "admin")).toBe(false);
  });

  it("returns false on wrong resource_type", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({
      resource_type: "household",
      resource_external_id: "med-x",
      resource_role: "admin"
    });
    expect(c.hasResourceAccess(token, "med-x", "family")).toBe(false);
  });

  it("returns false on slug mismatch", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({
      resource_type: "tracker",
      resource_external_id: "other",
      resource_role: "admin"
    });
    expect(c.hasResourceAccess(token, "med-x", "family")).toBe(false);
  });

  it("returns false when config.resourceType is missing", () => {
    const c = createConnector({ appKey: APP_KEY, jwtSecret: SECRET });
    const token = mintToken({
      resource_type: "tracker",
      resource_external_id: "med-x",
      resource_role: "admin"
    });
    expect(c.hasResourceAccess(token, "med-x", "family")).toBe(false);
  });
});

describe("hasLaunchAccess", () => {
  it("returns true when accessRequired is false, even with no token", () => {
    const c = createConnector(baseConfig({ accessRequired: false }));
    expect(c.hasLaunchAccess(undefined)).toBe(true);
  });

  it("returns true when accessRequired is true and token is valid", () => {
    const c = createConnector(baseConfig({ accessRequired: true }));
    const token = mintToken({});
    expect(c.hasLaunchAccess(token)).toBe(true);
  });

  it("returns false when accessRequired is true and token is invalid", () => {
    const c = createConnector(baseConfig({ accessRequired: true }));
    expect(c.hasLaunchAccess("garbage")).toBe(false);
  });

  it("returns false when accessRequired is true and token missing", () => {
    const c = createConnector(baseConfig({ accessRequired: true }));
    expect(c.hasLaunchAccess(undefined)).toBe(false);
  });
});

describe("firstCircleId", () => {
  it("returns the first circle id of the array", () => {
    const c = createConnector(baseConfig());
    expect(c.firstCircleId({ circle_ids: ["c1", "c2"] } as LaunchPayload)).toBe("c1");
  });

  it("returns empty string for null launch", () => {
    const c = createConnector(baseConfig());
    expect(c.firstCircleId(null)).toBe("");
  });

  it("returns empty string when circle_ids is missing", () => {
    const c = createConnector(baseConfig());
    expect(c.firstCircleId({} as LaunchPayload)).toBe("");
  });

  it("returns empty string when circle_ids is empty", () => {
    const c = createConnector(baseConfig());
    expect(c.firstCircleId({ circle_ids: [] } as unknown as LaunchPayload)).toBe("");
  });
});

describe("navFromToken", () => {
  it("returns email, homebaseUrl from config.url, and role from launch", () => {
    const c = createConnector(baseConfig({ url: "https://h.example" }));
    const token = mintToken({
      email: "v@x.com",
      resource_role: "admin"
    });
    expect(c.navFromToken(token)).toEqual({
      email: "v@x.com",
      homebaseUrl: "https://h.example",
      role: "admin"
    });
  });

  it("returns null on invalid token", () => {
    const c = createConnector(baseConfig());
    expect(c.navFromToken("bad")).toBeNull();
  });

  it("falls back to default homebase url when config.url missing", () => {
    const c = createConnector(baseConfig());
    const token = mintToken({});
    const nav = c.navFromToken(token);
    expect(nav?.homebaseUrl).toBe("https://homebase.karthikg.in");
  });
});
