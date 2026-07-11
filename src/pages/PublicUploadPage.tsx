import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, FileText, Lock } from 'lucide-react';

// ─── Public CV Upload Page (no login required) ────────────────────────────────
// Accessed via /upload/:token — validates token server-side before allowing upload
export default function PublicUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<any>(null);
  const [linkError, setLinkError] = useState('');
  const [validating, setValidating] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!token) { setLinkError('رابط غير صالح.'); setValidating(false); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/upload-links/${token}`);
      const data = await res.json();
      if (!res.ok) { setLinkError(data.error || 'الرابط غير صالح أو منتهي الصلاحية.'); }
      else { setLinkInfo(data); }
    } catch {
      setLinkError('تعذّر التحقق من الرابط. تحقق من الاتصال بالإنترنت.');
    } finally {
      setValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadMsg('');
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    setUploading(true);
    setUploadStatus('idle');
    setUploadMsg('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`/api/upload-links/${token}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadStatus('error');
        setUploadMsg(data.error || 'فشل الرفع.');
      } else {
        setUploadStatus('success');
        setUploadMsg('✅ تم رفع ملفك بنجاح! شكراً لك.');
        setSelectedFile(null);
        if (fileRef.current) fileRef.current.value = '';
        // Refresh link info to show updated use count
        validateToken();
      }
    } catch {
      setUploadStatus('error');
      setUploadMsg('حدث خطأ أثناء الرفع. حاول مرة أخرى.');
    } finally {
      setUploading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center border border-red-100 dark:border-red-900/30">
          <Lock className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">الرابط غير متاح</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{linkError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-slate-900 px-4" dir="rtl">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-4">
            <Upload className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">رفع سيرتك الذاتية</h1>
          {linkInfo?.label && (
            <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">{linkInfo.label}</p>
          )}
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            يمكنك رفع ملف CV (PDF أو Word) — لا يتطلب إنشاء حساب.
          </p>
          {linkInfo && (
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
              {linkInfo.max_uses && (
                <span>المتبقي: {Math.max(0, linkInfo.max_uses - (linkInfo.use_count || 0))} رفعة</span>
              )}
              {linkInfo.expires_at && (
                <span>ينتهي: {new Date(linkInfo.expires_at).toLocaleDateString('ar-EG')}</span>
              )}
            </div>
          )}
        </div>

        {/* Upload Area */}
        {uploadStatus === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{uploadMsg}</p>
            <button
              onClick={() => { setUploadStatus('idle'); setSelectedFile(null); }}
              className="mt-4 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              رفع ملف آخر
            </button>
          </div>
        ) : (
          <>
            {/* File Drop Zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile ? (
                <>
                  <FileText className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-xs text-indigo-500 mt-2">اضغط لتغيير الملف</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-300 font-medium">اضغط لاختيار ملف</p>
                  <p className="text-xs text-gray-400 mt-1">PDF أو Word — بحد أقصى 10 MB</p>
                </>
              )}
            </div>

            {uploadStatus === 'error' && (
              <div className="mt-3 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{uploadMsg}</span>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {uploading ? 'جاري الرفع...' : 'رفع السيرة الذاتية'}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          بياناتك محفوظة بأمان ولن تُستخدم إلا في عملية التوظيف.
        </p>
      </div>
    </div>
  );
}
