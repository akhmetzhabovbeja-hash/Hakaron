import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";
import CategoryScores from "../components/CategoryScores";

interface DossierData {
  name: string; email: string; phone: string; bio: string; avatar_url: string | null;
  id_document_url: string | null;
  total_score: number; vacancy_match: number; growth_potential: string;
  strengths: string[]; weaknesses: string[]; summary: string; status: string; vacancy_title: string;
  answers: { question_number: number; question_text: string; answer_text: string }[];
  category_scores?: Record<string, any> | null;
  ai_detection_flags?: any[];
  growth_path_score?: number;
}

export default function ManagerCandidateDossierPage() {
  const { id } = useParams();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/manager/candidates/${id}/dossier`).then((res) => setDossier(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400">Загрузка досье...</p>;
  if (!dossier) return <p className="text-red-500">Досье не найдено</p>;

  const avatarSrc = dossier.avatar_url || null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link to={`/manager/candidate/${id}`} className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к анализу</Link>

      <h1 className="text-3xl font-extrabold text-dark mt-6 mb-8">Досье абитуриента</h1>

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
                <p className="text-gray-600 mt-0.5">{dossier.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ID Document */}
      {dossier.id_document_url && (
        <div className="border border-gray-100 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-dark mb-4">Удостоверение личности</h3>
          <img src={dossier.id_document_url} alt="Удостоверение" className="max-w-md rounded-xl border border-gray-200" />
        </div>
      )}

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

      <CategoryScores categoryScores={dossier.category_scores || null} />

      {/* Summary */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-dark mb-2">AI-резюме</h3>
        <p className="text-gray-600 leading-relaxed">{dossier.summary}</p>
      </div>

      {/* Answers */}
      <div className="border border-gray-100 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-dark mb-6">Ответы ({dossier.answers.length})</h3>
        <div className="space-y-4">
          {dossier.answers.map((a) => {
            const aiFlag = (dossier.ai_detection_flags || []).find((f: any) => f.question_number === a.question_number);
            const isAi = aiFlag?.is_ai_generated;
            return (
              <div key={a.question_number} className={`border rounded-xl p-5 ${isAi ? "border-red-300 bg-red-50/50" : "border-gray-100"}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${isAi ? "bg-red-600 text-white" : "bg-dark text-white"}`}>
                    {String(a.question_number).padStart(2, "0")}
                  </span>
                  <p className="text-sm font-semibold text-dark flex-1">{a.question_text}</p>
                  {aiFlag && (
                    <span className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 font-bold uppercase ${isAi ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {isAi ? "AI-текст" : `AI ${Math.round(aiFlag.ai_probability * 100)}%`}
                    </span>
                  )}
                </div>
                <div className={`ml-10 rounded-xl p-4 ${isAi ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{a.answer_text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
