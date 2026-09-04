# Google OAuth scopes

Two consent screens, not one. Signing in asks for the minimum that identifies a customer and reads
their own channel; publishing asks for the rest, later, only from customers who publish. Google calls
this incremental authorization, and it is why `include_granted_scopes=true` is set on both requests —
the second consent returns a token carrying the union of what has been granted, so the first grant is
not lost.

## Sign-in — `GOOGLE_SIGN_IN_SCOPES` in `src/lib/utils/googleOAuth.ts`

| Scope                       | Why it is needed                                                                                      | Sensitivity    |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| `openid`                    | Returns the `sub` claim — the account's permanent id, stored as `auth_identities.provider_account_id` | none           |
| `email`                     | Display and contact only. **Never** an identity key: addresses change hands, `sub` does not           | none           |
| `profile`                   | Name and avatar for the topbar                                                                        | none           |
| `.../auth/youtube.readonly` | `channels.list(mine=true)` to find the channel to link, and the uploads playlist to list videos       | **restricted** |

`youtube.readonly` is what makes the first screen a restricted-scope screen. It is still requested at
sign-in rather than deferred, because linking a channel _is_ signing up here — a customer with no
linked channel has nothing to look at.

## Publishing — `GOOGLE_OAUTH_SCOPES` in `src/lib/services/publish/oauth.ts`

| Scope                       | Why it is needed                         | Sensitivity    |
| --------------------------- | ---------------------------------------- | -------------- |
| `.../auth/youtube.upload`   | `videos.insert` for a rendered clip      | **restricted** |
| `.../auth/youtube.readonly` | re-requested so the union is unambiguous | **restricted** |

## Not requested yet

| Scope                            | What it would buy                                                                                   | Cost                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `.../auth/youtube.force-ssl`     | `captions.download` — the owner's real caption track, instead of scraping or transcribing the audio | 200 quota units per download, and a wider restricted-scope review |
| `.../auth/yt-analytics.readonly` | Per-video performance to rank what is worth clipping                                                | another restricted scope, no v1 use                               |

`force-ssl` is deliberately deferred to Phase 4 of [product-foundation.md](../plans/product-foundation.md).
The transcript chain already has three sources that need no additional consent, and adding a fourth
restricted scope to the sign-in screen to save a yt-dlp call is the wrong trade before there are
customers.

## What restricted scopes cost

Google requires an annual security assessment for apps using restricted YouTube scopes in production,
plus a verified OAuth consent screen, a privacy policy and a homepage on a verified domain. Until that
is done the app stays in testing mode, where only accounts added to the test-user list can sign in and
refresh tokens expire after seven days.

Practical consequence for development: add each tester's Google account under **OAuth consent screen →
Test users** in the Cloud console, and expect a re-consent every week.

## Where the values live

| Setting                | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Shared by both flows                                                |
| `GOOGLE_CLIENT_SECRET` | Web-application client type; the PKCE verifier is sent alongside it |
| `GOOGLE_REDIRECT_URI`  | Must match the console entry byte for byte, port included           |

Sign-in requests `access_type=offline` with `prompt=consent`, because Google returns a refresh token
only on the first consent otherwise — and without one, a customer's channel goes dark an hour after
they link it.
