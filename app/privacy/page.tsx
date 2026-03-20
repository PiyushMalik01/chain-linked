import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  IconShieldLock,
  IconWorld,
  IconDatabase,
  IconEye,
  IconCookie,
  IconShare,
  IconClock,
  IconUserCheck,
  IconLock,
  IconBabyCarriage,
  IconRefresh,
  IconMail,
  IconArrowLeft,
  IconLink,
} from "@tabler/icons-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export const metadata: Metadata = {
  title: "Privacy Policy – ChainLinked",
  description:
    "ChainLinked Privacy Policy – how we collect, use, and protect your data.",
}

const LAST_UPDATED = "March 17, 2026"
const CONTACT_EMAIL = "support@higherops.io"
const APP_URL = "https://chainlinked.ai"

/**
 * Section icon and color mapping for visual consistency
 */
const SECTION_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  "1": { icon: IconWorld, color: "text-primary", bg: "bg-primary/10" },
  "2": { icon: IconEye, color: "text-chart-3", bg: "bg-chart-3/10" },
  "3": { icon: IconDatabase, color: "text-chart-4", bg: "bg-chart-4/10" },
  "4": { icon: IconEye, color: "text-chart-5", bg: "bg-chart-5/10" },
  "5": { icon: IconCookie, color: "text-secondary", bg: "bg-secondary/10" },
  "6": { icon: IconShare, color: "text-primary", bg: "bg-primary/10" },
  "7": { icon: IconClock, color: "text-chart-3", bg: "bg-chart-3/10" },
  "8": { icon: IconUserCheck, color: "text-chart-4", bg: "bg-chart-4/10" },
  "9": { icon: IconLock, color: "text-chart-5", bg: "bg-chart-5/10" },
  "10": { icon: IconBabyCarriage, color: "text-secondary", bg: "bg-secondary/10" },
  "11": { icon: IconRefresh, color: "text-primary", bg: "bg-primary/10" },
  "12": { icon: IconMail, color: "text-chart-3", bg: "bg-chart-3/10" },
}

/**
 * Privacy Policy page for ChainLinked.
 *
 * Covers both the web application and the ChainLinked Data Connector
 * Chrome extension (Chrome Web Store ID: glieaipgcfjjgkpodaonlmappefjbhep).
 *
 * @returns Server-rendered privacy policy page styled to match the platform theme
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b bg-gradient-to-b from-background via-background to-primary/5 pt-28 pb-16">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-20 -top-20 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full bg-secondary/5 blur-3xl" />

        <div className="container relative mx-auto max-w-4xl px-4 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <IconShieldLock className="size-8 text-primary" />
          </div>
          <Badge variant="outline" className="mb-4">
            Last updated: {LAST_UPDATED}
          </Badge>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            How we collect, use, and protect your data across the ChainLinked
            platform and Chrome extension.
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card className="border-border/50">
          <CardContent className="py-2">
            <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Contents
            </p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Who We Are",
                "Scope",
                "Data We Collect",
                "How We Use Your Data",
                "LinkedIn Session Cookies",
                "Data Sharing",
                "Data Retention",
                "Your Rights",
                "Security",
                "Children",
                "Changes to This Policy",
                "Contact",
              ].map((title, i) => (
                <a
                  key={i}
                  href={`#section-${i + 1}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  {title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy Content */}
      <article className="container mx-auto max-w-4xl px-4 pb-20">
        <div className="space-y-10">
          <Section id="1" title="Who We Are">
            <p>
              ChainLinked (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
              &ldquo;us&rdquo;) is a LinkedIn content management platform for
              individuals and teams, operated by HigherOps Inc. Our web
              application is available at{" "}
              <PolicyLink href={APP_URL}>chainlinked.ai</PolicyLink> and we
              publish the{" "}
              <strong className="text-foreground">
                ChainLinked Data Connector
              </strong>{" "}
              Chrome extension (the &ldquo;Extension&rdquo;) on the Chrome Web
              Store.
            </p>
            <p>
              Questions about this policy can be sent to{" "}
              <PolicyLink href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </PolicyLink>
              .
            </p>
          </Section>

          <Section id="2" title="Scope">
            <p>This policy applies to:</p>
            <PolicyList
              items={[
                <>
                  The ChainLinked web application at{" "}
                  <PolicyLink href={APP_URL}>chainlinked.ai</PolicyLink>
                </>,
                "The ChainLinked Data Connector Chrome extension",
                "Any APIs or services operated by ChainLinked",
              ]}
            />
            <p>
              It does not apply to third-party services you connect to
              ChainLinked (such as LinkedIn or Google), which have their own
              privacy policies.
            </p>
          </Section>

          <Section id="3" title="Data We Collect">
            <h3 className="text-base font-semibold text-foreground mt-2 mb-3">
              3a. Data collected through the Chrome Extension
            </h3>
            <p>
              The Extension operates entirely within your own LinkedIn session.
              It captures data that you have already generated or have access to
              on LinkedIn — it cannot access other users&apos; private data. The
              following categories are collected:
            </p>
            <DataTable
              headers={["Category", "Examples", "Purpose"]}
              rows={[
                [
                  "Profile data",
                  "Name, headline, location, profile photo URL, LinkedIn member ID, public identifier",
                  "Display your profile in the ChainLinked dashboard",
                ],
                [
                  "Analytics data",
                  "Post impressions, profile views, follower growth, engagement rates",
                  "Populate your personal and team analytics dashboard",
                ],
                [
                  "Post & content data",
                  "Post text, media URLs, reactions, comments, reposts, per-post metrics",
                  "Track content performance and build your post library",
                ],
                [
                  "Audience demographics",
                  "Follower job titles, industries, companies, geographic regions",
                  "Display audience insights in the dashboard",
                ],
                [
                  "Network data",
                  "Connection count, follower count, invitation metadata",
                  "Network growth tracking",
                ],
                [
                  "Feed posts",
                  "Posts from connections visible in your LinkedIn feed",
                  "Populate the team activity feed and inspiration features",
                ],
                [
                  "Messaging metadata",
                  "Conversation counts, unread counts (message content is not stored by default)",
                  "Optional — only if messaging capture is enabled in settings",
                ],
                [
                  "Authentication tokens",
                  "LinkedIn session cookies (li_at, JSESSIONID, lidc, bcookie)",
                  "Authenticate requests to LinkedIn's internal API on your behalf",
                ],
                [
                  "Google OAuth tokens",
                  "Google account ID, email address, display name",
                  "Sign in to ChainLinked using your Google account",
                ],
              ]}
            />

            <h3 className="text-base font-semibold text-foreground mt-8 mb-3">
              3b. Data collected through the web application
            </h3>
            <PolicyList
              items={[
                <>
                  <strong className="text-foreground">
                    Account information:
                  </strong>{" "}
                  Email address, password (hashed), team membership, and role.
                </>,
                <>
                  <strong className="text-foreground">
                    Content you create:
                  </strong>{" "}
                  Posts you draft, schedule, or publish through ChainLinked;
                  templates; carousel files.
                </>,
                <>
                  <strong className="text-foreground">Usage data:</strong> Pages
                  visited, features used, and actions taken within the app (used
                  for product improvement).
                </>,
                <>
                  <strong className="text-foreground">Technical data:</strong>{" "}
                  IP address, browser type, and device type collected
                  automatically by our infrastructure.
                </>,
              ]}
            />
          </Section>

          <Section id="4" title="How We Use Your Data">
            <PolicyList
              items={[
                "Provide and operate the ChainLinked platform and Extension",
                "Display your LinkedIn analytics, posts, and audience data in your dashboard",
                "Enable team analytics and collaborative content features",
                "Generate AI-powered content suggestions based on your own post history and style",
                "Authenticate you with LinkedIn and Google",
                "Send product notifications and sync status alerts",
                "Improve the product based on usage patterns",
                "Comply with legal obligations",
              ]}
            />
            <Card className="mt-6 border-primary/20 bg-primary/5">
              <CardContent className="py-2">
                <p className="text-sm font-medium text-foreground">
                  We do not sell your data. We do not use your data for
                  advertising. We do not use your data to determine
                  creditworthiness or for lending purposes.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Section id="5" title="LinkedIn Session Cookies">
            <p>
              The Extension captures your LinkedIn session cookies (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                li_at
              </code>
              ,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                JSESSIONID
              </code>
              ) to make authenticated API requests to LinkedIn on your behalf.
              These cookies are:
            </p>
            <PolicyList
              items={[
                "Stored in our database associated with your ChainLinked account",
                "Used solely to retrieve your own LinkedIn data (not anyone else's)",
                "Never shared with third parties",
                "Treated as sensitive credentials — access is restricted by row-level security policies in our database",
                "Automatically invalidated when your LinkedIn session expires (typically 60 days)",
              ]}
            />
            <p>
              You can revoke access at any time by disconnecting LinkedIn in
              ChainLinked Settings, which deletes all stored session tokens.
            </p>
          </Section>

          <Section id="6" title="Data Sharing">
            <p>
              We share data only in the following limited circumstances:
            </p>
            <PolicyList
              items={[
                <>
                  <strong className="text-foreground">
                    Within your team:
                  </strong>{" "}
                  Analytics and post data may be visible to other members of
                  your ChainLinked team, as that is a core feature of the
                  product.
                </>,
                <>
                  <strong className="text-foreground">
                    Service providers:
                  </strong>{" "}
                  We use Supabase for database and authentication
                  infrastructure. Data is stored on Supabase servers in the
                  ap-south-1 (Mumbai) region. Supabase processes data under its
                  own privacy and security policies.
                </>,
                <>
                  <strong className="text-foreground">AI providers:</strong>{" "}
                  Content and style data may be sent to AI providers (such as
                  Anthropic or OpenAI) to generate content suggestions. Prompts
                  are not used to train third-party models under our current API
                  agreements.
                </>,
                <>
                  <strong className="text-foreground">
                    Legal requirements:
                  </strong>{" "}
                  We may disclose data if required by law, court order, or to
                  protect the rights and safety of ChainLinked or its users.
                </>,
              ]}
            />
            <p>
              We do not sell, rent, or trade your personal data to third
              parties.
            </p>
          </Section>

          <Section id="7" title="Data Retention">
            <PolicyList
              items={[
                "Captured LinkedIn data is retained as long as your account is active.",
                "LinkedIn session cookies are deleted when you disconnect LinkedIn or close your account.",
                <>
                  You can request deletion of all your data at any time by
                  emailing{" "}
                  <PolicyLink href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </PolicyLink>
                  .
                </>,
                "Upon account deletion, all personal data is permanently removed within 30 days.",
              ]}
            />
          </Section>

          <Section id="8" title="Your Rights">
            <p>
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  right: "Access",
                  desc: "Request a copy of the data we hold about you.",
                },
                {
                  right: "Correction",
                  desc: "Request correction of inaccurate data.",
                },
                {
                  right: "Deletion",
                  desc: "Request deletion of your data.",
                },
                {
                  right: "Portability",
                  desc: "Request your data in a machine-readable format.",
                },
                {
                  right: "Objection",
                  desc: "Object to certain uses of your data.",
                },
              ].map((item) => (
                <div
                  key={item.right}
                  className="flex gap-3 rounded-xl border border-border/50 bg-card p-4"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
                    <IconUserCheck className="size-4 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.right}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4">
              To exercise any of these rights, contact us at{" "}
              <PolicyLink href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </PolicyLink>
              .
            </p>
          </Section>

          <Section id="9" title="Security">
            <p>
              We implement industry-standard security measures including:
            </p>
            <PolicyList
              items={[
                "Encrypted data transmission (TLS/HTTPS)",
                "Row-level security (RLS) policies restricting database access to the authenticated user's own data",
                "Authentication via Supabase Auth with support for Google OAuth2",
                "Sensitive credentials (session tokens) stored with restricted access controls",
              ]}
            />
            <p>
              No method of transmission or storage is 100% secure. If you
              discover a security vulnerability, please report it to{" "}
              <PolicyLink href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </PolicyLink>
              .
            </p>
          </Section>

          <Section id="10" title="Children">
            <p>
              ChainLinked is not directed at children under 16. We do not
              knowingly collect data from children. If you believe a child has
              provided us with personal data, contact us and we will delete it.
            </p>
          </Section>

          <Section id="11" title="Changes to This Policy">
            <p>
              We may update this policy from time to time. We will notify you
              of material changes by email or by displaying a notice in the
              app. The &ldquo;Last updated&rdquo; date at the top of this page
              reflects the most recent revision. Continued use of ChainLinked
              after changes take effect constitutes acceptance of the updated
              policy.
            </p>
          </Section>

          <Section id="12" title="Contact">
            <p>For privacy questions or requests, contact us at:</p>
            <Card className="mt-4 border-border/50">
              <CardContent className="flex items-center gap-4 py-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <IconLink className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    ChainLinked / HigherOps Inc.
                  </p>
                  <PolicyLink href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </PolicyLink>
                </div>
              </CardContent>
            </Card>
          </Section>
        </div>
      </article>

      <Footer />
    </div>
  )
}

/* ─── Internal layout helpers ──────────────────────────────────────────────── */

/**
 * A themed policy section with icon, number badge, and anchor.
 * @param props.id - Section number (e.g. "1")
 * @param props.title - Section title text
 * @param props.children - Section body content
 */
function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  const meta = SECTION_META[id]
  const Icon = meta?.icon ?? IconShieldLock
  const color = meta?.color ?? "text-primary"
  const bg = meta?.bg ?? "bg-primary/10"

  return (
    <section id={`section-${id}`} className="scroll-mt-24">
      <Separator className="mb-10" />
      <div className="flex items-start gap-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
        >
          <Icon className={`size-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {id}. {title}
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Styled unordered list for policy items.
 * @param props.items - Array of list item content (string or JSX)
 */
function PolicyList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Themed inline link for policy text.
 * @param props.href - Link destination
 * @param props.children - Link label
 */
function PolicyLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-4 decoration-primary/30 transition-colors hover:decoration-primary/60"
    >
      {children}
    </a>
  )
}

/**
 * Themed responsive data table for policy data categories.
 * @param props.headers - Column header labels
 * @param props.rows - 2D array of cell values
 */
function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <Card className="mt-4 overflow-hidden border-border/50">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-4 py-3 align-top ${
                      j === 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
