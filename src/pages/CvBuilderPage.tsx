import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from '@google/genai';
import { useSettings } from '../contexts/SettingsContext';

// Type declarations for CDN-loaded libraries
declare var html2pdf: any;
declare var pdfjsLib: any;

// ─── Types ────────────────────────────────────────────────────
interface ExpItem { id: number; title: string; company: string; location: string; from: string; to: string; description: string; }
interface EduItem { id: number; degree: string; university: string; location: string; year: string; }
interface SkillItem { id: number; text: string; }
interface LinkItem { id: number; text: string; url: string; }
interface CvData {
  name: string; jobTitle: string; email: string; phone: string; address: string; summary: string;
  links: LinkItem[]; experience: ExpItem[]; education: EduItem[];
  skills: SkillItem[]; certifications: SkillItem[];
}

// ─── Defaults ────────────────────────────────────────────────
const initialCv: CvData = {
  name: '', jobTitle: '', email: '', phone: '', address: '', summary: '',
  links: [], experience: [], education: [], skills: [], certifications: [],
};

const CV_KEY = 'wazafly_cv_builder_data';

function loadCv(): CvData {
  try {
    const raw = localStorage.getItem(CV_KEY);
    if (raw) return JSON.parse(raw) as CvData;
  } catch (_) {}
  return structuredClone(initialCv);
}

// ─── Main Component ──────────────────────────────────────────
export default function CvBuilderPage({ session, profile }: { session: any; profile: any }) {
  const navigate = useNavigate();
  const [cv, setCv] = useState<CvData>(loadCv);
  const [pageLayout, setPageLayout] = useState<'auto' | 'one-page'>('auto');
  const [fontSize, setFontSize] = useState(11);
  const { language: lang } = useSettings();
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session || profile?.role !== 'job_seeker') navigate('/dashboard');
  }, [session, profile]);

  useEffect(() => {
    try { localStorage.setItem(CV_KEY, JSON.stringify(cv)); } catch (_) {}
  }, [cv]);

  // ─── Field helpers ──────────────────────────────────────────
  const setField = (field: keyof CvData, value: any) => setCv(p => ({ ...p, [field]: value }));

  const updateItem = <T extends { id: number }>(
    section: keyof CvData, id: number, field: keyof T, value: any
  ) => setCv(p => ({
    ...p,
    [section]: (p[section] as T[]).map(item => item.id === id ? { ...item, [field]: value } : item),
  }));

  const addItem = (section: keyof CvData) => {
    const list = cv[section] as any[];
    const id = list.length > 0 ? Math.max(...list.map((i: any) => i.id)) + 1 : 1;
    let blank: any;
    if (section === 'experience') blank = { id, title: '', company: '', location: '', from: '', to: '', description: '' };
    else if (section === 'education') blank = { id, degree: '', university: '', location: '', year: '' };
    else if (section === 'links') blank = { id, text: '', url: '' };
    else blank = { id, text: '' };
    setCv(p => ({ ...p, [section]: [...(p[section] as any[]), blank] }));
  };

  const removeItem = (section: keyof CvData, id: number) =>
    setCv(p => ({ ...p, [section]: (p[section] as any[]).filter((i: any) => i.id !== id) }));

  // ─── PDF Download ────────────────────────────────────────────
  const handleDownload = () => {
    const el = previewRef.current;
    if (!el) return;
    html2pdf().from(el).set({
      margin: 0,
      filename: `${cv.name || 'cv'}_CV.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).save();
  };

  // ─── AI Auto-Fill from PDF ────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(lang === 'ar'
      ? 'سيؤدي هذا إلى استبدال جميع البيانات الحالية. هل أنت متأكد؟'
      : 'This will replace all current data. Are you sure?')
    ) { e.target.value = ''; return; }

    setIsImporting(true);
    setImportStatus(lang === 'ar' ? '📄 جاري قراءة الملف...' : '📄 Parsing PDF...');

    try {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.js';

      const buffer = await file.arrayBuffer();
      const pdfDoc = await (pdfjsLib as any).getDocument(buffer).promise;
      let fullText = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }

      setImportStatus(lang === 'ar' ? '⏳ جاري استخراج البيانات...' : '⏳ Extracting data...');

      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const schema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          address: { type: Type.STRING },
          summary: { type: Type.STRING },
          links: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, url: { type: Type.STRING } } } },
          experience: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, company: { type: Type.STRING }, location: { type: Type.STRING }, from: { type: Type.STRING }, to: { type: Type.STRING }, description: { type: Type.STRING } } } },
          education: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { degree: { type: Type.STRING }, university: { type: Type.STRING }, location: { type: Type.STRING }, year: { type: Type.STRING } } } },
          skills: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } },
          certifications: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } },
        },
      };

      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert CV parser. Extract all data from the following CV text into the provided JSON schema. If a field is not found, return an empty string or empty array.\n\nCV Text:\n\n${fullText}`,
        config: { responseMimeType: 'application/json', responseSchema: schema },
      });

      const parsed = JSON.parse(res.text?.trim() || '{}');
      const stamp = (arr: any[]) => (arr || []).map((item: any, i: number) => ({ ...item, id: i + 1 }));
      setCv({
        name: parsed.name || '',
        jobTitle: parsed.jobTitle || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        address: parsed.address || '',
        summary: parsed.summary || '',
        links: stamp(parsed.links),
        experience: stamp(parsed.experience),
        education: stamp(parsed.education),
        skills: stamp(parsed.skills),
        certifications: stamp(parsed.certifications),
      });

      setImportStatus(lang === 'ar' ? '✅ تم الملء تلقائياً بنجاح!' : '✅ Auto-filled successfully!');
      setTimeout(() => setImportStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setImportStatus(lang === 'ar' ? '❌ فشل استخراج البيانات.' : '❌ Failed to extract data.');
      setTimeout(() => setImportStatus(''), 5000);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // ─── UI helpers ────────────────────────────────────────────
  const ar = lang === 'ar';
  const lbl = (a: string, e: string) => ar ? a : e;

  return (
    <div className={`flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 ${ar ? 'font-[Tajawal]' : ''}`} dir={ar ? 'rtl' : 'ltr'}>

      {/* ── Top Toolbar ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 text-gray-900 dark:text-gray-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md z-10 relative">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 text-sm font-medium transition-colors">
            ← {lbl('الرئيسية', 'Dashboard')}
          </button>
          <span className="text-gray-300 dark:text-slate-700">|</span>
          <h1 className="font-bold text-lg">{lbl('منشئ السيرة الذاتية', 'CV Builder')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" ref={fileRef} accept="application/pdf" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 rounded-lg text-sm font-semibold shadow-sm transition"
          >
            {isImporting ? (ar ? 'جاري الاستيراد...' : 'Importing...') : lbl('استخراج من ملف', 'Import from PDF')}
          </button>
          <button onClick={handleDownload} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition">
            {lbl('تحميل PDF', 'Download PDF')}
          </button>
        </div>
      </div>

      {/* ── Import Status Banner ── */}
      {importStatus && (
        <div className="bg-indigo-600 text-white text-center text-sm font-medium py-2 px-4">
          {importStatus}
        </div>
      )}

      {/* ── Main 2-col Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Form Panel */}
        <div className="w-1/2 overflow-y-auto p-6 bg-white dark:bg-slate-900 border-e border-gray-200 dark:border-slate-700 space-y-6">

          {/* Layout Options */}
          <Section title={lbl('خيارات التنسيق', 'Layout Options')}>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{lbl('حجم الصفحة', 'Page Layout')}</p>
                <div className="flex gap-4">
                  {(['auto', 'one-page'] as const).map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" checked={pageLayout === v} onChange={() => setPageLayout(v)} />
                      {v === 'auto' ? lbl('تلقائي (متعدد)', 'Auto Multi-page') : lbl('صفحة واحدة', 'One Page')}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  {lbl('حجم الخط', 'Font Size')}: {fontSize}pt
                </label>
                <input type="range" min={8} max={14} step={0.5} value={fontSize}
                  disabled={pageLayout === 'auto'}
                  onChange={e => setFontSize(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 disabled:opacity-40" />
              </div>
            </div>
          </Section>

          {/* Personal Info */}
          <Section title={lbl('المعلومات الشخصية', 'Personal Information')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={lbl('الاسم الكامل', 'Full Name')} value={cv.name} onChange={v => setField('name', v)} />
              <Field label={lbl('المسمى الوظيفي', 'Job Title')} value={cv.jobTitle} onChange={v => setField('jobTitle', v)} />
              <Field label={lbl('البريد', 'Email')} type="email" value={cv.email} onChange={v => setField('email', v)} />
              <Field label={lbl('الهاتف', 'Phone')} value={cv.phone} onChange={v => setField('phone', v)} />
              <Field label={lbl('العنوان', 'Address')} value={cv.address} onChange={v => setField('address', v)} cls="sm:col-span-2" />
            </div>
          </Section>

          {/* Links */}
          <Section title={lbl('الروابط', 'Links')}>
            {cv.links.map(l => (
              <div key={l.id}>
                <DynItem onRemove={() => removeItem('links', l.id)} removeLabel={lbl('حذف', 'Remove')}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={lbl('النص', 'Display Text')} value={l.text} onChange={v => updateItem<LinkItem>('links', l.id, 'text', v)} />
                    <Field label="URL" type="url" value={l.url} onChange={v => updateItem<LinkItem>('links', l.id, 'url', v)} />
                  </div>
                </DynItem>
              </div>
            ))}
            <AddBtn onClick={() => addItem('links')} label={lbl('+ إضافة رابط', '+ Add Link')} />
          </Section>

          {/* Summary */}
          <Section title={lbl('الملخص الاحترافي', 'Professional Summary')}>
            <TextArea label={lbl('الملخص', 'Summary')} value={cv.summary} onChange={v => setField('summary', v)} rows={4} />
          </Section>

          {/* Experience */}
          <Section title={lbl('الخبرة العملية', 'Work Experience')}>
            {cv.experience.map(exp => (
              <div key={exp.id}>
                <DynItem onRemove={() => removeItem('experience', exp.id)} removeLabel={lbl('حذف', 'Remove')}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={lbl('المسمى الوظيفي', 'Position')} value={exp.title} onChange={v => updateItem<ExpItem>('experience', exp.id, 'title', v)} />
                    <Field label={lbl('الشركة', 'Company')} value={exp.company} onChange={v => updateItem<ExpItem>('experience', exp.id, 'company', v)} />
                    <Field label={lbl('الموقع', 'Location')} value={exp.location} onChange={v => updateItem<ExpItem>('experience', exp.id, 'location', v)} />
                    <Field label={lbl('من', 'From')} value={exp.from} onChange={v => updateItem<ExpItem>('experience', exp.id, 'from', v)} />
                    <Field label={lbl('إلى', 'To')} value={exp.to} onChange={v => updateItem<ExpItem>('experience', exp.id, 'to', v)} />
                    <TextArea label={lbl('الوصف', 'Description')} value={exp.description} onChange={v => updateItem<ExpItem>('experience', exp.id, 'description', v)} cls="sm:col-span-2" />
                  </div>
                </DynItem>
              </div>
            ))}
            <AddBtn onClick={() => addItem('experience')} label={lbl('+ إضافة خبرة', '+ Add Experience')} />
          </Section>

          {/* Education */}
          <Section title={lbl('التعليم', 'Education')}>
            {cv.education.map(edu => (
              <div key={edu.id}>
                <DynItem onRemove={() => removeItem('education', edu.id)} removeLabel={lbl('حذف', 'Remove')}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={lbl('الشهادة', 'Degree')} value={edu.degree} onChange={v => updateItem<EduItem>('education', edu.id, 'degree', v)} />
                    <Field label={lbl('الجامعة', 'University')} value={edu.university} onChange={v => updateItem<EduItem>('education', edu.id, 'university', v)} />
                    <Field label={lbl('الموقع', 'Location')} value={edu.location} onChange={v => updateItem<EduItem>('education', edu.id, 'location', v)} />
                    <Field label={lbl('سنة التخرج', 'Graduation Year')} value={edu.year} onChange={v => updateItem<EduItem>('education', edu.id, 'year', v)} />
                  </div>
                </DynItem>
              </div>
            ))}
            <AddBtn onClick={() => addItem('education')} label={lbl('+ إضافة تعليم', '+ Add Education')} />
          </Section>

          {/* Skills */}
          <Section title={lbl('المهارات', 'Skills')}>
            {cv.skills.map(s => (
              <div key={s.id}>
                <DynItem onRemove={() => removeItem('skills', s.id)} removeLabel={lbl('حذف', 'Remove')}>
                  <Field label={lbl('مهارة', 'Skill')} value={s.text} onChange={v => updateItem<SkillItem>('skills', s.id, 'text', v)} />
                </DynItem>
              </div>
            ))}
            <AddBtn onClick={() => addItem('skills')} label={lbl('+ إضافة مهارة', '+ Add Skill')} />
          </Section>

          {/* Certifications */}
          <Section title={lbl('الشهادات والدورات', 'Certifications')}>
            {cv.certifications.map(c => (
              <div key={c.id}>
                <DynItem onRemove={() => removeItem('certifications', c.id)} removeLabel={lbl('حذف', 'Remove')}>
                  <Field label={lbl('شهادة', 'Certification')} value={c.text} onChange={v => updateItem<SkillItem>('certifications', c.id, 'text', v)} />
                </DynItem>
              </div>
            ))}
            <AddBtn onClick={() => addItem('certifications')} label={lbl('+ إضافة شهادة', '+ Add Certification')} />
          </Section>

        </div>

        {/* RIGHT: Preview Panel */}
        <div className="w-1/2 overflow-y-auto bg-gray-200 dark:bg-gray-800 p-6 flex justify-center items-start">
          <div className="transform origin-top scale-[0.6] lg:scale-[0.8] xl:scale-100 transition-transform">
            <div
              ref={previewRef}
              id="cv-preview"
              dir="ltr"
              style={{
                background: 'white',
                width: '210mm',
                minHeight: pageLayout === 'one-page' ? '297mm' : undefined,
                maxHeight: pageLayout === 'one-page' ? '297mm' : undefined,
                overflow: pageLayout === 'one-page' ? 'hidden' : undefined,
                padding: '2cm',
                boxShadow: '0 0 20px rgba(0,0,0,0.2)',
                color: '#000',
                fontFamily: "'Times New Roman', Times, serif",
                lineHeight: 1.4,
                fontSize: `${fontSize}pt`,
              }}
            >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1 style={{ fontSize: '2.5em', margin: 0, letterSpacing: 2, fontWeight: 700 }}>
                {cv.name || (ar ? 'الاسم الكامل' : 'Full Name')}
              </h1>
              <p style={{ fontSize: '1.1em', margin: '5px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '5px 0' }}>
                {cv.jobTitle || (ar ? 'المسمى الوظيفي' : 'Job Title')}
              </p>
              <p style={{ fontSize: '0.9em', marginTop: 10 }}>
                {[cv.address, cv.email, cv.phone].filter(Boolean).join(' | ')}
                {cv.links.filter(l => l.url).map(l => (
                  <React.Fragment key={l.id}>{' | '}<a href={l.url.startsWith('http') ? l.url : `https://${l.url}`} style={{ color: 'inherit' }}>{l.text || l.url}</a></React.Fragment>
                ))}
              </p>
            </div>

            {/* Summary */}
            {cv.summary && (
              <PreviewSection title={ar ? "الملخص" : "Professional Summary"}>
                <p style={{ textAlign: 'justify' }}>{cv.summary}</p>
              </PreviewSection>
            )}

            {/* Experience */}
            {cv.experience.length > 0 && (
              <PreviewSection title={ar ? "الخبرة العملية" : "Work Experience"}>
                {cv.experience.map(exp => (
                  <div key={exp.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>{exp.title || 'Position'}</span>
                      <span style={{ fontStyle: 'italic', fontWeight: 'normal' }}>{exp.from} – {exp.to}</span>
                    </div>
                    <div style={{ fontStyle: 'italic', color: '#444' }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                    {exp.description && (
                      <ul style={{ listStyleType: 'disc', margin: '5px 0 0 20px', padding: 0 }}>
                        {exp.description.split('\n').filter(l => l.trim()).map((line, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>{line.replace('•', '').trim()}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </PreviewSection>
            )}

            {/* Education */}
            {cv.education.length > 0 && (
              <PreviewSection title={ar ? "التعليم" : "Education"}>
                {cv.education.map(edu => (
                  <div key={edu.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>{edu.degree}</span>
                      <span style={{ fontStyle: 'italic', fontWeight: 'normal' }}>Graduated: {edu.year}</span>
                    </div>
                    <div style={{ fontStyle: 'italic', color: '#444' }}>{edu.university}{edu.location ? `, ${edu.location}` : ''}</div>
                  </div>
                ))}
              </PreviewSection>
            )}

            {/* Skills */}
            {cv.skills.length > 0 && (
              <PreviewSection title={ar ? "المهارات" : "Skills"}>
                <ul style={{ listStyleType: 'disc', marginLeft: 20 }}>
                  {cv.skills.map(s => <li key={s.id} style={{ marginBottom: 3 }}>{s.text}</li>)}
                </ul>
              </PreviewSection>
            )}

            {/* Certifications */}
            {cv.certifications.length > 0 && (
              <PreviewSection title={ar ? "الشهادات والدورات" : "Certifications"}>
                <ul style={{ listStyleType: 'disc', marginLeft: 20 }}>
                  {cv.certifications.map(c => <li key={c.id} style={{ marginBottom: 3 }}>{c.text}</li>)}
                </ul>
              </PreviewSection>
            )}
          </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4 pb-2 border-b border-indigo-200 dark:border-indigo-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', cls = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; cls?: string;
}) {
  return (
    <div className={cls}>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-black dark:border-white rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition shadow-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, cls = '' }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; cls?: string;
}) {
  return (
    <div className={cls}>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-black dark:border-white rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-vertical transition shadow-sm"
      />
    </div>
  );
}

function DynItem({ children, onRemove, removeLabel }: { children: React.ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-3 bg-gray-50 dark:bg-slate-800/50 space-y-3">
      {children}
      <div className="flex justify-end">
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-1 border border-red-300 hover:border-red-500 rounded-lg transition">
          🗑 {removeLabel}
        </button>
      </div>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full mt-2 py-2 border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-semibold transition">
      {label}
    </button>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '1.27em', fontWeight: 700, borderBottom: '2px solid #000', paddingBottom: 5, marginBottom: 10, letterSpacing: 1 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
