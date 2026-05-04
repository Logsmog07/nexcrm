import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authenticateDevConsole } from "./api/devApi";
import "./devConsole.css";

const DEV_TOKEN_KEY = "devToken";

export default function DevConsoleLogin() {
  const navigate = useNavigate();
  const [accessKey, setAccessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [denied, setDenied] = useState(false);
  const [shake, setShake] = useState(false);

  const existingToken = localStorage.getItem(DEV_TOKEN_KEY);

  useEffect(() => {
    if (!denied) {
      return;
    }

    const timer = window.setTimeout(() => setShake(false), 420);
    return () => window.clearTimeout(timer);
  }, [denied]);

  if (existingToken) {
    return <Navigate to="/dev-console" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setDenied(false);
    setSubmitting(true);

    try {
      const response = await authenticateDevConsole(accessKey);
      localStorage.setItem(DEV_TOKEN_KEY, response.token);
      navigate("/dev-console", { replace: true });
    } catch (error) {
      setDenied(true);
      setShake(true);

      if (error?.response?.status === 429) {
        // Keep access denied semantics as requested but preserve rate limit reason in console.
        console.warn("Dev console auth rate limited");
      }
    } finally {
      setSubmitting(false);
      setAccessKey("");
    }
  };

  return (
    <div className="dev-console-root dev-console-grid">
      <form className={`dev-console-card ${shake ? "dev-console-shake" : ""}`} onSubmit={onSubmit}>
        <div className="dev-console-header">
          <span>&gt;_ DEV CONSOLE</span>
          <span className="dev-console-cursor">|</span>
        </div>

        <label className="dev-console-label" htmlFor="dev-access-key">
          Enter master access key
        </label>
        <input
          id="dev-access-key"
          className="dev-console-input"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={accessKey}
          onChange={(event) => setAccessKey(event.target.value)}
          required
        />

        <button className="dev-console-button" type="submit" disabled={submitting}>
          {submitting ? "AUTHENTICATING..." : "AUTHENTICATE ->"}
        </button>

        {denied ? <p className="dev-console-denied">ACCESS DENIED</p> : null}
      </form>
    </div>
  );
}
