import { useEffect, useState } from "react";
import apiClient from "../api/client";

interface ApprovedCandidate {
  id: number;
  candidate_id: number;
  full_name: string;
  email: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  status: string;
  source: string;
}

export default function HrApprovedPage() {
  const [candidates, setCandidates] = useState<ApprovedCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/hr/approved")
      .then((res) => setCandidates(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async (analysisId: number) => {
    try {
      await apiClient.post(`/hr/candidates/${analysisId}/invite`);
      alert("Приглашение отправлено!");
    } catch {
      alert("Ошибка отправки");
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Зачисленные абитуриенты</h2>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Нет зачисленных абитуриентов</p>
          <p className="text-sm mt-1">
            Приёмная комиссия ещё не зачислила ни одного абитуриента
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow p-6 flex items-center justify-between"
            >
              <div>
                <h3 className="text-lg font-semibold">{c.full_name}</h3>
                <p className="text-gray-500">{c.vacancy_title}</p>
                <p className="text-sm text-gray-400">{c.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full font-bold text-green-600 bg-green-100">
                  {c.total_score}/100
                </span>
                <button
                  onClick={() => handleInvite(c.id)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Отправить оффер
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
