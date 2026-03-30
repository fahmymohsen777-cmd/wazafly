import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

export default function SubscriptionPage({ session, profile }: { session: any, profile: any }) {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }

    if (profile?.role !== 'hr') {
      navigate('/dashboard');
      return;
    }

    fetchSubscription();
  }, [session, profile]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore not found
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 min-h-screen">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10" dir={t('dir') || 'rtl'}>
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
            {t('sub.title') || 'Subscription Management'}
          </h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg border border-gray-100 dark:border-slate-800">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">{t('sub.current_plan') || 'Current Plan'}</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            {subscription?.status === 'active' ? (
              <p>{t('sub.active_msg') || 'You are currently subscribed to the'} <span className="font-bold text-indigo-600 dark:text-indigo-400 mx-1 uppercase">{subscription.plan?.replace('price_', '')}</span> {t('sub.plan_word') || 'plan.'}</p>
            ) : (
              <p>{t('sub.no_active') || 'You do not have an active subscription.'}</p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {subscription?.status === 'active' ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                >
                  {t('sub.upgrade') || 'Upgrade Plan'}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('sub.cancel') || 'Cancel Subscription'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                {t('sub.view_plans') || 'View Plans'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
