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

const statusConfig: Record<
  string,
  { icon: string; label: string; color: string; description: string }
> = {
  pending: {
    icon: "\u23F3",
    label: "Ожидание",
    color: "bg-gray-100 text-gray-700",
    description: "Ваша анкета принята и ожидает анализа.",
  },
  processing: {
    icon: "\u2699\uFE0F",
    label: "Анализируется",
    color: "bg-blue-100 text-blue-700",
    description: "AI-система анализирует ваши ответы.",
  },
  analyzed: {
    icon: "\uD83D\uDD0D",
    label: "На рассмотрении HR",
    color: "bg-yellow-100 text-yellow-700",
    description:
      "Анализ завершён. Координатор отбора рассматривает вашу заявку.",
  },
  hr_review: {
    icon: "\uD83D\uDD0D",
    label: "На рассмотрении HR",
    color: "bg-yellow-100 text-yellow-700",
    description: "Координатор отбора рассматривает вашу заявку.",
  },
  sent_to_manager: {
    icon: "\uD83D\uDCE8",
    label: "У руководителя",
    color: "bg-indigo-100 text-indigo-700",
    description:
      "Ваша заявка отправлена приёмной комиссии на финальное решение.",
  },
  approved: {
    icon: "\u2705",
    label: "Зачислен!",
    color: "bg-green-100 text-green-700",
    description:
      "Поздравляем! Вы зачислены в программу! Координатор отбора свяжется с вами.",
  },
  rejected: {
    icon: "\u274C",
    label: "Отклонён",
    color: "bg-red-100 text-red-700",
    description:
      "К сожалению, в этот раз не получилось. Вы можете подать заявку на другую программу.",
  },
};

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

  if (loading) return <p className="text-gray-500">Загрузка...</p>;

  if (!data || !data.has_application) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">{"\uD83D\uDCCB"}</div>
        <h2 className="text-2xl font-bold mb-2">Вы ещё не подавали заявку</h2>
        <p className="text-gray-600 mb-6">
          Выберите программу и подайте заявку
        </p>
        <Link
          to="/vacancies"
          className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700"
        >
          Перейти к программам
        </Link>
      </div>
    );
  }

  const status = data.status || "pending";
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <div className="max-w-2xl mx-auto text-center py-10">
      <div className="bg-white rounded-xl shadow p-8">
        <div className="text-6xl mb-4">{config.icon}</div>
        <h2 className="text-2xl font-bold mb-2">{config.label}</h2>
        {data.vacancy_title && (
          <p className="text-gray-500 mb-4">Программа: {data.vacancy_title}</p>
        )}
        <p className="text-gray-600 mb-6">{config.description}</p>

        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${config.color}`}
        >
          <span className="font-medium">Статус:</span> {config.label}
        </div>

        {data.total_score !== null && data.total_score > 0 && status === "approved" && (
          <div className="mt-6 text-gray-500">
            Ваш балл: <span className="font-bold text-green-600">{data.total_score}/100</span>
          </div>
        )}

        {data.manager_comment && (status === "approved" || status === "rejected") && (
          <div className="mt-6 text-left bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Комментарий приёмной комиссии:</p>
            <p className="text-gray-700">{data.manager_comment}</p>
          </div>
        )}
      </div>
    </div>
  );
}
