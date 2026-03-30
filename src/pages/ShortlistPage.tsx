import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabaseAdmin } from '../lib/supabase';
import { BookmarkCheck, User, Bookmark, FileText } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function ShortlistPage({ session, profile }: { session: any, profile: any }) {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [savedCandidates, setSavedCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || profile?.role !== 'hr') {
      navigate('/login');
      return;
    }
    fetchSavedCandidates();
  }, [session, profile]);

  const fetchSavedCandidates = async () => {
    setLoading(true);
    try {
      const condition = profile?.company_id 
        ? { col: 'company_id', val: profile.company_id } 
        : { col: 'recruiter_id', val: session.user.id };
        
      const [slRes, notesRes] = await Promise.all([
        supabaseAdmin.from('shortlists').select('*, profiles!inner(*)').eq(condition.col, condition.val),
        supabaseAdmin.from('candidate_notes').select('*, profiles!inner(*)').eq(condition.col, condition.val).order('created_at', { ascending: false })
      ]);
      
      const merged = new Map();
      if (slRes.data) {
        slRes.data.forEach((r: any) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          if (p) {
            merged.set(p.id, { ...p, _shortlisted: true });
          }
        });
      }
      if (notesRes.data) {
        notesRes.data.forEach((r: any) => {
          const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          if (p) {
            const existing = merged.get(p.id) || { ...p, _shortlisted: false };
            if (!existing._lastNote) {
              existing._lastNote = r.note_text;
              existing._rating = r.rating;
              existing._tags = r.tags;
            }
            merged.set(p.id, existing);
          }
        });
      }
      setSavedCandidates(Array.from(merged.values()));

    } catch (error) {
      console.error('Error fetching Shortlist data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <BookmarkCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          {t('dash.hr_saved') || 'Shortlisted Candidates'}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t('dash.hr_saved_desc') || 'View all candidates you have saved or interacted with.'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : savedCandidates.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedCandidates.map((cad) => (
            <Link key={cad.id} to={`/candidate-profile/${cad.id}`} className="bg-white dark:bg-slate-900 overflow-hidden shadow sm:rounded-lg border border-gray-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
              <div className="px-4 py-5 sm:p-6 flex items-start gap-4">
                {cad.avatar_url ? (
                  <img src={cad.avatar_url} alt={cad.name} className="h-14 w-14 rounded-full object-cover border border-gray-200 dark:border-slate-700" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <User className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">{cad.name || 'Anonymous'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{cad.job_title || 'No Title'}</p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {cad._shortlisted && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-600/20">
                        <Bookmark className="h-3 w-3" /> Shortlisted
                      </span>
                    )}
                    {(cad._rating > 0) && (
                      <span className="inline-flex items-center gap-1 rounded bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300 ring-1 ring-inset ring-yellow-600/20">
                        ★ {cad._rating}/5
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {cad._lastNote && (
                 <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-slate-800">
                   <div className="flex gap-2">
                     <FileText className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                     <p className="truncate" title={cad._lastNote}>"{cad._lastNote}"</p>
                   </div>
                 </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center bg-white dark:bg-slate-900 rounded-lg p-12 border border-dashed border-gray-300 dark:border-slate-700">
          <BookmarkCheck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No candidates saved</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start exploring the candidate database to build your shortlist.</p>
          <div className="mt-6">
            <Link to="/search" className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Go to Candidate Search
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
