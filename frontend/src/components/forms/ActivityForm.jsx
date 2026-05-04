import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const types = ["call", "email", "meeting", "note", "task"];

export function ActivityForm({
  form,
  setForm,
  leads,
  customers,
  deals,
  users,
  onSubmit,
  submitLabel = "Log activity",
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
          Activity details
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Subject"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
          />
          <Select
            value={form.userId}
            onChange={(event) => setForm({ ...form, userId: event.target.value })}
          >
            <option value="">Owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          CRM linkage
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select
            value={form.relatedLeadId}
            onChange={(event) => setForm({ ...form, relatedLeadId: event.target.value })}
          >
            <option value="">Related lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </Select>
          <Select
            value={form.relatedCustomerId}
            onChange={(event) => setForm({ ...form, relatedCustomerId: event.target.value })}
          >
            <option value="">Related customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
        <Select
          value={form.relatedDealId}
          onChange={(event) => setForm({ ...form, relatedDealId: event.target.value })}
        >
          <option value="">Related deal</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
            {deal.title}
          </option>
        ))}
      </Select>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Notes
        </div>
        <div className="mt-4">
        <Textarea
          placeholder="Activity notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
