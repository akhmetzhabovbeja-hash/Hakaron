import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface QuestionItem {
  id: number;
  text: string;
  category: string;
  order: number;
}

interface VacancyDetail {
  id: number;
  title: string;
  description: string;
  requirements: string;
  is_active: boolean;
  application_deadline: string | null;
  questions: QuestionItem[];
}

interface CandidateItem {
  id: number;
  full_name: string;
  vacancy_title: string;
  total_score: number;
  status: string;
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl.getTime() - now.getTime();

  if (diff <= 0) return { text: "Срок истёк", color: "text-red-600" };

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days < 3) {
    let parts: string[] = [];
    if (days > 0) parts.push(`${days} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (days === 0 && minutes > 0) parts.push(`${minutes} мин.`);
    return { text: `Осталось ${parts.join(" ")}`, color: "text-red-600" };
  }

  return {
    text: `До ${dl.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    color: "text-gray-600",
  };
}

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HrVacancyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editReq, setEditReq] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/hr/vacancies/${id}`),
      apiClient.get("/hr/candidates"),
    ])
      .then(([vRes, cRes]) => {
        setVacancy(vRes.data);
        setCandidates(
          cRes.data.filter(
            (c: CandidateItem) => c.vacancy_title === vRes.data.title
          )
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!vacancy) return;
    setEditTitle(vacancy.title);
    setEditDesc(vacancy.description);
    setEditReq(vacancy.requirements);
    setEditDeadline(vacancy.application_deadline ? toLocalDatetime(vacancy.application_deadline) : "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/hr/vacancies/${id}`, {
        title: editTitle,
        description: editDesc,
        requirements: editReq,
        application_deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      const res = await apiClient.get(`/hr/vacancies/${id}`);
      setVacancy(res.data);
      setEditing(false);
    } catch {
      alert("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const archiveVacancy = async () => {
    await apiClient.patch(`/hr/vacancies/${id}/archive`);
    navigate("/hr");
  };

  const restoreVacancy = async () => {
    await apiClient.patch(`/hr/vacancies/${id}/restore`);
    const res = await apiClient.get(`/hr/vacancies/${id}`);
    setVacancy(res.data);
  };

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (!vacancy) return <p className="text-red-500">Программа не найдена</p>;

  const dl = deadlineLabel(vacancy.application_deadline);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/hr" className="text-primary-600 hover:underline text-sm">
          &larr; Назад к программам
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        {editing ? (
          /* ---- Edit mode ---- */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 h-24 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Требования</label>
              <textarea
                value={editReq}
                onChange={(e) => setEditReq(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 h-20 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Срок приёма заявок</label>
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-200"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          /* ---- View mode ---- */
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{vacancy.title}</h2>
                <p className="text-gray-600 mt-2">{vacancy.description}</p>
                {vacancy.requirements && (
                  <p className="text-gray-500 mt-2 text-sm">
                    <strong>Требования:</strong> {vacancy.requirements}
                  </p>
                )}
                {dl && (
                  <p className={`mt-2 text-sm font-medium ${dl.color}`}>
                    {dl.text}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    vacancy.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {vacancy.is_active ? "Активна" : "Удалена"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={startEdit}
                className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg hover:bg-primary-200 text-sm font-medium"
              >
                Редактировать
              </button>
              {vacancy.is_active ? (
                <button
                  onClick={archiveVacancy}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  Удалить
                </button>
              ) : (
                <button
                  onClick={restoreVacancy}
                  className="bg-green-50 text-green-600 px-4 py-2 rounded-lg hover:bg-green-100 text-sm font-medium"
                >
                  Восстановить
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Вопросы анкеты ({vacancy.questions.length})
        </h3>
        {vacancy.questions.length === 0 ? (
          <p className="text-gray-500">Вопросы ещё не назначены</p>
        ) : (
          <ol className="space-y-2">
            {vacancy.questions.map((q, i) => (
              <li key={q.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-400 font-mono text-sm w-6">
                  {i + 1}.
                </span>
                <span className="text-sm">{q.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Candidates for this vacancy */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Кандидаты ({candidates.length})
        </h3>
        {candidates.length === 0 ? (
          <p className="text-gray-500">Пока нет абитуриентов для этой программы</p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <Link
                key={c.id}
                to={`/hr/candidates/${c.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <span className="font-medium">{c.full_name}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full font-bold text-sm ${
                      c.total_score >= 85
                        ? "text-green-600 bg-green-100"
                        : c.total_score >= 60
                        ? "text-yellow-600 bg-yellow-100"
                        : "text-red-600 bg-red-100"
                    }`}
                  >
                    {c.total_score}/100
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
