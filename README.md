# @homebase/connector

Optional-federation client library for [Homebase](https://github.com/karthikg80/homebase) family-control-plane apps. Apps remain fully standalone when env vars are absent; when configured, they push family-relevant events to Homebase.

## Install

```json
{
  "dependencies": {
    "@homebase/connector": "git+https://github.com/karthikg80/homebase-connector.git#v0.2.0"
  }
}
```

Source-as-distribution: this package ships TypeScript source. Next.js (webpack), Vite, and most modern bundlers handle that fine.

### Next.js + Turbopack

Turbopack treats `.ts` files inside `node_modules` as opaque unless explicitly transpiled. Add this to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@homebase/connector"],
};
```

Without this, the build fails with `Unknown module type ./node_modules/@homebase/connector/src/index.ts`.

## Usage

```ts
import { createConnector } from "@homebase/connector";

export const homebase = createConnector({
  url: process.env.HOMEBASE_URL,
  appKey: process.env.HOMEBASE_APP_KEY,
  circleId: process.env.HOMEBASE_CIRCLE_ID,
  token: process.env.HOMEBASE_SERVICE_TOKEN,
  jwtSecret: process.env.HOMEBASE_APP_JWT_SECRET,         // optional: launch-token verify
  serviceSecret: process.env.HOMEBASE_APP_SERVICE_SECRET, // optional: resource + entitlement
  resourceType: "tracker",                                // app-specific: tracker / household / board
  accessRequired: process.env.HOMEBASE_ACCESS_REQUIRED === "true"
});

// Event reporting (v0.1)
const r = await homebase.reportEvent({
  kind: "chore.due",
  occursAt: new Date(),
  subjectExternalId: "user_42",
  title: "Take out trash",
  sourceAppEventId: "chore_8821",
  sourceUrl: "/chores/8821"
});

await homebase.linkPerson({
  externalUserId: "user_42",
  externalEmail: "vivaan@example.com",
  displayLabel: "Vivaan"
});

// Launch-token verification (v0.2)
const launch = homebase.verifyLaunchToken(token);
const ok = homebase.hasLaunchAccess(token);
const canEdit = homebase.hasResourceAccess(token, "med-x", "admin");
const nav = homebase.navFromToken(token);
const circleId = homebase.firstCircleId(launch);

// Async (v0.2)
const entitled = await homebase.hasAppEntitlement(launch);
await homebase.registerResource({
  circleId,
  createdBy: "user-1",
  label: "Med X",
  slug: "med-x",
  url: "/m/med-x"
});
```

## Environment

| Var | Description |
|---|---|
| `HOMEBASE_URL` | e.g. `https://homebase.karthikg.in` |
| `HOMEBASE_APP_KEY` | matches `core.app_catalog.app_key` for this deployment |
| `HOMEBASE_CIRCLE_ID` | the Homebase circle this app instance is connected to |
| `HOMEBASE_SERVICE_TOKEN` | bearer token from `app_connector_credentials` |
| `HOMEBASE_APP_JWT_SECRET` | (v0.2) HMAC-SHA256 secret used to verify launch tokens |
| `HOMEBASE_APP_SERVICE_SECRET` | (v0.2) bearer secret for `/api/app-resources` and `/api/app-access/check` |
| `HOMEBASE_ACCESS_REQUIRED` | (v0.2) `"true"` to require entitlement before allowing app actions |

If `url`/`appKey`/`circleId`/`token` are missing, `connector.connected` is false and event/link calls are no-ops. The launch-token / resource methods independently degrade: missing `jwtSecret` -> `verifyLaunchToken` returns null; missing `serviceSecret` -> `registerResource` no-ops and `hasAppEntitlement` returns false (when access is required). Apps should ship without these set in their default config so the standalone share-by-link flow keeps working.

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
