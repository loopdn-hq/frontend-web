import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Loopd'n",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="text-2xl font-semibold text-[#1d3f7f] dark:text-[#bfe2ff]">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 14, 2026">
      <section>
        <p>
          Loopd&apos;n (&ldquo;Loopd&apos;n,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a communication platform
          designed to help groups stay connected through SMS, web, and voice.
          This Privacy Policy explains how Loopd&apos;n handles information when
          you use our services.
        </p>
      </section>

      <section>
        <H2>1. Information We Collect</H2>
        <p>Depending on how you use Loopd&apos;n, we may handle:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Account information such as your name, email address, and phone
            number.
          </li>
          <li>Group and membership information.</li>
          <li>
            Group invitations, join requests, codes, and membership status.
          </li>
          <li>Messages and communication sent through Loopd&apos;n.</li>
          <li>Voice messages and related media.</li>
          <li>Delivery and usage information associated with messages.</li>
          <li>Information related to group roles and permissions.</li>
          <li>
            Technical information required to provide and secure the service.
          </li>
        </ul>
        <p>
          Loopd&apos;n&apos;s core architecture connects users, group
          memberships, messages, communication channels, and delivery records so
          that communication can work across SMS and web.
        </p>
      </section>

      <section>
        <H2>2. How We Use Information</H2>
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
        <H2>3. Your Conversations Are Private</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Private conversations and personal data are not sold or shared with
            advertisers.
          </li>
          <li>
            Loopd&apos;n does not use private conversation content for
            advertising targeting in the initial product.
          </li>
          <li>
            SMS consent data and related phone messaging preferences are not
            shared with third parties for promotional or marketing purposes.
          </li>
          <li>
            Where advertising is supported, targeting is designed around
            permitted aggregate information such as group category and geography
            rather than private conversation content.
          </li>
        </ul>
      </section>

      <section>
        <H2>4. SMS Communication</H2>
        <p>
          SMS is a core part of Loopd&apos;n. Members may be able to join and
          participate using an ordinary phone without installing an application
          or creating a full app account.
        </p>
        <p>
          SMS interactions may include commands such as <code>JOIN</code>,
          <code> HELP</code>, <code>MUTE</code>/<code>UNMUTE</code>, and
          <code> LEAVE</code>/<code>STOP</code>, depending on the finalized
          service configuration.
        </p>
      </section>

      <section>
        <H2>5. Voice &amp; Media</H2>
        <p>
          Loopd&apos;n may store and provide access to voice messages and other
          supported media so they can be delivered and played across supported
          channels.
        </p>
        <p>Voice and media links are designed to be secure and tokenized.</p>
      </section>

      <section>
        <H2>6. Groups &amp; Membership</H2>
        <p>Group administrators may control:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Who can join.</li>
          <li>Whether approval is required.</li>
          <li>Who can invite others.</li>
          <li>Who can post.</li>
          <li>Member roles.</li>
          <li>Member removal or blocking.</li>
          <li>Join links and codes.</li>
        </ul>
        <p>
          Depending on the group configuration, members may join through an
          approved link, code, invitation, QR code, or supported SMS flow.
        </p>
      </section>

      <section>
        <H2>7. Advertising</H2>
        <p>
          Loopd&apos;n may support sponsored communication as part of its
          business model.
        </p>
        <p>
          Sponsored content must be clearly labeled. Advertisers are not
          provided with private group conversations, member lists, or raw
          personal data.
        </p>
      </section>

      <section>
        <H2>8. Security &amp; Abuse Prevention</H2>
        <p>
          Loopd&apos;n&apos;s architecture is intended to include safeguards
          such as:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Spam prevention.</li>
          <li>Abuse controls.</li>
          <li>Blocking.</li>
          <li>Rate limits.</li>
          <li>Audit logging.</li>
          <li>Secure voice and media access.</li>
        </ul>
        <p>
          These controls are part of the product&apos;s planned security
          architecture.
        </p>
      </section>

      <section>
        <H2>9. Service Providers</H2>
        <p>
          Loopd&apos;n may work with telecommunications providers and other
          service providers necessary to deliver SMS and voice functionality.
        </p>
        <p>
          Telecom infrastructure may include provider systems, phone numbers,
          routing, carrier requirements, delivery events, and related technical
          services.
        </p>
      </section>

      <section>
        <H2>10. Data Retention</H2>
        <p>
          We retain personal information for as long as reasonably necessary to
          provide and operate the service, including maintaining group
          communication history, enforcing safety controls, and supporting user
          requests.
        </p>
        <p>
          We also retain certain records for legitimate business purposes such
          as security, fraud prevention, dispute resolution, and legal
          compliance. When information is no longer required for these purposes,
          we will delete it, de-identify it, or aggregate it in accordance with
          applicable law.
        </p>
      </section>

      <section>
        <H2>11. Your Choices</H2>
        <p>
          Depending on the functionality available to you, you may be able to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Leave a group.</li>
          <li>Mute or change notification settings.</li>
          <li>Stop SMS communication using supported commands.</li>
          <li>Request or manage membership access.</li>
          <li>Contact Loopd&apos;n regarding your information.</li>
        </ul>
      </section>

      <section>
        <H2>12. Changes to This Policy</H2>
        <p>
          We may update this Privacy Policy as Loopd&apos;n evolves. When
          changes are made, the updated version will be posted on this page with
          a revised &ldquo;Last Updated&rdquo; date.
        </p>
      </section>

      <section>
        <H2>13. Contact</H2>
        <p>For privacy questions or requests:</p>
        <p>Email: contact@loopdn.com</p>
        <p>Company: Loopd&apos;n</p>
        <p>Address: USA</p>
      </section>
    </LegalLayout>
  );
}
