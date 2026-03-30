import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { User, Image as ImageIcon, Briefcase, Phone, Mail, Globe, Moon, Sun, Upload, Loader2, KeyRound } from 'lucide-react';

export default function JobSeekerSettingsPage({ session, profile }: { session: any, profile: any }) {
  const navigate = useNavigate();
  const { t, language, setLanguage, theme, setTheme } = useSettings();
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Profile Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session || profile?.role !== 'job_seeker') {
      navigate('/login');
      return;
    }
    
    fetchProfile();
  }, [session, profile]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
        
      if (error) throw error;
      if (data) {
        setName(data.name || '');
        setPhone(data.phone || '');
        setJobTitle(data.job_title || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone,
          job_title: jobTitle,
          avatar_url: avatarUrl
        })
        .eq('user_id', session.user.id);

      if (error) throw error;
      
      setSuccessMsg(t('edit.success') || 'Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Reload window to refresh global context profile object if needed
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      setErrorMsg('');
      setSuccessMsg('');
      
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError && uploadError.message.includes('Bucket not found')) {
        const { error: createError } = await supabaseAdmin.storage.createBucket('avatars', { public: true });
        if (!createError) {
          const retry = await supabaseAdmin.storage.from('avatars').upload(filePath, file);
          uploadError = retry.error;
        } else {
          throw new Error('Storage bucket "avatars" is missing. Please run the latest SQL schema in your Supabase dashboard.');
        }
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      
      // Update profile immediately
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', session.user.id);
        
      setSuccessMsg(language === 'ar' ? 'تم رفع الصورة بنجاح!' : 'Avatar uploaded successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      setSuccessMsg(language === 'ar' ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' : 'Password reset link sent to your email.');
      setTimeout(() => {
        setResetSent(false);
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending password reset email');
    } finally {
      setLoading(false);
    }
  };

  const currentThemeLabel = theme === 'dark' ? (language === 'ar' ? 'الوضع المظلم' : 'Dark Mode') : (language === 'ar' ? 'الوضع المضيء' : 'Light Mode');
  const currentLangLabel = language === 'ar' ? 'العربية' : 'English';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {language === 'ar' ? 'تعديل بيانات الحساب وتفضيلات واجهة المستخدم' : 'Update your account profile and display preferences.'}
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200 dark:bg-green-900/30 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200 dark:bg-red-900/30 dark:border-red-800">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          {/* Display Preferences */}
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-indigo-500" />
                {t('edit.preferences') || 'Preferences'}
              </h3>
              
              <div className="space-y-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentThemeLabel}</span>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                </div>

                {/* Language Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentLangLabel}</span>
                  <button
                    onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                    className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-sm font-bold rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {language === 'ar' ? 'EN' : 'عربي'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-indigo-500" />
                {language === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
              </h3>
              
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="shrink-0 flex flex-col items-center gap-3">
                    <div className="relative group">
                      {avatarUrl ? (
                         <img src={avatarUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md" />
                      ) : (
                         <div className="h-24 w-24 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md">
                           <ImageIcon className="h-10 w-10 text-indigo-400" />
                         </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-sm transition-colors"
                        title="Upload Avatar"
                      >
                        {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {language === 'ar' ? 'الاسم' : 'Name'}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        {language === 'ar' ? 'المسمى الوظيفي' : 'Job Title'}
                      </label>
                      <div className="mt-2">
                        <input
                          type="text"
                          required
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors"
                          placeholder={language === 'ar' ? 'مثال: مهندس برمجيات' : 'e.g. Software Engineer'}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <div className="mt-2">
                      <input
                        type="email"
                        disabled
                        value={session.user.email}
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-500 bg-gray-50 dark:bg-slate-800 dark:text-gray-400 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 sm:text-sm sm:leading-6 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'لا يمكن تغيير البريد الإلكتروني.' : 'Email cannot be changed.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    </label>
                    <div className="mt-2 text-left relative" dir="ltr">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm font-medium">+20</span>
                      </div>
                      <input
                        type="tel"
                        value={phone.replace(/^\+20/, '')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhone(`+20${val}`);
                        }}
                        className="block w-full rounded-md border-0 py-1.5 pl-12 pr-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 transition-colors"
                        placeholder="1xxxxxxxxx"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex justify-center rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (t('edit.save') || 'Save Changes')}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Security */}
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <KeyRound className="h-5 w-5 text-indigo-500" />
                {language === 'ar' ? 'الأمان' : 'Security'}
              </h3>
              
              <div className="flex items-center justify-between mt-4 p-4 border border-gray-100 dark:border-slate-800 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'إرسال رابط لإعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' : 'Send a password reset link to your email.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={loading || resetSent}
                  className="rounded-md bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {resetSent 
                    ? (language === 'ar' ? 'تم الإرسال ✓' : 'Sent ✓') 
                    : (language === 'ar' ? 'إعادة تعيين' : 'Reset Password')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
