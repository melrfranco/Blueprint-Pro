import React from 'react';
import { useSettings } from '../contexts/SettingsContext';

const LoginScreen: React.FC = () => {
  const { branding } = useSettings();

  const startSquareOAuth = () => {
    window.location.href = '/api/square/oauth/start';
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden"
      style={{ backgroundColor: branding.primaryColor }}
    >
      {/* Blueprint grid background */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }} />

      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 depth-3" style={{ borderColor: branding.primaryColor }}>
        <div
          className="p-10 text-center border-b-4 relative"
          style={{
            borderColor: branding.primaryColor,
            background: 'linear-gradient(135deg, #F0F4F8 0%, #E2EAF0 100%)',
          }}
        >
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F8d6a989189ff4d9e8633804d5d0dbd86%2F7093acbcb2ca4ac783c4b84bc621e52f"
            alt="Blueprint Logo"
            className="login-logo object-contain mx-auto mb-4"
            style={{
              maxWidth: "100%",
              width: "100%",
              display: "block",
            }}
          />

          <h1
            className="text-3xl tracking-tighter font-semibold text-left"
            style={{
              color: branding.primaryColor,
            }}
          >
            Pro Access
          </h1>
        </div>

        <div
          className="login-screen-content"
          style={{
            backgroundColor: `rgba(${parseInt(branding.primaryColor.slice(1, 3), 16)}, ${parseInt(branding.primaryColor.slice(3, 5), 16)}, ${parseInt(branding.primaryColor.slice(5, 7), 16)}, 0.06)`,
            padding: "8px 40px 40px",
          }}
        >
          <div className="my-8 flex items-center gap-3">
            <div className="flex-1 h-0.5" style={{ backgroundColor: '#C5D5DE' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#42708C' }}>Admin access</span>
            <div className="flex-1 h-0.5" style={{ backgroundColor: '#C5D5DE' }} />
          </div>

          <div className="mb-4">
            <button
              onClick={startSquareOAuth}
              className="blueprint-button font-black square-oauth-button"
            >
              Login with Square
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
