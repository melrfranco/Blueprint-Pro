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
    <div className="p-6 min-h-screen" style={{ background: 'linear-gradient(180deg, #F0F4F8 0%, #FFFFFF 100%)' }}>
      <button data-ui="button" onClick={onBack} className="mb-6 flex items-center text-xs font-black uppercase hover:opacity-80 transition-colors" style={{ color: '#42708C' }}><ChevronLeftIcon className="w-4 h-4 mr-1"/> Back</button>
      <h2 className="text-4xl font-black mb-8" style={{ color: '#0B3559' }}>Memberships</h2>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-[32px] border-4 shadow-sm" style={{ borderColor: '#E2EAF0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#42708C' }}>Memberships</p>
              <p className="text-sm font-black" style={{ color: '#0B3559' }}>Offer memberships from projected yearly totals.</p>
            </div>
            <Toggle
              checked={membershipConfig.enabled}
              onCheckedChange={handleMembershipToggle}
            />
          </div>
          <p className="text-xs font-bold mt-4" style={{ color: '#42708C' }}>{"Membership pricing is based on the monthly average of the client\u2019s projected yearly spend."}</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border-4 shadow-sm" style={{ borderColor: '#E2EAF0' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#42708C' }}>Membership tiers</p>
              <p className="text-sm font-black" style={{ color: '#0B3559' }}>Set minimum spend and benefits.</p>
            </div>
            <button data-ui="button" onClick={handleAddMembershipTier} className="px-4 py-2 font-black rounded-2xl text-xs uppercase tracking-widest" style={{ backgroundColor: '#0B3559', color: '#F0F4F8' }}>Add tier</button>
          </div>

          <div className="space-y-4">
            {membershipConfig.tiers.length === 0 && (
              <div className="p-4 rounded-[247px] border-2 border-dashed text-xs font-bold text-center overflow-hidden" style={{ borderColor: '#C5D5DE', color: '#8EB1BF' }}>
                No membership tiers yet. Add your first tier to get started.
              </div>
            )}
            {membershipConfig.tiers.map((tier) => (
              <div key={tier.id} className="rounded-2xl border-2 p-4 space-y-4" style={{ borderColor: '#E2EAF0' }}>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#42708C' }}>Tier name</label>
                    <input
                      data-ui="field"
                      type="text"
                      value={tier.name}
                      onChange={(event) => handleMembershipTierUpdate(tier.id, { name: event.target.value })}
                      className="w-full px-4 py-3 border-2 rounded-2xl font-bold text-sm focus:outline-none"
                      style={{ borderColor: '#C5D5DE', color: '#0B3559' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#42708C' }}>Minimum monthly spend</label>
                    <input
                      data-ui="field"
                      type="number"
                      min={0}
                      value={tier.minSpend}
                      onChange={(event) => handleMembershipTierUpdate(tier.id, { minSpend: Number(event.target.value) })}
                      className="w-full px-4 py-3 border-2 rounded-2xl font-bold text-sm focus:outline-none"
                      style={{ borderColor: '#C5D5DE', color: '#0B3559' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#42708C' }}>Tier color</label>
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
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#42708C' }}>{"Perks & benefits"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tier.perks.map((perk, index) => (
                      <div key={`${tier.id}-perk-${index}`} className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: '#E2EAF0', color: '#42708C' }}>
                        <span>{perk}</span>
                        <button
                          data-ui="button"
                          type="button"
                          onClick={() => handleRemoveTierPerk(tier.id, index)}
                          className="hover:opacity-70"
                          style={{ color: '#8EB1BF' }}
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
                      className="flex-1 min-w-[200px] px-4 py-3 border-2 rounded-2xl font-bold text-sm focus:outline-none"
                      style={{ borderColor: '#C5D5DE', color: '#0B3559' }}
                    />
                    <button
                      data-ui="button"
                      type="button"
                      onClick={() => handleAddTierPerk(tier.id)}
                      className="px-4 py-3 font-black rounded-2xl text-xs uppercase tracking-widest"
                      style={{ backgroundColor: '#0B3559', color: '#F0F4F8' }}
                    >
                      Add perk
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button data-ui="button" onClick={saveAll} className="w-full py-4 font-black rounded-2xl" style={{ backgroundColor: '#0B3559', color: '#F0F4F8' }}>SAVE MEMBERSHIP SETTINGS</button>
      </div>
    </div>
  );
}
