import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Protected routes — any path matching these patterns requires an active
 * Clerk session. Unauthenticated requests are automatically redirected to
 * NEXT_PUBLIC_CLERK_SIGN_IN_URL (/sign-in) by Clerk's middleware.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)", // All dashboard pages and sub-pages
  "/exam-prep(.*)", // Exam-prep section
  "/onboarding(.*)", // Post-signup profile completion
]);

export default clerkMiddleware(async (auth, req) => {
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  // If an unauthenticated user visits /dashboard/pricing, seamlessly redirect them
  // to the public /pricing page so they can view plans without logging in.
  if (req.nextUrl.pathname.startsWith("/dashboard/pricing")) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/pricing", req.url));
    }
  }

  // If an authenticated user visits /pricing, seamlessly redirect them
  // to /dashboard/pricing so their sidebar and complete dashboard shell remain active.
  if (req.nextUrl.pathname === "/pricing") {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard/pricing", req.url));
    }
  }

  // Server Actions send a POST request containing the `Next-Action` header.
  // We bypass auth.protect() redirects for Server Action POST calls so browser fetch()
  // does not encounter a 307 redirect CORS failure ("TypeError: Failed to fetch at fetchServerAction").
  // Server Actions handle authentication internally via ensureDbUser() / currentUser().
  const isServerAction = req.headers.has("next-action");

  if (hasClerkKeys && isProtectedRoute(req) && !isServerAction) {
    await auth.protect();
  }
});

/**
 * matcher — controls WHICH requests Next.js passes to this middleware.
 * Excludes:
 *   • Next.js internals (_next/*)
 *   • Static assets (images, fonts, favicons, etc.)
 * This keeps middleware fast — it only runs on real page/API requests.
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
