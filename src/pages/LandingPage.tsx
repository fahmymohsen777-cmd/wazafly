import { Link } from 'react-router-dom';
import { ArrowRight, Upload, Search, Users, CheckCircle2, Briefcase, Star, Zap } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function LandingPage() {
  const { t, language } = useSettings();
  const isAr = language === 'ar';

  return (
    <div className="bg-white dark:bg-gray-900 transition-colors duration-200 overflow-hidden">

      {/* ===== HERO ===== */}
      <div className="relative isolate">
        {/* gradient blobs */}
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-violet-600 opacity-20 dark:opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }} />
        </div>
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)] pointer-events-none">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-violet-500 to-indigo-400 opacity-20 dark:opacity-10 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }} />
        </div>

        <div className="py-28 sm:py-36 lg:py-44">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800">
                <Zap className="h-3.5 w-3.5" />
                {isAr ? 'منصة التوظيف العكسي #1 في مصر' : 'Egypt\'s #1 Reverse Job Board'}
              </span>
            </div>

            <div className="mx-auto max-w-3xl text-center flex flex-col items-center">
              <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-7xl leading-tight inline-flex flex-wrap justify-center items-center gap-x-2 w-full text-center" dir={isAr ? 'rtl' : 'ltr'}>
                {isAr ? (
                  <>دع الـ <span className="font-sans">HR</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">يجدك</span> أنت</>
                ) : (
                  <>Let HR <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">find</span> You</>
                )}
              </h1>
              <p className="mt-6 text-xl leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
                {isAr
                  ? 'أنشئ بروفايلك المهني مرة واحدة، وانتظر عروض العمل من أفضل الشركات. لا تبحث عن وظائف — الوظائف هي التي تبحث عنك.'
                  : 'Create your profile once and wait for job offers from top companies. Stop chasing jobs — let jobs come to you.'}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register"
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-lg hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105 hover:shadow-indigo-500/30">
                  {isAr ? '🚀 ابدأ مجاناً الآن' : '🚀 Get Started Free'}
                </Link>
                <Link to="/pricing"
                  className="w-full sm:w-auto rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-8 py-4 text-base font-semibold text-gray-900 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                  {isAr ? 'الباقات والأسعار' : 'View Pricing'} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              {[
                { num: '+500', label: isAr ? 'مرشح نشط' : 'Active Candidates' },
                { num: '+50', label: isAr ? 'شركة مسجّلة' : 'Companies' },
                { num: '98%', label: isAr ? 'رضا العملاء' : 'Satisfaction' },
              ].map(s => (
                <div key={s.num} className="text-center">
                  <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{s.num}</p>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== HOW IT WORKS ===== */}
      <div className="bg-gray-50 dark:bg-slate-900 py-24 sm:py-32 border-y border-gray-100 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
              {isAr ? 'كيف يعمل؟' : 'How It Works'}
            </h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 sm:text-4xl">
              {isAr ? 'خطوات بسيطة، نتائج استثنائية' : 'Simple Steps, Exceptional Results'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Job Seeker steps */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {isAr ? 'للباحث عن عمل' : 'For Job Seekers'}
                </h3>
              </div>
              <ol className="space-y-6">
                {[
                  { step: '01', title: isAr ? 'أنشئ بروفايلك' : 'Create Your Profile', desc: isAr ? 'أضف مهاراتك وخبراتك والراتب المتوقع في دقائق.' : 'Add your skills, experience and salary expectations in minutes.' },
                  { step: '02', title: isAr ? 'ارفع الـ CV' : 'Upload Your CV', desc: isAr ? 'ارفع سيرتك الذاتية لتكون جاهزة للـ HR.' : 'Upload your resume so HR can download it directly.' },
                  { step: '03', title: isAr ? 'استقبل العروض' : 'Get Discovered', desc: isAr ? 'شركات تواصل معك مباشرة بدون تقديم.' : 'Companies contact you directly — no applications needed.' },
                ].map(item => (
                  <li key={item.step} className="flex gap-4">
                    <span className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-sm font-bold text-indigo-600 dark:text-indigo-400">{item.step}</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-8">
                <Link to="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                  {isAr ? 'سجّل كباحث عن عمل' : 'Register as Job Seeker'} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* HR steps */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {isAr ? 'لـ HR والشركات' : 'For HR & Companies'}
                </h3>
              </div>
              <ol className="space-y-6">
                {[
                  { step: '01', title: isAr ? 'سجّل شركتك' : 'Register Your Company', desc: isAr ? 'أنشئ حسابك وأضف فريق التوظيف عبر رابط دعوة.' : 'Create your account and invite your recruiting team.' },
                  { step: '02', title: isAr ? 'ابحث بالفلاتر' : 'Search with Filters', desc: isAr ? 'ابحث بالمهارة والخبرة والمنطقة والراتب.' : 'Filter by skill, experience, location and salary.' },
                  { step: '03', title: isAr ? 'تواصل مباشرة' : 'Contact Directly', desc: isAr ? 'تواصل بالواتساب أو الإيميل في خطوة واحدة.' : 'Contact via WhatsApp or Email in one click.' },
                ].map(item => (
                  <li key={item.step} className="flex gap-4">
                    <span className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/30 text-sm font-bold text-violet-600 dark:text-violet-400">{item.step}</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-8">
                <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500">
                  {isAr ? 'اعرف الأسعار' : 'View Pricing'} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES ===== */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-base font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{t('features.tag')}</h2>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 sm:text-4xl">{t('features.title')}</p>
        </div>
        <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3 mx-auto">
          {[
            { icon: <Upload className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />, title: t('feat1.title'), desc: t('feat1.desc'), bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
            { icon: <Search className="h-6 w-6 text-violet-600 dark:text-violet-400" />, title: t('feat2.title'), desc: t('feat2.desc'), bg: 'bg-violet-50 dark:bg-violet-900/30' },
            { icon: <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />, title: t('feat3.title'), desc: t('feat3.desc'), bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          ].map((f, i) => (
            <div key={i} className="flex flex-col bg-gray-50 dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>{f.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{f.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm flex-auto">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CTA BANNER ===== */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-16 shadow-2xl text-center">
          <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none">
            <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-white blur-3xl" />
          </div>
          <Star className="mx-auto h-10 w-10 text-yellow-300 mb-4" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl mb-4">
            {isAr ? 'جاهز تبدأ رحلتك المهنية؟' : 'Ready to Start Your Career Journey?'}
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
            {isAr ? 'انضم لآلاف الباحثين عن عمل والشركات على منصة Wazafly.' : 'Join thousands of job seekers and companies on Wazafly today.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-lg hover:bg-indigo-50 transition-all hover:scale-105">
              {isAr ? '✨ ابدأ مجاناً' : '✨ Start Free'}
            </Link>
            <Link to="/login"
              className="rounded-xl bg-transparent border-2 border-white px-8 py-4 text-base font-bold text-white hover:bg-white/10 transition-all">
              {isAr ? 'تسجيل الدخول' : 'Login'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
