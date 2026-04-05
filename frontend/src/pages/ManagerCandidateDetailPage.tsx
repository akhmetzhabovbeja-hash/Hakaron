import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../api/client";
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

export default function ManagerCandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [comment, setComment] = useState("");

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
      await apiClient.post(`/manager/candidates/${id}/${action}`, { comment });
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
        className="text-gray-400 hover:text-dark text-sm transition"
      >
        &larr; Назад к списку
      </Link>

      <div className="flex items-start justify-between mt-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold">{analysis.full_name}</h2>
          <p className="text-gray-500">{analysis.email} &middot; {analysis.vacancy_title}</p>
        </div>
        <Link
          to={`/manager/candidate/${id}/dossier`}
          className="bg-gray-100 text-dark px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition"
        >
          Досье
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="border border-gray-100 rounded-2xl p-6 text-center">
          <div
            className={`text-4xl font-bold ${
              analysis.total_score >= 80
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
        <div className="border border-gray-100 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-dark">
            {Math.round(analysis.vacancy_match * 100)}%
          </div>
          <div className="text-gray-500 mt-1">Соответствие</div>
        </div>
        <div className="border border-gray-100 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-purple-600">
            {analysis.growth_potential}
          </div>
          <div className="text-gray-500 mt-1">Потенциал</div>
        </div>
      </div>

      {/* Explainable AI: category breakdown */}
      <CategoryScores categoryScores={analysis.category_scores} />

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border border-gray-100 rounded-2xl p-6">
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
        <div className="border border-gray-100 rounded-2xl p-6">
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

      <div className="border border-gray-100 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">AI-резюме</h3>
        <p className="text-gray-700">{analysis.summary}</p>
      </div>

      {/* Manager comment + actions */}
      {analysis.status === "sent_to_manager" && (
        <div className="border border-gray-100 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3">Комментарий комиссии</h3>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Оставьте комментарий для HR и абитуриента (необязательно)..."
            className="w-full border rounded-lg px-4 py-3 h-24 focus:ring-2 focus:ring-dark mb-4"
          />
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
        </div>
      )}

      {/* Show existing comment + status */}
      {(analysis.status === "approved" || analysis.status === "rejected") && (
        <div className={`rounded-xl shadow p-6 mb-6 ${
          analysis.status === "approved" ? "bg-green-50" : "bg-red-50"
        }`}>
          <div className={`text-center text-lg font-medium ${
            analysis.status === "approved" ? "text-green-700" : "text-red-700"
          }`}>
            {analysis.status === "approved" ? "Абитуриент зачислен" : "Абитуриент не прошёл отбор"}
          </div>
          {analysis.manager_comment && (
            <div className="mt-3 p-3 bg-white rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Комментарий комиссии:</p>
              <p className="text-gray-700">{analysis.manager_comment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
