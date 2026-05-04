import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { CustomerForm } from "../components/forms/CustomerForm";
import { EmptyState } from "../components/common/EmptyState";
import { fetchDashboardData } from "../store";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { canCreateCustomers } from "../lib/roles";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { useNavigate } from "../hooks/useNavigate";

const PAGE_SIZE = 16;

const emptyCustomerForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  industry: "",
  ownerId: "",
  lifecycleStage: "active",
  totalRevenue: "",
  notes: "",
};

const lifecycleTones = {
  active: "success",
  at_risk: "warning",
  churned: "danger",
  vip: "info",
};

const tabKeys = {
  all: "all",
  mine: "mine",
  vip: "vip",
  atRisk: "at_risk",
};

function getInitials(value = "Customer") {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatLifecycle(value) {
  return String(value || "active").replaceAll("_", " ");
}

function matchesRevenueBand(customer, band) {
  const revenue = Number(customer.total_revenue || 0);
  if (band === "all") return true;
  if (band === "high") return revenue >= 250000;
  if (band === "mid") return revenue >= 50000 && revenue < 250000;
  if (band === "low") return revenue < 50000;
  return true;
}

function sortCustomers(rows, sortBy) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortBy === "revenue_desc") {
      return Number(right.total_revenue || 0) - Number(left.total_revenue || 0);
    }

    if (sortBy === "revenue_asc") {
      return Number(left.total_revenue || 0) - Number(right.total_revenue || 0);
    }

    if (sortBy === "name_asc") {
      return String(left.name || "").localeCompare(String(right.name || ""));
    }

    return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
  });

  return sorted;
}

export function CustomersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { customers, users, deals, activities } = useSelector((state) => state.crm);
  const currentUser = useSelector((state) => state.auth.user);

  const [query, setQuery] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [revenueFilter, setRevenueFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [activeTab, setActiveTab] = useState(tabKeys.all);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMenuCustomerId, setActionMenuCustomerId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyCustomerForm);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const customerMetrics = useMemo(() => {
    const active = customers.filter((customer) => customer.lifecycle_stage === "active").length;
    const atRisk = customers.filter((customer) => customer.lifecycle_stage === "at_risk").length;
    const vip = customers.filter((customer) => customer.lifecycle_stage === "vip").length;
    const totalRevenue = customers.reduce(
      (sum, customer) => sum + Number(customer.total_revenue || 0),
      0
    );

    return {
      total: customers.length,
      active,
      atRisk,
      vip,
      totalRevenue,
    };
  }, [customers]);

  const tabCounts = useMemo(() => {
    const mine = customers.filter(
      (customer) => String(customer.owner_id || "") === String(currentUser?.id || "")
    ).length;
    const vip = customers.filter((customer) => customer.lifecycle_stage === "vip").length;
    const atRisk = customers.filter((customer) => customer.lifecycle_stage === "at_risk").length;

    return {
      all: customers.length,
      mine,
      vip,
      at_risk: atRisk,
    };
  }, [customers, currentUser?.id]);

  const openDealCountByCustomer = useMemo(() => {
    const counts = {};
    for (const deal of deals) {
      if (!deal.customer_id || deal.status !== "open") continue;
      const key = String(deal.customer_id);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [deals]);

  const latestActivityByCustomer = useMemo(() => {
    const timeline = {};

    for (const activity of activities) {
      if (!activity.related_customer_id) continue;
      const key = String(activity.related_customer_id);
      const current = timeline[key];
      const nextStamp = new Date(activity.created_at || activity.updated_at || 0).getTime();
      const currentStamp = current
        ? new Date(current.created_at || current.updated_at || 0).getTime()
        : 0;

      if (!current || nextStamp > currentStamp) {
        timeline[key] = activity;
      }
    }

    return timeline;
  }, [activities]);

  const filteredCustomers = useMemo(() => {
    const rows = customers.filter((customer) => {
      const matchesTab =
        activeTab === tabKeys.all ||
        (activeTab === tabKeys.mine &&
          String(customer.owner_id || "") === String(currentUser?.id || "")) ||
        (activeTab === tabKeys.vip && customer.lifecycle_stage === "vip") ||
        (activeTab === tabKeys.atRisk && customer.lifecycle_stage === "at_risk");

      const matchesSearch =
        !query ||
        [customer.name, customer.email, customer.company].some((value) =>
          String(value || "").toLowerCase().includes(query.toLowerCase())
        );

      const matchesLifecycle =
        lifecycleFilter === "all" || String(customer.lifecycle_stage || "") === lifecycleFilter;

      const matchesOwner =
        ownerFilter === "all" || String(customer.owner_id || "") === String(ownerFilter);

      return (
        matchesTab &&
        matchesSearch &&
        matchesLifecycle &&
        matchesOwner &&
        matchesRevenueBand(customer, revenueFilter)
      );
    });

    return sortCustomers(rows, sortBy);
  }, [customers, activeTab, currentUser?.id, lifecycleFilter, ownerFilter, query, revenueFilter, sortBy]);

  const paginationMeta = useMemo(() => {
    const total = filteredCustomers.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(currentPage, pageCount);
    const start = total ? (safePage - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(safePage * PAGE_SIZE, total);

    return {
      total,
      pageCount,
      safePage,
      start,
      end,
    };
  }, [filteredCustomers.length, currentPage]);

  const paginatedCustomers = useMemo(() => {
    const offset = (paginationMeta.safePage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(offset, offset + PAGE_SIZE);
  }, [filteredCustomers, paginationMeta.safePage]);

  const refreshWorkspace = async () => {
    await dispatch(fetchDashboardData());
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setForm(emptyCustomerForm);
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(emptyCustomerForm);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
      industry: customer.industry || "",
      ownerId: customer.owner_id || "",
      lifecycleStage: customer.lifecycle_stage || "active",
      totalRevenue: String(customer.total_revenue || ""),
      notes: customer.notes || "",
    });
    setModalOpen(true);
    setActionMenuCustomerId(null);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setActionError("");
      const payload = {
        ...form,
        ownerId: form.ownerId || null,
        totalRevenue: Number(form.totalRevenue || 0),
      };

      if (editingCustomer) {
        await crmApi.updateCustomer(editingCustomer.id, payload);
      } else {
        await crmApi.createCustomer(payload);
      }

      await refreshWorkspace();
      resetModal();
    } catch (error) {
      setActionError(error.message || "Unable to save customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppShell
        title="Customers"
        subtitle="Operate every customer relationship with lifecycle health, ownership, and revenue clarity."
      >
        <ErrorBanner message={actionError} />

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Customers</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Prioritize high-value accounts, recover at-risk relationships, and track revenue momentum.
            </p>
          </div>
          {canCreateCustomers(currentUser) ? (
            <Button onClick={openCreateModal}>+ Add Customer</Button>
          ) : null}
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Total Accounts</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{customerMetrics.total}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{customerMetrics.active} active lifecycle accounts</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Portfolio Revenue</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {formatCompactCurrency(customerMetrics.totalRevenue)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Tracked customer revenue footprint</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">VIP Accounts</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{customerMetrics.vip}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Key expansion and retention focus</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">At Risk</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{customerMetrics.atRisk}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Accounts requiring intervention plans</div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <Input
            placeholder="Search name, email, company"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            className="xl:col-span-2"
          />

          <Select
            value={lifecycleFilter}
            onChange={(event) => {
              setLifecycleFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Lifecycle (All)</option>
            <option value="active">Active</option>
            <option value="vip">VIP</option>
            <option value="at_risk">At Risk</option>
            <option value="churned">Churned</option>
          </Select>

          <Select
            value={ownerFilter}
            onChange={(event) => {
              setOwnerFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Owner (All)</option>
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select
              value={revenueFilter}
              onChange={(event) => {
                setRevenueFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Revenue (All)</option>
              <option value="high">High</option>
              <option value="mid">Mid</option>
              <option value="low">Low</option>
            </Select>
            <Select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="updated_desc">Recently Updated</option>
              <option value="revenue_desc">Revenue High-Low</option>
              <option value="revenue_asc">Revenue Low-High</option>
              <option value="name_asc">Name A-Z</option>
            </Select>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {[
            { key: tabKeys.all, label: "All Accounts", count: tabCounts.all },
            { key: tabKeys.mine, label: "My Accounts", count: tabCounts.mine },
            { key: tabKeys.vip, label: "VIP", count: tabCounts.vip },
            { key: tabKeys.atRisk, label: "At Risk", count: tabCounts.at_risk },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                activeTab === tab.key
                  ? "bg-[var(--sidebar-active)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-xs">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-base)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Customer</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Lifecycle</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Owner</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Open Deals</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Last Touch</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedCustomers.length ? (
                  paginatedCustomers.map((customer) => {
                    const customerActivity = latestActivityByCustomer[String(customer.id)];
                    return (
                      <tr
                        key={customer.id}
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="group border-b border-[var(--border)] transition hover:bg-gray-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-semibold text-[var(--primary)]">
                              {getInitials(customer.name)}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-[var(--text-primary)]">{customer.name}</div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                {customer.email} {customer.company ? `| ${customer.company}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Badge tone={lifecycleTones[customer.lifecycle_stage] || "neutral"}>
                            {formatLifecycle(customer.lifecycle_stage)}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                          {customer.owner_name || "Unassigned"}
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                          {formatCompactCurrency(customer.total_revenue)}
                        </td>

                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                          {openDealCountByCustomer[String(customer.id)] || 0}
                        </td>

                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                          {customerActivity ? formatDateTime(customerActivity.created_at) : "No activity"}
                        </td>

                        <td className="relative px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-sm leading-none text-[var(--text-secondary)] opacity-0 transition group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                            onClick={() =>
                              setActionMenuCustomerId((current) =>
                                current === customer.id ? null : customer.id
                              )
                            }
                          >
                            ...
                          </button>

                          {actionMenuCustomerId === customer.id ? (
                            <div className="absolute right-4 top-10 z-10 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-sm">
                              <button
                                type="button"
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-slate-700"
                                onClick={() => {
                                  setActionMenuCustomerId(null);
                                  navigate(`/customers/${customer.id}`);
                                }}
                              >
                                View Profile
                              </button>
                              {canCreateCustomers(currentUser) ? (
                                <button
                                  type="button"
                                  className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-slate-700"
                                  onClick={() => openEditModal(customer)}
                                >
                                  Edit Customer
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10">
                      <EmptyState
                        title="No customers in this view"
                        description="Adjust filters or create a customer account to populate this workspace."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {paginatedCustomers.length ? (
            paginatedCustomers.map((customer) => {
              const customerActivity = latestActivityByCustomer[String(customer.id)];
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{customer.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {customer.company || "Independent"}
                      </div>
                    </div>
                    <Badge tone={lifecycleTones[customer.lifecycle_stage] || "neutral"}>
                      {formatLifecycle(customer.lifecycle_stage)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-[var(--text-secondary)]">
                    <div>Owner: {customer.owner_name || "Unassigned"}</div>
                    <div>Revenue: {formatCompactCurrency(customer.total_revenue)}</div>
                    <div>Open Deals: {openDealCountByCustomer[String(customer.id)] || 0}</div>
                    <div>
                      Last Touch: {customerActivity ? formatDateTime(customerActivity.created_at) : "No activity"}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-6">
              <EmptyState
                title="No matching customers"
                description="Try broadening your filters or adding a new customer account."
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
          <div>
            Showing {paginationMeta.start}-{paginationMeta.end} of {paginationMeta.total} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={paginationMeta.safePage <= 1}
            >
              Prev
            </Button>
            <span className="px-2">Page {paginationMeta.safePage}</span>
            <Button
              variant="secondary"
              onClick={() =>
                setCurrentPage((page) => Math.min(paginationMeta.pageCount, page + 1))
              }
              disabled={paginationMeta.safePage >= paginationMeta.pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </AppShell>

      {canCreateCustomers(currentUser) ? (
        <Modal
          open={modalOpen}
          title={editingCustomer ? "Edit customer" : "Create customer"}
          onClose={resetModal}
        >
          <CustomerForm
            form={form}
            setForm={setForm}
            users={users}
            onSubmit={handleSubmit}
            submitLabel={saving ? "Saving..." : editingCustomer ? "Update customer" : "Create customer"}
          />
        </Modal>
      ) : null}
    </>
  );
}
