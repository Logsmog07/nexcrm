import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  ChartColumnBig,
  CheckCircle2,
  ContactRound,
  KanbanSquare,
  PlayCircle,
  ShieldCheck,
  Users2,
} from "lucide-react";

const featureCards = [
  {
    title: "Smart Pipeline",
    description: "Drag and drop your deal stages on a visual Kanban flow.",
    icon: KanbanSquare,
    color: "text-indigo-300",
    bg: "bg-indigo-500/10",
  },
  {
    title: "Lead Management",
    description: "Track, assign, and qualify leads in one collaborative hub.",
    icon: Users2,
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
  },
  {
    title: "Analytics Dashboard",
    description: "See real-time insights for performance and revenue trends.",
    icon: ChartColumnBig,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Smart Alerts",
    description: "Stay on schedule with proactive reminder notifications.",
    icon: BellRing,
    color: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  {
    title: "Customer Profiles",
    description: "Review full interaction history before every conversation.",
    icon: ContactRound,
    color: "text-rose-300",
    bg: "bg-rose-500/10",
  },
  {
    title: "Role-Based Access",
    description: "Grant secure Admin, Manager, and Sales Rep permissions.",
    icon: ShieldCheck,
    color: "text-violet-300",
    bg: "bg-violet-500/10",
  },
];

const stats = [
  { value: "500+", label: "Active Users" },
  { value: "$2.4M", label: "Revenue Tracked" },
  { value: "94%", label: "Customer Satisfaction" },
  { value: "3x", label: "Faster Deal Closing" },
];

const steps = [
  {
    number: "01",
    title: "Add your leads",
    description: "Import leads from forms, CSV files, or your current CRM in minutes.",
    icon: Users2,
  },
  {
    number: "02",
    title: "Track your pipeline",
    description: "Move opportunities across stages with complete timeline visibility.",
    icon: KanbanSquare,
  },
  {
    number: "03",
    title: "Close deals and analyze",
    description: "Measure outcomes, uncover trends, and improve win-rate with confidence.",
    icon: ChartColumnBig,
  },
];

const testimonials = [
  {
    name: "Aisha Morgan",
    role: "Sales Director",
    company: "BrightLoop",
    initials: "AM",
    quote:
      "NexCRM replaced three disconnected tools and gave our reps one place to execute every day.",
    tint: "from-indigo-500 to-blue-500",
  },
  {
    name: "Marcus Reed",
    role: "RevOps Manager",
    company: "Northline Labs",
    initials: "MR",
    quote:
      "The dashboard clarity is excellent. We now spot pipeline risks a full week earlier than before.",
    tint: "from-cyan-500 to-teal-500",
  },
  {
    name: "Priya Das",
    role: "Founder",
    company: "Orbit & Co.",
    initials: "PD",
    quote:
      "Setup took less than one afternoon, and the team adopted it immediately because the UX feels premium.",
    tint: "from-violet-500 to-fuchsia-500",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const MotionDiv = motion.div;
const MotionArticle = motion.article;
const MotionH2 = motion.h2;

function HeroMockup() {
  return (
    <div className="relative mx-auto mt-14 max-w-5xl rounded-3xl border border-white/15 bg-[#12121B] p-3 shadow-[0_40px_120px_rgba(6,8,20,0.8)]">
      <div className="rounded-2xl border border-white/10 bg-[#0F1018] p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <div className="ml-4 h-8 flex-1 rounded-xl border border-white/10 bg-white/5" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 h-4 w-20 rounded bg-white/20" />
            <div className="space-y-2">
              <div className="h-8 rounded-lg bg-indigo-500/30" />
              <div className="h-8 rounded-lg bg-white/10" />
              <div className="h-8 rounded-lg bg-white/10" />
              <div className="h-8 rounded-lg bg-white/10" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-3 w-16 rounded bg-white/20" />
                <div className="mt-3 h-6 w-20 rounded bg-emerald-400/40" />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-3 w-20 rounded bg-white/20" />
                <div className="mt-3 h-6 w-16 rounded bg-indigo-400/40" />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-3 w-24 rounded bg-white/20" />
                <div className="mt-3 h-6 w-14 rounded bg-cyan-400/40" />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 h-4 w-32 rounded bg-white/20" />
              <div className="grid h-40 grid-cols-8 items-end gap-2">
                {[35, 58, 42, 72, 66, 48, 81, 70].map((height, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${height}%` }}
                    className="rounded-t-md bg-gradient-to-t from-indigo-500/80 to-purple-400/80"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/10 bg-[#0D0D14]/90 shadow-[0_14px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-bold text-white">N</span>
            <span className="text-lg font-bold tracking-tight">NexCRM</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#about" className="transition hover:text-white">About</a>
            <Link to="/login" className="rounded-lg border border-white/20 px-4 py-2 text-white/90 transition hover:border-white/40">
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-500"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-16 lg:px-8 lg:pt-20">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.32),transparent_65%)]" />
          <div className="pointer-events-none absolute right-0 top-32 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_70%)]" />

          <MotionDiv
            className="relative mx-auto max-w-4xl text-center"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-300">Revenue workspace reimagined</p>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight text-slate-200 md:text-6xl">
              <span className="block">The CRM that actually</span>
              <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                helps you close deals
              </span>
              <span className="block">faster.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              NexCRM gives your sales team a beautiful, intelligent workspace to manage leads,
              track pipelines, and turn data into revenue.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Start for Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#about"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/40"
              >
                <PlayCircle className="h-4 w-4" />
                See how it works
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> No credit card required</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> 5 min setup</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Free forever plan</span>
            </div>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <HeroMockup />
          </MotionDiv>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8">
          <MotionDiv variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
            <h2 className="text-center text-3xl font-semibold text-slate-100 md:text-4xl">Everything your sales team needs</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-300">
              Crafted for speed, clarity, and collaboration from first touch to closed won.
            </p>
          </MotionDiv>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <MotionArticle
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-[#111118] p-6"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                  viewport={{ once: true, amount: 0.25 }}
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-100">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                </MotionArticle>
              );
            })}
          </div>
        </section>

        <section className="bg-[#0F1020] py-14">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 text-center sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            {stats.map((item) => (
              <div key={item.label}>
                <p className="text-3xl font-bold text-indigo-300">{item.value}</p>
                <p className="mt-2 text-sm text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8">
          <MotionH2
            className="text-center text-3xl font-semibold text-slate-100 md:text-4xl"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            How it works
          </MotionH2>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <MotionDiv
                  key={step.number}
                  className="rounded-2xl border border-white/10 bg-[#111118] p-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  viewport={{ once: true, amount: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.2em] text-indigo-300">{step.number}</span>
                    <Icon className="h-5 w-5 text-indigo-300" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                </MotionDiv>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8">
          <MotionH2
            className="text-center text-3xl font-semibold text-slate-100 md:text-4xl"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            What teams are saying
          </MotionH2>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {testimonials.map((item, index) => (
              <MotionArticle
                key={item.name}
                className="rounded-2xl border border-white/10 bg-[#111118] p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                viewport={{ once: true, amount: 0.2 }}
              >
                <div className="mb-4 flex items-center gap-1 text-amber-300">{"★★★★★"}</div>
                <p className="text-sm leading-7 text-slate-200">"{item.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${item.tint} text-sm font-bold text-white`}>
                    {item.initials}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.role} · {item.company}</div>
                  </div>
                </div>
              </MotionArticle>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 pb-20 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-7 py-10 text-center shadow-[0_25px_80px_rgba(79,70,229,0.35)] sm:px-12 sm:py-14">
            <h3 className="text-3xl font-semibold text-white">Ready to grow your sales pipeline?</h3>
            <p className="mx-auto mt-3 max-w-2xl text-indigo-100">
              Launch your workspace in minutes and give your team a CRM they genuinely enjoy using.
            </p>
            <Link
              to="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0B0C12]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 text-sm text-slate-300 md:grid-cols-[1.3fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-bold text-white">N</span>
              <span className="text-lg font-bold text-slate-100">NexCRM</span>
            </div>
            <p className="mt-4 max-w-sm text-slate-400">
              A modern sales workspace that helps teams move faster with clearer decisions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-100">Product</h4>
            <ul className="mt-4 space-y-2 text-slate-400">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><Link to="/dashboard" className="hover:text-white">Pipeline</Link></li>
              <li><Link to="/analytics" className="hover:text-white">Analytics</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-100">Company</h4>
            <ul className="mt-4 space-y-2 text-slate-400">
              <li><a href="#about" className="hover:text-white">About</a></li>
              <li><a href="#about" className="hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-100">Legal</h4>
            <ul className="mt-4 space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-white">Privacy</a></li>
              <li><a href="#" className="hover:text-white">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500 lg:px-8">
          © 2025 NexCRM. Built with ❤️ for modern sales teams.
        </div>
      </footer>
    </div>
  );
}
