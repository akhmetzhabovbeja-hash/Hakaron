import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface QuestionItem {
  id: number;
  text: string;
  category: string;
  order: number;
}

export default function CandidateQuestionnairePage() {
  const { vacancyId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get(`/vacancies/${vacancyId}`)
      .then((res) => {
        setVacancyTitle(res.data.title);
        setQuestions(res.data.questions || []);
      })
      .catch(() => setError("Не удалось загрузить вакансию"))
      .finally(() => setLoading(false));
  }, [vacancyId]);

  const currentQuestion = questions[currentIdx];
  const progress =
    questions.length > 0
      ? Math.round(((currentIdx + 1) / questions.length) * 100)
      : 0;

  const handleNext = () => {
    if (!answers[currentQuestion.id]?.trim()) return;
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleSubmit = async () => {
    if (!answers[currentQuestion.id]?.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        question_text: q.text,
        answer_text: answers[q.id] || "",
      }));

      await apiClient.post("/candidates/submit-questionnaire", {
        vacancy_id: Number(vacancyId),
        answers: formattedAnswers,
      });

      navigate("/status");
    } catch {
      setError("Ошибка отправки анкеты");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-500">Загрузка вопросов...</p>;

  if (questions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">
          Для этой вакансии ещё нет вопросов
        </p>
      </div>
    );
  }

  const isLast = currentIdx === questions.length - 1;
  const currentAnswer = answers[currentQuestion.id] || "";

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-1">Анкета кандидата</h2>
      <p className="text-gray-500 mb-6">{vacancyTitle}</p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6">
        {/* Progress */}
        <div className="mb-4">
          <span className="text-sm text-gray-500">
            Вопрос {currentIdx + 1} из {questions.length}
          </span>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h3 className="text-xl font-semibold mb-4">{currentQuestion.text}</h3>

        <textarea
          className="w-full border rounded-lg px-4 py-3 h-32 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Ваш ответ..."
          value={currentAnswer}
          onChange={(e) =>
            setAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: e.target.value,
            }))
          }
        />

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            &larr; Назад
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !currentAnswer.trim()}
              className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Отправка..." : "Отправить анкету"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!currentAnswer.trim()}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              Далее &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
