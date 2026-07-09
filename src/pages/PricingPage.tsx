import React, { useState } from 'react';
import { Check, Upload, CheckCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { motion } from 'framer-motion';

const getTiers = (language: string) => [
  {
    name: 'Basic',
    id: 'price_basic',
    priceMonthly: '500',
    description: language === 'ar' ? 'مِثالي للشركات الصغيرة التي توظف من حين لآخر.' : 'Perfect for small companies hiring occasionally.',
    features: language === 'ar'
      ? ['١٠٠ مشاهدة للملفات شهرياً', 'فلاتر بحث أساسية', 'دعم عبر البريد الإلكتروني']
      : ['100 profile views per month', 'Basic search filters', 'Email support'],
    mostPopular: false,
    accent: 'border-gray-200 dark:border-slate-700',
    badge: '',
  },
  {
    name: 'Pro',
    id: 'price_pro',
    priceMonthly: '1250',
    description: language === 'ar' ? 'للفرق المتنامية التي تحتاج للتوظيف السريع.' : 'For growing teams that need to hire fast.',
    features: language === 'ar'
      ? ['بحث غير محدود', 'تحميل سيرة ذاتية غير محدود', 'فلاتر متقدمة', 'أولوية الدعم الفني']
      : ['Unlimited search', 'Unlimited CV downloads', 'Advanced filters', 'Priority email support'],
    mostPopular: true,
    accent: 'border-indigo-500 ring-2 ring-indigo-500',
    badge: language === 'ar' ? 'الأكثر شعبية' : 'Most Popular',
  },
  {
    name: 'Enterprise',
    id: 'price_enterprise',
    priceMonthly: '2500',
    description: language === 'ar' ? 'دعم مخصص وميزات ذكاء اصطناعي متقدمة.' : 'Dedicated support and advanced AI features.',
    features: language === 'ar'
      ? ['ترتيب المرشحين بالذكاء الاصطناعي', 'فلاتر متقدمة', 'نتائج مفضلة', 'مدير حساب مخصص', 'وصول برمجي API']
      : ['AI candidate ranking', 'Advanced filters', 'Priority results', 'Dedicated account manager', 'API access'],
    mostPopular: false,
    accent: 'border-gray-200 dark:border-slate-700',
    badge: '',
  },
];

export default function PricingPage({ session, profile }: { session: any; profile: any }) {
  const { language } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const isAr = language === 'ar';

  const handleSubscribeClick = (priceId: string) => {
    if (!session) { navigate('/login'); return; }
    if (profile?.role === 'job_seeker') {
      toast('باقات الاشتراك مخصصة لحسابات الـ HR فقط.', 'info');
      return;
    }
    setSelectedPlan(priceId);
    setShowPaymentModal(true);
  };

  const handlePaymentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) throw new Error('يرجى اختيار صورة الإيصال.');
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 10 ميجابايت.');

      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}-${Date.now()}.${fileExt}`;

      let { error: uploadError } = await supabase.storage.from('payments').upload(filePath, file);

      if (uploadError?.message.includes('Bucket not found')) {
        const { error: createError } = await supabase.storage.createBucket('payments', { public: true });
        if (!createError) {
          const retry = await supabase.storage.from('payments').upload(filePath, file);
          uploadError = retry.error;
        } else {
          throw new Error('مجلد التخزين "payments" غير موجود — تواصل مع الدعم الفني.');
        }
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('payments').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('payments').insert([
        { user_id: session.user.id, method: 'manual_transfer', screenshot_url: publicUrl, status: 'pending' }
      ]);

      if (dbError) throw dbError;
      setPaymentSuccess(true);
      toast('تم رفع الإيصال بنجاح — سيتم مراجعته قريباً.', 'success');
    } catch (err: any) {
      toast(err.message || 'فشل رفع الإيصال — حاول مرة أخرى.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const tiers = getTiers(language);

  const cardVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <div className="bg-white dark:bg-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700 mb-4">
            <Zap className="h-3.5 w-3.5" />
            {isAr ? 'الأسعار' : 'Pricing'}
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
            {isAr ? 'خطط لكل حجم فريق' : 'Plans for teams of all sizes'}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {isAr
              ? 'اختر الباقة المناسبة لك وابدأ في الوصول إلى أفضل المرشحين في مصر.'
              : 'Choose the right plan and start reaching top candidates in Egypt.'}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-0">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`
                relative rounded-3xl p-8 xl:p-10 flex flex-col justify-between border transition-shadow duration-300
                bg-white dark:bg-slate-800 hover:shadow-xl dark:hover:shadow-indigo-900/20
                ${tier.accent}
                ${tier.mostPopular ? 'shadow-lg' : 'shadow-sm'}
              `}
            >
              {tier.mostPopular && (
                <div className="absolute -top-4 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
                    <Zap className="h-3 w-3" /> {tier.badge}
                  </span>
                </div>
              )}

              <div>
                <h3 className={`text-lg font-semibold leading-8 ${tier.mostPopular ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {tier.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{tier.priceMonthly}</span>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{isAr ? 'ج.م / شهر' : 'EGP/mo'}</span>
                </p>
                <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex gap-x-3 items-start">
                      <Check className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribeClick(tier.id)}
                disabled={loading === tier.id}
                className={`
                  mt-8 block rounded-xl px-4 py-3 text-center text-sm font-bold leading-6 w-full transition-all
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${tier.mostPopular
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md hover:shadow-lg'
                    : 'bg-gray-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-600'}
                `}
              >
                {loading === tier.id ? (isAr ? 'جاري المعالجة...' : 'Processing...') : (isAr ? 'اشترك الآن' : 'Subscribe')}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: 'backOut' }}
          >
            {paymentSuccess ? (
              <div className="text-center py-6">
                <motion.div
                  className="bg-green-100 dark:bg-green-900/40 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{isAr ? 'تم الرفع بنجاح!' : 'Upload Successful!'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                  {isAr ? 'سيقوم المسؤول بمراجعة الإيصال وتفعيل اشتراكك قريباً.' : 'An admin will review your receipt and activate your subscription shortly.'}
                </p>
                <button
                  onClick={() => { setShowPaymentModal(false); setPaymentSuccess(false); navigate('/dashboard'); }}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  {isAr ? 'العودة للوحة التحكم' : 'Return to Dashboard'}
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{isAr ? 'الدفع اليدوي' : 'Manual Payment'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{isAr ? 'حوّل المبلغ وارفع صورة الإيصال هنا.' : 'Transfer the amount and upload the receipt screenshot.'}</p>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mb-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <p><strong className="text-gray-900 dark:text-gray-100">{isAr ? 'البنك:' : 'Bank:'}</strong> {isAr ? 'بنك مثال' : 'Example Bank'}</p>
                  <p><strong className="text-gray-900 dark:text-gray-100">{isAr ? 'اسم الحساب:' : 'Account Name:'}</strong> Wazafly</p>
                  <p><strong className="text-gray-900 dark:text-gray-100">{isAr ? 'رقم الحساب:' : 'Account Number:'}</strong> 1234567890</p>
                </div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{isAr ? 'ارفع الإيصال' : 'Upload Receipt'}</label>
                <div className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${uploading ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-indigo-400'}`}>
                  <div className="text-center space-y-2">
                    <Upload className={`mx-auto h-10 w-10 ${uploading ? 'text-indigo-500 animate-bounce' : 'text-gray-400'}`} />
                    <label htmlFor="file-upload-pricing" className="cursor-pointer text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                      <span>{uploading ? (isAr ? 'جارٍ الرفع...' : 'Uploading...') : (isAr ? 'اختر ملفاً' : 'Select file')}</span>
                      <input id="file-upload-pricing" type="file" className="sr-only" accept="image/*" onChange={handlePaymentUpload} disabled={uploading} />
                    </label>
                    <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                  </div>
                </div>
                <div className="flex justify-end mt-5">
                  <button onClick={() => setShowPaymentModal(false)} disabled={uploading} className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
