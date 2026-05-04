import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { clearAuthError, loginUser, signupUser } from "../store";
import { useNavigate } from "../hooks/useNavigate";
import { getBranding } from "../lib/branding";

const defaults = {
  login: { email: "admin@crm.local", password: "Password123!" },
  signup: {
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    industry: "",
    companySize: "",
    address: "",
    subscriptionPlan: "growth",
  },
};

const signupSteps = [
  {
    id: "account",
    title: "Account setup",
    description: "Create the first secure login for your workspace.",
  },
  {
    id: "company",
    title: "Company profile",
    description: "Set up the company information used for your tenant.",
  },
  {
    id: "review",
    title: "Launch workspace",
    description: "Review everything and provision your CRM workspace.",
  },
];

const roleShortcuts = [
  ["Platform Admin", "admin@crm.local"],
  ["Company Admin", "companyadmin@crm.local"],
  ["Manager", "manager@crm.local"],
  ["Sales", "sales@crm.local"],
];

const workspaceSignals = [
  {
    label: "Guided setup",
    value: "Under 2 min",
    detail: "Provision company workspace, first admin, and role-ready shell.",
  },
  {
    label: "Team-ready",
    value: "4 roles",
    detail: "Platform admin, company admin, manager, and sales rep flows.",
  },
  {
    label: "Revenue view",
    value: "Live",
    detail: "Leads, pipeline, and analytics aligned on one operating layer.",
  },
];

const stepNotes = {
  account:
    "Use a strong password. This user becomes the initial company admin account.",
  company:
    "These details define the tenant workspace that appears in platform provisioning.",
  review:
    "After launch, invite managers and reps from Team provisioning and route ownership.",
};

function AuthHero({ mode, branding }) {
  return (
    <section className="relative overflow-hidden rounded-[38px] border border-[var(--border-soft)] bg-[var(--panel-solid)] p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0 crm-shell-grid opacity-35" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.24),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(244,93,45,0.2),transparent_72%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-[var(--text-muted)]">
                {branding.eyebrow}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                {branding.appName}
              </div>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              Workspace OS
            </div>
          </div>

          <h1 className="text-4xl font-semibold leading-tight text-[var(--text-primary)] lg:text-5xl">
            {mode === "login"
              ? "Enter a calmer revenue workspace built for execution."
              : "Provision a modern CRM tenant with guided onboarding."}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            {mode === "login"
              ? "Log in and move from lead capture to close planning with fewer clicks and cleaner decision context."
              : "Signup walks you through account creation, company profile, and workspace launch in a structured flow."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {workspaceSignals.map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-base)] p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{item.value}</div>
              <div className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SignupStepIndicator({ currentStep }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {signupSteps.map((step, index) => {
        const isCurrent = index === currentStep;
        const isComplete = index < currentStep;

        return (
          <div
            key={step.id}
            className={`rounded-[20px] border px-4 py-4 transition ${
              isCurrent
                ? "border-[var(--accent)]/35 bg-[var(--accent-soft)]"
                : isComplete
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-[var(--border)] bg-[var(--bg-base)]"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {isComplete ? "Complete" : `Step ${index + 1}`}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{step.title}</div>
          </div>
        );
      })}
    </div>
  );
}

export function AuthPage() {
  const initialMode = window.location.pathname === "/signup" ? "signup" : "login";
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(defaults[initialMode]);
  const [localError, setLocalError] = useState("");
  const [signupStep, setSignupStep] = useState(0);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const user = useSelector((state) => state.auth.user);
  const branding = getBranding(user);

  const title = useMemo(() => {
    if (mode === "login") {
      return "Enter your revenue workspace";
    }

    return signupSteps[signupStep].title;
  }, [mode, signupStep]);

  const subtitle = useMemo(() => {
    if (mode === "login") {
      return "Use your workspace credentials or a demo account to open the CRM.";
    }

    return signupSteps[signupStep].description;
  }, [mode, signupStep]);

  const handleModeChange = (nextMode) => {
    dispatch(clearAuthError());
    setLocalError("");
    setMode(nextMode);
    setForm(defaults[nextMode]);
    setSignupStep(0);
    navigate(nextMode === "signup" ? "/signup" : "/login");
  };

  const validateSignupStep = () => {
    if (signupStep === 0) {
      if (!form.fullName || !form.email || !form.password || !form.confirmPassword) {
        setLocalError("Complete all account fields before continuing");
        return false;
      }

      if (form.password !== form.confirmPassword) {
        setLocalError("Passwords do not match");
        return false;
      }

      return true;
    }

    if (signupStep === 1) {
      if (
        !form.companyName ||
        !form.companyEmail ||
        !form.companyPhone ||
        !form.industry ||
        !form.companySize ||
        !form.address
      ) {
        setLocalError("Complete all company details before continuing");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");

    if (mode === "signup" && signupStep < signupSteps.length - 1) {
      if (validateSignupStep()) {
        setSignupStep((current) => current + 1);
      }
      return;
    }

    if (mode === "signup" && form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    const action = mode === "login" ? loginUser : signupUser;
    const payload =
      mode === "signup"
        ? {
            fullName: form.fullName,
            email: form.email,
            password: form.password,
            companyName: form.companyName,
            companyEmail: form.companyEmail,
            companyPhone: form.companyPhone,
            industry: form.industry,
            companySize: form.companySize,
            address: form.address,
            subscriptionPlan: form.subscriptionPlan,
          }
        : form;

    const result = await dispatch(action(payload));
    if (!result.error) {
      navigate("/");
    }
  };

  const handleDemoLogin = async (email) => {
    setLocalError("");
    setMode("login");
    setForm({ email, password: "Password123!" });

    const result = await dispatch(loginUser({ email, password: "Password123!" }));

    if (!result.error) {
      navigate("/");
    }
  };

  const renderSignupStep = () => {
    if (signupStep === 0) {
      return (
        <div className="grid gap-4">
          <Input
            placeholder="Full name"
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          />
          <Input
            placeholder="Work email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <Input
            placeholder="Confirm password"
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
          />
        </div>
      );
    }

    if (signupStep === 1) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Company name"
            value={form.companyName}
            onChange={(event) => setForm({ ...form, companyName: event.target.value })}
          />
          <Input
            placeholder="Company email"
            type="email"
            value={form.companyEmail}
            onChange={(event) => setForm({ ...form, companyEmail: event.target.value })}
          />
          <Input
            placeholder="Company phone"
            value={form.companyPhone}
            onChange={(event) => setForm({ ...form, companyPhone: event.target.value })}
          />
          <Input
            placeholder="Industry"
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Input
            placeholder="Company size"
            value={form.companySize}
            onChange={(event) => setForm({ ...form, companySize: event.target.value })}
          />
          <Select
            value={form.subscriptionPlan}
            onChange={(event) => setForm({ ...form, subscriptionPlan: event.target.value })}
          >
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          <div className="md:col-span-2">
            <Input
              placeholder="Address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-base)] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Account owner
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {form.fullName || "Pending name"}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{form.email || "Pending email"}</div>
        </div>

        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-base)] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Company workspace
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {form.companyName || "Pending company"}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            {form.companyEmail || "Pending company email"}
          </div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            {form.industry || "Pending industry"} · {form.companySize || "Pending size"}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            {form.address || "Pending address"} · {form.subscriptionPlan} plan
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="auth-background min-h-screen px-4 py-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1500px] gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <AuthHero mode={mode} branding={branding} />

        <section className="flex min-h-full items-stretch">
          <Card className="flex w-full flex-col justify-between rounded-[38px] border-[var(--border-strong)] bg-[var(--panel-solid)] p-7 lg:p-8">
            <div>
              <div className="flex gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--bg-base)] p-1.5">
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className={`flex-1 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("signup")}
                  className={`flex-1 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  Signup
                </button>
              </div>

              <div className="mt-7">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  {mode === "login" ? "Secure access" : `Step ${signupStep + 1} of ${signupSteps.length}`}
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{subtitle}</p>
              </div>

              {mode === "signup" ? <div className="mt-6"><SignupStepIndicator currentStep={signupStep} /></div> : null}

              <div className="mt-5">
                <ErrorBanner message={localError || error} />
              </div>

              <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                {mode === "login" ? (
                  <div className="grid gap-4">
                    <Input
                      placeholder="Email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                    <Input
                      placeholder="Password"
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                    />
                  </div>
                ) : (
                  renderSignupStep()
                )}

                {mode === "signup" ? (
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
                    {stepNotes[signupSteps[signupStep].id]}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {mode === "signup" && signupStep > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setLocalError("");
                        setSignupStep((current) => Math.max(current - 1, 0));
                      }}
                    >
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  <Button type="submit" size="lg" className="sm:min-w-[210px]" disabled={loading}>
                    {loading
                      ? "Please wait..."
                      : mode === "login"
                      ? "Enter workspace"
                      : signupStep < signupSteps.length - 1
                      ? "Continue"
                      : "Create workspace"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="mt-8 border-t border-[var(--border)] pt-6">
              {mode === "login" ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Demo accounts</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      Instant access
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {roleShortcuts.map(([label, email]) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => handleDemoLogin(email)}
                        className="flex items-center justify-between rounded-[16px] border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-left transition hover:border-[var(--accent)]/35 hover:bg-[var(--accent-soft)]"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
                          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{email}</div>
                        </div>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                          Demo
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-base)] p-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Signup guidance</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Passwords should include 8+ characters, one uppercase letter, and one number. After launch, you can invite managers and reps from the Team area.
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
