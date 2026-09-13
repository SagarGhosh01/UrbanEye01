import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, Loader2, UserCheck, ArrowLeft, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBack }) => {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('head.kapurthala@urbaneye.gov.in');
  const [password, setPassword] = useState('UrbanEye@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('urbaneye_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid government credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setTestAccount = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('UrbanEye@2026');
    setError(null);
  };

  /* ── Theme-aware tokens ── */
  const pageBg     = isDark ? '#081325' : '#f1f5f9';
  const cardBg     = isDark ? 'rgba(15, 31, 56, 0.85)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0';
  const labelClr   = isDark ? '#cbd5e1' : '#1e293b';
  const iconClr    = isDark ? '#64748b' : '#94a3b8';
  const inputBg    = isDark ? 'rgba(8, 19, 37, 0.7)' : '#f8fafc';
  const inputBdr   = isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1';
  const inputClr   = isDark ? '#f1f5f9' : '#0f172a';
  const divClr     = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';
  const hintClr    = isDark ? '#94a3b8' : '#64748b';
  const codeClr    = isDark ? '#94a3b8' : '#475569';

  /* Crucial: fontSize 16px (1rem) prevents iOS Safari auto-zoom on focus */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '1rem',
    minHeight: '44px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: `1px solid ${inputBdr}`,
    backgroundColor: inputBg,
    color: inputClr,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const personas = [
    {
      e: 'head.kapurthala@urbaneye.gov.in',
      label: '★ District Head (Kapurthala Demo)',
      badge: 'LIVE DEMO',
      isDemo: true,
      badgeColor: '#fbbf24',
      activeBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(180, 83, 9, 0.12) 100%)',
      activeBorder: '#f59e0b',
      activeColor: '#fef08a',
    },
    {
      e: 'head.jalandhar@urbaneye.gov.in',
      label: 'District Head (Jalandhar)',
      badge: 'Scoped',
      badgeColor: '#64748b',
      activeBg: 'rgba(6, 95, 70, 0.25)',
      activeBorder: '#10b981',
      activeColor: '#6ee7b7',
    },
    {
      e: 'admin.pb@urbaneye.gov.in',
      label: 'State Admin (Punjab)',
      badge: 'State',
      badgeColor: '#64748b',
      activeBg: 'rgba(30, 58, 138, 0.3)',
      activeBorder: '#3b82f6',
      activeColor: '#93c5fd',
    },
    {
      e: 'head.mumbai@urbaneye.gov.in',
      label: 'District Head (Mumbai Suburban)',
      badge: 'Scoped',
      badgeColor: '#64748b',
      activeBg: 'rgba(6, 95, 70, 0.25)',
      activeBorder: '#10b981',
      activeColor: '#6ee7b7',
    },
    {
      e: 'head.bengaluru@urbaneye.gov.in',
      label: 'District Head (Bengaluru Urban)',
      badge: 'Scoped',
      badgeColor: '#64748b',
      activeBg: 'rgba(6, 95, 70, 0.25)',
      activeBorder: '#10b981',
      activeColor: '#6ee7b7',
    },
    {
      e: 'admin.mh@urbaneye.gov.in',
      label: 'State Admin (Maharashtra)',
      badge: 'State',
      badgeColor: '#64748b',
      activeBg: 'rgba(30, 58, 138, 0.3)',
      activeBorder: '#3b82f6',
      activeColor: '#93c5fd',
    },
    {
      e: 'admin@urbaneye.gov.in',
      label: 'National Admin (All India)',
      badge: 'Full Access',
      badgeColor: '#818cf8',
      activeBg: 'rgba(49, 46, 129, 0.35)',
      activeBorder: '#6366f1',
      activeColor: '#a5b4fc',
    },
  ];

  return (
    <div style={{
      minHeight: '100svh',
      backgroundColor: pageBg,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflowX: 'hidden',
      transition: 'background 0.3s',
    }}>
      {/* Background Ambient Lighting & Gradients */}
      <div style={{
        position: 'absolute',
        top: -120,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(30,127,115,0.2) 0%, rgba(45,212,191,0.05) 45%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      {/* Background Dot grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: isDark ? 0.06 : 0.12,
        pointerEvents: 'none',
        backgroundImage: `radial-gradient(${isDark ? '#ffffff' : '#94a3b8'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }} />

      {/* Header section */}
      <div style={{ maxWidth: 460, margin: '0 auto', width: '100%', position: 'relative', zIndex: 10 }}>
        {onBack && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: isDark ? '#cbd5e1' : '#64748b',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                minHeight: '40px',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              <span>Back to Overview</span>
            </button>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#2dd4bf',
              letterSpacing: '0.05em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2dd4bf' }} className="animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>
        )}

        {/* Logo Emblem */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              inset: -2,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E7F73, #2dd4bf)',
              opacity: 0.5,
              filter: 'blur(6px)',
            }} />
            <div style={{
              position: 'relative',
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(45,212,191,0.5)',
              backgroundColor: '#081325',
              boxShadow: '0 0 25px rgba(45,212,191,0.3)',
              padding: 2,
            }}>
              <img src="/logo.png" alt="UrbanEye" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            </div>
          </div>
        </div>

        <h2 style={{
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 800,
          color: isDark ? '#ffffff' : '#0f172a',
          margin: '0 0 6px',
          letterSpacing: '-0.025em',
        }}>
          UrbanEye Command Portal
        </h2>
        <p style={{
          textAlign: 'center',
          fontSize: '0.82rem',
          color: isDark ? '#94a3b8' : '#64748b',
          margin: '0 0 12px',
        }}>
          Government Road Intelligence &amp; Bus Edge-AI Platform
        </p>

        <div style={{ textAlign: 'center' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 999,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            backgroundColor: 'rgba(30,127,115,0.15)',
            color: '#2dd4bf',
            border: '1px solid rgba(45,212,191,0.3)',
            boxShadow: '0 0 12px rgba(45,212,191,0.1)',
            textTransform: 'uppercase',
          }}>
            <ShieldCheck style={{ width: 13, height: 13 }} />
            <span>Authorized Personnel Only</span>
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div style={{
        maxWidth: 460,
        margin: '18px auto 0',
        width: '100%',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'relative',
          backgroundColor: cardBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 20,
          padding: '26px 22px',
          boxShadow: isDark
            ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 0 30px rgba(30,127,115,0.12)'
            : '0 15px 45px -5px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          transition: 'background 0.3s, border-color 0.3s',
        }}>
          {/* Top subtle accent bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, #1E7F73 30%, #2dd4bf 50%, #1E7F73 70%, transparent 100%)',
          }} />

          {/* Error Banner */}
          {error && (
            <div style={{
              marginBottom: 16,
              padding: '12px 14px',
              backgroundColor: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 10,
              fontSize: '0.82rem',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email Field */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: labelClr,
                marginBottom: 6,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>
                <Mail style={{ width: 14, height: 14, color: '#2dd4bf' }} />
                <span>Official Government Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="officer@urbaneye.gov.in"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2dd4bf';
                  e.target.style.boxShadow = '0 0 12px rgba(45,212,191,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = inputBdr;
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: labelClr,
                marginBottom: 6,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>
                <Lock style={{ width: 14, height: 14, color: '#2dd4bf' }} />
                <span>Password</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2dd4bf';
                    e.target.style.boxShadow = '0 0 12px rgba(45,212,191,0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = inputBdr;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: iconClr,
                    borderRadius: '0 10px 10px 0',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#2dd4bf'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = iconClr; }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 16, height: 16 }} />
                    : <Eye    style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '12px 18px',
                fontSize: '0.92rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                borderRadius: 12,
                border: '1px solid rgba(45,212,191,0.3)',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #1E7F73 0%, #166c62 100%)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: loading ? 0.8 : 1,
                boxShadow: '0 6px 20px rgba(30,127,115,0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #249588 0%, #1a7f74 100%)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 25px rgba(30,127,115,0.45)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #1E7F73 0%, #166c62 100%)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(30,127,115,0.35)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <>
                  <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Access Command Center</span>
                  <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s' }}>→</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Persona Switcher */}
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${divClr}` }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.74rem',
                fontWeight: 700,
                color: hintClr,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                <UserCheck style={{ width: 14, height: 14, color: '#2dd4bf' }} />
                <span>Quick Persona Selector</span>
              </div>
              <Sparkles style={{ width: 13, height: 13, color: '#fbbf24' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {personas.map(({ e, label, badge, isDemo, activeBg, activeBorder, activeColor }) => {
                const isActive = email === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setTestAccount(e)}
                    style={{
                      textAlign: 'left',
                      minHeight: '44px',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: isActive
                        ? `1.5px solid ${activeBorder}`
                        : isDemo
                        ? '1.5px solid rgba(245,158,11,0.45)'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: isActive
                        ? activeBg
                        : isDemo
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(180,83,9,0.08) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      color: isActive
                        ? activeColor
                        : isDemo
                        ? '#fbbf24'
                        : '#cbd5e1',
                      boxShadow: isDemo
                        ? '0 0 16px rgba(245,158,11,0.15)'
                        : 'none',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      fontWeight: isActive || isDemo ? 700 : 500,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !isDemo) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isDemo) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {isActive && <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0, color: activeColor }} />}
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: isDemo ? '#fbbf24' : isActive ? activeColor : '#94a3b8',
                      flexShrink: 0,
                      padding: '3px 8px',
                      borderRadius: 999,
                      backgroundColor: isDemo
                        ? 'rgba(245,158,11,0.2)'
                        : isActive
                        ? 'rgba(0,0,0,0.2)'
                        : 'rgba(255,255,255,0.05)',
                      border: isDemo ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}>
                      {badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <p style={{ marginTop: 14, fontSize: '0.74rem', color: hintClr, textAlign: 'center' }}>
              Universal Demo Password:{' '}
              <code style={{
                fontFamily: 'monospace',
                color: '#2dd4bf',
                fontWeight: 700,
                padding: '3px 8px',
                backgroundColor: 'rgba(30,127,115,0.15)',
                border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 6,
                letterSpacing: '0.04em',
              }}>
                UrbanEye@2026
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

