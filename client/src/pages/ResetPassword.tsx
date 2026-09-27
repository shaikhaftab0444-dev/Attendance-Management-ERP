import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import loginVideo from '../assets/videos/login-3d-element.mp4';

export const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { showToast } = useToast();

  const isMinLength = password.length >= 6;
  const isMatching = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Password reset token is missing from the URL.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.put(`/auth/resetpassword/${token}`, {
        password,
        confirmPassword,
      });

      setIsSuccess(true);
      showToast(
        res.data?.message || 'Password reset successfully!',
        'success',
        'Password Updated'
      );

      // Automatically redirect to login after 2.5 seconds
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.customMessage ||
        'Failed to reset password. The link may have expired or is invalid.';
      setErrorMessage(msg);
      showToast(msg, 'error', 'Reset Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-50">
      {/* ================= LEFT COLUMN: Enterprise Showcase (Desktop md+) ================= */}
      <div className="hidden md:flex md:w-1/2 lg:w-[48%] bg-gradient-to-br from-[#0B0F19] via-[#161938] to-[#241442] relative flex-col justify-between p-8 lg:p-12 text-white overflow-hidden select-none border-r border-slate-800/40">
        {/* Ambient Glow */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[350px] bg-blue-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[380px] bg-purple-600/20 rounded-full blur-[130px] pointer-events-none" />

        {/* Top Branding */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/30 border border-white/20">
            A
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight leading-tight flex items-center gap-2">
              <span>AttendEdge</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                ERP
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Next-Gen Academic ERP Suite</p>
          </div>
        </motion.div>

        {/* Middle Visual Hero */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative w-full max-w-[340px] aspect-square flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 to-purple-600/30 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900/60 backdrop-blur-md">
              <video
                src={loginVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-90 contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19]/80 via-transparent to-transparent pointer-events-none" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-sm"
          >
            <h3 className="text-lg font-bold text-white tracking-tight">
              Create New Security Credentials
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-normal">
              Your new password will be immediately encrypted with bcrypt salt hashing across your AttendEdge roles.
            </p>
          </motion.div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted bcrypt Salt Storage</span>
          </div>
          <span>AttendEdge Security</span>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: Form Card ================= */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 lg:p-12 overflow-y-auto">
        {/* Mobile Header */}
        <div className="flex md:hidden items-center justify-between pb-6 border-b border-slate-200/80 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
              A
            </div>
            <div>
              <span className="font-extrabold text-base text-slate-900">AttendEdge</span>
              <span className="text-[10px] font-bold text-blue-600 ml-1.5 uppercase tracking-wider">ERP</span>
            </div>
          </div>
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>

        {/* Center Container */}
        <div className="w-full max-w-[440px] mx-auto my-auto py-6">
          {/* Back to Login Top Link (Desktop) */}
          <div className="hidden md:block mb-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>

          {!isSuccess ? (
            <div>
              {/* Header Title */}
              <div className="mb-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Reset Your Password
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Choose a strong, secure password for your AttendEdge ERP account.
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
                {/* New Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    New Password <span className="text-red-500">*</span>
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
                      placeholder="At least 6 characters"
                      required
                      autoFocus
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
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

                {/* Confirm New Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Repeat your new password"
                      required
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    {isMinLength ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className={isMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      At least 6 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMatching ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className={isMatching ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      Both passwords match
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !isMinLength || !isMatching}
                  className="w-full py-3 px-4 rounded-xl gradient-btn font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 text-white mt-6 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Update Password & Log In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Password Updated!
                </h2>
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
                  Your credentials have been securely updated. Redirecting you to the sign-in page...
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-block py-3 px-4 rounded-xl gradient-btn font-semibold text-sm text-white shadow-md shadow-blue-500/20"
                >
                  Sign In Immediately
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Dynamic Footer */}
        <div className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
          AttendEdge ERP · Secured Session · © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};
