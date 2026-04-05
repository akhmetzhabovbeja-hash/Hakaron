import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface StatusData {
  has_application: boolean;
  status: string | null;
  vacancy_title: string | null;
  total_score: number | null;
  manager_comment: string | null;
  draft_exists: boolean;
  draft_vacancy_id: number | null;
  draft_vacancy_title: string | null;
  draft_progress: string | null;
}

const statusSteps = [
  { key: "pending", label: "Ожидание", icon: "01" },
  { key: "processing", label: "Анализ системы", icon: "02" },
  { key: "analyzed", label: "Рассмотрение координатора", icon: "03" },
  { key: "sent_to_manager", label: "Комиссия", icon: "04" },
  { key: "approved", label: "Зачислен", icon: "05" },
];

function getStepIndex(status: string) {
  if (status === "hr_review") return 2;
  if (status === "rejected") return -1;
  return statusSteps.findIndex((s) => s.key === status);
}

export default function CandidateStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchStatus = () => {
    apiClient.get("/candidates/my-status").then((res) => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchStatus(); }, []);

  const deleteDraft = async () => {
    if (!confirm("Удалить черновик? Все ответы будут потеряны.")) return;
    setDeleting(true);
    try {
      await apiClient.delete("/candidates/draft");
      fetchStatus();
    } catch {
      alert("Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!data) return null;

  // Draft view
  if (data.draft_exists) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <h2 className="text-4xl font-extrabold text-dark mb-2">Мой статус</h2>
        <p className="text-gray-400 mb-10">У вас есть незавершённая заявка</p>

        <div className="border border-gray-100 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-dark font-bold text-lg">
              ...
            </div>
            <div>
              <h3 className="text-xl font-bold text-dark">{data.draft_vacancy_title}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full">
                Черновик
              </span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-500">Прогресс заполнения</span>
              <span className="font-bold text-dark">{data.draft_progress || "0/0"}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-dark h-2 rounded-full transition-all" style={{
                width: data.draft_progress ? `${(parseInt(data.draft_progress.split("/")[0]) / parseInt(data.draft_progress.split("/")[1] || "1")) * 100}%` : "0%"
              }} />
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              to={`/questionnaire/${data.draft_vacancy_id}`}
              className="flex-1 bg-dark text-white py-3 rounded-xl text-center font-semibold hover:bg-gray-800 transition"
            >
              Продолжить заполнение
            </Link>
            <button
              onClick={deleteDraft}
              disabled={deleting}
              className="px-6 py-3 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-medium transition disabled:opacity-50"
            >
              {deleting ? "..." : "Удалить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No application
  if (!data.has_application) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="text-4xl font-extrabold text-dark mb-3">Вы ещё не подавали заявку</h2>
        <p className="text-gray-500 mb-8">Выберите программу и начните свой путь</p>
        <Link to="/vacancies" className="inline-block bg-dark text-white px-8 py-3.5 rounded-full font-semibold hover:bg-gray-800 transition">
          Перейти к программам
        </Link>
      </div>
    );
  }

  // Submitted application
  const status = data.status || "pending";
  const isRejected = status === "rejected";
  const isApproved = status === "approved";
  const stepIdx = getStepIndex(status);

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h2 className="text-4xl font-extrabold text-dark mb-2">Мой статус</h2>
      {data.vacancy_title && <p className="text-gray-400 mb-10">Программа: {data.vacancy_title}</p>}

      {isApproved && (
        <div className="bg-accent rounded-2xl p-8 mb-10">
          <h3 className="text-3xl font-extrabold text-dark mb-2">Поздравляем! Вы зачислены!</h3>
          <p className="text-dark/70">Координатор отбора свяжется с вами в ближайшее время.</p>
          {data.total_score && <div className="mt-4 text-5xl font-extrabold text-dark">{data.total_score}<span className="text-2xl text-dark/50">/100</span></div>}
        </div>
      )}

      {isRejected && (
        <div className="bg-gray-100 rounded-2xl p-8 mb-10">
          <h3 className="text-3xl font-extrabold text-dark mb-2">К сожалению, не в этот раз</h3>
          <p className="text-gray-500 mb-4">Программа: {data.vacancy_title}. Вы можете подать заявку на другую программу.</p>
          <Link to="/vacancies" className="inline-block bg-dark text-white px-6 py-2.5 rounded-full font-semibold hover:bg-gray-800 transition">
            Посмотреть другие программы
          </Link>
        </div>
      )}

      {data.manager_comment && (isApproved || isRejected) && (
        <div className="border border-gray-200 rounded-2xl p-6 mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Комментарий приёмной комиссии</p>
          <p className="text-dark leading-relaxed">{data.manager_comment}</p>
        </div>
      )}

      {!isRejected && (
        <div className="space-y-0">
          {statusSteps.map((step, i) => {
            const done = i <= stepIdx;
            const current = i === stepIdx;
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition ${done ? "bg-dark text-white" : "bg-gray-100 text-gray-400"} ${current ? "ring-4 ring-accent" : ""}`}>
                    {step.icon}
                  </div>
                  {i < statusSteps.length - 1 && <div className={`w-0.5 h-12 ${done ? "bg-dark" : "bg-gray-200"}`} />}
                </div>
                <div className="pt-2">
                  <p className={`font-semibold ${done ? "text-dark" : "text-gray-400"}`}>{step.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fairness — how evaluation works */}
      <div className="border border-gray-100 rounded-2xl p-6 mt-10">
        <h3 className="font-bold text-dark mb-3">Как работает оценка</h3>
        <div className="space-y-3 text-sm text-gray-500">
          <div className="flex items-start gap-3">
            <span className="text-dark font-bold shrink-0">01</span>
            <p>Ваши ответы оцениваются по 6 категориям: опыт, компетенции, мотивация, потенциал, лидерство и траектория роста</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-dark font-bold shrink-0">02</span>
            <p>Оценка основана <strong>только</strong> на содержании ваших ответов. Мы не используем демографические данные, пол, возраст или место проживания</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-dark font-bold shrink-0">03</span>
            <p>Автоматическая оценка — это рекомендация для комиссии. Финальное решение всегда принимает человек</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-dark font-bold shrink-0">04</span>
            <p>Мы проверяем аутентичность ответов. Тексты скопированные из AI-генераторов снижают оценку</p>
          </div>
        </div>
      </div>
    </div>
  );
}
