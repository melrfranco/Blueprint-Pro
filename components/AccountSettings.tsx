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
    <div className="p-4 flex flex-col h-full overflow-y-auto pb-48" style={{ backgroundColor: '#F0F4F8' }}>
        <h1 className="text-3xl font-black tracking-tighter px-2 pt-2 mb-8" style={{ color: '#0B3559' }}>Account</h1>

        <div className="space-y-6 animate-fade-in px-1">
            <div className="bg-white p-8 rounded-[40px] border-4 shadow-2xl text-center depth-3" style={{ borderColor: '#0B3559' }}>
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} className="w-24 h-24 rounded-[32px] mx-auto mb-6 border-4 shadow-lg object-cover" style={{ borderColor: '#E2EAF0' }} />
                ) : (
                    <div className="w-24 h-24 rounded-[32px] mx-auto mb-6 flex items-center justify-center text-4xl font-black shadow-xl border-4" style={{ backgroundColor: '#0B3559', color: '#F0F4F8', borderColor: '#0B3559' }}>{user?.name?.[0]}</div>
                )}
                <h2 className="text-2xl font-black tracking-tighter leading-none mb-2" style={{ color: '#0B3559' }}>{user?.name}</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#42708C' }}>{subtitle}</p>
            </div>

            <div className="bg-white p-6 rounded-[32px] border-4 shadow-sm space-y-6" style={{ borderColor: '#E2EAF0' }}>
                <div>
                    <h3 className="font-black text-sm tracking-widest uppercase mb-4 flex items-center" style={{ color: '#42708C' }}>
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        App Settings
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#42708C' }}>Text Size</span>
                            <div className="flex p-1 rounded-xl" style={{ backgroundColor: '#E2EAF0' }}>
                                {(['S', 'M', 'L'] as AppTextSize[]).map(sz => (
                                    <button
                                        data-ui="button"
                                        key={sz}
                                        onClick={() => {
                                          updateTextSize(sz);
                                          saveAll();
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black ${sz === textSize ? 'bg-white shadow' : ''}`}
                                        style={{ color: sz === textSize ? '#0B3559' : '#8EB1BF' }}
                                    >
                                      {sz}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#42708C' }}>Push Alerts</span>
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

                <div className="pt-6 border-t-2" style={{ borderColor: '#E2EAF0' }}>
                    <h3 className="font-black text-sm tracking-widest uppercase mb-4 flex items-center" style={{ color: '#42708C' }}>
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Account Security
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#42708C' }}>Email</label>
                            {isMockUser && !user?.email ? (
                                <div className="w-full p-3 border-2 rounded-xl font-bold text-sm italic" style={{ backgroundColor: '#F0F4F8', borderColor: '#C5D5DE', color: '#42708C' }}>
                                    Mock account — no email associated
                                </div>
                            ) : (
                                <input data-ui="field" type="email" readOnly value={user?.email || ''} className="w-full p-3 border-2 rounded-xl font-bold text-sm outline-none" style={{ backgroundColor: '#F0F4F8', borderColor: '#C5D5DE', color: '#0B3559' }} />
                            )}
                        </div>
                        {isChangingPassword ? (
                            <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} className="space-y-3 pt-2 animate-fade-in">
                                 <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#42708C' }}>Current Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-white border-2 rounded-xl font-bold text-sm outline-none" style={{ borderColor: '#C5D5DE', color: '#0B3559' }} />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#42708C' }}>New Password</label>
                                    <input data-ui="field" type="password" required className="w-full p-3 bg-white border-2 rounded-xl font-bold text-sm outline-none" style={{ borderColor: '#C5D5DE', color: '#0B3559' }} />
                                </div>
                                <div className="flex space-x-2 pt-2">
                                     <button data-ui="button" type="submit" className="w-full font-black py-3 rounded-xl border-b-4 border-black/20 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all" style={{ backgroundColor: '#5890A6', color: '#FFFFFF' }}>Save</button>
                                     <button data-ui="button" type="button" onClick={() => setIsChangingPassword(false)} className="w-full font-black py-3 rounded-xl border-b-4 uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all" style={{ backgroundColor: '#E2EAF0', borderColor: '#C5D5DE', color: '#0B3559' }}>Cancel</button>
                                </div>
                            </form>
                        ) : (
                             <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#42708C' }}>Password</label>
                                {isMockUser ? (
                                    <>
                                        <div className="w-full text-left p-3 border-2 rounded-xl font-bold text-sm cursor-not-allowed" style={{ backgroundColor: '#E2EAF0', borderColor: '#C5D5DE', color: '#8EB1BF' }}>
                                            Change Password
                                        </div>
                                        <p className="text-xs mt-2 px-1" style={{ color: '#42708C' }}>This feature is disabled for the demo administrator account.</p>
                                    </>
                                ) : (
                                    <button data-ui="button" onClick={() => setIsChangingPassword(true)} className="w-full text-left p-3 border-2 rounded-xl font-bold text-sm hover:opacity-80 transition-colors" style={{ backgroundColor: '#E2EAF0', borderColor: '#C5D5DE', color: '#0B3559' }}>
                                        Change Password
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button data-ui="button" onClick={onLogout} className="w-full font-black py-5 rounded-[28px] border-b-8 border-black/20 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3" style={{ backgroundColor: '#0B3559', color: '#F0F4F8' }}>
                <TrashIcon className="w-6 h-6" />
                <span>SIGN OUT</span>
            </button>
        </div>
    </div>
  );
};

export default AccountSettings;
