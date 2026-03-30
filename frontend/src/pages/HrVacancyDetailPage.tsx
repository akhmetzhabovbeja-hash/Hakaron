import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface QuestionItem { id: number; text: string; category: string; order: number; }
interface VacancyDetail {
  id: number; title: string; description: string; requirements: string;
  is_active: boolean; application_deadline: string | null; questions: QuestionItem[];
}
interface CandidateItem { id: number; full_name: string; vacancy_title: string; total_score: number; status: string; }

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dark focus:border-transparent outline-none transition";

function deadlineLabel(deadline: string | null) {
  if (!deadline) return null;
  const dl = new Date(deadline);
  const diff = dl.getTime() - Date.now();
  if (diff <= 0) return { text: "Срок истёк", color: "text-red-600" };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  if (days < 3) {
    let p: string[] = [];
    if (days > 0) p.push(`${days} дн.`);
    if (hours > 0) p.push(`${hours} ч.`);
    if (days === 0 && minutes > 0) p.push(`${minutes} мин.`);
    return { text: `Осталось ${p.join(" ")}`, color: "text-red-600" };
  }
  return { text: `До ${dl.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, color: "text-gray-500" };
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
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editReq, setEditReq] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiClient.get(`/hr/vacancies/${id}`), apiClient.get("/hr/candidates")])
      .then(([vRes, cRes]) => {
        setVacancy(vRes.data);
        setCandidates(cRes.data.filter((c: CandidateItem) => c.vacancy_title === vRes.data.title));
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!vacancy) return;
    setEditTitle(vacancy.title); setEditDesc(vacancy.description);
    setEditReq(vacancy.requirements);
    setEditDeadline(vacancy.application_deadline ? toLocalDatetime(vacancy.application_deadline) : "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/hr/vacancies/${id}`, {
        title: editTitle, description: editDesc, requirements: editReq,
        application_deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      const res = await apiClient.get(`/hr/vacancies/${id}`);
      setVacancy(res.data); setEditing(false);
    } catch { alert("Ошибка сохранения"); } finally { setSaving(false); }
  };

  const archiveVacancy = async () => { await apiClient.patch(`/hr/vacancies/${id}/archive`); navigate("/hr"); };
  const restoreVacancy = async () => { await apiClient.patch(`/hr/vacancies/${id}/restore`); const res = await apiClient.get(`/hr/vacancies/${id}`); setVacancy(res.data); };

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!vacancy) return <p className="text-red-500">Программа не найдена</p>;

  const dl = deadlineLabel(vacancy.application_deadline);

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/hr" className="text-sm text-gray-400 hover:text-dark transition">
        &larr; Назад к программам
      </Link>

      {/* Main card */}
      <div className="border border-gray-100 rounded-2xl p-8 mt-6 mb-8">
        {editing ? (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Название</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Описание</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={`${inputClass} h-24`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Требования</label>
              <textarea value={editReq} onChange={(e) => setEditReq(e.target.value)} className={`${inputClass} h-20`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Срок приёма</label>
              <input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveEdit} disabled={saving} className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50">
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-dark px-4 py-2.5 text-sm transition">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-extrabold text-dark">{vacancy.title}</h1>
                <p className="text-gray-500 mt-2 leading-relaxed">{vacancy.description}</p>
                {vacancy.requirements && (
                  <p className="text-gray-400 mt-2 text-sm"><span className="font-semibold text-dark">Требования:</span> {vacancy.requirements}</p>
                )}
                {dl && <p className={`mt-3 text-sm font-semibold ${dl.color}`}>{dl.text}</p>}
              </div>
              <span className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold ${vacancy.is_active ? "bg-accent text-dark" : "bg-gray-100 text-gray-500"}`}>
                {vacancy.is_active ? "Активна" : "Удалена"}
              </span>
            </div>
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
              <button onClick={startEdit} className="bg-gray-100 text-dark px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-200 transition">
                Редактировать
              </button>
              {vacancy.is_active ? (
                <button onClick={archiveVacancy} className="text-red-500 bg-red-50 px-5 py-2 rounded-full text-sm font-medium hover:bg-red-100 transition">
                  Удалить
                </button>
              ) : (
                <button onClick={restoreVacancy} className="text-green-600 bg-green-50 px-5 py-2 rounded-full text-sm font-medium hover:bg-green-100 transition">
                  Восстановить
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="border border-gray-100 rounded-2xl p-8 mb-8">
        <h3 className="text-lg font-bold text-dark mb-5">
          Вопросы анкеты
          <span className="ml-2 text-sm font-normal text-gray-400">({vacancy.questions.length})</span>
        </h3>
        {vacancy.questions.length === 0 ? (
          <p className="text-gray-400">Вопросы ещё не назначены</p>
        ) : (
          <div className="space-y-2">
            {vacancy.questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-300 tracking-widest mt-0.5 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-dark">{q.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidates */}
      <div className="border border-gray-100 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-dark mb-5">
          Абитуриенты
          <span className="ml-2 text-sm font-normal text-gray-400">({candidates.length})</span>
        </h3>
        {candidates.length === 0 ? (
          <p className="text-gray-400">Пока нет абитуриентов для этой программы</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <Link
                key={c.id}
                to={`/hr/candidates/${c.id}`}
                className="group flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition"
              >
                <span className="font-medium text-dark">{c.full_name}</span>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${c.total_score >= 80 ? "text-green-600 bg-green-50" : c.total_score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"}`}>
                    {c.total_score}/100
                  </span>
                  <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
