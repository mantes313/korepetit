'use client';

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { loginUser, loginWithGoogle } from '@/lib/api/auth';
import { useAuth } from '@/components/AuthProvider';

function InputField({ label, id, type = "text", value, onChange, error, placeholder, autoComplete, children }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-[#5A4A38]">{label}</label>
        {children}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`
          w-full px-4 py-3 rounded-xl bg-[#F4ECDF]/60 border text-[#2A1F14] placeholder-[#8A7556]
          outline-none transition-all duration-200 text-sm hover:border-[#DCC9A8]
          ${focused ? "border-[#C8654A] shadow-[0_0_0_3px_rgba(200,101,74,0.18)]" : "border-[#DCC9A8]"}
          ${error ? "border-[#B85A4F] shadow-[0_0_0_3px_rgba(184,90,79,0.18)]" : ""}
        `}
      />
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

function validate(fields) {
  const errors = {};
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!fields.password) errors.password = "Password is required.";
  return errors;
}

function friendlyError(err) {
  const code = err?.code;
  const msg  = err?.message ?? '';
  if (code === 'auth/not-configured')
    return 'Supabase is not configured. Fill in your .env.local file.';
  if (code === 'invalid_login_credentials' || msg.includes('Invalid login credentials'))
    return 'Incorrect email or password.';
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed'))
    return 'Please confirm your email before signing in.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit'))
    return 'Too many attempts. Please wait a moment.';
  if (code === 'user_not_found')
    return 'No account found with this email.';
  return msg || 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const [fields, setFields] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [firebaseError, setFirebaseError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = Object.keys(validate(fields)).length === 0;
  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => touched[k] || submitted)
  );

  useEffect(() => { setErrors(validate(fields)); }, [fields]);

  const handleChange = (field) => (e) => {
    setFields(prev => ({ ...prev, [field]: e.target.value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    setFirebaseError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTouched({ email: true, password: true });
    if (!isValid) return;
    setLoading(true);
    setFirebaseError("");
    try {
      await loginUser({ email: fields.email, password: fields.password });
      // Don't push here. onAuthStateChanged will fire → useEffect above handles redirect.
    } catch (err) {
      setFirebaseError(friendlyError(err));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setFirebaseError("");
    try {
      await loginWithGoogle();
      // Redirects to Google — page navigates away, loading stays true
    } catch (err) {
      setFirebaseError(friendlyError(err));
      setLoading(false);
    }
  };

  // Show spinner while checking existing session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#C8654A] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center p-4">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ animation: "slideUp 0.4s ease both" }} className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C8654A] shadow-lg shadow-[#B0533A]/30 mb-4">
            <svg className="w-7 h-7 text-[#2A1F14]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#2A1F14] tracking-tight">Welcome back</h1>
          <p className="text-[#5A4A38] text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#FFFDF8]/80 backdrop-blur border border-[#EADFCB] rounded-2xl shadow-2xl shadow-black/40 p-8">
          {firebaseError && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-[#F4D9D5] border border-[#E0A89F] text-red-400 text-sm">
              {firebaseError}
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white text-[#2A1F14] text-sm font-semibold hover:bg-[#F4ECDF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#F4ECDF]" />
            <span className="text-xs text-[#8A7556]">or sign in with email</span>
            <div className="flex-1 h-px bg-[#F4ECDF]" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <InputField
              label="Email Address" id="email" type="email"
              value={fields.email} onChange={handleChange("email")}
              error={visibleErrors.email} placeholder="jane@example.com"
              autoComplete="email"
            />
            <InputField
              label="Password" id="password" type="password"
              value={fields.password} onChange={handleChange("password")}
              error={visibleErrors.password} placeholder="Enter your password"
              autoComplete="current-password"
            >
              <a href="/forgot-password" className="text-xs text-[#B0533A] hover:text-[#B0533A] transition-colors">
                Forgot password?
              </a>
            </InputField>

            <button
              type="submit"
              disabled={loading}
              className={`mt-1 w-full py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200
                ${loading
                  ? 'bg-[#C8654A] opacity-60 cursor-not-allowed'
                  : 'bg-[#C8654A] hover:bg-[#B0533A] active:scale-[0.98] shadow-lg shadow-[#B0533A]/25 cursor-pointer'
                }`}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8A7556] mt-6">
          Don't have an account?{" "}
          <a href="/register" className="text-[#B0533A] hover:text-[#B0533A] font-medium transition-colors underline underline-offset-2">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
