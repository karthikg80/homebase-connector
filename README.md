# @homebase/connector

Optional-federation client library for [Homebase](https://github.com/karthikg80/homebase) family-control-plane apps. Apps remain fully standalone when env vars are absent; when configured, they push family-relevant events to Homebase.

## Install

```json
{
  "dependencies": {
    "@homebase/connector": "github:karthikg80/homebase-connector#v0.1.0"
  }
}
```

Source-as-distribution: this package ships TypeScript source. Next.js, Vite, and most modern bundlers handle that fine. No build step.

## Usage

```ts
import { createConnector } from "@homebase/connector";

export const homebase = createConnector({
  url: process.env.HOMEBASE_URL,
  appKey: process.env.HOMEBASE_APP_KEY,
  circleId: process.env.HOMEBASE_CIRCLE_ID,
  token: process.env.HOMEBASE_SERVICE_TOKEN
});

// Disconnected: no-op, returns { ok: true, status: 0 }
// Connected: POSTs to ${url}/api/connector/events
const r = await homebase.reportEvent({
  kind: "chore.due",
  occursAt: new Date(),                  // Date | string | null
  subjectExternalId: "user_42",          // app's internal user/subject id
  title: "Take out trash",
  sourceAppEventId: "chore_8821",        // idempotency key
  sourceUrl: "/chores/8821"              // absolute or app-relative
});

// Map app-local identity to a family_person
await homebase.linkPerson({
  externalUserId: "user_42",
  externalEmail: "vivaan@example.com",
  displayLabel: "Vivaan"
});
```

## Environment

| Var | Description |
|---|---|
| `HOMEBASE_URL` | e.g. `https://homebase.karthikg.in` |
| `HOMEBASE_APP_KEY` | matches `core.app_catalog.app_key` for this deployment |
| `HOMEBASE_CIRCLE_ID` | the Homebase circle this app instance is connected to |
| `HOMEBASE_SERVICE_TOKEN` | bearer token from `app_connector_credentials` |

If any are missing, `connector.connected` is false and all calls are no-ops. Apps should ship without these set in their default config so the standalone share-by-link flow keeps working.

## Behavior

- **Best-effort async.** Errors are wrapped in `ConnectorResult`, not thrown. Callers can opt into strict mode via `{ throwOnError: true }`.
- **2-second default timeout.** Configurable via `createConnector({ timeoutMs })`.
- **No retry/queue.** Loss is acceptable in v1.
- **Always `await` on Vercel serverless.** Without `await` (or `waitUntil` on Edge), a fetch can be terminated when the function instance recycles.

## Versioning

`vMAJOR.MINOR.PATCH` git tags. Patch is non-breaking; minor adds methods; major changes wire format. Coordinate major bumps with the corresponding Homebase ingestion change.

## Development

```bash
npm install
npm test
npm run typecheck
```

## License

Internal — UNLICENSED.
