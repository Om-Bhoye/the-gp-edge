"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/thegpedge/",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.169a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@TheGPEdge",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer suppressHydrationWarning className="relative w-full pt-10 pb-8 md:pt-12 md:pb-9 bg-transparent border-t border-slate-200/60 dark:border-slate-800/80">
      <style>{`
        .footer-animated-link {
          align-items: center;
          background-color: transparent;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.5;
          text-decoration: none;
          outline: 0;
          border: 0;
          transition: color 0.3s ease;
          width: max-content;
        }

        .dark .footer-animated-link {
          color: #cbd5e1;
        }

        .footer-animated-link:before {
          background-color: #0d9488;
          content: "";
          display: inline-block;
          height: 1.5px;
          margin-right: 0px;
          transition: all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
          width: 0;
        }

        .dark .footer-animated-link:before {
          background-color: #58c1ae;
        }

        .footer-animated-link:hover {
          color: #0d9488;
        }

        .dark .footer-animated-link:hover {
          color: #58c1ae;
        }

        .footer-animated-link:hover:before {
          margin-right: 6px;
          width: 0.9rem;
        }
      `}</style>

      {/* Background ambient pattern */}
      <div
        className="absolute inset-0 opacity-[0.25] pointer-events-none dark:hidden"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(203,213,225) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main 5-Column Grid Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-0 items-start">
          {/* Column 1: Logo & Brand Tagline */}
          <div className="lg:col-span-3 flex items-center gap-3.5 lg:pr-6 lg:border-r lg:border-slate-200/70 dark:lg:border-slate-800 py-1">
            <div className="flex-shrink-0">
              <Image
                src="/assets/logo.png"
                alt="The GP Edge"
                width={120}
                height={120}
                className="w-auto h-16 md:h-18 object-contain"
                priority
              />
            </div>
            <p className="text-xs md:text-[13px] leading-relaxed font-medium text-slate-600 dark:text-slate-400 max-w-[280px]">
              Empowering GP registrars with the right tools to prepare, practice and succeed in every step of their journey.
            </p>
          </div>

          {/* Column 2: Exam Prep Hub */}
          <div className="lg:col-span-2 lg:px-6 lg:border-r lg:border-slate-200/70 dark:lg:border-slate-800 py-1">
            <Link href="/exam-prep" className="group block">
              <h4 className="text-xs md:text-sm font-bold text-teal-700 dark:text-teal-400 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors mb-1.5">
                Exam Prep
              </h4>
              <p className="text-xs md:text-[13px] leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                Your complete exam preparation hub.
              </p>
            </Link>
          </div>

          {/* Column 3: Links */}
          <div className="lg:col-span-2 lg:px-6 lg:border-r lg:border-slate-200/70 dark:lg:border-slate-800 flex flex-col gap-3 py-1">
            <Link href="/about" className="footer-animated-link">
              About Us
            </Link>
            <Link href="/contact" className="footer-animated-link">
              Contact Us
            </Link>
            <Link href="/contact" className="footer-animated-link">
              Support
            </Link>
          </div>

          {/* Column 4: Legal Links */}
          <div className="lg:col-span-2 lg:px-6 lg:border-r lg:border-slate-200/70 dark:lg:border-slate-800 flex flex-col gap-3 py-1">
            <Link href="/privacy-policy" className="footer-animated-link">
              Privacy Policy
            </Link>
            <Link href="/terms" className="footer-animated-link">
              Terms of Service
            </Link>
            <Link href="/refund-policy" className="footer-animated-link">
              Refund Policy
            </Link>
          </div>

          {/* Column 5: Newsletter Subscription */}
          <div className="lg:col-span-3 lg:pl-6 flex flex-col justify-start py-1">
            <h4 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
              Get updates and expert
            </h4>
            <p className="text-xs md:text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2.5">
              insights straight to your inbox.
            </p>

            {subscribed ? (
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 py-2 px-3 rounded-lg border border-teal-200 dark:border-teal-800 text-center">
                You&apos;re subscribed!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="relative flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-3.5 pr-10 py-2 text-xs md:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all shadow-xs"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="absolute right-1 w-8 h-8 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400"
                >
                  <Send className="w-4 h-4 shrink-0" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar Divider & Copyright */}
        <div className="mt-6 pt-5 md:mt-7 md:pt-5 border-t border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left Copyright Text */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-medium text-center md:text-left -ml-1 sm:-ml-2 lg:-ml-3">
            <span>© 2026 The GP Edge. All rights reserved.</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>Built for Australian GPs</span>
          </div>

          {/* Right Social Icons */}
          <div className="flex items-center gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-200 dark:hover:border-teal-800 flex items-center justify-center transition-all shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
