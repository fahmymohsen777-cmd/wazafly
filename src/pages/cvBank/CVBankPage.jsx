/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef, Fragment } from 'react';
import htm from 'htm';
import { GoogleGenAI, Type } from "@google/genai";
import JSZip from 'jszip';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import './CVBank.css';

const html = htm.bind(React.createElement);

const translations = {
  en: {
    title: "AI CV Bank & Analyzer",
    uploadHeader: "1. Add to CV Bank",
    dropzoneText: "Drag & drop files here or click to select",
    supportedFormats: "(PDF, Word, Excel, ZIP)",
    analyzingStatus: (fileName) => `Analyzing ${fileName}...`,
    uploadComplete: (count) => `Successfully added ${count} new resumes.`,
    prepareFiles: "Preparing files...",
    matchHeader: "2. Analyze Candidates",
    jobDescriptionPlaceholder: "Paste the job description here...",
    quickScoreButton: (count) => `Quick Score ${count} Candidates`,
    generateReportButton: (count) => count > 0 ? `Generate Report for ${count} Selected` : "Generate Report",
    matchError: "Please enter a job description and select at least one resume to generate a report.",
    scoreError: "Please enter a job description to calculate scores.",
    reportGenerationError: "Report generation failed. The AI model returned an empty or invalid response. This may be due to content safety filters or a temporary service issue.",
    calculatingScores: "Calculating scores...",
    scoresCalculated: "Scores calculated successfully.",
    matchingStatus: "Generating report...",
    matchComplete: "Report successfully generated!",
    resultsHeader: (count) => `CV Bank (${count})`,
    filterJobPlaceholder: "Filter by Job...",
    filterGovernoratePlaceholder: "Filter by Governorate...",
    filterAgePlaceholder: "Age (e.g., 25-30)",
    filterSkillsPlaceholder: "Filter by skills (comma-separated)...",
    exactMatch: "Exact Match",
    placeholderText: "Your CV Bank is empty. Upload resumes to get started.",
    placeholderFolderText: "This folder is empty.",
    age: "Age",
    governorate: "Governorate",
    appliedFor: "Applied For",
    email: "Email",
    phone: "Phone",
    skills: "Skills",
    aiSummary: "AI Summary",
    unspecified: "Unspecified",
    analysisPrompt: 'Analyze this resume and extract the following information. Respond in English.',
    analysisError: (fileName) => `An error occurred while analyzing: ${fileName}`,
    viewCV: "View CV",
    downloadCV: "Download CV",
    moveCV: "Move CV",
    apiKeyError: "AI Service could not be initialized. Please ensure the API key is configured correctly in the environment.",
    supabaseError: "Could not connect to the CV Bank. Please check the configuration.",
    supabaseBucketNotFound: (bucketName) => `Storage bucket "${bucketName}" not found. Please create a public bucket with this exact name in your Supabase project's Storage section.`,
    supabaseRLSError: "Permission Denied: Your database security policy is blocking new uploads. Please run the required SQL commands in your Supabase SQL Editor to grant access.",
    loadingCVBank: "Loading CV Bank...",
    uploadingToBank: (fileName) => `Saving ${fileName} to CV Bank...`,
    footerText: "Made by Fahmy Mohsen",
    sortBy: "Sort by:",
    sortName: "Name",
    sortAge: "Age",
    sortGovernorate: "Governorate",
    sortSkills: "Skills",
    sortMatchScore: "Match Score",
    sortFavorites: "Favorites",
    deleteConfirm: (name) => `Are you sure you want to permanently delete the resume for ${name}? This action cannot be undone.`,
    deletingStatus: (name) => `Deleting resume for ${name}...`,
    deleteSuccess: "Resume deleted successfully.",
    folders: "Folders",
    allResumes: "All Resumes",
    unassigned: "Unassigned",
    favorites: "Favorites",
    addFolder: "Add New Folder",
    enterFolderName: "New folder name...",
    folderCreated: "Folder created successfully.",
    deleteFolderConfirm: (name) => `Are you sure you want to delete the folder "${name}"? Resumes inside it will become unassigned.`,
    folderDeleted: "Folder deleted successfully.",
    movingResume: "Moving resume...",
    moveTo: "Move to",
    noFolders: "No folders yet. Create one!",
    clearQueue: "Clear Completed",
    seeMore: "See More",
    seeLess: "See Less",
    selectAll: "Select All",
    reportModalTitle: "Candidate Analysis Report",
    close: "Close",
    deleteConfirmTitle: "Confirm Deletion",
    cancel: "Cancel",
    delete: "Delete",
    favorite: "Favorite",
    unfavorite: "Unfavorite",
    // Comments
    comments: "Comments",
    commentsFor: "Comments for",
    addComment: "Add a comment...",
    postComment: "Post",
    deleteCommentConfirm: "Are you sure you want to delete this comment?",
    noComments: "No comments yet. Be the first to add one!",
    // Auth translations
    login: "Login",
    signUp: "Sign Up",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    authToggleLogin: "Already have an account? Login",
    authToggleSignUp: "Don't have an account? Sign Up",
    logout: "Logout",
    loggedInAs: "Logged in as:",
    authError: "Authentication Error",
  },
  ar: {
    title: "بنك ومحلل السير الذاتية",
    uploadHeader: "١. إضافة إلى بنك السير الذاتية",
    dropzoneText: "اسحب وأفلت الملفات هنا أو انقر للاختيار",
    supportedFormats: "(PDF, Word, Excel, ZIP)",
    analyzingStatus: (fileName) => `جاري تحليل ${fileName}...`,
    uploadComplete: (count) => `تمت إضافة ${count} سيرة ذاتية جديدة بنجاح.`,
    prepareFiles: "جاري تحضير الملفات...",
    matchHeader: "٢. تحليل المرشحين",
    jobDescriptionPlaceholder: "الصق الوصف الوظيفي هنا...",
    quickScoreButton: (count) => `تقييم سريع لـ ${count} مرشحين`,
    generateReportButton: (count) => count > 0 ? `إنشاء تقرير لـ ${count} محددين` : "إنشاء تقرير",
    matchError: "يرجى إدخال وصف وظيفي واختيار مرشح واحد على الأقل لإنشاء تقرير.",
    scoreError: "يرجى إدخال وصف وظيفي لحساب درجات التقييم.",
    reportGenerationError: "فشل إنشاء التقرير. أعاد نموذج الذكاء الاصطناعي استجابة فارغة أو غير صالحة. قد يكون هذا بسبب مرشحات أمان المحتوى أو مشكلة مؤقتة في الخدمة.",
    calculatingScores: "جاري حساب التقييمات...",
    scoresCalculated: "تم حساب التقييمات بنجاح.",
    matchingStatus: "جاري إنشاء التقرير...",
    matchComplete: "تم إنشاء التقرير بنجاح!",
    resultsHeader: (count) => `بنك السير الذاتية (${count})`,
    filterJobPlaceholder: "تصفية بالوظيفة...",
    filterGovernoratePlaceholder: "تصفية بالمحافظة...",
    filterAgePlaceholder: "العمر (مثال: 25-30)",
    filterSkillsPlaceholder: "تصفية بالمهارات (مفصولة بفاصلة)...",
    exactMatch: "تطابق تام",
    placeholderText: "بنك السير الذاتية فارغ. قم برفع السير الذاتية للبدء.",
    placeholderFolderText: "هذا المجلد فارغ.",
    age: "العمر",
    governorate: "المحافظة",
    appliedFor: "الوظيفة المتقدم لها",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    skills: "المهارات",
    aiSummary: "ملخص الذكاء الاصطناعي",
    unspecified: "غير محدد",
    analysisPrompt: 'حلل هذه السيرة الذاتية واستخرج المعلومات التالية. أجب باللغة العربية.',
    analysisError: (fileName) => `حدث خطأ أثناء تحليل الملف: ${fileName}`,
    viewCV: "عرض السيرة الذاتية",
    downloadCV: "تحميل السيرة الذاتية",
    moveCV: "نقل السيرة الذاتية",
    apiKeyError: "تعذر تهيئة خدمة الذكاء الاصطناعي. يرجى التأكد من تكوين مفتاح الواجهة البرمجية بشكل صحيح في البيئة.",
    supabaseError: "لا يمكن الاتصال ببنك السير الذاتية. يرجى التحقق من الإعدادات.",
    supabaseBucketNotFound: (bucketName) => `حاوية التخزين "${bucketName}" غير موجودة. يرجى إنشاء حاوية تخزين عامة (public bucket) بهذا الاسم تمامًا في قسم التخزين بمشروعك على Supabase.`,
    supabaseRLSError: "تم رفض الإذن: سياسة الأمان في قاعدة البيانات تمنع رفع الملفات. يرجى تشغيل أوامر SQL اللازمة في محرر SQL بمشروعك على Supabase لمنح الصلاحيات.",
    loadingCVBank: "جاري تحميل بنك السير الذاتية...",
    uploadingToBank: (fileName) => `جاري حفظ ${fileName} في بنك السيرة الذاتية...`,
    footerText: "صنع بواسطة Fahmy Mohsen",
    sortBy: "ترتيب حسب:",
    sortName: "الاسم",
    sortAge: "العمر",
    sortGovernorate: "المحافظة",
    sortSkills: "المهارات",
    sortMatchScore: "درجة المطابقة",
    sortFavorites: "المفضلة",
    deleteConfirm: (name) => `هل أنت متأكد من رغبتك في حذف السيرة الذاتية لـ ${name} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
    deletingStatus: (name) => `جاري حذف السيرة الذاتية لـ ${name}...`,
    deleteSuccess: "تم حذف السيرة الذاتية بنجاح.",
    folders: "المجلدات",
    allResumes: "كل السير الذاتية",
    unassigned: "غير مصنف",
    favorites: "المفضلة",
    addFolder: "إضافة مجلد جديد",
    enterFolderName: "اسم المجلد الجديد...",
    folderCreated: "تم إنشاء المجلد بنجاح.",
    deleteFolderConfirm: (name) => `هل أنت متأكد من حذف المجلد "${name}"؟ ستصبح السير الذاتية بداخله غير مصنفة.`,
    folderDeleted: "تم حذف المجلد بنجاح.",
    movingResume: "جاري نقل السيرة الذاتية...",
    moveTo: "نقل إلى",
    noFolders: "لا توجد مجلدات. قم بإنشاء واحد!",
    clearQueue: "مسح المكتملة",
    seeMore: "عرض المزيد",
    seeLess: "عرض أقل",
    selectAll: "تحديد الكل",
    reportModalTitle: "تقرير تحليل المرشحين",
    close: "إغلاق",
    deleteConfirmTitle: "تأكيد الحذف",
    cancel: "إلغاء",
    delete: "حذف",
    favorite: "إضافة للمفضلة",
    unfavorite: "إزالة من المفضلة",
    // Comments
    comments: "التعليقات",
    commentsFor: "التعليقات على",
    addComment: "أضف تعليقاً...",
    postComment: "نشر",
    deleteCommentConfirm: "هل أنت متأكد من حذف هذا التعليق؟",
    noComments: "لا توجد تعليقات بعد. كن أول من يضيف تعليقاً!",
    // Auth translations
    login: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    emailPlaceholder: "البريد الإلكتروني",
    passwordPlaceholder: "كلمة المرور",
    authToggleLogin: "لديك حساب بالفعل؟ سجل الدخول",
    authToggleSignUp: "ليس لديك حساب؟ أنشئ حسابًا",
    logout: "تسجيل الخروج",
    loggedInAs: "تم تسجيل الدخول كـ:",
    authError: "خطأ في المصادقة",
  }
};

let ai = null;
try {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.error("Gemini API key not found. Set GEMINI_API_KEY in your environment.");
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI. API key might be missing.", e);
}

const generateContentWithRetry = async (ai, params, retries = 4, initialDelay = 2000) => {
    let attempt = 0;
    let delay = initialDelay;
    while (attempt < retries) {
        try {
            return await ai.models.generateContent(params);
        } catch (e) {
            attempt++;
            const errorMessage = (e instanceof Error) ? e.message : JSON.stringify(e);
            const isRetriable = errorMessage.includes('429') || errorMessage.includes('503') || errorMessage.toLowerCase().includes('resource_exhausted') || errorMessage.toLowerCase().includes('overloaded');
            if (isRetriable && attempt < retries) {
                const jitter = Math.random() * 1000;
                console.warn(`Retriable error detected. Retrying in ${(delay + jitter) / 1000}s... (Attempt ${attempt})`, e);
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
                delay *= 2;
            } else {
                console.error("Final attempt failed or non-retriable error:", e);
                throw e;
            }
        }
    }
    throw new Error("API call failed after multiple retries.");
};


const AuthComponent = ({ supabaseClient, T }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return html`
        <div class="auth-container">
            <div class="auth-box">
                <h1>${T.title}</h1>
                <form class="auth-form" onSubmit=${handleAuth}>
                    <input type="email" placeholder=${T.emailPlaceholder} value=${email} onInput=${e => setEmail(e.target.value)} required />
                    <input type="password" placeholder=${T.passwordPlaceholder} value=${password} onInput=${e => setPassword(e.target.value)} required />
                    <button type="submit" class="action-btn" disabled=${loading}>
                        ${loading ? html`<div class="loader"></div>` : T.login}
                    </button>
                </form>
                ${error && html`<div class="error-message" style=${{marginTop: '1.5rem'}}>${error}</div>`}
            </div>
            <footer class="app-footer">
                <p>${T.footerText}</p>
            </footer>
        </div>
    `;
};


const CVBankApp = ({ supabaseClient, session, T, onLangChange, theme, onThemeChange }) => {
  const [resumes, setResumes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [comments, setComments] = useState([]);
  const [profilesDict, setProfilesDict] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [filters, setFilters] = useState({ job: '', governorate: '', age: '', skills: '' });
  const [jobFilterExactMatch, setJobFilterExactMatch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', order: 'asc' });
  const [cardActionStates, setCardActionStates] = useState({});
  const [selectedFolderId, setSelectedFolderId] = useState('all');
  const [movingResumeId, setMovingResumeId] = useState(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadQueue, setUploadQueue] = useState([]);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [selectedResumeIds, setSelectedResumeIds] = useState(new Set());
  const [reportContent, setReportContent] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [tempScores, setTempScores] = useState({});
  const [loadingTask, setLoadingTask] = useState(null); // 'scoring' or 'reporting'
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [currentResumeForComments, setCurrentResumeForComments] = useState(null);
  const moveDropdownRef = useRef(null);
  const loadingIntervalRef = useRef(null);

  const lang = T === translations.ar ? 'ar' : 'en';

  const reportLoadingMessages = {
      en: ["Analyzing job description...", "Comparing candidate summaries...", "Identifying strengths & weaknesses...", "Formatting final report..."],
      ar: ["جاري تحليل الوصف الوظيفي...", "مقارنة ملخصات المرشحين...", "تحديد نقاط القوة والضعف...", "تنسيق التقرير النهائي..."]
  };
  const scoreLoadingMessages = {
      en: ["Reading job description...", "Evaluating candidate skills...", "Calculating match scores...", "Finalizing results..."],
      ar: ["قراءة الوصف الوظيفي...", "تقييم مهارات المرشحين...", "حساب درجات المطابقة...", "وضع اللمسات الأخيرة..."]
  };

  useEffect(() => {
    if (isLoading && loadingTask) {
        const messages = loadingTask === 'reporting' ? reportLoadingMessages[lang] : scoreLoadingMessages[lang];
        let messageIndex = 0;
        setStatusMessage(messages[0]);
        
        loadingIntervalRef.current = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setStatusMessage(messages[messageIndex]);
        }, 2500);
    } else {
        clearInterval(loadingIntervalRef.current);
        if (loadingTask) setLoadingTask(null);
    }
    return () => clearInterval(loadingIntervalRef.current);
  }, [isLoading, loadingTask, lang]);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
  };

  const loadAppData = useCallback(async () => {
    if (!supabaseClient) return;
    setIsLoading(true);
    setStatusMessage(T.loadingCVBank);
    setError('');
    try {
        const [resumesResponse, foldersResponse, commentsResponse, profilesResponse] = await Promise.all([
            supabaseClient.from('resumes').select('*'),
            supabaseClient.from('folders').select('*'),
            supabaseClient.from('comments').select('*, users(email)').order('created_at', { ascending: true }),
            supabaseClient.from('profiles').select('user_id, name')
        ]);

        if (resumesResponse.error) throw new Error(`Resumes: ${resumesResponse.error.message}`);
        if (foldersResponse.error) throw new Error(`Folders: ${foldersResponse.error.message}`);
        if (commentsResponse.error) throw new Error(`Comments: ${commentsResponse.error.message}`);
        
        const pDict = {};
        if (profilesResponse.data) {
           profilesResponse.data.forEach(p => { pDict[p.user_id] = p.name; });
        }
        setProfilesDict(pDict);
        
        const safeResumesData = resumesResponse.data || [];
        const safeFoldersData = foldersResponse.data || [];
        const safeCommentsData = commentsResponse.data || [];

        const mappedResumes = safeResumesData.map(r => ({
            id: r.id, name: r.name, age: r.age, governorate: r.governorate, email: r.email,
            phone: r.phone, appliedFor: r.applied_for, skills: r.skills, aiSummary: r.ai_summary,
            fileURL: r.file_url, fileName: r.file_name, folderId: r.folder_id, is_favorited: r.is_favorited
        }));
        
        const sortedFolders = safeFoldersData.sort((a,b) => a.name.localeCompare(b.name));
        setFolders(sortedFolders);
        setResumes(mappedResumes);
        setComments(safeCommentsData);

    } catch (e) {
        console.error("Error fetching app data:", e);
        const errorMessage = e.message || 'An unknown database error occurred.';
        setError(`Failed to load CV Bank: ${errorMessage}`);
    } finally {
        setIsLoading(false);
        setStatusMessage('');
    }
  }, [supabaseClient, T]);

  useEffect(() => {
    if (supabaseClient && session) { // Only load data if there is a session
        loadAppData();
    }
  }, [supabaseClient, session, loadAppData]);


  useEffect(() => {
    const handleClickOutside = (event) => {
        if (moveDropdownRef.current && !moveDropdownRef.current.contains(event.target)) {
            setMovingResumeId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
    
  // Clear temporary scores if filters or job description change
  useEffect(() => {
    setTempScores({});
  }, [filters, jobDescription, selectedFolderId]);

  const resumeSchema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Candidate\'s full name (Use Arabic if possible)' },
        age: { type: Type.NUMBER, description: 'Candidate\'s age' },
        governorate: { type: Type.STRING, description: 'The governorate or city where the candidate resides (in Arabic)' },
        email: { type: Type.STRING, description: 'Candidate\'s email address' },
        phone: { type: Type.STRING, description: 'Candidate\'s phone number' },
        appliedFor: { type: Type.STRING, description: 'The job position applied for (in Arabic)' },
        skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'A list of key skills (MUST BE IN ARABIC)' },
        aiSummary: { type: Type.STRING, description: 'A comprehensive 3-4 sentence summary report of the CV, highlighting key skills, total years of experience, and their strongest qualifications. MUST BE WRITTEN IN ARABIC.' },
      },
      required: ['name', 'skills', 'aiSummary']
  };
    
  const fileToGenerativePart = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({ inlineData: { mimeType: file.type, data: base64Data } });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const analyzeResume = async (file) => {
    try {
      const part = await fileToGenerativePart(file);
      const result = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: { parts: [ part, { text: T.analysisPrompt } ] },
        config: { responseMimeType: "application/json", responseSchema: resumeSchema }
      });
      return JSON.parse(result.text);
    } catch (e) {
      console.error(`Error analyzing ${file.name}:`, e);
      let errorMessage = T.analysisError(file.name);
      const errorString = (e instanceof Error) ? e.message : JSON.stringify(e);
      if (errorString.includes('429') || errorString.includes('503') || errorString.toLowerCase().includes('overloaded')) {
          errorMessage += ' (The AI service is temporarily overloaded. Please try again in a few moments).';
      }
      throw new Error(errorMessage);
    }
  };

  const handleFileDrop = useCallback(async (files) => {
    if (!ai || !supabaseClient) {
        setError((!ai ? T.apiKeyError : '') + (!supabaseClient ? '\n' + T.supabaseError : ''));
        return;
    }
    setStatusMessage(T.prepareFiles);
    setError('');

    let allFiles = [];
    const supportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            const zip = await JSZip.loadAsync(file);
            for (const filename in zip.files) {
                if (!zip.files[filename].dir && supportedExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
                    const blob = await zip.files[filename].async('blob');
                    allFiles.push(new File([blob], filename));
                }
            }
        } else if (supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
            allFiles.push(file);
        }
    }

    const newQueueItems = allFiles.map(file => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        status: 'queued',
        error: null,
    }));

    setUploadQueue(prev => [...prev, ...newQueueItems]);
    setStatusMessage('');
  }, [T, supabaseClient]);

  useEffect(() => {
    if (uploadQueue.some(item => item.status === 'processing')) {
        return;
    }

    const nextItem = uploadQueue.find(item => item.status === 'queued');

    if (!nextItem) {
        const successCount = uploadQueue.filter(i => i.status === 'success').length;
        const errorCount = uploadQueue.filter(i => i.status === 'error').length;
        if (uploadQueue.length > 0 && successCount + errorCount === uploadQueue.length) {
            let finalMsg = '';
            if (successCount > 0) finalMsg += T.uploadComplete(successCount);
            if (errorCount > 0) finalMsg += ` ${errorCount} failed.`;
            setStatusMessage(finalMsg.trim());
        }
        return;
    }

    const processItem = async (item) => {
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
        try {
            const analysisData = await analyzeResume(item.file);
            if (!analysisData) {
                throw new Error(`Analysis returned no data for ${item.file.name}.`);
            }
            const currentFolderId = (selectedFolderId !== 'all' && selectedFolderId !== 'unassigned' && selectedFolderId !== 'favorites') ? selectedFolderId : null;
            const filePath = `${session.user.id}/${Date.now()}-${item.file.name.replace(/\s/g, '_')}`;
            const { error: uploadError } = await supabaseClient.storage.from('resumes').upload(filePath, item.file);

            if (uploadError) {
                if (uploadError.message.toLowerCase().includes('bucket not found')) throw new Error(T.supabaseBucketNotFound('resumes'));
                throw new Error(`Storage upload failed: ${uploadError.message}`);
            }

            const { data: urlData } = supabaseClient.storage.from('resumes').getPublicUrl(filePath);
            const resumeForDb = {
                name: analysisData.name, age: analysisData.age, governorate: analysisData.governorate, email: analysisData.email,
                phone: analysisData.phone, applied_for: analysisData.appliedFor, skills: analysisData.skills,
                ai_summary: analysisData.aiSummary, file_url: urlData.publicUrl, file_name: item.file.name,
                folder_id: currentFolderId, user_id: session.user.id, is_favorited: false
            };

            const { data: insertData, error: insertError } = await supabaseClient.from('resumes').insert(resumeForDb).select().single();
            if (insertError) {
                await supabaseClient.storage.from('resumes').remove([filePath]);
                if (insertError.message.toLowerCase().includes('row-level security')) throw new Error(T.supabaseRLSError);
                throw new Error(`Database insert failed: ${insertError.message}`);
            }

            const newResume = {
                id: insertData.id, name: insertData.name, age: insertData.age, governorate: insertData.governorate,
                email: insertData.email, phone: insertData.phone, appliedFor: insertData.applied_for,
                skills: insertData.skills, aiSummary: insertData.ai_summary, 
                fileURL: insertData.file_url, fileName: insertData.file_name, folderId: insertData.folder_id,
                is_favorited: insertData.is_favorited
            };
            setResumes(prev => [...prev, newResume]);
            setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success' } : i));
        } catch (e) {
            console.error(`Failed to process ${item.file.name}:`, e);
            setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: e.message } : i));
        }
    };

    processItem(nextItem);

  }, [uploadQueue, T, supabaseClient, session, selectedFolderId]);
    
  const handleDragEvents = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragover') setIsDragging(true);
      if (e.type === 'dragleave' || e.type === 'drop') setIsDragging(false);
  };
    
  const onDrop = (e) => {
      handleDragEvents(e);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) handleFileDrop(Array.from(files));
  };

  const onFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileDrop(Array.from(files));
  };
    
  const handleDownloadResume = async (resumeToDownload) => {
    if (!resumeToDownload || !resumeToDownload.fileURL) return;

    setCardActionStates(prev => ({ ...prev, [resumeToDownload.id]: 'downloading' }));
    setError('');

    try {
      const response = await fetch(resumeToDownload.fileURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resumeToDownload.fileName || 'resume';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      }, 1000);
    } catch (e) {
      console.error("Download failed:", e);
      setError(`Failed to download ${resumeToDownload.fileName}: ${e.message}`);
    } finally {
      setCardActionStates(prev => ({ ...prev, [resumeToDownload.id]: null }));
    }
  };

  const handleDeleteResume = async (resumeToDelete) => {
    if (!supabaseClient || !resumeToDelete) return;
    
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
    setError('');
    setCardActionStates(prev => ({ ...prev, [resumeToDelete.id]: 'deleting' }));

    try {
      const filePath = resumeToDelete.fileURL.substring(
        resumeToDelete.fileURL.lastIndexOf('/resumes/') + '/resumes/'.length
      );
      
      const { error: storageError } = await supabaseClient.storage.from('resumes').remove([filePath]);

      if (storageError && storageError.message !== 'The resource was not found') {
        throw new Error(`Failed to delete file from storage: ${storageError.message}. Check your Storage RLS policies.`);
      }

      const { error: dbError } = await supabaseClient.from('resumes').delete().eq('id', resumeToDelete.id);
      if (dbError) {
        throw new Error(`Database record deletion failed: ${dbError.message}. Check your Table RLS policies.`);
      }

      setResumes(prev => prev.filter(r => r.id !== resumeToDelete.id));
      setSelectedResumeIds(prev => { const next = new Set(prev); next.delete(resumeToDelete.id); return next; });
      setTempScores(prev => { const next = {...prev}; delete next[resumeToDelete.id]; return next; });
      const successMsg = T.deleteSuccess;
      setStatusMessage(successMsg);
      setTimeout(() => setStatusMessage(prev => prev === successMsg ? '' : prev), 4000);

    } catch (e) {
      console.error("Deletion process failed.", e);
      setError(e.message);
    } finally {
      setCardActionStates(prev => ({ ...prev, [resumeToDelete.id]: null }));
    }
  };

  const handleGenerateReport = async () => {
    if (!ai) { setError(T.apiKeyError); return; }
    if (!jobDescription || selectedResumeIds.size === 0) {
        setError(T.matchError);
        return;
    }
    setIsLoading(true);
    setLoadingTask('reporting');
    setError('');

    try {
        const candidatesToAnalyze = resumes
            .filter(r => selectedResumeIds.has(r.id))
            .map(r => `---
        Candidate Name: ${r.name}
        Skills: ${(r.skills || []).join(', ')}
        AI Summary: ${r.aiSummary}
        ---`).join('\n\n');

        const prompt = `You are a world-class, senior technical recruiter with over 15 years of experience. Your analysis must be objective, data-driven, and hyper-critical. Avoid subjective language and focus solely on the alignment between the candidate's documented skills/experience and the job description's requirements.

**Job Description:**
${jobDescription}

**Candidates Data:**
${candidatesToAnalyze}

**Your Task:**
1.  Rigorously analyze each candidate against the job description.
2.  After analyzing all candidates, perform a comparative analysis to determine the absolute best fit.
3.  Generate a detailed report in **Arabic**, formatted precisely with the Markdown structure below. Your recommendation must be based solely on the provided data.

**Required Report Structure (Use these exact headers in Arabic):**

### ١. ملخص التحليل
(A brief, professional paragraph summarizing the key findings and the overall quality of the candidate pool.)

### ٢. أفضل مرشح للوظيفة
(Clearly state the name of the single most suitable candidate. Provide a detailed, data-driven justification explaining why they are the strongest match compared to the others, referencing specific skills and experiences.)

### ٣. تحليل فردي للمرشحين
(For each candidate, provide the following detailed analysis):

**اسم المرشح:** [Candidate's Name]
*   **نقاط التوافق الرئيسية (نقاط القوة):** (A bulleted list of specific skills and experiences that directly align with the job description's requirements.)
*   **الفجوات المحتملة (نقاط الضعف):** (A bulleted list of required skills or experiences mentioned in the job description that are missing or not clearly stated in the candidate's summary.)
*   **توصيات لسد الفجوات:** (A bulleted list of concrete, practical suggestions like specific training courses, certifications, or project experiences the candidate needs to become a 100% fit.)

---
(Repeat the section above for each candidate, separated by a horizontal rule)
---

### ٤. التوصية النهائية
(A concluding paragraph with a clear, final recommendation for the hiring manager. For example: "Based on this rigorous analysis, I strongly recommend proceeding immediately with an interview for [Top Candidate's Name]. Candidates [Candidate B] and [Candidate C] could be considered if the top choice is unavailable.")
`;

        const result = await generateContentWithRetry(ai, {
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0.2,
            }
        });

        const responseText = result.text;
        
        if (responseText && responseText.trim().length > 10) { // Check for meaningful content
            setReportContent(responseText);
            setIsReportModalOpen(true);
            setStatusMessage(T.matchComplete);
            setTimeout(() => setStatusMessage(''), 4000);
        } else {
            console.error("AI returned an empty or invalid report.", result);
            setError(T.reportGenerationError);
            setStatusMessage('');
        }

    } catch (e) {
        console.error('Error generating report:', e);
        let errorMessage = `Error generating report.`;
        const errorString = (e instanceof Error) ? e.message : JSON.stringify(e);
        if (errorString.includes('429') || errorString.includes('503') || errorString.toLowerCase().includes('overloaded')) {
            errorMessage += ' (The AI service is temporarily overloaded. Please try again in a few moments).';
        }
        setError(errorMessage);
        setStatusMessage('');
    } finally {
        setIsLoading(false);
    }
  };

  const handleCalculateScores = async () => {
    if (!ai) { setError(T.apiKeyError); return; }
    if (!jobDescription.trim()) { setError(T.scoreError); return; }

    const resumesToScore = selectedResumeIds.size > 0 
        ? resumes.filter(r => selectedResumeIds.has(r.id))
        : filteredAndSortedResumes;
        
    if (resumesToScore.length === 0) return;

    setIsLoading(true);
    setLoadingTask('scoring');
    setError('');

    try {
        const candidatesToScore = resumesToScore.map(r => ({
            id: r.id,
            summary: r.aiSummary,
            skills: r.skills,
        }));
        
        const scoreSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    resumeId: { type: Type.NUMBER },
                    score: { type: Type.NUMBER, description: 'Match score from 0 to 100 based on the job description.' },
                    reason: { type: Type.STRING, description: 'A brief, one-sentence justification for the score.' }
                },
                required: ['resumeId', 'score', 'reason']
            }
        };

        const prompt = `Based on the following job description, score each candidate from 0 to 100 on their suitability. Provide a short reason for each score.

Job Description:
${jobDescription}

Candidates:
${JSON.stringify(candidatesToScore, null, 2)}
`;
        const result = await generateContentWithRetry(ai, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: scoreSchema }
        });

        const scoresArray = JSON.parse(result.text);
        const scoresMap = scoresArray.reduce((acc, item) => {
            acc[item.resumeId] = { score: item.score, reason: item.reason };
            return acc;
        }, {});

        setTempScores(scoresMap);
        setStatusMessage(T.scoresCalculated);
        setTimeout(() => setStatusMessage(''), 4000);
    } catch (e) {
        console.error('Error calculating scores:', e);
        setError('Failed to calculate scores. The AI model may be overloaded.');
        setStatusMessage('');
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddNewFolder = async (folderName) => {
    if (!folderName.trim() || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('folders').insert({ name: folderName.trim(), user_id: session.user.id }).select().single();
        if (error) throw error;
        setFolders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        const successMsg = T.folderCreated;
        setStatusMessage(successMsg);
        setTimeout(() => setStatusMessage(prev => prev === successMsg ? '' : prev), 4000);
    } catch (e) {
        setError(`Failed to create folder: ${e.message}`);
    }
  };

  const handleDeleteFolder = async (folder) => {
    setConfirmModal({
        isOpen: true,
        title: T.deleteConfirmTitle,
        message: T.deleteFolderConfirm(folder.name),
        onConfirm: async () => {
            if (!supabaseClient) return;
            setConfirmModal({ isOpen: false });
            setError('');

            try {
                const { error } = await supabaseClient.from('folders').delete().eq('id', folder.id);
                if (error) {
                    throw new Error(`Failed to delete folder: ${error.message}. Please check your RLS policies on the 'folders' table.`);
                }

                setFolders(prev => prev.filter(f => f.id !== folder.id));
                setResumes(prev => prev.map(r => r.folderId === folder.id ? { ...r, folderId: null } : r));

                if (selectedFolderId === folder.id) {
                    setSelectedFolderId('all');
                }
                const successMsg = T.folderDeleted;
                setStatusMessage(successMsg);
                setTimeout(() => setStatusMessage(prev => prev === successMsg ? '' : prev), 4000);
            } catch (e) {
                console.error("Failed to delete folder:", e);
                setError(e.message);
            }
        }
    });
  };

  const handleMoveResume = async (resumeId, folderId) => {
    if (!supabaseClient) return;
    setMovingResumeId(null);
    setCardActionStates(prev => ({ ...prev, [resumeId]: 'moving' }));
    try {
        const { error } = await supabaseClient.from('resumes').update({ folder_id: folderId }).eq('id', resumeId);
        if (error) throw error;
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, folderId } : r));
    } catch (e) {
        setError(`Failed to move resume: ${e.message}`);
    } finally {
        setCardActionStates(prev => ({ ...prev, [resumeId]: null }));
    }
  };
    
  const handleToggleFavorite = async (resumeToToggle) => {
    if (!supabaseClient) return;
    const { id, is_favorited } = resumeToToggle;

    setCardActionStates(prev => ({ ...prev, [id]: 'favoriting' }));
    setResumes(prev => prev.map(r => r.id === id ? { ...r, is_favorited: !is_favorited } : r));

    try {
      const { error } = await supabaseClient
        .from('resumes')
        .update({ is_favorited: !is_favorited })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      setResumes(prev => prev.map(r => r.id === id ? { ...r, is_favorited } : r));
      setError(`Failed to update favorite status: ${e.message}`);
    } finally {
      setCardActionStates(prev => ({ ...prev, [id]: null }));
    }
  };
  
  const handleAddComment = async (resumeId, content) => {
    if (!content.trim() || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .insert({
                resume_id: resumeId,
                text: content.trim(),
                user_id: session.user.id,
            })
            .select('*, users(email)')
            .single();
        if (error) throw error;
        setComments(prev => [...prev, data]);
    } catch(e) {
        setError(`Failed to add comment: ${e.message}`);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('comments')
            .delete()
            .eq('id', commentId);
        if (error) throw error;
        setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
        setError(`Failed to delete comment: ${e.message}`);
    }
  };


  const handleSortChange = (e) => setSortConfig(prev => ({ ...prev, key: e.target.value }));

  const folderCounts = useMemo(() => {
    const counts = { unassigned: 0, favorites: 0 };
    folders.forEach(f => counts[f.id] = 0);
    resumes.forEach(r => {
        if (r.folderId) {
            counts[r.folderId] = (counts[r.folderId] || 0) + 1;
        } else {
            counts.unassigned++;
        }
        if (r.is_favorited) {
            counts.favorites++;
        }
    });
    return counts;
  }, [resumes, folders]);

  const commentsByResumeId = useMemo(() => {
    return comments.reduce((acc, comment) => {
        (acc[comment.resume_id] = acc[comment.resume_id] || []).push(comment);
        return acc;
    }, {});
  }, [comments]);

  const filteredAndSortedResumes = useMemo(() => {
    const resumesInScope = [...resumes].filter(r => {
        if (selectedFolderId === 'all') return true;
        if (selectedFolderId === 'favorites') return r.is_favorited;
        if (selectedFolderId === 'unassigned') return !r.folderId;
        return r.folderId === selectedFolderId;
    });

    return resumesInScope
        .filter(r => {
            const jobMatch = !filters.job || (r.appliedFor && (
                jobFilterExactMatch
                    ? r.appliedFor.toLowerCase() === filters.job.toLowerCase()
                    : r.appliedFor.toLowerCase().includes(filters.job.toLowerCase())
            ));

            const govMatch = !filters.governorate || (r.governorate && r.governorate.toLowerCase().includes(filters.governorate.toLowerCase()));
            
            const ageFilter = String(filters.age || '').trim();
            let ageMatch = true;
            if (ageFilter) {
                if (r.age === null || r.age === undefined) {
                    ageMatch = false;
                } else if (ageFilter.includes('-')) {
                    const [min, max] = ageFilter.split('-').map(Number);
                    ageMatch = r.age >= min && r.age <= max;
                } else {
                    ageMatch = r.age === Number(ageFilter);
                }
            }

            const requiredSkills = filters.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const candidateSkills = Array.isArray(r.skills) ? r.skills : (typeof r.skills === 'string' ? r.skills.split(',') : []);
            
            const skillsMatch = requiredSkills.length === 0 || (
                candidateSkills.length > 0 && requiredSkills.every(reqSkill =>
                    candidateSkills.some(cs => cs.toLowerCase().includes(reqSkill))
                )
            );

            return jobMatch && govMatch && ageMatch && skillsMatch;
        })
        .sort((a, b) => {
            const { key } = sortConfig;

            if (key === 'matchScore') {
                const scoreA = tempScores[a.id]?.score ?? -1;
                const scoreB = tempScores[b.id]?.score ?? -1;
                return scoreB - scoreA;
            }
            
            if (key === 'is_favorited') {
                return (b.is_favorited ? 1 : 0) - (a.is_favorited ? 1 : 0);
            }

            let valA = a[key], valB = b[key];

            if (key === 'skills') {
                valA = (valA || []).join(', ');
                valB = (valB || []).join(', ');
            }

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            let comparison = 0;
            if (typeof valA === 'string') {
                comparison = valA.toLowerCase().localeCompare(String(valB).toLowerCase());
            } else {
                comparison = valA - valB;
            }
            return sortConfig.order === 'asc' ? comparison : -comparison;
        });
  }, [resumes, filters, sortConfig, selectedFolderId, jobFilterExactMatch, tempScores]);
  
  const toggleCardExpansion = (resumeId) => {
    setExpandedCards(prev => {
        const next = new Set(prev);
        if (next.has(resumeId)) {
            next.delete(resumeId);
        } else {
            next.add(resumeId);
        }
        return next;
    });
  };

  const handleResumeSelection = (resumeId) => {
    setSelectedResumeIds(prev => {
        const next = new Set(prev);
        if (next.has(resumeId)) {
            next.delete(resumeId);
        } else {
            next.add(resumeId);
        }
        return next;
    });
  };

  const handleSelectAll = () => {
    const allVisibleIds = filteredAndSortedResumes.map(r => r.id);
    const allCurrentlyVisibleAreSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedResumeIds.has(id));

    setSelectedResumeIds(prev => {
        const next = new Set(prev);
        if (allCurrentlyVisibleAreSelected) {
            allVisibleIds.forEach(id => next.delete(id));
        } else {
            allVisibleIds.forEach(id => next.add(id));
        }
        return next;
    });
  };

  const UploadQueue = () => {
    if (uploadQueue.length === 0) return null;
    const StatusIcon = ({ status, error }) => {
        const iconMap = {
            queued: html`<svg class="status-queued" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            processing: html`<div class="loader status-processing"></div>`,
            success: html`<svg class="status-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            error: html`
                <div class="queue-item-error-tooltip">
                    <svg class="status-error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    <span class="tooltip-text">${error}</span>
                </div>`,
        };
        return html`<div class="queue-item-icon">${iconMap[status]}</div>`;
    };
    const isQueueFinished = uploadQueue.every(item => item.status === 'success' || item.status === 'error');
    return html`<div class="upload-queue-container"><ul class="upload-queue-list">${uploadQueue.map(item => html`<li class="upload-queue-item" key=${item.id}><${StatusIcon} status=${item.status} error=${item.error} /><span class="queue-item-name">${item.file.name}</span></li>`)}</ul></div>${isQueueFinished && html`<div class="upload-queue-footer"><button class="clear-queue-btn" onClick=${() => setUploadQueue([])}>${T.clearQueue}</button></div>`}`;
  };

  const handleSaveNewFolder = () => {
    handleAddNewFolder(newFolderName);
    setNewFolderName('');
    setIsAddingFolder(false);
  };

    const ReportModal = ({ content, onClose, T }) => {
        const renderMarkdown = (text) => {
            if (!text) return null;
            const blocks = text.split(/(\n---\n)/);
            return blocks.map(block => {
                if (block === '\n---\n') {
                    return html`<hr class="report-divider" />`;
                }
                const lines = block.split('\n').filter(line => line.trim() !== '');
                const listItems = [];

                const flushList = () => {
                    if (listItems.length === 0) return null;
                    const list = html`<ul>${listItems.map(item => html`<li>${item}</li>`)}</ul>`;
                    listItems.length = 0; // Clear the array
                    return list;
                };

                const elements = [];
                lines.forEach(line => {
                    if (line.startsWith('### ')) {
                        elements.push(flushList());
                        elements.push(html`<h3>${line.substring(4)}</h3>`);
                    } else if (line.match(/^\*\s+/)) {
                        listItems.push(line.replace(/^\*\s+/, ''));
                    } else if (line.match(/^- \s+/)) {
                        listItems.push(line.replace(/^- \s+/, ''));
                    } else {
                        elements.push(flushList());
                        const parts = line.split(/(\*\*.*?\*\*|\*\*.*)/).map(part => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return html`<strong>${part.substring(2, part.length - 2)}</strong>`;
                            }
                            return part;
                        });
                        elements.push(html`<p>${parts}</p>`);
                    }
                });
                elements.push(flushList());
                return elements.filter(el => el !== null);
            });
        };

        return html`
            <div class="report-modal-overlay" onClick=${onClose}>
                <div class="report-modal" onClick=${e => e.stopPropagation()}>
                    <div class="report-modal-header">
                        <h3>${T.reportModalTitle}</h3>
                        <button class="report-modal-close-btn" onClick=${onClose} aria-label=${T.close}>
                            <svg xmlns="http://www.w3.org/2000/svg" style="width:24px;height:24px" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div class="report-modal-content">
                       ${renderMarkdown(content)}
                    </div>
                </div>
            </div>
        `;
    };
    
    const ConfirmModal = ({ title, message, onConfirm, onCancel, T }) => {
        if (!title) return null;
        return html`
            <div class="report-modal-overlay" onClick=${onCancel}>
                <div class="confirm-modal" onClick=${e => e.stopPropagation()}>
                    <div class="confirm-modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="confirm-modal-content">
                        <p>${message}</p>
                    </div>
                    <div class="confirm-modal-actions">
                        <button class="modal-btn" onClick=${onCancel}>${T.cancel}</button>
                        <button class="modal-btn confirm-delete-btn" onClick=${onConfirm}>${T.delete}</button>
                    </div>
                </div>
            </div>
        `;
    };

    const CommentModal = ({ resume, comments, session, T, onClose, onCommentAdd, onCommentDelete }) => {
      if (!resume) return null;
      const [newComment, setNewComment] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const textareaRef = useRef(null);

      const timeAgo = (date) => {
          const seconds = Math.floor((new Date() - new Date(date)) / 1000);
          let interval = seconds / 31536000;
          if (interval > 1) return Math.floor(interval) + (lang === 'ar' ? " سنة" : " years ago");
          interval = seconds / 2592000;
          if (interval > 1) return Math.floor(interval) + (lang === 'ar' ? " شهر" : " months ago");
          interval = seconds / 86400;
          if (interval > 1) return Math.floor(interval) + (lang === 'ar' ? " يوم" : " days ago");
          interval = seconds / 3600;
          if (interval > 1) return Math.floor(interval) + (lang === 'ar' ? " ساعة" : " hours ago");
          interval = seconds / 60;
          if (interval > 1) return Math.floor(interval) + (lang === 'ar' ? " دقيقة" : " minutes ago");
          return lang === 'ar' ? 'الآن' : 'just now';
      };
      
      const handleTextareaInput = (e) => {
        setNewComment(e.target.value);
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
      };
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsSubmitting(true);
        await onCommentAdd(resume.id, newComment);
        setNewComment('');
        setIsSubmitting(false);
        const textarea = textareaRef.current;
        if (textarea) {
            // After submitting, reset height
            textarea.style.height = 'auto';
        }
      };
      
      const handleDeleteClick = (commentId) => {
        setConfirmModal({
            isOpen: true,
            title: T.deleteConfirmTitle,
            message: T.deleteCommentConfirm,
            onConfirm: () => {
                setConfirmModal({ isOpen: false });
                onCommentDelete(commentId);
            }
        });
      };

      return html`
        <div class="report-modal-overlay" onClick=${onClose}>
          <div class="comment-modal" onClick=${e => e.stopPropagation()}>
            <div class="comment-modal-header">
              <h3>${T.commentsFor}<span>${resume.name}</span></h3>
              <button class="report-modal-close-btn" onClick=${onClose} aria-label=${T.close}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div class="comment-modal-body">
              ${comments.length > 0 ? html`
                <ul class="comment-list">
                  ${comments.map(comment => html`
                    <li class="comment-item" key=${comment.id}>
                      <div class="comment-author-avatar">${(profilesDict[comment.user_id] || comment.users?.email || 'U').substring(0, 1).toUpperCase()}</div>
                      <div class="comment-content-wrapper">
                        <div class="comment-meta">
                          <span class="comment-author-name">${profilesDict[comment.user_id] || comment.users?.email || 'Anonymous'}</span>
                          <div>
                            <span class="comment-timestamp">${timeAgo(comment.created_at)}</span>
                            ${comment.user_id === session.user.id && html`
                              <button class="delete-comment-btn" onClick=${() => handleDeleteClick(comment.id)} title=${T.delete}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                              </button>
                            `}
                          </div>
                        </div>
                        <p class="comment-text">${comment.text}</p>
                      </div>
                    </li>
                  `)}
                </ul>
              ` : html`
                <div class="no-comments-placeholder">${T.noComments}</div>
              `}
            </div>
            <div class="comment-modal-footer">
              <form class="add-comment-form" onSubmit=${handleSubmit}>
                <textarea 
                  ref=${textareaRef}
                  placeholder=${T.addComment} 
                  value=${newComment}
                  onInput=${handleTextareaInput}
                  disabled=${isSubmitting}
                  rows="1"
                ></textarea>
                <button type="submit" class="action-btn" disabled=${isSubmitting || !newComment.trim()}>
                  ${isSubmitting ? html`<div class="loader card-loader"></div>` : T.postComment}
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
    };


  const allVisibleSelected = filteredAndSortedResumes.length > 0 && filteredAndSortedResumes.every(r => selectedResumeIds.has(r.id));
  const resumesToScoreCount = selectedResumeIds.size > 0 ? selectedResumeIds.size : filteredAndSortedResumes.length;

  return html`
    <${Fragment}>
      <main class="app-content">
        <div class="top-controls">
          <div class="control-section">
            <h3>${T.uploadHeader}</h3>
            <div class=${`dropzone ${isDragging ? 'drag-over' : ''}`} onDragOver=${handleDragEvents} onDragLeave=${handleDragEvents} onDrop=${onDrop} onClick=${() => document.getElementById('file-upload').click()}>
              <input type="file" id="file-upload" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" onChange=${onFileChange} style=${{ display: 'none' }} />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V8.25c0-1.12.93-2.25 2.25-2.25h13.5c1.12 0 2.25 1.017 2.25 2.25v9c0 1.12-.93 2.25-2.25-2.25H5.25c-1.12 0-2.25-1.017-2.25-2.25z" /></svg>
              <p>${T.dropzoneText}</p>
              <p><small>${T.supportedFormats}</small></p>
            </div>
            <${UploadQueue} />
          </div>
          <div class="control-section">
            <h3>${T.matchHeader}</h3>
            <textarea placeholder=${T.jobDescriptionPlaceholder} value=${jobDescription} onInput=${e => setJobDescription(e.target.value)} disabled=${isLoading}></textarea>
            <div class="analysis-actions">
              <button class="action-btn" onClick=${handleCalculateScores} disabled=${isLoading || !jobDescription.trim() || resumesToScoreCount === 0}>
                  ${T.quickScoreButton(resumesToScoreCount)}
              </button>
              <button class="action-btn" onClick=${handleGenerateReport} disabled=${isLoading || !jobDescription.trim() || selectedResumeIds.size === 0}>
                  ${T.generateReportButton(selectedResumeIds.size)}
              </button>
            </div>
            ${isLoading && html`
              <div class="interactive-loader">
                  <div class="loader"></div>
                  <p>${statusMessage}</p>
              </div>
            `}
          </div>
        </div>

        <div class="folders-container">
            <div class="folders-header">
                <h3>${T.folders}</h3>
                ${isAddingFolder
                    ? html`
                        <div class="add-folder-form">
                            <input
                                type="text"
                                placeholder=${T.enterFolderName}
                                value=${newFolderName}
                                onInput=${e => setNewFolderName(e.target.value)}
                                onKeyDown=${(e) => { if(e.key === 'Enter') handleSaveNewFolder(); }}
                                autoFocus
                            />
                            <button class="save-folder-btn" title="Save" onClick=${handleSaveNewFolder}>✓</button>
                            <button class="cancel-folder-btn" title="Cancel" onClick=${() => setIsAddingFolder(false)}>×</button>
                        </div>
                    `
                    : html`
                        <button class="add-folder-btn" onClick=${() => setIsAddingFolder(true)}>${T.addFolder}</button>
                    `
                }
            </div>
            <ul class="folder-list">
              <li onClick=${() => setSelectedFolderId('all')} class=${`folder-item ${selectedFolderId === 'all' ? 'active' : ''}`}>
                <span class="folder-name">${T.allResumes}</span><span class="folder-count">${resumes.length}</span>
              </li>
               <li onClick=${() => setSelectedFolderId('favorites')} class=${`folder-item ${selectedFolderId === 'favorites' ? 'active' : ''}`}>
                <span class="folder-name">${T.favorites}</span><span class="folder-count">${folderCounts.favorites}</span>
              </li>
              <li onClick=${() => setSelectedFolderId('unassigned')} class=${`folder-item ${selectedFolderId === 'unassigned' ? 'active' : ''}`}>
                <span class="folder-name">${T.unassigned}</span><span class="folder-count">${folderCounts.unassigned}</span>
              </li>
              ${folders.map(folder => html`
                <li key=${folder.id} onClick=${() => setSelectedFolderId(folder.id)} class=${`folder-item ${selectedFolderId === folder.id ? 'active' : ''}`}>
                  <span class="folder-name">${folder.name}</span>
                  <span class="folder-count">${folderCounts[folder.id] || 0}</span>
                  <button class="delete-folder-btn" title=${`Delete ${folder.name}`} onClick=${(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}>×</button>
                </li>
              `)}
            </ul>
        </div>
        
        <div class="results-container">
            ${resumes.length > 0 || isLoading ? html`
              <div class="results-header">
                  <h2>${T.resultsHeader(filteredAndSortedResumes.length)}</h2>
                  <div class="results-header-actions">
                    <div class="select-all-control">
                        <input type="checkbox" id="select-all" checked=${allVisibleSelected} onChange=${handleSelectAll} disabled=${filteredAndSortedResumes.length === 0} />
                        <label for="select-all">${T.selectAll}</label>
                    </div>
                    <div class="sort-controls">
                      <label for="sort-by">${T.sortBy}</label>
                      <select id="sort-by" value=${sortConfig.key} onChange=${handleSortChange}>
                        <option value="name">${T.sortName}</option>
                        ${Object.keys(tempScores).length > 0 && html`<option value="matchScore">${T.sortMatchScore}</option>`}
                        <option value="is_favorited">${T.sortFavorites}</option>
                        <option value="age">${T.sortAge}</option><option value="governorate">${T.sortGovernorate}</option>
                        <option value="skills">${T.sortSkills}</option>
                      </select>
                    </div>
                  </div>
              </div>

              <div class="filter-controls">
                <div class="job-filter-group">
                  <input type="text" placeholder=${T.filterJobPlaceholder} value=${filters.job} onInput=${e => setFilters(f => ({ ...f, job: e.target.value }))} />
                  <label class="exact-match-label">
                    <input type="checkbox" checked=${jobFilterExactMatch} onChange=${e => setJobFilterExactMatch(e.target.checked)} />
                    ${T.exactMatch}
                  </label>
                </div>
                <input class="filter-group" type="text" placeholder=${T.filterGovernoratePlaceholder} value=${filters.governorate} onInput=${e => setFilters(f => ({ ...f, governorate: e.target.value }))} />
                <input class="filter-group" type="text" placeholder=${T.filterAgePlaceholder} value=${filters.age} onInput=${e => setFilters(f => ({ ...f, age: e.target.value }))} />
                <input class="filter-group" type="text" placeholder=${T.filterSkillsPlaceholder} value=${filters.skills} onInput=${e => setFilters(f => ({ ...f, skills: e.target.value }))} />
              </div>

              <div class="resume-list">
                ${filteredAndSortedResumes.map(resume => {
                  const cardAction = cardActionStates[resume.id];
                  const isExpanded = expandedCards.has(resume.id);
                  const isSelected = selectedResumeIds.has(resume.id);
                  const scoreData = tempScores[resume.id];
                  const commentCount = (commentsByResumeId[resume.id] || []).length;
                  const getScoreClass = (score) => {
                    if (score > 75) return 'high';
                    if (score > 40) return 'medium';
                    return 'low';
                  };
                  return html`
                  <div class=${`resume-card ${isSelected ? 'selected' : ''}`} key=${resume.id}>
                    <div class="card-header">
                      ${scoreData && html`
                        <div class="match-score-wrapper" title=${scoreData.reason}>
                          <div class=${`match-score-badge ${getScoreClass(scoreData.score)}`}>${scoreData.score}</div>
                        </div>
                      `}
                      <div class="card-actions">
                        ${resume.fileURL && html`<a href=${resume.fileURL} target="_blank" class="view-cv-btn">${T.viewCV}</a>`}
                         <button onClick=${() => { setCurrentResumeForComments(resume); setIsCommentModalOpen(true); }} class="icon-btn comment-btn" title=${T.comments} disabled=${!!cardAction}>
                          ${cardAction === 'commenting' ? html`<div class="loader card-loader"></div>` : html`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.158 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l3.662-3.978c.26-.28.687-.634 1.153-.67 1.09-.086 2.17-.206 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.344 48.344 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>`}
                          ${commentCount > 0 && html`<span class="comment-count-badge">${commentCount}</span>`}
                        </button>
                        <button onClick=${() => handleToggleFavorite(resume)} class=${`icon-btn favorite-btn ${resume.is_favorited ? 'favorited' : ''}`} title=${resume.is_favorited ? T.unfavorite : T.favorite} disabled=${!!cardAction}>
                            ${cardAction === 'favoriting' ? html`<div class="loader card-loader"></div>` : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`}
                        </button>
                        <div class="move-cv-wrapper" ref=${movingResumeId === resume.id ? moveDropdownRef : null}>
                            <button onClick=${() => setMovingResumeId(resume.id === movingResumeId ? null : resume.id)} class="icon-btn move-cv-btn" title=${T.moveCV} disabled=${!!cardAction}>${cardAction === 'moving' ? html`<div class="loader card-loader"></div>` : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/></svg>`}</button>
                            ${movingResumeId === resume.id && html`<div class="move-dropdown"><ul class="move-dropdown-list"><li class=${`move-dropdown-item ${!resume.folderId ? 'disabled' : ''}`} onClick=${() => handleMoveResume(resume.id, null)}>${T.unassigned}</li>${folders.length > 0 ? folders.map(folder => html`<li class=${`move-dropdown-item ${resume.folderId === folder.id ? 'disabled' : ''}`} onClick=${() => handleMoveResume(resume.id, folder.id)}>${folder.name}</li>`) : html`<li class="move-dropdown-item disabled">${T.noFolders}</li>`}</ul></div>`}
                        </div>
                        <button onClick=${() => handleDownloadResume(resume)} class="icon-btn download-cv-btn" title=${T.downloadCV} disabled=${!!cardAction}>${cardAction === 'downloading' ? html`<div class="loader card-loader"></div>` : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`}</button>
                        <button onClick=${() => setConfirmModal({
                            isOpen: true,
                            title: T.deleteConfirmTitle,
                            message: T.deleteConfirm(resume.name),
                            onConfirm: () => handleDeleteResume(resume)
                        })} class="icon-btn delete-btn" title="Delete CV" disabled=${!!cardAction}>${cardAction === 'deleting' ? html`<div class="loader card-loader"></div>` : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`}</button>
                      </div>
                      <div class="card-title-area">
                        <label class="custom-checkbox-container">
                          <input type="checkbox" class="resume-select-checkbox" checked=${isSelected} onChange=${() => handleResumeSelection(resume.id)} />
                          <span class="checkmark"></span>
                        </label>
                        <h4>${resume.name || T.unspecified}</h4>
                      </div>
                    </div>
                    <div class="card-body">
                      <p><strong>${T.age}:</strong> ${resume.age || T.unspecified}</p>
                      <p><strong>${T.governorate}:</strong> ${resume.governorate || T.unspecified}</p>
                      <p><strong>${T.appliedFor}:</strong> ${resume.appliedFor || T.unspecified}</p>
                      
                      ${isExpanded && html`
                        <div class="card-expanded-details">
                          <p><strong>${T.aiSummary}:</strong> ${resume.aiSummary || T.unspecified}</p>
                          ${(() => {
                            const renderSkills = Array.isArray(resume.skills) ? resume.skills : (typeof resume.skills === 'string' ? resume.skills.split(',') : []);
                            return renderSkills.length > 0 ? html`<div class="skills-container" style=${{marginTop:'1rem'}}><ul class="skills-list">${renderSkills.map(skill => html`<li class="skill-tag">${skill}</li>`)}</ul></div>` : '';
                          })()}
                        </div>
                      `}
                    </div>
                    <div class="card-footer">
                        <button class="see-more-btn" onClick=${() => toggleCardExpansion(resume.id)}>
                            ${isExpanded ? T.seeLess : T.seeMore}
                        </button>
                    </div>
                  </div>
                `})}
              </div>
            ` : html`<div class="placeholder"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg><p>${selectedFolderId === 'all' ? T.placeholderText : T.placeholderFolderText}</p></div>`}
        </div>
        
        <div class="status-message">
            ${!isLoading && statusMessage}
        </div>
        ${error && html`<div class="error-message">${error.split('\n').map(line => html`<p>${line}</p>`)}</div>`}

      </main>
      <footer class="app-footer">
          <p>${T.footerText}</p>
      </footer>
      ${isReportModalOpen && html`<${ReportModal} content=${reportContent} T=${T} onClose=${() => setIsReportModalOpen(false)} />`}
      ${confirmModal.isOpen && html`<${ConfirmModal} title=${confirmModal.title} message=${confirmModal.message} T=${T} onConfirm=${confirmModal.onConfirm} onCancel=${() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })} />`}
      ${isCommentModalOpen && html`<${CommentModal} 
          resume=${currentResumeForComments} 
          comments=${commentsByResumeId[currentResumeForComments?.id] || []}
          session=${session}
          T=${T}
          onClose=${() => setIsCommentModalOpen(false)}
          onCommentAdd=${handleAddComment}
          onCommentDelete=${handleDeleteComment}
       />`}
    </${Fragment}>
  `;
}

export default function CVBankPage({ session, profile }) {
    const { language, theme, toggleTheme } = useSettings();
    const T = useMemo(() => translations[language] || translations['en'], [language]);
    const [hasAccess, setHasAccess] = useState(false);
    const [loadingAccess, setLoadingAccess] = useState(true);

    useEffect(() => {
        if (!session || profile?.role !== 'hr') {
            setLoadingAccess(false);
            return;
        }
        
        const checkAccess = async () => {
            try {
                let userToCheck = session.user.id;
                
                // If the user is a recruiter, they operate under the company admin's subscription.
                if (profile.hr_role === 'recruiter' && profile.company_id) {
                    const { data: comp } = await supabase.from('companies').select('admin_id').eq('id', profile.company_id).maybeSingle();
                    if (comp?.admin_id) userToCheck = comp.admin_id;
                }

                console.log("CVBank Access Check - userToCheck:", userToCheck);
                // Use supabaseAdmin to bypass RLS, allowing recruiters to read their admin's subscription.
                const { data, error: subError } = await supabaseAdmin.from('subscriptions').select('plan, status').eq('user_id', userToCheck).eq('status', 'active').maybeSingle();
                
                console.log("CVBank Access Check - Subscription Data:", data, "Error:", subError, "Role:", profile.hr_role);
                
                if (data && (data.plan === 'pro' || data.plan === 'premium' || data.plan === 'price_pro' || data.plan === 'price_enterprise')) {
                    console.log("CVBank Access Check - Access Granted! (plan match)");
                    setHasAccess(true);
                } else {
                    console.log("CVBank Access Check - Access Denied! Plan doesn't match Premium/Pro.");
                }
            } catch (err) {
                console.error("Error verifying access:", err);
            } finally {
                setLoadingAccess(false);
            }
        };

        checkAccess();
    }, [session, profile]);

    if (loadingAccess) {
        return html`
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        `;
    }

    if (!session || profile?.role !== 'hr') {
        return html`
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unauthorized Access</h2>
                    <p className="text-gray-500 dark:text-gray-400">This feature is strictly available for HR accounts.</p>
                </div>
            </div>
        `;
    }

    if (!hasAccess) {
        return html`
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-gray-100 dark:border-slate-800">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600 dark:text-indigo-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Premium Feature</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        The AI-Powered CV Bank is exclusively available on <strong className="text-gray-900 dark:text-gray-200">Pro</strong> and <strong className="text-gray-900 dark:text-gray-200">Enterprise</strong> plans. Upgrade now to unlock automated candidate analysis and match scoring.
                    </p>
                    <a href="/pricing" className="inline-flex w-full justify-center items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors">
                        Upgrade Subscription
                    </a>
                </div>
            </div>
        `;
    }

    return html`
      <div className=${`cv-bank-wrapper ${theme === 'dark' ? 'dark' : ''}`}>
        <${CVBankApp} supabaseClient=${supabase} session=${session} T=${T} onLangChange=${() => {}} theme=${theme} onThemeChange=${toggleTheme} />
      </div>
    `;
}
