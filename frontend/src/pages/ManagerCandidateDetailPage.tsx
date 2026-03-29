import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../api/client";

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
}

export default function ManagerCandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    apiClient
      .get(`/manager/candidates/${id}/analysis`)
      .then((res) => setAnalysis(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: "approve" | "reject") => {
    setActing(true);
    try {
      await apiClient.post(`/manager/candidates/${id}/${action}`);
      navigate("/manager");
    } catch {
      alert("Ошибка");
    } finally {
      setActing(false);
    }
  };

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (!analysis) return <p className="text-red-500">Абитуриент не найден</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/manager"
        className="text-primary-600 hover:underline text-sm"
      >
        &larr; Назад к списку
      </Link>

      <h2 className="text-3xl font-bold mt-4 mb-2">{analysis.full_name}</h2>
      <p className="text-gray-500 mb-6">
        {analysis.email} &middot; {analysis.vacancy_title}
      </p>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div
            className={`text-4xl font-bold ${
              analysis.total_score >= 85
                ? "text-green-600"
                : analysis.total_score >= 60
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {analysis.total_score}
          </div>
          <div className="text-gray-500 mt-1">Общий балл</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl font-bold text-primary-600">
            {Math.round(analysis.vacancy_match * 100)}%
          </div>
          <div className="text-gray-500 mt-1">Соответствие вакансии</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl font-bold text-purple-600">
            {analysis.growth_potential}
          </div>
          <div className="text-gray-500 mt-1">Потенциал роста</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-3">
            Сильные стороны
          </h3>
          <ul className="space-y-2 text-gray-700">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-500 mt-1">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-3">
            Зоны развития
          </h3>
          <ul className="space-y-2 text-gray-700">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-1">-</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-3">AI-резюме</h3>
        <p className="text-gray-700">{analysis.summary}</p>
      </div>

      {analysis.status === "sent_to_manager" && (
        <div className="flex gap-4">
          <button
            onClick={() => handleAction("approve")}
            disabled={acting}
            className="flex-1 bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 text-lg disabled:opacity-50"
          >
            Зачислить
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={acting}
            className="flex-1 bg-red-100 text-red-600 px-8 py-3 rounded-lg hover:bg-red-200 text-lg disabled:opacity-50"
          >
            Отказать
          </button>
        </div>
      )}
      {analysis.status === "approved" && (
        <div className="text-center py-3 bg-green-50 text-green-700 rounded-lg text-lg">
          Абитуриент зачислен
        </div>
      )}
      {analysis.status === "rejected" && (
        <div className="text-center py-3 bg-red-50 text-red-700 rounded-lg text-lg">
          Абитуриент не прошёл отбор
        </div>
      )}
    </div>
  );
}
