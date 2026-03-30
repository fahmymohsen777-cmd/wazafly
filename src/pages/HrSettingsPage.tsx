import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { User, Image as ImageIcon, Briefcase, Phone, Mail, Globe, Moon, Sun, Upload, Loader2, KeyRound, BookmarkCheck, ExternalLink } from 'lucide-react';

export default function HrSettingsPage({ session, profile }: { session: any, profile: any }) {
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
    if (!session || profile?.role !== 'hr') {
      navigate('/login');
      return;
    }
    
    fetchHrProfile();
  }, [session, profile]);

  const fetchHrProfile = async () => {
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
      console.error('Error fetching HR profile:', err);
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
          {t('nav.settings') || 'HR Settings'}
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

          {/* Quick Links */}
          <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                <BookmarkCheck className="h-5 w-5 text-indigo-500" />
                {language === 'ar' ? 'روابط سريعة' : 'Quick Links'}
              </h3>
              
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => navigate('/shortlist')}
                  className="w-full flex items-center justify-between p-3 border border-indigo-100 dark:border-indigo-900/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t('dash.hr_saved') || 'Shortlist'}
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
            <div className="px-4 py-5 sm:p-6 space-y-6">
              
              {/* Basic Info */}
              <div>
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-500" />
                  {language === 'ar' ? 'المعلومات الشخصية' : 'Personal Information'}
                </h3>
                
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                  {/* Avatar Upload */}
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                      {t('edit.photo') || 'Profile Photo'}
                    </label>
                    <div className="mt-4 flex items-center gap-6">
                      <div className="relative group">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg" />
                        ) : (
                          <div className="h-24 w-24 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg">
                            <ImageIcon className="h-10 w-10 text-indigo-300 dark:text-gray-500" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Upload className="h-6 w-6 text-white" />}
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="rounded-md bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          {uploadingAvatar ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (t('edit.change') || 'Change')}
                        </button>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">JPG, GIF or PNG. 1MB max.</p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                      {t('edit.name') || 'Full Name'}
                    </label>
                    <div className="mt-2 flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
                      <span className="flex select-none items-center pl-3 pr-3 text-gray-500 sm:text-sm">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                      {t('edit.phone') || 'Phone Number'}
                    </label>
                    <div className="mt-2 flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
                      <span className="flex select-none items-center pl-3 pr-3 text-gray-500 sm:text-sm">
                        <Phone className="h-4 w-4" />
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                      {t('edit.job_title') || 'Job Title / Role'}
                    </label>
                    <div className="mt-2 flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
                      <span className="flex select-none items-center pl-3 pr-3 text-gray-500 sm:text-sm">
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder={language === 'ar' ? 'مسؤول توظيف، مدير موارد بشرية...' : 'Recruiter, HR Manager...'}
                        className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                     <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                      {t('edit.email') || 'Email Address'}
                    </label>
                    <div className="mt-2 flex rounded-md shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-slate-800 bg-gray-50 dark:bg-slate-800 opacity-70">
                      <span className="flex select-none items-center pl-3 pr-3 text-gray-500 sm:text-sm">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        type="email"
                        disabled
                        value={session.user.email}
                        className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-500 dark:text-gray-400 font-medium focus:ring-0 sm:text-sm sm:leading-6 cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{language === 'ar' ? 'البريد الإلكتروني لا يمكن تعديله' : 'Email cannot be changed'}</p>
                  </div>

                </div>
              </div>


              {/* Account Security */}
              <div className="pt-6 border-t border-gray-200 dark:border-slate-800">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-indigo-500" />
                  {language === 'ar' ? 'أمان الحساب' : 'Account Security'}
                </h3>
                
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'كلمة المرور' : 'Password'}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {language === 'ar' 
                        ? 'تلقي رابط على بريدك الإلكتروني لإعادة تعيين كلمة المرور.' 
                        : 'Receive a secure link on your email to reset your password.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading || resetSent}
                    className="whitespace-nowrap inline-flex justify-center rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                  >
                    {resetSent 
                      ? (language === 'ar' ? 'تم الإرسال ✓' : 'Sent ✓')
                      : (language === 'ar' ? 'إعادة تعيين' : 'Reset Password')}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-4 sm:px-6 flex justify-end gap-3 border-t border-gray-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
              >
                {t('edit.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {loading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (t('edit.save') || 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
