import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, RefreshCw, Compass } from "lucide-react";

export const metadata = {
  title: "About us | The GP Edge",
  description:
    "The GP Edge is built by GPs in Australia who sat the Fellowship exams recently. Learn about our clinical governance, question writing principles, and exam preparation philosophy.",
};

export default function AboutPage() {
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
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border border-emerald-200/80 dark:border-[rgba(90,200,176,0.3)] bg-emerald-50/90 dark:bg-[#151922] text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs uppercase tracking-[0.12em] mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            The GP Edge — Origins &amp; Mission
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            About us
          </h1>

          <div className="mt-3 flex flex-wrap justify-center items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>Website copy — draft for review</span>
          </div>
        </div>

        {/* Main Content Container */}
        <main className="w-full max-w-4xl mx-auto bg-white dark:bg-[#151922] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 md:p-12 shadow-sm font-sans leading-relaxed text-slate-700 dark:text-slate-300 space-y-10">

          {/* Section: Why We Built It */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-teal-700 dark:text-teal-400 mb-2">
              <Compass className="w-5 h-5 shrink-0" />
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Why We Built The GP Edge
              </h2>
            </div>

            <p className="text-sm sm:text-base leading-relaxed">
              We&apos;re a group of GPs in Australia who sat the Fellowship exams recently. The GP Edge started as the questions and notes we wrote for ourselves while we were studying for them.
            </p>

            <p className="text-sm sm:text-base leading-relaxed">
              We made it because the banks we paid for tested medicine rather than the exam. The questions were accurate, but they asked what a condition was. The paper wants two or three steps past that: with this patient in front of you, what do you do next? Applied knowledge. The KFP practice was worse. The wrong options were so clearly wrong you could score well without thinking.
            </p>

            <p className="text-sm sm:text-base leading-relaxed">
              The platforms were the other half of it. Most were old and glitchy, and the only thing they told you about your progress was how much of the bank you&apos;d finished. We wanted to know which topics we could leave alone and which ones needed another week.
            </p>

            <p className="text-sm sm:text-base leading-relaxed">
              So we built that. Your progress is broken down by topic, and the quiz modes are assembled from what you personally keep getting wrong rather than serving everyone the same questions in the same order.
            </p>
          </section>

          {/* Section: Clinical Governance */}
          <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 mb-2">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Clinical governance
              </h2>
            </div>

            <p className="text-sm sm:text-base leading-relaxed">
              The content on the platform is curated by doctors actively practising in Australian general practice, to processes set by our Clinical Governance Lead, a Fellow of the RACGP whose only job here is governance. Those processes cover what we write from, who checks what, and when an item gets looked at again. Every clinical statement in a question traces back to a named authoritative source and edition, Australian where one exists.
            </p>
          </section>

          {/* Section: Keeping it Current */}
          <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 text-cyan-700 dark:text-cyan-400 mb-2">
              <RefreshCw className="w-5 h-5 shrink-0" />
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Keeping it current
              </h2>
            </div>

            <p className="text-sm sm:text-base leading-relaxed">
              We read the RACGP examination reports and the College&apos;s exam guides each year, and they shape what we write. When a guideline changes, every question that relied on the old version is pulled and checked.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              We aren&apos;t affiliated with the RACGP, and none of our questions are recalled from a sitting.
            </div>
          </section>

          {/* Highlight Callout: Short Version Summary */}
          <section className="p-6 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              In Brief
            </div>
            <p className="text-sm sm:text-base text-emerald-950 dark:text-emerald-100 leading-relaxed font-medium">
              The GP Edge is built by GPs in Australia who sat the Fellowship exams recently. Content is curated by doctors actively practising in Australian general practice, to processes set by a dedicated Clinical Governance Lead. Progress is broken down by topic, and the quiz modes are assembled from what you keep getting wrong.
            </p>
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
