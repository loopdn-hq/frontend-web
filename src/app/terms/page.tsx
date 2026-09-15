import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions | Loopd'n",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="text-2xl font-semibold text-[#1d3f7f] dark:text-[#bfe2ff]">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" lastUpdated="September 14, 2026">
      <section>
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of
          Loopd&apos;n and its communication services.
          <br />
          By using Loopd&apos;n, you agree to these Terms.
        </p>
      </section>

      <section>
        <H2>1. About Loopd&apos;n</H2>
        <p>
          Loopd&apos;n is a communication platform that allows groups to stay
          connected through supported channels including SMS, web, and voice.
          The platform is designed so that members do not necessarily need to
          use the same application or communication method to participate in a
          group.
        </p>
      </section>

      <section>
        <H2>2. Accounts</H2>
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create and manage Loopd&apos;n groups.</li>
          <li>Manage memberships, roles, and permissions.</li>
          <li>Deliver messages through supported communication channels.</li>
          <li>Provide the shared SMS + web conversation experience.</li>
          <li>Deliver and play voice messages.</li>
          <li>Process join requests and invitations.</li>
          <li>Provide delivery and usage records.</li>
          <li>Maintain, secure, and improve the service.</li>
          <li>Prevent spam, abuse, and unauthorized access.</li>
        </ul>
      </section>

      <section>
        <H2>3. Creating &amp; Managing Groups</H2>
        <p>Group administrators can create and manage Loopd&apos;n groups.</p>
        <p>Administrators may configure:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Group membership.</li>
          <li>Join methods.</li>
          <li>Posting permissions.</li>
          <li>Invitations.</li>
          <li>Member roles.</li>
          <li>Approval requirements.</li>
          <li>Chat or broadcast mode.</li>
          <li>Member removal and blocking.</li>
        </ul>
        <p>
          Administrators are responsible for managing their groups appropriately
          and using these controls in accordance with applicable laws and these
          Terms.
        </p>
      </section>

      <section>
        <H2>4. Joining a Group</H2>
        <p>Loopd&apos;n may support multiple joining methods, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Open joining.</li>
          <li>Join codes.</li>
          <li>Admin approval.</li>
          <li>Invite-only access.</li>
          <li>Links.</li>
          <li>QR codes.</li>
          <li>Supported SMS joining.</li>
        </ul>
        <p>
          The exact available joining methods may depend on the group&apos;s
          configuration.
        </p>
      </section>

      <section>
        <H2>5. Messaging</H2>
        <p>
          Loopd&apos;n supports communication through supported channels such as
          SMS and web.
        </p>
        <p>
          Messages sent through supported channels may be represented within a
          unified group conversation, allowing web users and SMS participants to
          communicate within the same underlying group.
        </p>
      </section>

      <section>
        <H2>6. Voice Messages</H2>
        <p>
          Loopd&apos;n may allow web users to record and send voice messages.
        </p>
        <p>
          Voice messages may be stored and made available for playback,
          including through secure playback links for supported SMS
          participants.
        </p>
      </section>

      <section>
        <H2>7. Chat &amp; Broadcast Groups</H2>
        <p>A Loopd&apos;n group may operate as either:</p>
        <p>
          Chat Group - members can communicate with the group according to the
          administrator&apos;s permissions.
        </p>
        <p>
          Broadcast Group - administrators can send announcements to members,
          with replies controlled according to the group&apos;s configuration.
        </p>
      </section>

      <section>
        <H2>8. Acceptable Use</H2>
        <p>You agree not to use Loopd&apos;n to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Send spam or abusive communications.</li>
          <li>Harass, threaten, or harm others.</li>
          <li>Circumvent group membership or access controls.</li>
          <li>Abuse SMS, voice, or other communication systems.</li>
          <li>Attempt unauthorized access to accounts, groups, or systems.</li>
          <li>
            Use Loopd&apos;n in a way that violates applicable laws or
            regulations.
          </li>
        </ul>
        <p>
          Loopd&apos;n may use blocking, rate limits, abuse controls, and other
          safeguards to protect users and the service.
        </p>
      </section>

      <section>
        <H2>9. SMS Rules</H2>
        <p>
          When participating through SMS, users may receive messages and service
          instructions associated with the group.
        </p>
        <p>
          Message frequency may vary based on group activity, group settings,
          and your interactions with supported SMS commands.
        </p>
        <p>
          Supported SMS commands may include <code>JOIN</code>,
          <code> HELP</code>, <code>MUTE</code>/<code>UNMUTE</code>, and
          <code> LEAVE</code>/<code>STOP</code>, depending on the service
          configuration.
        </p>
        <p>
          Users should only join groups and send communications where they have
          the appropriate permission or authorization to do so.
        </p>
      </section>

      <section>
        <H2>10. Administrator Responsibilities</H2>
        <p>Group administrators are responsible for:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Managing their members.</li>
          <li>Configuring appropriate joining permissions.</li>
          <li>Managing invitations and access.</li>
          <li>Using moderation and blocking controls appropriately.</li>
          <li>
            Ensuring their group communications comply with applicable
            requirements.
          </li>
        </ul>
      </section>

      <section>
        <H2>11. Third-Party Services</H2>
        <p>
          Loopd&apos;n relies on third-party telecommunications infrastructure
          and other service providers to support certain SMS and voice
          functionality.
        </p>
        <p>
          Availability and delivery may therefore depend on external providers,
          carriers, networks, and technical conditions.
        </p>
      </section>

      <section>
        <H2>12. Future Features</H2>
        <p>
          Loopd&apos;n may introduce additional communication channels and
          functionality in the future.
        </p>
        <p>
          Potential future functionality described in the product plan includes
          integrations with platforms such as WhatsApp and Telegram where their
          APIs and policies permit the intended experience. Such functionality
          should not be considered available unless officially released by
          Loopd&apos;n.
        </p>
      </section>

      <section>
        <H2>13. Service Availability</H2>
        <p>
          Loopd&apos;n is provided as a technology service and may experience
          interruptions, delays, carrier limitations, maintenance, or other
          technical issues.
        </p>
        <p>
          The MVP documentation does not define specific uptime guarantees or
          service-level commitments. Any such commitments should be added
          separately if offered.
        </p>
      </section>

      <section>
        <H2>14. Fees &amp; Payments</H2>
        <p>
          The MVP document does not define final pricing, billing terms,
          refunds, taxes, or payment obligations in sufficient detail to create
          binding terms.
        </p>
        <p>
          [Insert final pricing, billing, refund, subscription, and payment
          terms before publication.]
        </p>
      </section>

      <section>
        <H2>15. Intellectual Property</H2>
        <p>
          [Insert company-specific intellectual property ownership and license
          terms.]
        </p>
        <p>
          The MVP document does not specify the legal ownership or licensing
          terms for the Loopd&apos;n software, brand, content, or user-generated
          content.
        </p>
      </section>

      <section>
        <H2>16. Termination</H2>
        <p>
          Loopd&apos;n may restrict or terminate access where necessary to
          protect the service, users, groups, or telecommunications systems,
          subject to the final company&apos;s policies and applicable law.
        </p>
        <p>
          Specific termination, suspension, and account-deletion procedures
          should be added before publication.
        </p>
      </section>

      <section>
        <H2>17. Disclaimers</H2>
        <p>
          Loopd&apos;n does not guarantee that every message will be delivered
          instantly or successfully across every communication channel.
        </p>
        <p>
          SMS and voice delivery can depend on telecommunications providers,
          carrier networks, routing, and other external systems.
        </p>
      </section>

      <section>
        <H2>18. Limitation of Liability</H2>
        <p>
          To the maximum extent permitted by applicable law, Loopd&apos;n and
          its affiliates, officers, employees, and service providers will not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or for any loss of profits, revenues, data,
          goodwill, or business opportunities, arising out of or related to your
          use of the service.
        </p>
        <p>
          To the maximum extent permitted by applicable law, Loopd&apos;n&apos;s
          aggregate liability for all claims arising out of or related to the
          service will not exceed the greater of (a) the total amount you paid
          to Loopd&apos;n for the service in the three (3) months before the
          event giving rise to liability, or (b) U.S. $50.00. Nothing in these
          Terms limits liability that cannot be limited under applicable law.
        </p>
      </section>

      <section>
        <H2>19. Governing Law</H2>
        <p>
          These Terms are governed by the laws of the United States and the
          State of Delaware, without regard to conflict-of-law principles.
        </p>
        <p>
          Except where prohibited by applicable law, any dispute arising out of
          or relating to these Terms or the service will be resolved exclusively
          in the state or federal courts located in Delaware, and you and
          Loopd&apos;n consent to the personal jurisdiction of those courts. If
          mandatory consumer protection laws in your U.S. state of residence
          provide additional rights, those rights remain in effect.
        </p>
      </section>

      <section>
        <H2>20. Changes to These Terms</H2>
        <p>
          We may update these Terms as Loopd&apos;n evolves. Updated Terms will
          be published on this page with a revised &ldquo;Last Updated&rdquo;
          date.
        </p>
      </section>

      <section>
        <H2>21. Contact</H2>
        <p>For questions regarding these Terms:</p>
        <p>Email: contact@loopdn.com</p>
        <p>Company: Loopd&apos;n</p>
        <p>Address: USA</p>
      </section>
    </LegalLayout>
  );
}
