import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";
import CategoryScores from "../components/CategoryScores";

interface AnalysisDetail {
  id: number; candidate_id: number; full_name: string; email: string;
  vacancy_title: string; total_score: number; vacancy_match: number; growth_potential: string;
  strengths: string[]; weaknesses: string[]; summary: string; status: string;
  category_scores: Record<string, any> | null; manager_comment: string | null;
}

export default function HrReportCandidateAnalysisPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiClient.get(`/hr/candidates/${id}`).then((res) => setAnalysis(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!analysis) return <p className="text-red-500">Абитуриент не найден</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/hr/reports" className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к отчётам</Link>

      <div className="mt-6 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-dark">{analysis.full_name}</h1>
          <p className="text-gray-400 mt-1">{analysis.email} &middot; {analysis.vacancy_title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadFile(`/hr/candidates/${id}/report-pdf`, `candidate_${id}.pdf`).catch(() => alert("Ошибка PDF"))}
            className="bg-dark text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition"
          >
            PDF
          </button>
          <Link to={`/hr/reports/candidate/${id}/dossier`} className="bg-gray-100 text-dark px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition">
            Досье
          </Link>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { value: analysis.total_score, label: "Общий балл", color: analysis.total_score >= 80 ? "text-dark" : analysis.total_score >= 60 ? "text-gray-600" : "text-red-600" },
          { value: `${Math.round(analysis.vacancy_match * 100)}%`, label: "Соответствие", color: "text-dark" },
          { value: analysis.growth_potential, label: "Потенциал", color: "text-dark" },
        ].map((card, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl p-6 text-center">
            <div className={`text-4xl font-extrabold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-2 uppercase tracking-wide font-semibold">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-gray-100 rounded-2xl p-6">
          <h3 className="font-bold text-dark mb-4">Сильные стороны</h3>
          <ul className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-dark font-bold mt-0.5">+</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-gray-100 rounded-2xl p-6">
          <h3 className="font-bold text-dark mb-4">Зоны развития</h3>
          <ul className="space-y-2">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-red-500 font-bold mt-0.5">-</span> {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Explainable AI */}
      <CategoryScores categoryScores={analysis.category_scores} />

      {/* Summary */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-dark mb-2">AI-резюме</h3>
        <p className="text-gray-600 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Manager comment */}
      {analysis.manager_comment && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-dark mb-2">Комментарий комиссии</h3>
          <p className="text-gray-700">{analysis.manager_comment}</p>
        </div>
      )}

      {/* Actions — reports only: view dossier + status badge */}
      <div className="flex gap-4">
        <Link to={`/hr/reports/candidate/${id}/dossier`} className="flex-1 text-center bg-gray-100 text-dark py-3.5 rounded-xl hover:bg-gray-200 font-semibold transition">
          Открыть досье
        </Link>
        <div className={`flex-1 text-center py-3.5 rounded-xl font-medium ${
          analysis.status === "approved" ? "bg-accent text-dark font-bold" :
          analysis.status === "rejected" ? "bg-red-50 text-red-600" :
          analysis.status === "sent_to_manager" ? "bg-dark/5 text-dark" :
          "bg-gray-50 text-gray-500"
        }`}>
          {analysis.status === "approved" ? "Зачислен" :
           analysis.status === "rejected" ? "Отклонён" :
           analysis.status === "sent_to_manager" ? "У комиссии" :
           analysis.status === "analyzed" ? "На рассмотрении" : analysis.status}
        </div>
      </div>
    </div>
  );
}
