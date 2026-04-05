import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface VacancyDetail {
  id: number; title: string; description: string; requirements: string;
  is_active: boolean; application_deadline: string | null;
  questions: { id: number; text: string; category: string; order: number }[];
}

interface StatusData {
  has_application: boolean; status: string | null;
  draft_exists: boolean; draft_vacancy_id: number | null; draft_vacancy_title: string | null;
  can_apply: boolean; rejected_vacancy_id: number | null;
}


export default function VacancyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/vacancies/${id}`),
      apiClient.get("/candidates/my-status"),
    ]).then(([vRes, sRes]) => {
      setVacancy(vRes.data);
      setStatus(sRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const startApplication = async () => {
    setStarting(true);
    try {
      await apiClient.post("/candidates/start-application", { vacancy_id: Number(id) });
      navigate(`/questionnaire/${id}`);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Ошибка");
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!vacancy) return <p className="text-red-500">Программа не найдена</p>;

  const hasDraft = status?.draft_exists;
  const draftIsHere = hasDraft && status?.draft_vacancy_id === Number(id);
  const draftElsewhere = hasDraft && status?.draft_vacancy_id !== Number(id);
  const isExpired = vacancy.application_deadline && new Date(vacancy.application_deadline) < new Date();
  const isRejectedHere = status?.rejected_vacancy_id === Number(id);
  const hasActiveApplication = status?.has_application && status?.status !== "rejected";
  const canApply = (status?.can_apply ?? true) && !isExpired && !isRejectedHere;


  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/vacancies" className="text-sm text-gray-400 hover:text-dark transition">&larr; Назад к программам</Link>

      {/* Header */}
      <div className="mt-6 mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">{vacancy.title}</h1>
        <div className="w-16 h-1 bg-dark mt-3" />
      </div>

      {/* Info card */}
      <div className="border border-gray-100 rounded-2xl p-8 mb-8">
        <p className="text-gray-600 leading-relaxed text-lg">{vacancy.description}</p>
        {vacancy.requirements && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Требования</h3>
            <p className="text-gray-700">{vacancy.requirements}</p>
          </div>
        )}
        {vacancy.application_deadline && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Срок подачи</h3>
            <p className={isExpired ? "text-red-600 font-semibold" : "text-dark font-semibold"}>
              {new Date(vacancy.application_deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              {isExpired && " (истёк)"}
            </p>
          </div>
        )}
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Вопросов в анкете</h3>
          <p className="text-3xl font-extrabold text-dark">{vacancy.questions.length}</p>
        </div>
      </div>

      {/* Action */}
      <div className="border border-gray-100 rounded-2xl p-8 text-center">
        {isRejectedHere && (
          <div>
            <p className="text-lg font-bold text-red-600 mb-2">Вы получили отказ по этой программе</p>
            <p className="text-gray-400">Вы можете подать заявку на другую программу</p>
            <Link to="/vacancies" className="text-sm text-gray-400 hover:text-dark mt-2 inline-block">Посмотреть другие программы &rarr;</Link>
          </div>
        )}
        {hasActiveApplication && !isRejectedHere && (
          <div>
            <p className="text-lg font-bold text-dark mb-2">Вы уже подали заявку</p>
            <Link to="/status" className="text-sm text-gray-400 hover:text-dark">Посмотреть статус &rarr;</Link>
          </div>
        )}
        {draftIsHere && (
          <div>
            <p className="text-lg font-bold text-dark mb-4">У вас есть незавершённая заявка на эту программу</p>
            <Link to={`/questionnaire/${id}`} className="bg-dark text-white px-8 py-3 rounded-full font-semibold hover:bg-gray-800 transition">
              Продолжить заполнение
            </Link>
          </div>
        )}
        {draftElsewhere && (
          <div>
            <p className="text-lg font-bold text-dark mb-2">У вас есть незавершённая заявка</p>
            <p className="text-gray-400 mb-4">Программа: {status?.draft_vacancy_title}. Удалите её чтобы подать на другую.</p>
            <Link to="/status" className="text-sm text-gray-400 hover:text-dark">Перейти к статусу &rarr;</Link>
          </div>
        )}
        {isExpired && !hasActiveApplication && !hasDraft && !isRejectedHere && (
          <p className="text-lg font-bold text-red-600">Приём заявок закрыт</p>
        )}
        {canApply && (
          <div>
            <div className="text-left bg-gray-50 rounded-xl p-5 mb-6 max-w-xl mx-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Согласие на обработку данных</p>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Нажимая «Подать заявку», вы подтверждаете, что:
              </p>
              <ul className="text-sm text-gray-500 space-y-2 mb-4">
                <li className="flex gap-2"><span className="text-dark">•</span> Ваши ответы будут обработаны для оценки вашей заявки</li>
                <li className="flex gap-2"><span className="text-dark">•</span> Данные будут доступны координатору отбора и приёмной комиссии inVision U</li>
                <li className="flex gap-2"><span className="text-dark">•</span> Ответы проверяются на аутентичность — использование AI-генераторов снижает оценку</li>
                <li className="flex gap-2"><span className="text-dark">•</span> Загруженное удостоверение личности используется только для верификации</li>
                <li className="flex gap-2"><span className="text-dark">•</span> Финальное решение всегда принимает человек, а не алгоритм</li>
              </ul>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-dark" />
                <span className="text-sm text-dark font-medium">Я согласен(на) с условиями обработки данных</span>
              </label>
            </div>
            <button
              onClick={startApplication}
              disabled={starting || !agreed}
              className="bg-dark text-white px-10 py-4 rounded-full text-lg font-bold hover:bg-accent hover:text-dark transition disabled:opacity-50"
            >
              {starting ? "Создание..." : "Подать заявку"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
