import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import LegalFooter from "@/components/common/LegalFooter";

export default function RefundPolicy() {
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
            <CreditCard className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Refund & Cancellation Policy</h1>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Last Updated: November 25, 2025
          </p>
          
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            This policy explains how subscriptions, cancellations, and refunds work for the MyEZList app.
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none">

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">1. Subscription Auto-Renewal</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                All MyEZList paid subscriptions (Ad-Free, Pro, and Premium) are billed on a recurring monthly basis. Your subscription will automatically renew at the end of each billing cycle unless you cancel before the renewal date.
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>You will be charged the current subscription rate on each renewal date.</li>
                <li>Renewal charges are processed automatically using your saved payment method.</li>
                <li>You will receive a receipt via email for each successful payment.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">2. How to Cancel Your Subscription</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You may cancel your subscription at any time. To cancel:
              </p>
              <ol className="list-decimal pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Log in to your MyEZList account</li>
                <li>Go to <strong>Settings</strong></li>
                <li>Click <strong>Manage Subscription</strong></li>
                <li>Select <strong>Cancel Subscription</strong> in the Stripe customer portal</li>
              </ol>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>Important:</strong> Cancellation must be completed before your next billing date to avoid being charged for the following month.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">3. Access After Cancellation</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                When you cancel your subscription:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>You will retain full access to your paid subscription features until the end of your current billing period.</li>
                <li>After the billing period ends, your account will automatically revert to the Free tier.</li>
                <li>Your data (shopping lists, tasks, recipes) will be preserved, but you may lose access to features or exceed limits of the Free tier.</li>
                <li>You can resubscribe at any time to regain access to premium features.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">4. Refund Policy</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                <strong>Monthly subscription charges are generally non-refundable.</strong> However, we may provide refunds in the following circumstances:
              </p>
              
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.1 Eligible for Refund</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li><strong>Duplicate Billing:</strong> If you were accidentally charged twice for the same billing period.</li>
                <li><strong>Technical Failure:</strong> If a technical error on our end prevented you from accessing paid features for an extended period.</li>
                <li><strong>Unauthorized Charges:</strong> If charges were made without your authorization (subject to verification).</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.2 Not Eligible for Refund</h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 mb-4 space-y-2">
                <li>Change of mind after purchase</li>
                <li>Failure to cancel before the renewal date</li>
                <li>Partial month usage (we do not provide prorated refunds)</li>
                <li>Dissatisfaction with features that were accurately described</li>
                <li>Failure to use the app during the subscription period</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">4.3 How to Request a Refund</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                To request a refund for an eligible situation, please contact us at <a href="mailto:support@myezlist.com" className="text-blue-600 hover:underline">support@myezlist.com</a> with:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Your account email address</li>
                <li>Date of the charge in question</li>
                <li>Reason for the refund request</li>
                <li>Any relevant screenshots or documentation</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mt-4">
                Refund requests are typically processed within 5-10 business days. Approved refunds will be credited to your original payment method.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">5. Payment Processing</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                All payments for MyEZList subscriptions are securely processed through <strong>Stripe</strong>, a leading payment processing platform.
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Stripe handles all credit card and payment information securely.</li>
                <li>We do not store your complete credit card details on our servers.</li>
                <li>Stripe is PCI-DSS Level 1 compliant, the highest level of certification.</li>
                <li>For questions about a specific charge, you can view your billing history in the Stripe customer portal via your account settings.</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mt-4">
                Charges will appear on your statement as "MYEZLIST" or a similar descriptor.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">6. Free Trial (If Applicable)</h2>
              <p className="text-slate-600 dark:text-slate-300">
                If we offer a free trial period for any subscription tier, you will not be charged during the trial period. If you do not cancel before the trial ends, your subscription will automatically convert to a paid subscription and you will be charged the applicable subscription fee.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">7. Contact Us</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                If you have questions about billing, cancellations, or refunds, please don't hesitate to reach out:
              </p>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-slate-700 dark:text-slate-200">
                  <strong>Email:</strong> <a href="mailto:support@myezlist.com" className="text-blue-600 hover:underline">support@myezlist.com</a>
                </p>
                <p className="text-slate-700 dark:text-slate-200 mt-2">
                  <strong>Response Time:</strong> We typically respond within 24-48 hours.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">8. Compliance Notice</h2>
              <p className="text-slate-600 dark:text-slate-300">
                This Refund & Cancellation Policy complies with applicable California consumer protection laws and subscription billing regulations.
              </p>
            </section>

          </div>
        </div>
      </div>
      
      <LegalFooter />
    </div>
  );
}