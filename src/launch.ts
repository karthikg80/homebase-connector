import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  LaunchNavContext,
  LaunchPayload,
  ResourceRole
} from "./types";

export type LaunchConfigSlice = {
  appKey?: string;
  jwtSecret?: string;
  resourceType?: string;
  accessRequired?: boolean;
  url?: string;
};

const HOMEBASE_AUDIENCE = "homebase-app-launch";

export function verifyToken(
  token: string | undefined,
  config: LaunchConfigSlice
): LaunchPayload | null {
  const { appKey, jwtSecret } = config;
  if (!token || !jwtSecret || !appKey) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as LaunchPayload;
    if (parsed.aud !== HOMEBASE_AUDIENCE) return null;
    if (parsed.app_key !== appKey) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasLaunchAccess(
  token: string | undefined,
  config: LaunchConfigSlice
): boolean {
  if (!config.accessRequired) return true;
  return verifyToken(token, config) !== null;
}

export function hasResourceAccess(
  token: string | undefined,
  slug: string,
  role: ResourceRole,
  config: LaunchConfigSlice
): boolean {
  const launch = verifyToken(token, config);
  if (!launch) return false;
  if (!config.resourceType) return false;
  if (launch.resource_type !== config.resourceType) return false;
  if (launch.resource_external_id !== slug) return false;
  if (role === "family") {
    return launch.resource_role === "family" || launch.resource_role === "admin";
  }
  return launch.resource_role === "admin";
}

export function firstCircleId(launch: LaunchPayload | null): string {
  return launch?.circle_ids?.[0] || "";
}

export function navFromToken(
  token: string | undefined,
  config: LaunchConfigSlice
): LaunchNavContext | null {
  const launch = verifyToken(token, config);
  if (!launch) return null;

  const homebaseUrl = config.url || "https://homebase.karthikg.in";

  return {
    email: launch.email,
    homebaseUrl,
    role: launch.resource_role ?? null
  };
}
