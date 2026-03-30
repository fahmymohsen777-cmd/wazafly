import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { Download, MapPin, Briefcase, Star, ArrowLeft, Phone, Mail, MessageCircle, Bookmark, BookmarkCheck, Send, Tag, Database, X, Folder, CheckCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { GoogleGenAI, Type } from "@google/genai";

const resumeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Candidate\'s full name (Use Arabic if possible)' },
    age: { type: Type.NUMBER, description: 'Candidate\'s age' },
    governorate: { type: Type.STRING, description: 'The governorate or city where the candidate resides' },
    email: { type: Type.STRING, description: 'Candidate\'s email address' },
    phone: { type: Type.STRING, description: 'Candidate\'s phone number' },
    appliedFor: { type: Type.STRING, description: 'The job position applied for, if mentioned' },
    skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'A list of key skills (MUST BE IN ARABIC)' },
    aiSummary: { type: Type.STRING, description: 'A comprehensive 3-4 sentence summary report of the CV, highlighting key skills, total years of experience, and their strongest qualifications. MUST BE WRITTEN IN ARABIC.' },
  },
  required: ['name', 'skills', 'aiSummary']
};

const generateContentWithRetry = async (ai: any, params: any, retries = 4, initialDelay = 2000) => {
    let attempt = 0;
    let delay = initialDelay;
    while (attempt < retries) {
        try {
            return await ai.models.generateContent(params);
        } catch (e: any) {
            attempt++;
            const errorMessage = (e instanceof Error) ? e.message : JSON.stringify(e);
            const isRetriable = errorMessage.includes('429') || errorMessage.includes('503') || errorMessage.toLowerCase().includes('resource_exhausted') || errorMessage.toLowerCase().includes('overloaded');
            if (isRetriable && attempt < retries) {
                const jitter = Math.random() * 1000;
                console.warn(`Retriable error detected. Retrying in ${(delay + jitter) / 1000}s... (Attempt ${attempt})`, e);
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
                delay *= 2;
            } else {
                throw e;
            }
        }
    }
    throw new Error("API call failed after multiple retries.");
};

const TAGS = [
  { label: 'مناسب', color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 ring-green-500/20' },
  { label: 'غير مناسب', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 ring-red-500/20' },
  { label: 'للمتابعة', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 ring-yellow-500/20' },
  { label: 'مقابلة تليفونية', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 ring-blue-500/20' },
  { label: 'مقابلة حضورية', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 ring-purple-500/20' },
];

function getTagStyle(label: string) {
  return TAGS.find(t => t.label === label)?.color || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-500/20';
}

export default function CandidateProfilePage({ session, profile }: { session: any, profile: any }) {
  const { t, language } = useSettings();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [importError, setImportError] = useState('');

  // Collaboration state
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Rating & Tags
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // CV Bank Import State
  const [hasCVBankAccess, setHasCVBankAccess] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [cvBankFolders, setCvBankFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    if (!session) { navigate('/login'); return; }
    if (profile?.role !== 'hr') { navigate('/dashboard'); return; }
    fetchCandidate();
  }, [id, session, profile]);

  const fetchCandidate = async () => {
    try {
      const { data, error: fetchErr } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (fetchErr) throw fetchErr;
      setCandidate(data);

      if (data) {
        // Log view
        await supabase.from('profile_views').insert([{ profile_id: data.id, hr_id: session.user.id }]);

        // Trigger notification to candidate (use admin client to bypass RLS)
        if (data.user_id) {
          // Get company name
          let companyName = 'شركة';
          if (profile?.company_id) {
            const { data: compData } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
            if (compData) companyName = compData.name;
          }
          await supabaseAdmin.from('notifications').insert([{
            user_id: data.user_id,
            message: `قامت ${companyName} بزيارة ملفك الشخصي`
          }]);
        }

        // Fetch collaboration data for HR (whether in a company or independent)
        if (profile?.role === 'hr') {
          // Determine query condition based on whether they belong to a company
          const queryCondition = profile.company_id
            ? { column: 'company_id', value: profile.company_id }
            : { column: 'recruiter_id', value: session.user.id };

          // Use supabaseAdmin to bypass RLS issues since users may not have applied policies correctly
          let slQuery = supabaseAdmin.from('shortlists').select('*').eq('profile_id', data.id);
          if (profile.company_id) {
            slQuery = slQuery.eq('company_id', profile.company_id);
          } else {
            slQuery = slQuery.is('company_id', null).eq('recruiter_id', session.user.id);
          }
          
          const { data: sl } = await slQuery.maybeSingle();
          if (sl) setIsShortlisted(true);

          let notesQuery = supabaseAdmin
            .from('candidate_notes')
            .select('*, users!inner(email)')
            .eq('profile_id', data.id)
            .order('created_at', { ascending: false });
            
          if (profile.company_id) {
            notesQuery = notesQuery.eq('company_id', profile.company_id);
          } else {
            notesQuery = notesQuery.is('company_id', null).eq('recruiter_id', session.user.id);
          }

          const { data: notesData } = await notesQuery;
          if (notesData) setNotes(notesData);

          // Check CV Bank Access
          let userToCheck = session.user.id;
          if (profile.company_id) {
            const { data: comp } = await supabase.from('companies').select('admin_id').eq('id', profile.company_id).maybeSingle();
            if (comp?.admin_id) userToCheck = comp.admin_id;
          }
          const { data: subData } = await supabaseAdmin.from('subscriptions').select('plan, status').eq('user_id', userToCheck).eq('status', 'active').maybeSingle();
          if (subData && ['pro', 'premium', 'price_pro', 'price_enterprise'].includes(subData.plan)) {
            setHasCVBankAccess(true);
          }
        }
      }
    } catch (err: any) {
      setProfileError(err.message || 'Failed to load candidate profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleShortlist = async () => {
    if (profile?.role !== 'hr') return;
    
    // Determine condition
    let deleteQuery = supabaseAdmin.from('shortlists').delete().eq('profile_id', id);
    if (profile.company_id) {
      deleteQuery = deleteQuery.eq('company_id', profile.company_id);
    } else {
      deleteQuery = deleteQuery.is('company_id', null).eq('recruiter_id', session.user.id);
    }

    if (isShortlisted) {
      await deleteQuery;
      setIsShortlisted(false);
    } else {
      await supabaseAdmin.from('shortlists').insert([{ 
        company_id: profile.company_id || null, 
        profile_id: id, 
        recruiter_id: session.user.id 
      }]);
      setIsShortlisted(true);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || profile?.role !== 'hr') return;
    setSubmittingNote(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('candidate_notes')
        .insert([{
          company_id: profile.company_id || null,
          profile_id: id,
          recruiter_id: session.user.id,
          note_text: newNote.trim(),
          rating: selectedRating || null,
          tags: selectedTags.length > 0 ? selectedTags : null
        }])
        .select('*, users!inner(email)')
        .single();

      if (error) throw error;
      if (data) setNotes([data, ...notes]);
      setNewNote('');
      setSelectedRating(0);
      setSelectedTags([]);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const openImportModal = async () => {
    setIsImportModalOpen(true);
    setImportSuccess(false);
    setSelectedFolder('');
    try {
      const { data } = await supabase.from('folders').select('*').eq('user_id', session.user.id).order('name', { ascending: true });
      if (data) setCvBankFolders(data);
    } catch {}
  };

  const handleImportCV = async () => {
    if (!candidate.cv_url) return;
    setIsImporting(true);
    setImportError('');
    try {
      // 1. Initialize AI
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key is missing.');
      const ai = new GoogleGenAI({ apiKey });
      const model = (ai as any).getGenerativeModel ? (ai as any).getGenerativeModel({ model: "gemini-2.0-flash" }) : (ai as any).models.get("gemini-1.5-flash");

      // 2. Fetch CV File
      const response = await fetch(candidate.cv_url);
      if (!response.ok) throw new Error('Failed to download CV file for analysis.');
      const blob = await response.blob();
      
      // 3. Convert to Gemini format
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      // 4. Analyze with Gemini
      const analysisPrompt = language === 'ar' 
        ? 'حلل هذه السيرة الذاتية واستخرج المعلومات التالية. أجب باللغة العربية حصراً.'
        : 'Analyze this resume and extract the following information. Respond in English.';
      
      const result = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: { parts: [ { inlineData: { mimeType: blob.type, data: base64Data } }, { text: analysisPrompt } ] },
        config: { responseMimeType: "application/json", responseSchema: resumeSchema }
      });
      
      const text = result.text;
      if (!text) throw new Error(t('cvbank.analysis_error') || "Empty response from AI.");
      
      const analysisData = JSON.parse(text);
      console.log('Gemini Analysis Result:', analysisData);

      // 5. Insert into CV Bank
      const resumeForDb = {
        file_url: candidate.cv_url,
        file_name: `${candidate.name || 'Candidate'}_Profile_CV_${Date.now()}.pdf`, 
        name: analysisData.name || candidate.name,
        email: analysisData.email || candidate.email,
        phone: analysisData.phone || candidate.phone,
        applied_for: analysisData.appliedFor || analysisData.applied_for || candidate.job_title,
        skills: analysisData.skills || candidate.skills || [],
        ai_summary: analysisData.aiSummary || analysisData.ai_summary 
            ? `(AI) ${analysisData.aiSummary || analysisData.ai_summary}` 
            : `(Bio) ${candidate.bio || "No summary available"}`,
        folder_id: selectedFolder || null,
        user_id: session.user.id,
        is_favorited: false
      };

      console.log('Inserting into DB:', resumeForDb);
      const { error: insertError } = await supabase.from('resumes').insert(resumeForDb);
      if (insertError) throw insertError;

      setImportSuccess(true);
      setTimeout(() => setIsImportModalOpen(false), 2000);
    } catch (err: any) {
      console.error('Import analysis failed:', err);
      // We set importError instead of the main page error
      setImportError(err.message || 'Import failed during AI analysis.');
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) return <div className="p-8 text-center dark:text-gray-300">Loading profile...</div>;

  if (profileError || !candidate) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Candidate Not Found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{profileError || "The candidate profile you're looking for doesn't exist."}</p>
        <button onClick={() => navigate('/search')} className="text-indigo-600 hover:text-indigo-500 font-medium">&larr; {t('profile.back')}</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button onClick={() => navigate('/search')} className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-8">
        <ArrowLeft className="mr-1 h-4 w-4" /> {t('profile.back')}
      </button>

      <div className="bg-white dark:bg-slate-900 shadow overflow-hidden sm:rounded-lg border border-gray-100 dark:border-slate-800">
        <div className="px-4 py-6 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex items-center gap-4">
            {candidate.avatar_url ? (
              <img src={candidate.avatar_url} alt={candidate.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <span className="text-indigo-600 dark:text-indigo-400 text-xl font-medium">
                  {candidate.name ? candidate.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100">{candidate.name || 'Anonymous Candidate'}</h3>
              <p className="mt-1 text-sm leading-6 text-indigo-600 dark:text-indigo-400 font-medium">{candidate.job_title || 'No title specified'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidate.phone && (
              <>
                <a href={`https://wa.me/${candidate.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                  <MessageCircle className="-ml-0.5 mr-1.5 h-5 w-5" /> WhatsApp
                </a>
                <a href={`tel:${candidate.phone}`}
                  className="inline-flex items-center rounded-md bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50">
                  <Phone className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" /> Call
                </a>
              </>
            )}
            {candidate.email && (
              <a href={`mailto:${candidate.email}`}
                className="inline-flex items-center rounded-md bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50">
                <Mail className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" /> Email
              </a>
            )}
            {candidate.cv_url && (
              <a href={candidate.cv_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                <Download className="-ml-0.5 mr-1.5 h-5 w-5" /> CV
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-slate-800">
          <dl className="divide-y divide-gray-100 dark:divide-slate-800">
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><MapPin className="h-4 w-4 mr-2 text-gray-400"/>{t('profile.loc')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">{candidate.district ? `${candidate.district}, ` : ''}{candidate.city || 'Not specified'}</dd>
            </div>
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><Star className="h-4 w-4 mr-2 text-gray-400"/>{t('profile.exp')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">{candidate.experience_years || 0}</dd>
            </div>
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><Briefcase className="h-4 w-4 mr-2 text-gray-400"/>{t('profile.salary')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">
                {candidate.salary_expectation ? candidate.salary_expectation : 'Not specified'}
              </dd>
            </div>
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><span className="h-4 w-4 mr-2 text-gray-400 flex items-center justify-center text-xs">🛡️</span>{t('profile.military')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">
                {candidate.military_status || 'Not specified'}
              </dd>
            </div>
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('profile.skills')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">
                <div className="flex flex-wrap gap-2">
                  {candidate.skills && candidate.skills.length > 0 ? (
                    candidate.skills.map((skill: string, index: number) => (
                      <span key={index} className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-700/10">{skill}</span>
                    ))
                  ) : 'No skills listed'}
                </div>
              </dd>
            </div>
            <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('profile.about')}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300 sm:col-span-2 sm:mt-0">{candidate.bio || 'No bio provided.'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {profile?.role === 'hr' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            {/* Shortlist */}
            <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg p-6 border border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Bookmark className="h-5 w-5 text-indigo-600" /> {t('profile.shortlist_add')}
              </h3>
              <button
                onClick={toggleShortlist}
                className={`w-full flex justify-center items-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium transition-colors ${isShortlisted ? 'border-transparent text-white bg-green-600 hover:bg-green-700' : 'border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                {isShortlisted ? <><BookmarkCheck className="mr-2 h-5 w-5" /> {t('profile.shortlisted')}</> : <><Bookmark className="mr-2 h-5 w-5" /> {t('profile.shortlist_add')}</>}
              </button>
            </div>

            {/* CV Bank Import Card */}
            {hasCVBankAccess && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 shadow sm:rounded-lg p-6 border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2">
                   <span className="inline-flex items-center gap-x-1 rounded-md bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20"><Star className="h-3 w-3 fill-indigo-500 text-indigo-500" /> Premium</span>
                </div>
                <h3 className="text-base font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2 mb-2 mt-2">
                  <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> 
                  {t('profile.import_cvbank') || 'Import to CV Bank'}
                </h3>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mb-4">
                  {t('profile.import_desc') || 'Instantly copy this candidate’s CV and extracted profile data to your private AI CV Bank database for deeper analysis.'}
                </p>
                <button
                  onClick={openImportModal}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  <Database className="mr-2 h-4 w-4" /> {t('profile.import_action') || 'Import Profile'}
                </button>
              </div>
            )}

            {/* Rating + Tags form */}
            <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg p-6 border border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Tag className="h-5 w-5 text-indigo-600" /> {t('profile.rate')}
              </h3>

              {/* Stars */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('profile.rate_desc')}</p>
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star === selectedRating ? 0 : star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-2xl transition-transform hover:scale-110"
                  >
                    <span className={(hoverRating || selectedRating) >= star ? 'text-yellow-400' : 'text-gray-300 dark:text-slate-600'}>★</span>
                  </button>
                ))}
              </div>

              {/* Tags */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('profile.tags')}:</p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => toggleTag(tag.label)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-all ${tag.color} ${selectedTags.includes(tag.label) ? 'ring-2 scale-105' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {t(`tag.${tag.label}`, tag.label)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('profile.tags_desc')}</p>
            </div>
          </div>

          {/* Team Notes */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-slate-900 shadow sm:rounded-lg overflow-hidden flex flex-col h-full border border-gray-100 dark:border-slate-800">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-100 dark:border-slate-800">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('profile.notes')}</h3>
              </div>
              <div className="p-4 flex-grow bg-gray-50 dark:bg-slate-800 overflow-y-auto max-h-80">
                {notes.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">لا توجد ملاحظات بعد. كن أول من يضيف ملاحظة!</p>
                ) : (
                  <ul className="space-y-4">
                    {notes.map(note => {
                      const isMe = note.recruiter_id === session.user.id;
                      return (
                        <li key={note.id} className={`p-4 rounded-lg border shadow-sm transition-colors ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isMe ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}>
                                {isMe ? t('profile.you') : t('profile.colleague')}
                              </span>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{note.users?.email || 'Team member'}</span>
                              {note.rating && (
                                <span className="text-xs text-yellow-500">{'★'.repeat(note.rating)}{'☆'.repeat(5 - note.rating)}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(note.created_at).toLocaleDateString()}</span>
                          </div>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {note.tags.map((tag: string) => (
                                <span key={tag} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getTagStyle(tag)}`}>
                                  {t(`tag.${tag}`, tag)}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{note.note_text}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder={t('profile.note_ph')}
                    className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-gray-100 dark:bg-slate-800 sm:text-sm sm:leading-6 px-3 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="inline-flex justify-center items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import to CV Bank Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" dir={t('dir') || 'rtl'}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Database className="h-5 w-5 ml-2 text-indigo-600" /> {t('profile.import_modal_title') || 'Import to CV Bank'} (v2)
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              {importSuccess ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">{t('profile.import_success') || 'Import Successful!'}</h4>
                  <p className="text-sm text-gray-500 mt-1">{t('profile.import_success_desc') || 'Candidate has been added to your CV Bank.'}</p>
                </div>
              ) : (
                <>
                  {!candidate.cv_url ? (
                    <div className="text-center py-4">
                       <p className="text-red-500 text-sm font-medium">{t('profile.no_cv_error') || 'This candidate does not have a PDF/Word CV uploaded. The CV Bank requires a raw file for AI analysis.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.select_folder') || 'Select Destination Folder (Optional)'}</label>
                        <div className="relative">
                          <Folder className={`absolute ${t('dir') === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400`} />
                          <select
                            value={selectedFolder}
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            className={`block w-full ${t('dir') === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white`}
                          >
                            <option value="">-- {t('profile.unassigned') || 'Unassigned'} --</option>
                            {cvBankFolders.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {importError && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-xs font-medium">
                           ⚠️ {importError}
                        </div>
                      )}
                      
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={() => setIsImportModalOpen(false)}
                          className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          onClick={handleImportCV}
                          disabled={isImporting}
                          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isImporting ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'ar' ? 'جاري التحليل...' : 'Analyzing CV...'}
                            </>
                          ) : (language === 'ar' ? 'تأكيد الاستيراد' : 'Confirm Import')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
