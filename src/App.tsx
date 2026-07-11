import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, Suspense, lazy, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './lib/supabase';
import {
  LogOut, User, Search, Briefcase, Sun, Moon, Globe, Bell,
  BookmarkCheck, FileText, Settings, Menu, X, WifiOff
} from 'lucide-react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// ─── Lazy Pages ───────────────────────────────────────────────────────────────
const LandingPage         = lazy(() => import('./pages/LandingPage'));
const LoginPage           = lazy(() => import('./pages/LoginPage'));
const RegisterPage        = lazy(() => import('./pages/RegisterPage'));
const DashboardPage       = lazy(() => import('./pages/DashboardPage'));
const ProfilePage         = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage     = lazy(() => import('./pages/EditProfilePage'));
const UploadCVPage        = lazy(() => import('./pages/UploadCVPage'));
const SearchPage          = lazy(() => import('./pages/SearchPage'));
const PricingPage         = lazy(() => import('./pages/PricingPage'));
const SubscriptionPage    = lazy(() => import('./pages/SubscriptionPage'));
const CandidateProfilePage = lazy(() => import('./pages/CandidateProfilePage'));
const ForgotPasswordPage  = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage   = lazy(() => import('./pages/ResetPasswordPage'));
const AdminDashboardPage  = lazy(() => import('./pages/AdminDashboardPage'));
const CVBankPage          = lazy(() => import('./pages/cvBank/CVBankPage'));
const ShortlistPage       = lazy(() => import('./pages/ShortlistPage'));
const HrSettingsPage      = lazy(() => import('./pages/HrSettingsPage'));
const JobSeekerSettingsPage = lazy(() => import('./pages/JobSeekerSettingsPage'));
const CvBuilderPage       = lazy(() => import('./pages/CvBuilderPage'));
const PublicUploadPage    = lazy(() => import('./pages/PublicUploadPage'));

// ─── Page transition variants ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

// ─── Network Banner ───────────────────────────────────────────────────────────
function NetworkBanner() {
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (!isOnline) {
      toast('لا يوجد اتصال بالإنترنت — تحقق من شبكتك.', 'warning', 0);
    } else {
      toast('تم استعادة الاتصال.', 'success', 3000);
    }
  // Only trigger on actual changes, not initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="fixed top-16 inset-x-0 z-40 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-semibold py-2 px-4">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>لا يوجد اتصال بالإنترنت</span>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({
  session, profile, notifications, onMarkAllRead,
}: {
  session: any; profile: any; notifications: any[]; onMarkAllRead: () => void;
}) {
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage, t } = useSettings();
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center shrink-0 w-1/4">
            <Link to="/" className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-gray-100">Wazafly</span>
            </Link>
          </div>

          {/* Navigation – Desktop */}
          <div className="hidden sm:flex flex-1 justify-center items-center space-x-6">
            {!session ? (
              <Link to="/pricing" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                {t('nav.pricing')}
              </Link>
            ) : (
              <>
                <Link to="/dashboard" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.dashboard')}</Link>
                {profile?.role === 'hr' && (
                  <>
                    <Link to="/search" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.search') || 'بحث'}</Link>
                    <Link to="/cv-bank" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('dash.open_cv_bank') || 'بنك السير'}</Link>
                  </>
                )}
                {profile?.role === 'job_seeker' && (
                  <>
                    <Link to="/profile" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.profile')}</Link>
                    <Link to="/cv-builder" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{language === 'ar' ? 'منشئ السيرة' : 'CV Builder'}</Link>
                  </>
                )}
                {profile?.role === 'admin' && (
                  <Link to="/admin" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.admin')}</Link>
                )}
              </>
            )}
          </div>

          {/* Actions – Desktop */}
          <div className="hidden sm:flex items-center justify-end space-x-3 w-1/4 shrink-0">
            {/* Theme & language toggles */}
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Globe className="h-4 w-4" />
            </button>

            {!session ? (
              <>
                <Link to="/login" className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.login')}</Link>
                <Link to="/register" className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors">{t('nav.signup')}</Link>
              </>
            ) : (
              <>
                {profile?.role === 'hr' && (
                  <Link to="/hr-settings" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title={t('nav.settings') || 'الإعدادات'}>
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                {profile?.role === 'job_seeker' && (
                  <Link to="/settings" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title={language === 'ar' ? 'الإعدادات' : 'Settings'}>
                    <Settings className="h-5 w-5" />
                  </Link>
                )}

                {/* Bell — job seekers */}
                {profile?.role === 'job_seeker' && (
                  <div ref={bellRef} className="relative">
                    <button
                      onClick={() => { setBellOpen(!bellOpen); if (!bellOpen && unreadCount > 0) onMarkAllRead(); }}
                      className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    <AnimatePresence>
                      {bellOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden origin-top-right"
                        >
                          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">الإشعارات</p>
                          </div>
                          <ul className="divide-y divide-gray-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">لا توجد إشعارات</li>
                            ) : notifications.map(n => (
                              <li key={n.id} className={`px-4 py-3 text-sm ${n.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium bg-indigo-50 dark:bg-indigo-900/20'}`}>
                                <p>{n.message}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(n.created_at).toLocaleString('ar-EG')}</p>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <button onClick={handleLogout} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title={t('nav.logout')}>
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex sm:hidden items-center justify-end flex-1">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-500 dark:text-gray-400">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden overflow-hidden border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <div className="px-4 py-3 space-y-2 flex flex-col">
              {!session ? (
                <>
                  <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.pricing')}</Link>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.login')}</Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium bg-indigo-600 text-white hover:bg-indigo-700 text-center">{t('nav.signup')}</Link>
                </>
              ) : (
                <>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.dashboard')}</Link>
                  {profile?.role === 'hr' && (
                    <>
                      <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.search') || 'بحث'}</Link>
                      <Link to="/cv-bank" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('dash.open_cv_bank') || 'بنك السير'}</Link>
                      <Link to="/hr-settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Settings className="h-5 w-5 text-gray-500" /> {t('nav.settings') || 'الإعدادات'}
                      </Link>
                    </>
                  )}
                  {profile?.role === 'job_seeker' && (
                    <>
                      <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.profile')}</Link>
                      <Link to="/cv-builder" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{language === 'ar' ? 'منشئ السيرة' : 'CV Builder'}</Link>
                      <Link to="/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Settings className="h-5 w-5 text-gray-500" /> {language === 'ar' ? 'الإعدادات' : 'Settings'}
                      </Link>
                    </>
                  )}
                  {profile?.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t('nav.admin')}</Link>
                  )}
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 mt-4 rounded-md text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-start">
                    <LogOut className="h-5 w-5" /> {t('nav.logout')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Animated Routes ──────────────────────────────────────────────────────────
function AnimatedRoutes({
  session, profile,
}: { session: any; profile: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Session expiry watch
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_OUT' && session) {
        toast('انتهت جلستك — يرجى تسجيل الدخول مجدداً.', 'warning', 5000);
        navigate('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [session, navigate, toast]);

  return (
    <AnimatePresence mode="wait">
      {/* @ts-ignore - react-router-dom RoutesProps doesn't explicitly list key but React requires it for AnimatePresence */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><LoginPage /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><RegisterPage /></PageWrapper>} />
        <Route path="/forgot-password" element={<PageWrapper><ForgotPasswordPage /></PageWrapper>} />
        <Route path="/reset-password" element={<PageWrapper><ResetPasswordPage /></PageWrapper>} />
        <Route path="/pricing" element={<PageWrapper><PricingPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/dashboard" element={<PageWrapper><DashboardPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/profile" element={<PageWrapper><ProfilePage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/edit-profile" element={<PageWrapper><EditProfilePage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/upload-cv" element={<PageWrapper><UploadCVPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/search" element={<PageWrapper><SearchPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/subscription" element={<PageWrapper><SubscriptionPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/candidate-profile/:id" element={<PageWrapper><CandidateProfilePage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/cv-bank" element={<PageWrapper><CVBankPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/shortlist" element={<PageWrapper><ShortlistPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/hr-settings" element={<PageWrapper><HrSettingsPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><JobSeekerSettingsPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/admin" element={<PageWrapper><AdminDashboardPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/cv-builder" element={<PageWrapper><CvBuilderPage session={session} profile={profile} /></PageWrapper>} />
        <Route path="/upload/:token" element={<PageWrapper><PublicUploadPage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markAllRead = async () => {
    if (!session) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
      if (data?.role === 'job_seeker') fetchNotifications(userId);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setNotifications([]); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <SettingsProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
            <Navbar session={session} profile={profile} notifications={notifications} onMarkAllRead={markAllRead} />
            <NetworkBanner />
            <main className="flex-grow">
              <ErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <AnimatedRoutes session={session} profile={profile} />
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}
