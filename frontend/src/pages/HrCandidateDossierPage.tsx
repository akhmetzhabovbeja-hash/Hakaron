import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import { downloadFile } from "../utils/downloadFile";
import CategoryScores from "../components/CategoryScores";

interface DossierData {
  name: string; email: string; phone: string; bio: string; avatar_url: string | null;
  total_score: number; vacancy_match: number; growth_potential: string;
  strengths: string[]; weaknesses: string[]; summary: string; status: string; vacancy_title: string;
  answers: { question_number: number; question_text: string; answer_text: string }[];
  category_scores?: Record<string, any> | null;
  ai_detection_flags?: any[];
  growth_path_score?: number;
}

export default function HrCandidateDossierPage() {
  const { id } = useParams();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/hr/candidates/${id}/dossier`).then((res) => setDossier(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400">Загрузка досье...</p>;
  if (!dossier) return <p className="text-red-500">Досье не найдено</p>;

  const avatarSrc = dossier.avatar_url ? `http://localhost:8000${dossier.avatar_url}` : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to={`/hr/reports/candidate/${id}`} className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к анализу</Link>

      <div className="flex items-center justify-between mt-6 mb-8">
        <h1 className="text-3xl font-extrabold text-dark">Досье абитуриента</h1>
        <button
          onClick={() => downloadFile(`/hr/candidates/${id}/report-pdf`, `dossier_${id}.pdf`).catch(() => alert("Ошибка PDF"))}
          className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition"
        >
          Скачать PDF
        </button>
      </div>

      {/* User Info */}
      <div className="border border-gray-100 rounded-2xl p-8 mb-8">
        <div className="flex items-start gap-6">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-dark text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {dossier.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-dark">{dossier.name}</h3>
            <p className="text-gray-400 mt-1">{dossier.vacancy_title}</p>
            <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</span>
                <p className="text-dark mt-0.5">{dossier.email}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Телефон</span>
                <p className="text-dark mt-0.5">{dossier.phone}</p>
              </div>
            </div>
            {dossier.bio && (
              <div className="mt-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">О себе</span>
                <p className="text-gray-600 mt-0.5 leading-relaxed">{dossier.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: `${dossier.total_score}/100`, label: "Балл" },
          { value: `${Math.round(dossier.vacancy_match * 100)}%`, label: "Соответствие" },
          { value: dossier.growth_potential, label: "Потенциал" },
          { value: `${Math.round((dossier.growth_path_score || 0) * 100)}%`, label: "Рост" },
        ].map((card, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl p-5 text-center">
            <div className="text-2xl font-extrabold text-dark">{card.value}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-dark mb-2">AI-резюме</h3>
        <p className="text-gray-600 leading-relaxed">{dossier.summary}</p>
      </div>

      {/* Category scores */}
      <CategoryScores categoryScores={dossier.category_scores || null} />

      {/* Answers */}
      <div className="border border-gray-100 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-dark mb-6">
          Ответы абитуриента
          <span className="ml-2 text-sm font-normal text-gray-400">({dossier.answers.length})</span>
        </h3>
        <div className="space-y-4">
          {dossier.answers.map((a) => {
            const aiFlag = (dossier.ai_detection_flags || []).find((f: any) => f.question_number === a.question_number);
            return (
              <div key={a.question_number} className={`border rounded-xl p-5 ${aiFlag?.is_ai_generated ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="bg-dark text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                    {String(a.question_number).padStart(2, "0")}
                  </span>
                  <p className="text-sm font-semibold text-dark flex-1">{a.question_text}</p>
                  {aiFlag && (
                    <span className={`text-[10px] px-2 py-1 rounded-full shrink-0 font-bold uppercase ${aiFlag.is_ai_generated ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}
                      title={`AI: ${Math.round(aiFlag.ai_probability * 100)}%`}>
                      {aiFlag.is_ai_generated ? "AI-текст" : `AI ${Math.round(aiFlag.ai_probability * 100)}%`}
                    </span>
                  )}
                </div>
                <div className="ml-10 bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{a.answer_text}</p>
                </div>
              </div>
            );
          })}
          {dossier.answers.length === 0 && (
            <p className="text-gray-400 text-center py-6">Ответы не найдены</p>
          )}
        </div>
      </div>
    </div>
  );
}
