import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";
import CategoryScores from "../components/CategoryScores";

interface AnalysisDetail {
  id: number; candidate_id: number; full_name: string; email: string;
  vacancy_title: string; total_score: number; vacancy_match: number; growth_potential: string;
  strengths: string[]; weaknesses: string[]; summary: string; status: string;
  category_scores: Record<string, any> | null; manager_comment: string | null;
  ai_detection_flags: any[];
}

export default function HrCandidateReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    apiClient.get(`/hr/candidates/${id}`).then((res) => setAnalysis(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const sendToManager = async () => {
    setActing(true);
    try { await apiClient.post(`/hr/candidates/${id}/send-to-manager`); navigate("/hr/applications"); }
    catch { alert("Ошибка"); } finally { setActing(false); }
  };

  const rejectCandidate = async () => {
    if (!confirm("Отказать абитуриенту?")) return;
    setActing(true);
    try { await apiClient.post(`/hr/candidates/${id}/reject`); navigate("/hr/applications"); }
    catch { alert("Ошибка"); } finally { setActing(false); }
  };

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!analysis) return <p className="text-red-500">Абитуриент не найден</p>;

  const aiCount = (analysis.ai_detection_flags || []).filter((f: any) => f.is_ai_generated).length;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/hr/applications" className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к заявкам</Link>

      <div className="mt-6 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-dark">{analysis.full_name}</h1>
          <p className="text-gray-400 mt-1">{analysis.email} &middot; {analysis.vacancy_title}</p>
          {aiCount > 0 && (
            <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
              AI подозрение ({aiCount})
            </span>
          )}
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

      {/* Category scores */}
      <CategoryScores categoryScores={analysis.category_scores} />

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

      {/* Summary */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-dark mb-2">AI-резюме</h3>
        <p className="text-gray-600 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Actions */}
      {analysis.status === "analyzed" && (
        <div className="flex gap-4">
          <button onClick={sendToManager} disabled={acting} className="flex-1 bg-dark text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50">
            {acting ? "..." : "Отправить в комиссию"}
          </button>
          <button onClick={rejectCandidate} disabled={acting} className="px-8 py-3.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-semibold transition disabled:opacity-50">
            Отказать
          </button>
        </div>
      )}
      {analysis.status === "sent_to_manager" && (
        <div className="text-center py-3.5 bg-dark/5 text-dark rounded-xl font-medium">Отправлен в комиссию</div>
      )}
      {analysis.status === "approved" && (
        <div className="text-center py-3.5 bg-accent text-dark rounded-xl font-bold">Зачислен комиссией</div>
      )}
      {analysis.status === "rejected" && (
        <div className="text-center py-3.5 bg-red-50 text-red-600 rounded-xl font-medium">Отклонён</div>
      )}
    </div>
  );
}
