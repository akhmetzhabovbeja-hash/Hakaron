import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../api/client";

interface DossierData {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatar_url: string | null;
  total_score: number;
  vacancy_match: number;
  growth_potential: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: string;
  vacancy_title: string;
  answers: { question_number: number; question_text: string; answer_text: string }[];
}

export default function HrCandidateDossierPage() {
  const { id } = useParams();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`/hr/candidates/${id}/dossier`)
      .then((res) => setDossier(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Загрузка досье...</p>;
  if (!dossier) return <p className="text-red-500">Досье не найдено</p>;

  const avatarSrc = dossier.avatar_url
    ? `http://localhost:8000${dossier.avatar_url}`
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/hr/reports/candidate/${id}`}
        className="text-primary-600 hover:underline text-sm"
      >
        &larr; Назад к анализу
      </Link>

      <h2 className="text-3xl font-bold mt-4 mb-6">Досье кандидата</h2>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-start gap-6">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Аватар"
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold shrink-0">
              {dossier.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold">{dossier.name}</h3>
            <p className="text-gray-500 mt-1">{dossier.vacancy_title}</p>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <span className="text-gray-400">Email:</span>
                <span className="ml-2 text-gray-700">{dossier.email}</span>
              </div>
              <div>
                <span className="text-gray-400">Телефон:</span>
                <span className="ml-2 text-gray-700">{dossier.phone}</span>
              </div>
            </div>
            {dossier.bio && (
              <div className="mt-3">
                <span className="text-gray-400 text-sm">О себе:</span>
                <p className="text-gray-700 mt-1">{dossier.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Score Summary (compact) */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-semibold mb-4">AI-оценка</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div
              className={`text-2xl font-bold ${
                dossier.total_score >= 85
                  ? "text-green-600"
                  : dossier.total_score >= 60
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {dossier.total_score}/100
            </div>
            <div className="text-xs text-gray-400">Балл</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {Math.round(dossier.vacancy_match * 100)}%
            </div>
            <div className="text-xs text-gray-400">Соответствие</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {dossier.growth_potential}
            </div>
            <div className="text-xs text-gray-400">Потенциал</div>
          </div>
        </div>
        <p className="text-gray-600 text-sm">{dossier.summary}</p>
      </div>

      {/* Answers */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-semibold mb-4">
          Ответы кандидата ({dossier.answers.length})
        </h3>
        <div className="space-y-4">
          {dossier.answers.map((a) => (
            <div
              key={a.question_number}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded shrink-0">
                  #{a.question_number}
                </span>
                <p className="text-sm font-medium text-gray-800">
                  {a.question_text}
                </p>
              </div>
              <div className="ml-9 bg-gray-50 rounded-lg p-3">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">
                  {a.answer_text}
                </p>
              </div>
            </div>
          ))}
          {dossier.answers.length === 0 && (
            <p className="text-gray-500 text-center py-4">
              Ответы не найдены
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
