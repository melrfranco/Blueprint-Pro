import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { Toggle } from './Toggle';
import type { Stylist, StylistLevel } from '../types';

interface TeamAccessSettingsProps {
  onBack: () => void;
}

export default function TeamAccessSettings({ onBack }: TeamAccessSettingsProps) {
  const { levels, updateLevels, stylists, updateStylists, saveAll } = useSettings();
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLevelId, setInviteLevelId] = useState('lvl_1');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [stylistSaveLoading, setStylistSaveLoading] = useState(false);
  const [stylistSaveError, setStylistSaveError] = useState<string | null>(null);

  const fallbackPermissions = levels[0]?.defaultPermissions || {
    canBookAppointments: true,
    canOfferDiscounts: false,
    requiresDiscountApproval: true,
    viewGlobalReports: false,
    viewClientContact: true,
    viewAllSalonPlans: false,
    can_book_own_schedule: true,
    can_book_peer_schedules: false,
  };

  const resolveLevelDefaults = (levelId: string) => {
    return levels.find(level => level.id === levelId)?.defaultPermissions || fallbackPermissions;
  };

  const levelPermissionKeys = Object.keys(fallbackPermissions) as (keyof typeof fallbackPermissions)[];

  const handleLevelUpdate = (levelId: string, updates: Partial<StylistLevel>) => {
    updateLevels(levels.map(level => (level.id === levelId ? { ...level, ...updates } : level)));
  };

  const handleLevelPermissionToggle = (levelId: string, permissionKey: keyof typeof fallbackPermissions) => {
    updateLevels(
      levels.map(level => {
        if (level.id !== levelId) return level;
        return {
          ...level,
          defaultPermissions: {
            ...level.defaultPermissions,
            [permissionKey]: !level.defaultPermissions[permissionKey],
          },
        };
      })
    );
  };

  const handleAddLevel = () => {
    const nextLevel: StylistLevel = {
      id: `lvl_${Date.now()}`,
      name: 'New Tier',
      color: '#0B3559',
      order: levels.length + 1,
      defaultPermissions: fallbackPermissions,
    };
    updateLevels([...levels, nextLevel]);
  };

  const handleInviteStylist = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    setInviteStatus(null);

    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Enter a name and email for the stylist.');
      return;
    }

    if (!supabase) {
      setInviteError('Supabase is not configured.');
      return;
    }

    setInviteLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Please log in again to send invites.');
      }

      const response = await fetch('/api/stylists/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          levelId: inviteLevelId || levels[0]?.id || 'lvl_1',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to send invite.');
      }

      if (data?.stylist) {
        const nextStylists = stylists.some(s => s.id === data.stylist.id)
          ? stylists.map(s => (s.id === data.stylist.id ? data.stylist : s))
          : [...stylists, data.stylist];
        updateStylists(nextStylists);
      }

      setInviteStatus('Invite sent.');
      setInviteName('');
      setInviteEmail('');
      setInviteLevelId(levels[0]?.id || 'lvl_1');
      setShowInviteForm(false);
    } catch (e: any) {
      setInviteError(e.message || 'Failed to send invite.');
    } finally {
      setInviteLoading(false);
    }
  };

  const persistStylistUpdates = async (stylist: Stylist) => {
    if (!supabase) {
      setStylistSaveError('Supabase is not configured.');
      return;
    }

    setStylistSaveLoading(true);
    setStylistSaveError(null);

    try {
      const { error } = await supabase
        .from('square_team_members')
        .update({
          level_id: stylist.levelId,
          permissions: stylist.permissionOverrides || {},
        })
        .eq('square_team_member_id', stylist.id);

      if (error) {
        throw new Error(error.message || 'Failed to update stylist');
      }

      updateStylists(stylists.map(s => (s.id === stylist.id ? stylist : s)));
      setEditingStylist(null);
    } catch (e: any) {
      setStylistSaveError(e.message || 'Failed to save stylist changes.');
    } finally {
      setStylistSaveLoading(false);
    }
  };

  const renderStylists = () => (
    <div className="space-y-4 pb-8">
      {stylists.length === 0 ? (
        <div className="p-4 text-center text-sm font-bold rounded-2xl border-2 border-dashed text-steel bg-surface-subtle border-surface-border">
          No stylists on your team yet. Invite one to get started.
        </div>
      ) : (
        stylists.map((stylist) => {
          const isEditing = editingStylist?.id === stylist.id;
          const levelColor = levels.find(l => l.id === stylist.levelId)?.color || '#0B3559';

          return (
            <div key={stylist.id} className="rounded-2xl border-2 border-surface-muted p-4 bg-surface">
              {isEditing ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Level</label>
                      <select
                        data-ui="field"
                        value={stylist.levelId || ''}
                        onChange={(e) => {
                          const newStylist = { ...stylist, levelId: e.target.value };
                          setEditingStylist(newStylist);
                        }}
                        className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                      >
                        {levels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-steel">Custom permissions</p>
                      <div className="space-y-2">
                        {levelPermissionKeys.map((permKey) => {
                          const levelPerms = resolveLevelDefaults(stylist.levelId || '');
                          const levelDefault = levelPerms[permKey];
                          const stylistOverride = stylist.permissionOverrides?.[permKey];
                          const currentValue = stylistOverride !== undefined ? stylistOverride : levelDefault;

                          return (
                            <div key={permKey} className="flex items-center justify-between">
                              <label className="text-xs font-bold capitalize text-steel">
                                {permKey.replace(/([A-Z])/g, ' $1').trim()}
                              </label>
                              <Toggle
                                checked={currentValue}
                                onCheckedChange={(checked) => {
                                  const newStylist = {
                                    ...stylist,
                                    permissionOverrides: {
                                      ...stylist.permissionOverrides,
                                      [permKey]: checked,
                                    },
                                  };
                                  setEditingStylist(newStylist);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {stylistSaveError && (
                      <p className="text-xs text-red-600 font-bold">{stylistSaveError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        data-ui="button"
                        onClick={() => persistStylistUpdates(editingStylist!)}
                        disabled={stylistSaveLoading}
                        className="flex-1 px-4 py-3 font-black rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50 bp-btn-primary"
                      >
                        {stylistSaveLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        data-ui="button"
                        onClick={() => setEditingStylist(null)}
                        className="flex-1 px-4 py-3 font-black rounded-2xl text-xs uppercase tracking-widest bp-btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-black text-sm text-navy">{stylist.name}</p>
                      <p className="text-xs font-bold text-steel">{stylist.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-full text-xs font-black text-surface-subtle" style={{ backgroundColor: levelColor }}>
                        {levels.find(l => l.id === stylist.levelId)?.name || 'Unknown'}
                      </div>
                      <button
                        data-ui="button"
                        onClick={() => setEditingStylist(stylist)}
                        className="p-2 rounded-lg transition-colors hover:opacity-70 text-steel"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {stylist.permissionOverrides && Object.keys(stylist.permissionOverrides).length > 0 && (
                    <p className="text-[9px] font-bold text-frost">
                      {Object.keys(stylist.permissionOverrides).length} custom permission(s)
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderLevels = () => (
    <div className="space-y-4 pb-8">
      {levels.length === 0 ? (
        <div className="p-4 text-center text-sm font-bold rounded-2xl border-2 border-dashed text-steel bg-surface-subtle border-surface-border">
          No access levels yet. Create one to set up team permissions.
        </div>
      ) : (
        levels.map((level) => (
          <div key={level.id} className="rounded-2xl border-2 border-surface-muted p-4 bg-surface space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Level name</label>
                <input
                  data-ui="field"
                  type="text"
                  value={level.name}
                  onChange={(e) => handleLevelUpdate(level.id, { name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Color</label>
                <input
                  data-ui="field"
                  type="color"
                  value={level.color}
                  onChange={(e) => handleLevelUpdate(level.id, { color: e.target.value })}
                  className="w-full h-12 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-steel">Default permissions</p>
              <div className="space-y-2">
                {levelPermissionKeys.map((permKey) => (
                  <div key={permKey} className="flex items-center justify-between">
                    <label className="text-xs font-bold capitalize text-steel">
                      {permKey.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <Toggle
                      checked={level.defaultPermissions[permKey]}
                      onCheckedChange={() => handleLevelPermissionToggle(level.id, permKey)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="bp-page">
      <button data-ui="button" onClick={onBack} className="mb-6 flex items-center text-xs font-black uppercase hover:opacity-80 transition-colors bp-back">
        <ChevronLeftIcon className="w-4 h-4 mr-1" />
        Back
      </button>

      <h2 className="text-4xl font-black mb-8 text-navy">Team Access</h2>

      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-steel">Access Levels</p>
              <p className="text-sm font-black text-navy">Define permission tiers for team members.</p>
            </div>
            <button data-ui="button" onClick={handleAddLevel} className="px-4 py-2 font-black rounded-2xl text-xs uppercase tracking-widest bp-btn-primary">
              Add level
            </button>
          </div>
          {renderLevels()}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-steel">Team Members</p>
              <p className="text-sm font-black text-navy">Invite and manage your team.</p>
            </div>
            <button data-ui="button" onClick={() => setShowInviteForm(!showInviteForm)} className="px-4 py-2 font-black rounded-2xl text-xs uppercase tracking-widest bp-btn-primary">
              {showInviteForm ? 'Cancel' : 'Invite'}
            </button>
          </div>

          {showInviteForm && (
            <form onSubmit={handleInviteStylist} className="mb-4 p-4 bg-surface border-2 border-surface-muted rounded-2xl space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Name</label>
                <input
                  data-ui="field"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Email</label>
                <input
                  data-ui="field"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Access Level</label>
                <select
                  data-ui="field"
                  value={inviteLevelId}
                  onChange={(e) => setInviteLevelId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                >
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && <p className="text-xs text-red-600 font-bold">{inviteError}</p>}
              {inviteStatus && <p className="text-xs text-green-600 font-bold">{inviteStatus}</p>}

              <button data-ui="button" type="submit" disabled={inviteLoading} className="w-full px-4 py-3 font-black rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50 bp-btn-primary">
                {inviteLoading ? 'Sending...' : 'Send invite'}
              </button>
            </form>
          )}

          {renderStylists()}
        </div>

        <button data-ui="button" onClick={saveAll} className="w-full py-4 font-black rounded-2xl bp-btn-primary">
          SAVE ALL SETTINGS
        </button>
      </div>
    </div>
  );
}
