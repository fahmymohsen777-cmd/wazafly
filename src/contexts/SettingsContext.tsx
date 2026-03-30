import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Language = 'en' | 'ar';

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  'nav.home': { en: 'Home', ar: 'الرئيسية' },
  'nav.pricing': { en: 'Pricing', ar: 'الأسعار' },
  'nav.login': { en: 'Log in', ar: 'تسجيل الدخول' },
  'nav.signup': { en: 'Sign up', ar: 'حساب جديد' },
  'nav.dashboard': { en: 'Dashboard', ar: 'لوحة التحكم' },
  'nav.search': { en: 'Search', ar: 'بحث' },
  'nav.profile': { en: 'Profile', ar: 'الملف الشخصي' },
  'nav.admin': { en: 'Admin', ar: 'الإدارة' },
  'nav.logout': { en: 'Logout', ar: 'تسجيل خروج' },
  'nav.settings': { en: 'Settings', ar: 'الإعدادات' },
  // New Filters & Profile Fields
  'edit.job_category': { en: 'Job Category', ar: 'مجال العمل' },
  'edit.english_level': { en: 'English Level', ar: 'مستوى الإنجليزية' },
  'edit.eng_acc': { en: 'Acceptable', ar: 'مقبول' },
  'edit.eng_good': { en: 'Good', ar: 'جيد' },
  'edit.eng_fluent': { en: 'Fluent/Excellent', ar: 'ممتاز / Fluent' },
  'edit.education_level': { en: 'Education Level', ar: 'المؤهل الدراسي' },
  'edit.edu_student': { en: 'Student', ar: 'طالب' },
  'edit.edu_diploma': { en: 'Diploma', ar: 'دبلوم' },
  'edit.edu_bachelor': { en: 'Bachelor/License', ar: 'بكالوريوس / ليسانس' },
  'edit.edu_postgrad': { en: 'Post-Graduate', ar: 'دراسات عليا' },
  'edit.gender': { en: 'Gender', ar: 'النوع' },
  'edit.gen_male': { en: 'Male', ar: 'ذكر' },
  'edit.gen_female': { en: 'Female', ar: 'أنثى' },
  'edit.age': { en: 'Age', ar: 'العمر' },
  'edit.availability': { en: 'Availability', ar: 'الجاهزية للعمل' },
  'edit.immediate': { en: 'Immediate', ar: 'متاح للعمل فوراً' },
  'edit.experience_fresh': { en: '0-1 Year (Fresh)', ar: '0-1 سنة (حديث التخرج)' },
  'edit.experience_junior': { en: '1-3 Years (Junior)', ar: '1-3 سنوات (مبتدئ)' },
  'edit.experience_mid': { en: '3-5 Years (Mid)', ar: '3-5 سنوات (متوسط الخبرة)' },
  'edit.experience_senior': { en: '5+ Years (Senior)', ar: '+5 سنوات (خبير)' },

  // Search Page
  'search.must_haves': { en: 'Must-Haves', ar: 'الفلاتر الأساسية' },
  'search.premium_details': { en: 'Premium Details', ar: 'المهارات والتفاصيل' },
  'search.hiring_speed': { en: 'Hiring Speed', ar: 'سرعة التوظيف' },
  'search.clear_filters': { en: 'Clear Filters', ar: 'مسح الفلاتر' },
  'search.min_salary': { en: 'Min Salary', ar: 'الحد الأدنى للراتب' },
  'search.max_salary': { en: 'Max Salary', ar: 'الحد الأقصى للراتب' },
  'search.skills_tags': { en: 'Skills Keywords', ar: 'كلمات مفتاحية للمهارات' },
  'search.job_category_ph': { en: 'Search or select category...', ar: 'ابحث أو اختر المجال...' },
  'search.age_min': { en: 'Min Age', ar: 'من (عمر)' },
  'search.age_max': { en: 'Max Age', ar: 'إلى (عمر)' },

  // Profile Page Features
  'profile.title': { en: 'HR Dashboard', ar: 'لوحة تحكم الموارد البشرية' },

  // Landing Page
  'hero.title': { en: 'The Reverse Job Board', ar: 'منصة Wazafly للتوظيف العكسي' },
  'hero.subtitle': { en: 'Job seekers upload their CVs and get discovered. HR recruiters subscribe to search our curated database of top talent.', ar: 'الباحثون عن عمل يرفعون سيرهم الذاتية ليتم اكتشافهم. مسؤولو التوظيف (HR) يشتركون للبحث في قاعدة بياناتنا المنتقاة بعناية لأفضل المواهب.' },
  'hero.start': { en: 'Get Started', ar: 'ابدأ الآن' },
  'hero.pricing': { en: 'View Pricing', ar: 'الأسعار والباقات' },
  'features.tag': { en: 'Hire Faster', ar: 'وظّف بشكل أسرع' },
  'features.title': { en: 'Everything you need to find the right candidate', ar: 'كل ما تحتاجه للعثور على المرشح المناسب' },
  'feat1.title': { en: 'Easy Upload', ar: 'رفع سهل وسريع' },
  'feat1.desc': { en: 'Job seekers can easily upload their CVs and create a profile in minutes.', ar: 'يمكن للباحثين عن عمل رفع سيرهم الذاتية وإنشاء ملف تعريفي رائع في دقائق معدودة، مجاناً بالكامل.' },
  'feat2.title': { en: 'Advanced Search', ar: 'بحث متقدم' },
  'feat2.desc': { en: 'Recruiters can use filters like skills and experience to find the perfect candidate instantly.', ar: 'يستطيع أصحاب الشركات استخدام فلاتر دقيقة تشمل المهارات وسنوات الخبرة والمنطقة الجغرافية للوصول للأفضل.' },
  'feat3.title': { en: 'Direct Access', ar: 'وصول مباشر' },
  'feat3.desc': { en: 'Get direct access to candidate profiles and download their CVs immediately.', ar: 'احصل على وصول مباشر لملفات المرشحين وبيانات اتصالهم لتكوين فريق أحلامك بأقل مجهود وتكلفة.' },
  
  // Edit Profile
  'edit.title': { en: 'Edit Profile', ar: 'تعديل الملف الشخصي' },
  'edit.photo': { en: 'Profile Photo', ar: 'الصورة الشخصية' },
  'edit.avatar_link': { en: 'Profile Image URL', ar: 'رابط الصورة الشخصية' },
  'edit.change': { en: 'Change', ar: 'تغيير' },
  'edit.uploading': { en: 'Uploading...', ar: 'جاري الرفع...' },
  'edit.noimg': { en: 'No img', ar: 'لا توجد' },
  'edit.name': { en: 'Full name', ar: 'الاسم بالكامل' },
  'edit.job_title': { en: 'Job Title / Role', ar: 'المسمى الوظيفي' },
  'edit.preferences': { en: 'Preferences', ar: 'تفضيلات العرض' },
  'edit.success': { en: 'Profile updated successfully!', ar: 'تم تحديث البيانات بنجاح!' },
  'edit.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'edit.save': { en: 'Save Changes', ar: 'حفظ التغييرات' },
  'edit.phone': { en: 'Phone Number', ar: 'رقم الهاتف' },
  'edit.email': { en: 'Email Address', ar: 'البريد الإلكتروني' },
  'edit.job': { en: 'Job title', ar: 'المسمى الوظيفي' },
  'edit.city': { en: 'City', ar: 'المدينة' },
  'edit.district': { en: 'Governorate', ar: 'المحافظة' },
  'edit.military': { en: 'Military Status', ar: 'الموقف من التجنيد' },
  'edit.mil_not_spec': { en: 'Not Specified', ar: 'غير محدد' },
  'edit.mil_comp': { en: 'Completed', ar: 'تم تأديتها' },
  'edit.mil_exem': { en: 'Exempted', ar: 'إعفاء' },
  'edit.mil_post': { en: 'Postponed', ar: 'تأجيل' },
  'edit.exp': { en: 'Years of Experience', ar: 'سنوات الخبرة' },
  'edit.salary': { en: 'Salary Expectation', ar: 'الراتب المتوقع' },
  'edit.skills': { en: 'Skills (comma separated)', ar: 'المهارات (افصل بينها بفاصلة)' },
  'edit.skills_ph': { en: 'React, TypeScript, Node.js', ar: 'مثال: تسويق، برمجة، إدارة' },
  'edit.bio': { en: 'About', ar: 'نبذة عنك' },
  'edit.bio_hint': { en: 'Write a few sentences about yourself.', ar: 'اكتب بضعة أسطر عن نفسك وخبراتك.' },

  'edit.saving': { en: 'Saving...', ar: 'جاري الحفظ...' },
  'edit.loading': { en: 'Loading...', ar: 'جاري التحميل...' },
  
  // Dashboard - Job Seeker
  'dash.welcome': { en: 'Welcome back', ar: 'مرحباً بعودتك' },
  'dash.seeker_views': { en: 'Total Profile Views', ar: 'إجمالي مشاهدات الملف' },
  'dash.seeker_companies': { en: 'Companies Viewing', ar: 'الشركات المهتمة' },
  'dash.seeker_last': { en: 'Last Viewed', ar: 'آخر مشاهدة' },
  'dash.quick': { en: 'Quick Actions', ar: 'إجراءات سريعة' },
  'dash.edit_desc': { en: 'Update your skills, experience, and details', ar: 'قم بتحديث مهاراتك وخبراتك وبياناتك' },
  'dash.upload_cv': { en: 'Upload / Replace CV', ar: 'رفع / تحديث السيرة الذاتية' },
  'dash.upload_desc': { en: 'Keep your resume up to date', ar: 'حافظ على سيرتك الذاتية محدثة' },
  
  // Dashboard - HR
  'dash.hr_find': { en: 'Find Candidates', ar: 'البحث عن مرشحين' },
  'dash.hr_find_desc': { en: 'Search our database of curated job seekers using advanced AI filters.', ar: 'ابحث في قاعدة بيانات المرشحين الموثقين باستخدام فلاتر الذكاء الاصطناعي.' },
  'dash.hr_go_search': { en: 'Go to Search', ar: 'الذهاب للبحث' },
  'dash.cv_bank': { en: 'CV Bank (AI System)', ar: 'بنك ومحلل السير الذاتية (الذكاء الاصطناعي)' },
  'dash.cv_bank_desc': { en: 'Upload PDF/Word resumes, analyze candidates automatically, and calculate Match Scores against job descriptions.', ar: 'ارفع ملفات السير الذاتية، ليقوم الذكاء الاصطناعي بتحليلها تلقائياً وحساب نسبة التوافق مع الوصف الوظيفي.' },
  'dash.open_cv_bank': { en: 'CV Bank', ar: 'بنك السير الذاتية' },
  
  'dash.hr_saved': { en: 'Shortlist', ar: 'القائمة المختصرة' },
  'dash.hr_saved_desc': { en: 'Quick access to candidates you have shortlisted or rated.', ar: 'وصول سريع للمرشحين الذين قمت بحفظهم أو تقييمهم.' },
  'dash.hr_saved_load': { en: 'Loading saved candidates...', ar: 'جاري تحميل المرشحين...' },
  'dash.hr_saved_empty': { en: 'No saved candidates', ar: 'لا يوجد مرشحون محفوظون' },
  'dash.hr_saved_empty_desc': { en: 'Shortlist or evaluate candidates to see them here.', ar: 'قم بحفظ أو تقييم المرشحين ليظهروا هنا.' },
  
  'dash.hr_sub': { en: 'Subscription Status', ar: 'حالة الاشتراك' },
  'dash.hr_sub_desc': { en: 'Manage your billing and subscription plan.', ar: 'إدارة خطة الدفع والاشتراك الخاص بك.' },
  'dash.hr_manage_sub': { en: 'Manage Subscription', ar: 'إدارة الاشتراك' },
  
  // Subscription Page
  'sub.title': { en: 'Subscription Management', ar: 'إدارة الاشتراك المالي' },
  'sub.current_plan': { en: 'Current Plan', ar: 'الخطة الحالية' },
  'sub.active_msg': { en: 'You are currently subscribed to the', ar: 'أنت مشترك حالياً في خطة' },
  'sub.plan_word': { en: 'plan.', ar: '.' },
  'sub.no_active': { en: 'You do not have an active subscription.', ar: 'ليس لديك أي اشتراك فعّال حالياً.' },
  'sub.upgrade': { en: 'Upgrade Plan', ar: 'ترقية الاشتراك' },
  'sub.cancel': { en: 'Cancel Subscription', ar: 'إلغاء الاشتراك' },
  'sub.view_plans': { en: 'View Plans', ar: 'تصفح باقات الأسعار' },
  
  'dash.hr_team': { en: 'Team Management', ar: 'إدارة فريق العمل' },
  'dash.team_premium_req': { en: 'Premium Feature Restricted', ar: 'ميزة حصرية للاشتراكات المتقدمة' },
  'dash.team_premium_desc': { en: 'Team Management and Company Profiles are exclusively available on Pro and Enterprise plans. Please upgrade your subscription to invite recruiters and manage your HR team.', ar: 'إدارة فرق العمل وإنشاء حسابات للشركات هي ميزات متوفرة حصرياً في خطط (Pro) و (Enterprise). يرجى ترقية اشتراكك لتتمكن من إضافة مسؤولي توظيف آخرين وتأسيس شركة.' },
  'dash.personal_mode_req': { en: 'Personal HR Account', ar: 'حساب موارد بشرية شخصي' },
  'dash.personal_mode_desc': { en: 'You are currently registered as a Personal HR. To create a company profile or build a recruitment team, please contact Support to upgrade your account designation.', ar: 'أنت مسجل حالياً بحساب توظيف شخصي (Personal HR). إذا كنت ترغب في تأسيس ملف لشركتك وإدارة فريق، يرجى التواصل مع الدعم الفني لترقية نوع حسابك.' },
  'dash.hr_company': { en: 'Company:', ar: 'الشركة:' },
  'dash.hr_team_members': { en: 'Team Members', ar: 'أعضاء الفريق' },
  'dash.hr_admin': { en: 'Admin', ar: 'مدير' },
  'dash.hr_recruiter': { en: 'Recruiter', ar: 'مسؤول توظيف' },
  'dash.hr_invite': { en: 'Generate Invitation Link', ar: 'إنشاء رابط دعوة' },
  'dash.hr_invite_desc': { en: 'Generate an invite link and send it to recruiters to join your company.', ar: 'قم بتوليد رابط دعوة وإرساله لمديري التوظيف (Recruiters) للانضمام لشركتك.' },
  
  'dash.hr_no_company': { en: 'You need to create a company profile first before inviting recruiters.', ar: 'يجب إنشاء ملف للشركة أولاً قبل دعوة فريق العمل.' },
  'dash.hr_company_name': { en: 'Company Name', ar: 'اسم الشركة' },
  'dash.hr_create_company': { en: 'Create Company', ar: 'إنشاء الشركة' },
  
  'dash.recruiter_active': { en: 'You are working under', ar: 'أنت تعمل تحت اشتراك' },
  'dash.recruiter_active_2': { en: 'subscription — all features available.', ar: '— جميع المميزات متاحة لك.' },
  'dash.recruiter_inactive': { en: 'does not have an active subscription — some features may be limited.', ar: 'لا تمتلك اشتراكاً نشطاً حالياً — بعض المميزات قد تكون محدودة.' },

  // Search Page
  'search.title': { en: 'Find the Perfect Candidate', ar: 'ابحث عن المرشح المثالي' },
  'search.placeholder': { en: 'Search by job title, skills, or keywords...', ar: 'ابحث بالمسمى الوظيفي، المهارات، أو الكلمات الافتتاحية...' },
  'search.filters': { en: 'Filters', ar: 'الفلاتر' },
  'search.exp': { en: 'Experience', ar: 'الخبرة' },
  'search.any_exp': { en: 'Any amount', ar: 'أي عدد' },
  'search.loc': { en: 'Location', ar: 'المدينة' },
  'search.any_loc': { en: 'Any location', ar: 'أي مدينة' },
  'search.min_sal': { en: 'Min Salary (EGP)', ar: 'الحد الأدنى للراتب (ج.م)' },
  'search.max_sal': { en: 'Max Salary (EGP)', ar: 'الحد الأقصى للراتب (ج.م)' },
  'search.btn': { en: 'Search', ar: 'بحث' },
  'search.clear': { en: 'Clear Filters', ar: 'مسح الفلاتر' },
  
  'search.found': { en: 'Candidates Found', ar: 'مرشحاً تم العثور عليهم' },
  'search.shortlist': { en: 'Shortlist', ar: 'حفظ' },
  'search.shortlisted': { en: 'Shortlisted', ar: 'تم الحفظ' },
  'search.exp_years': { en: 'Experience:', ar: 'سنوات الخبرة:' },
  'search.salary': { en: 'Salary:', ar: 'الراتب المتوقع:' },
  'search.view_profile': { en: 'View Profile', ar: 'عرض الملف' },
  
  'search.empty': { en: 'No candidates found matching your criteria.', ar: 'لا يوجد مرشحون يطابقون بحثك.' },
  'search.empty_hint': { en: 'Try adjusting your filters or search terms.', ar: 'حاول تعديل الفلاتر أو كلمات البحث.' },
  'search.loading': { en: 'Loading candidates...', ar: 'جاري البحث عن مرشحين...' },

  // Candidate Profile Page
  'profile.shortlist_add': { en: 'Shortlist Candidate', ar: 'حفظ المرشح' },
  'profile.shortlisted': { en: 'Shortlisted', ar: 'تم حفظه' },
  'profile.role': { en: 'Role', ar: 'المنصب' },
  'profile.loc': { en: 'Location', ar: 'المدينة' },
  'profile.exp': { en: 'Experience', ar: 'الخبرة' },
  'profile.salary': { en: 'Salary Expectation', ar: 'الراتب المتوقع' },
  'profile.military': { en: 'Military Status', ar: 'الموقف التجنيدي' },
  'profile.contact': { en: 'Contact Information', ar: 'معلومات التواصل' },
  'profile.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'profile.phone': { en: 'Phone', ar: 'رقم الهاتف' },
  'profile.dl_cv': { en: 'Download CV', ar: 'تحميل السيرة الذاتية' },
  'profile.about': { en: 'About', ar: 'نبذة شخصية' },
  'profile.skills': { en: 'Skills', ar: 'المهارات' },
  'profile.notes': { en: 'Team Notes', ar: 'ملاحظات الفريق' },
  'profile.tags': { en: 'Tags', ar: 'التصنيفات' },
  'profile.rate': { en: 'Rate Candidate', ar: 'تقييم المرشح' },
  'profile.note_ph': { en: 'Write a note about this candidate...', ar: 'اكتب ملاحظة حول هذا المرشح...' },
  'profile.back': { en: 'Back', ar: 'عودة' },
  'profile.rate_desc': { en: 'Your rating for the following note:', ar: 'تقييمك للملاحظة التالية:' },
  'profile.tags_desc': { en: 'Tags will be added with your note ⬇', ar: 'ستُضاف مع ملاحظتك التالية ⬇' },
  'profile.you': { en: 'You', ar: 'أنت' },
  'profile.colleague': { en: 'Colleague', ar: 'زميل' },
  
  'profile.import_cvbank': { en: 'Import to CV Bank', ar: 'إضافة لبنك السير الذاتية' },
  'profile.import_desc': { en: 'Instantly copy this candidate’s CV and extracted profile data to your private AI CV Bank database for deeper analysis.', ar: 'انسخ بيانات هذا المرشح وسيرته الذاتية فوراً إلى بنك الذكاء الاصطناعي الخاص بك لتحليلها لاحقاً وتجميعها.' },
  'profile.import_action': { en: 'Import Profile', ar: 'استيراد الملف' },
  'profile.import_modal_title': { en: 'Import to CV Bank', ar: 'استيراد لبنك السير الذاتية' },
  'profile.import_success': { en: 'Import Successful!', ar: 'تم الاستيراد بنجاح!' },
  'profile.import_success_desc': { en: 'Candidate has been added to your CV Bank.', ar: 'تم نسخ ملف المرشح إلى بنك السير الذاتية الخاص بك.' },
  'profile.no_cv_error': { en: 'This candidate does not have a PDF/Word CV uploaded. The CV Bank requires a raw file for AI analysis.', ar: 'هذا المرشح لم يقم برفع ملف سيرة ذاتية (PDF/Word). بنك السير الذاتية يتطلب ملفاً خاماً لكي يحلله الذكاء الاصطناعي.' },
  'profile.select_folder': { en: 'Select Destination Folder (Optional)', ar: 'اختر المجلد الوجهة (اختياري)' },
  'profile.unassigned': { en: 'Unassigned', ar: 'بدون مجلد' },
  'profile.importing': { en: 'Importing...', ar: 'جاري الاستيراد...' },
  'profile.confirm_import': { en: 'Confirm Import', ar: 'تأكيد الاستيراد' },
  'profile.import_analyzing': { en: 'Analyzing CV with AI...', ar: 'جاري تحليل السيرة الذاتية...' },
  'profile.import_error': { en: 'AI Analysis Failed', ar: 'فشل تحليل الذكاء الاصطناعي' },
  'profile.imported_bio': { en: 'Imported directly from Wazafly Profile.', ar: 'تم استيراده مباشرة من ملف منصة واظفلاي.' },
  'cvbank.analysis_prompt': { en: 'Analyze this resume and extract the following information. Respond in the candidate\'s language (Arabic or English).', ar: 'حلل هذه السيرة الذاتية واستخرج المعلومات التالية. أجب بنفس لغة السيرة الذاتية (عربي أو إنجليزي).' },
  
  // Tags Translation mapping
  'tag.مناسب': { en: 'Suitable', ar: 'مناسب' },
  'tag.غير مناسب': { en: 'Unsuitable', ar: 'غير مناسب' },
  'tag.للمتابعة': { en: 'Follow up', ar: 'للمتابعة' },
  'tag.مقابلة تليفونية': { en: 'Phone Interview', ar: 'مقابلة تليفونية' },
  'tag.مقابلة حضورية': { en: 'In-person Interview', ar: 'مقابلة حضورية' },
  
  // Refresh Status Feature
  'dash.refresh_status': { en: 'Refresh My Status', ar: 'تحديث حالتي' },
  'dash.refresh_desc': { en: 'Click here to bump your profile to the top of HR search results!', ar: 'اضغط هنا لرفع ملفك في صدارة نتائج بحث الشركات!' },
  'dash.refresh_success': { en: 'Status updated successfully!', ar: 'تم تحديث حالتك بنجاح!' },
  'search.active_ago': { en: 'Active', ar: 'نشط' },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Check local storage
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedLang = localStorage.getItem('language') as Language;
    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLanguage(savedLang);
  }, []);

  useEffect(() => {
    // Apply Theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Apply Language (Force LTR structural layout per user request)
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    return translations[key]?.[language] || fallback || key;
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
