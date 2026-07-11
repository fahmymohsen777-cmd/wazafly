import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { Eye, Building, Clock, Search, FileText, Settings, Users, Plus, Bookmark, Star, Tag, User, MapPin, ChevronRight, BookmarkCheck } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function DashboardPage({ session, profile }: { session: any, profile: any }) {
  const { t, language } = useSettings();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ views: 0, companies: 0, lastViewed: null });
  const [loading, setLoading] = useState(true);
  
  // Job Seeker Profile Status State
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  
  // HR Team Management State
  const [company, setCompany] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [shortlistCount, setShortlistCount] = useState(0);
  const [resumesCount, setResumesCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [parentSubActive, setParentSubActive] = useState(false);
  const [userPlan, setUserPlan] = useState('');

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    if (profile?.role === 'admin') {
      navigate('/admin');
      return;
    }

    const handleSubscriptionSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      
      if (sessionId && profile?.role === 'hr') {
        // Mock saving the subscription for MVP
        // In a real app, this should be done via Stripe Webhooks
        try {
          // We don't know the exact plan from session_id easily here without calling Stripe,
          // so we'll just assume 'price_enterprise' for the sake of the demo if they just subscribed.
          // Or we could check if they already have one.
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (!existingSub) {
            await supabase.from('subscriptions').insert([{
              user_id: session.user.id,
              plan: 'price_enterprise', // Mocking enterprise for demo purposes
              status: 'active'
            }]);
          } else {
             await supabase.from('subscriptions')
              .update({ plan: 'price_enterprise', status: 'active' })
              .eq('user_id', session.user.id);
          }
          
          // Remove session_id from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error("Error saving mock subscription:", error);
        }
      }
    };

    handleSubscriptionSuccess();

    if (profile?.role === 'job_seeker') {
      fetchJobSeekerStats();
    } else if (profile?.role === 'hr') {
      fetchHrData();
    } else {
      setLoading(false);
    }
  }, [session, profile]);

  const fetchHrData = async () => {
    try {
      if (profile?.company_id) {
        const { data: comp } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
        if (comp) setCompany(comp);
        // Use supabaseAdmin to bypass any RLS caching issues when fetching recruiters
        const { data: members, error: membersError } = await supabaseAdmin
          .from('users')
          .select('*, profiles(name, email)')
          .eq('company_id', profile.company_id);
          
        if (membersError) console.error("Error fetching members:", membersError);
        
        if (members) {
          // Flatten the response for easier rendering
          const formattedMembers = members.map(m => {
            const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              ...m,
              email: profileData?.email || m.email || 'No email',
              name: profileData?.name || m.name || 'Unknown User'
            };
          });
          setTeamMembers(formattedMembers);
        }

        // If current user is a recruiter, check the admin's subscription
        // Use supabaseAdmin to bypass RLS (users can only see their own subscriptions)
        if (profile?.hr_role === 'recruiter' && comp?.admin_id) {
          const { data: adminSub } = await supabaseAdmin
            .from('subscriptions')
            .select('status')
            .eq('user_id', comp.admin_id)
            .eq('status', 'active')
            .single();
          if (adminSub) setParentSubActive(true);
        }

        // Fetch user plan to gate Team Management
        const { data: adminSubData } = await supabaseAdmin
          .from('subscriptions')
          .select('plan')
          .eq('user_id', comp?.admin_id || session.user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (adminSubData) setUserPlan(adminSubData.plan);

      } else {
        // No company yet, fetch their personal plan
        const { data: mySubData } = await supabaseAdmin
          .from('subscriptions')
          .select('plan')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (mySubData) setUserPlan(mySubData.plan);
      }

      // Fetch Basic Counts for Dashboard Widgets
      const condition = profile?.company_id 
        ? { col: 'company_id', val: profile.company_id } 
        : { col: 'recruiter_id', val: session.user.id };
        
      try {
        const { count: slCount } = await supabaseAdmin.from('shortlists')
          .select('*', { count: 'exact', head: true })
          .eq(condition.col, condition.val);
          
        let resumesUsers = [session.user.id];
        if (profile?.company_id) {
           const { data: teamIds } = await supabaseAdmin.from('users').select('id').eq('company_id', profile.company_id);
           if (teamIds) resumesUsers = teamIds.map(t => t.id);
        }
        
        const { count: resCount } = await supabaseAdmin.from('resumes')
          .select('*', { count: 'exact', head: true })
          .in('user_id', resumesUsers);
          
        setShortlistCount(slCount || 0);
        setResumesCount(resCount || 0);
      } catch (err) {
        console.error('Error fetching dashboard counts:', err);
      }
      
    } catch (error) {
      console.error('Error fetching HR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError('');
    try {
      // Create company
      const { data: newCompany, error: compError } = await supabase
        .from('companies')
        .insert([{ name: companyName, admin_id: session.user.id }])
        .select()
        .single();
        
      if (compError) throw compError;
      
      // Update user to admin_hr
      const { error: userError } = await supabase
        .from('users')
        .update({ company_id: newCompany.id, hr_role: 'admin_hr' })
        .eq('id', session.user.id);
        
      if (userError) throw userError;
      
      // Reload window to update profile context
      window.location.reload();
    } catch (err: any) {
      setActionError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleGenerateInviteLink = () => {
    if (!profile?.company_id) return;
    const inviteLink = `${window.location.origin}/register?company_id=${profile.company_id}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setActionSuccess('تم نسخ رابط الدعوة بنجاح بنجاح! شاركه مع فريقك.');
      setTimeout(() => setActionSuccess(''), 3000);
    }).catch(() => {
      setActionError('حدث خطأ أثناء نسخ الرابط.');
    });
  };

  const fetchJobSeekerStats = async () => {
    try {
      // Get profile ID
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id, last_active_at')
        .eq('user_id', session.user.id)
        .single();

      if (userProfile) {
        setLastActive(userProfile.last_active_at);

        // Get views
        const { data: views, error } = await supabase
          .from('profile_views')
          .select('hr_id, viewed_at')
          .eq('profile_id', userProfile.id)
          .order('viewed_at', { ascending: false });

        if (!error && views) {
          const uniqueCompanies = new Set(views.map(v => v.hr_id)).size;
          setStats({
            views: views.length,
            companies: uniqueCompanies,
            lastViewed: views.length > 0 ? views[0].viewed_at : null
          });
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    setRefreshSuccess(false);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ last_active_at: now })
        .eq('user_id', session.user.id);
        
      if (!error) {
        setLastActive(now);
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error refreshing status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      {/* Header */}
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 transition-colors">
        {profile?.role === 'hr' ? t('nav.dashboard') : `${t('dash.welcome')}, ${profile?.name || 'User'}`}
      </h1>

      {/* Recruiter company subscription banner */}
      {profile?.hr_role === 'recruiter' && company && (
        <div className={`mb-6 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium border transition-colors ${
          parentSubActive
            ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
        }`}>
          <span className="text-lg">{parentSubActive ? '✅' : '⚠️'}</span>
          <span>
            {parentSubActive
              ? `${t('dash.recruiter_active')} ${company.name} ${t('dash.recruiter_active_2')}`
              : `شركة ${company.name} ${t('dash.recruiter_inactive')}`}
          </span>
        </div>
      )}

      {profile?.role === 'job_seeker' ? (
        <div className="space-y-8">
          {/* Refresh Profile Banner */}
          <div className="bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {t('dash.refresh_status') || 'Refresh My Status'}
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                {t('dash.refresh_desc') || 'Click here to bump your profile to the top of HR search results!'}
              </p>
              {lastActive && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2 font-medium">
                  Last updated: {new Date(lastActive).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={handleRefreshStatus}
              disabled={refreshing || refreshSuccess}
              className="flex-shrink-0 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-70 flex items-center gap-2 shadow"
            >
              {refreshing ? '...' : refreshSuccess ? '✓ ' + (t('dash.refresh_success') || 'Success') : '🚀 ' + (t('dash.refresh_status') || 'Refresh')}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow rounded-lg border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Eye className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dash.seeker_views')}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.views}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow rounded-lg border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Building className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dash.seeker_companies')}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.companies}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow rounded-lg border border-gray-100">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{t('dash.seeker_last')}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {stats.lastViewed ? new Date(stats.lastViewed).toLocaleDateString() : 'Never'}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-10 mb-4">{t('dash.quick')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link to="/edit-profile" className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white dark:bg-slate-900 px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400">
              <div className="flex-shrink-0">
                <Settings className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('edit.title')}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dash.edit_desc')}</p>
              </div>
            </Link>

            <Link to="/upload-cv" className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white dark:bg-slate-900 px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dash.upload_cv')}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dash.upload_desc')}</p>
              </div>
            </Link>

            <Link to="/cv-builder" className="relative flex items-center space-x-3 rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/20 dark:border-indigo-800 px-6 py-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="flex-shrink-0">
                <Plus className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{language === 'ar' ? 'منشئ السيرة الذاتية' : 'CV Builder'}</p>
                <p className="truncate text-sm text-indigo-500 dark:text-indigo-400">{language === 'ar' ? 'أنشئ سيرتك باحترافية وحملها PDF' : 'Build a pro CV, download as PDF'}</p>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">{t('dash.hr_find')}</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                <p>{t('dash.hr_find_desc')}</p>
              </div>
              <div className="mt-5">
                <Link
                  to="/search"
                  className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <Search className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                  {t('dash.hr_go_search')}
                </Link>
              </div>
            </div>
          </div>

          {/* HR Dashboard Statistical Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow sm:rounded-lg border border-gray-100 dark:border-slate-800 transition-colors">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BookmarkCheck className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{t('dash.hr_saved') || 'Shortlisted Candidates'}</dt>
                      <dd>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{shortlistCount}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 px-5 py-3 border-t border-gray-100 dark:border-slate-800">
                <div className="text-sm">
                  <Link to="/shortlist" className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1">
                    View Shortlist <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow sm:rounded-lg border border-gray-100 dark:border-slate-800 transition-colors">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{t('dash.cv_bank') || 'Resumes Processed'}</dt>
                      <dd>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{resumesCount}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 px-5 py-3 border-t border-gray-100 dark:border-slate-800">
                <div className="text-sm">
                  <Link to="/cv-bank" className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1">
                    Open AI Bank <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 overflow-hidden shadow sm:rounded-lg border border-gray-100 dark:border-slate-800 transition-colors">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Subscription Plan</dt>
                      <dd>
                        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                           {parentSubActive ? 'Company Managed' : (userPlan ? userPlan.split('_')[1] : 'Free / Trial')}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 px-5 py-3 border-t border-gray-100 dark:border-slate-800">
                <div className="text-sm">
                  <Link to="/subscription" className="font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1">
                    Manage Billing <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {profile?.hr_role !== 'recruiter' && (
            <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">{t('dash.hr_sub')}</h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                  <p>{t('dash.hr_sub_desc')}</p>
                </div>
                <div className="mt-5">
                  <Link
                    to="/subscription"
                    className="inline-flex items-center rounded-md bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:bg-slate-800"
                  >
                    {t('dash.hr_manage_sub')}
                  </Link>
                </div>
              </div>
            </div>
          )}
          {/* Team Management */}
          {profile?.role === 'hr' && (
            <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg transition-colors border border-gray-100 dark:border-slate-800">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  {t('dash.hr_team')}
                </h3>
              
              {(!userPlan || ['basic', 'price_basic'].includes(userPlan)) ? (
                <div className="mt-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800/50">
                  <div className="flex">
                    <div className="ml-3 font-arabic">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                        {t('dash.team_premium_req') || 'Premium Feature Restricted'}
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                        <p>
                          {t('dash.team_premium_desc') || 'Team Management and Company Profiles are exclusively available on Pro and Enterprise plans. Please upgrade your subscription to invite recruiters and manage your HR team.'}
                        </p>
                      </div>
                      <div className="mt-4">
                        <Link to="/subscription" className="text-sm font-medium text-yellow-800 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-200 underline">
                          {t('dash.hr_manage_sub')} &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : profile?.hr_role === 'recruiter' && !profile?.company_id ? (
                <div className="mt-4 rounded-md bg-indigo-50 dark:bg-indigo-900/20 p-4 border border-indigo-200 dark:border-indigo-800/50">
                  <div className="flex">
                    <div className="ml-3 font-arabic">
                      <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                        {t('dash.personal_mode_req') || 'Personal HR Account'}
                      </h3>
                      <div className="mt-2 text-sm text-indigo-700 dark:text-indigo-400">
                        <p>
                          {t('dash.personal_mode_desc') || 'You are currently registered as a Personal HR. To create a company profile or build a recruitment team, please contact Support to upgrade your account designation.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {actionError && <div className="mt-4 text-sm text-red-600">{actionError}</div>}
              {actionSuccess && <div className="mt-4 text-sm text-green-600">{actionSuccess}</div>}

              {profile?.company_id ? (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{t('dash.hr_company')} {company?.name}</p>
                  
                  <div className="mb-6">
                    <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">{t('dash.hr_team_members')}</h4>
                    <div className="overflow-x-auto">
                      <ul className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-200 dark:border-slate-700 rounded-md min-w-[400px]">
                        {teamMembers.map((member: any) => (
                          <li key={member.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 text-sm gap-2 w-full hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</span>
                              <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{member.email}</span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs shrink-0 ${member.hr_role === 'admin_hr' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-400 font-medium' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 font-medium'}`}>
                              {member.hr_role === 'admin_hr' ? t('dash.hr_admin') : t('dash.hr_recruiter')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {(!profile?.hr_role || profile?.hr_role === 'admin_hr') && (
                    <div className="mt-4">
                      <button
                        onClick={handleGenerateInviteLink}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                      >
                        <Plus className="-ml-0.5 mr-1.5 h-4 w-4" /> {t('dash.hr_invite')}
                      </button>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('dash.hr_invite_desc')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('dash.hr_no_company')}</p>
                  <form onSubmit={handleCreateCompany} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={t('dash.hr_company_name')}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-shrink-0 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {t('dash.hr_create_company')}
                    </button>
                  </form>
                </div>
              )}
              </>
            )}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
