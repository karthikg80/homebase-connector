import type {
  ConnectorResult,
  LaunchPayload,
  RegisterResourceInput
} from "./types";
import { firstCircleId } from "./launch";

export type ResourceConfigSlice = {
  url?: string;
  appKey?: string;
  serviceSecret?: string;
  resourceType?: string;
  accessRequired?: boolean;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postWithSecret(
  url: string,
  body: unknown,
  secret: string,
  fetchImpl: typeof globalThis.fetch | undefined,
  timeoutMs: number
): Promise<ConnectorResult> {
  if (!fetchImpl) {
    return { ok: false, error: new Error("no fetch implementation available") };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`
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

export async function hasAppEntitlement(
  launch: LaunchPayload | null,
  config: ResourceConfigSlice
): Promise<boolean> {
  if (!config.accessRequired) return true;
  if (!launch) return false;
  if (!config.serviceSecret || !config.appKey || !config.url) return false;

  const fetchImpl = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 2000;
  const result = await postWithSecret(
    `${config.url}/api/app-access/check`,
    {
      appKey: config.appKey,
      circleId: firstCircleId(launch) || undefined,
      email: launch.email,
      userId: launch.sub
    },
    config.serviceSecret,
    fetchImpl,
    timeoutMs
  );

  if (!result.ok) return false;
  const body = result.body as { allowed?: boolean } | undefined;
  return body?.allowed === true;
}

export async function registerResource(
  input: RegisterResourceInput,
  config: ResourceConfigSlice
): Promise<ConnectorResult> {
  if (
    !config.serviceSecret ||
    !config.appKey ||
    !config.resourceType ||
    !config.url ||
    !input.circleId
  ) {
    return { ok: true, status: 0 };
  }

  const fetchImpl = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 2000;
  return postWithSecret(
    `${config.url}/api/app-resources`,
    {
      appKey: config.appKey,
      circleId: input.circleId,
      resourceType: config.resourceType,
      resourceLabel: input.label,
      resourceUrl: input.url,
      externalId: input.slug,
      createdBy: input.createdBy,
      metadata: input.metadata ?? { slug: input.slug }
    },
    config.serviceSecret,
    fetchImpl,
    timeoutMs
  );
}
