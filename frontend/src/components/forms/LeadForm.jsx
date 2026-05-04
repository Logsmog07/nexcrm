import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const statuses = ["new", "contacted", "qualified", "lost"];

export function LeadForm({ form, setForm, users, onSubmit, submitLabel = "Save lead" }) {
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Contact details
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Lead name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            placeholder="Phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            placeholder="Company"
            value={form.company}
            onChange={(event) => setForm({ ...form, company: event.target.value })}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Qualification setup
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Lead source"
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
          />
          <Select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select
            value={form.assignedTo}
            onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Estimated value"
            type="number"
            value={form.estimatedValue}
            onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Qualification notes
        </div>
        <div className="mt-4">
          <Textarea
            placeholder="Add context, objections, recent outreach notes, and next-step guidance"
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
