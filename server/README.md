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
