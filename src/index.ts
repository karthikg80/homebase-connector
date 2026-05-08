import type {
  CallOptions,
  Connector,
  ConnectorConfig,
  ConnectorResult,
  LaunchNavContext,
  LaunchPayload,
  LinkPersonInput,
  RegisterResourceInput,
  ReportEventInput,
  ResourceRole
} from "./types";
import {
  firstCircleId as firstCircleIdImpl,
  hasLaunchAccess as hasLaunchAccessImpl,
  hasResourceAccess as hasResourceAccessImpl,
  navFromToken as navFromTokenImpl,
  verifyToken as verifyTokenImpl
} from "./launch";
import {
  hasAppEntitlement as hasAppEntitlementImpl,
  registerResource as registerResourceImpl
} from "./resource";

export { requireEnv, assertEnv } from "./env";

export type {
  CallOptions,
  Connector,
  ConnectorConfig,
  ConnectorResult,
  LaunchNavContext,
  LaunchPayload,
  LinkPersonInput,
  RegisterResourceInput,
  ReportEventInput,
  ResourceRole
} from "./types";

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeOccursAt(value: ReportEventInput["occursAt"]): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function describeError(result: { status?: number; error: unknown }): string {
  const status = result.status != null ? `status ${result.status}` : "no status";
  const err = result.error instanceof Error ? result.error.message : JSON.stringify(result.error);
  return `${status}: ${err}`;
}

function normalizeEvent(input: ReportEventInput) {
  return {
    kind: input.kind,
    occursAt: normalizeOccursAt(input.occursAt),
    subjectExternalId: input.subjectExternalId ?? null,
    actorExternalId: input.actorExternalId ?? null,
    title: input.title ?? null,
    description: input.description ?? null,
    sourceAppEventId: input.sourceAppEventId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    payload: input.payload ?? {}
  };
}

export function createConnector(config: ConnectorConfig): Connector {
  const connected = Boolean(
    config.url && config.appKey && config.circleId && config.token
  );

  const fetchImpl = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 2000;

  async function doRequest(path: string, body: unknown): Promise<ConnectorResult> {
    if (!fetchImpl) {
      return { ok: false, error: new Error("no fetch implementation available") };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
    try {
      const response = await fetchImpl(`${config.url}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      const parsed = text ? safeJson(text) : undefined;
      if (!response.ok) {
        return { ok: false, status: response.status, error: parsed ?? text };
      }
      return { ok: true, status: response.status, body: parsed };
    } catch (error) {
      return { ok: false, error };
    } finally {
      clearTimeout(timer);
    }
  }

  async function reportEvent(input: ReportEventInput, opts?: CallOptions): Promise<ConnectorResult> {
    if (!connected) return { ok: true, status: 0 };
    const result = await doRequest("/api/connector/events", normalizeEvent(input));
    if (!result.ok && opts?.throwOnError) {
      throw new Error(`[homebase-connector] reportEvent failed: ${describeError(result)}`);
    }
    return result;
  }

  async function linkPerson(input: LinkPersonInput, opts?: CallOptions): Promise<ConnectorResult> {
    if (!connected) return { ok: true, status: 0 };
    const result = await doRequest("/api/connector/people/link", input);
    if (!result.ok && opts?.throwOnError) {
      throw new Error(`[homebase-connector] linkPerson failed: ${describeError(result)}`);
    }
    return result;
  }

  function verifyLaunchToken(token: string | undefined): LaunchPayload | null {
    return verifyTokenImpl(token, config);
  }

  function hasLaunchAccess(token: string | undefined): boolean {
    return hasLaunchAccessImpl(token, config);
  }

  function hasResourceAccess(
    token: string | undefined,
    slug: string,
    role: ResourceRole
  ): boolean {
    return hasResourceAccessImpl(token, slug, role, config);
  }

  function firstCircleId(launch: LaunchPayload | null): string {
    return firstCircleIdImpl(launch);
  }

  function navFromToken(token: string | undefined): LaunchNavContext | null {
    return navFromTokenImpl(token, config);
  }

  async function hasAppEntitlement(launch: LaunchPayload | null): Promise<boolean> {
    return hasAppEntitlementImpl(launch, { ...config, fetch: fetchImpl, timeoutMs });
  }

  async function registerResource(input: RegisterResourceInput): Promise<ConnectorResult> {
    return registerResourceImpl(input, { ...config, fetch: fetchImpl, timeoutMs });
  }

  return {
    get connected() { return connected; },
    reportEvent,
    linkPerson,
    verifyLaunchToken,
    hasLaunchAccess,
    hasResourceAccess,
    firstCircleId,
    navFromToken,
    hasAppEntitlement,
    registerResource
  };
}
