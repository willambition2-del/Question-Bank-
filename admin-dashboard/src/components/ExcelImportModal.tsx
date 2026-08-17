"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Layers,
  BookOpen,
} from "lucide-react";

export type GradeLevel = "THIRD_SECONDARY" | "NINTH";

interface Subject {
  id: string;
  name: string;
  grade?: {
    code?: string;
  };
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialGrade?: GradeLevel;
}

export function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialGrade = "THIRD_SECONDARY",
}: ExcelImportModalProps) {
  const [grade, setGrade] = useState<GradeLevel>(initialGrade);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGrade(initialGrade);
      setFile(null);
      setPreviewData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      loadSubjects();
    }
  }, [isOpen, initialGrade]);

  async function loadSubjects() {
    setLoadingSubjects(true);
    try {
      const res = await api.get("/admin/education/subjects");
      const list: Subject[] = res.data?.data || res.data || [];
      setSubjects(list);
      if (list.length > 0) {
        setSelectedSubjectId(list[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load subjects", err);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/admin/question-imports/templates/questions", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "قالب_استيراد_الأسئلة.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert("حدث خطأ أثناء تحميل القالب");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setErrorMsg(null);
    setPreviewData(null);

    // Auto-trigger preview
    await generatePreview(selected);
  }

  async function generatePreview(fileToPreview: File) {
    if (!selectedSubjectId) {
      setErrorMsg("يرجى اختيار المادة الدراسية أولاً");
      return;
    }

    setPreviewing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", fileToPreview);
      formData.append("gradeLevel", grade);
      formData.append("subjectId", selectedSubjectId);

      const res = await api.post("/admin/question-imports/excel/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPreviewData(res.data?.data || res.data);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message ||
          "فشل فحص ومعاينة ملف Excel. يرجى التأكد من تطابق المادة والصف وتنسيق الأعمدة."
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!previewData || previewData.validRowsCount === 0) return;

    setConfirming(true);
    setErrorMsg(null);

    try {
      const res = await api.post("/admin/question-imports/excel/confirm", {
        preview: previewData,
      });

      setSuccessMsg(
        `تم استيراد ${res.data?.data?.importedCount || previewData.validRowsCount} سؤالاً بنجاح للمادة: ${previewData.subjectName}!`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "حدث خطأ أثناء إتمام عملية الاستيراد");
    } finally {
      setConfirming(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">استيراد أسئلة عبر Excel (.xlsx)</h2>
              <p className="text-xs text-gray-500 mt-0.5">رفع، معاينة فورية، والتحقق الآمن من جودة الأسئلة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Controls: Grade & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                الصف الدراسي المستهدف *
              </label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value as GradeLevel);
                  setPreviewData(null);
                }}
                className="w-full text-sm font-medium border border-gray-300 rounded-xl p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              >
                <option value="THIRD_SECONDARY">الثالث الثانوي</option>
                <option value="NINTH">الصف التاسع</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                المادة الدراسية *
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setPreviewData(null);
                }}
                disabled={loadingSubjects}
                className="w-full text-sm font-medium border border-gray-300 rounded-xl p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Download Template Banner */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-blue-900">هل تحتاج قالب Excel جاهز؟</h4>
                <p className="text-xs text-blue-700 mt-0.5">حمّل القالب المعتمد مع أمثلة الاختيار من متعدد والصح والخطأ.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={downloadingTemplate}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 shadow-sm flex items-center gap-2 flex-shrink-0 transition-all"
            >
              {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              تحميل القالب (.xlsx)
            </button>
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">اختر ملف Excel (.xlsx / .xls)</label>
            <div className="relative border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50/50 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-700">
                {file ? file.name : "انقر لاختيار ملف Excel أو اسحبه وأفلته هنا"}
              </p>
              <p className="text-xs text-gray-400 mt-1">يدعم ملفات Microsoft Excel حتى 10 ميجابايت</p>
            </div>
          </div>

          {/* Error / Success Alerts */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Preview State Loader */}
          {previewing && (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-gray-600">جارٍ قراءة وفحص بنية ملف Excel والتحقق من العلاقات...</p>
            </div>
          )}

          {/* Validation & Preview Result */}
          {previewData && !previewing && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <span className="block text-xs font-semibold text-gray-500">إجمالي الصفوف</span>
                  <span className="text-xl font-bold text-gray-900">{previewData.totalRows}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="block text-xs font-semibold text-emerald-600">الأسئلة الصالحة</span>
                  <span className="text-xl font-bold text-emerald-700">{previewData.validRowsCount}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <span className="block text-xs font-semibold text-amber-600">الصفوف المعطوبة</span>
                  <span className="text-xl font-bold text-amber-700">{previewData.invalidRowsCount}</span>
                </div>
              </div>

              {/* Rows List / Error Grid */}
              <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
                {previewData.rows.slice(0, 50).map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 flex items-start gap-2.5 ${
                      r.isValid ? "bg-white" : "bg-red-50/50"
                    }`}
                  >
                    {r.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-800">
                          سطر {r.rowNumber}: {r.questionText.slice(0, 60)}...
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
                          {r.type === "TRUE_FALSE" ? "صح وخطأ" : "اختيار من متعدد"}
                        </span>
                      </div>

                      {r.errors?.length > 0 && (
                        <div className="mt-1 text-red-600 font-medium space-y-0.5">
                          {r.errors.map((e: string, eIdx: number) => (
                            <p key={eIdx}>• {e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!previewData || previewData.validRowsCount === 0 || confirming}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
          >
            {confirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جارٍ الاستيراد الآمن...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                تأكيد واستيراد ({previewData?.validRowsCount || 0}) سؤال
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}