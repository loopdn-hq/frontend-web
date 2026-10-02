"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Loader2,
  OctagonX,
} from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { SponsoredCard } from "@/components/sponsored/SponsoredCard";
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  Skeleton,
  SkeletonRegion,
  Textarea,
  useToast,
} from "@/components/ui";
import { approveCampaign, fetchReviewCampaign } from "@/lib/admin/api";
import {
  formatBudget,
  formatCents,
  formatDay,
  formatMoment,
} from "@/lib/admin/format";
import type { Finding, ReviewCampaign } from "@/lib/admin/types";
import { cn } from "@/lib/ui/cn";
import { GroupMatchCheck } from "./GroupMatchCheck";
import { RejectDialog } from "./RejectDialog";
import { STATUS_TONE } from "./statusTone";

/**
 * One campaign as a reviewer reads it: what the automatic checks found, the
 * company behind it, the money, the audience, every creative and where its
 * button goes, and the history. Approve or send back while it waits; once
 * decided, the record.
 *
 * "← Review queue" shows only where the queue is hidden: on a phone.
 */
export function ReviewDetail({
  campaignId,
  onDecided,
}: {
  campaignId: number;
  /** It was approved or sent back: the queue shows the new state. */
  onDecided: (campaign: ReviewCampaign) => void;
}) {
  const toast = useToast();
  const [campaign, setCampaign] = useState<ReviewCampaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReviewCampaign(campaignId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCampaign(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, token]);

  const back = (
    <Link
      href="/admin/campaigns/"
      scroll={false}
      className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline lg:hidden dark:text-violet-400"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Review queue
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 sm:p-6">
        {back}
        <LoadFailed
          what="this campaign"
          message={error}
          onRetry={() => {
            setError(null);
            setToken((current) => current + 1);
          }}
        />
      </div>
    );
  }

  if (!campaign) return <ReviewDetailSkeleton />;

  const waiting = campaign.status === "pending_review";
  const blocked = campaign.findings.some((f) => f.severity === "blocker");
  const money = (cents: number | null) =>
    formatBudget(cents, campaign.currency);

  function decided(next: ReviewCampaign, title: string) {
    setCampaign(next);
    setApproving(false);
    setRejecting(false);
    toast({ title });
    onDecided(next);
  }

  return (
    <div className="@container mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      {back}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words text-slate-900 dark:text-slate-100">
            {campaign.name || "Untitled campaign"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {campaign.company.name} · {campaign.objectiveLabel}
          </p>
          {campaign.submittedAt && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Submitted {formatMoment(campaign.submittedAt)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[campaign.status]}>
            {campaign.statusLabel}
          </Badge>
          {waiting && (
            <>
              <Button variant="secondary" onClick={() => setRejecting(true)}>
                Send back
              </Button>
              <Button
                onClick={() => setApproving(true)}
                disabled={blocked}
                title={
                  blocked
                    ? "Fix the blockers below before approving"
                    : undefined
                }
              >
                Approve
              </Button>
            </>
          )}
        </div>
      </header>

      <Findings findings={campaign.findings} />

      <div className="grid gap-4 @3xl:grid-cols-[3fr_2fr]">
        <Card title="Money and schedule">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm @md:grid-cols-2">
            <Row
              label="Total budget"
              value={money(campaign.totalBudgetCents)}
            />
            <Row
              label="Daily cap"
              value={
                campaign.dailyBudgetCents === null
                  ? "No cap"
                  : money(campaign.dailyBudgetCents)
              }
            />
            <Row
              label="Set aside"
              value={formatCents(campaign.reservedCents, campaign.currency)}
            />
            <Row
              label="Price"
              value={
                campaign.cpmCents === null
                  ? "Not fixed"
                  : `${formatCents(campaign.cpmCents, campaign.currency)} per 1,000 views`
              }
            />
            <Row
              label="Starts"
              value={
                campaign.startsAt
                  ? formatDay(campaign.startsAt)
                  : "As soon as it's approved"
              }
            />
            <Row
              label="Ends"
              value={
                campaign.endsAt
                  ? formatDay(campaign.endsAt)
                  : "When the budget is spent"
              }
            />
          </dl>
        </Card>

        <Card title="Company">
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={campaign.company.name} />
            <Row
              label="Industry"
              value={`${campaign.company.industryLabel} · ${campaign.company.countryName}`}
            />
            <Row label="Owner" value={campaign.company.owner} />
            <Row label="Contact" value={campaign.company.contactEmail || "—"} />
            <div className="grid gap-x-4 sm:grid-cols-[7rem_1fr]">
              <dt className="text-slate-500 dark:text-slate-400">Website</dt>
              <dd className="min-w-0">
                {campaign.company.website ? (
                  <ExternalAddress href={campaign.company.website} />
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {campaign.company.status !== "active" && (
              <Alert variant="error">This company is suspended.</Alert>
            )}
          </dl>
        </Card>
      </div>

      <Card title="Audience">
        {campaign.audience ? (
          <dl className="space-y-3 text-sm">
            <Row
              label="Groups"
              value={
                campaign.audience.categories.length === 0
                  ? "Any kind of group"
                  : campaign.audience.categories.map((c) => c.label).join(", ")
              }
            />
            <Row
              label="Where"
              value={
                campaign.audience.regions.length === 0
                  ? `Anywhere in ${campaign.company.countryName}`
                  : campaign.audience.regions.map((r) => r.name).join(", ")
              }
            />
            <Row label="Group size" value={groupSize(campaign)} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Not chosen.
          </p>
        )}
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <GroupMatchCheck campaignId={campaign.id} />
        </div>
      </Card>

      <Card title={`Creatives (${campaign.creatives.length})`}>
        <ul className="grid gap-5 @2xl:grid-cols-2">
          {campaign.creatives.map((creative) => {
            const flags = campaign.findings.filter(
              (f) => f.creativeId === creative.id,
            );
            return (
              <li key={creative.id} className="min-w-0 space-y-2">
                <SponsoredCard
                  companyName={campaign.company.name}
                  headline={creative.headline}
                  body={creative.body}
                  imageUrl={creative.imageUrl}
                  ctaLabel={creative.ctaLabel}
                  ctaKind={creative.ctaKind}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {creative.ctaKind === "lead_form" ? (
                    "Button opens Loopd'n's lead form"
                  ) : (
                    <>
                      Button opens <ExternalAddress href={creative.ctaTarget} />
                    </>
                  )}
                </p>
                {flags.map((flag) => (
                  <FindingLine key={flag.code} finding={flag} />
                ))}
                {creative.reviewNotes && (
                  <Alert variant="error">{creative.reviewNotes}</Alert>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="History">
        <ol className="space-y-3">
          {[...campaign.events].reverse().map((event, index) => (
            <li key={`${event.kind}-${index}`} className="text-sm">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {event.label}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {formatMoment(event.createdAt)}
                {event.by && ` · by ${event.by}`}
              </p>
              {event.note && (
                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {event.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <ApproveDialog
        campaign={campaign}
        isOpen={approving}
        onClose={() => setApproving(false)}
        onApproved={(next) => decided(next, "Campaign approved")}
      />
      <RejectDialog
        campaign={campaign}
        isOpen={rejecting}
        onClose={() => setRejecting(false)}
        onRejected={(next) => decided(next, "Sent back to the company")}
      />
    </div>
  );
}

/** Blockers first, then warnings, or a plain "all clear". */
function Findings({ findings }: { findings: Finding[] }) {
  const general = findings.filter((f) => f.creativeId === null);
  const perCreative = findings.length - general.length;

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        The automatic checks found nothing.
      </div>
    );
  }

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Automatic checks
      </h2>
      {general.map((finding) => (
        <FindingLine key={finding.code} finding={finding} />
      ))}
      {perCreative > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {perCreative} about the creatives - shown with each one below.
        </p>
      )}
    </section>
  );
}

function FindingLine({ finding }: { finding: Finding }) {
  const blocker = finding.severity === "blocker";
  const Icon = blocker ? OctagonX : AlertTriangle;
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-sm",
        blocker
          ? "text-rose-700 dark:text-rose-400"
          : "text-amber-700 dark:text-amber-400",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">{blocker ? "Blocker" : "Check"}:</span>{" "}
        {finding.message}
      </span>
    </p>
  );
}

/** Approve, with an optional note for the history. */
function ApproveDialog({
  campaign,
  isOpen,
  onClose,
  onApproved,
}: {
  campaign: ReviewCampaign;
  isOpen: boolean;
  onClose: () => void;
  onApproved: (campaign: ReviewCampaign) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warnings = campaign.findings.length;

  async function approve() {
    if (busy) return;
    setBusy(true);
    const result = await approveCampaign(campaign.id, note.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onApproved(result.data);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Approve this campaign?"
      description={`"${campaign.name}" will run from its start date, in the groups its audience covers.${
        warnings > 0
          ? ` The automatic checks raised ${warnings} point${warnings === 1 ? "" : "s"} to look at.`
          : ""
      }`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={approve} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Approve
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        <Field
          label="Note (optional)"
          hint="Kept in the history; the company sees it."
        >
          <Textarea
            rows={2}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function groupSize(campaign: ReviewCampaign): string {
  const audience = campaign.audience;
  if (!audience) return "";
  const { minGroupSize: min, maxGroupSize: max } = audience;
  if (min !== null && max !== null) return `${min} to ${max} members`;
  if (min !== null) return `At least ${min} members`;
  if (max !== null) return `Up to ${max} members`;
  return "Any size";
}

/** A company's address, opened in a new tab and telling the site nothing. */
function ExternalAddress({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 break-all text-violet-600 hover:underline dark:text-violet-400"
    >
      {href}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-[7rem_1fr]">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <SkeletonRegion label="Loading campaign" className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </SkeletonRegion>
  );
}
