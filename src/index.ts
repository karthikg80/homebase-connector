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

export function createConnector(config: ConnectorConfig): Connector {
  const connected = Boolean(
    config.url && config.appKey && config.circleId && config.token
  );

  async function reportEvent(_input: ReportEventInput, _opts?: CallOptions): Promise<ConnectorResult> {
    if (!connected) return { ok: true, status: 0 };
    return { ok: false, error: new Error("not implemented") };
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
