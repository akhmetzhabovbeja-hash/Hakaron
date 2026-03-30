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
    apiClient.get("/hr/approved").then((res) => setCandidates(res.data)).catch(() => {}).finally(() => setLoading(false));
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
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Зачисленные</h1>
        <div className="w-16 h-1 bg-accent mt-3" />
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎓</div>
          <p className="text-xl font-bold text-dark">Нет зачисленных абитуриентов</p>
          <p className="text-gray-400 mt-2">Приёмная комиссия ещё не зачислила ни одного абитуриента</p>
        </div>
      ) : (
        <>
          <div className="mb-6 text-sm text-gray-400">
            Всего зачислено: <span className="font-bold text-dark">{candidates.length}</span>
          </div>
          <div className="grid gap-3">
            {candidates.map((c, idx) => (
              <div
                key={c.id}
                className="group border border-gray-100 rounded-2xl p-6 flex items-center justify-between hover:border-dark transition"
              >
                <div className="flex items-start gap-4">
                  <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-dark">{c.full_name}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{c.vacancy_title}</p>
                    <p className="text-gray-300 text-xs mt-0.5">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-dark">{c.total_score}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">баллов</div>
                  </div>
                  <div className="w-px h-10 bg-gray-100" />
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-dark">{Math.round(c.vacancy_match * 100)}%</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">match</div>
                  </div>
                  <button
                    onClick={() => handleInvite(c.id)}
                    className="ml-4 bg-dark text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-accent hover:text-dark transition"
                  >
                    Отправить оффер
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
