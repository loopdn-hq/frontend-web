"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  CirclePause,
  CircleStop,
  ClipboardList,
  Clock,
  Coins,
  History as HistoryIcon,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  OctagonAlert,
  Target,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { describeAudience } from "@/components/commercial/AudienceSummary";
import { CampaignResults } from "@/components/commercial/CampaignResults";
import {
  AddBudgetButton,
  CancelCampaignButton,
  DeleteDraftDialog,
  PauseResumeButton,
  WithdrawButton,
} from "@/components/commercial/CampaignActions";
import { SponsoredCard } from "@/components/sponsored/SponsoredCard";
import {
  CampaignStatusBadge,
  CreativeStatusBadge,
} from "@/components/commercial/StatusBadge";
import {
  Alert,
  Button,
  ContextMenu,
  Modal,
  Skeleton,
  SkeletonRegion,
  type ContextMenuOrigin,
} from "@/components/ui";
import { fetchCampaign } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import {
  CAMPAIGN_OBJECTIVE_HINT,
  CAMPAIGN_OBJECTIVE_LABEL,
  campaignName,
  formatBudget,
  formatCents,
  formatDate,
} from "@/lib/commercial/format";
import type {
  CampaignDetail as CampaignDetailType,
  CampaignEvent,
  Creative,
} from "@/lib/commercial/types";
import {
  useCampaignOptions,
  type CampaignOptions,
} from "@/lib/commercial/useCampaignOptions";
import { cn } from "@/lib/ui/cn";

/**
 * One campaign: its overview, audience, creative, results and history, and
 * what its owner can do with it now. The right-hand side of /campaigns/?id=12.
 *
 * Laid out by the width it is given (container queries), not the window's,
 * because beside the list it has much less room than the window. "← Campaigns"
 * shows only where the list is hidden: on a phone.
 */
export function CampaignDetail({
  campaignId,
  onChanged,
  onDeleted,
}: {
  campaignId: number;
  /** A move changed it (withdraw): the list shows the new status. */
  onChanged: (campaign: CampaignDetailType) => void;
  onDeleted: () => void;
}) {
  const { company, companies, switchTo } = useCompany();
  const { options, error: optionsError, retry } = useCampaignOptions();
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCampaign(campaignId).then((result) => {
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
  }, [campaignId, reloadToken]);

  const back = (
    <Link
      href="/campaigns/"
      scroll={false}
      className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline lg:hidden dark:text-sky-400"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Campaigns
    </Link>
  );

  if (error || optionsError) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 sm:p-6">
        {back}
        <LoadFailed
          what="this campaign"
          message={error ?? optionsError}
          onRetry={() => {
            setError(null);
            setReloadToken((token) => token + 1);
            retry();
          }}
        />
      </div>
    );
  }

  if (!campaign || !options) return <CampaignDetailSkeleton />;

  // A link can lead to a campaign of another of the person's companies. Its
  // own company's list is the right place for it, so offer to switch - and
  // stay on it: the page re-opens under that company with this one selected.
  if (company && campaign.companyId !== company.id) {
    const owner = companies.find((item) => item.id === campaign.companyId);
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        {back}
        <Alert variant="info">
          “{campaignName(campaign)}” belongs to{" "}
          {owner ? owner.name : "another of your companies"}, not {company.name}
          .
        </Alert>
        <Button onClick={() => switchTo(campaign.companyId)}>
          Switch to {owner ? owner.name : "that company"}
        </Button>
      </div>
    );
  }

  function changed(updated: CampaignDetailType) {
    setCampaign(updated);
    onChanged(updated);
  }

  const companyName = company?.name ?? "Your company";
  // A draft whose last move was a rejection: say so first, with the reason.
  const lastEvent = campaign.events[campaign.events.length - 1];
  const sentBack =
    campaign.status === "draft" && lastEvent?.kind === "rejected"
      ? lastEvent
      : null;
  const draft = campaign.status === "draft";
  // Only a draft can be changed; everything else shows without "Edit".
  const editAt = (step: string) =>
    draft ? `/campaigns/new/?id=${campaign.id}&step=${step}` : undefined;

  return (
    <div className="@container mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
      {back}

      <Header campaign={campaign} onChanged={changed} onDeleted={onDeleted} />

      {sentBack && (
        <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <OctagonAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Loopd&apos;n sent this campaign back
            </p>
            <p className="mt-0.5 whitespace-pre-line text-slate-700 dark:text-slate-300">
              {sentBack.note}
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Its budget is back in your balance. Make the changes, then submit
              it again.
            </p>
          </div>
        </div>
      )}

      {campaign.status === "pending_review" && (
        <Banner
          icon={Clock}
          tone="amber"
          title="Your campaign is being reviewed"
        >
          Loopd&apos;n is checking that it meets its advertising policies. You
          can&apos;t edit it while it&apos;s under review; withdraw it to make
          changes.
        </Banner>
      )}

      {campaign.status === "approved" && (
        <Banner icon={BadgeCheck} tone="sky" title="Approved">
          {campaign.startsAt && new Date(campaign.startsAt) > new Date()
            ? `It starts running on ${formatDate(campaign.startsAt)}.`
            : "It starts running in a moment."}{" "}
          Cancel it before then and its budget comes back to your balance.
        </Banner>
      )}

      {campaign.status === "paused" && (
        <Banner icon={CirclePause} tone="amber" title="Paused">
          It isn&apos;t shown while it&apos;s paused, and its budget stays set
          aside. Resume it to carry on.
        </Banner>
      )}

      {campaign.status === "ended" && (
        <Banner icon={CircleStop} tone="slate" title="This campaign has ended">
          {lastEvent?.kind === "cancelled"
            ? "It was cancelled. "
            : `${lastEvent?.note || "Its end date passed."} `}
          Whatever it didn&apos;t spend is back in your balance.
        </Banner>
      )}

      <Overview campaign={campaign} editHref={editAt("budget")} />

      <div className="grid gap-4 @2xl:grid-cols-[2fr_3fr]">
        <AudienceCard
          campaign={campaign}
          options={options}
          editHref={editAt("audience")}
        />
        <CreativeCard
          creatives={campaign.creatives}
          companyName={companyName}
          editHref={editAt("creatives")}
        />
      </div>

      <div className="grid gap-4 @2xl:grid-cols-[3fr_2fr]">
        <Card title="Results">
          <CampaignResults campaign={campaign} />
        </Card>
        <Card title="History" icon={HistoryIcon}>
          <Timeline events={campaign.events} />
        </Card>
      </div>
    </div>
  );
}

// ---- Banners -------------------------------------------------------------

const BANNER_TONE = {
  sky: "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400",
  amber:
    "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
  slate:
    "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
};

/** Where the campaign stands, when that is the first thing to know. */
function Banner({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof BANNER_TONE;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${BANNER_TONE[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{children}</p>
      </div>
    </div>
  );
}

// ---- Header --------------------------------------------------------------

function Header({
  campaign,
  onChanged,
  onDeleted,
}: {
  campaign: CampaignDetailType;
  onChanged: (campaign: CampaignDetailType) => void;
  onDeleted: () => void;
}) {
  const [menu, setMenu] = useState<ContextMenuOrigin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const draft = campaign.status === "draft";

  // "Submitted on ..." once it has been, "Created on ..." until then.
  const submitted = latest(campaign.events, "submitted");
  const created = latest(campaign.events, "created");
  const when =
    !draft && submitted?.createdAt
      ? `Submitted on ${formatMoment(submitted.createdAt)}`
      : created?.createdAt
        ? `Created on ${formatMoment(created.createdAt)}`
        : null;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold break-words text-slate-900 dark:text-slate-100">
          {campaignName(campaign)}
        </h1>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          {CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]}
        </p>
        {when && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {when}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <CampaignStatusBadge status={campaign.status} />
        {draft && (
          <>
            <Link
              href={`/campaigns/new/?id=${campaign.id}&step=review`}
              className="inline-flex min-h-10 items-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Continue editing
            </Link>
            {/* Only a draft that never moved money can be deleted; one
                that was submitted and withdrawn keeps its ledger. */}
            {campaign.deletable && (
              <Button
                variant="secondary"
                size="icon"
                aria-label="More actions"
                data-ignore-click-outside
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  setMenu(
                    menu ? null : { x: box.right - 200, y: box.bottom + 6 },
                  );
                }}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <ContextMenu
              origin={menu}
              onClose={() => setMenu(null)}
              label="Campaign actions"
              items={[
                {
                  id: "delete",
                  label: "Delete draft",
                  tone: "danger",
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
            <DeleteDraftDialog
              campaign={campaign}
              isOpen={deleting}
              onClose={() => setDeleting(false)}
              onDeleted={onDeleted}
            />
          </>
        )}
        {campaign.status === "pending_review" && (
          <WithdrawButton
            campaign={campaign}
            size="md"
            onWithdrawn={onChanged}
          />
        )}
        {(campaign.status === "running" || campaign.status === "paused") && (
          <>
            <PauseResumeButton campaign={campaign} onChanged={onChanged} />
            <AddBudgetButton campaign={campaign} onRaised={onChanged} />
          </>
        )}
        {(campaign.status === "approved" ||
          campaign.status === "running" ||
          campaign.status === "paused") && (
          <CancelCampaignButton campaign={campaign} onCancelled={onChanged} />
        )}
      </div>
    </header>
  );
}

// ---- Overview ------------------------------------------------------------

function Overview({
  campaign,
  editHref,
}: {
  campaign: CampaignDetailType;
  editHref?: string;
}) {
  const money = (cents: number | null) =>
    formatBudget(cents, campaign.currency);

  return (
    <Card title="Campaign overview" editHref={editHref}>
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @2xl:grid-cols-4">
        <Fact
          icon={Wallet}
          label="Total budget"
          value={money(campaign.totalBudgetCents)}
          note={moneyNote(campaign)}
        />
        <Fact
          icon={BarChart3}
          label="Daily cap"
          value={
            campaign.dailyBudgetCents === null
              ? "No cap"
              : money(campaign.dailyBudgetCents)
          }
        />
        <Fact
          icon={CalendarDays}
          label="Starts"
          value={
            campaign.startsAt ? formatDate(campaign.startsAt) : "Once approved"
          }
        />
        <Fact
          icon={CalendarCheck}
          label="Ends"
          value={
            campaign.endsAt
              ? formatDate(campaign.endsAt)
              : "When the budget is spent"
          }
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 @md:grid-cols-2 @2xl:grid-cols-3 dark:border-slate-800">
        <Fact
          icon={Target}
          label="Objective"
          value={CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]}
          note={CAMPAIGN_OBJECTIVE_HINT[campaign.objective]}
        />
        <Fact
          icon={MessageCircle}
          label="Placement"
          value="Chat"
          note="Ads shown in group chats."
        />
        {/* The price per 1,000 views is fixed at submit; a draft has none of its own yet. */}
        <Fact
          icon={Coins}
          label="Rate"
          value={
            campaign.cpmCents === null
              ? "Set when you submit"
              : `${formatCents(campaign.cpmCents, campaign.currency)} per 1,000 views`
          }
          note={
            campaign.cpmCents === null
              ? "The price in force then is fixed for this campaign."
              : "CPM (chat), fixed when it was submitted."
          }
        />
      </div>
    </Card>
  );
}

/** "PHP 5,000.00 set aside · PHP 120.00 spent", once money has moved. */
function moneyNote(campaign: CampaignDetailType): string | undefined {
  const parts = [];
  if (campaign.reservedCents > 0) {
    parts.push(
      `${formatCents(campaign.reservedCents, campaign.currency)} set aside`,
    );
  }
  if (campaign.spentCents > 0) {
    parts.push(`${formatCents(campaign.spentCents, campaign.currency)} spent`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function Fact({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-semibold break-words text-slate-900 dark:text-slate-100">
          {value}
        </p>
        {note && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
        )}
      </div>
    </div>
  );
}

// ---- Audience ------------------------------------------------------------

function AudienceCard({
  campaign,
  options,
  editHref,
}: {
  campaign: CampaignDetailType;
  options: CampaignOptions;
  editHref?: string;
}) {
  if (!campaign.audience) {
    return (
      <Card title="Audience" editHref={editHref}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Not chosen yet.
        </p>
      </Card>
    );
  }

  const { groups, where, size } = describeAudience(
    campaign.audience,
    campaign.country,
    options,
  );
  return (
    <Card title="Audience" editHref={editHref}>
      <ul className="space-y-3">
        <IconRow icon={UsersRound} label="Group category" value={groups} />
        <IconRow icon={MapPin} label="Location" value={where} />
        <IconRow icon={Users} label="Group size" value={size} />
      </ul>
    </Card>
  );
}

function IconRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {label}
        </p>
        <p className="break-words text-slate-600 dark:text-slate-400">
          {value}
        </p>
      </div>
    </li>
  );
}

// ---- Creative ------------------------------------------------------------

function CreativeCard({
  creatives,
  companyName,
  editHref,
}: {
  creatives: Creative[];
  companyName: string;
  editHref?: string;
}) {
  const [showingAll, setShowingAll] = useState(false);
  const first = creatives[0];

  return (
    <Card
      title="Creative"
      editHref={editHref}
      action={
        creatives.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowingAll(true)}
          >
            View all ({creatives.length})
          </Button>
        )
      }
    >
      {first ? (
        <WideCreative creative={first} companyName={companyName} />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
      )}

      <Modal
        isOpen={showingAll}
        onClose={() => setShowingAll(false)}
        title={`Creatives (${creatives.length})`}
        description="Each version of the ad, and where review stands on it."
        maxWidthClassName="max-w-3xl"
      >
        <ul className="grid gap-5 sm:grid-cols-2">
          {creatives.map((creative) => (
            <li key={creative.id} className="min-w-0 space-y-2">
              <SponsoredCard
                companyName={companyName}
                headline={creative.headline}
                body={creative.body}
                imageUrl={creative.imageUrl}
                ctaLabel={creative.ctaLabel}
                ctaKind={creative.ctaKind}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CreativeStatusBadge status={creative.status} />
                <span className="break-all">
                  {creative.ctaKind === "lead_form"
                    ? "Opens a Loopd'n form"
                    : `Opens ${creative.ctaTarget}`}
                </span>
              </div>
              {creative.reviewNotes && (
                <Alert variant="error">{creative.reviewNotes}</Alert>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </Card>
  );
}

/** The first creative, wide: its picture beside its words, as on a big screen. */
function WideCreative({
  creative,
  companyName,
}: {
  creative: Creative;
  companyName: string;
}) {
  return (
    <div className="@container overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <p className="px-4 pt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        Sponsored · {companyName}
      </p>
      <div
        className={cn(
          "grid gap-4 p-4",
          // Side by side only when there is a picture to put beside the words.
          creative.imageUrl && "@sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
        )}
      >
        {creative.imageUrl && (
          // A presigned URL: nothing for next/image to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.imageUrl}
            alt=""
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 space-y-2">
          <p className="text-base font-semibold break-words text-slate-900 dark:text-slate-100">
            {creative.headline}
          </p>
          <p className="text-sm break-words whitespace-pre-line text-slate-600 dark:text-slate-300">
            {creative.body}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">
            {creative.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
          {creative.ctaKind === "lead_form" ? (
            <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              Opens a Loopd&apos;n form: people choose what to send you.
            </p>
          ) : (
            <a
              href={creative.ctaTarget}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-sm text-sky-600 hover:underline dark:text-sky-400"
            >
              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{creative.ctaTarget}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- History -------------------------------------------------------------

/** Newest first, as a line of dots: what happened, when, and who did it. */
function Timeline({ events }: { events: CampaignEvent[] }) {
  const newestFirst = [...events].reverse();
  return (
    <ol className="space-y-4">
      {newestFirst.map((event, index) => (
        <li key={`${event.kind}-${index}`} className="relative flex gap-3">
          {index < newestFirst.length - 1 && (
            <span
              aria-hidden
              className="absolute top-4 bottom-[-1rem] left-[5px] w-px bg-slate-200 dark:bg-slate-700"
            />
          )}
          <span
            aria-hidden
            className="mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900"
          />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {event.label}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {formatMoment(event.createdAt)}
            </p>
            {event.by && (
              <p className="text-slate-500 dark:text-slate-400">
                by {event.by}
              </p>
            )}
            {event.note && (
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {event.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function latest(
  events: CampaignEvent[],
  kind: string,
): CampaignEvent | undefined {
  return [...events].reverse().find((event) => event.kind === kind);
}

/** "Oct 2, 2026 at 12:41 AM". */
function formatMoment(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

// ---- Pieces --------------------------------------------------------------

function Card({
  title,
  icon: Icon,
  editHref,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Where "Edit" goes; absent when the campaign can't be changed. */
  editHref?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          {Icon && <Icon className="h-5 w-5 text-slate-500" aria-hidden />}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {action}
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex min-h-8 items-center rounded-lg bg-sky-50 px-3 text-sm font-semibold text-sky-600 transition hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-400"
            >
              Edit
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function CampaignDetailSkeleton() {
  return (
    <SkeletonRegion label="Loading campaign" className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </SkeletonRegion>
  );
}
