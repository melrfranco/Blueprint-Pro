import React, { useState } from 'react';
import type { User } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { Toggle } from './Toggle';
import { SaveToast, useSaveToast } from './SaveToast';
import { SettingsIcon, UsersIcon, TrashIcon } from './icons';


interface AccountSettingsProps {
  user: User | null;
  onLogout: () => void;
  subtitle: string;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onLogout, subtitle }) => {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { pushAlertsEnabled, updatePushAlertsEnabled, saveAll } = useSettings();
  const { toastVisible, showToast, hideToast } = useSaveToast();

  const handlePasswordChange = () => {
    alert("Password change functionality is not yet connected to the backend.");
    setIsChangingPassword(false);
  };

  const isMockUser = !!user?.isMock;

  return (
    <div className="bp-page">
        <h1 className="bp-page-title px-2 pt-2 mb-8">Account</h1>

        <div className="space-y-6 animate-fade-in px-1">
            <div className="bg-card p-8 bp-container-list border border-border shadow-sm text-center">
                <h2 className="bp-section-title leading-none mb-2">{user?.name}</h2>
                <p className="bp-overline">{subtitle}</p>
            </div>

            <div className="bg-card p-6 px-8 bp-container-tall border border-border shadow-sm space-y-6">
                <div>
                    <h3 className="bp-overline mb-4 flex items-center">
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        Notifications
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="bp-overline">Push Alerts</span>
                            <Toggle
                                data-ui="toggle"
                                checked={pushAlertsEnabled}
                                onCheckedChange={(checked) => {
                                  updatePushAlertsEnabled(checked);
                                  saveAll().then(showToast);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-border">
                    <h3 className="bp-overline mb-4 flex items-center">
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Account Security
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block bp-caption mb-1">Email</label>
                            {isMockUser && !user?.email ? (
                                <div className="w-full p-3 border-2 bp-container-compact font-medium text-sm italic bp-input-readonly text-foreground">
                                    Mock account — no email associated
                                </div>
                            ) : (
                                <input data-ui="field" type="email" readOnly value={user?.email || ''} className="w-full p-3 font-medium text-sm outline-none bp-input-readonly" />
                            )}
                        </div>
                        {isChangingPassword ? (
                            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3 pt-2 animate-fade-in bp-card-padding-sm bp-container-list border-2 border bg-muted">
                                 <div>
                                    <label className="block bp-caption mb-1">Current Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-card border-2 border font-medium text-sm outline-none text-foreground" />
                                </div>
                                <div>
                                    <label className="block bp-overline mb-1">New Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-card border-2 border font-medium text-sm outline-none text-foreground" />
                                </div>
                                <div className="flex space-x-2 pt-2">
                                     <button data-ui="button" type="submit" className="w-full py-3 border-b-4 border-black/20 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all bp-btn-secondary">Save</button>
                                     <button data-ui="button" type="button" onClick={() => setIsChangingPassword(false)} className="w-full py-3 border-b-4 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all bp-btn-ghost border">Cancel</button>
                                </div>
                            </form>
                        ) : (
                             <div>
                                <label className="block bp-overline mb-1">Password</label>
                                {isMockUser ? (
                                    <>
                                        <div className="w-full text-left p-3 border-2 bp-container-compact font-bold text-sm cursor-not-allowed bp-btn-disabled">
                                            Change Password
                                        </div>
                                        <p className="bp-caption mt-2 px-1">This feature is disabled for the demo administrator account.</p>
                                    </>
                                ) : (
                                    <button data-ui="button" onClick={() => setIsChangingPassword(true)} className="w-full text-left p-3 border-2 border font-medium text-sm hover:opacity-80 transition-colors bg-muted text-foreground">
                                        Change Password
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button data-ui="button" onClick={onLogout} className="w-full py-5 border-b-8 border-black/20 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3 bp-btn-primary">
                <TrashIcon className="w-6 h-6" />
                <span>SIGN OUT</span>
            </button>
        </div>
        <SaveToast visible={toastVisible} onDone={hideToast} />
    </div>
  );
};

export default AccountSettings;
