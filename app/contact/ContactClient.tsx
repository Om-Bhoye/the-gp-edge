"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

const ROLE_OPTIONS = [
  "Select option…",
  "GP registrar",
  "International medical graduate",
  "Fellowed GP",
  "Medical educator or supervisor",
  "Training organisation",
  "Other",
];

const ENQUIRY_TYPE_OPTIONS = [
  "Select enquiry type…",
  "General enquiry",
  "Account or login",
  "Billing or refund",
  "Report a content error",
  "Technical problem",
  "Partnership or group access",
  "Privacy request",
  "Other",
];

export default function ContactClient() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [enquiryType, setEnquiryType] = useState(ENQUIRY_TYPE_OPTIONS[0]);
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enquiryType || enquiryType === ENQUIRY_TYPE_OPTIONS[0]) {
      setStatus("error");
      setErrorMessage("Please select an enquiry type.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Your message could not be sent. Please try again, or email us at admin@thegpedge.com.au.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-transparent select-text pb-16">
      {/* Header Spacer / Top Anchor */}
      <div className="pt-28 sm:pt-32 pb-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

        {/* Top Back Link */}
        <div className="max-w-4xl mx-auto mb-6 sm:mb-8 flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 hover:-translate-x-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Hero Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border border-emerald-200/80 dark:border-[rgba(90,200,176,0.3)] bg-emerald-50/90 dark:bg-[#151922] text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs uppercase tracking-[0.12em] mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Help &amp; Support Hub
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Contact us
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Questions about The GP Edge, your account, or our content? Use the form below or email us directly.
          </p>
        </div>

        {/* Main Content Container */}
        <main suppressHydrationWarning className="w-full max-w-4xl mx-auto bg-white dark:bg-[#151922] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 md:p-12 shadow-sm font-sans leading-relaxed text-slate-700 dark:text-slate-300 space-y-12">

          {/* Section 1 — Contact options */}
          <section id="contact-options" className="scroll-mt-28 space-y-6">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              Contact options
            </h2>

            <div className="flex flex-col gap-6">
              {/* General enquiries */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  General enquiries
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Email:{" "}
                  <a
                    href="mailto:admin@thegpedge.com.au"
                    className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700"
                  >
                    admin@thegpedge.com.au
                  </a>
                </p>
              </div>

              {/* Account, login & billing support */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Account, login and billing support
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please use the enquiry form below for enquiries about account, login and billing enquiries.
                </p>
              </div>

              {/* Report a content error */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Report a content error
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  If you think a question, answer or explanation is incorrect or out of date, tell us. Please use the &quot;Report&quot; button on the question itself. You can keep track of all your submitted reports under &ldquo;My feedback&rdquo; in your profile.
                </p>
              </div>

              {/* Privacy requests */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Privacy requests
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You can download a copy of the personal information we hold about you from your{" "}
                  <Link href="/dashboard/profile" className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700">
                    profile page
                  </Link>. You can delete your account at any time from your account settings.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  To make a privacy complaint, or ask anything else about your data, email{" "}
                  <a href="mailto:admin@thegpedge.com.au" className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700">
                    admin@thegpedge.com.au
                  </a>.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  To request a copy of our formal Privacy Policy, email{" "}
                  <a href="mailto:admin@thegpedge.com.au?subject=Privacy%20Policy%20Request" className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700">
                    admin@thegpedge.com.au
                  </a>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 — Contact form */}
          <section id="contact-form" className="scroll-mt-28 space-y-6">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              Contact form
            </h2>

            {status === "success" ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Message Received
                </div>
                <p className="text-sm sm:text-base leading-relaxed">
                  Thanks — your message has been received. We will reply to the email address you provided within 5 business days.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setMessage("");
                    }}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Send another message
                  </button>
                  <a
                    href={`mailto:admin@thegpedge.com.au?subject=${encodeURIComponent(
                      `[The GP Edge] ${enquiryType} - ${fullName}`
                    )}&body=${encodeURIComponent(
                      `Name: ${fullName}\nEmail: ${email}\nRole: ${role}\nEnquiry Type: ${enquiryType}\n\nMessage:\n${message}`
                    )}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Open in email client
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {status === "error" && errorMessage && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Full name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. John Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                    />
                  </div>

                  {/* Email address */}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Email address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@example.com.au"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* I am a… */}
                  <div className="space-y-1.5">
                    <label htmlFor="role" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      I am a…
                    </label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Enquiry type */}
                  <div className="space-y-1.5">
                    <label htmlFor="enquiryType" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Enquiry type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="enquiryType"
                      required
                      value={enquiryType}
                      onChange={(e) => setEnquiryType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
                    >
                      {ENQUIRY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <label htmlFor="message" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we assist you?"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all resize-y"
                  />
                </div>

                {/* Pre-submit privacy notice */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Please do not include patient information or any identifiable clinical details in your message.
                  </p>
                  <p>
                    By submitting this form you agree to us using your details to respond to your enquiry. For privacy enquiries or documentation requests, email{" "}
                    <a href="mailto:admin@thegpedge.com.au?subject=Privacy%20Inquiry" className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700">
                      admin@thegpedge.com.au
                    </a>.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send message"
                  )}
                </button>
              </form>
            )}
          </section>

          {/* Section 3 — What we can’t help with */}
          <section id="what-we-cant-help-with" className="scroll-mt-28 space-y-4">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              What we can’t help with
            </h2>
            <div className="space-y-3 text-sm sm:text-base">
              <p>
                The GP Edge is an educational service for doctors preparing for RACGP Fellowship exams. We do not provide medical advice to patients or clinical advice on individual cases. For medical concerns, see your GP. In an emergency, call 000.
              </p>
              <p>
                The GP Edge is independent and is not affiliated with or endorsed by the RACGP. For exam enrolment, dates, results and special consideration, contact the RACGP directly.
              </p>
            </div>
          </section>

          {/* Section 4 — Policy Documentation Requests */}
          <section id="policy-requests" className="scroll-mt-28 space-y-4">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              Policy documentation
            </h2>
            <div className="space-y-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              <p>
                Formal documentation for our Privacy Policy, Terms of Service, and Refund Policy is available upon request.
              </p>
              <p>
                To request any policy document, please contact our support team directly at{" "}
                <a
                  href="mailto:admin@thegpedge.com.au?subject=Policy%20Documentation%20Request"
                  className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 hover:text-teal-700"
                >
                  admin@thegpedge.com.au
                </a>.
              </p>
            </div>
          </section>

          {/* Section 5 — Business details */}
          <section id="business-details" className="scroll-mt-28 space-y-2">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              Business details
            </h2>
            <div className="text-sm sm:text-base space-y-1">
              <p className="font-bold text-slate-900 dark:text-slate-100">
                The GP Edge Pty Ltd
              </p>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                ABN: 66701866757
              </p>
            </div>
          </section>

          {/* Section 6 — Social links */}
          <section id="social-links" className="scroll-mt-28 space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              Social links
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
              <a
                href="https://www.instagram.com/thegpedge/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                <svg className="w-4 h-4 fill-pink-600" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.169a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
                </svg>
                Instagram
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <a
                href="https://www.youtube.com/@TheGPEdge"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                <svg className="w-4 h-4 fill-red-600" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                YouTube
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </section>

        </main>

        {/* Bottom Back Link */}
        <div className="w-full max-w-4xl mx-auto flex justify-end mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 hover:translate-x-0.5"
          >
            <span>Back to Home</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
