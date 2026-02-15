// AdminDashboardV2.tsx
// Color-cleaned version — layout preserved, colors token-based only

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

import BottomNav, { Tab } from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckCircleIcon,
  GlobeIcon,
  SettingsIcon,
  ChevronLeftIcon,
  SunIcon,
  UsersIcon,
} from './icons';

import type { UserRole, GeneratedPlan } from '../types';
import { GOOGLE_FONTS_LIST } from '../data/fonts';
import AccountSettings from './AccountSettings';
import PlanWizard from './PlanWizard';
import MembershipSetup from './MembershipSetup';
import TeamAccessSettings from './TeamAccessSettings';
import ThemeToggle from './ThemeToggle';
import { SaveToast, useSaveToast } from './SaveToast';
import { canCustomizeBranding } from '../utils/isEnterpriseAccount';

export default function AdminDashboardV2({ role }: { role: UserRole }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [activeSettingsView, setActiveSettingsView] =
    useState<'menu' | 'branding' | 'account' | 'memberships' | 'teamAccess' | 'appearance'>('menu');
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const { branding, updateBranding, clients, textSize, updateTextSize, saveAll } =
    useSettings();
  const { toastVisible, showToast, hideToast } = useSaveToast();
  const { plans, getStats } = usePlans();
  const { user, updateUser, logout } = useAuth();

  const stats = getStats();

  const totalPipeline = plans
    .filter((p) => p.status === 'active' || p.status === 'draft')
    .reduce((sum, p) => sum + p.totalCost, 0);

  const pipelineGrowthData = useMemo(() => {
    const sortedPlans = [...plans].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cumulative = 0;
    const map = new Map<string, number>();

    sortedPlans.forEach((plan) => {
      const month = new Date(plan.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      cumulative += plan.totalCost;
      map.set(month, cumulative);
    });

    const months: string[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(
        d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      );
    }

    let lastValue = 0;

    return months.map((m) => {
      if (map.has(m)) lastValue = map.get(m)!;
      return { name: m, value: lastValue };
    });
  }, [plans]);

  const renderDashboard = () => (
    <div className="bp-page">
      <h1 className="bp-page-title mb-2">Dashboard</h1>

      {user?.name && (
        <p className="bp-subtitle mb-8 pl-4">
          Welcome back, {user.name.split(' ')[0]}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2 p-8 bg-primary text-primary-foreground bp-container-list border border-border shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="bp-section-title mb-3 text-primary-foreground">
              Roadmap Pipeline
            </p>
            <p className="text-5xl bp-stat-value text-primary-foreground">
              ${totalPipeline.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-card p-6 bp-container-list border border-border shadow-sm">
          <p className="bp-overline mb-3">Active Plans</p>
          <p className="text-4xl bp-stat-value">{stats.activePlansCount}</p>
        </div>

        <div className="bg-card p-6 bp-container-list border border-border shadow-sm">
          <p className="bp-overline mb-3">Total Clients</p>
          <p className="text-4xl bp-stat-value">{clients.length}</p>
        </div>
      </div>

      <div className="bg-card p-7 bp-container-tall border border-border shadow-sm">
        <h3 className="bp-section-title mb-4">Pipeline Growth</h3>

        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pipelineGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(val) => `$${val / 1000}k`}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.25}
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background pb-24">
      {renderDashboard()}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      <SaveToast visible={toastVisible} onDone={hideToast} />
    </div>
  );
}
