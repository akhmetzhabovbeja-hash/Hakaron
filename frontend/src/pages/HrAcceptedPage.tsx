import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

interface AcceptedCandidate {
  id: number;
  candidate_id: number;
  full_name: string;
  email: string;
  vacancy_title: string;
  total_score: number;
  vacancy_match: number;
  status: string;
  ai_suspected: boolean;
  ai_flags_count: number;
}

export default function HrAcceptedPage() {
  const [candidates, setCandidates] = useState<AcceptedCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/hr/approved").then((res) => setCandidates(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-dark">Принятые</h1>
        <div className="w-16 h-1 bg-accent mt-3 mb-3" />
        <p className="text-gray-400">Абитуриенты одобренные приёмной комиссией</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎓</div>
          <p className="text-xl font-bold text-dark">Нет принятых абитуриентов</p>
          <p className="text-gray-400 mt-2">Комиссия ещё не одобрила ни одного кандидата</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((c, idx) => (
            <Link
              key={c.id}
              to={`/hr/reports/candidate/${c.id}`}
              className="group border border-gray-100 rounded-2xl p-6 flex items-center justify-between hover:border-dark transition"
            >
              <div className="flex items-start gap-4">
                <span className="text-xs font-bold text-gray-300 tracking-widest mt-1">{String(idx + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-lg font-bold text-dark">{c.full_name}</h3>
                  <p className="text-gray-400 text-sm">{c.vacancy_title} · {c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-wide bg-accent text-dark px-2.5 py-1 rounded-full">Зачислен</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-dark">{c.total_score}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">баллов</div>
                </div>
                <span className="text-gray-300 group-hover:text-dark transition">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
