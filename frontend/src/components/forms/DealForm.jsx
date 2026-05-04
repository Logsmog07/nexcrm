import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const stages = ["discovery", "proposal", "negotiation", "won", "lost"];

export function DealForm({
  form,
  setForm,
  customers,
  leads,
  users,
  onSubmit,
  submitLabel = "Save deal",
}) {
  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Deal details
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Deal title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <Select
            value={form.stage}
            onChange={(event) => setForm({ ...form, stage: event.target.value })}
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </Select>
          <Select
            value={form.customerId}
            onChange={(event) => setForm({ ...form, customerId: event.target.value, leadId: "" })}
          >
            <option value="">Attach customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <Select
            value={form.leadId}
            onChange={(event) => setForm({ ...form, leadId: event.target.value, customerId: "" })}
          >
            <option value="">Attach lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Forecasting
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select
            value={form.ownerId}
            onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
          >
            <option value="">Deal owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Deal value"
            type="number"
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
          <Input
            placeholder="Probability"
            type="number"
            value={form.probability}
            onChange={(event) => setForm({ ...form, probability: event.target.value })}
          />
          <Input
            placeholder="Expected close date"
            type="date"
            value={form.expectedCloseDate}
            onChange={(event) => setForm({ ...form, expectedCloseDate: event.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
