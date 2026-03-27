# Invite Flow Fix + Team Email Notifications

## Problem

1. **Broken invite flow for non-registered users**: When a non-registered user clicks an invite link, they see a "not authenticated" page with login/signup buttons. After signing up and completing the full 4-step onboarding, they lose the invite context and must click the invite link again. Invited members also shouldn't need to set up company/brand kit since they're joining an existing team.

2. **No email notifications for team events**: Team owners don't get notified when someone requests to join or when a member joins. Post authors don't get notified when their scheduled post is published.

## Design

### Part 1: Seamless Invite-to-Signup-to-Team Flow

**New flow for non-registered invitees:**

```
Invite link (/invite/TOKEN)
  → not authenticated
  → redirect to /signup?invite=TOKEN
  → user signs up (email/password or Google)
  → redirect to /onboarding?invite=TOKEN
  → onboarding detects invite param → shows ONLY "Connect LinkedIn" step
  → after LinkedIn connected → auto-accept invite via API
  → redirect to /dashboard (user is now on the team)
```

**Changes by file:**

#### 1. `app/invite/[token]/page.tsx`
- In the `not_authenticated` state: instead of showing login/signup buttons, auto-redirect to `/signup?invite={token}`
- Keep the login button as a secondary option for users who already have an account: redirect to `/login?redirect=/invite/{token}` (existing behavior)

#### 2. `app/signup/page.tsx`
- Read `invite` query param from URL
- After successful signup + auto-signin, redirect to `/onboarding?invite={invite}` instead of hardcoded `/onboarding`
- For Google OAuth signup: pass invite token through the OAuth redirect chain via `/api/auth/callback?next=/onboarding?invite={invite}`

#### 3. `app/login/page.tsx`
- Already handles `redirect` param — if user logs in with `?redirect=/invite/TOKEN`, they'll land back on the invite page. No changes needed.

#### 4. `app/onboarding/page.tsx`
- Read `invite` query param
- If `invite` is present:
  - Skip the owner/member role selection entirely
  - Set `onboarding_type: 'member'` automatically
  - Redirect directly to `/onboarding/step1?invite={invite}` (LinkedIn connect)

#### 5. `app/onboarding/step1/page.tsx`
- Read `invite` query param
- After LinkedIn is connected:
  - If `invite` param present: call `POST /api/teams/accept-invite` with the token
  - On success: mark onboarding complete, redirect to `/dashboard`
  - On failure (expired, email mismatch, etc.): show error, still complete onboarding, redirect to `/dashboard` with a toast
- The "Next" button text changes to "Connect & Join Team" when invite param is present

#### 6. `app/api/teams/accept-invite/route.ts`
- No changes to the API itself — it already handles everything correctly
- The email validation (invite email must match signed-in email) remains enforced

### Part 2: Email Notifications

Three new email templates + trigger points, using the existing Resend + React Email infrastructure.

#### Email 1: Team Join Request
- **Template**: `components/emails/team-join-request.tsx`
- **Trigger**: When a user requests to join a team (existing join request flow)
- **Recipient**: Team owner
- **Content**: "{Name} wants to join {Team}" with requester info and "Go to Dashboard" CTA button
- **Trigger location**: Find the join-request API route and add `sendEmail()` call after successful request creation

#### Email 2: Member Joined Team
- **Template**: `components/emails/member-joined-team.tsx`
- **Trigger**: After `POST /api/teams/accept-invite` successfully adds a member
- **Recipient**: Team owner (the person who invited them, or the team owner)
- **Content**: "{Name} has joined {Team} as {role}" with "Go to Dashboard" CTA button
- **Trigger location**: `app/api/teams/accept-invite/route.ts` after the welcome email is sent to the new member (around line 252)

#### Email 3: Scheduled Post Published
- **Template**: `components/emails/post-published.tsx`
- **Trigger**: After a scheduled post is successfully published on LinkedIn
- **Recipient**: Post author
- **Content**: "Your post was published on LinkedIn" with post content preview (first 200 chars), timestamp, and "View on LinkedIn" CTA button
- **Trigger location**: `lib/inngest/functions/publish-scheduled-posts.ts` after status is set to 'posted' (around line 170)

### Email Template Design

All emails follow the existing template pattern (see `components/emails/team-invitation.tsx`):
- ChainLinked logo header
- Clear title and description
- Relevant context (names, team, content preview)
- Single primary CTA button (blue)
- Footer with help link

## Out of Scope

- Email preferences/unsubscribe (can be added later)
- In-app notifications (separate feature)
- Invite link sharing via other channels (SMS, Slack)
