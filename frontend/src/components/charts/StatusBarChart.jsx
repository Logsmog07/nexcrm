import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";
import { ChartSurface } from "./ChartSurface";

export function StatusBarChart({ data = [] }) {
  return (
    <Card className="h-[360px]">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Lead distribution</h3>
        <p className="text-sm text-[var(--text-secondary)]">How leads are moving through qualification</p>
      </div>
      <ChartSurface className="h-[280px]">
        {({ width, height }) => (
          <BarChart width={width} height={height} data={data}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--chart-axis)" />
            <YAxis stroke="var(--chart-axis)" />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 18,
              }}
              labelStyle={{ color: "var(--chart-label)" }}
            />
            <Bar dataKey="value" fill="#7dd3fc" radius={[12, 12, 0, 0]} />
          </BarChart>
        )}
      </ChartSurface>
    </Card>
  );
}
