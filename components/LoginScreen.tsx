import React from 'react';
const LoginScreen: React.FC = () => {

  const startSquareOAuth = () => {
    window.location.href = '/api/square/oauth/start';
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden bg-primary"
    >
      {/* Blueprint grid background */}
      <div className="absolute inset-0 opacity-10 bp-grid-bg" />

      <div className="bg-white bp-container-tall shadow-2xl w-full max-w-md relative border border-border depth-3 overflow-hidden">
        <div className="p-10 text-center">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F8d6a989189ff4d9e8633804d5d0dbd86%2F7093acbcb2ca4ac783c4b84bc621e52f"
            alt="Blueprint Logo"
            className="login-logo object-contain mx-auto w-full block"
          />
        </div>

        <div className="px-10 pb-10 pt-2">
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-foreground/30" />
            <span className="bp-overline text-foreground">Admin access</span>
            <div className="flex-1 h-0.5 bg-foreground/30" />
          </div>

          <button
            data-ui="button"
            onClick={startSquareOAuth}
            className="w-full py-4 bp-btn-primary text-center"
          >
            Login with Square
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
