import { Send } from "lucide-react";
import { useThemeStore } from '../store/useThemeStore';
import { useEffect } from 'react';
import { THEME_COLORS,THEMES } from "../constants";


const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore()

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_COLORS[theme];
    
    if (colors) {
      root.style.setProperty('--color-primary', colors.primary);
      root.style.setProperty('--color-secondary', colors.secondary);
      root.style.setProperty('--color-accent', colors.accent);
      root.style.setProperty('--color-neutral', colors.neutral);
      root.style.setProperty('--color-base-100', colors.base100);
      root.style.setProperty('--color-base-200', colors.base200);
      root.style.setProperty('--color-base-300', colors.base300);
    }
  }, [theme]);

  return (
    <div className="container h-screen max-w-5xl px-4 pt-20 mx-auto" 
         style={{ backgroundColor: 'var(--color-base-100)', color: 'var(--color-neutral)' }}>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Theme</h2>
          <p className="text-sm opacity-70">Choose a theme for your chat interface</p>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {THEMES.map((t) => (
            <button
              key={t}
              className={`
                group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors border
                ${theme === t ? 'border-2' : 'border'}
              `}
              style={{
                backgroundColor: theme === t ? 'var(--color-base-200)' : 'transparent',
                borderColor: theme === t ? 'var(--color-primary)' : 'var(--color-base-300)'
              }}
              onClick={() => setTheme(t)}
            >
              {/* Theme preview colors */}
              <div className="relative w-full h-8 overflow-hidden border rounded-md">
                <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                  <div 
                    className="rounded" 
                    style={{ backgroundColor: THEME_COLORS[t].primary }}
                  ></div>
                  <div 
                    className="rounded" 
                    style={{ backgroundColor: THEME_COLORS[t].secondary }}
                  ></div>
                  <div 
                    className="rounded" 
                    style={{ backgroundColor: THEME_COLORS[t].accent }}
                  ></div>
                  <div 
                    className="rounded" 
                    style={{ backgroundColor: THEME_COLORS[t].neutral }}
                  ></div>
                </div>
              </div>
              <span className="text-[11px] font-medium truncate w-full text-center">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            </button>
          ))}
        </div>

        {/* Preview Section */}
        <h3 className="mb-3 text-lg font-semibold">Preview</h3>
        <div className="overflow-hidden border shadow-lg rounded-xl" 
             style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
          <div className="p-4" style={{ backgroundColor: 'var(--color-base-200)' }}>
            <div className="max-w-lg mx-auto">
              {/* Mock Chat UI */}
              <div className="overflow-hidden shadow-sm rounded-xl" 
                   style={{ backgroundColor: 'var(--color-base-100)' }}>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b" 
                     style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 font-medium text-white rounded-full"
                         style={{ backgroundColor: 'var(--color-primary)' }}>
                      J
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">John Doe</h3>
                      <p className="text-xs opacity-70">Online</p>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="p-4 space-y-4 min-h-[200px] max-h-[200px] overflow-y-auto" 
                     style={{ backgroundColor: 'var(--color-base-100)' }}>
                  {PREVIEW_MESSAGES.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-[80%] rounded-xl p-3 shadow-sm"
                        style={{
                          backgroundColor: message.isSent ? 'var(--color-primary)' : 'var(--color-base-200)',
                          color: message.isSent ? 'white' : 'var(--color-neutral)'
                        }}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-[10px] mt-1.5 opacity-70">
                          12:00 PM
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t" 
                     style={{ borderColor: 'var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 h-10 px-3 text-sm border rounded-lg"
                      style={{ 
                        borderColor: 'var(--color-base-300)', 
                        backgroundColor: 'var(--color-base-100)',
                        color: 'var(--color-neutral)'
                      }}
                      placeholder="Type a message..."
                      value="This is a preview"
                      readOnly
                    />
                    <button 
                      className="h-10 px-4 font-medium text-white rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;