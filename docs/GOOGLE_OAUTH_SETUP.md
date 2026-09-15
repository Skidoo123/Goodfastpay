# Google Sign-In Setup (Supabase OAuth)

Code is shipped and hardened. These **5 dashboard steps** (all manual, ~20 min)
are what actually turns Google sign-in on. Nothing works until they are done.

## 1. Google Cloud Console — OAuth client

1. Go to **APIs & Services → Credentials** (create a project if needed).
2. **Configure OAuth consent screen** → External → fill app name, support email,
   developer contact. Add scopes: `openid`, `email`, `profile`. Publish the app
   (Testing mode caps at 100 users and tokens expire in 7 days — publish it).
3. **Create Credentials → OAuth client ID → Web application.**
4. **Authorized JavaScript origins** — add exactly:
   - `http://localhost:3000` (local dev)
   - `https://goodfastpay.com`
   - `https://www.goodfastpay.com`
5. **Authorized redirect URIs** — Supabase handles the code exchange, so add your
   project's callback URL (from step 2):
   - `https://<project-ref>.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client secret** into a password manager.

## 2. Supabase Dashboard — enable Google provider

1. **Authentication → Providers → Google → Enable.**
2. Paste Client ID + Client secret from step 1.
3. **Authentication → URL Configuration:**
   - Site URL: `https://goodfastpay.com`
   - Redirect URLs (one per line — must match where login starts):
     - `http://localhost:3000/**`
     - `https://goodfastpay.com/**`
     - `https://www.goodfastpay.com/**`
4. Save. Supabase now signs the PKCE flow; the repo code only allowlists
   `google|github|apple` and never mints local sessions.

## 3. Environment

No new env vars. The browser uses the existing anon key via `/api/config`;
the server verifies the resulting JWT with `auth.getUser()` in
`api/_lib/auth.js` — Google-issued tokens verify identically to password ones.

## 4. Test plan (staging first)

- [ ] Click **Continue with Google** → Google consent → redirect back → lands in portal, no console errors
- [ ] Deny consent at Google → lands back with an error toast, no session created
- [ ] Direct-visit `portal.html` with no session → bounced to login
- [ ] Same Gmail via password signup later → Supabase links identities; role stays `USER`
- [ ] `npm test` + `bash audit/scripts/full-audit.sh` green
- [ ] Revoke access at `myaccount.google.com/permissions` → next API call 401s (session invalid)

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` at Google | Origin/redirect not allowlisted | Step 1.4–1.5 exact strings, no trailing slash on origins |
| `unauthorized_client` | Consent screen still in Testing with an outside user | Publish the consent screen, or add the user as test user |
| Redirect lands but no session | Supabase Redirect URLs missing the page | Step 2.3 — include the exact path pattern |
| `Unsupported provider` toast | Provider not in `OAUTH_ALLOWED_PROVIDERS` | Intentional — add to allowlist in `js/supabase-config.js` + test |
| "Online sign-in unavailable" toast | `/api/config` returned nothing | Set `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` on the deploy |

## Security notes

- PKCE + `state` are handled by `supabase-js` v2; the repo never sees OAuth codes.
- `prompt: consent` + `offline` access are Google-only; other providers get `{}`.
- Roles are never taken from OAuth metadata — `profiles.role` defaults to `USER`;
  admins are granted via audited SQL/API only.
- The old demo fallback (fake `*.trader@goodfastpay.com` accounts) is deleted.
