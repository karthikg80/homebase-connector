import type {
  CallOptions,
  Connector,
  ConnectorConfig,
  ConnectorResult,
  LinkPersonInput,
  ReportEventInput
} from "./types";

export type {
  CallOptions,
  Connector,
  ConnectorConfig,
  ConnectorResult,
  LinkPersonInput,
  ReportEventInput
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

  async function reportEvent(input: ReportEventInput, _opts?: CallOptions): Promise<ConnectorResult> {
    if (!connected) return { ok: true, status: 0 };
    return doRequest("/api/connector/events", normalizeEvent(input));
  }

  async function linkPerson(_input: LinkPersonInput, _opts?: CallOptions): Promise<ConnectorResult> {
    if (!connected) return { ok: true, status: 0 };
    return { ok: false, error: new Error("not implemented") };
  }

  return {
    get connected() { return connected; },
    reportEvent,
    linkPerson
  };
}
