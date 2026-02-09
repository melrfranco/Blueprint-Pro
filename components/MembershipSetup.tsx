import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Toggle } from './Toggle';
import { ChevronLeftIcon } from './icons';
import type { MembershipTier } from '../types';

interface MembershipSetupProps {
  onBack: () => void;
}

export default function MembershipSetup({ onBack }: MembershipSetupProps) {
  const { membershipConfig, updateMembershipConfig, saveAll } = useSettings();
  const [perkDrafts, setPerkDrafts] = useState<Record<string, string>>({});

  const handleMembershipToggle = () => {
    updateMembershipConfig(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  const handleMembershipTierUpdate = (tierId: string, updates: Partial<MembershipTier>) => {
    updateMembershipConfig(prev => ({
      ...prev,
      tiers: prev.tiers.map(tier => (tier.id === tierId ? { ...tier, ...updates } : tier)),
    }));
  };

  const handleAddMembershipTier = () => {
    const newTier: MembershipTier = {
      id: `tier_${Date.now()}`,
      name: 'New Tier',
      minSpend: 0,
      perks: [],
      color: '#0B3559',
    };
    updateMembershipConfig(prev => ({
      ...prev,
      tiers: [...prev.tiers, newTier],
    }));
  };

  const handleAddTierPerk = (tierId: string) => {
    const nextPerk = perkDrafts[tierId]?.trim();
    if (!nextPerk) return;
    updateMembershipConfig(prev => ({
      ...prev,
      tiers: prev.tiers.map(tier => (
        tier.id === tierId
          ? { ...tier, perks: [...tier.perks, nextPerk] }
          : tier
      )),
    }));
    setPerkDrafts(prev => ({ ...prev, [tierId]: '' }));
  };

  const handleRemoveTierPerk = (tierId: string, perkIndex: number) => {
    updateMembershipConfig(prev => ({
      ...prev,
      tiers: prev.tiers.map(tier => (
        tier.id === tierId
          ? { ...tier, perks: tier.perks.filter((_, index) => index !== perkIndex) }
          : tier
      )),
    }));
  };

  return (
    <div className="bp-page">
      <button data-ui="button" onClick={onBack} className="mb-6 flex items-center text-xs font-black uppercase hover:opacity-80 transition-colors bp-back"><ChevronLeftIcon className="w-4 h-4 mr-1"/> Back</button>
      <h2 className="text-4xl font-black mb-8 text-navy">Memberships</h2>
      <div className="space-y-6">
        <div className="bg-surface p-6 rounded-[32px] border-4 border-surface-muted shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-steel">Memberships</p>
              <p className="text-sm font-black text-navy">Offer memberships from projected yearly totals.</p>
            </div>
            <Toggle
              checked={membershipConfig.enabled}
              onCheckedChange={handleMembershipToggle}
            />
          </div>
          <p className="text-xs font-bold mt-4 text-steel">{"Membership pricing is based on the monthly average of the client\u2019s projected yearly spend."}</p>
        </div>

        <div className="bg-surface p-6 rounded-[32px] border-4 border-surface-muted shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-steel">Membership tiers</p>
              <p className="text-sm font-black text-navy">Set minimum spend and benefits.</p>
            </div>
            <button data-ui="button" onClick={handleAddMembershipTier} className="px-4 py-2 font-black rounded-2xl text-xs uppercase tracking-widest bp-btn-primary">Add tier</button>
          </div>

          <div className="space-y-4">
            {membershipConfig.tiers.length === 0 && (
              <div className="p-4 rounded-[247px] border-2 border-dashed text-xs font-bold text-center overflow-hidden border-surface-border text-frost">
                No membership tiers yet. Add your first tier to get started.
              </div>
            )}
            {membershipConfig.tiers.map((tier) => (
              <div key={tier.id} className="rounded-2xl border-2 border-surface-muted p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Tier name</label>
                    <input
                      data-ui="field"
                      type="text"
                      value={tier.name}
                      onChange={(event) => handleMembershipTierUpdate(tier.id, { name: event.target.value })}
                      className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Minimum monthly spend</label>
                    <input
                      data-ui="field"
                      type="number"
                      min={0}
                      value={tier.minSpend}
                      onChange={(event) => handleMembershipTierUpdate(tier.id, { minSpend: Number(event.target.value) })}
                      className="w-full px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-steel">Tier color</label>
                    <input
                      data-ui="field"
                      type="color"
                      value={tier.color}
                      onChange={(event) => handleMembershipTierUpdate(tier.id, { color: event.target.value })}
                      className="w-full h-12 rounded-xl cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-steel">{"Perks & benefits"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tier.perks.map((perk, index) => (
                      <div key={`${tier.id}-perk-${index}`} className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-surface-muted text-steel">
                        <span>{perk}</span>
                        <button
                          data-ui="button"
                          type="button"
                          onClick={() => handleRemoveTierPerk(tier.id, index)}
                          className="hover:opacity-70 text-frost"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      data-ui="field"
                      type="text"
                      value={perkDrafts[tier.id] || ''}
                      onChange={(event) => setPerkDrafts(prev => ({ ...prev, [tier.id]: event.target.value }))}
                      placeholder="Add a perk"
                      className="flex-1 min-w-[200px] px-4 py-3 border-2 border-surface-border rounded-2xl font-bold text-sm text-navy focus:outline-none focus:border-sky"
                    />
                    <button
                      data-ui="button"
                      type="button"
                      onClick={() => handleAddTierPerk(tier.id)}
                      className="px-4 py-3 font-black rounded-2xl text-xs uppercase tracking-widest bp-btn-primary"
                    >
                      Add perk
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button data-ui="button" onClick={saveAll} className="w-full py-4 font-black rounded-2xl bp-btn-primary">SAVE MEMBERSHIP SETTINGS</button>
      </div>
    </div>
  );
}
