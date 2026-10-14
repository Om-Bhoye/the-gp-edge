"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { submitCancellationFeedbackAction, createBillingPortalSessionAction } from "@/actions/stripe.actions";

interface Props {
  open: boolean;
  onClose: () => void;
  formattedExpiry?: string | null;
}

const REASONS = [
  "Too expensive / High cost",
  "Finished my exams / Stage completed",
  "Found an alternative solution",
  "Not using it enough",
  "Technical issues / Bugs",
  "Other",
];

export default function CancellationSurveyModal({ open, onClose, formattedExpiry }: Props) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedReason) {
      setError("Please select a reason.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Persist feedback in Neon DB
      const res = await submitCancellationFeedbackAction(selectedReason, feedback);

      if (!res.success) {
        throw new Error(res.error || "Failed to save feedback.");
      }

      // 2. Obtain Stripe Portal URL and redirect
      const portalRes = await createBillingPortalSessionAction();
      if (portalRes?.url) {
        window.location.href = portalRes.url;
      } else {
        throw new Error(portalRes?.error || "Failed to open billing portal.");
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmitting) onClose();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#151b23] rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-serif">
                  We&apos;re sorry to see you go
                </h2>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold mb-1 text-slate-900 dark:text-slate-100">How cancellation works:</p>
                <p className="leading-relaxed">
                  Canceling your recurring subscription will stop future automated renewals. You will maintain full paid access to your plan until the end of your current billing period{formattedExpiry ? <strong className="font-semibold text-slate-900 dark:text-slate-100"> ({formattedExpiry})</strong> : null}. After this date, your subscription will not renew, and your account will automatically revert to the Free tier.
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Please let us know why you are canceling your subscription. This helps us improve our platform.
              </p>

              <div className="space-y-3 mb-6">
                {REASONS.map((reason) => (
                  <label
                    key={reason}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="mt-0.5 w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded-full"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{reason}</span>
                  </label>
                ))}
              </div>

              {selectedReason === "Other" && (
                <div className="mb-6">
                  <textarea
                    placeholder="Please specify (optional)"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none min-h-[100px] resize-none"
                  />
                </div>
              )}

              {error && (
                <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-955/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedReason}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Continue to Cancel"
                  )}
                </button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
