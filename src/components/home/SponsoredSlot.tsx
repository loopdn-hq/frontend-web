"use client";

/**
 * A sponsored card in a group's chat (slice 5 of
 * backend/docs/campaigns_final_plan.md): a per-member slot, never a message.
 *
 * `useSponsoredSlot` asks the server once each time a group is opened, after
 * its messages have loaded, and places the card after the newest message at
 * that moment - so it scrolls away with the chat like any other card, and new
 * messages arrive below it. Most of the time the answer is "nothing".
 *
 * `SponsoredSlot` reports the view once at least half the card has been on
 * screen for a second, with the tab showing (decision 9). That report is what
 * the company pays for; a card that was never really seen is never counted.
 * Its button goes through the server's click address, which counts the click
 * (once per card) and sends the member on with nothing about them added - or,
 * for a lead campaign, opens Loopd'n's own form (LeadFormModal).
 */
import { useEffect, useRef, useState } from "react";
import { SponsoredCard } from "@/components/sponsored/SponsoredCard";
import { LeadFormModal } from "./LeadFormModal";
import {
  fetchSponsoredCard,
  reportSponsoredView,
  type SponsoredCardData,
} from "@/lib/chat/sponsored";

const SEEN_AFTER_MS = 1000;

type Slot = {
  conversationId: string;
  card: SponsoredCardData;
  /** The message the card sits after. */
  afterMessageId: string;
};

export function useSponsoredSlot({
  conversationId,
  isGroup,
  lastMessageId,
}: {
  conversationId: string | number | null;
  isGroup: boolean;
  /** The newest message, once the thread has loaded; null until then. */
  lastMessageId: string | number | null;
}): Slot | null {
  const [slot, setSlot] = useState<Slot | null>(null);
  const latest = useRef(lastMessageId);

  useEffect(() => {
    latest.current = lastMessageId;
  }, [lastMessageId]);

  const id = conversationId === null ? null : String(conversationId);
  const ready = id !== null && isGroup && lastMessageId !== null;

  // Once per opening: the group changing, or its thread first loading.
  // Leaving and coming back asks again.
  useEffect(() => {
    if (!ready || id === null) return;
    let cancelled = false;
    fetchSponsoredCard(id).then((result) => {
      const after = latest.current;
      if (cancelled || !result.ok || !result.data || after === null) return;
      setSlot({
        conversationId: id,
        card: result.data,
        afterMessageId: String(after),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, ready]);

  return slot && slot.conversationId === id ? slot : null;
}

export function SponsoredSlot({ card }: { card: SponsoredCardData }) {
  const box = useRef<HTMLDivElement>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    let inView = false;
    let timer: number | undefined;
    let counted = false;

    const disarm = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const arm = () => {
      if (counted || timer !== undefined) return;
      if (!inView || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!inView || document.visibilityState !== "visible") return;
        counted = true;
        observer.disconnect();
        void reportSponsoredView(card.token);
      }, SEEN_AFTER_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.intersectionRatio >= 0.5;
        if (inView) arm();
        else disarm();
      },
      { threshold: [0, 0.5, 1] },
    );
    const onVisibility = () => {
      if (document.visibilityState === "visible") arm();
      else disarm();
    };
    observer.observe(element);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      disarm();
    };
  }, [card.token]);

  return (
    <div ref={box} className="flex justify-center py-3">
      <SponsoredCard
        companyName={card.companyName}
        headline={card.headline}
        body={card.body}
        imageUrl={card.imageUrl}
        ctaLabel={card.ctaLabel}
        ctaKind={card.ctaKind}
        ctaHref={card.clickUrl ?? undefined}
        onCta={card.formToken ? () => setFormOpen(true) : undefined}
      />
      {card.formToken && (
        <LeadFormModal
          formToken={card.formToken}
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
