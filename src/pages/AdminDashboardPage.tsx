import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Users,
  Briefcase,
  UserCheck,
  CreditCard,
  CheckCircle,
  Trash2,
  BarChart2,
  Cpu,
  Plus,
  Eye,
  EyeOff,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Helper: authenticated fetch to /api/admin/* ─────────────────────────────
async function adminFetch(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("غير مسجّل دخول.");

  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  // Always handle a non-JSON response gracefully. This used to throw the
  // confusing browser error "Unexpected token 'T'" when Vercel returned an
  // HTML 404 page. The serverless API entry point now prevents that condition;
  // this guard still gives admins a useful deploy/configuration message.
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* HTML/plain text */
  }
  if (!res.ok) {
    const detail =
      json?.error ||
      (raw.includes("<!DOCTYPE") || raw.includes("<html")
        ? "لم يتم العثور على خدمة API. تأكد من نشر آخر إصدار على Vercel."
        : `HTTP ${res.status}`);
    throw new Error(detail);
  }
  if (json === null)
    throw new Error(
      "استجابة غير صالحة من خدمة الإدارة. أعد نشر آخر إصدار على Vercel.",
    );
  return json;
}

export default function AdminDashboardPage({
  session,
  profile,
}: {
  session: any;
  profile: any;
}) {
  const navigate = useNavigate();
  const { language } = useSettings();
  const isAr = language === "ar";
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalJobSeekers: 0,
    totalHR: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [adminError, setAdminError] = useState<string | null>(null);

  // Subscription Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [selectedDuration, setSelectedDuration] = useState(1);

  // Analytics State
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [newUsersData, setNewUsersData] = useState<any[]>([]);
  const [topJobTitles, setTopJobTitles] = useState<any[]>([]);
  const [subStatusData, setSubStatusData] = useState<any[]>([]);

  // AI Providers State
  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [aiProvidersLoading, setAiProvidersLoading] = useState(false);
  const [aiProviderForm, setAiProviderForm] = useState({
    name: "",
    base_url: "",
    model: "",
    api_key: "",
    is_active: false,
  });
  const [editingProviderId, setEditingProviderId] = useState<number | null>(
    null,
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiProviderMsg, setAiProviderMsg] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/login");
      return;
    }
    if (profile?.role === "admin") {
      fetchData();
      fetchAnalytics();
      fetchAiProviders();
    } else if (profile) {
      setLoading(false);
    }
  }, [session, profile]);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // Fetch users via secure API (not direct supabase client)
      const allUsers: any[] = await adminFetch("/api/admin/users");

      // 1. New users per day (last 7 days) — derived from public.users.created_at
      const map: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        });
        map[key] = 0;
      }
      allUsers.forEach((u) => {
        if (u.created_at) {
          const key = new Date(u.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          });
          if (key in map) map[key]++;
        }
      });
      setNewUsersData(
        Object.entries(map).map(([date, count]) => ({ date, count })),
      );

      // 2. Top 5 job titles — derived from profiles embedded in users
      const counts: Record<string, number> = {};
      allUsers.forEach((u) => {
        const jt = u.profiles?.[0]?.job_title;
        if (jt) counts[jt] = (counts[jt] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      setTopJobTitles(
        sorted.map(([title, count]) => ({
          title: title.length > 20 ? title.slice(0, 18) + "..." : title,
          count,
        })),
      );

      // 3. Subscription status
      const active = allUsers.filter((u) =>
        u.subscriptions?.some((s: any) => s.status === "active"),
      ).length;
      const expired = allUsers.length - active;
      setSubStatusData([
        { name: "Active", value: active },
        { name: "Expired/Other", value: expired },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ─── AI Providers logic ─────────────────────────────────────────────────────
  const fetchAiProviders = async () => {
    setAiProvidersLoading(true);
    try {
      const data = await adminFetch("/api/admin/ai-providers");
      setAiProviders(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setAiProvidersLoading(false);
    }
  };

  const handleAiProviderSave = async () => {
    setAiProviderMsg("");
    try {
      if (editingProviderId !== null) {
        // Update — only send api_key if user typed a new one
        const payload: any = {
          name: aiProviderForm.name,
          base_url: aiProviderForm.base_url,
          model: aiProviderForm.model,
          is_active: aiProviderForm.is_active,
        };
        if (aiProviderForm.api_key) payload.api_key = aiProviderForm.api_key;
        await adminFetch(`/api/admin/ai-providers/${editingProviderId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setAiProviderMsg("✅ تم التحديث بنجاح.");
      } else {
        await adminFetch("/api/admin/ai-providers", {
          method: "POST",
          body: JSON.stringify({ ...aiProviderForm }),
        });
        setAiProviderMsg("✅ تمت الإضافة بنجاح.");
      }
      setAiProviderForm({
        name: "",
        base_url: "",
        model: "",
        api_key: "",
        is_active: false,
      });
      setEditingProviderId(null);
      fetchAiProviders();
    } catch (e: any) {
      setAiProviderMsg("❌ " + (e.message || "فشل الحفظ."));
    }
    setTimeout(() => setAiProviderMsg(""), 4000);
  };

  const handleAiProviderEdit = (p: any) => {
    setEditingProviderId(p.id);
    setAiProviderForm({
      name: p.name,
      base_url: p.base_url,
      model: p.model,
      api_key: "",
      is_active: p.is_active,
    });
    setShowApiKey(false);
    setActiveTab("ai-providers");
  };

  const handleAiProviderDelete = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المزوّد؟")) return;
    try {
      await adminFetch(`/api/admin/ai-providers/${id}`, { method: "DELETE" });
      fetchAiProviders();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAiProviderToggleActive = async (
    id: number,
    currentActive: boolean,
  ) => {
    try {
      await adminFetch(`/api/admin/ai-providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchAiProviders();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!profile)
    return (
      <div className="p-8 text-center dark:text-gray-300">
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
    );

  if (profile.role !== "admin") {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {isAr ? "غير مصرح لك بالدخول" : "Access Denied"}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isAr
              ? "ليس لديك صلاحية للوصول للوحة تحكم الإدارة."
              : "You do not have permission to access the admin panel."}
          </p>
          <div className="mt-5">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {isAr ? "العودة للوحة التحكم" : "Return to Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ Uses secure API endpoint (service role key stays server-side)
      const allUsers: any[] = await adminFetch("/api/admin/users");
      const allPayments: any[] = await adminFetch("/api/admin/payments");

      const totalJobSeekers = allUsers.filter(
        (u) => u.role === "job_seeker",
      ).length;
      const totalHR = allUsers.filter((u) => u.role === "hr").length;
      const activeSubs = allUsers.filter((u) =>
        u.subscriptions?.some((s: any) => s.status === "active"),
      ).length;
      const pendingPays = allPayments.filter(
        (p) => p.status === "pending",
      ).length;

      setStats({
        totalUsers: allUsers.length,
        totalJobSeekers,
        totalHR,
        activeSubscriptions: activeSubs,
        pendingPayments: pendingPays,
      });

      setUsers(allUsers);
      setPayments(allPayments);
      setAdminError(null);
    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      setAdminError(
        isAr
          ? `خطأ في جلب بيانات الإدارة. تأكد من إضافة المتغير SUPABASE_SERVICE_ROLE_KEY في Vercel. التفاصيل: ${error.message}`
          : `Error fetching admin data. Make sure SUPABASE_SERVICE_ROLE_KEY is set in Vercel. Details: ${error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const openSubscriptionModal = (
    userId: string,
    paymentId: string | null = null,
  ) => {
    setSelectedUserId(userId);
    setSelectedPaymentId(paymentId);
    setSelectedPlan("pro");
    setSelectedDuration(1);
    setIsModalOpen(true);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + Number(selectedDuration));

      // ✅ Uses /api/admin/users/:id/subscription (service role server-side)
      await adminFetch(`/api/admin/users/${selectedUserId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          plan: selectedPlan,
          status: "active",
          end_date: endDate.toISOString(),
        }),
      });

      if (selectedPaymentId) {
        // ✅ Uses /api/admin/payments/:id
        await adminFetch(`/api/admin/payments/${selectedPaymentId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "approved" }),
        });
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error activating subscription:", error);
      alert(error?.message || "Failed to modify subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateSubscription = async (userId: string) => {
    try {
      await adminFetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ plan: "inactive", status: "inactive" }),
      });
      fetchData();
    } catch (error: any) {
      console.error("Error deactivating subscription:", error);
      alert(error?.message || "Failed to deactivate subscription");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    )
      return;
    try {
      // ✅ Uses DELETE /api/admin/users/:id (deletes from auth + public)
      await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(error?.message || "Failed to delete user");
    }
  };

  const handleToggleHrRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === "admin_hr" ? "recruiter" : "admin_hr";
      // ✅ Uses PATCH /api/admin/users/:id/hr-role
      await adminFetch(`/api/admin/users/${userId}/hr-role`, {
        method: "PATCH",
        body: JSON.stringify({ hr_role: newRole }),
      });
      fetchData();
    } catch (error: any) {
      console.error("Error toggling HR role:", error);
      alert(error?.message || "Failed to toggle HR role");
    }
  };

  const handleApprovePayment = async (paymentId: string, userId: string) => {
    openSubscriptionModal(userId, paymentId);
  };

  const handleRejectPayment = async (paymentId: string) => {
    try {
      // ✅ Uses PATCH /api/admin/payments/:id
      await adminFetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      fetchData();
    } catch (error: any) {
      console.error("Error rejecting payment:", error);
      alert(error?.message || "Failed to reject payment");
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center dark:text-gray-300">
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
    );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-l border-gray-200 dark:border-gray-700 transition-colors">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isAr ? "لوحة الإدارة" : "Admin Panel"}
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-2 pb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`${activeTab === "overview" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-gray-100"} group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
          >
            <Users className={`${isAr ? "ml-3" : "mr-3"} h-5 w-5`} />
            {isAr ? "إدارة المستخدمين" : "User Management"}
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`${activeTab === "payments" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-gray-100"} group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
          >
            <CreditCard className={`${isAr ? "ml-3" : "mr-3"} h-5 w-5`} />
            {isAr ? "مراجعة المدفوعات" : "Payment Review"}
            {stats.pendingPayments > 0 && (
              <span
                className={`${isAr ? "mr-auto" : "ml-auto"} bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 py-0.5 px-2 rounded-full text-xs`}
              >
                {stats.pendingPayments}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`${activeTab === "analytics" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-gray-100"} group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
          >
            <BarChart2 className={`${isAr ? "ml-3" : "mr-3"} h-5 w-5`} />
            {isAr ? "التحليلات" : "Analytics"}
          </button>
          <button
            onClick={() => {
              setActiveTab("ai-providers");
              setEditingProviderId(null);
              setAiProviderForm({
                name: "",
                base_url: "",
                model: "",
                api_key: "",
                is_active: false,
              });
            }}
            className={`${activeTab === "ai-providers" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-gray-100 dark:hover:text-gray-100"} group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full transition-colors`}
          >
            <Cpu className={`${isAr ? "ml-3" : "mr-3"} h-5 w-5`} />
            {isAr ? "مزوّدو الذكاء الاصطناعي" : "AI Providers"}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {isAr ? "لوحة تحكم الإدارة" : "Admin Dashboard"}
            </h1>
          </div>

          {adminError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-bold">{adminError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg pointer-events-none transition-colors border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="mx-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {isAr ? "إجمالي المستخدمين" : "Total Users"}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {stats.totalUsers}
                  </dd>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg pointer-events-none transition-colors border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex items-center">
                <div className="flex-shrink-0">
                  <Briefcase className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="mx-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {isAr ? "الباحثين عن عمل" : "Job Seekers"}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {stats.totalJobSeekers}
                  </dd>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg pointer-events-none transition-colors border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex items-center">
                <div className="flex-shrink-0">
                  <UserCheck className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="mx-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {isAr ? "حسابات الشركات" : "HR Accounts"}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {stats.totalHR}
                  </dd>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg pointer-events-none transition-colors border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="mx-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {isAr ? "اشتراكات نشطة" : "Active Subscriptions"}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {stats.activeSubscriptions}
                  </dd>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg pointer-events-none transition-colors border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex items-center">
                <div className="flex-shrink-0">
                  <CreditCard className="h-6 w-6 text-yellow-400 dark:text-yellow-500" />
                </div>
                <div className="mx-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {isAr ? "مدفوعات معلقة" : "Pending Payments"}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {stats.pendingPayments}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 transition-colors">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isAr ? "المستخدم" : "User"}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isAr ? "الاتصال" : "Contact"}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isAr ? "الدور" : "Role"}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isAr ? "الاشتراك" : "Subscription"}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-end font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isAr ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {users.map((user) => {
                      const userProfile = user.profiles?.[0] || {};
                      const subscription = user.subscriptions?.[0] || {};
                      const isActive = subscription.status === "active";
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-gray-50 dark:bg-slate-800 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {userProfile.name || "غير محدد"}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {user.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                            {userProfile.phone || "غير محدد"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${user.role === "admin" ? "bg-purple-50 text-purple-700 ring-purple-600/20" : user.role === "hr" ? "bg-blue-50 text-blue-700 ring-blue-600/20" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 ring-gray-500/10"}`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.role === "hr" ? (
                              user.hr_role === "recruiter" ? (
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${user.company_id ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-purple-600/20" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-indigo-600/20"}`}
                                >
                                  {user.company_id
                                    ? isAr
                                      ? "تحت وصاية الشركة"
                                      : "Company Member"
                                    : isAr
                                      ? "حساب شخصي"
                                      : "Personal HR"}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isActive ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-red-50 text-red-700 ring-red-600/20"}`}
                                >
                                  {isActive
                                    ? isAr
                                      ? "نشط"
                                      : "Active"
                                    : isAr
                                      ? "غير نشط"
                                      : "Inactive"}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-end font-medium">
                            {user.role === "hr" && (
                              <button
                                onClick={() =>
                                  handleToggleHrRole(user.id, user.hr_role)
                                }
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 ml-2 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 rounded px-2 py-1 text-sm font-medium transition-colors"
                              >
                                {user.hr_role === "admin_hr"
                                  ? isAr
                                    ? "تعيين كحساب شخصي"
                                    : "Make Personal"
                                  : isAr
                                    ? "ترقية لحساب شركة"
                                    : "Make Company"}
                              </button>
                            )}
                            {user.role === "hr" &&
                              (!user.company_id ||
                                user.hr_role === "admin_hr") &&
                              (isActive ? (
                                <button
                                  onClick={() => openSubscriptionModal(user.id)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-2 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-1 text-sm font-medium transition-colors"
                                >
                                  {isAr ? "تعديل التفعيل" : "Edit Subscription"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => openSubscriptionModal(user.id)}
                                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 ml-2 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 rounded px-2 py-1 text-sm font-medium transition-colors"
                                >
                                  {isAr ? "تفعيل الباقة" : "Activate"}
                                </button>
                              ))}
                            {user.role === "hr" &&
                              (!user.company_id ||
                                user.hr_role === "admin_hr") &&
                              isActive && (
                                <button
                                  onClick={() =>
                                    handleDeactivateSubscription(user.id)
                                  }
                                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 rounded px-2 py-1 text-sm font-medium transition-colors"
                                >
                                  {isAr ? "إلغاء" : "Deactivate"}
                                </button>
                              )}
                            {user.role !== "admin" && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-500 hover:text-red-700 p-1 ml-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors inline-flex align-middle"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="bg-white dark:bg-slate-900 shadow overflow-hidden rounded-xl border border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        التاريخ
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        المستخدم
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        الطريقة
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        الإيصال
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-start font-semibold text-gray-900 dark:text-gray-100"
                      >
                        الحالة
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-4 text-end font-semibold text-gray-900 dark:text-gray-100"
                      >
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white dark:bg-slate-900">
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-base"
                        >
                          لا توجد مدفوعات حالياً
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment) => {
                        return (
                          <tr
                            key={payment.id}
                            className="hover:bg-gray-50 dark:bg-slate-800 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {new Date(
                                payment.created_at,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {payment.users?.profiles?.[0]?.name ||
                                  "Unknown"}
                              </div>
                              <div className="text-gray-500 dark:text-gray-400">
                                {payment.users?.email || "Unknown"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100 font-medium">
                              {payment.method}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-indigo-600 hover:text-indigo-800">
                              {payment.screenshot_url ? (
                                <a
                                  href={payment.screenshot_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  عرض الإيصال
                                </a>
                              ) : (
                                <span className="text-gray-400 no-underline">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                  payment.status === "approved"
                                    ? "bg-green-50 text-green-700 ring-green-600/20"
                                    : payment.status === "rejected"
                                      ? "bg-red-50 text-red-700 ring-red-600/20"
                                      : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                }`}
                              >
                                {payment.status === "approved"
                                  ? "مقبول"
                                  : payment.status === "rejected"
                                    ? "مرفوض"
                                    : "قيد المراجعة"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-end font-medium">
                              {payment.status === "pending" && (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() =>
                                      handleApprovePayment(
                                        payment.id,
                                        payment.user_id,
                                      )
                                    }
                                    className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded px-3 py-1 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                                  >
                                    {isAr ? "موافقة وتفعيل" : "Approve"}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRejectPayment(payment.id)
                                    }
                                    className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded px-3 py-1 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                  >
                                    {isAr ? "رفض" : "Reject"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isAr ? "التحليلات والإحصائيات" : "Analytics & Insights"}
              </h2>
              {analyticsLoading ? (
                <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                  {isAr ? "جاري تحميل البيانات..." : "Loading analytics..."}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* New users per day */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {isAr
                        ? "مستخدمون جدد (آخر 7 أيام)"
                        : "New Users (Last 7 Days)"}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={newUsersData}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11 }}
                          stroke="#9ca3af"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "none",
                            borderRadius: "8px",
                            color: "#f1f5f9",
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                          name={isAr ? "مستخدمون" : "Users"}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Subscription status pie */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {isAr ? "حالة الاشتراكات" : "Subscription Status"}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={subStatusData}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          <Cell fill="#6366f1" />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "none",
                            borderRadius: "8px",
                            color: "#f1f5f9",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top 5 job titles */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm lg:col-span-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {isAr ? "أكثر 5 مسميات وظيفية" : "Top 5 Job Titles"}
                    </h3>
                    {topJobTitles.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                        {isAr
                          ? "لا توجد بيانات كافية بعد."
                          : "Not enough data yet."}
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topJobTitles} layout="vertical">
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                          />
                          <YAxis
                            type="category"
                            dataKey="title"
                            width={130}
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "none",
                              borderRadius: "8px",
                              color: "#f1f5f9",
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#8b5cf6"
                            radius={[0, 4, 4, 0]}
                            name={isAr ? "عدد" : "Count"}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Providers Tab */}
          {activeTab === "ai-providers" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isAr ? "مزوّدو الذكاء الاصطناعي" : "AI Providers"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAr
                  ? "أضف مزوّدي AI متوافقين مع OpenAI API. المزوّد النشط يُستخدم تلقائياً في جميع طلبات /api/ai/proxy. مفتاح الـ API مخزّن على السيرفر فقط ولا يظهر في الواجهة أبداً."
                  : "Add OpenAI-compatible AI providers. The active provider is used automatically for all /api/ai/proxy requests. API keys are stored server-side only and never exposed to the client."}
              </p>

              {/* Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {editingProviderId !== null
                    ? isAr
                      ? "✏️ تعديل مزوّد"
                      : "✏️ Edit Provider"
                    : isAr
                      ? "➕ إضافة مزوّد جديد"
                      : "➕ Add New Provider"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {isAr ? "الاسم" : "Name"}
                    </label>
                    <input
                      value={aiProviderForm.name}
                      onChange={(e) =>
                        setAiProviderForm((p) => ({
                          ...p,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Dahl Kimi K2"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Base URL
                    </label>
                    <input
                      value={aiProviderForm.base_url}
                      onChange={(e) =>
                        setAiProviderForm((p) => ({
                          ...p,
                          base_url: e.target.value,
                        }))
                      }
                      placeholder="https://inference.dahl.global/v1"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Model
                    </label>
                    <input
                      value={aiProviderForm.model}
                      onChange={(e) =>
                        setAiProviderForm((p) => ({
                          ...p,
                          model: e.target.value,
                        }))
                      }
                      placeholder="moonshotai/Kimi-K2.6"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      API Key{" "}
                      {editingProviderId !== null && (
                        <span className="text-gray-400">
                          (اتركه فارغاً للإبقاء على المفتاح الحالي)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={aiProviderForm.api_key}
                        onChange={(e) =>
                          setAiProviderForm((p) => ({
                            ...p,
                            api_key: e.target.value,
                          }))
                        }
                        placeholder={
                          editingProviderId !== null
                            ? "••••••••••••• (unchanged)"
                            : "sk-..."
                        }
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aiProviderForm.is_active}
                      onChange={(e) =>
                        setAiProviderForm((p) => ({
                          ...p,
                          is_active: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {isAr
                        ? "تفعيل (يُعطّل كل المزودين الآخرين)"
                        : "Set as Active (disables all others)"}
                    </span>
                  </label>
                </div>
                {aiProviderMsg && (
                  <p className="mt-3 text-sm font-medium">{aiProviderMsg}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAiProviderSave}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {editingProviderId !== null
                      ? isAr
                        ? "حفظ التعديلات"
                        : "Save Changes"
                      : isAr
                        ? "إضافة مزوّد"
                        : "Add Provider"}
                  </button>
                  {editingProviderId !== null && (
                    <button
                      onClick={() => {
                        setEditingProviderId(null);
                        setAiProviderForm({
                          name: "",
                          base_url: "",
                          model: "",
                          api_key: "",
                          is_active: false,
                        });
                      }}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold transition-colors"
                    >
                      {isAr ? "إلغاء التعديل" : "Cancel Edit"}
                    </button>
                  )}
                </div>
              </div>

              {/* Providers List */}
              {aiProvidersLoading ? (
                <div className="text-center py-10 text-gray-400">
                  {isAr ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : aiProviders.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                  {isAr
                    ? "لا يوجد مزودون بعد. أضف أول مزوّد."
                    : "No providers yet. Add your first provider above."}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-start font-semibold text-gray-900 dark:text-gray-100">
                          {isAr ? "الاسم" : "Name"}
                        </th>
                        <th className="px-4 py-3 text-start font-semibold text-gray-900 dark:text-gray-100">
                          Base URL
                        </th>
                        <th className="px-4 py-3 text-start font-semibold text-gray-900 dark:text-gray-100">
                          Model
                        </th>
                        <th className="px-4 py-3 text-start font-semibold text-gray-900 dark:text-gray-100">
                          API Key
                        </th>
                        <th className="px-4 py-3 text-start font-semibold text-gray-900 dark:text-gray-100">
                          {isAr ? "الحالة" : "Status"}
                        </th>
                        <th className="px-4 py-3 text-end font-semibold text-gray-900 dark:text-gray-100">
                          {isAr ? "إجراءات" : "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {aiProviders.map((p: any) => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono max-w-[200px] truncate">
                            {p.base_url}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono">
                            {p.model}
                          </td>
                          <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">
                            ••••••••••••
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                handleAiProviderToggleActive(p.id, p.is_active)
                              }
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${p.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200"}`}
                            >
                              {p.is_active
                                ? isAr
                                  ? "● نشط"
                                  : "● Active"
                                : isAr
                                  ? "○ غير نشط"
                                  : "○ Inactive"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <button
                              onClick={() => handleAiProviderEdit(p)}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mr-1"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleAiProviderDelete(p.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subscription Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 transition-opacity"
            aria-hidden="true"
            onClick={() => setIsModalOpen(false)}
          >
            <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm"></div>
          </div>

          <div className="relative bg-white dark:bg-slate-800 rounded-lg text-start shadow-2xl transform transition-all sm:my-8 sm:max-w-lg w-full border border-gray-100 dark:border-slate-700 z-[101]">
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-6">
                {isAr
                  ? "تأكيد تفعيل وتعديل الباقة"
                  : "Activate / Edit Subscription Plan"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? "اختر الباقة" : "Select Plan"}
                  </label>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 dark:text-white dark:bg-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600 sm:text-sm transition-colors"
                  >
                    <option value="basic">Basic (100 Views)</option>
                    <option value="pro">Pro (Unlimited Profiles)</option>
                    <option value="premium">Premium (Enterprise Addons)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isAr ? "مدة التفعيل" : "Duration"}
                  </label>
                  <select
                    value={selectedDuration}
                    onChange={(e) =>
                      setSelectedDuration(Number(e.target.value))
                    }
                    className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 dark:text-white dark:bg-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-600 sm:text-sm transition-colors"
                  >
                    <option value={1}>{isAr ? "شهر واحد" : "1 Month"}</option>
                    <option value={6}>{isAr ? "6 شهور" : "6 Months"}</option>
                    <option value={12}>
                      {isAr ? "12 شهر (سنة)" : "12 Months (1 Year)"}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={handleConfirmSubscription}
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
              >
                {isAr ? "تأكيد وحفظ" : "Confirm"}
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
