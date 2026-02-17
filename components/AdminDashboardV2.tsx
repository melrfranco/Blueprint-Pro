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
  ChevronLeftIcon,
  SunIcon,
  UsersIcon
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
  const [activeSettingsView, setActiveSettingsView] = useState<'menu' | 'branding' | 'account' | 'memberships' | 'teamAccess' | 'appearance'>('menu');
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const {
    branding, updateBranding,
    clients,
    textSize, updateTextSize,
    saveAll
  } = useSettings();
  const { toastVisible, showToast, hideToast } = useSaveToast();
  const { plans, getStats } = usePlans();
  const { user, updateUser, logout } = useAuth();

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
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      lastSixMonths.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
    }
    let lastValue = 0;
    return lastSixMonths.map(month => {
      if (dataMap.has(month)) lastValue = dataMap.get(month)!;
      return { name: month, value: lastValue };
    });
  }, [plans]);

  const renderDashboard = () => (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
        <div className="px-5 py-4">
          <h1 className="bp-page-title mb-1 text-foreground">Dashboard</h1>
          {user?.name && <p className="bp-subtitle pl-4 text-foreground">Welcome back, {user.name.split(' ')[0]}</p>}
        </div>
      </div>
      <div className="bp-page bp-plans-page">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="col-span-2 p-8 bg-card text-foreground border border-border bp-container-list">
            <div className="flex flex-col items-center justify-center text-center h-full py-4">
              <p className="bp-section-title mb-3">Roadmap Pipeline</p>
              <p className="text-5xl bp-stat-value">${totalPipeline.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-card p-6 bp-container-list border border-border shadow-sm hover:shadow-md transition-all elevated-card">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="bp-overline mb-3">Active Plans</p>
              <p className="text-4xl bp-stat-value">{stats.activePlansCount}</p>
            </div>
          </div>
          <div className="bg-card p-6 bp-container-list border border-border shadow-sm hover:shadow-md transition-all elevated-card">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="bp-overline mb-3">Total Clients</p>
              <p className="text-4xl bp-stat-value">{clients.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card p-7 bp-container-tall border border-border shadow-sm hover:shadow-md transition-shadow mb-6">
          <h3 className="bp-section-title mb-4">Pipeline Growth</h3>
          <div className="w-full h-56 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pipelineGrowthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => {
    if (activeSettingsView === 'branding') {
      return (
        <div className="flex flex-col h-full">
          <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
            <div className="px-5 py-4">
              <h2 className="bp-page-subtitle m-0">Branding</h2>
            </div>
          </div>
          <div className="bp-page">
            <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <div className="space-y-6">
              <div>
                <label className="block bp-overline mb-2">Salon Name</label>
                <input type="text" value={branding.salonName} onChange={e => updateBranding({ ...branding, salonName: e.target.value })} className="w-full p-4 border-4 rounded-full font-semibold outline-none border text-foreground focus:border-sky" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block bp-overline mb-2">Primary Color</label>
                  <input type="color" value={branding.primaryColor} onChange={e => updateBranding({ ...branding, primaryColor: e.target.value })} className="w-full h-12 rounded-full cursor-pointer" />
                </div>
                <div>
                  <label className="block bp-overline mb-2">Accent Color</label>
                  <input type="color" value={branding.accentColor} onChange={e => updateBranding({ ...branding, accentColor: e.target.value })} className="w-full h-12 rounded-full cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block bp-overline mb-2">Font</label>
                <select value={branding.font} onChange={e => updateBranding({ ...branding, font: e.target.value })} className="w-full p-4 border-4 rounded-full font-semibold outline-none border text-foreground">
                  {GOOGLE_FONTS_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <button onClick={() => { saveAll().then(showToast); }} className="w-full py-4 rounded-full bp-btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent">SAVE CHANGES</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'account') {
      return (
        <div className="flex flex-col h-full">
          <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
            <div className="px-5 py-4">
              <h2 className="bp-page-subtitle m-0">Account</h2>
            </div>
          </div>
          <div className="bp-page">
            <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <AccountSettings user={user} onLogout={logout} subtitle="System Controller" />
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'memberships') {
      return (
        <div className="flex flex-col h-full">
          <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
            <div className="px-5 py-4">
              <h2 className="bp-page-subtitle m-0">Memberships</h2>
            </div>
          </div>
          <div className="bp-page">
            <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <MembershipSetup onBack={() => setActiveSettingsView('menu')} />
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'teamAccess') {
      return (
        <div className="flex flex-col h-full">
          <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
            <div className="px-5 py-4">
              <h2 className="bp-page-subtitle m-0">Team Access</h2>
            </div>
          </div>
          <div className="bp-page">
            <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <TeamAccessSettings onBack={() => setActiveSettingsView('menu')} />
          </div>
        </div>
      );
    }

    if (activeSettingsView === 'appearance') {
      const MAX_AVATAR_SIZE = 500 * 1024;

      const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (file.size > MAX_AVATAR_SIZE) {
          alert('Image is too large. Please choose an image under 500 KB.');
          e.target.value = '';
          return;
        }

        try {
          const { supabase } = await import('../lib/supabase');
          if (!supabase) return;

          const ext = file.name.split('.').pop();
          const path = `avatars/${user.id}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true });

          if (uploadError) {
            console.warn('[Avatar] Upload failed:', uploadError.message);
            return;
          }

          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(path);

          if (urlData?.publicUrl) {
            updateUser({ avatarUrl: urlData.publicUrl });
          }
        } catch (err) {
          console.warn('[Avatar] Storage upload failed:', err);
        }
      };

      return (
        <div className="flex flex-col h-full">
          <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
            <div className="px-5 py-4">
              <h2 className="bp-page-subtitle m-0">Appearance</h2>
            </div>
          </div>
          <div className="bp-page">
            <button onClick={() => setActiveSettingsView('menu')} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <div className="space-y-6">
              <div className="bg-card p-8 bp-container-list border border-border shadow-sm text-center">
                <input type="file" accept="image/*" id="avatar-upload" className="hidden" onChange={handleAvatarChange} />
                <label htmlFor="avatar-upload" className="cursor-pointer block">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-24 h-24 bp-container-tall mx-auto mb-4 border-4 border-primary shadow-lg object-cover hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="w-24 h-24 bp-container-tall mx-auto mb-4 flex items-center justify-center text-4xl font-bold shadow-xl border-4 bg-primary text-primary-foreground border-primary hover:opacity-80 transition-opacity">{user?.name?.[0]}</div>
                  )}
                  <span className="bp-overline text-accent">Change Profile Photo</span>
                </label>
              </div>

              <div className="bg-card p-6 bp-container-tall border border-border shadow-sm space-y-6">
                <div>
                  <h3 className="bp-overline mb-4">Theme</h3>
                  <ThemeToggle />
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="bp-overline mb-4">Text Size</h3>
                  <div className="flex p-1 rounded-full bg-muted w-fit">
                    {(['S', 'M', 'L'] as const).map(sz => (
                      <button
                        data-ui="button"
                        key={sz}
                        onClick={() => {
                          updateTextSize(sz);
                          saveAll().then(showToast);
                        }}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-accent ${sz === textSize ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border">
          <div className="px-5 py-4">
            <h1 className="bp-page-title m-0">Settings</h1>
          </div>
        </div>
        <div className="bp-page">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <button onClick={() => setActiveSettingsView('account')} className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card focus:outline-none focus:ring-2 focus:ring-accent">
              <SettingsIcon className="w-10 h-10 text-primary" />
              <span className="bp-overline">Account</span>
            </button>
            <button onClick={() => setActiveSettingsView('appearance')} className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card focus:outline-none focus:ring-2 focus:ring-accent">
              <SunIcon className="w-10 h-10 text-primary" />
              <span className="bp-overline">Appearance</span>
            </button>
            <button onClick={() => setActiveSettingsView('teamAccess')} className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card focus:outline-none focus:ring-2 focus:ring-accent">
              <UsersIcon className="w-10 h-10 text-primary" />
              <span className="bp-overline">Team Access</span>
            </button>
            <button onClick={() => setActiveSettingsView('memberships')} className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card focus:outline-none focus:ring-2 focus:ring-accent">
              <CheckCircleIcon className="w-10 h-10 text-primary" />
              <span className="bp-overline">Memberships</span>
            </button>
            {canCustomizeBranding(user) && (
              <button onClick={() => setActiveSettingsView('branding')} className="p-8 bg-card border border-border bp-container-list flex flex-col items-center justify-center space-y-3 hover:shadow-md transition-all shadow-sm elevated-card focus:outline-none focus:ring-2 focus:ring-accent">
                <GlobeIcon className="w-10 h-10 text-primary" />
                <span className="bp-overline">Branding</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };


  const renderPlans = () => (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: '#0f1c2b' }} className="border-b border-border relative z-10">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <h1 className="bp-page-title m-0">Plans</h1>
          <button onClick={() => setIsCreatingPlan(true)} aria-label="Create a new plan" style={{ backgroundColor: '#7ba4c2', color: '#0f1c2b' }} className="px-8 py-3 rounded-full text-sm font-bold active:scale-95 transition-transform shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent whitespace-nowrap flex-shrink-0">+ NEW PLAN</button>
        </div>
      </div>
      <div className="bp-page bp-plans-page">
        <div className="space-y-4">
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card border border-border bp-container-list shadow-sm">
              <p className="bp-section-title mb-2">No plans yet</p>
              <p className="bp-overline">Create your first plan to get started</p>
            </div>
          ) : (
            plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setEditingPlan(plan)}
                className="w-full text-left bp-card-padding-md bg-card border border-border bp-container-list shadow-sm hover:shadow-md active:scale-95 transition-all elevated-card focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="bp-card-title">{plan.client?.name || 'Unnamed Client'}</h3>
                  <span className={`bp-overline px-3 py-1.5 rounded-full ${plan.status === 'active' ? 'bg-green-100 text-green-700' : plan.status === 'draft' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {plan.status}
                  </span>
                </div>
                <p className="text-lg font-bold mb-2 text-foreground">${plan.totalCost?.toLocaleString() || '0'}</p>
                <p className="bp-body-sm">{(plan as any).description || 'No description'}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    if (isCreatingPlan || editingPlan !== null) {
      return (
        <PlanWizard
          role="admin"
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
    <div className="flex flex-col h-full bg-background pb-24">
      {renderActiveTab()}
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
      <SaveToast visible={toastVisible} onDone={hideToast} />
    </div>
  );
}