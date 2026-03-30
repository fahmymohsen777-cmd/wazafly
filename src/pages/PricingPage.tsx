import React, { useState } from 'react';
import { Check, Upload, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

const getTiers = (language: string) => [
  {
    name: 'Basic',
    id: 'price_basic',
    href: '#',
    priceMonthly: '500',
    description: language === 'ar' ? 'مِثالي للشركات الصغيرة التي توظف من حين لآخر.' : 'Perfect for small companies hiring occasionally.',
    features: language === 'ar' 
      ? ['١٠٠ مشاهدة للملفات شهرياً', 'فلاتر بحث أساسية', 'دعم عبر البريد الإلكتروني'] 
      : ['100 profile views per month', 'Basic search filters', 'Email support'],
    mostPopular: false,
  },
  {
    name: 'Pro',
    id: 'price_pro',
    href: '#',
    priceMonthly: '1250',
    description: language === 'ar' ? 'للفرق المتنامية التي تحتاج للتوظيف السريع.' : 'For growing teams that need to hire fast.',
    features: language === 'ar'
      ? ['بحث غير محدود', 'تحميل سيرة ذاتية غير محدود', 'فلاتر متقدمة', 'أولوية الدعم الفني']
      : ['Unlimited search', 'Unlimited CV downloads', 'Advanced filters', 'Priority email support'],
    mostPopular: true,
  },
  {
    name: 'Enterprise',
    id: 'price_enterprise',
    href: '#',
    priceMonthly: '2500',
    description: language === 'ar' ? 'دعم مخصص وميزات ذكاء اصطناعي متقدمة.' : 'Dedicated support and advanced AI features.',
    features: language === 'ar'
      ? ['ترتيب المرشحين بالذكاء الاصطناعي', 'فلاتر متقدمة', 'نتائج مفضلة', 'مدير حساب مخصص', 'وصول برمجي API']
      : ['AI candidate ranking', 'Advanced filters', 'Priority results', 'Dedicated account manager', 'API access'],
    mostPopular: false,
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function PricingPage({ session, profile }: { session: any, profile: any }) {
  const { language } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubscribeClick = (priceId: string) => {
    if (!session) {
      navigate('/login');
      return;
    }

    if (profile?.role === 'job_seeker') {
      alert('Job seekers do not need to subscribe. This is for HR only.');
      return;
    }

    setSelectedPlan(priceId);
    setShowPaymentModal(true);
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabaseAdmin.storage
        .from('payments')
        .upload(filePath, file);

      if (uploadError && uploadError.message.includes('Bucket not found')) {
        // Try to create the bucket if it doesn't exist
        const { error: createError } = await supabaseAdmin.storage.createBucket('payments', { public: true });
        if (!createError) {
          const retry = await supabaseAdmin.storage.from('payments').upload(filePath, file);
          uploadError = retry.error;
        } else {
          throw new Error('Storage bucket "payments" is missing. Please run the latest SQL schema in your Supabase dashboard.');
        }
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payments')
        .getPublicUrl(filePath);

      // Create payment record
      const { error: dbError } = await supabaseAdmin
        .from('payments')
        .insert([
          { user_id: session.user.id, method: 'manual_transfer', screenshot_url: publicUrl, status: 'pending' }
        ]);

      if (dbError) throw dbError;

      setPaymentSuccess(true);
    } catch (err: any) {
      console.error('Error uploading payment:', err);
      alert(err.message || 'Failed to upload payment screenshot.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
            Pricing plans for teams of all sizes
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600 dark:text-gray-300">
          Choose an affordable plan that's packed with the best features for engaging your audience, creating customer
          loyalty, and driving sales.
        </p>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-0">
          {getTiers(language).map((tier) => (
            <div
              key={tier.id}
              className={classNames(
                tier.mostPopular ? 'ring-2 ring-indigo-600' : 'ring-1 ring-gray-200',
                'rounded-3xl p-8 xl:p-10 flex flex-col justify-between'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3
                    id={tier.id}
                    className={classNames(
                      tier.mostPopular ? 'text-indigo-600' : 'text-gray-900 dark:text-gray-100',
                      'text-lg font-semibold leading-8'
                    )}
                  >
                    {tier.name}
                  </h3>
                  {tier.mostPopular ? (
                    <p className="rounded-full bg-indigo-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-indigo-600">
                      Most popular
                    </p>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{tier.priceMonthly}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-600 dark:text-gray-300">
                    {language === 'ar' ? 'ج.م / شهر' : 'EGP / month'}
                  </span>
                </p>
                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <Check className="h-6 w-5 flex-none text-indigo-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handleSubscribeClick(tier.id)}
                disabled={loading === tier.id}
                aria-describedby={tier.id}
                className={classNames(
                  tier.mostPopular
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500'
                    : 'text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300',
                  'mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 w-full'
                )}
              >
                {loading === tier.id ? 'Processing...' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            {paymentSuccess ? (
              <div className="text-center py-6">
                <div className="bg-green-100 dark:bg-green-900/40 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Upload Successful!
                </h3>
                <p className="text-base text-gray-500 dark:text-gray-400 mb-8 px-4">
                  Thank you. An admin will review your receipt shortly and activate your premium subscription.
                </p>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentSuccess(false);
                    navigate('/dashboard');
                  }}
                  className="w-full inline-flex justify-center items-center rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white shadow-md hover:bg-indigo-500 hover:shadow-lg focus:outline-none transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Manual Payment</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Please transfer the amount to our bank account and upload the receipt screenshot here.
                </p>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mb-6 text-sm text-gray-700 dark:text-gray-300">
                  <p className="mb-2"><strong className="text-gray-900 dark:text-gray-100">Bank:</strong> Example Bank</p>
                  <p className="mb-2"><strong className="text-gray-900 dark:text-gray-100">Account Name:</strong> Reverse Job Board</p>
                  <p><strong className="text-gray-900 dark:text-gray-100">Account Number:</strong> 1234567890</p>
                </div>
                
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Receipt</label>
                  <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${uploading ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'}`}>
                    <div className="space-y-2 text-center">
                      <Upload className={`mx-auto h-12 w-12 ${uploading ? 'text-indigo-500 animate-bounce' : 'text-gray-400'}`} />
                      <div className="flex text-sm text-gray-600 dark:text-gray-300 justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none"
                        >
                          <span>{uploading ? 'Uploading securely...' : 'Click to select a file'}</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handlePaymentUpload} disabled={uploading} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
