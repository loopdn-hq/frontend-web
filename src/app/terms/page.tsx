import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service | Loopd'n",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{children}</h2>
  );
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="September 1, 2026">
      <section>
        <H2>1. Acceptance of these Terms</H2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of Loopd&apos;n, a communication platform that lets a group
          (&quot;Loop&quot;) stay connected across web, SMS and voice even when
          its members do not all use the same app. By creating an account,
          joining a Loop by SMS, or otherwise using the service, you agree to
          these Terms.
        </p>
      </section>

      <section>
        <H2>2. The Service</H2>
        <p>
          Loopd&apos;n lets an admin create a Loop that has both a web identity
          and a telecom routing identity (a phone number and/or join code).
          Members can participate over the web or, for SMS-only members, by
          texting the Loop&apos;s number - no app install is required for basic
          participation. Voice notes recorded on the web are made available to
          SMS-only members through a secure playback link. The service is under
          active development; features described in our product materials may
          launch in phases and are not all guaranteed to be available at any
          given time.
        </p>
      </section>

      <section>
        <H2>3. Accounts &amp; Eligibility</H2>
        <p>
          You must provide accurate registration information (such as a valid
          email or phone number) and keep your credentials secure. You are
          responsible for activity that happens under your account. You must be
          legally able to enter into these Terms in your jurisdiction to use
          Loopd&apos;n.
        </p>
      </section>

      <section>
        <H2>4. Loops, Joining &amp; Membership</H2>
        <p>
          Each Loop&apos;s admin chooses how members join: open access, a
          required join code, admin approval, or invite-only. Admins can remove
          or block members, control who may invite others, regenerate or revoke
          join links/codes, and assign additional admin or moderator roles. If
          you administer a Loop, you are responsible for how it is configured
          and for the people you allow to join it.
        </p>
      </section>

      <section>
        <H2>5. SMS &amp; Voice Messaging</H2>
        <p>
          SMS and voice are first-class parts of Loopd&apos;n, not an
          afterthought. By joining a Loop over SMS you consent to receive text
          messages from that Loop&apos;s routing number; standard message and
          data rates from your carrier may apply. Supported keywords such as{" "}
          <code>JOIN</code>, <code>HELP</code>, <code>MUTE</code>/
          <code>UNMUTE</code> and <code>LEAVE</code>/<code>STOP</code> let you
          manage participation without a web account. Voice notes you record are
          stored as secure message assets; SMS-only recipients access them
          through a tokenized playback link rather than an attachment.
        </p>
      </section>

      <section>
        <H2>6. Acceptable Use</H2>
        <p>You agree not to use Loopd&apos;n to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Send unsolicited SMS, voice or broadcast messages to people who have
            not consented to receive them from your Loop;
          </li>
          <li>
            Harass, threaten, defraud or impersonate any person or entity;
          </li>
          <li>
            Distribute illegal content or content that violates a third
            party&apos;s rights;
          </li>
          <li>
            Attempt to circumvent join controls, rate limits, or abuse
            protections; or
          </li>
          <li>
            Interfere with the normal operation of the service or its telecom
            integrations.
          </li>
        </ul>
        <p>
          We may suspend or remove content, members, Loops or accounts that
          violate this section.
        </p>
      </section>

      <section>
        <H2>7. Admin Responsibilities</H2>
        <p>
          Admins are responsible for the settings they choose for their Loop
          (joining method, posting/reply permissions, communication mode) and
          for ensuring their use of SMS and voice broadcast features complies
          with applicable telemarketing, messaging-consent and
          telecommunications laws in their jurisdiction.
        </p>
      </section>

      <section>
        <H2>8. Plans &amp; Billing</H2>
        <p>
          Loopd&apos;n supports free/sponsored Loops, paid ad-free Loops funded
          by a prepaid balance, and enterprise plans with negotiated terms.
          Where a Loop is on a paid plan, SMS and voice usage is deducted from
          its balance as it occurs; admins may enable automatic recharge for
          their own Loop. Fees are generally non-refundable except where
          required by law. Sponsored (ad-supported) Loops may display clearly
          labeled sponsored messages to help subsidize platform and telecom
          costs.
        </p>
      </section>

      <section>
        <H2>9. Advertising</H2>
        <p>
          Any advertising on Loopd&apos;n is clearly labeled as sponsored
          content. Advertisers do not receive access to private group
          conversations, member lists, or raw personal data; targeting, where
          offered, is limited to permitted aggregate information such as Loop
          category and geography.
        </p>
      </section>

      <section>
        <H2>10. Content &amp; Ownership</H2>
        <p>
          You retain ownership of the messages, voice notes and media you send.
          By sending content through Loopd&apos;n you grant us the rights
          necessary to transmit, store and deliver that content across the
          channels your Loop uses (web, SMS, voice), consistent with our{" "}
          <a href="/privacy/" className="text-sky-600 underline">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <H2>11. Termination</H2>
        <p>
          You may stop using Loopd&apos;n at any time. We may suspend or
          terminate accounts or Loops that violate these Terms, present a
          security or abuse risk, or where required by law or by our telecom
          partners.
        </p>
      </section>

      <section>
        <H2>12. Disclaimers &amp; Limitation of Liability</H2>
        <p>
          Loopd&apos;n is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis while in active MVP development. We do not
          guarantee uninterrupted delivery of SMS or voice messages, which
          depend in part on third-party carriers outside our control. To the
          maximum extent permitted by law, Loopd&apos;n is not liable for
          indirect, incidental or consequential damages arising from use of the
          service.
        </p>
      </section>

      <section>
        <H2>13. Changes to these Terms</H2>
        <p>
          We may update these Terms as the product evolves. Material changes
          will be reflected by updating the &quot;Last updated&quot; date above.
        </p>
      </section>

      <section>
        <H2>14. Contact</H2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:legal@loopdn.com" className="text-sky-600 underline">
            legal@loopdn.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
