'use client';

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { registerUser, loginWithGoogle } from '../../../app/lib/auth';
import { useAuth } from '@/components/AuthProvider';

const ROLES = { TEACHER: "teacher", STUDENT: "student" };

function InputField({ label, id, type = "text", value, onChange, error, placeholder, autoComplete }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[#5A4A38]">
        {label}
      </label>
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
          outline-none transition-all duration-200 text-sm
          ${focused ? "border-[#C8654A] shadow-[0_0_0_3px_rgba(200,101,74,0.18)]" : "border-[#DCC9A8]"}
          ${error ? "border-[#B85A4F] shadow-[0_0_0_3px_rgba(184,90,79,0.18)]" : ""}
          hover:border-[#DCC9A8]
        `}
      />
      {error && (
        <p className="text-xs text-red-400 mt-0.5 animate-[fadeIn_0.2s_ease]">{error}</p>
      )}
    </div>
  );
}

function validate(fields) {
  const errors = {};
  if (!fields.name.trim()) errors.name = "Full name is required.";
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (!fields.confirm) {
    errors.confirm = "Please confirm your password.";
  } else if (fields.password !== fields.confirm) {
    errors.confirm = "Passwords do not match.";
  }
  return errors;
}

function friendlyError(err) {
  const code = err?.code;
  const msg  = err?.message ?? '';
  if (code === 'auth/not-configured')
    return 'Supabase is not configured. Fill in your .env.local file.';
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return 'An account with this email already exists.';
  if (code === 'weak_password' || msg.includes('Password should be'))
    return 'Password is too weak (minimum 6 characters).';
  return msg || 'Something went wrong. Please try again.';
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const [role, setRole] = useState(ROLES.STUDENT);
  const [fields, setFields] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [firebaseError, setFirebaseError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => touched[k] || submitted)
  );

  const isValid = Object.keys(validate(fields)).length === 0;

  useEffect(() => {
    setErrors(validate(fields));
  }, [fields]);

  const handleChange = (field) => (e) => {
    setFields((prev) => ({ ...prev, [field]: e.target.value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (!isValid) return;
    setLoading(true);
    setFirebaseError("");
    setInfoMessage("");
    try {
      const { session } = await registerUser({ name: fields.name, email: fields.email, password: fields.password, role });
      if (!session) {
        // Email confirmation is required — no auth state change will fire
        setLoading(false);
        setInfoMessage("Account created! Check your inbox to confirm your email, then sign in.");
        return;
      }
      // Session exists → AuthProvider's onAuthStateChange will fire → useEffect redirects
    } catch (err) {
      setFirebaseError(friendlyError(err));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setFirebaseError("");
    try {
      await loginWithGoogle(role);
      // Redirects to Google — page navigates away, loading stays true
    } catch (err) {
      setFirebaseError(friendlyError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center p-4">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="w-full max-w-md" style={{ animation: "slideUp 0.4s ease both" }}>
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C8654A] shadow-lg shadow-[#B0533A]/30 mb-4">
            <svg className="w-7 h-7 text-[#2A1F14]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#2A1F14] tracking-tight">Create your account</h1>
          <p className="text-[#5A4A38] text-sm mt-1">Join the learning community today</p>
        </div>

        {/* Card */}
        <div className="bg-[#FFFDF8]/80 backdrop-blur border border-[#EADFCB] rounded-2xl shadow-2xl shadow-black/40 p-8">
          {firebaseError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#F4D9D5] border border-[#E0A89F] text-red-400 text-sm">
              {firebaseError}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#E6EBD5] border border-[#7A8C5C]/30 text-[#4F5F36] text-sm">
              {infoMessage}
            </div>
          )}

          {/* Role selector */}
          <div className="mb-5">
            <p className="text-sm font-medium text-[#5A4A38] mb-2">I am a</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole(ROLES.TEACHER)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150
                  ${role === ROLES.TEACHER
                    ? 'bg-[#C8654A] border-[#C8654A] text-white shadow-lg shadow-[#B0533A]/25'
                    : 'bg-[#F4ECDF]/60 border-[#DCC9A8] text-[#5A4A38] hover:text-white hover:border-[#C8654A]'
                  }`}
              >
                👩‍🏫 Teacher
              </button>
              <button
                type="button"
                onClick={() => setRole(ROLES.STUDENT)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150
                  ${role === ROLES.STUDENT
                    ? 'bg-[#C8654A] border-[#C8654A] text-white shadow-lg shadow-[#B0533A]/25'
                    : 'bg-[#F4ECDF]/60 border-[#DCC9A8] text-[#5A4A38] hover:text-white hover:border-[#C8654A]'
                  }`}
              >
                🎓 Student
              </button>
            </div>
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white text-[#2A1F14] text-sm font-semibold hover:bg-[#F4ECDF] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#F4ECDF]" />
            <span className="text-xs text-[#8A7556]">or register with email</span>
            <div className="flex-1 h-px bg-[#F4ECDF]" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <InputField
              label="Full Name"
              id="name"
              value={fields.name}
              onChange={handleChange("name")}
              error={visibleErrors.name}
              placeholder="Jane Smith"
              autoComplete="name"
            />
            <InputField
              label="Email Address"
              id="email"
              type="email"
              value={fields.email}
              onChange={handleChange("email")}
              error={visibleErrors.email}
              placeholder="jane@example.com"
              autoComplete="email"
            />
            <InputField
              label="Password"
              id="password"
              type="password"
              value={fields.password}
              onChange={handleChange("password")}
              error={visibleErrors.password}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            <InputField
              label="Confirm Password"
              id="confirm"
              type="password"
              value={fields.confirm}
              onChange={handleChange("confirm")}
              error={visibleErrors.confirm}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading || (submitted && !isValid)}
              className={`
                mt-1 w-full py-3 px-6 rounded-xl font-semibold text-sm text-white
                transition-all duration-200
                ${isValid && !loading
                  ? "bg-[#C8654A] hover:bg-[#B0533A] active:scale-[0.98] shadow-lg shadow-[#B0533A]/25 cursor-pointer"
                  : "bg-[#EBDFC6] text-[#8A7556] cursor-not-allowed opacity-60"
                }
              `}
            >
              {loading ? 'Creating account…' : `Create ${role === ROLES.TEACHER ? "Teacher" : "Student"} Account`}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#8A7556] mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#B0533A] hover:text-[#B0533A] font-medium transition-colors duration-150 underline underline-offset-2">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
