import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { getBranding } from "../../lib/branding";
import { getRoleLabel, isPlatformAdmin } from "../../lib/roles";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const TYPE_LABELS = {
  reminder: "Reminder",
  activity_due: "Due",
  follow_up: "Follow-up",
  lead_update: "Lead",
  customer_update: "Customer",
  deal_update: "Deal",
  system: "System",
};

const TYPE_STYLES = {
  reminder: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/30",
  activity_due: "bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/30",
  follow_up: "bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-300/30",
  lead_update: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-300/30",
  customer_update: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-300/30",
  deal_update: "bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-300/30",
  system: "bg-slate-500/20 text-slate-100 ring-1 ring-slate-300/30",
};

const TYPE_PRIORITY = {
  activity_due: 8,
  reminder: 7,
  follow_up: 6,
  deal_update: 5,
  lead_update: 4,
  customer_update: 4,
  system: 3,
};

const toEpoch = (value) => {
  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatRelativeTime = (value) => {
  if (!value) {
    return "just now";
  }

  const timestamp = toEpoch(value);
  if (!timestamp) {
    return "just now";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absSeconds = Math.abs(deltaSeconds);

  if (absSeconds < 60) {
    return relativeTimeFormatter.format(deltaSeconds, "second");
  }

  const absMinutes = Math.round(absSeconds / 60);
  if (absMinutes < 60) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 60), "minute");
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 3600), "hour");
  }

  return relativeTimeFormatter.format(Math.round(deltaSeconds / 86400), "day");
};

const getTypeLabel = (type) => TYPE_LABELS[type] || "Update";

const getTypeStyle = (type) => TYPE_STYLES[type] || TYPE_STYLES.system;

const getPriorityScore = (item) => {
  const basePriority = TYPE_PRIORITY[item.type] || TYPE_PRIORITY.system;
  const unreadBoost = item.is_read ? 0 : 4;
  const remindAt = toEpoch(item.remind_at);
  if (!remindAt || item.is_read) {
    return basePriority + unreadBoost;
  }

  const delta = remindAt - Date.now();
  if (delta <= 0) {
    return basePriority + unreadBoost + 4;
  }

  if (delta <= 1000 * 60 * 60 * 4) {
    return basePriority + unreadBoost + 2;
  }

  return basePriority + unreadBoost;
};

const toIntegerId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNotificationAction = (item) => {
  const metadata = item.metadata || {};

  if (typeof metadata.route === "string" && metadata.route.startsWith("/")) {
    return {
      path: metadata.route,
      label: metadata.route === "/activities" ? "Open activity board" : "Open related item",
    };
  }

  const leadId =
    toIntegerId(metadata.leadId) ||
    toIntegerId(metadata.relatedLeadId) ||
    toIntegerId(metadata.lead_id);
  if (leadId) {
    return { path: `/leads/${leadId}`, label: "Open lead" };
  }

  const customerId =
    toIntegerId(metadata.customerId) ||
    toIntegerId(metadata.relatedCustomerId) ||
    toIntegerId(metadata.customer_id);
  if (customerId) {
    return { path: `/customers/${customerId}`, label: "Open customer" };
  }

  const dealId =
    toIntegerId(metadata.dealId) ||
    toIntegerId(metadata.relatedDealId) ||
    toIntegerId(metadata.deal_id);
  if (dealId) {
    return { path: `/pipeline/${dealId}`, label: "Open deal" };
  }

  const companyId = toIntegerId(metadata.companyId) || toIntegerId(metadata.company_id);
  if (companyId) {
    return { path: `/companies/${companyId}`, label: "Open company" };
  }

  if (metadata.activityId || metadata.activity_id || metadata.orderNumber) {
    return { path: "/activities", label: "Open activity board" };
  }

  return null;
};

export function Topbar({
  title,
  subtitle,
  onMenuClick,
  onThemeToggle,
  onLogout,
  onAccountClick,
  onAlertsClick,
  onNotificationNavigate,
  onNotificationRead,
  onNotificationsReadAll,
  notificationsLoading,
  onSearchNavigate,
  searchItems = [],
  theme,
  notifications,
  user,
}) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const alertsPanelRef = useRef(null);
  const searchPanelRef = useRef(null);
  const searchInputRef = useRef(null);
  const firstUnreadSync = useRef(true);
  const previousUnreadRef = useRef(0);
  const unread = notifications.filter((item) => !item.is_read).length;
  const branding = getBranding(user);
  const platformView = isPlatformAdmin(user);

  const searchResults = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) {
      return [];
    }

    return (searchItems || [])
      .filter((item) => {
        const haystack = [item.label, item.subtitle, ...(item.keywords || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [searchItems, searchQuery]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((first, second) => {
      const firstPriority = getPriorityScore(first);
      const secondPriority = getPriorityScore(second);
      if (firstPriority !== secondPriority) {
        return secondPriority - firstPriority;
      }

      return toEpoch(second.created_at || second.remind_at) - toEpoch(first.created_at || first.remind_at);
    });
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    if (filter === "unread") {
      return sortedNotifications.filter((item) => !item.is_read);
    }

    return sortedNotifications;
  }, [filter, sortedNotifications]);

  useEffect(() => {
    if (!alertsOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (alertsPanelRef.current && !alertsPanelRef.current.contains(event.target)) {
        setAlertsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setAlertsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [alertsOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (firstUnreadSync.current) {
      firstUnreadSync.current = false;
      previousUnreadRef.current = unread;
      return;
    }

    if (unread > previousUnreadRef.current) {
      setFilter("unread");
      setAlertsOpen(true);
    }

    previousUnreadRef.current = unread;
  }, [unread]);

  useEffect(() => {
    const handleSlashShortcut = (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";

      if (isEditable) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
      setSearchOpen(Boolean(String(searchQuery || "").trim()));
    };

    document.addEventListener("keydown", handleSlashShortcut);
    return () => document.removeEventListener("keydown", handleSlashShortcut);
  }, [searchQuery]);

  const handleNotificationSelect = async (item) => {
    if (item.is_read || !onNotificationRead || busyId || notificationsLoading) {
      return;
    }

    setBusyId(item.id);
    try {
      await onNotificationRead(item.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!onNotificationsReadAll || notificationsLoading || unread === 0) {
      return;
    }

    await onNotificationsReadAll();
  };

  const handleOpenActivities = () => {
    setAlertsOpen(false);
    if (onAlertsClick) {
      onAlertsClick();
    }
  };

  const handleNotificationNavigate = async (item, path) => {
    if (!path || !onNotificationNavigate || busyId || notificationsLoading) {
      return;
    }

    if (!item.is_read) {
      await handleNotificationSelect(item);
    }

    setAlertsOpen(false);
    onNotificationNavigate(path);
  };

  const handleSearchOpenResult = (item) => {
    if (!item?.path || !onSearchNavigate) {
      return;
    }

    setSearchOpen(false);
    setSearchQuery("");
    setSearchActiveIndex(0);
    onSearchNavigate(item.path);
  };

  const handleSearchKeyDown = (event) => {
    if (!searchResults.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setSearchActiveIndex((current) => (current + 1) % searchResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setSearchActiveIndex((current) =>
        current - 1 < 0 ? searchResults.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = searchResults[searchActiveIndex] || searchResults[0];
      if (target) {
        handleSearchOpenResult(target);
      }
    }
  };

  return (
    <header className="mb-5 rounded-[30px] border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-4 shadow-[var(--shadow-soft)] sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-primary)] lg:hidden"
            onClick={onMenuClick}
          >
            ≡
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
                {platformView ? "Control Center" : "Workspace"}
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                {branding.appName}
              </span>
            </div>
            <h1 className="mt-3 truncate text-3xl font-semibold text-[var(--text-primary)]">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative" ref={searchPanelRef}>
              <div
                className={`min-w-[260px] rounded-[22px] border bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-all duration-200 ${
                  searchFocused
                    ? "-translate-y-px border-[var(--accent)]/45"
                    : "border-[var(--border-soft)]"
                }`}
                style={{ boxShadow: searchFocused ? "0 0 0 3px var(--ring)" : "none" }}
              >
                <div className="flex items-center gap-2">
                  <span className="select-none text-sm text-[var(--text-secondary)]" aria-hidden="true">
                    ⌕
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(Boolean(event.target.value.trim()));
                      setSearchActiveIndex(0);
                    }}
                    onFocus={() => {
                      setSearchFocused(true);
                      setSearchOpen(Boolean(searchQuery.trim()));
                    }}
                    onBlur={() => setSearchFocused(false)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search leads, people, companies, or actions"
                    className="w-full flex-1 border-none bg-transparent px-1 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                  />
                  {!searchQuery ? (
                    <kbd className="rounded-md border border-[var(--border-soft)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      /
                    </kbd>
                  ) : null}
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchOpen(false);
                        setSearchActiveIndex(0);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel)] text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>

              {searchOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 max-h-80 overflow-y-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-2 shadow-[var(--shadow-panel)]">
                  {searchResults.length ? (
                    searchResults.map((item, index) => (
                      <button
                        key={item.id || `${item.path}-${index}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSearchOpenResult(item)}
                        className={`flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition ${
                          searchActiveIndex === index
                            ? "bg-[var(--accent-soft)]"
                            : "hover:bg-[var(--surface)]"
                        }`}
                      >
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{item.subtitle || item.path}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
                      No results found. Try lead/customer/company names.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="relative" ref={alertsPanelRef}>
              <button
                type="button"
                onClick={() => setAlertsOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] transition hover:border-[var(--accent)]/25 hover:bg-[var(--surface-strong)]"
                aria-expanded={alertsOpen}
                aria-haspopup="dialog"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                {unread} unread alerts
              </button>

              {alertsOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.7rem)] z-30 w-[min(92vw,440px)] rounded-[26px] border border-[var(--border-soft)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Alert Inbox</p>
                      <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Notifications</h2>
                    </div>
                    <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                      {unread} unread
                    </span>
                  </div>

                  <div className="mt-4 inline-flex rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1">
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        filter === "all"
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter("unread")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        filter === "unread"
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Unread
                    </button>
                  </div>

                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {visibleNotifications.length ? (
                      visibleNotifications.map((item) => {
                        const titleText = item.title || getTypeLabel(item.type);
                        const messageText = item.message || "You have a new workspace update.";
                        const typeLabel = getTypeLabel(item.type);
                        const timeLabel = formatRelativeTime(item.created_at || item.remind_at);
                        const isBusy = busyId === item.id;
                        const action = getNotificationAction(item);

                        return (
                          <div
                            key={item.id}
                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                              item.is_read
                                ? "border-[var(--border-soft)] bg-[var(--surface)]/55"
                                : "border-[var(--accent)]/25 bg-[var(--surface)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-strong)]"
                            } ${isBusy ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTypeStyle(item.type)}`}>
                                {typeLabel}
                              </span>
                              <span className="text-[11px] text-[var(--text-muted)]">{timeLabel}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{titleText}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{messageText}</p>
                            {!item.is_read ? (
                              <span className="mt-2 inline-flex rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">
                                New
                              </span>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={item.is_read || notificationsLoading || isBusy}
                                onClick={() => handleNotificationSelect(item)}
                              >
                                {item.is_read ? "Read" : "Mark read"}
                              </Button>
                              {action ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={notificationsLoading || isBusy}
                                  onClick={() => handleNotificationNavigate(item, action.path)}
                                >
                                  {action.label}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface)]/55 px-4 py-7 text-center">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">All caught up</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          New reminders and deal alerts will appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={unread === 0 || notificationsLoading}
                      onClick={handleMarkAllRead}
                    >
                      Mark all read
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleOpenActivities}>
                      Open activities
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <Button variant="secondary" onClick={onThemeToggle}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            <Button variant="danger" onClick={onLogout}>
              Logout
            </Button>
          </div>

          <button
            type="button"
            onClick={onAccountClick}
            className="flex flex-wrap items-center gap-3 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent)]/25 hover:bg-[var(--surface-strong)]"
          >
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-1.5">
              {getRoleLabel(user)}
            </span>
            <span className="font-medium text-[var(--text-primary)]">
              {user?.full_name || "Workspace user"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
