import React, { useState } from 'react';
import type { User, AppTextSize } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { Toggle } from './Toggle';
import { SettingsIcon, UsersIcon, TrashIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';


interface AccountSettingsProps {
  user: User | null;
  onLogout: () => void;
  subtitle: string;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onLogout, subtitle }) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { textSize, updateTextSize, pushAlertsEnabled, updatePushAlertsEnabled, branding, saveAll } = useSettings();

  const handlePasswordChange = () => {
    alert("Password change functionality is not yet connected to the backend.");
    setIsChangingPassword(false);
  };

  const isMockUser = !!user?.isMock;

  return (
    <div className="p-4 flex flex-col h-full bg-ds-bg overflow-y-auto pb-48">
        <h1 className="text-3xl font-black tracking-tighter px-2 pt-2 mb-8" style={{ color: ensureAccessibleColor(branding.accentColor, '#F9FAFB', '#1E3A8A') }}>Account</h1>

        <div className="space-y-6 animate-fade-in px-1">
            <div className="bg-ds-surface p-8 rounded-[40px] border-4 border-ds-border-strong shadow-ds-2 text-center">
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-24 h-24 rounded-[32px] mx-auto mb-6 border-4 border-ds-border shadow-ds-1 object-cover" />
                ) : (
                    <div className="w-24 h-24 rounded-[32px] mx-auto mb-6 flex items-center justify-center text-4xl font-black text-ds-text-on-primary shadow-ds-2 border-4 border-ds-border-strong" style={{ backgroundColor: branding.primaryColor }}>{user?.name?.[0]}</div>
                )}
                <h2 className="text-2xl font-black text-ds-text tracking-tighter leading-none mb-2">{user?.name}</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C') }}>{subtitle}</p>
            </div>

            <div className="bg-ds-surface p-6 rounded-[32px] border-4 border-ds-border shadow-ds-1 space-y-6">
                <div>
                    <h3 className="font-black text-sm tracking-widest uppercase text-ds-text-muted mb-4 flex items-center">
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        App Settings
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase text-ds-text-muted tracking-widest">Text Size</span>
                            <div className="flex bg-ds-surface-2 p-1 rounded-xl">
                                {(['S', 'M', 'L'] as AppTextSize[]).map(sz => (
                                    <button
                                        data-ui="button"
                                        key={sz}
                                        onClick={() => {
                                          updateTextSize(sz);
                                          saveAll();
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black ${sz === textSize ? 'bg-ds-surface shadow-ds-1 text-ds-text' : 'text-ds-text-muted'}`}
                                    >
                                      {sz}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase text-ds-text-muted tracking-widest">Push Alerts</span>
                            <Toggle
                                data-ui="toggle"
                                checked={pushAlertsEnabled}
                                onCheckedChange={(checked) => {
                                  updatePushAlertsEnabled(checked);
                                  saveAll();
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t-2 border-ds-border">
                    <h3 className="font-black text-sm tracking-widest uppercase text-ds-text-muted mb-4 flex items-center">
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Account Security
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[9px] font-black text-ds-text-muted uppercase tracking-widest mb-1">Email</label>
                            {isMockUser && !user?.email ? (
                                <div className="w-full p-3 bg-ds-bg border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text-muted italic">
                                    Mock account — no email associated
                                </div>
                            ) : (
                                <input data-ui="field" type="email" readOnly value={user?.email || ''} className="w-full p-3 bg-ds-bg border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text outline-none" />
                            )}
                        </div>
                        {isChangingPassword ? (
                            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3 pt-2 animate-fade-in">
                                 <div>
                                    <label className="block text-[9px] font-black text-ds-text-muted uppercase tracking-widest mb-1">Current Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-ds-surface border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-ds-text-muted uppercase tracking-widest mb-1">New Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-ds-surface border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text outline-none" />
                                </div>
                                <div className="flex space-x-2 pt-2">
                                     <button data-ui="button" type="submit" className="w-full text-ds-interactive-text font-black py-3 rounded-xl border-b-4 border-black/20 uppercase tracking-widest text-xs shadow-ds-1 active:scale-95 transition-all" style={{ backgroundColor: branding.accentColor, color: ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#BE123C') }}>Save</button>
                                     <button data-ui="button" type="button" onClick={() => setIsChangingPassword(false)} className="w-full text-ds-text font-black py-3 bg-ds-surface-2 rounded-xl border-b-4 border-ds-border uppercase tracking-widest text-xs shadow-ds-1 active:scale-95 transition-all">Cancel</button>
                                </div>
                            </form>
                        ) : (
                             <div>
                                <label className="block text-[9px] font-black text-ds-text-muted uppercase tracking-widest mb-1">Password</label>
                                {isMockUser ? (
                                    <>
                                        <div className="w-full text-left p-3 bg-ds-surface-2 border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text-muted cursor-not-allowed">
                                            Change Password
                                        </div>
                                        <p className="text-xs text-ds-text-muted mt-2 px-1">This feature is disabled for the demo administrator account.</p>
                                    </>
                                ) : (
                                    <button data-ui="button" onClick={() => setIsChangingPassword(true)} className="w-full text-left p-3 bg-ds-surface-2 border-2 border-ds-border rounded-xl font-bold text-sm text-ds-text hover:border-ds-border-strong transition-colors">
                                        Change Password
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button data-ui="button" onClick={onLogout} className="w-full font-black py-5 rounded-[28px] border-b-8 border-black/20 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3" style={{ backgroundColor: branding.accentColor, color: ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#FFFFFF') }}>
                <TrashIcon className="w-6 h-6" />
                <span>SIGN OUT</span>
            </button>
        </div>
    </div>
  );
};

export default AccountSettings;
