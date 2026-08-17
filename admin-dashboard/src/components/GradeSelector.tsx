"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

export type GradeLevel = "THIRD_SECONDARY" | "NINTH";

interface GradeSelectorProps {
  selectedGrade: GradeLevel;
  onGradeChange: (grade: GradeLevel) => void;
  className?: string;
}

export function GradeSelector({
  selectedGrade,
  onGradeChange,
  className = "",
}: GradeSelectorProps) {
  return (
    <div className={`inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner ${className}`} dir="rtl">
      <button
        type="button"
        onClick={() => onGradeChange("THIRD_SECONDARY")}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
          selectedGrade === "THIRD_SECONDARY"
            ? "bg-white text-blue-700 shadow-sm border border-gray-200/60"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <GraduationCap className="w-4 h-4" />
        الثالث الثانوي
      </button>

      <button
        type="button"
        onClick={() => onGradeChange("NINTH")}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
          selectedGrade === "NINTH"
            ? "bg-white text-emerald-700 shadow-sm border border-gray-200/60"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        <GraduationCap className="w-4 h-4" />
        الصف التاسع
      </button>
    </div>
  );
}