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
    apiClient
      .get("/hr/questions/bank")
      .then((res) => setQuestionsBank(res.data))
      .catch(() => {});
  }, []);

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addCustomQuestion = async () => {
    if (!customQuestion.trim()) return;
    try {
      const { data } = await apiClient.post("/hr/questions", {
        text: customQuestion,
        category: customCategory,
      });
      setQuestionsBank((prev) => [...prev, data]);
      setSelectedIds((prev) => [...prev, data.id]);
      setCustomQuestion("");
    } catch {
      setError("Не удалось создать вопрос");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Выберите хотя бы один вопрос");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const { data: vacancy } = await apiClient.post("/hr/vacancies", {
        title,
        description,
        requirements,
        application_deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      await apiClient.post(`/hr/vacancies/${vacancy.id}/questions`, {
        question_ids: selectedIds,
      });
      navigate(`/hr/vacancies/${vacancy.id}`);
    } catch {
      setError("Ошибка создания программы");
    } finally {
      setLoading(false);
    }
  };

  const grouped = questionsBank.reduce(
    (acc, q) => {
      const cat = q.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(q);
      return acc;
    },
    {} as Record<string, Question[]>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Создание программы</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold">Основная информация</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название программы
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
              placeholder="Frontend-разработчик"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 h-24 focus:ring-2 focus:ring-primary-500"
              placeholder="Описание программы..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Требования
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 h-20 focus:ring-2 focus:ring-primary-500"
              placeholder="Критерии отбора..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Срок приёма заявок
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Оставьте пустым, если ограничения по сроку нет
            </p>
          </div>
        </div>

        {/* Question selection */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Вопросы для анкеты ({selectedIds.length} выбрано)
          </h3>

          {Object.entries(grouped).map(([category, questions]) => (
            <div key={category} className="mb-6">
              <h4 className="font-medium text-gray-600 mb-2">
                {categoryLabels[category] || category}
              </h4>
              <div className="space-y-2">
                {questions.map((q) => (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                      selectedIds.includes(q.id)
                        ? "bg-primary-50 border border-primary-300"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm">{q.text}</span>
                      {q.is_system && (
                        <span className="ml-2 text-xs text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">
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
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium text-gray-600 mb-2">
              Добавить свой вопрос
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                className="flex-1 border rounded-lg px-4 py-2 text-sm"
                placeholder="Текст вопроса..."
              />
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="experience">Опыт</option>
                <option value="competencies">Компетенции</option>
                <option value="motivation">Мотивация</option>
                <option value="potential">Потенциал</option>
                <option value="leadership">Лидерство</option>
                <option value="growth_path">Траектория роста</option>
              </select>
              <button
                type="button"
                onClick={addCustomQuestion}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white py-3 rounded-lg text-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Создание..." : "Создать программу"}
        </button>
      </form>
    </div>
  );
}
