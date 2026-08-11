"use client";

import useSWR from "swr";
import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { 
  Users, BookOpen, BrainCircuit, Activity, Database, AlertCircle, RefreshCw
} from "lucide-react";

const fetcher = (url: string) => api.get(url).then(res => res.data).catch(() => null);

export default function Dashboard() {
  const { data: usersData, isValidating: loadingUsers, mutate: mutateUsers } = useSWR("/admin/users/stats", fetcher);
  const { data: questionsData, isValidating: loadingQuestions, mutate: mutateQuestions } = useSWR("/admin/questions/stats", fetcher);
  const { data: educationData, isValidating: loadingEdu, mutate: mutateEdu } = useSWR("/admin/education/stats", fetcher);
  const { data: attemptsData, isValidating: loadingAttempts, mutate: mutateAttempts } = useSWR("/admin/quiz-attempts/stats", fetcher);
  const { data: aiUsage, isValidating: loadingAIUsage, mutate: mutateAIUsage } = useSWR("/admin/intelligent-services/usage", fetcher);
  const { data: aiCosts, isValidating: loadingAICosts, mutate: mutateAICosts } = useSWR("/admin/intelligent-services/costs", fetcher);
  const { data: platformStatus, isValidating: loadingPlatform, mutate: mutatePlatform } = useSWR("/admin/intelligent-services/readiness", fetcher);

  const handleRefresh = () => {
    mutateUsers();
    mutateQuestions();
    mutateEdu();
    mutateAttempts();
    mutateAIUsage();
    mutateAICosts();
    mutatePlatform();
  };

  const MetricCard = ({ title, value, icon: Icon, colorClass, suffix = "" }: any) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
      <div>
        <h3 className="text-slate-500 font-medium text-sm mb-2">{title}</h3>
        <p className={`text-2xl font-bold ${colorClass}`}>
          {value === null || value === undefined ? (
            <span className="text-sm font-normal text-slate-400">NOT_AVAILABLE</span>
          ) : (
            <span>{typeof value === 'number' ? value.toLocaleString("en-US") : value}{suffix}</span>
          )}
        </p>
      </div>
      <div className={`p-3 rounded-lg ${colorClass.replace("text-", "bg-").replace("600", "50")}`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">نظرة عامة على المنصة</h1>
            <p className="text-slate-500 mt-2">بيانات تشغيل حية للمشرفين فقط.</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${(loadingUsers || loadingQuestions || loadingPlatform) ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </button>
        </header>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> المستخدمون والتفاعل
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="إجمالي المستخدمين" value={usersData?.total} icon={Users} colorClass="text-blue-600" />
            <MetricCard title="المستخدمون النشطون (اليوم)" value={usersData?.activeToday} icon={Activity} colorClass="text-emerald-600" />
            <MetricCard title="المستخدمون الجدد" value={usersData?.newToday} icon={Users} colorClass="text-indigo-600" />
            <MetricCard title="المحاولات المكتملة" value={attemptsData?.completed} icon={BookOpen} colorClass="text-violet-600" />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-600" /> المحتوى التعليمي
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="إجمالي الأسئلة" value={questionsData?.total} icon={Database} colorClass="text-orange-600" />
            <MetricCard title="الأسئلة النشطة" value={questionsData?.active} icon={CheckCircleIcon} colorClass="text-emerald-600" />
            <MetricCard title="الأسئلة غير النشطة" value={questionsData?.inactive} icon={AlertCircle} colorClass="text-rose-600" />
            <MetricCard title="المواد / الوحدات / الدروس" value={educationData ? `${educationData.subjects} / ${educationData.units} / ${educationData.lessons}` : null} icon={BookOpen} colorClass="text-slate-700" />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-600" /> الذكاء الاصطناعي والاستخدام
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="طلبات AI اليوم" value={aiUsage?.dailyRequests} icon={BrainCircuit} colorClass="text-purple-600" />
            <MetricCard title="الصور المحللة" value={aiUsage?.dailyImages} icon={BrainCircuit} colorClass="text-indigo-600" />
            <MetricCard title="Embedding Calls" value={aiUsage?.dailyEmbeddings} icon={Database} colorClass="text-cyan-600" />
            <MetricCard title="تكلفة اليوم" value={aiCosts?.dailyCost} icon={Activity} colorClass="text-emerald-600" suffix=" $" />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-700" /> حالة المنصة والنظام
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium text-sm mb-4">حالة النظام الشاملة</h3>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${platformStatus?.status === 'READY' ? 'bg-emerald-500' : platformStatus?.status === 'DEGRADED' ? 'bg-amber-500' : platformStatus?.status ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                <span className="font-bold text-lg">{platformStatus?.status || 'NOT_AVAILABLE'}</span>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium text-sm mb-4">المزودون (Providers)</h3>
              <p className="font-bold text-lg">
                {platformStatus?.providers ? `${platformStatus.providers.healthy} / ${platformStatus.providers.enabled} متاح` : 'NOT_AVAILABLE'}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium text-sm mb-4">طابور المهام (Queue)</h3>
              <p className="font-bold text-lg text-rose-600">
                {platformStatus?.queue?.failed !== undefined ? `${platformStatus.queue.failed} مهام فاشلة` : 'NOT_AVAILABLE'}
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

function CheckCircleIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}