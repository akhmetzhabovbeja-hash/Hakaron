import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface Question {
  id: number;
  text: string;
  category: string;
  is_system: boolean;
}

const categoryLabels: Record<string, string> = {
  experience: "Опыт",
  competencies: "Компетенции",
  motivation: "Мотивация",
  potential: "Потенциал",
  leadership: "Лидерство",
  growth_path: "Траектория роста",
};

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dark focus:border-transparent outline-none transition";

export default function HrVacancyCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [questionsBank, setQuestionsBank] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [customCategory, setCustomCategory] = useState("experience");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/hr/questions/bank").then((res) => setQuestionsBank(res.data)).catch(() => {});
  }, []);

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const addCustomQuestion = async () => {
    if (!customQuestion.trim()) return;
    try {
      const { data } = await apiClient.post("/hr/questions", { text: customQuestion, category: customCategory });
      setQuestionsBank((prev) => [...prev, data]);
      setSelectedIds((prev) => [...prev, data.id]);
      setCustomQuestion("");
    } catch {
      setError("Не удалось создать вопрос");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) { setError("Выберите хотя бы один вопрос"); return; }
    setError("");
    setLoading(true);
    try {
      const { data: vacancy } = await apiClient.post("/hr/vacancies", {
        title, description, requirements,
        application_deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      await apiClient.post(`/hr/vacancies/${vacancy.id}/questions`, { question_ids: selectedIds });
      navigate(`/hr/vacancies/${vacancy.id}`);
    } catch {
      setError("Ошибка создания программы");
    } finally {
      setLoading(false);
    }
  };

  const grouped = questionsBank.reduce((acc, q) => {
    const cat = q.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-extrabold tracking-tight text-dark mb-10">
        Создание программы
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
        )}

        {/* Basic info */}
        <div className="border border-gray-100 rounded-2xl p-8 space-y-5">
          <h3 className="text-lg font-bold text-dark">Основная информация</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Название программы</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Foundation Year" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} h-24`} placeholder="Описание программы..." required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Требования</label>
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} className={`${inputClass} h-20`} placeholder="Критерии отбора..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Срок приёма заявок</label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
            <p className="text-xs text-gray-400 mt-1.5">Оставьте пустым, если ограничения по сроку нет</p>
          </div>
        </div>

        {/* Question selection */}
        <div className="border border-gray-100 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-dark mb-6">
            Вопросы для анкеты
            <span className="ml-2 text-sm font-normal text-gray-400">({selectedIds.length} выбрано)</span>
          </h3>

          {Object.entries(grouped).map(([category, questions]) => (
            <div key={category} className="mb-8 last:mb-0">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {categoryLabels[category] || category}
              </h4>
              <div className="space-y-2">
                {questions.map((q) => (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition border ${
                      selectedIds.includes(q.id)
                        ? "bg-accent/10 border-dark"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-0.5 w-4 h-4 accent-dark"
                    />
                    <div>
                      <span className="text-sm text-dark">{q.text}</span>
                      {q.is_system && (
                        <span className="ml-2 text-[10px] font-bold text-dark bg-accent px-1.5 py-0.5 rounded-full uppercase">
                          Системный
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Add custom question */}
          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Добавить свой вопрос</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                className={`flex-1 ${inputClass}`}
                placeholder="Текст вопроса..."
              />
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none"
              >
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCustomQuestion}
                className="bg-dark text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition shrink-0"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-dark text-white py-4 rounded-xl text-base font-bold hover:bg-gray-800 transition disabled:opacity-50"
        >
          {loading ? "Создание..." : "Создать программу"}
        </button>
      </form>
    </div>
  );
}
