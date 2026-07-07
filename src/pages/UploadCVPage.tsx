import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { UploadCloud } from 'lucide-react';

export default function UploadCVPage({ session, profile }: { session: any, profile: any }) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }

    if (profile?.role !== 'job_seeker') {
      navigate('/dashboard');
      return;
    }
  }, [session, profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a PDF, DOC, or DOCX file.');
        setFile(null);
        return;
      }
      
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB.');
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `cvs/${fileName}`;

      // Upload to Supabase Storage using authenticated client (sets correct owner for RLS)
      let { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError && uploadError.message.includes('Bucket not found')) {
        const { error: createError } = await supabaseAdmin.storage.createBucket('resumes', { public: true });
        if (!createError) {
          const retry = await supabase.storage.from('resumes').upload(filePath, file);
          uploadError = retry.error;
        } else {
          throw new Error('Storage bucket "resumes" is missing. Please run the latest SQL schema in your Supabase dashboard.');
        }
      }

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cv_url: publicUrl })
        .eq('user_id', session.user.id);

      if (updateError) throw updateError;

      setSuccess('CV uploaded successfully!');
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload CV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
            Upload CV
          </h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-slate-800 sm:rounded-xl p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
            {success}
          </div>
        )}

        <div className="col-span-full">
          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
            <div className="text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-gray-600 dark:text-gray-300 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white dark:bg-slate-900 font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
                >
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">PDF, DOC, DOCX up to 5MB</p>
            </div>
          </div>
        </div>

        {file && (
          <div className="mt-4 flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-md">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-sm text-red-600 hover:text-red-500"
            >
              Remove
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-x-6">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload CV'}
          </button>
        </div>
      </div>
    </div>
  );
}
