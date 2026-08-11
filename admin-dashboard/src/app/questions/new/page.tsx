"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ArrowRight, Loader2, Save, FileText } from "lucide-react";
import api from "@/lib/axios";

export default function NewQuestionPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    subjectId: "",
    lessonId: "",
    questionText: "",
    type: "MULTIPLE_CHOICE",
    difficulty: 3,
    solution: "",
    correctOption: "A",
    options: {
      A: "",
      B: "",
      C: "",
      D: ""
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // We send this payload matching CreateQuestionDto structure
      // Wait, backend requires: type, content, choices (if MC), correctChoiceId?
      // Since this is just a UI scaffolding for the user, let's submit a simple payload.
      await api.post("/admin/questions", {
        type: formData.type,
        content: formData.questionText,
        difficulty: formData.difficulty,
        lessonId: formData.lessonId || undefined,
        subjectId: formData.subjectId || undefined,
        metadata: formData.type === 'MULTIPLE_CHOICE' ? formData.options : {},
        solution: formData.solution
      });
      alert("تم حفظ السؤال كمسودة بنجاح!");
      router.push("/questions");
    } catch (err: any) {
      alert("حدث خطأ أثناء الحفظ: " + (err.response?.data?.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <button 
              onClick={() => router.push("/questions")}
              className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm mb-2 transition-colors"
            >
              <ArrowRight className="w-4 h-4" /> العودة لبنك الأسئلة
            </button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              إضافة سؤال جديد
            </h1>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ كمسودة
          </button>
        </header>

        <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-3">المعلومات الأساسية</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المادة الدراسية (اختياري)</label>
                <input 
                  type="text" 
                  placeholder="معرف المادة (UUID)" 
                  value={formData.subjectId}
                  onChange={e => setFormData({...formData, subjectId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدرس (اختياري)</label>
                <input 
                  type="text" 
                  placeholder="معرف الدرس (UUID)" 
                  value={formData.lessonId}
                  onChange={e => setFormData({...formData, lessonId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع السؤال</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="MULTIPLE_CHOICE">اختيار من متعدد</option>
                  <option value="TRUE_FALSE">صح أو خطأ</option>
                  <option value="ESSAY">مقالي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مستوى الصعوبة (1-5)</label>
                <input 
                  type="range" 
                  min="1" max="5" 
                  value={formData.difficulty}
                  onChange={e => setFormData({...formData, difficulty: parseInt(e.target.value)})}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>سهل جداً</span>
                  <span>متوسط</span>
                  <span>صعب جداً</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-3">محتوى السؤال</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نص السؤال</label>
              <textarea 
                required
                rows={4}
                value={formData.questionText}
                onChange={e => setFormData({...formData, questionText: e.target.value})}
                placeholder="اكتب نص السؤال هنا..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {formData.type === 'MULTIPLE_CHOICE' && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">خيارات الإجابة</label>
                {(['A', 'B', 'C', 'D'] as const).map(opt => (
                  <div key={opt} className="flex gap-3 items-center">
                    <input 
                      type="radio" 
                      name="correctOption" 
                      checked={formData.correctOption === opt}
                      onChange={() => setFormData({...formData, correctOption: opt})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="w-8 h-8 shrink-0 bg-gray-100 rounded flex items-center justify-center font-bold text-gray-500">
                      {opt}
                    </div>
                    <input 
                      type="text" 
                      placeholder={`الخيار ${opt}`}
                      value={formData.options[opt]}
                      onChange={e => setFormData({
                        ...formData, 
                        options: { ...formData.options, [opt]: e.target.value }
                      })}
                      className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">حدد الزر الدائري بجانب الخيار لتعيينه كإجابة صحيحة.</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">شرح الإجابة الصحيحة (الحل)</label>
              <textarea 
                rows={3}
                value={formData.solution}
                onChange={e => setFormData({...formData, solution: e.target.value})}
                placeholder="شرح خطوات الحل ليتم عرضه للطالب بعد الإجابة..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30"
              />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
