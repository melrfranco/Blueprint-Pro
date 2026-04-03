import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { ReportMetrics } from '../utils/reportMetrics';

interface ReportsPanelProps {
  role: 'admin' | 'stylist';
  metrics: ReportMetrics;
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const fmt = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${n}%`;

const CATEGORIES = [
  { id: 'adoption', label: 'Plan Adoption & Usage' },
  { id: 'booking', label: 'Plan → Booking Behavior' },
  { id: 'revenue', label: 'Revenue Predictability' },
  { id: 'accuracy', label: 'Plan Accuracy vs Reality' },
  { id: 'clients', label: 'Client Commitment' },
  { id: 'services', label: 'Service Strategy' },
  { id: 'ltv', label: 'Client Value (LTV)' },
  { id: 'team', label: 'Stylist Performance' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-card p-5 bp-container-list shadow-sm elevated-card ${accent ? 'border-2 border-primary/30' : ''}`}>
      <p className="bp-overline mb-2">{label}</p>
      <p className="bp-stat-value text-3xl text-foreground">{value}</p>
      {sub && <p className="bp-caption mt-1 text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionHeader({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-1 text-left"
    >
      <h2 className="bp-section-title">{label}</h2>
      <span className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPanel({ role, metrics }: ReportsPanelProps) {
  const [openSections, setOpenSections] = useState<Set<CategoryId>>(
    new Set(['adoption', 'revenue', 'ltv'])
  );

  const toggle = (id: CategoryId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleCategories = useMemo(() =>
    CATEGORIES.filter(c => role === 'admin' || c.id !== 'team'),
    [role]
  );

  const planStatusData = [
    { name: 'Active', value: metrics.activePlans, fill: 'var(--chart-1)' },
    { name: 'Draft', value: metrics.draftPlans, fill: 'var(--chart-3)' },
    { name: 'Other', value: Math.max(0, metrics.totalPlans - metrics.activePlans - metrics.draftPlans), fill: 'var(--chart-5)' },
  ].filter(d => d.value > 0);

  const maintenanceData = [
    { name: 'High Maintenance', value: metrics.highMaintenanceClients, fill: 'var(--chart-1)' },
    { name: 'Low Maintenance', value: metrics.lowMaintenanceClients, fill: 'var(--chart-4)' },
  ].filter(d => d.value > 0);

  const topClients = metrics.clientValues.slice(0, 6);
  const topServices = metrics.serviceMix.slice(0, 6);

  return (
    <div className="bp-page space-y-2">
      <h1 className="bp-page-title">Analytics</h1>
      <p className="bp-caption text-muted-foreground mb-4">
        Based on {metrics.totalPlans} plan{metrics.totalPlans !== 1 ? 's' : ''} across {metrics.totalClients} client{metrics.totalClients !== 1 ? 's' : ''}
      </p>

      {/* ─── PLAN ADOPTION ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Plan Adoption & Usage" isOpen={openSections.has('adoption')} onToggle={() => toggle('adoption')} />
        </div>
        {openSections.has('adoption') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Plan Coverage" value={pct(metrics.clientsWithPlanPct)} sub={`${metrics.clientsWithPlan} of ${metrics.totalClients} clients`} accent />
              <StatCard label="Active Plans" value={String(metrics.activePlans)} sub="confirmed roadmaps" />
              <StatCard label="Draft Plans" value={String(metrics.draftPlans)} sub="pending activation" />
              <StatCard label="Total Created" value={String(metrics.totalPlans)} sub="all time" />
            </div>

            {/* Plan Status Breakdown */}
            {planStatusData.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Plan Status Breakdown</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {planStatusData.map((d, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Plan creation trend */}
            {metrics.planCreationTrend.some(d => d.count > 0) && (
              <div>
                <p className="bp-overline mb-3">Plan Creation — Last 12 Months</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.planCreationTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" name="Plans Created" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.25} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Plans per stylist (admin only) */}
            {role === 'admin' && metrics.stylistPlanStats.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Plans Created per Stylist</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.stylistPlanStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="stylistName" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="planCount" name="Plans" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="activePlans" name="Active" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── BOOKING BEHAVIOR ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Plan → Booking Behavior" isOpen={openSections.has('booking')} onToggle={() => toggle('booking')} />
        </div>
        {openSections.has('booking') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Booking Conversion" value={pct(metrics.planBookingConversionRate)} sub="active plans → bookings" accent />
              <StatCard label="Total Bookings" value={String(metrics.bookingsTotal)} sub="on record" />
              <StatCard label="Plan-Sourced" value={String(metrics.bookingsFromPlan)} sub="bookings from plans" />
              <StatCard label="Organic" value={String(Math.max(0, metrics.bookingsTotal - metrics.bookingsFromPlan))} sub="outside of plans" />
            </div>

            {metrics.bookingsTotal > 0 && (
              <div>
                <p className="bp-overline mb-3">Booking Source Breakdown</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'From Plan', value: metrics.bookingsFromPlan || 0 },
                          { name: 'Organic', value: Math.max(0, metrics.bookingsTotal - metrics.bookingsFromPlan) },
                        ].filter(d => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={55}
                        innerRadius={30}
                      >
                        {[0, 1].map(i => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {metrics.bookingsTotal === 0 && (
              <div className="text-center py-6">
                <p className="bp-body-sm text-muted-foreground">Booking conversion tracking activates once appointments are booked through plans.</p>
                <p className="bp-caption text-muted-foreground mt-1">Plan → booking conversion rate will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── PLAN ACCURACY ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Plan Accuracy vs Reality" isOpen={openSections.has('accuracy')} onToggle={() => toggle('accuracy')} />
        </div>
        {openSections.has('accuracy') && (
          <div className="px-5 pb-6 space-y-4">
            <div className="bg-muted/50 bp-container-list p-4 text-center">
              <p className="bp-overline text-muted-foreground mb-1">Plan Deviation Tracking</p>
              <p className="bp-body-sm text-muted-foreground">
                Planned vs actual visit timing and service accuracy is tracked automatically as clients book. Data accumulates as your plans mature.
              </p>
            </div>

            {/* Planned vs actual cost from historical data */}
            {topClients.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Planned Revenue Per Client</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClients.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="clientName" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="projectedValue" name="Projected Value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Avg Appt Value" value={fmt(metrics.activePlans > 0 ? Math.round(metrics.totalConfirmedRevenue / Math.max(1, metrics.activePlans)) : 0)} sub="per active plan" />
              <StatCard label="Plan Accuracy" value="Live" sub="tracks as visits happen" />
            </div>
          </div>
        )}
      </div>

      {/* ─── CLIENT COMMITMENT ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Client Commitment & Consistency" isOpen={openSections.has('clients')} onToggle={() => toggle('clients')} />
        </div>
        {openSections.has('clients') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Adherence Rate" value={pct(metrics.planBookingConversionRate)} sub="clients following plan" accent />
              <StatCard label="Clients Tracked" value={String(metrics.clientsWithPlan)} sub="have active plans" />
            </div>

            {topClients.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Client Consistency — Plan Value</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClients.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="clientName" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="projectedValue" name="Projected Value" radius={[4, 4, 0, 0]}>
                        {topClients.slice(0, 6).map((c, i) => (
                          <Cell key={i} fill={c.hasActivePlan ? 'var(--chart-1)' : 'var(--chart-4)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="bp-caption text-muted-foreground mt-1 pl-1">Dark = active plan · Light = draft / inactive</p>
              </div>
            )}

            <div className="bg-muted/50 bp-container-list p-4">
              <p className="bp-overline mb-1">On-Time vs Delayed & Skipped Services</p>
              <p className="bp-caption text-muted-foreground">
                Tracks as clients book or miss scheduled appointments. Deviation scoring activates once plan appointment dates are reached.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── REVENUE PREDICTABILITY ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Revenue Predictability" isOpen={openSections.has('revenue')} onToggle={() => toggle('revenue')} />
        </div>
        {openSections.has('revenue') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Confirmed Revenue" value={fmt(metrics.totalConfirmedRevenue)} sub="active plans" accent />
              <StatCard label="Stability Score" value={pct(metrics.revenueStabilityScore)} sub="confirmed / total" />
              <StatCard label="Next 3 Months" value={fmt(metrics.projectedNext3)} sub="projected pipeline" />
              <StatCard label="12-Month Pipeline" value={fmt(metrics.projectedNext12)} sub="full year projection" />
            </div>

            {/* Monthly revenue chart */}
            {metrics.monthlyRevenue.some(m => m.confirmed + m.projected > 0) ? (
              <div>
                <p className="bp-overline mb-3">Monthly Revenue — Past 6 + Next 6 Months</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="confirmed" name="Confirmed" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} strokeWidth={2} stackId="1" />
                      <Area type="monotone" dataKey="projected" name="Projected" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.2} strokeWidth={2} strokeDasharray="5 3" stackId="1" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="bp-caption text-muted-foreground mt-1 pl-1">Solid = confirmed (active plans) · Dashed = projected (draft plans)</p>
              </div>
            ) : (
              <div className="text-center py-6 bg-muted/50 bp-container-list">
                <p className="bp-body-sm text-muted-foreground">Revenue forecast populates as plans with future appointment dates are created.</p>
              </div>
            )}

            {/* Revenue projections by period */}
            <div>
              <p className="bp-overline mb-3">Revenue Projection Periods</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { period: '3 Months', value: metrics.projectedNext3 },
                    { period: '6 Months', value: metrics.projectedNext6 },
                    { period: '12 Months', value: metrics.projectedNext12 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Projected Revenue" radius={[6, 6, 0, 0]}>
                      {[0, 1, 2].map(i => <Cell key={i} fill={CHART_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── SERVICE STRATEGY ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Service Strategy Insights" isOpen={openSections.has('services')} onToggle={() => toggle('services')} />
        </div>
        {openSections.has('services') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Top Service"
                value={metrics.serviceMix[0]?.name || '—'}
                sub={metrics.serviceMix[0] ? `${metrics.serviceMix[0].count}× planned` : 'no data'}
                accent
              />
              <StatCard
                label="Services Planned"
                value={String(metrics.serviceMix.length)}
                sub="unique services in plans"
              />
              <StatCard
                label="High-Maintenance"
                value={String(metrics.highMaintenanceClients)}
                sub={`of ${metrics.highMaintenanceClients + metrics.lowMaintenanceClients} clients`}
              />
              <StatCard
                label="Low-Maintenance"
                value={String(metrics.lowMaintenanceClients)}
                sub="simpler service profiles"
              />
            </div>

            {topServices.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Service Mix — By Plan Frequency</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topServices} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Times Planned" radius={[0, 4, 4, 0]}>
                        {topServices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {maintenanceData.length > 0 && (
              <div>
                <p className="bp-overline mb-3">High vs Low Maintenance Client Ratio</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={maintenanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={28}>
                        {maintenanceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {metrics.serviceMix.length === 0 && (
              <div className="text-center py-6 bg-muted/50 bp-container-list">
                <p className="bp-body-sm text-muted-foreground">Service mix data populates as plans with appointments are created.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── CLIENT LTV ─── */}
      <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <SectionHeader label="Client Value (Plan-Based LTV)" isOpen={openSections.has('ltv')} onToggle={() => toggle('ltv')} />
        </div>
        {openSections.has('ltv') && (
          <div className="px-5 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Avg Client Value" value={fmt(metrics.avgClientValue)} sub="projected per client" accent />
              <StatCard label="Total LTV" value={fmt(metrics.totalProjectedLTV)} sub="portfolio total" />
              <StatCard label="Clients Valued" value={String(metrics.clientValues.length)} sub="with projected plans" />
              <StatCard label="Top Client" value={metrics.clientValues[0] ? fmt(metrics.clientValues[0].projectedValue) : '—'} sub={metrics.clientValues[0]?.clientName || 'no data'} />
            </div>

            {topClients.length > 0 && (
              <div>
                <p className="bp-overline mb-3">Client Value Distribution — Top Clients</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClients}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="clientName" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="projectedValue" name="Projected LTV" radius={[6, 6, 0, 0]}>
                        {topClients.map((c, i) => <Cell key={i} fill={c.hasActivePlan ? CHART_COLORS[0] : CHART_COLORS[3]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="bp-caption text-muted-foreground mt-1 pl-1">Dark = active plan · Light = draft / inactive</p>
              </div>
            )}

            {/* Value tier buckets */}
            {metrics.clientValues.length > 0 && (() => {
              const buckets = [
                { label: 'Under $1k', min: 0, max: 1000 },
                { label: '$1k–$3k', min: 1000, max: 3000 },
                { label: '$3k–$6k', min: 3000, max: 6000 },
                { label: '$6k+', min: 6000, max: Infinity },
              ].map(b => ({
                ...b,
                count: metrics.clientValues.filter(c => c.projectedValue >= b.min && c.projectedValue < b.max).length,
              })).filter(b => b.count > 0);

              return buckets.length > 1 ? (
                <div>
                  <p className="bp-overline mb-3">Value Tier Distribution</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Clients" radius={[6, 6, 0, 0]}>
                          {buckets.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ─── STYLIST PERFORMANCE (admin only) ─── */}
      {role === 'admin' && (
        <div className="bg-card bp-container-tall shadow-sm elevated-card overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <SectionHeader label="Stylist Behavior & Performance" isOpen={openSections.has('team')} onToggle={() => toggle('team')} />
          </div>
          {openSections.has('team') && (
            <div className="px-5 pb-6 space-y-5">
              {metrics.stylistPlanStats.length === 0 ? (
                <div className="text-center py-6 bg-muted/50 bp-container-list">
                  <p className="bp-body-sm text-muted-foreground">Stylist performance data appears once team members have created plans.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const maxPlans = metrics.stylistPlanStats.reduce((m, x) => Math.max(m, x.planCount), 0);
                    return (
                      <div className="space-y-3">
                        {metrics.stylistPlanStats.map((s, i) => {
                          const barWidth = maxPlans > 0 ? Math.min(100, (s.planCount / maxPlans) * 100) : 0;
                          return (
                            <div key={s.stylistId} className="bg-muted/40 p-4 bp-container-list">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-sm text-foreground">{s.stylistName}</p>
                                  <p className="bp-caption text-muted-foreground">{s.clientCount} client{s.clientCount !== 1 ? 's' : ''} · {s.planCount} plan{s.planCount !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-foreground">{fmt(s.totalRevenue)}</p>
                                  <p className="bp-caption text-muted-foreground">{s.conversionRate}% conversion</p>
                                </div>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{ width: `${barWidth}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div>
                    <p className="bp-overline mb-3">Revenue Pipeline by Stylist</p>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.stylistPlanStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="stylistName" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={80} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="totalRevenue" name="Pipeline Revenue" radius={[0, 4, 4, 0]}>
                            {metrics.stylistPlanStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <p className="bp-overline mb-3">Plan → Booking Conversion by Stylist</p>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.stylistPlanStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="stylistName" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="conversionRate" name="Conversion %" radius={[6, 6, 0, 0]}>
                            {metrics.stylistPlanStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
