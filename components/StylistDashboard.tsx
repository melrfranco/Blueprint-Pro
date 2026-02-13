import React, { useState, useMemo } from 'react';
import BottomNav, { Tab } from './BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { CalendarIcon, SettingsIcon, ChevronRightIcon } from './icons';
import AccountSettings from './AccountSettings';
import PlanWizard from './PlanWizard';
import type { GeneratedPlan } from '../types';

export default function StylistDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [editingPlan, setEditingPlan] = useState<GeneratedPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const { user, logout } = useAuth();
  const { services: allServices } = useSettings();
  const { plans, bookings } = usePlans();

  const stylistId = user?.stylistData?.id || user?.id;
  const permissions = user?.stylistData?.permissions;

  // Filter plans assigned to this stylist
  const myPlans = useMemo(() => {
    if (!stylistId) return plans;
    return plans.filter(p => p.stylistId === stylistId || p.stylistName === user?.name);
  }, [plans, stylistId, user?.name]);

  // Upcoming appointments across all my plans
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return myPlans
      .flatMap(plan =>
        plan.appointments
          .filter(a => a.date >= now)
          .map(a => ({ ...a, clientName: plan.client?.name || 'Client', planId: plan.id }))
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [myPlans]);

  // My bookings
  const myBookings = useMemo(() => {
    if (!stylistId) return bookings;
    return bookings.filter(b => b.stylist_id === String(stylistId));
  }, [bookings, stylistId]);

  // Stats
  const activePlans = myPlans.filter(p => p.status === 'active').length;
  const totalClients = new Set(myPlans.map(p => p.client?.name)).size;
  const totalRevenue = myPlans.reduce((sum, p) => sum + (p.totalCost || 0), 0);

  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

  const renderDashboard = () => (
    <div className="bp-page">
      <h1 className="bp-page-title mb-1">My Dashboard</h1>
      <p className="bp-subtitle pl-4 mb-8">{user?.name || 'Stylist'}</p>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card p-4 bp-container-list border border-border shadow-sm text-center elevated-card">
          <p className="text-2xl bp-stat-value text-foreground">{activePlans}</p>
          <p className="bp-caption mt-1">Active Plans</p>
        </div>
        <div className="bg-card p-4 bp-container-list border border-border shadow-sm text-center elevated-card">
          <p className="text-2xl bp-stat-value text-foreground">{totalClients}</p>
          <p className="bp-caption mt-1">Clients</p>
        </div>
        <div className="bg-card p-4 bp-container-list border border-border shadow-sm text-center elevated-card">
          <p className="text-2xl bp-stat-value text-foreground">{formatCurrency(totalRevenue)}</p>
          <p className="bp-caption mt-1">Pipeline</p>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="mb-6">
        <h2 className="bp-section-title mb-4 pl-4">Upcoming Appointments</h2>
        {upcomingAppointments.length === 0 ? (
          <div className="bg-card p-6 bp-container-list border border-border shadow-sm text-center elevated-card">
            <p className="bp-body-sm text-muted-foreground">No upcoming appointments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appt, i) => (
              <div key={i} className="bg-card p-4 bp-container-list border border-border shadow-sm flex items-center justify-between elevated-card">
                <div>
                  <p className="font-bold text-sm text-foreground">{appt.clientName}</p>
                  <p className="bp-caption mt-0.5">
                    {appt.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="bp-caption">
                    {appt.services.map(s => s.name).join(', ')}
                  </p>
                </div>
                <CalendarIcon className="w-5 h-5 text-accent" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Plan Button */}
      <div className="mb-6">
        <button
          data-ui="button"
          onClick={() => setIsCreatingPlan(true)}
          className="w-full py-4 bp-btn-primary text-center font-bold"
        >
          + New Plan
        </button>
      </div>

      {/* Recent Plans */}
      <div>
        <h2 className="bp-section-title mb-4 pl-4">My Plans</h2>
        {myPlans.length === 0 ? (
          <div className="bg-card p-6 bp-container-list border border-border shadow-sm text-center elevated-card">
            <p className="bp-body-sm text-muted-foreground">No plans yet — create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPlans.slice(0, 5).map(plan => (
              <button
                key={plan.id}
                onClick={() => setEditingPlan(plan)}
                className="w-full text-left p-4 bg-card bp-container-list border border-border shadow-sm flex items-center justify-between active:scale-95 transition-all elevated-card"
              >
                <div>
                  <p className="font-bold text-sm text-foreground">{plan.client?.name || 'Client'}</p>
                  <p className="bp-caption mt-0.5">
                    {plan.appointments.length} visits &middot; {formatCurrency(plan.totalCost)}
                  </p>
                  <span className={`bp-caption px-2 py-0.5 rounded-full mt-1 inline-block ${plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {plan.status}
                  </span>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPlans = () => (
    <div className="bp-page">
      <h1 className="bp-page-title mb-8">My Plans</h1>

      <button
        data-ui="button"
        onClick={() => setIsCreatingPlan(true)}
        className="w-full py-4 bp-btn-primary text-center font-bold mb-6"
      >
        + New Plan
      </button>

      <div className="space-y-4">
        {myPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card border border-border bp-container-list shadow-sm">
            <p className="bp-section-title mb-2">No plans yet</p>
            <p className="bp-overline">Create your first plan above!</p>
          </div>
        ) : (
          myPlans.map(plan => (
            <button
              key={plan.id}
              onClick={() => setEditingPlan(plan)}
              className="w-full text-left bp-card-padding-md bg-card border border-border bp-container-list shadow-sm hover:shadow-md active:scale-95 transition-all elevated-card"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="bp-card-title">{plan.client?.name || 'Unnamed Client'}</h3>
                <span className={`bp-overline px-3 py-1.5 rounded-full ${plan.status === 'active' ? 'bg-green-100 text-green-700' : plan.status === 'draft' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {plan.status}
                </span>
              </div>
              <p className="text-lg font-bold mb-2 text-foreground">${plan.totalCost?.toLocaleString() || '0'}</p>
              <p className="bp-body-sm text-muted-foreground">{plan.appointments.length} upcoming visits</p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <AccountSettings user={user} onLogout={logout} subtitle="Team Member" role="stylist" />
  );

  const renderActiveTab = () => {
    if (isCreatingPlan || editingPlan) {
      return (
        <PlanWizard
          role="stylist"
          client={editingPlan?.client}
          existingPlan={editingPlan || undefined}
          onPlanChange={(plan) => {
            setEditingPlan(plan);
            if (!plan) {
              setIsCreatingPlan(false);
              setActiveTab('plans');
            }
          }}
          initialStep={isCreatingPlan ? 'select-client' : 'summary'}
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
    setIsCreatingPlan(false);
  };

  return (
    <div className="flex flex-col h-full bg-background pb-24">
      {renderActiveTab()}
      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </div>
  );
}
