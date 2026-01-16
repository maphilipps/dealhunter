import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track your performance metrics and insights
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>
              Comprehensive performance metrics coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page will display charts for:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Bit/No Bit Rate (Donut Chart)</li>
              <li>Pipeline Funnel (Horizontal Bar Chart)</li>
              <li>Opportunities by Business Line (Stacked Bar Chart)</li>
              <li>Time to Decision Trend (Line Chart)</li>
              <li>Risk Assessment (Radar Chart)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
