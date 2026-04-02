import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../api/client";

interface QuestionItem { id: number; text: string; category: string; order: number; }

export default function CandidateQuestionnairePage() {
  const { vacancyId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [idFile, setIdFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showIdStep, setShowIdStep] = useState(false);

  // Load vacancy questions + restore draft
  useEffect(() => {
    Promise.all([
      apiClient.get(`/vacancies/${vacancyId}`),
      apiClient.get("/candidates/draft").catch(() => ({ data: null })),
    ]).then(([vRes, dRes]) => {
      setVacancyTitle(vRes.data.title);
      setQuestions(vRes.data.questions || []);

      // Restore draft answers
      if (dRes.data && dRes.data.answers) {
        const restored: Record<number, string> = {};
        const qs = vRes.data.questions || [];
        for (const da of dRes.data.answers) {
          // Match by question_number (1-based) → question id
          const q = qs[da.question_id - 1];
          if (q) restored[q.id] = da.answer_text;
        }
        setAnswers(restored);
        // Jump to first unanswered
        const firstEmpty = qs.findIndex((q: QuestionItem) => !restored[q.id]?.trim());
        if (firstEmpty >= 0) setCurrentIdx(firstEmpty);
        else setCurrentIdx(qs.length - 1);

        if (dRes.data.id_document_url) setIdFile(dRes.data.id_document_url);
      }
    }).catch(() => setError("Не удалось загрузить"))
      .finally(() => setLoading(false));
  }, [vacancyId]);

  // Autosave draft
  const saveDraft = useCallback(async () => {
    if (questions.length === 0) return;
    setSaving(true);
    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        question_text: q.text,
        answer_text: answers[q.id] || "",
      }));
      await apiClient.put("/candidates/save-draft", { answers: formattedAnswers });
    } catch {}
    setSaving(false);
  }, [questions, answers]);

  const currentQuestion = questions[currentIdx];
  const totalQ = questions.length;
  const answeredCount = questions.filter(q => answers[q.id]?.trim()).length;
  const progress = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;

  const handleNext = async () => {
    if (!answers[currentQuestion.id]?.trim()) return;
    await saveDraft();
    if (currentIdx < totalQ - 1) setCurrentIdx(currentIdx + 1);
  };

  const handlePrev = async () => {
    await saveDraft();
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleFinishQuestions = async () => {
    if (!answers[currentQuestion.id]?.trim()) return;
    await saveDraft();
    setShowIdStep(true);
  };

  const handleUploadId = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post("/candidates/upload-id", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIdFile(data.id_document_url);
    } catch {
      setError("Ошибка загрузки документа (макс. 10MB, только изображения)");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/candidates/submit-application");
      navigate("/status");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (questions.length === 0) return <div className="text-center py-20"><p className="text-gray-400">Вопросов ещё нет</p></div>;

  const isLast = currentIdx === totalQ - 1;
  const currentAnswer = answers[currentQuestion?.id] || "";

  // ID upload step
  if (showIdStep) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-dark mb-2">Последний шаг</h1>
        <p className="text-gray-400 mb-8">{vacancyTitle}</p>

        <div className="border border-gray-100 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🪪</div>
          <h2 className="text-2xl font-bold text-dark mb-2">Удостоверение личности</h2>
          <p className="text-gray-500 mb-6">Загрузите фото вашего удостоверения (ИИН карта, паспорт)</p>

          {idFile ? (
            <div className="mb-6">
              <img src={`${idFile}`} alt="ID" className="max-w-xs mx-auto rounded-xl border" />
              <p className="text-green-600 text-sm mt-2 font-medium">Документ загружен</p>
            </div>
          ) : (
            <label className="block mb-6">
              <input type="file" accept="image/*" onChange={handleUploadId} className="hidden" />
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 cursor-pointer hover:border-dark transition">
                <p className="text-gray-400">{uploading ? "Загрузка..." : "Нажмите чтобы выбрать файл"}</p>
              </div>
            </label>
          )}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex gap-4 justify-center">
            <button onClick={() => setShowIdStep(false)} className="text-gray-500 hover:text-dark px-6 py-3 transition">
              &larr; Вернуться к вопросам
            </button>
            <button
              onClick={handleSubmit}
              disabled={!idFile || submitting}
              className="bg-dark text-white px-10 py-3 rounded-full font-bold hover:bg-accent hover:text-dark transition disabled:opacity-50"
            >
              {submitting ? "Отправка..." : "Отправить заявку"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold text-dark mb-1">Анкета</h1>
      <p className="text-gray-400 mb-8">{vacancyTitle}</p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}

      <div className="border border-gray-100 rounded-2xl p-8">
        {/* Progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">
            Вопрос {currentIdx + 1} из {totalQ}
          </span>
          <span className="text-sm text-gray-400">
            {saving ? "Сохранение..." : `Заполнено: ${answeredCount}/${totalQ}`}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
          <div className="bg-dark h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Category badge */}
        <div className="mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {currentQuestion.category === "experience" ? "Опыт" :
             currentQuestion.category === "competencies" ? "Компетенции" :
             currentQuestion.category === "motivation" ? "Мотивация" :
             currentQuestion.category === "potential" ? "Потенциал" :
             currentQuestion.category === "leadership" ? "Лидерство" : "Траектория роста"}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-xl font-bold text-dark mb-4 leading-relaxed">{currentQuestion.text}</h3>

        <textarea
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 h-36 text-sm outline-none focus:ring-2 focus:ring-dark resize-y"
          placeholder="Ваш ответ..."
          value={currentAnswer}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
        />
        <div className="text-right text-xs text-gray-400 mt-1">{currentAnswer.split(/\s+/).filter(Boolean).length} слов</div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button onClick={handlePrev} disabled={currentIdx === 0} className="text-gray-400 hover:text-dark disabled:opacity-30 transition">
            &larr; Назад
          </button>

          {isLast ? (
            <button
              onClick={handleFinishQuestions}
              disabled={!currentAnswer.trim()}
              className="bg-dark text-white px-8 py-2.5 rounded-full font-semibold hover:bg-accent hover:text-dark transition disabled:opacity-50"
            >
              Далее: загрузка документа
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!currentAnswer.trim()}
              className="bg-dark text-white px-6 py-2.5 rounded-full font-semibold hover:bg-gray-800 transition disabled:opacity-50"
            >
              Далее &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
