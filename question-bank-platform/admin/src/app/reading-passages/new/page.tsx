"use client";

import { Sidebar } from "@/components/Sidebar";
import api from "@/lib/axios";
import { Save, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function NewReadingPassagePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: "",
    title: "",
    passageText: "",
    difficulty: "MEDIUM",
    isActive: true,
  });

  const { data: subjectsData } = useSWR("/admin/subjects?limit=50", fetcher);
  const subjects = subjectsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subjectId || !formData.passageText) {
      alert("الرجاء تعبئة الحقول المطلوبة (المادة والنص)");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/admin/reading-passages", formData);
      router.push("/reading-passages");
    } catch (err: any) {
      alert("حدث خطأ: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/reading-passages" className="p-2 hover:bg-slate-200 rounded-full">
              <ArrowRight className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">إضافة قطعة قرائية جديدة</h1>
              <p className="text-slate-500 mt-2">إنشاء نص يمكن ربطه بأسئلة الاستيعاب.</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">المادة *</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">اختر المادة...</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">مستوى الصعوبة</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="EASY">سهل</option>
                  <option value="MEDIUM">متوسط</option>
                  <option value="HARD">صعب</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">العنوان (اختياري)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="مثال: قطعة عن البناء الضوئي"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">النص *</label>
              <textarea
                value={formData.passageText}
                onChange={(e) => setFormData({ ...formData, passageText: e.target.value })}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[200px]"
                placeholder="اكتب نص القطعة القرائية هنا..."
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">القطعة نشطة ومتاحة للاستخدام</label>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? "جاري الحفظ..." : "حفظ القطعة"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
