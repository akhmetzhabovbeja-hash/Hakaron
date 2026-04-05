#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"hr@test.com","password":"password123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
H="Authorization: Bearer $TOKEN"

echo "=== Creating Program 1: Foundation Year ==="
ID1=$(curl -s -X POST http://localhost:8000/api/v1/hr/vacancies -H "$H" -H "Content-Type: application/json" -d '{
  "title": "Foundation Year 2026",
  "description": "Годовая программа для талантливых выпускников школ из регионов Казахстана. Foundation Year \u2014 это год обучения на гранте, который помогает раскрыть потенциал молодых лидеров через академическую подготовку, развитие критического мышления и soft skills. Программа соединяет школу и университет, сочетая углублённое изучение английского языка, математики, цифровой грамотности с курсами по осознанному лидерству, дебатам и командной работе.",
  "requirements": "Выпускник 11 класса (2026 год). ЕНТ от 80 баллов. Мотивационное видео (до 5 минут). Готовность к переезду в Алматы на период обучения.",
  "application_deadline": "2026-05-30T23:59:00Z"
}' | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "Created vacancy ID: $ID1"

curl -s -X POST "http://localhost:8000/api/v1/hr/vacancies/$ID1/questions" -H "$H" -H "Content-Type: application/json" -d '{"question_ids": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}' > /dev/null
echo "Assigned 21 questions"

echo ""
echo "=== Creating Program 2: Digital Skills & AI ==="
ID2=$(curl -s -X POST http://localhost:8000/api/v1/hr/vacancies -H "$H" -H "Content-Type: application/json" -d '{
  "title": "Digital Skills & AI",
  "description": "Интенсивная 6-месячная программа для тех, кто хочет освоить цифровые навыки будущего. Студенты изучают программирование (Python, JavaScript), анализ данных, основы машинного обучения и работу с AI-инструментами. Особое внимание уделяется практическим проектам: каждый участник создаёт собственный продукт \u2014 от веб-приложения до AI-решения для реальной задачи. Программа включает менторство от ведущих специалистов IT-индустрии Казахстана.",
  "requirements": "Возраст 16-22 года. Базовые знания компьютера. Мотивация к обучению в сфере IT. Готовность посвящать программе минимум 20 часов в неделю.",
  "application_deadline": "2026-06-15T23:59:00Z"
}' | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "Created vacancy ID: $ID2"

curl -s -X POST "http://localhost:8000/api/v1/hr/vacancies/$ID2/questions" -H "$H" -H "Content-Type: application/json" -d '{"question_ids": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}' > /dev/null
echo "Assigned 21 questions"

echo ""
echo "=== Creating Program 3: Social Impact Lab ==="
ID3=$(curl -s -X POST http://localhost:8000/api/v1/hr/vacancies -H "$H" -H "Content-Type: application/json" -d '{
  "title": "Social Impact Lab",
  "description": "Программа для будущих социальных предпринимателей и лидеров изменений. Social Impact Lab учит превращать идеи в реальные проекты, которые решают проблемы местных сообществ. Участники проходят путь от формулирования социальной проблемы до создания устойчивого проекта: бизнес-моделирование, проектное управление, публичные выступления, привлечение ресурсов. Выпускники программы получают seed-грант до 500 000 тенге на реализацию лучших проектов.",
  "requirements": "Возраст 17-25 лет. Идея социального проекта (даже на начальной стадии). Опыт волонтёрства или общественной деятельности приветствуется. Готовность работать в команде.",
  "application_deadline": "2026-07-01T23:59:00Z"
}' | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "Created vacancy ID: $ID3"

curl -s -X POST "http://localhost:8000/api/v1/hr/vacancies/$ID3/questions" -H "$H" -H "Content-Type: application/json" -d '{"question_ids": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}' > /dev/null
echo "Assigned 21 questions"

echo ""
echo "=== Done! 3 programs created ==="
