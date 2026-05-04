import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";

const lifecycleStages = ["active", "at_risk", "churned", "vip"];

export function CustomerForm({ form, setForm, users, onSubmit, submitLabel = "Save customer" }) {
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
          Account profile
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Customer name"
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Ownership and value
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Industry"
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Select
            value={form.ownerId}
            onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
          >
            <option value="">No owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Select
            value={form.lifecycleStage}
            onChange={(event) => setForm({ ...form, lifecycleStage: event.target.value })}
          >
            {lifecycleStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Total revenue"
            type="number"
            value={form.totalRevenue}
            onChange={(event) => setForm({ ...form, totalRevenue: event.target.value })}
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Context
        </div>
        <div className="mt-4">
        <Textarea
          placeholder="Account notes"
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
