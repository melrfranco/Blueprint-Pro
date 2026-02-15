import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import BottomNav, { Tab } from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';

import {
  CheckCircleIcon,
  UsersIcon,
  GlobeIcon,
  SettingsIcon,
  ChevronLeftIcon,
} from './icons';

import type { UserRole, GeneratedPlan } from '../types';
import { GOOGLE_FONTS_LIST } from '../data/fonts';

import AccountSettings from './AccountSettings';
import StylistDashboard from './StylistDashboard';
import ManageStylist from './ManageStylist';
import MembershipSetup from './MembershipSetup';
import { canCustomizeBranding } from '../utils/isEnterpriseAccount';

type SettingsView = 'menu' | 'branding' | 'account' | 'team' | 'memberships';

export default function AdminDashboardV2({ role }: { role: UserRole }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>('menu');
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const { branding, updateBranding, clients, saveAll } = useSettings();
  const { plans, getStats } = usePlans();
  const { user, logout } = useAuth();

  const stats = getStats();

  const totalPipeline = plans
    .filter((p) => p.status === 'active' || p.status === 'draft')
    .reduce((sum, p) => sum + p.totalCost, 0);

  const pipelineGrowthData = useMemo(() => {
    const sortedPlans = [...plans].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cumulativeValue = 0;
    const dataMap = new Map<string, number>();

    sortedPlans.forEach((plan) => {
      const month = new Date(plan.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      cumulativeValue += plan.totalCost;
      dataMap.set(month, cumulativeValue);
    });

    const lastSixMonths: string[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      lastSixMonths.push(
        d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      );
    }

    let lastValue = 0;
    return lastSixMonths.map((month) => {
      if (dataMap.has(month)) lastValue = dataMap.get(month)!;
      return { name: month, value: lastValue };
    });
  }, [plans]);

  const statusPillClasses = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-primary text-primary-foreground';
      case 'draft':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const renderDashboard = () => (
    <div className="bp-page">
      <h1 className="bp-page-title mb-1">Dashboard</h1>
      {user?.name && (
        <p className="bp-subtitle mb-8 pl-4">
          Welcome back, {user.name.split(' ')[0]}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2 p-8 bg-primary text-primary-foreground bp-container-list border border-border shadow-sm elevated-card">
          <div className="flex flex-col items-center justify-center text-center h-full py-4">
            <p className="bp-section-title mb-3 text-primary-foreground">
              Roadmap Pipeline
            </p>
            <p className="text-5xl bp-stat-value text-primary-foreground">
              ${totalPipeline.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-card p-6 bp-container-list border border-border shadow-sm elevated-card">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="bp-overline mb-3">Active Plans</p>
            <p className="text-4xl bp-stat-value">{stats.activePlansCount}</p>
          </div>
        </div>

        <div className="bg-card p-6 bp-container-list border border-border shadow-sm elevated-card">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="bp-overline mb-3">Total Clients</p>
            <p className="text-4xl bp-stat-value">{clients.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-card p-7 bp-container-tall border border-border shadow-sm mb-6">
        <h3 className="bp-section-title mb-4">Pipeline Growth</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pipelineGrowthData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(val) => `$${val / 1000}k`}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  borderRadius: '10px',
                }}
                labelStyle={{ color: 'var(--muted-foreground)' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.15}
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => {
    if (activeSettingsView === 'branding') {
      return (
        <div className="bp-page">
          <button
            onClick={() => setActiveSettingsView('menu')}
            className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
          </button>

          <h2 className="bp-page-subtitle mb-8">Branding</h2>

          <div className="space-y-6">
            <div>
              <label className="block bp-overline mb-2">Salon Name</label>
              <input
                type="text"
                value={branding.salonName}
                onChange={(e) =>
                  updateBranding({ ...branding, salonName: e.target.value })
                }
                data-ui="field"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block bp-overline mb-2">Primary Color</label>
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) =>
                    updateBranding({ ...branding, primaryColor: e.target.value })
                  }
                  className="w-full h-12 bp-container-compact cursor-pointer"
                />
              </div>
              <div>
                <label className="block bp-overline mb-2">Accent Color</label>
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) =>
                    updateBranding({ ...branding, accentColor: e.target.value })
                  }
                  className="w-full h-12 bp-container-compact cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block bp-overline mb-2">Font</label>
              <select
                value={branding.font}
                onChange={(e) =>
                  updateBranding({ ...branding, font: e.target.value })
                }
                data-ui="field"
                className="w-full"
              >
                {GOOGLE_FONTS_LIST.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                saveAll();
                setActiveSettingsView('menu');
              }}
              data-ui="button"
              className="w-full bp-btn-primary"
            >
              SAVE CHANGES
            </button>
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'account') {
      return (
        <div className="bp-page">
          <button
            onClick={() => setActiveSettingsView('menu')}
            className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
          </button>
          <AccountSettings user={user} onLogout={logout} subtitle="System Controller" />
        </div>
      );
    }

    if (activeSettingsView === 'team') {
      return <ManageStylist onBack={() => setActiveSettingsView('menu')} />;
    }

    if (activeSettingsView === 'memberships') {
      return <MembershipSetup onBack={() => setActiveSettingsView('menu')} />;
    }

    return (
      <div className="bp-page">
        <h1 className="bp-page-title mb-8">Settings</h1>

        <div
          className={`grid gap-6 mb-8 ${canCustomizeBranding(user) ? 'grid-cols-2' : 'grid-cols-1'
            }`}
        >
          <button
            onClick={() => setActiveSettingsView('account')}
            className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 shadow-sm elevated-card"
          >
            <SettingsIcon className="w-10 h-10 text-primary" />
            <span className="bp-overline">Account</span>
          </button>

          <button
            onClick={() => setActiveSettingsView('team')}
            className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 shadow-sm elevated-card"
          >
            <UsersIcon className="w-10 h-10 text-primary" />
            <span className="bp-overline">Team Access</span>
          </button>

          <button
            onClick={() => setActiveSettingsView('memberships')}
            className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 shadow-sm elevated-card"
          >
            <CheckCircleIcon className="w-10 h-10 text-primary" />
            <span className="bp-overline">Memberships</span>
          </button>

          {canCustomizeBranding(user) && (
            <button
              onClick={() => setActiveSettingsView('branding')}
              className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 shadow-sm elevated-card"
            >
              <GlobeIcon className="w-10 h-10 text-primary" />
              <span className="bp-overline">Branding</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPlans = () => (
    <div className="bp-page">
      <div className="flex items-center justify-between mb-8">
        <h1 className="bp-page-title">Plans</h1>
        <button
          onClick={() => setIsCreatingPlan(true)}
          data-ui="button"
          className="bp-btn-primary px-8 py-3 text-sm active:scale-95 transition-transform shadow-sm"
        >
          + NEW PLAN
        </button>
      </div>

      <div className="space-y-4">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card border border-border bp-container-list shadow-sm">
            <p className="bp-section-title mb-2">No plans yet</p>
            <p className="bp-overline">Create your first plan to get started</p>
          </div>
        ) : (
          plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setEditingPlan(plan)}
              className="w-full text-left bp-card-padding-md bg-card border border-border bp-container-list shadow-sm elevated-card active:scale-95 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="bp-card-title">
                  {plan.client?.name || 'Unnamed Client'}
                </h3>

                <span
                  className={`bp-overline px-3 py-1.5 rounded-full ${statusPillClasses(
                    plan.status
                  )}`}
                >
                  {plan.status}
                </span>
              </div>

              <p className="text-lg font-bold mb-2 text-foreground">
                ${plan.totalCost?.toLocaleString() || '0'}
              </p>

              <p className="bp-body-sm">
                {(plan as any).description || (plan as any).summary || 'No description'}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderActiveTab = () => {
    // If creating or editing a plan, show the plan wizard flow (your existing component)
    if (isCreatingPlan || editingPlan !== null) {
      return (
        <StylistDashboard
          role="admin"
          onLogout={() => { }}
          client={editingPlan?.client}
          existingPlan={editingPlan || undefined}
          onPlanChange={(plan) => {
            // StylistDashboard gives you either a plan or null/undefined when exiting
            setEditingPlan((plan as any) ?? null);
            if (!plan) {
              setIsCreatingPlan(false);
              setActiveTab('plans');
            }
          }}
          initialStep={isCreatingPlan ? 'select-client' : editingPlan ? 'summary' : undefined}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'plans':
        return renderPlans();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setEditingPlan(null);
    if (tab === 'settings') setActiveSettingsView('menu');
  };

  return (
    <div className="flex flex-col h-full bg-background pb-24">
      {renderActiveTab()}
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </div>
  );
}