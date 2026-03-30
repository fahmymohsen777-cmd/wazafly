import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase, supabaseAdmin } from '../lib/supabase';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('job_seeker');
  const [isAdminHr, setIsAdminHr] = useState(false); // Force default to recruiter (Personal HR)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const [inviteCompanyName, setInviteCompanyName] = useState('');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const companyId = queryParams.get('company_id');
    if (companyId) {
      setInviteCompanyId(companyId);
      setRole('hr');
      setIsAdminHr(false); // Forced recruiter flow
      // Fetch company name
      supabase.from('companies').select('name').eq('id', companyId).single().then(({ data }) => {
        if (data) setInviteCompanyName(data.name);
      });
    }
  }, [location]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Check if user already exists (Supabase returns fake user with empty identities)
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('هذا البريد الإلكتروني مسجّل بالفعل.');
        }

        const hrRole = role === 'hr' ? 'recruiter' : null; // Always recruiter (Personal HR) initially unless admin transforms them

        // Upsert user record — more resilient than insert (handles re-registration edge cases)
        const { error: dbError } = await supabaseAdmin
          .from('users')
          .upsert([
            {
              id: data.user.id,
              email: data.user.email,
              role,
              hr_role: hrRole,
              company_id: inviteCompanyId ?? null
            }
          ], { onConflict: 'id' });

        if (dbError) throw dbError;

        // Always create a profile (HR + Job Seeker both need one)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert([{
            user_id: data.user.id,
            name,
            phone,
            email: data.user.email
          }], { onConflict: 'user_id' });

        if (profileError) console.error('Profile creation error (non-fatal):', profileError);

        // Check if session is established (email confirmation may be required)
        if (data.session) {
          // Logged in immediately -> go to dashboard
          navigate('/dashboard');
        } else {
          // Email confirmation required
          setError('');
          setRegistrationSuccess(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900 dark:text-gray-100">
          Create an account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {registrationSuccess ? (
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg p-8 text-center border border-gray-100 dark:border-slate-800 transition-colors">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 font-arabic">تم إنشاء الحساب بنجاح!</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 font-arabic leading-relaxed">
              لقد أرسلنا رابط تفعيل إلى بريدك الإلكتروني <strong>{email}</strong>. يرجى التحقق من صندوق الوارد (أو مجلد الرسائل غير المرغوب فيها) والضغط على الرابط لتأكيد حسابك.
            </p>
            <Link
              to="/login"
              className="w-full inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              الذهاب إلى صفحة الدخول
            </Link>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleRegister}>
          {inviteCompanyName && (
            <div className="bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-md text-sm mb-6 flex items-center justify-center font-medium transition-colors">
              أنت بصدد الانضمام لفريق شركة {inviteCompanyName}
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm transition-colors">
              {error}
            </div>
          )}
          
          {!inviteCompanyId && (
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">I am a...</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div
                onClick={() => setRole('job_seeker')}
                className={`cursor-pointer rounded-lg border p-4 text-center ${role === 'job_seeker' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100'}`}
              >
                <span className="block text-sm font-medium">Job Seeker</span>
              </div>
              <div
                onClick={() => setRole('hr')}
                className={`cursor-pointer rounded-lg border p-4 text-center ${role === 'hr' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100'}`}
              >
                <span className="block text-sm font-medium">HR</span>
              </div>
            </div>
            
            {role === 'hr' && !inviteCompanyId && (
              <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors">
                <div className="flex">
                  <div className="ml-3 text-sm leading-6 text-start font-arabic">
                    <p className="text-indigo-800 dark:text-indigo-300">
                      سيتم تسجيلك تلقائياً كمسؤول موارد بشرية شخصي (Personal HR). إذا كنت ترغب في تأسيس ملف لشركتك وإدارة فريق، يرجى التواصل مع الدعم الفني بعد التسجيل لترقية نوع حسابك.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Full Name
            </label>
            <div className="mt-2">
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Phone Number
            </label>
            <div className="mt-2">
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
              Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
        )}

        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
