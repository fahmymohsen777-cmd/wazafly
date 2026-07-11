import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseAdmin } from "../lib/supabase";
import { useSettings } from "../contexts/SettingsContext";
import { EGYPT_GOVERNORATES, JOB_CATEGORIES } from "../lib/constants";
import * as pdfjsLib from "pdfjs-dist";
// Use a local, version-matched worker emitted by Vite, not a remote CDN.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
export default function EditProfilePage({
  session,
  profile,
}: {
  session: any;
  profile: any;
}) {
  const navigate = useNavigate();
  const { t, language } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    job_title: "",
    city: "",
    district: "",
    military_status: "",
    experience_years: 0,
    salary_expectation: "",
    bio: "",
    skills: "",
    job_category: "",
    english_level: "",
    education_level: "",
    gender: "",
    age: "",
    is_immediate_available: false,
  });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) {
      navigate("/login");
      return;
    }

    if (profile?.role !== "job_seeker") {
      navigate("/dashboard");
      return;
    }

    fetchProfile();
  }, [session, profile]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          job_title: data.job_title || "",
          city: data.city || "",
          district: data.district || "",
          military_status: data.military_status || "",
          experience_years: data.experience_years || 0,
          salary_expectation: data.salary_expectation || "",
          bio: data.bio || "",
          skills: data.skills ? data.skills.join(", ") : "",
          job_category: data.job_category || "",
          english_level: data.english_level || "",
          education_level: data.education_level || "",
          gender: data.gender || "",
          age: data.age || "",
          is_immediate_available: data.is_immediate_available || false,
        });
        setAvatarUrl(data.avatar_url || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      setError("");

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError && uploadError.message.includes("Bucket not found")) {
        const { error: createError } = await supabaseAdmin.storage.createBucket(
          "avatars",
          { public: true },
        );
        if (!createError) {
          const retry = await supabaseAdmin.storage
            .from("avatars")
            .upload(filePath, file);
          uploadError = retry.error;
        } else {
          throw new Error(
            'Storage bucket "avatars" is missing. Please run the latest SQL schema in your Supabase dashboard.',
          );
        }
      }

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      // Update profile immediately
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", session.user.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleImportCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setError("");
      setImportStatus(
        language === "ar" ? "⏳ جاري قراءة الملف..." : "⏳ Reading PDF...",
      );

      const arrayBuffer = await file.arrayBuffer();

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      }

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
      }

      setImportStatus(
        language === "ar"
          ? "⏳ جاري استخراج البيانات..."
          : "⏳ Extracting data...",
      );

      // AI credentials stay on the server. The authenticated proxy uses the
      // active provider in ai_providers (Dahl/Kimi once configured in Supabase).
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession?.access_token)
        throw new Error("يرجى تسجيل الدخول أولاً.");

      const extractionPrompt = `You are an expert CV parser. Read the CV text below and return ONLY valid JSON with exactly these optional fields: name, email, phone, job_title, city, experience_years (number), bio, skills (string array), education_level, english_level. Do not wrap JSON in markdown.\n\nCV Text:\n${fullText.slice(0, 18000)}`;
      const response = await fetch("/api/ai/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          contents: extractionPrompt,
          config: { maxOutputTokens: 1800 },
        }),
      });
      const proxyResult = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(proxyResult.error || "فشل تحليل السيرة الذاتية.");
      const cleanedText = String(proxyResult.text || "")
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const data = JSON.parse(cleanedText || "{}");

      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        job_title: data.job_title || prev.job_title,
        city: data.city || prev.city,
        experience_years:
          data.experience_years !== undefined
            ? data.experience_years
            : prev.experience_years,
        bio: data.bio || prev.bio,
        skills: data.skills ? data.skills.join(", ") : prev.skills,
        education_level: data.education_level || prev.education_level,
        english_level: data.english_level || prev.english_level,
      }));

      setImportStatus(
        language === "ar"
          ? "✅ تم استخراج البيانات بنجاح"
          : "✅ Data extracted successfully",
      );
      setTimeout(() => setImportStatus(""), 4000);
    } catch (err: any) {
      console.error(err);
      setError(
        (language === "ar"
          ? "حدث خطأ أثناء قراءة الملف: "
          : "Error parsing PDF: ") + (err?.message || String(err)),
      );
      setImportStatus("");
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const skillsArray = formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      // Check if profile exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const profileData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        job_title: formData.job_title,
        city: formData.city,
        district: formData.district,
        military_status: formData.military_status || null,
        experience_years: parseInt(formData.experience_years.toString()) || 0,
        salary_expectation:
          parseInt(formData.salary_expectation.toString()) || null,
        bio: formData.bio,
        skills: skillsArray,
        job_category: formData.job_category || null,
        english_level: formData.english_level || null,
        education_level: formData.education_level || null,
        gender: formData.gender || null,
        age: parseInt(formData.age.toString()) || null,
        is_immediate_available: formData.is_immediate_available,
      };

      let error;
      if (existing) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("user_id", session.user.id);
        error = updateError;
      } else {
        // Insert new profile
        const { error: insertError } = await supabase
          .from("profiles")
          .insert([{ user_id: session.user.id, ...profileData }]);
        error = insertError;
      }

      if (error) throw error;
      navigate("/profile");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center dark:text-gray-300">
        {t("edit.loading")}
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
            {t("edit.title")}
          </h2>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3 flex-wrap">
          <input
            type="file"
            ref={fileRef}
            accept="application/pdf"
            onChange={handleImportCV}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
          >
            {isImporting
              ? importStatus
              : language === "ar"
                ? " الملء التلقائي من السيرة (PDF)"
                : "Auto-Fill from CV (PDF)"}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-slate-800 sm:rounded-xl md:col-span-2 transition-colors"
      >
        <div className="px-4 py-6 sm:p-8">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
            <div className="col-span-full">
              <label
                htmlFor="photo"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.photo")}
              </label>
              <div className="mt-2 flex items-center gap-x-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {t("edit.noimg")}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  id="avatar"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
                <label
                  htmlFor="avatar"
                  className="rounded-md bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  {uploadingAvatar ? t("edit.uploading") : t("edit.change")}
                </label>
              </div>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="name"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.name")}
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="phone"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.phone")}
              </label>
              <div className="mt-2">
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.email")}
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="job_title"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.job")}
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="job_title"
                  id="job_title"
                  value={formData.job_title}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="job_category"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.job_category")}
              </label>
              <div className="mt-2">
                <input
                  list="jobCategories"
                  name="job_category"
                  id="job_category"
                  placeholder={t("search.job_category_ph") || ""}
                  value={formData.job_category}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
                <datalist id="jobCategories">
                  {JOB_CATEGORIES.map((cat) => (
                    <option
                      key={cat.en}
                      value={language === "ar" ? cat.ar : cat.en}
                    />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="city"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.city")}
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="city"
                  id="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="district"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.district")}
              </label>
              <div className="mt-2">
                <select
                  name="district"
                  id="district"
                  value={formData.district}
                  onChange={handleChange as any}
                  className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                >
                  <option value="">
                    {language === "ar" ? "اختر المحافظة" : "Select Governorate"}
                  </option>
                  {EGYPT_GOVERNORATES.map((g) => (
                    <option key={g.en} value={g.en}>
                      {language === "ar" ? g.ar : g.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="military_status"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.military")}
              </label>
              <div className="mt-2">
                <select
                  name="military_status"
                  id="military_status"
                  value={formData.military_status}
                  onChange={handleChange as any}
                  className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                >
                  <option value="">{t("edit.mil_not_spec")}</option>
                  <option value="Completed">{t("edit.mil_comp")}</option>
                  <option value="Exempted">{t("edit.mil_exem")}</option>
                  <option value="Postponed">{t("edit.mil_post")}</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="gender"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.gender") || "Gender"}
              </label>
              <div className="mt-2">
                <select
                  name="gender"
                  id="gender"
                  value={formData.gender}
                  onChange={handleChange as any}
                  className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                >
                  <option value="">-</option>
                  <option value="Male">{t("edit.gen_male")}</option>
                  <option value="Female">{t("edit.gen_female")}</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="age"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.age") || "Age"}
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="age"
                  id="age"
                  min="16"
                  max="100"
                  value={formData.age}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="english_level"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.english_level") || "English Level"}
              </label>
              <div className="mt-2">
                <select
                  name="english_level"
                  id="english_level"
                  value={formData.english_level}
                  onChange={handleChange as any}
                  className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                >
                  <option value="">-</option>
                  <option value="Acceptable">{t("edit.eng_acc")}</option>
                  <option value="Good">{t("edit.eng_good")}</option>
                  <option value="Fluent">{t("edit.eng_fluent")}</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="education_level"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.education_level") || "Education"}
              </label>
              <div className="mt-2">
                <select
                  name="education_level"
                  id="education_level"
                  value={formData.education_level}
                  onChange={handleChange as any}
                  className="block w-full rounded-md border-0 py-2 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                >
                  <option value="">-</option>
                  <option value="Student">{t("edit.edu_student")}</option>
                  <option value="Diploma">{t("edit.edu_diploma")}</option>
                  <option value="Bachelor">{t("edit.edu_bachelor")}</option>
                  <option value="Postgrad">{t("edit.edu_postgrad")}</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-3">
              <label
                htmlFor="experience_years"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.exp")}
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="experience_years"
                  id="experience_years"
                  min="0"
                  value={formData.experience_years}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="salary_expectation"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.salary")}
              </label>
              <div className="mt-2">
                <input
                  type="number"
                  name="salary_expectation"
                  id="salary_expectation"
                  min="0"
                  value={formData.salary_expectation}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="col-span-full">
              <label
                htmlFor="skills"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.skills")}
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="skills"
                  id="skills"
                  placeholder={t("edit.skills_ph")}
                  value={formData.skills}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
            </div>

            <div className="col-span-full">
              <label
                htmlFor="bio"
                className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100"
              >
                {t("edit.bio")}
              </label>
              <div className="mt-2">
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  value={formData.bio}
                  onChange={handleChange}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 transition-colors"
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {t("edit.bio_hint")}
              </p>
            </div>

            <div className="col-span-full">
              <div className="relative flex gap-x-3">
                <div className="flex h-6 items-center">
                  <input
                    id="is_immediate_available"
                    name="is_immediate_available"
                    type="checkbox"
                    checked={formData.is_immediate_available}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-600"
                  />
                </div>
                <div className="text-sm leading-6">
                  <label
                    htmlFor="is_immediate_available"
                    className="font-medium text-gray-900 dark:text-gray-100"
                  >
                    {t("edit.immediate") || "Available Immediately"}
                  </label>
                  <p className="text-gray-500 dark:text-gray-400">
                    Toggle this if you are ready to start a new job tomorrow
                    without a notice period.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 dark:border-slate-800 px-4 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            {t("edit.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
          >
            {saving ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
