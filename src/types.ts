export type ConnectorConfig = {
  url?: string;
  appKey?: string;
  circleId?: string;
  token?: string;
  jwtSecret?: string;
  serviceSecret?: string;
  resourceType?: string;
  accessRequired?: boolean;
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

export type ResourceRole = "admin" | "family";

export type LaunchPayload = {
  app_key: string;
  aud: "homebase-app-launch";
  circle_ids?: string[];
  email: string;
  exp: number;
  iat: number;
  resource_external_id?: string;
  resource_id?: string;
  resource_role?: ResourceRole;
  resource_type?: string;
  sub: string;
};

export type LaunchNavContext = {
  email: string;
  homebaseUrl: string;
  role: ResourceRole | null;
};

export type RegisterResourceInput = {
  circleId: string;
  createdBy: string;
  label: string;
  slug: string;
  url: string;
  metadata?: Record<string, unknown>;
};

export type Connector = {
  readonly connected: boolean;
  reportEvent(input: ReportEventInput, opts?: CallOptions): Promise<ConnectorResult>;
  linkPerson(input: LinkPersonInput, opts?: CallOptions): Promise<ConnectorResult>;
  verifyLaunchToken(token: string | undefined): LaunchPayload | null;
  hasLaunchAccess(token: string | undefined): boolean;
  hasResourceAccess(token: string | undefined, slug: string, role: ResourceRole): boolean;
  firstCircleId(launch: LaunchPayload | null): string;
  navFromToken(token: string | undefined): LaunchNavContext | null;
  hasAppEntitlement(launch: LaunchPayload | null): Promise<boolean>;
  registerResource(input: RegisterResourceInput): Promise<ConnectorResult>;
};
