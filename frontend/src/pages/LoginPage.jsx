import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  Sun,
} from "lucide-react";
import api from "../api/axios";
import { hydrateAuth, toggleTheme } from "../store";
import { getPreferredStartRoute, saveAppSettings } from "../lib/settings";

const highlights = [
  "Manage all your leads in one place",
  "Real-time sales analytics",
  "Built for modern sales teams",
];

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.ui.theme);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      email: "admin@crm.local",
      password: "Password123!",
      remember: true,
    },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      const token = response.data?.token;
      const user = response.data?.user;

      localStorage.setItem("token", token || "");
      localStorage.setItem("user", JSON.stringify(user || null));
      localStorage.setItem("crm_token", token || "");
      localStorage.setItem("crm_user", JSON.stringify(user || null));
      if (response.data?.settings) {
        saveAppSettings(response.data.settings);
      }

      dispatch(hydrateAuth());
      navigate(getPreferredStartRoute(), { replace: true });
    } catch (error) {
      const status = error?.response?.status;
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      if (status === 401) {
        toast.error("Invalid email or password");
      } else if (status === 403) {
        toast.error(apiMessage || "This account cannot sign in right now");
      } else if (!status) {
        toast.error("Cannot reach the server. Please ensure backend is running on port 3001.");
      } else {
        toast.error(apiMessage || "Unable to sign in. Please try again.");
      }

      resetField("password", { defaultValue: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[40%_60%]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 font-bold">N</span>
              <span className="text-xl font-bold">NexCRM</span>
            </div>

            <h1 className="mt-16 text-4xl font-semibold leading-tight">Your pipeline, perfected.</h1>

            <ul className="mt-8 space-y-4 text-indigo-50">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-indigo-100" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex -space-x-3">
              {[
                "bg-indigo-300",
                "bg-cyan-300",
                "bg-fuchsia-300",
                "bg-emerald-300",
              ].map((color, index) => (
                <span
                  key={index}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-700 ${color} text-xs font-semibold text-indigo-900`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-indigo-100">Join 500+ sales professionals</p>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col bg-[var(--bg-card)] p-6 sm:p-10">
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              onClick={() => dispatch(toggleTheme())}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 items-center">
            <form className="w-full space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <h2 className="text-3xl font-semibold text-[var(--text-primary)]">Welcome back</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Sign in to your NexCRM account</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-transparent pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500"
                    type="email"
                    placeholder="you@company.com"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email address",
                      },
                    })}
                  />
                </div>
                {errors.email ? <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-transparent pl-10 pr-11 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...register("password", {
                      required: "Password is required",
                      minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters",
                      },
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <input type="checkbox" className="rounded border-[var(--border)]" {...register("remember")} />
                  Remember me
                </label>
                <a href="#" className="text-indigo-500 hover:text-indigo-400">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                {submitting ? "Signing In..." : "Sign In"}
              </button>

              <div className="relative py-2">
                <div className="h-px w-full bg-[var(--border)]" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] px-3 text-xs text-[var(--text-secondary)]">
                  or continue with
                </span>
              </div>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface)]"
              >
                Continue with Google
              </button>

              <p className="text-center text-sm text-[var(--text-secondary)]">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="font-semibold text-indigo-500 hover:text-indigo-400">
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
