import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ text: 'Check your email for the login link!', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2rem] shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-4 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            {isLogin ? 'Access your quantitative trading dashboard' : 'Start your AI trading journey today'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-4 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="email"
                placeholder="quant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Password</label>
            <div className="relative group">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${message.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs font-medium text-slate-500">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
              className="ml-2 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};