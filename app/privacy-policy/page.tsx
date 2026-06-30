
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Titi Marketplace",
  description: "Privacy Policy for Titi Marketplace",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-4xl font-bold">Privacy Policy</h1>

      <p className="mb-8 text-sm opacity-70">
        Last Updated: June 22, 2026
      </p>

      <section className="mb-8">
        <p>
          Titi Marketplace ("Titi", "we", "our", or "us") respects your
          privacy and is committed to protecting your personal information.
          This Privacy Policy explains how we collect, use, store, disclose,
          and protect information when you access or use our marketplace.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          1. Information We Collect
        </h2>

        <h3 className="font-medium">
          Pi Network Information
        </h3>

        <ul className="list-disc pl-6">
          <li>Pi username</li>
          <li>Pi user identifier</li>
          <li>Authentication information</li>
          <li>Wallet information required for payments</li>
        </ul>

        <h3 className="mt-4 font-medium">
          Marketplace Information
        </h3>

        <ul className="list-disc pl-6">
          <li>User profile information</li>
          <li>Store information</li>
          <li>Seller information</li>
          <li>Product listings</li>
          <li>Product descriptions</li>
          <li>Product images</li>
          <li>Order history</li>
          <li>Purchase history</li>
          <li>Sales history</li>
        </ul>

        <h3 className="mt-4 font-medium">
          Shipping Information
        </h3>

        <ul className="list-disc pl-6">
          <li>Recipient name</li>
          <li>Shipping address</li>
          <li>Country and region</li>
          <li>Postal code if provided</li>
          <li>Delivery contact information</li>
        </ul>

        <h3 className="mt-4 font-medium">
          Payment Information
        </h3>

        <ul className="list-disc pl-6">
          <li>Payment identifiers</li>
          <li>Blockchain transaction identifiers</li>
          <li>Settlement records</li>
          <li>Escrow records</li>
          <li>Withdrawal requests</li>
          <li>Withdrawal status information</li>
        </ul>

        <h3 className="mt-4 font-medium">
          Technical Information
        </h3>

        <ul className="list-disc pl-6">
          <li>IP address</li>
          <li>Browser type</li>
          <li>Operating system</li>
          <li>Device information</li>
          <li>Security logs</li>
          <li>Error logs</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          2. How We Use Information
        </h2>

        <ul className="list-disc pl-6">
          <li>Create and manage user accounts.</li>
          <li>Authenticate users through Pi Network.</li>
          <li>Process purchases and sales.</li>
          <li>Process withdrawals and settlements.</li>
          <li>Provide customer support.</li>
          <li>Prevent fraud and abuse.</li>
          <li>Maintain platform security.</li>
          <li>Improve marketplace services.</li>
          <li>Comply with legal obligations.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          3. Blockchain Transactions
        </h2>

        <p>
          Titi Marketplace utilizes Pi Network payment services. Blockchain
          transaction information may be publicly visible and permanently
          recorded on the blockchain.
        </p>

        <p className="mt-3">
          We do not store wallet private keys, wallet passwords, or recovery
          phrases.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          4. Sharing Information
        </h2>

        <p>
          We do not sell personal information.
        </p>

        <p className="mt-3">
          Information may be shared only when necessary with:
        </p>

        <ul className="list-disc pl-6">
          <li>Shipping providers</li>
          <li>Cloud hosting providers</li>
          <li>Payment infrastructure providers</li>
          <li>Fraud prevention services</li>
          <li>Government authorities when required by law</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          5. Data Retention
        </h2>

        <p>
          Information is retained as long as reasonably necessary for account
          management, transaction processing, dispute resolution, fraud
          prevention, security monitoring, and legal compliance.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          6. Security
        </h2>

        <p>
          We implement technical and organizational safeguards including access
          controls, authentication mechanisms, encrypted communications,
          monitoring systems, and security logging.
        </p>

        <p className="mt-3">
          No internet-based system can guarantee absolute security.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          7. Account Deletion
        </h2>

        <p>
          Users may request account deletion by contacting support. Certain
          records may be retained where required by law, accounting obligations,
          dispute resolution requirements, or fraud prevention needs.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          8. Children's Privacy
        </h2>

        <p>
          Titi Marketplace is not intended for individuals who are not legally
          permitted to use the platform under applicable laws or Pi Network
          policies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">
          9. Changes to This Policy
        </h2>

        <p>
          We may update this Privacy Policy from time to time. Updated versions
          will be posted on this page.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">
          10. Contact Information
        </h2>

        <p>Email: support@titi.onl</p>
        <p>Website: https://titi.onl</p>
      </section>
    </main>
  );
}
