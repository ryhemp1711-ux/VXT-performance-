# VXT Coach foundation — milestone 1

The initial job is to review one athlete's saved evidence and draft a next-session recommendation for coach approval. This change implements the isolated context boundary, not a working AI coach or deployed endpoint.

`coach.cjs` exports a Fetch-compatible POST handler factory. It accepts only `{ "athleteId": "…" }` with a bearer token. A production host must supply verified authentication and an RLS-protected workspace reader. The handler also checks workspace ownership. The current database authorizes workspace owners, not independent athlete accounts; an athlete-view UI is not a permission boundary.

Responses contain only selected fields for the requested athlete, cloud revision/time, explicit missing inputs and limitations. Names, free-text notes, predictions and video claims are excluded. Year-only results are not treated as recent results. The response is always `needs_information`, with a null recommendation. There is no provider call, billing, persistence, or automatic workout assignment.

## Next integration steps

1. Deploy a server runtime with verified Supabase auth and owner-scoped reads using the caller's token. Test two real accounts against RLS.
2. Add a profile action explaining what selected athlete data goes to the model. Require cloud upload when local records differ; display snapshot freshness.
3. Collect current readiness, equipment, training time and exact age where needed. Turn Ryan's reviewed coaching principles into versioned rules; do not infer them from free text.
4. Add a server-only model adapter, secret configuration, per-account request/cost limits and timeout handling. Treat athlete goals and all record text as untrusted data.
5. Validate structured drafts, allowed exercises, volume/recovery constraints and cited record IDs. Model output remains untrusted; rule violations block the draft. Require explicit coach approval before a separate authorized save operation.
6. Evaluate fictional cases: youth athlete, sparse history, mixed timing methods, stale cloud data, reported pain, conflicting workouts, prompt injection and cross-account access. Live testing and model accuracy are not established by the unit tests.

Keep provider transport and identity separate from VXT context and coaching rules. Other specialties need their own data adapters, expertise, evaluation sets and deployment requirements.

## Milestone 2: private AI evidence-review pilot

The profile now includes **Load cloud evidence** and **Review with AI**. The browser requests an explicit data-sharing acknowledgment before model review. It renders all model text as text, clears results when records/athlete/account change, and suppresses stale responses. Names and private notes are omitted; selected goals are still free text and may contain identifying information. Cloud sync remains manual. The UI shows snapshot revision/time and warns that local edits are absent. AI observations cite measured result IDs, which the server validates; this does not establish that every claim is factually correct.

`server/start.cjs` runs on Node 22+ and supplies real Supabase REST authentication and owner-scoped reads, without a service-role key. It connects to the OpenAI Responses API only for explicit reviews. It does not generate or save workout prescriptions.

Configure these **server-side** environment variables through the host's secret/settings controls:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: same project as `sync.js`.
- `VXT_ALLOWED_ORIGIN`: exact frontend origin, e.g. `https://ryhemp1711-ux.github.io`.
- `VXT_COACH_USER_IDS`: comma-separated Supabase user UUIDs authorized for the private pilot.
- `OPENAI_API_KEY`: server secret, never commit it or put it in browser configuration.
- `OPENAI_MODEL`: explicitly choose a model supporting Responses JSON-schema outputs; availability must be checked in the deployment account.
- Optional `PORT` (8787) and `HOST` (127.0.0.1). Use an HTTPS reverse proxy for production and bind appropriately for the host.

Run `node server/start.cjs`. Set the public `endpoint` in `coach-config.js` to the deployed HTTPS `/api/coach` URL. With no endpoint, the page honestly displays an inactive preview. With no provider settings, cloud context can still be reviewed but AI requests return unavailable.

Pilot access is restricted to the explicit account allowlist; model requests are capped at 20/account/UTC day per running process. This counter resets on restart and is **not** suitable for a public or multi-instance service: implement durable quota accounting and infrastructure request limits before widening access. Model requests have a 30-second timeout and an output-token cap; inputs are size-bounded. `store:false` disables Responses application-state storage but does not promise zero provider retention. No request payloads or credentials are logged by this code.

Before activation: configure secrets privately, verify two-account isolation against real Supabase RLS, verify approved provider data handling (including youth records), test a synthetic athlete end-to-end, and review groundedness/prompt-injection cases. Automated tests use mocked providers/auth; no live model, live RLS or physical iPhone execution has been claimed. The static GitHub Pages site alone cannot run this Node backend.
