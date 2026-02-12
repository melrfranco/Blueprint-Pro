import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabase';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { Toggle } from './Toggle';
import { SaveToast, useSaveToast } from './SaveToast';
import type { Stylist, StylistLevel } from '../types';

interface TeamAccessSettingsProps {
  onBack: () => void;
}

export default function TeamAccessSettings({ onBack }: TeamAccessSettingsProps) {
  const { levels, updateLevels, stylists, updateStylists, saveAll } = useSettings();
  const { toastVisible, showToast, hideToast } = useSaveToast();
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLevelId, setInviteLevelId] = useState('lvl_1');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [invitingStylistId, setInvitingStylistId] = useState<string | null>(null);
  const [invitedStylistIds, setInvitedStylistIds] = useState<Set<string>>(new Set());
  const [inviteLinkMap, setInviteLinkMap] = useState<Record<string, string>>({});
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
          squareTeamMemberId: stylists.find(s => s.email === inviteEmail.trim())?.id || undefined,
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

  const handleInviteExistingMember = async (stylist: Stylist) => {
    if (!stylist.email) {
      setInviteError('This team member has no email on file. Add their email in Square first.');
      setInvitingStylistId(stylist.id);
      return;
    }

    if (!supabase) return;

    setInvitingStylistId(stylist.id);
    setInviteLoading(true);
    setInviteError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Please log in again.');

      const response = await fetch('/api/stylists/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: stylist.name,
          email: stylist.email,
          levelId: stylist.levelId || levels[0]?.id || 'lvl_1',
          squareTeamMemberId: stylist.id,
        }),
      });

      const data = await response.json();
      console.log('[Invite] API response:', JSON.stringify(data, null, 2));
      if (!response.ok) throw new Error(data?.message || 'Failed to send invite.');

      setInvitedStylistIds(prev => new Set(prev).add(stylist.id));
      if (data?.inviteLink) {
        setInviteLinkMap(prev => ({ ...prev, [stylist.id]: data.inviteLink }));
      }
      if (data?.emailStatus === 'failed') {
        setInviteError(`Email failed: ${data.emailError || 'unknown error'}. Use the link below instead.`);
        setInvitingStylistId(stylist.id);
      } else {
        setInvitingStylistId(null);
      }
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
        <div className="p-4 text-center text-sm font-medium bp-container-list border-4 border-dashed text-foreground bg-muted border">
          No stylists on your team yet. Invite one to get started.
        </div>
      ) : (
        stylists.map((stylist) => {
          const isEditing = editingStylist?.id === stylist.id;
          const levelColor = levels.find(l => l.id === stylist.levelId)?.color || '#0B3559';

          return (
            <div key={stylist.id} className="bp-container-tall border-4 border bp-card-padding-md bg-card">
              {isEditing ? (
                <>
                  <div className="space-y-6">
                    <div>
                      <label className="block bp-overline mb-2">Level</label>
                      <select
                        data-ui="field"
                        value={stylist.levelId || ''}
                        onChange={(e) => {
                          const newStylist = { ...stylist, levelId: e.target.value };
                          setEditingStylist(newStylist);
                        }}
                        className="w-full px-4 py-3 border-2 border font-medium text-sm text-foreground focus:outline-none focus:border-sky"
                      >
                        {levels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      <p className="bp-overline text-center">Custom permissions</p>
                      <div className="space-y-3">
                        {levelPermissionKeys.map((permKey) => {
                          const levelPerms = resolveLevelDefaults(stylist.levelId || '');
                          const levelDefault = levelPerms[permKey];
                          const stylistOverride = stylist.permissionOverrides?.[permKey];
                          const currentValue = stylistOverride !== undefined ? stylistOverride : levelDefault;

                          return (
                            <div key={permKey} className="flex items-center justify-between bp-card-padding-sm bp-container-compact bg-muted border-2 border">
                              <label className="text-xs font-medium capitalize text-foreground flex-1">
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
                      <p className="text-xs text-red-600 font-medium text-center">{stylistSaveError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        data-ui="button"
                        onClick={() => persistStylistUpdates(editingStylist!)}
                        disabled={stylistSaveLoading}
                        className="flex-1 px-4 py-3 text-xs uppercase tracking-widest disabled:opacity-50 bp-btn-primary"
                      >
                        {stylistSaveLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        data-ui="button"
                        onClick={() => setEditingStylist(null)}
                        className="flex-1 px-4 py-3 text-xs uppercase tracking-widest bp-btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">{stylist.name}</p>
                      <p className="text-xs text-muted-foreground">{stylist.email || 'No email on file'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bp-container-compact text-xs font-bold text-primary-foreground" style={{ backgroundColor: levelColor }}>
                        {levels.find(l => l.id === stylist.levelId)?.name || 'Unknown'}
                      </div>
                      <button
                        data-ui="button"
                        onClick={() => setEditingStylist(stylist)}
                        className="p-2 transition-colors hover:opacity-70 text-foreground"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      {stylist.permissionOverrides && Object.keys(stylist.permissionOverrides).length > 0 && (
                        <p className="bp-caption">
                          {Object.keys(stylist.permissionOverrides).length} custom permission(s)
                        </p>
                      )}
                    </div>
                    {invitedStylistIds.has(stylist.id) ? (
                      <span className="bp-caption text-green-600 font-bold">Invited</span>
                    ) : (
                      <button
                        data-ui="button"
                        onClick={() => handleInviteExistingMember(stylist)}
                        disabled={inviteLoading && invitingStylistId === stylist.id}
                        className="px-4 py-1.5 text-xs uppercase tracking-widest bp-btn-primary disabled:opacity-50"
                      >
                        {inviteLoading && invitingStylistId === stylist.id ? 'Sending...' : 'Invite'}
                      </button>
                    )}
                  </div>
                  {inviteError && invitingStylistId === stylist.id && (
                    <p className="text-xs text-red-600 font-medium mt-2">{inviteError}</p>
                  )}
                  {inviteLinkMap[stylist.id] && (
                    <div className="mt-3 p-3 bg-muted bp-container-compact border border-border">
                      <p className="bp-caption mb-2">Share this link with {stylist.name.split(' ')[0]}:</p>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={inviteLinkMap[stylist.id]}
                          className="flex-1 text-xs px-3 py-2 bg-card border border-border bp-container-compact text-foreground truncate"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          data-ui="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLinkMap[stylist.id]);
                          }}
                          className="px-3 py-2 text-xs uppercase tracking-widest bp-btn-primary whitespace-nowrap"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
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
        <div className="p-4 text-center text-sm font-medium bp-container-list border-4 border-dashed text-foreground bg-muted border">
          No access levels yet. Create one to set up team permissions.
        </div>
      ) : (
        levels.map((level) => (
          <div key={level.id} className="bp-container-tall border-4 border bp-card-padding-md bg-card space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block bp-overline mb-2">Level name</label>
                <input
                  data-ui="field"
                  type="text"
                  value={level.name}
                  onChange={(e) => handleLevelUpdate(level.id, { name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border font-medium text-sm text-foreground focus:outline-none focus:border-sky"
                />
              </div>
              <div>
                <label className="block bp-overline mb-2">Color</label>
                <input
                  data-ui="field"
                  type="color"
                  value={level.color}
                  onChange={(e) => handleLevelUpdate(level.id, { color: e.target.value })}
                  className="w-full h-12 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="bp-overline text-center">Default permissions</p>
              <div className="space-y-3">
                {levelPermissionKeys.map((permKey) => (
                  <div key={permKey} className="flex items-center justify-between bp-card-padding-sm bp-container-compact bg-muted border-2 border">
                    <label className="text-xs font-medium capitalize text-muted-foreground flex-1">
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
      <button data-ui="button" onClick={onBack} className="mb-6 flex items-center text-sm font-semibold hover:opacity-80 transition-colors bp-back">
        <ChevronLeftIcon className="w-4 h-4 mr-1" />
        Back
      </button>

      <h2 className="bp-page-subtitle mb-8">Team Access</h2>

      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="bp-overline">Access Levels</p>
              <p className="bp-body text-foreground">Define permission tiers for team members.</p>
            </div>
            <button data-ui="button" onClick={handleAddLevel} className="px-4 py-2 text-xs uppercase tracking-widest bp-btn-primary">
              Add level
            </button>
          </div>
          {renderLevels()}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="bp-overline">Team Members</p>
              <p className="bp-body text-foreground">Synced from Square. Invite members to give them app access.</p>
            </div>
          </div>

          {renderStylists()}
        </div>

        <button data-ui="button" onClick={() => saveAll().then(showToast)} className="w-full py-4 bp-btn-primary">
          SAVE ALL SETTINGS
        </button>
        <SaveToast visible={toastVisible} onDone={hideToast} />
      </div>
    </div>
  );
}
