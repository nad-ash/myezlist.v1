import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import LegalFooter from "@/components/common/LegalFooter";

export default function Terms() {
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
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">MYEZLIST – TERMS & CONDITIONS</h1>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Last Updated: January 18, 2026
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none">

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Welcome to MyEZList. By accessing or using our mobile application, website, or any related services (collectively, the "Service"), you agree to be bound by these Terms & Conditions ("Terms"). If you do not agree, please discontinue use of the Service.
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You must be at least 13 years old (or 16 years old where required by local law) to use the Service.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                We may update these Terms at any time. Continued use after updates constitutes acceptance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">2. Description of Service</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">MyEZList provides tools to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Create and manage grocery lists</li>
                <li>Organize categories and items</li>
                <li>Share lists collaboratively</li>
                <li>Manage household tasks and to-dos</li>
                <li>Store and organize recipes</li>
                <li>Use AI-powered suggestions and content generation</li>
                <li>Access free or premium subscription plans</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">3. User Accounts</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">3.1 Account Responsibilities</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">You agree to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Provide accurate registration information</li>
                <li>Keep your password secure</li>
                <li>Notify us of unauthorized access</li>
                <li>Accept responsibility for activity under your account</li>
                <li>Not share login credentials</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">3.2 Account Termination</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">We may suspend or terminate accounts for:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Violating these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Misuse or disruption of the Service</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300">
                You may terminate your account at any time via account deletion or by contacting support.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">4. Subscription Billing, Renewal & Cancellation</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.1 Subscription Plans</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Subscription details and pricing are displayed within the app and on our website.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.2 Billing</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Fees are billed monthly in advance</li>
                <li>All charges are in U.S. Dollars (USD)</li>
                <li>You authorize us (and Stripe) to bill your payment method</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.3 Auto-Renewal</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Subscriptions renew automatically unless canceled before the renewal date.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.4 Cancellation</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">You may cancel anytime from your account settings.</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Cancellation takes effect at the end of the current billing period</li>
                <li>Access to paid features continues until expiration</li>
                <li>After expiration, your account reverts to the Free tier</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.5 Refunds</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Refunds are governed by our Refund Policy:<br />
                👉 <a href={createPageUrl("RefundPolicy")} className="text-blue-600 hover:underline">https://myezlist.com/refundpolicy</a>
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.6 Price Changes</h3>
              <p className="text-slate-600 dark:text-slate-300">
                We may update subscription prices with 30 days' notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">5. Payments (Stripe)</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Payments are processed through Stripe, Inc. By subscribing or making a purchase, you agree to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Allow Stripe to charge your payment method</li>
                <li>Keep billing info updated</li>
                <li>Comply with Stripe's Terms of Service</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                We do not store complete credit card details.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Stripe is PCI-DSS Level 1 certified.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">6. Acceptable Use Policy</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">You agree NOT to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Violate laws or regulations</li>
                <li>Upload malicious code or viruses</li>
                <li>Attempt unauthorized access</li>
                <li>Harass, harm, or abuse other users</li>
                <li>Scrape or use bots without permission</li>
                <li>Interfere with the Service's functionality</li>
                <li>Reverse engineer or modify the platform</li>
                <li>Resell the Service without permission</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300">
                Violations may result in account suspension or termination.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">7. Intellectual Property Rights</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">7.1 Our IP</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                The Service's content, software, features, and design are owned by us and protected by copyright and IP laws.
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You may not copy, modify, distribute, sell, or exploit any part of the Service without written permission.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">7.2 Your Content</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                You retain ownership of the content you create (e.g., lists, tasks, recipes).
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You grant us a limited license to store, process, and display your content solely to operate the Service.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">7.3 Encrypted Content</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Certain content within the Service (such as task titles and descriptions) is encrypted on your device using industry-standard encryption before being transmitted to our servers.
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>We cannot read, access, or decrypt your encrypted content</li>
                <li>Only you can view this content when logged into your account</li>
                <li>Some metadata (e.g., due dates, timestamps) remains unencrypted to enable core functionality</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  ⚠️ Important: If you lose access to your account, your encrypted content cannot be recovered by us or any third party. You are solely responsible for maintaining access to your account and backing up critical information.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">8. No Professional Advice</h2>
              <p className="text-slate-600 dark:text-slate-300">
                AI-generated or app-provided suggestions (recipes, tips, etc.) are for informational purposes only and do not constitute medical, dietary, financial, legal, or professional advice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">9. Third-Party Services</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                The Service may integrate third-party tools (hosting, AI, analytics, payments). We are not responsible for third-party service performance or policies.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Your use of such services is governed by their terms and privacy practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">10. Modifications to the Service</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We may modify, update, or discontinue any part of the Service at any time without liability.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">11. Disclaimers</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                The Service is provided "AS IS" and "AS AVAILABLE", without warranties of any kind, including:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Merchantability</li>
                <li>Fitness for a particular purpose</li>
                <li>Accuracy</li>
                <li>Availability</li>
                <li>Non-infringement</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300">
                Use the Service at your own risk.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">12. Limitation of Liability</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">To the fullest extent permitted by law:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>We are not liable for indirect, incidental, or consequential damages</li>
                <li>We are not liable for data loss, loss of profits, or business interruption</li>
                <li>We are not liable for unauthorized access or alteration of your data</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300">
                Our total liability is limited to the amount you paid in the 12 months prior to the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">13. Indemnification</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                You agree to indemnify and hold harmless the operator of MyEZList from claims or damages arising from:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your content</li>
                <li>Your violation of third-party rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">14. DMCA / Copyright Complaints</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                If you believe your copyrighted material has been misused, notify us:
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                <strong>Email:</strong> <a href="mailto:support@myezlist.com" className="text-blue-600 hover:underline">support@myezlist.com</a>
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-2">Include:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Your name and contact details</li>
                <li>Description of the copyrighted work</li>
                <li>URL of the infringing material</li>
                <li>A good-faith statement</li>
                <li>A declaration under penalty of perjury</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">15. Arbitration & Class Action Waiver</h2>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">15.1 Arbitration</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Disputes must be resolved through binding arbitration, not court litigation.
              </p>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">15.2 Class Action Waiver</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                You agree to resolve disputes individually. You waive the right to participate in:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Class actions</li>
                <li>Class-wide arbitration</li>
                <li>Representative actions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">16. Governing Law</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                These Terms are governed by the laws of the State of California.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Disputes will be resolved in California courts unless arbitration rules state otherwise.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">17. Severability</h2>
              <p className="text-slate-600 dark:text-slate-300">
                If any part of these Terms is unenforceable, the remaining sections remain valid.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">18. Survival</h2>
              <p className="text-slate-600 dark:text-slate-300">
                Sections covering IP rights, disclaimers, limitations of liability, arbitration, and indemnification continue after account termination.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">19. Entire Agreement</h2>
              <p className="text-slate-600 dark:text-slate-300">
                These Terms constitute the entire agreement between you and the operator of MyEZList and supersede prior agreements.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">20. Contact Information</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                For questions or concerns about these Terms:
              </p>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-slate-700 dark:text-slate-200">
                  <strong>Email:</strong> <a href="mailto:support@myezlist.com" className="text-blue-600 hover:underline">support@myezlist.com</a>
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
      
      <LegalFooter />
    </div>
  );
}