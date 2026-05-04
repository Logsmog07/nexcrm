import { Funnel, FunnelChart, LabelList, Tooltip } from "recharts";
import { Card } from "../ui/Card";
import { ChartSurface } from "./ChartSurface";

export function FunnelChartCard({ data = [] }) {
  const transformed = data.map((item) => ({
    name: item.label,
    value: item.total,
  }));

  return (
    <Card className="h-[360px]">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Pipeline drop-off</h3>
        <p className="text-sm text-[var(--text-secondary)]">Stage concentration and likely leakage points</p>
      </div>
      <ChartSurface className="h-[280px]">
        {({ width, height }) => (
          <FunnelChart width={width} height={height}>
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 18,
              }}
              labelStyle={{ color: "var(--chart-label)" }}
            />
            <Funnel dataKey="value" data={transformed} isAnimationActive fill="#f59e0b">
              <LabelList position="right" fill="var(--chart-label)" stroke="none" dataKey="name" />
            </Funnel>
          </FunnelChart>
        )}
      </ChartSurface>
    </Card>
  );
}
