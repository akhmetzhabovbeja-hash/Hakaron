#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"hr@test.com","password":"password123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
H="Authorization: Bearer $TOKEN"
U="http://localhost:8000/api/v1/hr/ai-detect"

test_text() {
  local label=$1
  local file=$2
  result=$(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" --data-binary @"$file")
  score=$(echo "$result" | grep -o '"score":[0-9.]*' | cut -d: -f2)
  verdict=$(echo "$result" | grep -o '"verdict":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$label | Score: $score | $verdict"
}

# Create temp test files
cat > /tmp/t2.json << 'EOF'
{"text":"Я из Караганды, учусь в обычной школе. Год назад мой друг показал мне Python и меня затянуло. Сначала писал простые скрипты, потом сделал телеграм-бота для нашего класса который напоминал о домашке. Учителя были в шоке когда узнали что это я сделал. Хочу в inVision U чтобы прокачаться."}
EOF

cat > /tmp/t5.json << 'EOF'
{"text":"Безусловно, данный опыт оказал значительное влияние на мое профессиональное развитие. Следует отметить, что работа в команде позволила мне приобрести ценные навыки межличностного взаимодействия. Вместе с тем, я осознал важность системного подхода к решению сложных задач. Помимо этого, участие в проекте способствовало развитию аналитического мышления и способности принимать взвешенные решения в условиях неопределенности."}
EOF

cat > /tmp/t6.json << 'EOF'
{"text":"Когда я узнал что не прошел на олимпиаду по математике было очень обидно. Я готовился полгода каждый вечер решал задачи вместо того чтобы гулять с друзьями. Но потом мама сказала что поражения это часть пути и я решил попробовать снова. На следующий год занял второе место по области. Этот опыт научил меня что главное не сдаваться."}
EOF

cat > /tmp/t8.json << 'EOF'
{"text":"Я всегда мечтал создать что-то полезное для своего города. В прошлом году мы с друзьями организовали сбор пластика в нашем районе. Стоит отметить что это было непросто но результат превзошел ожидания. Мы собрали 2 тонны пластика за месяц. Таким образом наша инициатива показала что даже маленькие действия могут привести к большим переменам."}
EOF

cat > /tmp/t10.json << 'EOF'
{"text":"Нельзя не отметить, что программа inVision U представляет собой уникальную платформу для раскрытия потенциала молодых лидеров. В рамках данной программы студенты получают возможность развить критическое мышление и навыки командной работы. На основании вышеизложенного, я убежден что обучение в inVision U станет важным этапом моего профессионального становления. Кроме того, междисциплинарный подход программы позволит мне расширить кругозор и приобрести навыки необходимые для достижения поставленных целей."}
EOF

cat > /tmp/t11.json << 'EOF'
{"text":"Ну короче я в прошлом году участвовал в хакатоне и вообще-то это было очень круто. Мы с Арманом сидели до 4 утра и пытались починить баг в авторизации. Типа оказалось что мы пароли неправильно хэшировали блин. Не выиграли конечно но зато я щас нормально шарю в Docker и FastAPI, так что не зря время потратил."}
EOF

cat > /tmp/t12.json << 'EOF'
{"text":"Я хочу поступить в inVision U потому что вырос в маленьком ауле и видел как мало возможностей у талантливых ребят. В прошлом году я организовал кружок робототехники для 15 школьников и когда увидел их горящие глаза понял что хочу этим заниматься дальше. Мечтаю создать EdTech стартап."}
EOF

cat > /tmp/t15.json << 'EOF'
{"text":"Безусловно, стоит отметить, что данная программа представляет собой уникальную возможность для развития компетенций в области лидерства. Таким образом, необходимо подчеркнуть важность инновационного подхода к образованию. Кроме того, важно подчеркнуть, что подобные инициативы способствуют формированию нового поколения лидеров, готовых создавать позитивные изменения в обществе. Более того, комплексный подход к обучению позволяет раскрыть потенциал каждого участника программы."}
EOF

echo "==================== RESULTS ===================="
test_text " 2|RU Human student   " /tmp/t2.json
test_text " 5|RU AI Claude       " /tmp/t5.json
test_text " 6|RU Human emotional " /tmp/t6.json
test_text " 8|RU Mixed           " /tmp/t8.json
test_text "10|RU AI motivation   " /tmp/t10.json
test_text "11|RU Human slang     " /tmp/t11.json
test_text "12|RU Human formal    " /tmp/t12.json
test_text "15|RU AI 4phrases     " /tmp/t15.json

# English tests via inline
echo " 3|EN AI formal       | Score: $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"The intersection of technology and education presents unprecedented opportunities for transformative change. By harnessing the power of artificial intelligence and data-driven approaches, educational institutions can create personalized learning pathways. This holistic approach not only enhances academic outcomes but also fosters critical thinking and innovation among learners."}' | grep -o '"score":[0-9.]*' | cut -d: -f2) | $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"The intersection of technology and education presents unprecedented opportunities for transformative change. By harnessing the power of artificial intelligence and data-driven approaches, educational institutions can create personalized learning pathways. This holistic approach not only enhances academic outcomes but also fosters critical thinking and innovation among learners."}' | grep -o '"verdict":"[^"]*"' | head -1 | cut -d'"' -f4)"

echo " 4|EN Human personal   | Score: $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"Last summer I tried to build a mobile app for my grandmas recipe collection. It was a disaster at first because I had no idea what I was doing. I watched like 50 YouTube tutorials and broke everything twice. But eventually it worked and now she uses it every day."}' | grep -o '"score":[0-9.]*' | cut -d: -f2) | $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"Last summer I tried to build a mobile app for my grandmas recipe collection. It was a disaster at first because I had no idea what I was doing. I watched like 50 YouTube tutorials and broke everything twice. But eventually it worked and now she uses it every day."}' | grep -o '"verdict":"[^"]*"' | head -1 | cut -d'"' -f4)"

echo " 7|EN AI leadership    | Score: $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"Effective leadership in the 21st century requires a multifaceted approach that encompasses emotional intelligence, strategic thinking, and adaptive problem-solving. It is essential to cultivate an environment where diverse perspectives are valued. Furthermore, leaders must demonstrate resilience while maintaining a commitment to ethical decision-making."}' | grep -o '"score":[0-9.]*' | cut -d: -f2) | $(curl -s --max-time 30 -X POST $U -H "$H" -H "Content-Type: application/json" -d '{"text":"Effective leadership in the 21st century requires a multifaceted approach that encompasses emotional intelligence, strategic thinking, and adaptive problem-solving. It is essential to cultivate an environment where diverse perspectives are valued. Furthermore, leaders must demonstrate resilience while maintaining a commitment to ethical decision-making."}' | grep -o '"verdict":"[^"]*"' | head -1 | cut -d'"' -f4)"

echo "================================================="
