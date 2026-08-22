"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import {
  BrainCircuit,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Server,
  Cpu,
  RotateCcw,
  Search,
  Users,
  ShieldAlert,
  Info,
  Key,
  RefreshCw,
  Zap,
  Activity,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/axios";

type Provider = {
  id: string;
  key: string;
  displayNameInternal: string;
  providerType: string;
  baseUrl: string;
  enabled: boolean;
  apiKeyConfigured?: boolean;
  secretLastFour?: string;
};

type CatalogModel = {
  id: string;
  name: string;
  publisher?: string;
  isFree?: boolean;
  contextWindow?: number;
  description?: string;
};

type AssistantSettings = {
  id: string;
  enabled: boolean;
  providerId?: string | null;
  modelId?: string | null;
  fallbackModelId?: string | null;
  userMessageLimit: number;
  resetPeriod: "DAILY" | "WEEKLY" | "MONTHLY" | "NEVER";
  limitMessage: string;
  updatedAt?: string;
};

type UserUsageItem = {
  id: string;
  name: string;
  email?: string;
  username: string;
  role: string;
  used: number;
  limit: number;
  remaining: number | null;
  periodKey: string;
  resetPeriod: string;
  resetAt?: string | null;
  lastUsedAt?: string | null;
};

export default function AssistantSettingsPage() {
  const {
    data: settingsRes,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR("/admin/intelligent-services/assistant-settings", (url) =>
    api.get(url)
  );

  const { data: providersRes, mutate: mutateProviders } = useSWR(
    "/admin/intelligent-services/providers",
    (url) => api.get(url)
  );
  const providers: Provider[] = providersRes?.data || [];

  const { data: nvidiaConfigRes, mutate: mutateNvidiaConfig } = useSWR(
    "/admin/intelligent-services/nvidia/config",
    (url) => api.get(url)
  );
  const nvidiaConfig = nvidiaConfigRes?.data;

  const { data: nvidiaModelsRes, mutate: mutateNvidiaModels, isLoading: modelsLoading } = useSWR(
    "/admin/intelligent-services/nvidia/models",
    (url) => api.get(url)
  );
  const catalogModels: CatalogModel[] = nvidiaModelsRes?.data?.models || [];

  // Form State
  const [formData, setFormData] = useState<AssistantSettings>({
    id: "default",
    enabled: false,
    providerId: "",
    modelId: "meta/llama-3.3-70b-instruct",
    fallbackModelId: "deepseek-ai/deepseek-r1",
    userMessageLimit: 20,
    resetPeriod: "DAILY",
    limitMessage: "لقد وصلت إلى الحد المسموح للمساعد الذكي.",
  });

  // Custom Model Text input state
  const [customPrimaryModel, setCustomPrimaryModel] = useState("");
  const [isCustomPrimary, setIsCustomPrimary] = useState(false);
  const [customFallbackModel, setCustomFallbackModel] = useState("");
  const [isCustomFallback, setIsCustomFallback] = useState(false);

  // NVIDIA API Key state
  const [nvidiaApiKeyInput, setNvidiaApiKeyInput] = useState("");
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Test states
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    target: string;
    status: string;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // User Usage State
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data: usageRes, isLoading: usageLoading } = useSWR(
    `/admin/intelligent-services/user-usage?search=${encodeURIComponent(
      searchQuery
    )}&page=${page}&limit=10`,
    (url) => api.get(url)
  );
  const usageData = usageRes?.data;
  const usageItems: UserUsageItem[] = usageData?.items || [];

  useEffect(() => {
    if (settingsRes?.data) {
      const s = settingsRes.data;
      const currentModel = s.modelId || "meta/llama-3.3-70b-instruct";
      const currentFallback = s.fallbackModelId || "deepseek-ai/deepseek-r1";

      setFormData({
        id: "default",
        enabled: Boolean(s.enabled),
        providerId: s.providerId || nvidiaConfig?.providerId || "",
        modelId: currentModel,
        fallbackModelId: currentFallback,
        userMessageLimit: Number(s.userMessageLimit ?? 20),
        resetPeriod: s.resetPeriod || "DAILY",
        limitMessage:
          s.limitMessage || "لقد وصلت إلى الحد المسموح للمساعد الذكي.",
      });

      // Check if current models are custom
      if (
        catalogModels.length > 0 &&
        !catalogModels.some((m) => m.id === currentModel)
      ) {
        setIsCustomPrimary(true);
        setCustomPrimaryModel(currentModel);
      }
      if (
        catalogModels.length > 0 &&
        currentFallback &&
        !catalogModels.some((m) => m.id === currentFallback)
      ) {
        setIsCustomFallback(true);
        setCustomFallbackModel(currentFallback);
      }
    }
  }, [settingsRes, nvidiaConfig, catalogModels.length]);

  const selectedProvider = providers.find((p) => p.id === formData.providerId);
  const isNvidiaSelected =
    selectedProvider?.providerType === "NVIDIA" ||
    selectedProvider?.key === "nvidia" ||
    (!formData.providerId && nvidiaConfig);

  const handleSaveApiKey = async () => {
    if (!nvidiaApiKeyInput.trim()) return;
    setIsSavingKey(true);
    setFeedback(null);
    try {
      await api.patch("/admin/intelligent-services/nvidia/config", {
        apiKey: nvidiaApiKeyInput.trim(),
        enabled: true,
      });
      setNvidiaApiKeyInput("");
      setShowApiKeyInput(false);
      await mutateNvidiaConfig();
      await mutateProviders();
      setFeedback({
        type: "success",
        message: "تم حفظ وتشفير مفتاح NVIDIA API بنجاح في قاعدة البيانات!",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || "فشل حفظ مفتاح NVIDIA API. تأكد من صحة المدخلات.",
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!confirm("هل أنت متأكد من حذف مفتاح NVIDIA API؟")) return;
    setIsSavingKey(true);
    try {
      await api.patch("/admin/intelligent-services/nvidia/config", {
        removeApiKey: true,
      });
      await mutateNvidiaConfig();
      await mutateProviders();
      setFeedback({
        type: "success",
        message: "تم حذف مفتاح NVIDIA API بنجاح.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: "فشل حذف المفتاح.",
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestModel = async (target: "primary" | "fallback" | "connection") => {
    const modelToTest =
      target === "fallback"
        ? isCustomFallback
          ? customFallbackModel
          : formData.fallbackModelId
        : isCustomPrimary
        ? customPrimaryModel
        : formData.modelId || "meta/llama-3.3-70b-instruct";

    if (!modelToTest) {
      setTestResult({
        target,
        status: "Unavailable",
        message: "يرجى اختيار أو كتابة معرف النموذج أولاً.",
      });
      return;
    }

    setTestingModel(target);
    setTestResult(null);

    try {
      const res = await api.post("/admin/intelligent-services/nvidia/test-model", {
        modelId: modelToTest,
      });
      setTestResult({
        target,
        status: res.data?.data?.status || "Working",
        message: res.data?.data?.message || "النموذج يعمل بنجاح!",
        latencyMs: res.data?.data?.latencyMs,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      setTestResult({
        target,
        status: data?.code === "UNAUTHORIZED" ? "Unauthorized" : "Unavailable",
        message:
          data?.message ||
          "فشل الاتصال بالنموذج. تأكد من صحة مفتاح NVIDIA API والاتصال بالإنترنت.",
      });
    } finally {
      setTestingModel(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const actualPrimary = isCustomPrimary
      ? customPrimaryModel.trim()
      : formData.modelId;
    const actualFallback = isCustomFallback
      ? customFallbackModel.trim()
      : formData.fallbackModelId;

    try {
      await api.patch("/admin/intelligent-services/assistant-settings", {
        enabled: formData.enabled,
        providerId: formData.providerId || nvidiaConfig?.providerId || null,
        modelId: actualPrimary || null,
        fallbackModelId: actualFallback || null,
        userMessageLimit: Number(formData.userMessageLimit),
        resetPeriod: formData.resetPeriod,
        limitMessage: formData.limitMessage.trim(),
      });
      await mutateSettings();
      await mutateProviders();
      setFeedback({
        type: "success",
        message: "تم حفظ إعدادات المساعد الذكي والنموذج بنجاح!",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          "حدث خطأ أثناء حفظ الإعدادات. يرجى التحقق من المدخلات.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const periodLabel = (period: string) => {
    switch (period) {
      case "DAILY":
        return "يوميًا (DAILY)";
      case "WEEKLY":
        return "أسبوعيًا (WEEKLY)";
      case "MONTHLY":
        return "شهريًا (MONTHLY)";
      case "NEVER":
        return "بدون تجديد تلقائي (NEVER)";
      default:
        return period;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black text-gray-900">
                    مساعد الذكاء الاصطناعي (NVIDIA NIM)
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    NVIDIA Hosted API
                  </span>
                </div>
                <p className="text-gray-500 mt-1 text-sm">
                  ربط وتكوين واجهة NVIDIA NIM Hosted API السحابية لتقديم المساعد التعليمي الذكي للطلاب.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${
                formData.enabled
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  formData.enabled ? "bg-green-600 animate-pulse" : "bg-red-600"
                }`}
              />
              {formData.enabled ? "المساعد مفعّل للطلاب" : "المساعد معطّل"}
            </span>
          </div>
        </header>

        {settingsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          </div>
        ) : settingsError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold">فشل في تحميل إعدادات المساعد الذكي</p>
              <p className="text-sm mt-1">تأكد من تشغيل الخادم واتصال قاعدة البيانات.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Feedback Alert */}
            {feedback && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  feedback.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                )}
                <span className="font-medium text-sm">{feedback.message}</span>
              </div>
            )}

            {/* 1. NVIDIA API Credentials Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-900 to-emerald-950 text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                      اعتماد ومفتاح NVIDIA API Catalog
                    </h2>
                    <p className="text-gray-300 text-xs mt-0.5">
                      Endpoint: <code className="text-emerald-400 font-mono">https://integrate.api.nvidia.com/v1</code> (مشفر في قاعدة البيانات)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {nvidiaConfig?.apiKeyConfigured ? (
                    <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      متصل ومشفّر (••• {nvidiaConfig.secretLastFour || "****"})
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/30 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      بانتظار إدخال API Key
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                {!showApiKeyInput && nvidiaConfig?.apiKeyConfigured ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          مفتاح NVIDIA API محفوظ بشكل آمن ومشفّر (AES-256)
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ينتهي بـ <span className="font-mono font-bold text-emerald-700">••••••••{nvidiaConfig.secretLastFour || "****"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowApiKeyInput(true)}
                        className="px-4 py-2 text-xs font-bold bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-gray-700 transition"
                      >
                        تغيير المفتاح
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveApiKey}
                        disabled={isSavingKey}
                        className="px-3 py-2 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
                    <label className="block text-sm font-bold text-gray-800">
                      أدخل مفتاح NVIDIA API Key:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={nvidiaApiKeyInput}
                        onChange={(e) => setNvidiaApiKeyInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      />
                      <button
                        type="button"
                        onClick={handleSaveApiKey}
                        disabled={isSavingKey || !nvidiaApiKeyInput.trim()}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                      >
                        {isSavingKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        حفظ وتشفير المفتاح
                      </button>
                      {showApiKeyInput && (
                        <button
                          type="button"
                          onClick={() => setShowApiKeyInput(false)}
                          className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold rounded-xl transition"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      يمكنك توليد المفتاح مجانًا من <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline inline-flex items-center gap-0.5">NVIDIA API Catalog <ExternalLink className="w-3 h-3" /></a>.
                    </p>
                  </div>
                )}

                {/* Test Connection Button & Indicator */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleTestModel("connection")}
                    disabled={testingModel === "connection" || !nvidiaConfig?.apiKeyConfigured}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-40"
                  >
                    {testingModel === "connection" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    اختبار الاتصال السحابي بـ NVIDIA API
                  </button>

                  {testResult?.target === "connection" && (
                    <div
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                        testResult.status === "Working"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {testResult.status === "Working" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {testResult.message}
                      {testResult.latencyMs && (
                        <span className="font-mono text-[10px] opacity-75">
                          ({testResult.latencyMs}ms)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Main AI Settings & Model Selection Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-emerald-50/40 p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-600" />
                    تحديد النماذج والتحكم التشغيلي
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    اختر النموذج الأساسي ونموذج الطوارئ الاحتياطي للرد على أسئلة الطلاب بدقة باللغة العربية.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => mutateNvidiaModels()}
                  disabled={modelsLoading}
                  className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${modelsLoading ? "animate-spin" : ""}`} />
                  تحديث قائمة النماذج
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                {/* Enable Assistant Switch */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="space-y-1">
                    <label
                      htmlFor="ai-enable-switch"
                      className="font-bold text-gray-900 text-sm cursor-pointer"
                    >
                      تفعيل المساعد الذكي للطلاب (ON / OFF)
                    </label>
                    <p className="text-xs text-gray-500">
                      عند التفعيل، يستطيع الطلاب طرح الأسئلة، وطلب التلميحات والشروحات عبر تطبيق الموبايل.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="ai-enable-switch"
                      checked={formData.enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Provider Selector */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    المزوّد الأساسي (AI Provider)
                  </label>
                  <select
                    value={formData.providerId || nvidiaConfig?.providerId || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, providerId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayNameInternal} ({p.providerType}) {p.key === "nvidia" ? "★ الموصى به" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary & Fallback Model Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Primary Model */}
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        النموذج الأساسي (Primary Model)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomPrimary(!isCustomPrimary)}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        {isCustomPrimary ? "اختيار من القائمة" : "+ إدخال ID مخصص"}
                      </button>
                    </div>

                    {isCustomPrimary ? (
                      <input
                        type="text"
                        placeholder="e.g. meta/llama-3.3-70b-instruct"
                        value={customPrimaryModel}
                        onChange={(e) => setCustomPrimaryModel(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    ) : (
                      <select
                        value={formData.modelId || "meta/llama-3.3-70b-instruct"}
                        onChange={(e) =>
                          setFormData({ ...formData, modelId: e.target.value })
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      >
                        {catalogModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id}) {m.isFree ? " • [Free ✓]" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleTestModel("primary")}
                        disabled={testingModel === "primary" || !nvidiaConfig?.apiKeyConfigured}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-40"
                      >
                        {testingModel === "primary" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        اختبار النموذج الأساسي
                      </button>

                      {testResult?.target === "primary" && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded font-bold ${
                            testResult.status === "Working"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {testResult.status} {testResult.latencyMs ? `(${testResult.latencyMs}ms)` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fallback Model */}
                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-blue-500" />
                        النموذج الاحتياطي (Fallback Model)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomFallback(!isCustomFallback)}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        {isCustomFallback ? "اختيار من القائمة" : "+ إدخال ID مخصص"}
                      </button>
                    </div>

                    {isCustomFallback ? (
                      <input
                        type="text"
                        placeholder="e.g. deepseek-ai/deepseek-r1"
                        value={customFallbackModel}
                        onChange={(e) => setCustomFallbackModel(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    ) : (
                      <select
                        value={formData.fallbackModelId || "deepseek-ai/deepseek-r1"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fallbackModelId: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      >
                        <option value="">-- بدون نموذج احتياطي --</option>
                        {catalogModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id}) {m.isFree ? " • [Free ✓]" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleTestModel("fallback")}
                        disabled={testingModel === "fallback" || !nvidiaConfig?.apiKeyConfigured}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition disabled:opacity-40"
                      >
                        {testingModel === "fallback" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        اختبار النموذج الاحتياطي
                      </button>

                      {testResult?.target === "fallback" && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded font-bold ${
                            testResult.status === "Working"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {testResult.status} {testResult.latencyMs ? `(${testResult.latencyMs}ms)` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* 3. User Message Quotas */}
                <div>
                  <h3 className="font-bold text-gray-900 text-md mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                    حدود استخدام رسائل الذكاء الاصطناعي لكل مستخدم
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        الحد لكل مستخدم
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.userMessageLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            userMessageLimit: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      />
                      <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        أدخل <strong>0</strong> للاستخدام غير المحدود (Unlimited).
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        إعادة التعيين (Reset Period)
                      </label>
                      <select
                        value={formData.resetPeriod}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            resetPeriod: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      >
                        <option value="DAILY">يوميًا (DAILY - يتجدد كل منتصف ليل UTC)</option>
                        <option value="WEEKLY">أسبوعيًا (WEEKLY - يتجدد كل بداية أسبوع)</option>
                        <option value="MONTHLY">شهريًا (MONTHLY - يتجدد أول كل شهر)</option>
                        <option value="NEVER">بدون تجديد (NEVER - رصيد دائم)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1.5">
                        الفترة الزمنية لتصفير عداد استهلاك الطالب.
                      </p>
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        رسالة انتهاء الحد
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.limitMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            limitMessage: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">
                        الرسالة المعروضة للطالب عند استهلاك كامل الحصة المتاحة.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    حفظ التعديلات المركزية
                  </button>
                </div>
              </form>
            </div>

            {/* 3. User Consumption Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    استهلاك الطلاب الفعلي ({periodLabel(formData.resetPeriod)})
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    متابعة حية لاستهلاك الطلاب للحصة المحددة للمساعد الذكي.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-gray-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو البريد..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full ps-9 pe-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {usageLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : usageItems.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium">لم يتم العثور على مستخدمين مطابقين للبحث.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-4">المستخدم</th>
                        <th className="p-4">البريد / المعرف</th>
                        <th className="p-4">الدور</th>
                        <th className="p-4">المستهلك</th>
                        <th className="p-4">الحد المسموح</th>
                        <th className="p-4">المتبقي</th>
                        <th className="p-4">حالة الحصة</th>
                        <th className="p-4">آخر نشاط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usageItems.map((u) => {
                        const isExhausted = u.limit > 0 && u.used >= u.limit;
                        const isUnlimited = u.limit === 0;

                        return (
                          <tr key={u.id} className="hover:bg-gray-50/80 transition">
                            <td className="p-4 font-bold text-gray-900">{u.name}</td>
                            <td className="p-4 text-gray-600 font-mono text-xs">
                              {u.email || `@${u.username}`}
                            </td>
                            <td className="p-4">
                              <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-emerald-600 font-mono">
                              {u.used}
                            </td>
                            <td className="p-4 text-gray-700 font-mono">
                              {isUnlimited ? "غير محدود" : u.limit}
                            </td>
                            <td className="p-4 font-bold font-mono">
                              {isUnlimited ? (
                                <span className="text-emerald-600">∞</span>
                              ) : isExhausted ? (
                                <span className="text-red-600">0</span>
                              ) : (
                                <span className="text-emerald-600">{u.remaining}</span>
                              )}
                            </td>
                            <td className="p-4">
                              {isUnlimited ? (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold">
                                  غير محدود
                                </span>
                              ) : isExhausted ? (
                                <span className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-bold">
                                  تم بلوغ الحد
                                </span>
                              ) : (
                                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                                  نشط
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-gray-400 text-xs">
                              {u.lastUsedAt
                                ? new Date(u.lastUsedAt).toLocaleString("ar-EG")
                                : "لا يوجد استخدام"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {usageData?.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        عرض الصفحة {usageData.page} من {usageData.totalPages} (إجمالي{" "}
                        {usageData.total} مستخدم)
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          السابق
                        </button>
                        <button
                          disabled={page >= usageData.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                        >
                          التالي
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
