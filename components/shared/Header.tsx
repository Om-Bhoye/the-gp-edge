"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { House, Menu, X, Sun, Moon } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { useSidebarOptional } from "@/contexts/SidebarContext";
import { useTheme } from "@/contexts/ThemeContext";

// The complete public navbar, surfaced inside the mobile hamburger menu.
const MENU_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/exam-prep", label: "Exam Prep" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#about", label: "About Us" },
];

// Custom reactive authentication state wrappers since SignedIn/SignedOut are removed in this Clerk version
function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <>{children}</> : null;
}

function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return !isSignedIn ? <>{children}</> : null;
}

interface HeaderProps {
  variant?: "fixed" | "static";
}

const Header = memo(function Header({ variant = "fixed" }: HeaderProps) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  // null on pages without a SidebarProvider (landing, auth, etc.) — the mobile
  // sidebar hamburger only renders inside the dashboard where this exists.
  const sidebar = useSidebarOptional();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Mobile navbar menu (used on pages without the dashboard sidebar drawer).
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isHomePage = pathname === "/";
  const showNavbarLogo = !isHomePage || isScrolled;

  if (!mounted) {
    return null;
  }

  // Hide the navbar on all admin pages and on test-taking pages (instructions + live test)
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/test/")) {
    return null;
  }

  // Hide the global fixed header ONLY on pages that render inside DashboardShell:
  // (DashboardShell renders its own static Header variant="static")
  // - All /dashboard pages
  // - All /exam-prep pages
  // - The home page "/" when the user is signed in (app/page.tsx renders DashboardShell for signed-in users)
  const isRenderedInsideDashboardShell =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/exam-prep") ||
    (pathname === "/" && isSignedIn);

  if (variant === "fixed" && isRenderedInsideDashboardShell) {
    return null;
  }

  const outerClass =
    variant === "static"
      ? "relative w-full bg-transparent border-none shadow-none"
      : "fixed top-6 inset-x-0 w-full z-50 bg-transparent border-none shadow-none";
  const innerClass =
    variant === "static"
      ? "w-[92%] max-w-[610px] mx-auto bg-white/85 dark:bg-[rgba(21,25,34,0.85)] backdrop-blur-[20px] border border-white/50 dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.30)] rounded-2xl px-4 sm:px-5 py-3.5 flex items-center justify-between transition-all duration-300"
      : "w-[92%] max-w-[610px] mx-auto bg-white/85 dark:bg-[rgba(21,25,34,0.85)] backdrop-blur-[20px] border border-white/50 dark:border-[rgba(255,255,255,0.08)] shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.30)] rounded-2xl px-4 sm:px-5 py-3.5 flex items-center justify-between transition-all duration-500 ease-in-out";

  return (
    <header className={outerClass}>
      <div className={innerClass}>

        {/* Mobile logo — far left of the navbar for every user (signed in or
            out). Hidden at lg+, where the floating GlobalLogo is used instead. */}
        <Link href="/" aria-label="Home" className="lg:hidden flex-shrink-0 flex items-center">
          <Image
            src="/assets/logo.png"
            alt="The GP Edge"
            width={240}
            height={160}
            className="w-auto h-10 object-contain"
            priority
          />
        </Link>

        {/* 1. Extreme Left: Home Icon Button */}
        <div className="hidden md:flex items-center shrink-0">
          <Link
            href="/"
            title="Home"
            aria-label="Home Landing Page"
            className="text-slate-500 dark:text-[#A8B1BD] hover:text-teal-600 dark:hover:text-teal-400 transition-colors duration-200 flex items-center justify-center hover:scale-110 transition-transform p-1 rounded-lg"
          >
            <House className="w-4 h-4 xl:w-[18px] xl:h-[18px]" />
          </Link>
        </div>

        {/* 2. Center: 3 Navbar Links (Exam Prep, Pricing, About Us) */}
        <nav className="hidden md:flex items-center justify-center gap-4 xl:gap-5 shrink-0 mx-auto">
          <Link
            href="/exam-prep"
            className="text-[13px] xl:text-[14px] whitespace-nowrap font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-teal-300 to-teal-600 bg-[length:200%_auto] animate-gradient-x hover:scale-105 transition-transform duration-300"
          >
            Exam Prep
          </Link>

          <Link
            href={isSignedIn ? "/dashboard/pricing" : "/pricing"}
            className={`text-[13px] xl:text-[14px] whitespace-nowrap font-medium transition-colors duration-200 ${
              pathname === "/pricing" || pathname === "/dashboard/pricing"
                ? "text-teal-600 dark:text-teal-400 font-semibold"
                : "text-slate-500 dark:text-[#A8B1BD] hover:text-slate-900 dark:hover:text-[#F5F7FA]"
            }`}
          >
            Pricing
          </Link>

          <Link
            href="/#about"
            className={`text-[13px] xl:text-[14px] whitespace-nowrap font-medium transition-colors duration-200 ${
              pathname === "/#about"
                ? "text-teal-600 dark:text-teal-400 font-semibold"
                : "text-slate-500 dark:text-[#A8B1BD] hover:text-slate-900 dark:hover:text-[#F5F7FA]"
            }`}
          >
            About Us
          </Link>
        </nav>

        {/* 3. Extreme Right: CTA Buttons & Theme Toggle */}
        <div className="flex items-center justify-end gap-2.5 shrink-0">
          <SignedOut>
            <Link href="/sign-in" className="text-xs xl:text-sm whitespace-nowrap font-medium text-slate-600 dark:text-[#A8B1BD] hover:text-slate-900 dark:hover:text-[#F5F7FA] transition-colors">
              Log in
            </Link>
            <Link href="/sign-up" className="hidden md:inline-block bg-teal-600 hover:bg-teal-700 whitespace-nowrap text-white px-3 py-1.5 xl:px-4 xl:py-2 rounded-xl text-xs xl:text-sm font-medium transition-colors">
              Sign up
            </Link>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className={`btn-dashboard-new ${pathname === '/' ? 'interactive' : ''}`}
            >
              <span className="btn-dashboard-span whitespace-nowrap">Dashboard</span>
            </Link>
          </SignedIn>

          <SignedIn>
            <NotificationBell />
          </SignedIn>

          <ThemeToggle />

          {/* Dashboard pages: hamburger opens the sidebar drawer */}
          {sidebar?.hasDrawer && (
            <button
              type="button"
              onClick={() => sidebar.toggleMobile()}
              aria-label="Open navigation menu"
              aria-expanded={sidebar.mobileOpen}
              className="lg:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 dark:text-[#A8B1BD] hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Public pages: hamburger opens mobile menu */}
          {!sidebar?.hasDrawer && (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="md:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 dark:text-[#A8B1BD] hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .btn-dashboard-new {
          background: #0d9488;
          color: #ffffff;
          position: relative;
          border: 2px solid rgba(255, 255, 255, 0.3);
          padding: 6px 18px;
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: 0.4s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: 0px 8px 16px rgba(20, 184, 166, 0.2);
        }
        .dark .btn-dashboard-new {
          border-color: rgba(90,200,176,0.3);
        }
        .btn-dashboard-span {
          display: inline-block;
          transition: 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .btn-dashboard-new.interactive:hover {
          font-size: 14px;
          transform: skew(-2deg);
          padding-right: 32px;
        }
        .btn-dashboard-new::before {
          content: "";
          box-sizing: border-box;
          position: absolute;
          top: 50%;
          left: 70%;
          width: 14px;
          height: 14px;
          margin-top: -7px;
          margin-left: -5px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #ffffff;
          opacity: 0;
          animation: spinner 0.6s linear infinite;
          transition: 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .btn-dashboard-new.interactive:hover::before {
          opacity: 1;
          left: calc(100% - 24px);
        }
        @keyframes spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Mobile navbar menu — the complete navbar for pages without the
          dashboard sidebar (signed-out landing, auth pages, etc.). */}
      {!sidebar?.hasDrawer && (
        <div
          className={`md:hidden mx-auto w-[94%] max-w-[920px] grid transition-all duration-300 ease-out ${
            menuOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="bg-white/95 dark:bg-[rgba(21,25,34,0.96)] backdrop-blur-[20px] border border-white/50 dark:border-[rgba(255,255,255,0.08)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl p-2 flex flex-col gap-0.5">
              {MENU_LINKS.map((l) => {
                const targetHref = l.href === "/pricing" ? (isSignedIn ? "/dashboard/pricing" : "/pricing") : l.href;
                const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={targetHref}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                      active
                        ? "text-teal-600 dark:text-teal-400 bg-teal-50/70 dark:bg-teal-900/15"
                        : "text-slate-700 dark:text-[#E2E6EC] hover:bg-slate-100/70 dark:hover:bg-white/5"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}

              <div className="my-1 border-t border-slate-100 dark:border-white/10" />

              <SignedOut>
                <Link
                  href="/sign-in"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-[14px] font-medium text-slate-700 dark:text-[#E2E6EC] hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMenuOpen(false)}
                  className="mt-0.5 px-3 py-2.5 rounded-xl text-[14px] font-semibold text-center text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                >
                  Sign up
                </Link>
              </SignedOut>

              <SignedIn>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-[14px] font-semibold text-center text-white bg-teal-600 hover:bg-teal-700 transition-colors"
                >
                  Dashboard
                </Link>
              </SignedIn>

              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="mt-0.5 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[14px] font-medium text-slate-700 dark:text-[#E2E6EC] hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

export default Header;
