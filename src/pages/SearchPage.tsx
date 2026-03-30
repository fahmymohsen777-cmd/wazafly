import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { Search, MapPin, Briefcase, Star, Download, FilterX, Clock, Award, Shield, DollarSign } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { EGYPT_GOVERNORATES, JOB_CATEGORIES } from '../lib/constants';

export default function SearchPage({ session, profile }: { session: any, profile: any }) {
  const { t, language } = useSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

  // Filters State
  const [experienceFilter, setExperienceFilter] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [jobCategoryFilter, setJobCategoryFilter] = useState('');
  
  const [englishLevelFilter, setEnglishLevelFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [educationLevelFilter, setEducationLevelFilter] = useState('');
  
  const [availabilityFilter, setAvailabilityFilter] = useState(false);
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  useEffect(() => {
    fetchInitialCandidates();
  }, []);

  const fetchInitialCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*, users!inner(role)')
        .eq('users.role', 'job_seeker')
        .order('last_active_at', { ascending: false, nullsFirst: false });
      
      if (!error && data) {
        setAllCandidates(data);
        // Don't show candidates by default - wait for HR to search
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    if (profile?.role !== 'hr') {
      navigate('/dashboard');
      return;
    }
    checkSubscription();
  }, [session, profile]);

  const checkSubscription = async () => {
    try {
      const { data: freshUser } = await supabaseAdmin
        .from('users')
        .select('hr_role, company_id, role')
        .eq('id', session.user.id)
        .single();

      let targetUserId = session.user.id;
      if (freshUser?.hr_role === 'recruiter' && freshUser?.company_id) {
        const { data: compData } = await supabaseAdmin
          .from('companies')
          .select('admin_id')
          .eq('id', freshUser.company_id)
          .single();
        if (compData?.admin_id) targetUserId = compData.admin_id;
      }

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .single();

      if (error || !data) navigate('/pricing');
      else setSubscriptionPlan(data.plan);
    } catch (error) {
      navigate('/pricing');
    }
  };

  const clearFilters = () => {
    setQuery('');
    setExperienceFilter('');
    setMinSalary('');
    setMaxSalary('');
    setJobCategoryFilter('');
    setEnglishLevelFilter('');
    setSkillsFilter('');
    setEducationLevelFilter('');
    setAvailabilityFilter(false);
    setMinAge('');
    setMaxAge('');
    setGenderFilter('');
    setCandidates(allCandidates);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const queryLower = query.trim().toLowerCase();
      const searchWords = queryLower.split(/\s+/).filter(w => w.length > 0);
      
      let filteredData = allCandidates.filter((candidate: any) => {
        let textMatch = true;
        if (searchWords.length > 0) {
          const candidateText = [
            candidate.name,
            candidate.job_title,
            candidate.job_category,
            candidate.city,
            candidate.district,
            candidate.bio,
            ...(candidate.skills || [])
          ].filter(Boolean).join(' ').toLowerCase();
          textMatch = searchWords.every(word => candidateText.includes(word));
        }
        
        // Experience
        let expMatch = true;
        if (experienceFilter === 'fresh') expMatch = candidate.experience_years <= 1;
        else if (experienceFilter === 'junior') expMatch = candidate.experience_years >= 1 && candidate.experience_years <= 3;
        else if (experienceFilter === 'mid') expMatch = candidate.experience_years >= 3 && candidate.experience_years <= 5;
        else if (experienceFilter === 'senior') expMatch = candidate.experience_years >= 5;

        // Salary
        const candSal = candidate.salary_expectation;
        const salMinMatch = minSalary ? (candSal !== null && candSal >= parseInt(minSalary)) : true;
        const salMaxMatch = maxSalary ? (candSal !== null && candSal <= parseInt(maxSalary)) : true;

        const categoryMatch = jobCategoryFilter ? candidate.job_category === jobCategoryFilter : true;
        const englishMatch = englishLevelFilter ? candidate.english_level === englishLevelFilter : true;
        const eduMatch = educationLevelFilter ? candidate.education_level === educationLevelFilter : true;
        const skillsMatch = skillsFilter ? (candidate.skills || []).some((s: string) => s.toLowerCase().includes(skillsFilter.toLowerCase())) : true;

        const availMatch = availabilityFilter ? candidate.is_immediate_available === true : true;
        
        const candAge = candidate.age;
        const ageMinMatch = minAge ? (candAge !== null && candAge >= parseInt(minAge)) : true;
        const ageMaxMatch = maxAge ? (candAge !== null && candAge <= parseInt(maxAge)) : true;
        
        const genderMatch = genderFilter ? candidate.gender === genderFilter : true;

        return textMatch && expMatch && salMinMatch && salMaxMatch && categoryMatch && englishMatch && eduMatch && skillsMatch && availMatch && ageMinMatch && ageMaxMatch && genderMatch;
      });

      // Show results
      setCandidates(filteredData);
    } catch (err: any) {
      setError(err.message || 'An error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  const getActiveText = (dateStr: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
    if (days <= 0) return language === 'ar' ? 'اليوم' : 'Today';
    if (days === 1) return language === 'ar' ? 'أمس' : 'Yesterday';
    if (language === 'ar') return days === 2 ? 'منذ يومين' : `منذ ${days} أيام`;
    return `${days}d ago`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      
      {/* Top Search Bar */}
      <div className="bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-slate-800 sm:rounded-xl p-4 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="block w-full rounded-md border-0 py-3 pl-10 text-gray-900 dark:text-gray-100 dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder={t('search.placeholder') || "Search candidates..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? t('search.loading') || "Searching..." : t('search.btn') || "Search"}
          </button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <div className="w-full md:w-72 flex-shrink-0">
          <div className="bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-slate-800 rounded-xl p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                <FilterX className="mr-2 h-5 w-5 text-indigo-500" />
                {t('search.filters') || "Filters"}
              </h3>
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-red-500 hover:text-red-700 transition">
                {t('search.clear_filters') || "Clear All"}
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Must-Haves Accordion */}
              <details open className="group border-b border-gray-100 dark:border-slate-800 pb-2">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-800 dark:text-gray-200 py-2 hover:text-indigo-600 transition">
                  <span className="flex items-center gap-2">{t('search.must_haves') || "Must-Haves"}</span>
                  <svg className="h-4 w-4 transform group-open:-rotate-180 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="pt-2 pb-4 space-y-4 px-1">
                  
                  {/* Experience */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.exp') || "Experience"}</label>
                    <select value={experienceFilter} onChange={e => setExperienceFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600">
                      <option value="">{language === 'ar' ? 'الكل' : 'Any'}</option>
                      <option value="fresh">{t('edit.experience_fresh')}</option>
                      <option value="junior">{t('edit.experience_junior')}</option>
                      <option value="mid">{t('edit.experience_mid')}</option>
                      <option value="senior">{t('edit.experience_senior')}</option>
                    </select>
                  </div>

                  {/* Salary Budget */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.salary') || "Salary Budget"}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" placeholder={t('search.min_salary') || "Min"} value={minSalary} onChange={e=>setMinSalary(e.target.value)} className="w-1/2 text-sm rounded-md border-0 py-1.5 px-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                      <span className="text-gray-400">-</span>
                      <input type="number" placeholder={t('search.max_salary') || "Max"} value={maxSalary} onChange={e=>setMaxSalary(e.target.value)} className="w-1/2 text-sm rounded-md border-0 py-1.5 px-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.job_category') || "Category"}</label>
                     <input list="jobCategoriesSearch" placeholder={t('search.job_category_ph') || ""} value={jobCategoryFilter} onChange={e=>setJobCategoryFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                     <datalist id="jobCategoriesSearch">
                      {JOB_CATEGORIES.map(cat => <option key={cat.en} value={language === 'ar' ? cat.ar : cat.en} />)}
                     </datalist>
                  </div>
                </div>
              </details>

              {/* Premium Details Accordion */}
              <details open className="group border-b border-gray-100 dark:border-slate-800 pb-2">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-800 dark:text-gray-200 py-2 hover:text-indigo-600 transition">
                  <span className="flex items-center gap-2">{t('search.premium_details') || "Premium Details"}</span>
                  <svg className="h-4 w-4 transform group-open:-rotate-180 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="pt-2 pb-4 space-y-4 px-1">
                  
                  {/* English Level */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.english_level') || "English Level"}</label>
                    <select value={englishLevelFilter} onChange={e => setEnglishLevelFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600">
                      <option value="">{language === 'ar' ? 'الكل' : 'Any'}</option>
                      <option value="Acceptable">{t('edit.eng_acc')}</option>
                      <option value="Good">{t('edit.eng_good')}</option>
                      <option value="Fluent">{t('edit.eng_fluent')}</option>
                    </select>
                  </div>

                  {/* Skills tags */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('search.skills_tags') || "Skills / Keywords"}</label>
                    <input type="text" placeholder="e.g. React, B2B..." value={skillsFilter} onChange={e=>setSkillsFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                  </div>

                  {/* Education */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.education_level') || "Education Level"}</label>
                    <select value={educationLevelFilter} onChange={e => setEducationLevelFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600">
                      <option value="">{language === 'ar' ? 'الكل' : 'Any'}</option>
                      <option value="Student">{t('edit.edu_student')}</option>
                      <option value="Diploma">{t('edit.edu_diploma')}</option>
                      <option value="Bachelor">{t('edit.edu_bachelor')}</option>
                      <option value="Postgrad">{t('edit.edu_postgrad')}</option>
                    </select>
                  </div>
                </div>
              </details>

              {/* Hiring Speed Accordion */}
              <details open className="group pb-2">
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-800 dark:text-gray-200 py-2 hover:text-indigo-600 transition">
                  <span className="flex items-center gap-2">{t('search.hiring_speed') || "Hiring Speed"}</span>
                  <svg className="h-4 w-4 transform group-open:-rotate-180 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="pt-2 pb-4 space-y-4 px-1">
                  
                  {/* Availability */}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="availCheck" checked={availabilityFilter} onChange={e=>setAvailabilityFilter(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                    <label htmlFor="availCheck" className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('edit.immediate') || "Immediate Availability"}</label>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.age') || "Age"}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" placeholder={t('search.age_min') || "Min"} value={minAge} onChange={e=>setMinAge(e.target.value)} className="w-1/2 text-sm rounded-md border-0 py-1.5 px-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                      <span className="text-gray-400">-</span>
                      <input type="number" placeholder={t('search.age_max') || "Max"} value={maxAge} onChange={e=>setMaxAge(e.target.value)} className="w-1/2 text-sm rounded-md border-0 py-1.5 px-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700" />
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1">{t('edit.gender') || "Gender"}</label>
                    <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="w-full text-sm rounded-md border-0 py-2 px-3 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600">
                      <option value="">{language === 'ar' ? 'الكل' : 'Any'}</option>
                      <option value="Male">{t('edit.gen_male')}</option>
                      <option value="Female">{t('edit.gen_female')}</option>
                    </select>
                  </div>
                </div>
              </details>
            </div>

            <button
              onClick={() => handleSearch()}
              className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              {t('search.btn') || "Search Candidates"}
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1">
          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {candidates.length > 0 ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{candidates.length} {t('search.found')}</h3>
                {subscriptionPlan === 'price_enterprise' && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                    ✨ Advanced Filter Results
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {candidates.map((candidate) => (
                  <div key={candidate.id} onClick={() => navigate(`/candidate-profile/${candidate.id}`)} className="bg-white dark:bg-slate-900 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-slate-700 flex flex-col hover:border-indigo-300 transition-colors cursor-pointer hover:shadow-md">
                    <div className="p-5 flex-grow">
                      <div className="flex items-center gap-3 mb-4">
                        {candidate.avatar_url ? (
                          <img src={candidate.avatar_url} alt={candidate.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 text-lg font-bold">
                              {candidate.name ? candidate.name.charAt(0).toUpperCase() : '?'}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{candidate.name || 'Anonymous Candidate'}</h3>
                          <div className="text-sm text-indigo-600 font-medium truncate">{candidate.job_title || 'Not specified'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {candidate.is_immediate_available && (
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                              {language === 'ar' ? 'متاح فوراً' : 'Immediate'}
                            </span>
                          )}
                          {candidate.last_active_at && (
                             <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                               <Clock className="w-3 h-3 mr-1" /> {t('search.active_ago')} {getActiveText(candidate.last_active_at)}
                             </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center">
                                <Briefcase className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" />
                                <span className="truncate">{candidate.experience_years || 0} {t('search.exp')}</span>
                            </div>
                            {candidate.salary_expectation && (
                                <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
                                    <DollarSign className="mr-1 h-3 w-3 flex-shrink-0" />
                                    <span>{candidate.salary_expectation} EGP</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span className="truncate">{candidate.district ? `${candidate.district}, ${candidate.city}` : (candidate.city || 'Location not specified')}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                        {candidate.bio || "No summary provided."}
                      </div>

                      <div className="mt-auto">
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.skills && candidate.skills.slice(0, 4).map((skill: string, index: number) => (
                            <span key={index} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              {skill}
                            </span>
                          ))}
                          {candidate.skills && candidate.skills.length > 4 && (
                            <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
                              +{candidate.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800 px-5 py-3 border-t border-gray-100 flex justify-between items-center">
                      <Link
                        to={`/candidate-profile/${candidate.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {t('search.view_profile')}
                      </Link>
                      {candidate.cv_url && (
                        <a
                          href={candidate.cv_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:text-gray-100"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          CV
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-slate-800 sm:rounded-xl">
              <Search className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No candidates found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
