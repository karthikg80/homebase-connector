export type ConnectorConfig = {
  url?: string;
  appKey?: string;
  circleId?: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export type ConnectorResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; error: unknown };

export type ReportEventInput = {
  kind: string;
  occursAt?: string | Date | null;
  subjectExternalId?: string | null;
  actorExternalId?: string | null;
  title?: string | null;
  description?: string | null;
  sourceAppEventId?: string | null;
  sourceUrl?: string | null;
  payload?: Record<string, unknown>;
};

export type LinkPersonInput = {
  externalUserId?: string | null;
  externalEmail?: string | null;
  displayLabel?: string | null;
  metadata?: Record<string, unknown>;
};

export type CallOptions = {
  throwOnError?: boolean;
};

export type Connector = {
  readonly connected: boolean;
  reportEvent(input: ReportEventInput, opts?: CallOptions): Promise<ConnectorResult>;
  linkPerson(input: LinkPersonInput, opts?: CallOptions): Promise<ConnectorResult>;
};
