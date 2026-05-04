import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";
import { formatCompactCurrency } from "../../lib/formatters";
import { ChartSurface } from "./ChartSurface";

export function RevenueLineChart({ data = [] }) {
  return (
    <Card className="h-[360px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Revenue trend</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Monthly won revenue over time
          </p>
        </div>
      </div>
      <ChartSurface className="h-[280px]">
        {({ width, height }) => (
          <LineChart width={width} height={height} data={data}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="period" stroke="var(--chart-axis)" />
            <YAxis
              stroke="var(--chart-axis)"
              tickFormatter={(value) => formatCompactCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 18,
              }}
              labelStyle={{ color: "var(--chart-label)" }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--accent)"
              strokeWidth={3}
              dot={{ r: 4, fill: "var(--accent)" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}
      </ChartSurface>
    </Card>
  );
}
