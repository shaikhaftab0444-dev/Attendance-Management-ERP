import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import loginVideo from '../assets/videos/login-3d-element.mp4';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please provide both email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.name}!`, 'success', 'Login Successful');

      if (from) {
        navigate(from, { replace: true });
        return;
      }

      if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (user.role === 'hod') navigate('/hod/dashboard', { replace: true });
      else navigate('/teacher/dashboard', { replace: true });
    } catch (err: any) {
      if (err.response?.status === 429) {
        const resetAt = err.response?.data?.resetAt;
        if (resetAt) {
          const resetDate = new Date(resetAt);
          const diffMs = resetDate.getTime() - Date.now();
          const diffMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
          setErrorMessage(`Too many login attempts. Please try again in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}.`);
        } else {
          setErrorMessage(err.response?.data?.message || 'Too many login attempts. Please try again later.');
        }
      } else {
        const msg =
          err.customMessage ||
          err.response?.data?.message ||
          'Invalid email or password. Please try again.';
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-50">
      {/* ================= LEFT COLUMN: Premium Enterprise Showcase (Desktop md+) ================= */}
      <div className="hidden md:flex md:w-1/2 lg:w-[48%] bg-gradient-to-br from-[#0B0F19] via-[#161938] to-[#241442] relative flex-col justify-between p-8 lg:p-12 text-white overflow-hidden select-none border-r border-slate-800/40">
        {/* Ambient Glow & Mesh Background */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[350px] bg-blue-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[380px] bg-purple-600/20 rounded-full blur-[130px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Top Branding Section */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-purple-500/20">
                <div className="w-full h-full rounded-[11px] bg-[#0F172A] flex items-center justify-center">
                  <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    AE
                  </span>
                </div>
              </div>
              <div>
                <span className="text-lg font-extrabold text-white tracking-tight block">
                  AttendEdge<span className="text-blue-400 font-bold ml-0.5">ERP</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium block">
                  Academic Operations & Intelligence
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>System Live</span>
            </div>
          </div>
        </motion.div>

        {/* Center 3D Hero Showcase Stage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="relative z-10 my-auto py-2 flex flex-col items-center"
        >
          {/* Glass Podium Card Container */}
          <div className="relative w-full max-w-[380px] lg:max-w-[420px] rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 lg:p-5 border border-white/[0.12] backdrop-blur-2xl shadow-2xl shadow-black/40 group">
            {/* Ambient Backlight Behind 3D Graphic */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/15 to-pink-500/10 rounded-3xl blur-xl pointer-events-none" />

            {/* Video Canvas Container with sleek radius and subtle border */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900/60 border border-white/[0.08] shadow-inner">
              <video
                src={loginVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="w-full h-[220px] lg:h-[260px] object-cover mix-blend-screen pointer-events-none"
                style={{
                  filter: 'contrast(1.08) brightness(1.02) drop-shadow(0 10px 25px rgba(139, 92, 246, 0.3))',
                }}
              />

              {/* Floating Live Badge Overlay on Video */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white/90 shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Automated Timetable & Attendance</span>
              </div>
            </div>

            {/* Micro Feature Grid Under Video */}
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                <ShieldCheck className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-white block">RBAC Security</span>
                <span className="text-[9px] text-slate-400 block">Admin · HOD · Faculty</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                <BarChart3 className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-white block">Defaulter Engine</span>
                <span className="text-[9px] text-slate-400 block">Instant Percentages</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-white block">Real-Time Sync</span>
                <span className="text-[9px] text-slate-400 block">Single-Click Audit</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom Status & Trust Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-10 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Encrypted Session & JWT Multi-Tier Governance</span>
          </div>
          <span className="text-slate-500 font-mono">v2.4 Enterprise</span>
        </motion.div>
      </div>

      {/* ================= RIGHT COLUMN: Professional Login Form ================= */}
      <div className="w-full md:w-1/2 lg:w-[52%] flex flex-col justify-between p-6 sm:p-10 lg:p-16 bg-white min-h-screen md:min-h-0">
        {/* Mobile Header Branding (visible only on screens < md) */}
        <div className="md:hidden flex flex-col items-center text-center pt-4 pb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl gradient-btn mb-3 shadow-md text-white">
            <span className="font-extrabold text-xl tracking-tight">AE</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AttendEdge ERP</h1>
          <p className="text-xs text-slate-500 mt-1">
            College Attendance & Operations Portal
          </p>
        </div>

        {/* Main Form Center Box */}
        <div className="max-w-md w-full mx-auto my-auto py-4">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
              Sign In
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {/* Inline Error Alert Banner */}
          {errorMessage && (
            <div className="mt-5 p-3.5 bg-red-50 border border-red-200/80 rounded-xl text-xs text-red-700 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="you@college.edu"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 transition-colors"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors focus:outline-none"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl gradient-btn font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 text-white mt-6 disabled:opacity-60 transition-all cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to AttendEdge</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Dynamic Footer */}
        <div className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
          AttendEdge ERP · Secured Session · © {new Date().getFullYear()}
        </div>
      </div>

      {/* ================= FORGOT PASSWORD MODAL ================= */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Forgot Password"
        subtitle="Account Recovery Assistance"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong className="block font-bold text-sm mb-1 text-blue-950">
                Administrator Managed Resets
              </strong>
              Password resets are handled by your system administrator. Please contact them
              directly to reset your password or re-issue your account credentials.
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold gradient-btn text-white shadow-sm hover:opacity-95 transition-all"
            >
              OK, Understood
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
