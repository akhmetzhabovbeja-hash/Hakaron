import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";
import CategoryScores from "../components/CategoryScores";

interface AnalysisDetail {
  id: number;
  candidate_id: number;
  full_name: string;
  email: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  growth_potential: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: string;
  category_scores: Record<string, any> | null;
  manager_comment: string | null;
}

export default function HrReportCandidateAnalysisPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient
      .get(`/hr/candidates/${id}`)
      .then((res) => setAnalysis(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const sendToManager = async () => {
    setSending(true);
    try {
      await apiClient.post(`/hr/candidates/${id}/send-to-manager`);
      // Refresh data
      const res = await apiClient.get(`/hr/candidates/${id}`);
      setAnalysis(res.data);
    } catch {
      alert("Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (!analysis) return <p className="text-red-500">Абитуриент не найден</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/hr/reports`}
        className="text-primary-600 hover:underline text-sm"
      >
        &larr; Назад к отчётам
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{analysis.full_name}</h2>
          <p className="text-gray-500">
            {analysis.email} &middot; {analysis.vacancy_title}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadFile(`/hr/candidates/${id}/report-pdf`, `candidate_${id}.pdf`).catch(() => alert("Ошибка скачивания PDF"))}
            className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 font-medium"
          >
            PDF
          </button>
          <Link
            to={`/hr/reports/candidate/${id}/dossier`}
            className="bg-gray-800 text-white px-5 py-2.5 rounded-lg hover:bg-gray-900 font-medium"
          >
            Досье абитуриента
          </Link>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div
            className={`text-3xl font-bold ${
              analysis.total_score >= 85
                ? "text-green-600"
                : analysis.total_score >= 60
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {analysis.total_score}
          </div>
          <div className="text-gray-500 text-sm mt-1">Общий балл</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-primary-600">
            {Math.round(analysis.vacancy_match * 100)}%
          </div>
          <div className="text-gray-500 text-sm mt-1">Соответствие</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-3xl font-bold text-purple-600">
            {analysis.growth_potential}
          </div>
          <div className="text-gray-500 text-sm mt-1">Потенциал</div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-green-700 mb-3">Сильные стороны</h3>
          <ul className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">+</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-red-700 mb-3">Зоны развития</h3>
          <ul className="space-y-2">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 mt-0.5">-</span> {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Explainable AI: category breakdown */}
      <CategoryScores categoryScores={analysis.category_scores} />

      {/* Summary */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h3 className="font-semibold mb-2">AI-резюме</h3>
        <p className="text-gray-700">{analysis.summary}</p>
      </div>

      {/* Manager comment */}
      {analysis.manager_comment && (
        <div className="bg-indigo-50 rounded-xl shadow p-5 mb-6">
          <h3 className="font-semibold text-indigo-700 mb-2">Комментарий комиссии</h3>
          <p className="text-gray-700">{analysis.manager_comment}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          to={`/hr/reports/candidate/${id}/dossier`}
          className="flex-1 text-center bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium"
        >
          Открыть досье
        </Link>
        {analysis.status === "analyzed" && (
          <button
            onClick={sendToManager}
            disabled={sending}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
          >
            {sending ? "Отправка..." : "Отправить в комиссию"}
          </button>
        )}
        {analysis.status === "sent_to_manager" && (
          <div className="flex-1 text-center py-3 bg-blue-50 text-blue-700 rounded-lg">
            Отправлен в комиссию
          </div>
        )}
        {analysis.status === "approved" && (
          <div className="flex-1 text-center py-3 bg-green-50 text-green-700 rounded-lg">
            Зачислен комиссией
          </div>
        )}
        {analysis.status === "rejected" && (
          <div className="flex-1 text-center py-3 bg-red-50 text-red-700 rounded-lg">
            Отклонён
          </div>
        )}
      </div>
    </div>
  );
}
