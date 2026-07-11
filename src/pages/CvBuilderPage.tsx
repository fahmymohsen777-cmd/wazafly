import React from 'react';
import './CvBuilderPage.css';


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix: Declare html2pdf to resolve 'Cannot find name' error.
declare var html2pdf: any;
declare var pdfjsLib: any;

// Polyfill for structuredClone
if (!window.structuredClone) {
  window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

const translations = {
  en: {
    headerTitle: 'ATS-Friendly CV Builder',
    downloadPdf: 'Download PDF',
    guide: 'Guide',
    cvStrengthTest: 'CV Strength Test',
    switchLang: 'العربية',
    importFromPdf: 'Import from PDF',
    importing: 'Importing...',
    importConfirm: 'This will replace all current data in the form. Are you sure you want to continue?',
    importSuccess: 'CV data imported successfully!',
    importError: 'Failed to import CV. Please try another file or enter the data manually.',
    parsingPdf: 'Parsing your PDF...',
    analyzingCvContent: 'Analyzing CV content with AI...',
    layoutOptions: 'Layout Options',
    pageLayout: 'Page Layout',
    onePage: 'One Page',
    twoPages: 'Two Pages',
    autoMultiPage: 'Auto (Multi-page)',
    fontSize: 'Font Size',
    sectionVisibility: 'CV Sections (Show/Hide)',
    sectionOrder: 'Drag to reorder sections',
    moveUp: '↑',
    moveDown: '↓',
    personalInfo: 'Personal Information',
    fullName: 'Full Name',
    jobTitle: 'Job Title / Headline',
    email: 'Email',
    phone: 'Phone',
    linkedin: 'LinkedIn Profile',
    address: 'Address',
    links: 'Links',
    displayText: 'Display Text',
    url: 'URL',
    addLink: 'Add Link',
    professionalSummary: 'Professional Summary',
    summary: 'Summary',
    workExperience: 'Work Experience',
    position: 'Position Title',
    company: 'Company',
    location: 'Location',
    from: 'From',
    to: 'To',
    description: 'Description',
    remove: 'Remove',
    addExperience: 'Add Experience',
    education: 'Education',
    degree: 'Degree',
    university: 'University / Institution',
    graduationYear: 'Graduation Year',
    addEducation: 'Add Education',
    skills: 'Skills',
    skill: 'Skill',
    addSkill: 'Add Skill',
    certifications: 'Certifications',
    certification: 'Certification',
    addCertification: 'Add Certification',
    preview_summary_placeholder: 'Write your professional summary here...',
    preview_job_title: 'Job Title',
    preview_from: 'From',
    preview_to: 'To',
    preview_company: 'Company',
    preview_location: 'Location',
    preview_degree: 'Degree',
    preview_graduated: 'Graduated',
    preview_year: 'Year',
    preview_university: 'University',
    preview_skill: 'Skill',
    preview_certification: 'Certification',
    guideTitle: 'Guide: How to Create an ATS-Friendly CV',
    guideIntro: 'Here are key tips from best practices to create a standout, ATS-friendly CV:',
    guideStructureTitle: '1. CV Structure & Content',
    guideStructure: [
      'Header: Include your name, phone number, professional email, and LinkedIn profile.',
      'Summary: A 2-3 line "elevator pitch" summarizing your skills and career goals.',
      'Skills: Group similar tools and technologies (e.g., "Programming: SQL, Python").',
      'Experience: Use past tense verbs. Focus on your accomplishments, tools used, and quantifiable impact (e.g., "Increased sales by 20%").',
      'Projects: Showcase 2 impactful academic or personal projects. Quantify results where possible.',
      'Education: List your highest degree. Include your GPA if it\'s above average.'
    ],
    guideAtsTitle: '2. ATS-Friendly Tips',
    guideAts: [
      'No Tables/Columns/Images: ATS systems can struggle to parse these elements. A single-column layout is safest.',
      'Simple Fonts & Clear Headings: Use standard fonts and clear section titles (e.g., "Work Experience").',
      'Use Keywords: Include keywords from the job description throughout your CV.',
      'Quantify Achievements: Use numbers and metrics to highlight your impact (e.g., "Managed a $50,000 budget").',
      'Save as PDF: This preserves formatting. Our tool does this for you!',
      'Keep it Concise: Aim for one page if you have less than 10 years of experience.'
    ],
    createdBy: 'Created by Fahmy mohsen',
    enterJobTitle: 'Enter the job title you are applying for:',
    analyzeCv: 'Analyze CV',
    analysisResults: 'Analysis Results',
    yourCvScore: 'Your CV Score',
    suggestionsForImprovement: 'Suggestions for Improvement',
    analyzing: 'Analyzing your CV...',
    errorEnterJobTitle: 'Please enter a job title.',
    errorAnalysisFailed: 'Failed to analyze the CV. Please try again.',
  },
  ar: {
    headerTitle: 'منشئ السيرة الذاتية',
    downloadPdf: 'تحميل PDF',
    guide: 'دليل',
    cvStrengthTest: 'اختبار قوة السيرة الذاتية',
    switchLang: 'English',
    importFromPdf: 'استيراد من PDF',
    importing: 'جاري الاستيراد...',
    importConfirm: 'سيؤدي هذا إلى استبدال جميع البيانات الحالية في النموذج. هل أنت متأكد من أنك تريد المتابعة؟',
    importSuccess: 'تم استيراد بيانات السيرة الذاتية بنجاح!',
    importError: 'فشل استيراد السيرة الذاتية. يرجى تجربة ملف آخر أو إدخال البيانات يدويًا.',
    parsingPdf: 'جاري تحليل ملف PDF الخاص بك...',
    analyzingCvContent: 'جاري تحليل محتوى السيرة الذاتية بالذكاء الاصطناعي...',
    layoutOptions: 'خيارات التنسيق',
    pageLayout: 'تنسيق الصفحة',
    onePage: 'صفحة واحدة',
    twoPages: 'صفحتان',
    autoMultiPage: 'تلقائي (متعدد الصفحات)',
    fontSize: 'حجم الخط',
    sectionVisibility: 'أقسام السيرة الذاتية (إظهار/إخفاء)',
    sectionOrder: 'اسحب لإعادة الترتيب',
    moveUp: '↑',
    moveDown: '↓',
    personalInfo: 'المعلومات الشخصية',
    fullName: 'الاسم الكامل',
    jobTitle: 'المسمى الوظيفي/العنوان',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    linkedin: 'رابط لينكدإن',
    address: 'العنوان',
    links: 'روابط',
    displayText: 'نص العرض',
    url: 'الرابط',
    addLink: 'إضافة رابط',
    professionalSummary: 'الملخص الاحترافي',
    summary: 'الملخص',
    workExperience: 'الخبرة العملية',
    position: 'المسمى الوظيفي',
    company: 'الشركة',
    location: 'الموقع',
    from: 'من',
    to: 'إلى',
    description: 'الوصف',
    remove: 'إزالة',
    addExperience: 'إضافة خبرة',
    education: 'التعليم',
    degree: 'الشهادة',
    university: 'الجامعة/المؤسسة',
    graduationYear: 'سنة التخرج',
    addEducation: 'إضافة تعليم',
    skills: 'المهارات',
    skill: 'مهارة',
    addSkill: 'إضافة مهارة',
    certifications: 'الشهادات',
    certification: 'شهادة',
    addCertification: 'إضافة شهادة',
    preview_summary_placeholder: 'اكتب ملخصك الاحترافي هنا...',
    preview_job_title: 'المسمى الوظيفي',
    preview_from: 'من',
    preview_to: 'إلى',
    preview_company: 'الشركة',
    preview_location: 'الموقع',
    preview_degree: 'الشهادة',
    preview_graduated: 'تخرج',
    preview_year: 'السنة',
    preview_university: 'الجامعة',
    preview_skill: 'مهارة',
    preview_certification: 'شهادة',
    guideTitle: 'دليل: كيفية إنشاء سيرة ذاتية متوافقة مع ATS',
    guideIntro: 'إليك أهم النصائح من أفضل الممارسات لإنشاء سيرة ذاتية مميزة ومتوافقة مع أنظمة تتبع المتقدمين (ATS):',
    guideStructureTitle: '١. هيكل ومحتوى السيرة الذاتية',
    guideStructure: [
        'المقدمة (Header): يجب أن تحتوي على اسمك، رقم هاتفك، بريدك الإلكتروني الاحترافي، ورابط ملفك على لينكدإن.',
        'الملخص: "نبذة تعريفية" من سطرين إلى ثلاثة تلخص مهاراتك وأهدافك المهنية.',
        'المهارات: قسّم الأدوات والتقنيات المتشابهة في مجموعات (مثال: "البرمجة: SQL, Python").',
        'الخبرة: استخدم أفعالاً في صيغة الماضي. ركز على إنجازاتك، الأدوات التي استخدمتها، والنتائج القابلة للقياس (مثال: "زيادة المبيعات بنسبة 20%").',
        'المشاريع: اعرض مشروعين مؤثرين، سواء كانت أكاديمية أو شخصية. حدد النتائج بالأرقام إن أمكن.',
        'التعليم: اذكر أعلى شهادة علمية حصلت عليها. أضف المعدل التراكمي إذا كان مرتفعًا.'
    ],
    guideAtsTitle: '٢. نصائح للتوافق مع أنظمة ATS',
    guideAts: [
        'تجنب الجداول/الأعمدة/الصور: قد تواجه أنظمة ATS صعوبة في قراءة هذه العناصر. التصميم ذو العمود الواحد هو الأكثر أمانًا.',
        'خطوط بسيطة وعناوين واضحة: استخدم خطوطًا قياسية وعناوين أقسام واضحة (مثل: "الخبرة العملية").',
        'استخدم الكلمات المفتاحية: قم بتضمين الكلمات المفتاحية من الوصف الوظيفي في سيرتك الذاتية.',
        'حدد إنجازاتك بالأرقام: استخدم الأرقام والمقاييس لتسليط الضوء على تأثيرك (مثال: "إدارة ميزانية بقيمة 50,000 دولار").',
        'احفظ الملف بصيغة PDF: هذا يحافظ على التنسيق. أداتنا تقوم بذلك من أجلك!',
        'اجعلها موجزة: استهدف صفحة واحدة إذا كانت لديك خبرة أقل من 10 سنوات.'
    ],
    createdBy: 'صنع بواسطة فهمي محسن',
    enterJobTitle: 'أدخل المسمى الوظيفي الذي تتقدم إليه:',
    analyzeCv: 'تحليل السيرة الذاتية',
    analysisResults: 'نتائج التحليل',
    yourCvScore: 'درجة سيرتك الذاتية',
    suggestionsForImprovement: 'اقتراحات للتحسين',
    analyzing: 'جاري تحليل سيرتك الذاتية...',
    errorEnterJobTitle: 'الرجاء إدخال مسمى وظيفي.',
    errorAnalysisFailed: 'فشل تحليل السيرة الذاتية. يرجى المحاولة مرة أخرى.',
  }
};

const initialCvData = {
  name: 'Michael Harris',
  jobTitle: 'Digital Marketing | SEO | SEM | Content Marketing',
  email: 'michael.harris@email.com',
  phone: '+61 412 345 678',
  links: [
    { id: 1, text: 'LinkedIn', url: 'https://linkedin.com/in/michaelharris' }
  ],
  address: 'Sydney, Australia',
  summary: 'Results-oriented marketing professional with over 5 years of experience in digital marketing, brand strategy, and content creation. Proven ability to drive brand growth, increase online engagement, and deliver data-driven results. Expert in utilizing digital tools and analytics to optimize marketing campaigns and achieve business objectives.',
  experience: [
    { id: 1, title: 'Marketing Manager', company: 'XYZ Corporation', location: 'Sydney, NSW', from: 'January 2022', to: 'Present', description: '• Lead a team of 5 in creating and executing digital marketing strategies across multiple platforms, including social media, SEO, and email campaigns.\n• Achieved a 35% increase in website traffic and 50% boost in social media engagement within the first year.\n• Managed a marketing budget of $200,000, ensuring maximum ROI through cost-effective advertising strategies.' },
    { id: 2, title: 'Digital Marketing Specialist', company: 'ABC Solutions', location: 'Melbourne, VIC', from: 'June 2018', to: 'December 2021', description: '• Developed and executed SEO and SEM strategies that increased organic search traffic by 25%.\n• Created and managed Google Ads and Facebook Ads campaigns, resulting in a 20% increase in qualified leads.\n• Produced engaging content for blogs, newsletters, and social media platforms to attract target audiences.' },
  ],
  education: [
    { id: 1, degree: 'Bachelor of Marketing', university: 'University of Sydney', location: 'Sydney, NSW', year: '2018' }
  ],
  skills: [
    { id: 1, text: 'Digital Marketing Strategy, SEO & SEM, Google Analytics & SEMrush' },
    { id: 2, text: 'Social Media Marketing, Content Creation & Copywriting, Budget Management, Data Analysis' },
  ],
  certifications: [
    { id: 1, text: 'Google Analytics Certified' },
    { id: 2, text: 'Facebook Blueprint Certification' },
    { id: 3, text: 'HubSpot Inbound Marketing Certification' },
  ],
};

const CV_DATA_STORAGE_KEY = 'cv-builder-data';
const SETTINGS_STORAGE_KEY = 'cv-builder-settings';

const loadCvDataFromStorage = () => {
  try {
    const savedData = localStorage.getItem(CV_DATA_STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Migration for old data structure with linkedin property
      if (parsedData.linkedin && !Array.isArray(parsedData.links)) {
        let url = parsedData.linkedin;
        if (url && !url.startsWith('http')) {
            url = `https://${url}`;
        }
        parsedData.links = [{ id: 1, text: 'LinkedIn', url: url }];
        delete parsedData.linkedin;
      }
      // Ensure links is always an array
      if (!Array.isArray(parsedData.links)) {
          parsedData.links = [];
      }
      return parsedData;
    }
  } catch (error) {
    console.error("Failed to load or parse CV data from localStorage", error);
  }
  return structuredClone(initialCvData);
};


const DEFAULT_SECTIONS = [
  { key: 'summary', labelEn: 'Professional Summary', labelAr: 'الملخص الاحترافي', visible: true },
  { key: 'experience', labelEn: 'Work Experience', labelAr: 'الخبرة العملية', visible: true },
  { key: 'education', labelEn: 'Education', labelAr: 'التعليم', visible: true },
  { key: 'skills', labelEn: 'Skills', labelAr: 'المهارات', visible: true },
  { key: 'certifications', labelEn: 'Certifications', labelAr: 'الشهادات', visible: true },
];

const loadSettingsFromStorage = () => {
  try {
    const savedData = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      // Ensure sections exist with defaults
      if (!parsed.sections) {
        parsed.sections = structuredClone(DEFAULT_SECTIONS);
      }
      return parsed;
    }
  } catch (error) {
    console.error("Failed to load or parse settings from localStorage", error);
  }
  return { pageLayout: 'auto', fontSize: 11, sections: structuredClone(DEFAULT_SECTIONS) };
};


const App = () => {
  const [cvData, setCvData] = React.useState(loadCvDataFromStorage);
  const [settings, setSettings] = React.useState(loadSettingsFromStorage);
  const { pageLayout, fontSize, sections } = settings;
  const [language, setLanguage] = React.useState('en');
  const [isGuideVisible, setGuideVisible] = React.useState(false);
  const [isTesterVisible, setTesterVisible] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState('');
  const [dragOverKey, setDragOverKey] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const t = translations[language];

  const toggleSectionVisibility = (key) => {
    setSettings(s => ({
      ...s,
      sections: s.sections.map(sec => sec.key === key ? { ...sec, visible: !sec.visible } : sec)
    }));
  };

  const moveSectionUp = (index) => {
    if (index === 0) return;
    setSettings(s => {
      const newSections = [...s.sections];
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
      return { ...s, sections: newSections };
    });
  };

  const moveSectionDown = (index) => {
    setSettings(s => {
      if (index === s.sections.length - 1) return s;
      const newSections = [...s.sections];
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
      return { ...s, sections: newSections };
    });
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', index);
  };

  const handleDrop = (e, targetIndex) => {
    const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
    if (dragIndex === targetIndex) return;
    setSettings(s => {
      const newSections = [...s.sections];
      const [removed] = newSections.splice(dragIndex, 1);
      newSections.splice(targetIndex, 0, removed);
      return { ...s, sections: newSections };
    });
    setDragOverKey(null);
  };

  React.useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  React.useEffect(() => {
    try {
      localStorage.setItem(CV_DATA_STORAGE_KEY, JSON.stringify(cvData));
    } catch (error) {
      console.error("Failed to save CV data to localStorage", error);
    }
  }, [cvData]);

  React.useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);
  
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCvData(prev => ({ ...prev, [name]: value }));
  };

  const handleDynamicChange = (section, id, e) => {
    const { name, value } = e.target;
    setCvData(prev => {
      const newSection = prev[section].map(item =>
        item.id === id ? { ...item, [name]: value } : item
      );
      return { ...prev, [section]: newSection };
    });
  };

  const addDynamicItem = (section) => {
    setCvData(prev => {
      const newId = prev[section].length > 0 ? Math.max(...prev[section].map(i => i.id)) + 1 : 1;
      let newItem;
      switch (section) {
        case 'experience':
          newItem = { id: newId, title: '', company: '', location: '', from: '', to: '', description: '' };
          break;
        case 'education':
          newItem = { id: newId, degree: '', university: '', location: '', year: '' };
          break;
        case 'skills':
          newItem = { id: newId, text: '' };
          break;
        case 'certifications':
          newItem = { id: newId, text: '' };
          break;
        case 'links':
          newItem = { id: newId, text: '', url: '' };
          break;
        default: return prev;
      }
      return { ...prev, [section]: [...prev[section], newItem] };
    });
  };

  const removeDynamicItem = (section, id) => {
    setCvData(prev => ({
      ...prev,
      [section]: prev[section].filter(item => item.id !== id)
    }));
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('cv-preview');
    const opt = {
      margin: 0,
      filename: `${cvData.name.replace(' ', '_')}_CV.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
  };

  const handlePdfImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm(t.importConfirm)) {
        event.target.value = null;
        return;
    }

    setImportStatus(t.parsingPdf);
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.js`;

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = async (e) => {
            try {
                const pdf = await pdfjsLib.getDocument(e.target.result).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                }

                setImportStatus(t.analyzingCvContent);

                const prompt = `You are an expert CV and resume parser. Analyze the following text extracted from a CV PDF and convert it into a structured JSON object. Extract all relevant information accurately. If a section is not present, return an empty string or empty array for it. Return ONLY raw JSON, no markdown blocks. CV Text:\n\n${fullText}`;

                const responseFetch = await fetch('/api/ai/proxy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: prompt })
                });

                if (!responseFetch.ok) throw new Error('AI analysis failed');
                
                const responseData = await responseFetch.json();
                const response = { text: responseData.text };

                let jsonText = response.text.trim();
                if (jsonText.startsWith("```json")) {
                    jsonText = jsonText.substring(7, jsonText.length - 3).trim();
                }

                const parsedData = JSON.parse(jsonText);
                const processedData = {
                    ...structuredClone(initialCvData), ...parsedData,
                    experience: (parsedData.experience || []).map((item, index) => ({ ...item, id: index + 1 })),
                    education: (parsedData.education || []).map((item, index) => ({ ...item, id: index + 1 })),
                    skills: (parsedData.skills || []).map((item, index) => ({ ...item, id: index + 1 })),
                    certifications: (parsedData.certifications || []).map((item, index) => ({ ...item, id: index + 1 })),
                    links: (parsedData.links || []).map((item, index) => ({ ...item, id: index + 1 })),
                };
                setCvData(processedData);
                setImportStatus(t.importSuccess);
                setTimeout(() => setImportStatus(''), 3000);
            } catch (err) {
                console.error("Error during PDF processing or AI analysis:", err);
                setImportStatus(t.importError);
                setTimeout(() => setImportStatus(''), 5000);
            } finally {
                 event.target.value = null;
            }
        };
        reader.onerror = () => { throw new Error("FileReader error"); };
    } catch (err) {
        console.error("Error setting up PDF import:", err);
        setImportStatus(t.importError);
        setTimeout(() => setImportStatus(''), 5000);
        event.target.value = null;
    }
  };

  return (
    <React.Fragment>
      <GuideModal isVisible={isGuideVisible} onClose={() => setGuideVisible(false)} t={t} />
      <CVStrengthTesterModal isVisible={isTesterVisible} onClose={() => setTesterVisible(false)} t={t} cvData={cvData} />
      <ImportStatusModal status={importStatus} />
      <header>
        <h1>{t.headerTitle}</h1>
        <div className="header-controls">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handlePdfImport}
                accept="application/pdf"
                style={{ display: 'none' }}
                aria-hidden="true"
            />
            <button className="import-btn" onClick={() => fileInputRef.current.click()} disabled={!!importStatus}>
                {importStatus ? t.importing : t.importFromPdf}
            </button>
            <button className="header-btn" onClick={() => setGuideVisible(true)}>{t.guide}</button>
            <button className="header-btn" onClick={() => setTesterVisible(true)}>{t.cvStrengthTest}</button>
            <button className="header-btn" onClick={toggleLanguage}>{t.switchLang}</button>
            <button className="download-btn" onClick={handleDownloadPdf}>{t.downloadPdf}</button>
        </div>
      </header>
      <div className="main-container">
        <div className="cv-form">
          <FormSection title={t.layoutOptions}>
            <div className="layout-controls">
              <div className="input-group">
                <label>{t.pageLayout}</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="pageLayout"
                      value="auto"
                      checked={pageLayout === 'auto'}
                      onChange={e => setSettings(s => ({ ...s, pageLayout: e.target.value }))}
                    />
                    {t.autoMultiPage}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pageLayout"
                      value="one-page"
                      checked={pageLayout === 'one-page'}
                      onChange={e => setSettings(s => ({ ...s, pageLayout: e.target.value }))}
                    />
                    {t.onePage}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="pageLayout"
                      value="two-pages"
                      checked={pageLayout === 'two-pages'}
                      onChange={e => setSettings(s => ({ ...s, pageLayout: e.target.value }))}
                    />
                    {t.twoPages}
                  </label>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="font-size-slider">{t.fontSize}: {fontSize}pt</label>
                <input
                  id="font-size-slider"
                  type="range"
                  min="8"
                  max="14"
                  step="0.5"
                  value={fontSize}
                  disabled={pageLayout === 'auto'}
                  onChange={e => setSettings(s => ({ ...s, fontSize: parseFloat(e.target.value) }))}
                />
              </div>
            </div>

            {/* Section Visibility & Order */}
            <div className="section-controls-wrapper">
              <label className="section-controls-label">{t.sectionVisibility}</label>
              <div className="section-controls-list">
                {(sections || DEFAULT_SECTIONS).map((sec, index) => (
                  <div
                    key={sec.key}
                    className={`section-control-item${dragOverKey === sec.key ? ' drag-over' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => { e.preventDefault(); setDragOverKey(sec.key); }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={e => handleDrop(e, index)}
                  >
                    <span className="drag-handle" title={t.sectionOrder}>⠿</span>
                    <label className="section-toggle">
                      <input
                        type="checkbox"
                        checked={sec.visible}
                        onChange={() => toggleSectionVisibility(sec.key)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`section-name${!sec.visible ? ' section-name-hidden' : ''}`}>
                      {language === 'ar' ? sec.labelAr : sec.labelEn}
                    </span>
                    <div className="order-btns">
                      <button className="order-btn" onClick={() => moveSectionUp(index)} disabled={index === 0} title="Move up">{t.moveUp}</button>
                      <button className="order-btn" onClick={() => moveSectionDown(index)} disabled={index === (sections || DEFAULT_SECTIONS).length - 1} title="Move down">{t.moveDown}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection title={t.personalInfo}>
            <InputField label={t.fullName} name="name" value={cvData.name} onChange={handleChange} />
            <InputField label={t.jobTitle} name="jobTitle" value={cvData.jobTitle} onChange={handleChange} />
            <InputField label={t.email} name="email" value={cvData.email} onChange={handleChange} type="email" />
            <InputField label={t.phone} name="phone" value={cvData.phone} onChange={handleChange} />
            <InputField label={t.address} name="address" value={cvData.address} onChange={handleChange} />
          </FormSection>

          <FormSection title={t.links}>
            {(cvData.links || []).map(link => (
              <div key={link.id} className="dynamic-item">
                <InputField label={t.displayText} name="text" value={link.text} onChange={(e) => handleDynamicChange('links', link.id, e)} />
                <InputField label={t.url} name="url" value={link.url} onChange={(e) => handleDynamicChange('links', link.id, e)} type="url" />
                <div className="dynamic-controls">
                    <button className="remove-btn" onClick={() => removeDynamicItem('links', link.id)}>{t.remove}</button>
                </div>
              </div>
            ))}
             <div className="dynamic-controls">
                <button className="add-btn" onClick={() => addDynamicItem('links')}>{t.addLink}</button>
            </div>
          </FormSection>
          
          <FormSection title={t.professionalSummary}>
             <TextAreaField label={t.summary} name="summary" value={cvData.summary} onChange={handleChange} />
          </FormSection>

          <FormSection title={t.workExperience}>
            {cvData.experience.map(exp => (
              <div key={exp.id} className="dynamic-item">
                <InputField label={t.position} name="title" value={exp.title} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <InputField label={t.company} name="company" value={exp.company} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <InputField label={t.location} name="location" value={exp.location} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <InputField label={t.from} name="from" value={exp.from} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <InputField label={t.to} name="to" value={exp.to} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <TextAreaField label={t.description} name="description" value={exp.description} onChange={(e) => handleDynamicChange('experience', exp.id, e)} />
                <div className="dynamic-controls">
                    <button className="remove-btn" onClick={() => removeDynamicItem('experience', exp.id)}>{t.remove}</button>
                </div>
              </div>
            ))}
             <div className="dynamic-controls">
                <button className="add-btn" onClick={() => addDynamicItem('experience')}>{t.addExperience}</button>
            </div>
          </FormSection>

          <FormSection title={t.education}>
            {cvData.education.map(edu => (
              <div key={edu.id} className="dynamic-item">
                <InputField label={t.degree} name="degree" value={edu.degree} onChange={(e) => handleDynamicChange('education', edu.id, e)} />
                <InputField label={t.university} name="university" value={edu.university} onChange={(e) => handleDynamicChange('education', edu.id, e)} />
                <InputField label={t.location} name="location" value={edu.location} onChange={(e) => handleDynamicChange('education', edu.id, e)} />
                <InputField label={t.graduationYear} name="year" value={edu.year} onChange={(e) => handleDynamicChange('education', edu.id, e)} />
                 <div className="dynamic-controls">
                    <button className="remove-btn" onClick={() => removeDynamicItem('education', edu.id)}>{t.remove}</button>
                </div>
              </div>
            ))}
             <div className="dynamic-controls">
                <button className="add-btn" onClick={() => addDynamicItem('education')}>{t.addEducation}</button>
            </div>
          </FormSection>
          
          <FormSection title={t.skills}>
            {cvData.skills.map(skill => (
                <div key={skill.id} className="dynamic-item">
                    <InputField label={t.skill} name="text" value={skill.text} onChange={(e) => handleDynamicChange('skills', skill.id, e)} />
                     <div className="dynamic-controls">
                        <button className="remove-btn" onClick={() => removeDynamicItem('skills', skill.id)}>{t.remove}</button>
                    </div>
                </div>
            ))}
            <div className="dynamic-controls">
                 <button className="add-btn" onClick={() => addDynamicItem('skills')}>{t.addSkill}</button>
            </div>
          </FormSection>

          <FormSection title={t.certifications}>
            {cvData.certifications.map(cert => (
                 <div key={cert.id} className="dynamic-item">
                    <InputField label={t.certification} name="text" value={cert.text} onChange={(e) => handleDynamicChange('certifications', cert.id, e)} />
                    <div className="dynamic-controls">
                        <button className="remove-btn" onClick={() => removeDynamicItem('certifications', cert.id)}>{t.remove}</button>
                    </div>
                 </div>
            ))}
             <div className="dynamic-controls">
                <button className="add-btn" onClick={() => addDynamicItem('certifications')}>{t.addCertification}</button>
            </div>
          </FormSection>

        </div>
        <div className="cv-preview-container">
          <div 
            id="cv-preview" 
            className={[
              language === 'ar' ? 'rtl-preview' : '',
              pageLayout === 'one-page' ? 'one-page-layout' : '',
              pageLayout === 'two-pages' ? 'two-pages-layout' : '',
            ].filter(Boolean).join(' ')}
            style={{ '--base-font-size': `${fontSize}pt` } as React.CSSProperties}
          >
            <div className="preview-header">
              <h1>{cvData.name || t.fullName}</h1>
              <p className="title">{cvData.jobTitle || t.jobTitle}</p>
              <p className="preview-contact">
                {cvData.address || t.address} | {cvData.email || t.email} | {cvData.phone || t.phone}
                {(cvData.links || []).filter(l => l.url).map(link => (
                    <React.Fragment key={link.id}>
                        {' | '}
                        <a href={!link.url.startsWith('http') ? `https://${link.url}` : link.url} target="_blank" rel="noopener noreferrer">
                            {link.text || link.url}
                        </a>
                    </React.Fragment>
                ))}
              </p>
            </div>

            {(sections || DEFAULT_SECTIONS).filter(sec => sec.visible).map(sec => {
              if (sec.key === 'summary') return (
                <div key="summary" className="preview-section">
                  <h2>{t.professionalSummary}</h2>
                  <div className="content">
                    <p>{cvData.summary || t.preview_summary_placeholder}</p>
                  </div>
                </div>
              );
              if (sec.key === 'experience') return (
                <div key="experience" className="preview-section">
                  <h2>{t.workExperience}</h2>
                  <div className="content">
                    {cvData.experience.map(exp => (
                      <div key={exp.id} className="experience-item">
                        <div className="item-header">
                          <span className="title">{exp.title || t.preview_job_title}</span>
                          <span className="date">{exp.from || t.preview_from} – {exp.to || t.preview_to}</span>
                        </div>
                        <div className="item-subheader">{exp.company || t.preview_company}, {exp.location || t.preview_location}</div>
                        <div className="item-description">
                          <ul>
                            {(exp.description || '').split('\n').filter(line => line.trim() !== '').map((line, i) => <li key={i}>{line.replace('•', '').trim()}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              if (sec.key === 'education') return (
                <div key="education" className="preview-section">
                  <h2>{t.education}</h2>
                  <div className="content">
                    {cvData.education.map(edu => (
                      <div key={edu.id} className="education-item">
                        <div className="item-header">
                          <span className="degree">{edu.degree || t.preview_degree}</span>
                          <span className="date">{t.preview_graduated}: {edu.year || t.preview_year}</span>
                        </div>
                        <div className="item-subheader">{edu.university || t.preview_university}, {edu.location || t.preview_location}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              if (sec.key === 'skills') return (
                <div key="skills" className="preview-section">
                  <h2>{t.skills}</h2>
                  <div className="content skills-list">
                    <ul>
                      {cvData.skills.map(skill => (
                        <li key={skill.id}>{skill.text || t.preview_skill}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
              if (sec.key === 'certifications') return (
                <div key="certifications" className="preview-section">
                  <h2>{t.certifications}</h2>
                  <div className="content certifications-list">
                    <ul>
                      {cvData.certifications.map(cert => (
                        <li key={cert.id}>{cert.text || t.preview_certification}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
              return null;
            })}

          </div>
        </div>
      </div>
      <footer>
        <p>{t.createdBy}</p>
      </footer>
    </React.Fragment>
  );
};


const FormSection = ({ title, children }) => (
  <div className="form-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const InputField = ({ label, ...props }) => (
  <div className="input-group">
    <label>{label}</label>
    <input {...props} />
  </div>
);

const TextAreaField = ({ label, ...props }) => (
  <div className="input-group">
    <label>{label}</label>
    <textarea {...props}></textarea>
  </div>
);

const GuideModal = ({ isVisible, onClose, t }) => {
  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <h3>{t.guideTitle}</h3>
        <p>{t.guideIntro}</p>
        
        <h4>{t.guideStructureTitle}</h4>
        <ul>
            {t.guideStructure.map((item, index) => <li key={index}>{item}</li>)}
        </ul>

        <h4>{t.guideAtsTitle}</h4>
        <ul>
            {t.guideAts.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
};

const CVStrengthTesterModal = ({ isVisible, onClose, t, cvData }) => {
  const [jobTitle, setJobTitle] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState(null);
  const [error, setError] = React.useState('');

  const handleAnalyze = async () => {
    if (!jobTitle.trim()) {
      setError(t.errorEnterJobTitle);
      return;
    }
    setError('');
    setIsLoading(true);
    setAnalysisResult(null);

    try {
      const prompt = `You are an expert ATS and career coach. Analyze the following CV against the job title "${jobTitle}". Provide a score from 0 to 100 and actionable suggestions for improvement. Return ONLY a JSON object with properties 'score' (integer) and 'suggestions' (array of strings), no markdown formatting. CV Text: ${cvText}`;

      const responseFetch = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: prompt })
      });
      
      if (!responseFetch.ok) throw new Error('AI analysis failed');
      
      const responseData = await responseFetch.json();
      let jsonText = responseData.text;
      if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');

      const jsonResponse = JSON.parse(jsonText);
      setAnalysisResult(jsonResponse);

    } catch (err) {
      console.error("Error analyzing CV:", err);
      setError(t.errorAnalysisFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setJobTitle('');
    setAnalysisResult(null);
    setError('');
    setIsLoading(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content tester-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>&times;</button>
        <h3>{t.cvStrengthTest}</h3>
        
        {!analysisResult && (
          <div className="tester-form">
            <div className="input-group">
                <label htmlFor="jobTitleInput">{t.enterJobTitle}</label>
                <input 
                    id="jobTitleInput"
                    type="text" 
                    value={jobTitle} 
                    onChange={(e) => setJobTitle(e.target.value)} 
                    placeholder="e.g., Senior Software Engineer"
                    disabled={isLoading}
                />
            </div>
            {error && <p className="tester-error">{error}</p>}
            <button className="analyze-btn" onClick={handleAnalyze} disabled={isLoading}>
              {isLoading ? t.analyzing : t.analyzeCv}
            </button>
          </div>
        )}

        {isLoading && <div className="loading-spinner"></div>}

        {analysisResult && (
          <div className="analysis-results">
            <h4>{t.analysisResults}</h4>
            <div className="results-grid">
                <div className="score-container">
                    <h5>{t.yourCvScore}</h5>
                    {/* Fix: Cast style object to React.CSSProperties to allow for custom properties like '--score'. */}
                    <div className="score-circle" style={{ '--score': analysisResult.score } as React.CSSProperties}>
                      <span className="score-text">{analysisResult.score}%</span>
                    </div>
                </div>
                <div className="suggestions-container">
                    <h5>{t.suggestionsForImprovement}</h5>
                    <ul className="suggestions-list">
                        {analysisResult.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            </div>
             <button className="analyze-btn" onClick={handleClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

const ImportStatusModal = ({ status }) => {
    if (!status) return null;

    const isProcessing = status.includes('...') || status.includes('جاري');

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-content">
                {isProcessing && <div className="loading-spinner"></div>}
                <p>{status}</p>
            </div>
        </div>
    );
};


export default App;