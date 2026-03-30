import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface StatusData {
  has_application: boolean;
  status: string | null;
  vacancy_title: string | null;
  total_score: number | null;
  manager_comment: string | null;
}

const statusSteps = [
  { key: "pending", label: "Ожидание", icon: "01" },
  { key: "processing", label: "AI-анализ", icon: "02" },
  { key: "analyzed", label: "HR-рассмотрение", icon: "03" },
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

  useEffect(() => {
    apiClient
      .get("/candidates/my-status")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Загрузка...</p>;

  if (!data || !data.has_application) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="text-4xl font-extrabold text-dark mb-3">
          Вы ещё не подавали заявку
        </h2>
        <p className="text-gray-500 mb-8">Выберите программу и начните свой путь</p>
        <Link
          to="/vacancies"
          className="inline-block bg-dark text-white px-8 py-3.5 rounded-full font-semibold hover:bg-gray-800 transition"
        >
          Перейти к программам
        </Link>
      </div>
    );
  }

  const status = data.status || "pending";
  const isRejected = status === "rejected";
  const isApproved = status === "approved";
  const stepIdx = getStepIndex(status);

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h2 className="text-4xl font-extrabold text-dark mb-2">Мой статус</h2>
      {data.vacancy_title && (
        <p className="text-gray-400 mb-10">Программа: {data.vacancy_title}</p>
      )}

      {/* Status result */}
      {isApproved && (
        <div className="bg-accent rounded-2xl p-8 mb-10">
          <h3 className="text-3xl font-extrabold text-dark mb-2">Поздравляем! Вы зачислены!</h3>
          <p className="text-dark/70">Координатор отбора свяжется с вами в ближайшее время.</p>
          {data.total_score && (
            <div className="mt-4 text-5xl font-extrabold text-dark">{data.total_score}<span className="text-2xl text-dark/50">/100</span></div>
          )}
        </div>
      )}

      {isRejected && (
        <div className="bg-gray-100 rounded-2xl p-8 mb-10">
          <h3 className="text-3xl font-extrabold text-dark mb-2">К сожалению, не в этот раз</h3>
          <p className="text-gray-500">Вы можете подать заявку на другую программу.</p>
        </div>
      )}

      {/* Manager comment */}
      {data.manager_comment && (isApproved || isRejected) && (
        <div className="border border-gray-200 rounded-2xl p-6 mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Комментарий приёмной комиссии
          </p>
          <p className="text-dark leading-relaxed">{data.manager_comment}</p>
        </div>
      )}

      {/* Progress steps */}
      {!isRejected && (
        <div className="space-y-0">
          {statusSteps.map((step, i) => {
            const done = i <= stepIdx;
            const current = i === stepIdx;
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition ${
                      done
                        ? "bg-dark text-white"
                        : "bg-gray-100 text-gray-400"
                    } ${current ? "ring-4 ring-accent" : ""}`}
                  >
                    {step.icon}
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`w-0.5 h-12 ${done ? "bg-dark" : "bg-gray-200"}`} />
                  )}
                </div>
                <div className="pt-2">
                  <p className={`font-semibold ${done ? "text-dark" : "text-gray-400"}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
