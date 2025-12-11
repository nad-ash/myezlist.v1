import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import LegalFooter from "@/components/common/LegalFooter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to={createPageUrl("Landing")}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">MYEZLIST – PRIVACY POLICY</h1>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Last Updated: November 25, 2025
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none">

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Welcome to MyEZList. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our mobile application and website (collectively, the "Service"). The Service is operated by an individual based in California.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                By using MyEZList, you agree to the practices described in this Privacy Policy. If you do not agree, please discontinue use of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, password, and any information you provide during registration.</li>
                <li><strong>Profile Information:</strong> Optional profile details you choose to add.</li>
                <li><strong>User Content:</strong> Shopping lists, items, tasks, recipes, notes, and other content you create within the Service.</li>
                <li><strong>Payment Information:</strong> Collected directly by our payment processor (Stripe). We do not store full credit card details.</li>
                <li><strong>Communications:</strong> Any information you share when contacting support.</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">2.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Device Data:</strong> Device type, operating system, browser type, and unique device identifiers.</li>
                <li><strong>Usage Data:</strong> Pages/screens visited, features used, time spent, and interaction patterns.</li>
                <li><strong>Log Data:</strong> IP address, timestamps, and referring URLs.</li>
                <li><strong>Approximate Location:</strong> Derived from your IP address (we do not collect precise GPS location).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Provide, operate, and maintain the Service</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send notifications, updates, and support messages</li>
                <li>Respond to inquiries and support requests</li>
                <li>Improve Service performance and functionality</li>
                <li>Detect and prevent fraud or misuse</li>
                <li>Personalize user experience</li>
                <li>Comply with legal or regulatory obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">4. Cookies & Tracking Technologies</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Keep you signed in</li>
                <li>Save preferences</li>
                <li>Analyze usage trends</li>
                <li>Improve overall performance</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Google Analytics / Firebase</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We may use tools such as Google Analytics or Firebase to collect aggregated usage data.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Cookie Opt-Out</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You may disable cookies through your browser settings.<br />
                <strong>Note:</strong> Some features may not work correctly if cookies are disabled.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Do Not Track (DNT)</h3>
              <p className="text-slate-600 dark:text-slate-300">
                The Service does not respond to DNT browser signals.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">5. Payments & Subscriptions (Stripe)</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Payments are processed through Stripe.</li>
                <li>Stripe collects and secures your payment information.</li>
                <li>We receive limited information (e.g., card type, last 4 digits).</li>
                <li>Stripe's Privacy Policy: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://stripe.com/privacy</a></li>
                <li>Stripe is PCI-DSS Level 1 certified.</li>
                <li>We store your Stripe customer ID to manage your subscription.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">6. Data Sharing & Third-Party Services</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">We may share your information with:</p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Service Providers</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Vendors that provide hosting, analytics, infrastructure, email, and payment processing.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Other Users</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                When you share lists or collaborate, shared content (including your name/email) is visible to other participants.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Legal Compliance</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We may disclose information when required by law, subpoena, or legal process.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Business Transactions</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                In the event of a merger, acquisition, or transfer of assets.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-blue-800 dark:text-blue-200 font-medium">
                  We do not sell your personal information.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">7. Data Retention</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We retain your information while your account is active and as needed to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Maintain Service functionality</li>
                <li>Resolve disputes</li>
                <li>Enforce agreements</li>
                <li>Meet legal obligations</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300">
                When you delete your account, we delete or anonymize personal data within 30 days, unless retention is required by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">8. User Rights</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">8.1 General Rights</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">All users may:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Access their personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request account deletion</li>
                <li>Export their data</li>
                <li>Opt out of marketing communications</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">8.2 California Residents (CCPA/CPRA)</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">California users may request:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>What personal data we collected</li>
                <li>Deletion of personal data (with exceptions)</li>
                <li>Correction of inaccurate data</li>
                <li>Opt-out of data "sharing" (we do not sell or share data)</li>
                <li>Non-discriminatory service</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">8.3 EU/UK Users (GDPR)</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">You may request:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Access to your personal data</li>
                <li>Correction or deletion</li>
                <li>Restriction of processing</li>
                <li>Data portability</li>
                <li>Objection to processing</li>
                <li>Withdrawal of consent</li>
                <li>Filing a complaint with a supervisory authority</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Legal Basis for Processing (GDPR)</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">We process data based on:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Contract necessity</li>
                <li>Legitimate interests</li>
                <li>Consent</li>
                <li>Legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">9. Data Security</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We use commercially reasonable safeguards, including:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Encryption in transit (TLS/SSL)</li>
                <li>Access controls and authentication</li>
                <li>Regular security reviews</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                However, no method of storage or transmission is 100% secure.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">Data Breach Notification</h3>
              <p className="text-slate-600 dark:text-slate-300">
                If a breach occurs, we will notify affected users as required by applicable law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">10. Children's Privacy</h2>
              <p className="text-slate-600 dark:text-slate-300">
                The Service is not intended for children under 13 years of age (or under 16 where required by local laws). If we learn a child has submitted data, we will delete it promptly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">11. Data Storage Location</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Your data is stored on secure servers located in the United States.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Some operational processes—such as analytics, caching, or AI-powered features—may temporarily process data in other geographic regions for performance and reliability. Permanent storage remains within U.S. data centers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">12. AI Processing</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Certain features of the Service use artificial intelligence (AI) or machine-learning technologies.
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Your input may be transmitted to AI systems to generate responses or suggestions.</li>
                <li>Long-term storage of content follows this Privacy Policy.</li>
                <li>We do not intentionally permit AI providers to use your data for their own independent model training unless required to operate the Service and covered by the provider's published policies.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">13. International Data Transfers</h2>
              <p className="text-slate-600 dark:text-slate-300">
                Your information may be processed outside your country of residence. We implement appropriate safeguards when required by law (e.g., Standard Contractual Clauses).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">14. Changes to This Privacy Policy</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We may update this Privacy Policy from time to time. Material updates will be posted here with an updated "Last Updated" date.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Continued use of the Service constitutes acceptance of the revised policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">15. Contact Information</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                If you have questions, concerns, or wish to exercise your privacy rights, contact us:
              </p>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-slate-700 dark:text-slate-200">
                  <strong>Email:</strong> <a href="mailto:support@myezlist.com" className="text-blue-600 hover:underline">support@myezlist.com</a>
                </p>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-4">
                We aim to respond within 30 days (or sooner as required).
              </p>
            </section>

          </div>
        </div>
      </div>
      
      <LegalFooter />
    </div>
  );
}