import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BottomNav, { Tab } from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import {
    CheckCircleIcon,
    GlobeIcon,
    SettingsIcon,
    ChevronLeftIcon
} from './icons';
import type { UserRole, GeneratedPlan } from '../types';
import { GOOGLE_FONTS_LIST } from '../data/fonts';
import AccountSettings from './AccountSettings';
import PlanWizard from './PlanWizard';
import MembershipSetup from './MembershipSetup';
import TeamAccessSettings from './TeamAccessSettings';
import { canCustomizeBranding } from '../utils/isEnterpriseAccount';

export default function AdminDashboardV2({ role }: { role: UserRole }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [activeSettingsView, setActiveSettingsView] = useState<'menu' | 'branding' | 'account' | 'memberships' | 'teamAccess'>('menu');
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const {
    branding, updateBranding,
    clients,
    saveAll
  } = useSettings();
  const { plans, getStats } = usePlans();
  const { user, logout } = useAuth();

  const stats = getStats();
  const totalPipeline = plans.filter(p => p.status === 'active' || p.status === 'draft').reduce((sum, p) => sum + p.totalCost, 0);

  const pipelineGrowthData = useMemo(() => {
    const sortedPlans = [...plans].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let cumulativeValue = 0;
    const dataMap = new Map<string, number>();
    sortedPlans.forEach(plan => {
      const month = new Date(plan.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      cumulativeValue += plan.totalCost;
      dataMap.set(month, cumulativeValue);
    });
    const lastSixMonths = [];
    const today = new Date();
    for(let i=5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      lastSixMonths.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
    }
    let lastValue = 0;
    return lastSixMonths.map(month => {
      if(dataMap.has(month)) lastValue = dataMap.get(month)!;
      return { name: month, value: lastValue };
    });
  }, [plans]);

  const renderDashboard = () => (
    <div className="bp-page">
      <h1 className="text-4xl font-black tracking-tighter mb-8 text-navy">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="col-span-2 p-8 rounded-[32px] border-4 shadow-lg hover:shadow-xl transition-shadow bg-navy border-navy">
          <p className="text-sm font-black uppercase mb-2 tracking-widest text-frost">Roadmap Pipeline</p>
          <p className="text-6xl font-black text-sky">${totalPipeline.toLocaleString()}</p>
        </div>
        <div className="bg-surface p-6 rounded-3xl border-4 border-surface-muted shadow-sm hover:shadow-md transition-all elevated-card">
          <p className="text-[10px] font-black uppercase mb-3 tracking-widest text-steel">Active Plans</p>
          <p className="text-5xl font-black text-navy">{stats.activePlansCount}</p>
        </div>
        <div className="bg-surface p-6 rounded-3xl border-4 border-surface-muted shadow-sm hover:shadow-md transition-all elevated-card">
          <p className="text-[10px] font-black uppercase mb-3 tracking-widest text-steel">Total Clients</p>
          <p className="text-5xl font-black text-navy">{clients.length}</p>
        </div>
      </div>
      <div className="bg-surface p-7 rounded-3xl border-4 border-surface-muted shadow-sm hover:shadow-md transition-shadow mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest mb-4 text-navy">Pipeline Growth</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pipelineGrowthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="bp-chart-grid" />
              <XAxis dataKey="name" tick={{fontSize: 10, fill: 'var(--blueprint-steel)'}} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `$${val/1000}k`} tick={{fontSize: 10, fill: 'var(--blueprint-steel)'}} axisLine={false} tickLine={false} />
              <Area type="monotone" dataKey="value" stroke="var(--blueprint-steel)" fill="var(--blueprint-steel)" fillOpacity={0.1} strokeWidth={3} />
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
          <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-xs font-black uppercase hover:opacity-80 transition-colors bp-back"><ChevronLeftIcon className="w-4 h-4 mr-1"/> Back</button>
          <h2 className="text-4xl font-black mb-8 text-navy">Branding</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase mb-2 text-steel">Salon Name</label>
              <input type="text" value={branding.salonName} onChange={e => updateBranding({...branding, salonName: e.target.value})} className="w-full p-4 border-4 rounded-2xl font-black outline-none border-surface-muted text-navy focus:border-sky"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase mb-2 text-steel">Primary Color</label>
                <input type="color" value={branding.primaryColor} onChange={e => updateBranding({...branding, primaryColor: e.target.value})} className="w-full h-12 rounded-xl cursor-pointer"/>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase mb-2 text-steel">Accent Color</label>
                <input type="color" value={branding.accentColor} onChange={e => updateBranding({...branding, accentColor: e.target.value})} className="w-full h-12 rounded-xl cursor-pointer"/>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase mb-2 text-steel">Font</label>
              <select value={branding.font} onChange={e => updateBranding({...branding, font: e.target.value})} className="w-full p-4 border-4 rounded-2xl font-black outline-none border-surface-muted text-navy">
                {GOOGLE_FONTS_LIST.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <button onClick={() => { saveAll(); setActiveSettingsView('menu'); }} className="w-full py-4 font-black rounded-2xl bp-btn-primary">SAVE CHANGES</button>
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'account') {
      return (
        <div className="bp-page">
          <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-xs font-black uppercase hover:opacity-80 transition-colors bp-back"><ChevronLeftIcon className="w-4 h-4 mr-1"/> Back</button>
          <AccountSettings user={user} onLogout={logout} subtitle="System Controller" />
        </div>
      );
    }

    if (activeSettingsView === 'memberships') {
      return <MembershipSetup onBack={() => setActiveSettingsView('menu')} />;
    }

    if (activeSettingsView === 'teamAccess') {
      return <TeamAccessSettings onBack={() => setActiveSettingsView('menu')} />;
    }

    return (
      <div className="bp-page">
        <h1 className="text-4xl font-black tracking-tighter mb-8 text-navy">Settings</h1>
        <div className={`grid gap-6 mb-8 ${canCustomizeBranding(user) ? 'grid-cols-2' : 'grid-cols-2'}`}>
          <button onClick={() => setActiveSettingsView('account')} className="p-8 bg-surface border-4 border-surface-muted rounded-3xl flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card">
            <SettingsIcon className="w-10 h-10 text-navy"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-steel">Account</span>
          </button>
          <button onClick={() => setActiveSettingsView('teamAccess')} className="p-8 bg-surface border-4 border-surface-muted rounded-3xl flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card">
            <CheckCircleIcon className="w-10 h-10 text-navy"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-steel">Team Access</span>
          </button>
          <button onClick={() => setActiveSettingsView('memberships')} className="p-8 bg-surface border-4 border-surface-muted rounded-3xl flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card">
            <CheckCircleIcon className="w-10 h-10 text-navy"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-steel">Memberships</span>
          </button>
          {canCustomizeBranding(user) && (
            <button onClick={() => setActiveSettingsView('branding')} className="p-8 bg-surface border-4 border-surface-muted rounded-3xl flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card">
              <GlobeIcon className="w-10 h-10 text-navy"/>
              <span className="text-[10px] font-black uppercase tracking-widest text-steel">Branding</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPlans = () => (
    <div className="bp-page">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-black tracking-tighter text-navy">Plans</h1>
        <button onClick={() => setIsCreatingPlan(true)} className="px-8 py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform shadow-lg hover:shadow-xl bp-btn-secondary">+ NEW PLAN</button>
      </div>
      <div className="space-y-4">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border-4 border-surface-muted rounded-3xl shadow-sm">
            <p className="font-black text-lg mb-2 text-navy">No plans yet</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-steel">Create your first plan to get started</p>
          </div>
        ) : (
          plans.map(plan => (
            <button
              key={plan.id}
              onClick={() => setEditingPlan(plan)}
              className="w-full text-left p-6 bg-surface border-4 border-surface-muted rounded-3xl shadow-sm hover:shadow-md active:scale-95 transition-all elevated-card"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-xl text-navy">{plan.client?.name || 'Unnamed Client'}</h3>
                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${plan.status === 'active' ? 'bg-green-100 text-green-700' : plan.status === 'draft' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {plan.status}
                </span>
              </div>
              <p className="text-lg font-black mb-2 text-navy">${plan.totalCost?.toLocaleString() || '0'}</p>
              <p className="text-sm font-bold text-steel">{plan.description || 'No description'}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderActiveTab = () => {
    // If creating or editing a plan, show the plan wizard
    if (isCreatingPlan || editingPlan !== null) {
      return (
        <PlanWizard
          role="admin"
          onLogout={() => {}}
          client={editingPlan?.client}
          existingPlan={editingPlan || undefined}
          onPlanChange={(plan) => {
            setEditingPlan(plan);
            if (!plan) {
              setIsCreatingPlan(false);
              setActiveTab('plans');
            }
          }}
          initialStep={isCreatingPlan ? 'select-client' : (editingPlan ? 'summary' : undefined)}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'plans': return renderPlans();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setEditingPlan(null);
    if (tab === 'settings') {
      setActiveSettingsView('menu');
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-bg pb-24">
      {renderActiveTab()}
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </div>
  );
}
