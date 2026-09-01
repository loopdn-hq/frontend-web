import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Loopd'n",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{children}</h2>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 1, 2026">
      <section>
        <H2>1. Overview</H2>
        <p>
          This policy explains what information Loopd&apos;n collects when you
          create an account, join a Loop, or communicate over web, SMS or voice,
          and how that information is used. Loopd&apos;n is a multi-channel
          group communication platform: the same Loop can be reached by web
          members and by members who only use SMS or voice.
        </p>
      </section>

      <section>
        <H2>2. Information We Collect</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> email address and/or phone
            number, username, display name, and password (stored hashed).
          </li>
          <li>
            <strong>Loop &amp; membership data:</strong> the Loops you create or
            join, your role (admin/member), join method, and moderation actions
            (e.g. blocks, removals).
          </li>
          <li>
            <strong>Message content:</strong> text messages, voice notes, media
            and reactions you send, regardless of whether they were sent from
            the web or from SMS.
          </li>
          <li>
            <strong>Telecom &amp; delivery metadata:</strong> phone numbers used
            for SMS/voice delivery, delivery/receipt status, and provider event
            data needed to route messages and (for paid Loops) meter usage.
          </li>
          <li>
            <strong>Usage &amp; billing data:</strong> a usage ledger of
            SMS/voice deliveries for Loops on a paid plan, and wallet/balance
            information.
          </li>
          <li>
            <strong>Device &amp; log data:</strong> basic technical data (such
            as IP address and browser type) used for security and abuse
            prevention.
          </li>
        </ul>
      </section>

      <section>
        <H2>3. How We Use Information</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Deliver messages across the channels a Loop uses (web, SMS, voice)
            and keep the unified conversation in sync;
          </li>
          <li>Operate joining, membership, and admin/moderation controls;</li>
          <li>Meter and bill usage for ad-free/paid Loops;</li>
          <li>Provide customer support and respond to requests;</li>
          <li>Detect and prevent spam, abuse and fraud; and</li>
          <li>Improve the reliability and features of the service.</li>
        </ul>
      </section>

      <section>
        <H2>4. SMS &amp; Voice Specific Practices</H2>
        <p>
          Phone numbers are used to route messages for the service and are not
          sold. SMS members can opt out at any time by texting <code>STOP</code>{" "}
          (or <code>MUTE</code>/<code>LEAVE</code> for finer-grained control) to
          a Loop&apos;s number. Voice notes are stored as secure message assets;
          SMS-only recipients access them through a tokenized playback link
          rather than a raw file, so the link itself does not expose the
          underlying storage location.
        </p>
      </section>

      <section>
        <H2>5. How We Share Information</H2>
        <p>
          We do not sell your personal information. We share information only:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            With telecom/carrier and infrastructure providers, to the extent
            needed to deliver SMS, voice and web messages;
          </li>
          <li>
            With service providers who process data on our behalf under
            confidentiality obligations (e.g. hosting, storage);
          </li>
          <li>
            When required by law, legal process, or to protect the rights,
            safety or property of Loopd&apos;n or our users; or
          </li>
          <li>With your consent.</li>
        </ul>
        <p>
          Private conversation content and member lists are never shared with
          advertisers.
        </p>
      </section>

      <section>
        <H2>6. Advertising &amp; Sponsored Content</H2>
        <p>
          Free/sponsored Loops may show clearly labeled sponsored messages. We
          do not use the content of private conversations to target advertising.
          Where targeting is offered, it is limited to permitted aggregate
          information, such as a Loop&apos;s category and geography - not
          individual message content or member identities.
        </p>
      </section>

      <section>
        <H2>7. Data Retention</H2>
        <p>
          We retain account, Loop and message data for as long as your account
          or Loop is active, and for a reasonable period afterward as needed for
          legal, security or billing-record purposes. You can request deletion
          of your account as described below.
        </p>
      </section>

      <section>
        <H2>8. Security</H2>
        <p>
          We use reasonable technical and organizational safeguards to protect
          your information, including tokenized links for voice/media playback
          rather than direct file access. No method of transmission or storage
          is completely secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <H2>9. Your Rights &amp; Choices</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access, correct or delete your account information;</li>
          <li>
            Opt out of SMS from a specific Loop at any time via{" "}
            <code>STOP</code>;
          </li>
          <li>Leave any Loop you have joined; and</li>
          <li>
            Contact us to request a copy of, or the deletion of, your personal
            data.
          </li>
        </ul>
      </section>

      <section>
        <H2>10. Children&apos;s Privacy</H2>
        <p>
          Loopd&apos;n is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <H2>11. Changes to this Policy</H2>
        <p>
          We may update this policy as the product evolves. Material changes
          will be reflected by updating the &quot;Last updated&quot; date above.
        </p>
      </section>

      <section>
        <H2>12. Contact Us</H2>
        <p>
          Questions about this policy or requests regarding your data can be
          sent to{" "}
          <a
            href="mailto:privacy@loopdn.com"
            className="text-sky-600 underline"
          >
            privacy@loopdn.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
