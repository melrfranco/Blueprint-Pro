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
    <div className="p-4 flex flex-col h-full overflow-y-auto pb-48 bg-surface-subtle">
        <h1 className="text-3xl font-black tracking-tighter px-2 pt-2 mb-8 text-navy">Account</h1>

        <div className="space-y-6 animate-fade-in px-1">
            <div className="bg-surface p-8 rounded-[40px] border-4 border-navy shadow-2xl text-center depth-3">
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-24 h-24 rounded-[32px] mx-auto mb-6 border-4 border-surface-muted shadow-lg object-cover" />
                ) : (
                    <div className="w-24 h-24 rounded-[32px] mx-auto mb-6 flex items-center justify-center text-4xl font-black shadow-xl border-4 bg-navy text-surface-subtle border-navy">{user?.name?.[0]}</div>
                )}
                <h2 className="text-2xl font-black tracking-tighter leading-none mb-2 text-navy">{user?.name}</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-steel">{subtitle}</p>
            </div>

            <div className="bg-surface p-6 rounded-[32px] border-4 border-surface-muted shadow-sm space-y-6">
                <div>
                    <h3 className="font-black text-sm tracking-widest uppercase mb-4 flex items-center text-steel">
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        App Settings
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest text-steel">Text Size</span>
                            <div className="flex p-1 rounded-xl bg-surface-muted">
                                {(['S', 'M', 'L'] as AppTextSize[]).map(sz => (
                                    <button
                                        data-ui="button"
                                        key={sz}
                                        onClick={() => {
                                          updateTextSize(sz);
                                          saveAll();
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black ${sz === textSize ? 'bg-surface shadow text-navy' : 'text-frost'}`}
                                    >
                                      {sz}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest text-steel">Push Alerts</span>
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

                <div className="pt-6 border-t-2 border-surface-muted">
                    <h3 className="font-black text-sm tracking-widest uppercase mb-4 flex items-center text-steel">
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Account Security
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1 text-steel">Email</label>
                            {isMockUser && !user?.email ? (
                                <div className="w-full p-3 border-2 rounded-xl font-bold text-sm italic bp-input-readonly text-steel">
                                    Mock account — no email associated
                                </div>
                            ) : (
                                <input data-ui="field" type="email" readOnly value={user?.email || ''} className="w-full p-3 rounded-xl font-bold text-sm outline-none bp-input-readonly" />
                            )}
                        </div>
                        {isChangingPassword ? (
                            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3 pt-2 animate-fade-in">
                                 <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1 text-steel">Current Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-surface border-2 border-surface-border rounded-xl font-bold text-sm outline-none text-navy" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1 text-steel">New Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-surface border-2 border-surface-border rounded-xl font-bold text-sm outline-none text-navy" />
                                </div>
                                <div className="flex space-x-2 pt-2">
                                     <button data-ui="button" type="submit" className="w-full font-black py-3 rounded-xl border-b-4 border-black/20 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all bp-btn-secondary">Save</button>
                                     <button data-ui="button" type="button" onClick={() => setIsChangingPassword(false)} className="w-full font-black py-3 rounded-xl border-b-4 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all bp-btn-ghost border-surface-border">Cancel</button>
                                </div>
                            </form>
                        ) : (
                             <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest mb-1 text-steel">Password</label>
                                {isMockUser ? (
                                    <>
                                        <div className="w-full text-left p-3 border-2 rounded-xl font-bold text-sm cursor-not-allowed bp-btn-disabled">
                                            Change Password
                                        </div>
                                        <p className="text-xs mt-2 px-1 text-steel">This feature is disabled for the demo administrator account.</p>
                                    </>
                                ) : (
                                    <button data-ui="button" onClick={() => setIsChangingPassword(true)} className="w-full text-left p-3 border-2 border-surface-border rounded-xl font-bold text-sm hover:opacity-80 transition-colors bg-surface-muted text-navy">
                                        Change Password
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button data-ui="button" onClick={onLogout} className="w-full font-black py-5 rounded-[28px] border-b-8 border-black/20 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3 bp-btn-primary">
                <TrashIcon className="w-6 h-6" />
                <span>SIGN OUT</span>
            </button>
        </div>
    </div>
  );
};

export default AccountSettings;
