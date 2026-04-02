#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"hr@test.com","password":"password123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

get() {
  local result=$(echo "$1" | curl -s --max-time 30 -X POST http://localhost:8000/api/v1/hr/ai-detect -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-)
  local score=$(echo "$result" | grep -o '"score":[0-9.]*' | head -1 | cut -d: -f2)
  local verdict=$(echo "$result" | grep -o '"verdict":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$score|$verdict"
}

echo "=== RUSSIAN AI TEXTS (should be >= 41) ==="

echo -n "R1  RU_AI essay:     "; get '{"text":"Образование является фундаментальной основой развития любого общества. Стоит отметить, что современные образовательные программы должны учитывать потребности быстро меняющегося мира. В первую очередь, необходимо обеспечить доступ к качественному образованию для всех слоёв населения. Комплексный подход к решению этой задачи позволит сформировать устойчивую систему подготовки кадров."}'

echo -n "R2  RU_AI review:    "; get '{"text":"Следует отметить, что данная инициатива представляет собой важный шаг в направлении модернизации образовательного процесса. Безусловно, интеграция технологий в обучение способствует повышению эффективности и качества подготовки специалистов. Вместе с тем, необходимо учитывать потенциальные риски и вызовы, связанные с цифровой трансформацией."}'

echo -n "R3  RU_AI project:   "; get '{"text":"В рамках данного проекта была разработана инновационная платформа для автоматизации процессов управления. Представляется целесообразным подчеркнуть, что использование передовых технологий позволило значительно оптимизировать рабочие процессы. Кроме того, внедрение системы способствовало повышению производительности и снижению затрат на операционную деятельность."}'

echo -n "R4  RU_AI leader:    "; get '{"text":"Лидерство в современных условиях требует комплексного подхода к управлению командой. Важно подчеркнуть, что эффективный лидер должен обладать навыками стратегического мышления и эмоционального интеллекта. Помимо этого, способность адаптироваться к изменяющимся условиям является ключевым фактором успеха в динамичной бизнес-среде."}'

echo -n "R5  RU_AI motivat:   "; get '{"text":"Мотивация к обучению играет ключевую роль в достижении академических успехов. Необходимо отметить, что внутренняя мотивация является более устойчивым фактором, чем внешние стимулы. Таким образом, создание условий для развития самомотивации представляет собой приоритетную задачу образовательных учреждений."}'

echo -n "R6  RU_AI future:    "; get '{"text":"Искусственный интеллект открывает беспрецедентные возможности для трансформации образовательного процесса. Стоит отметить, что персонализированные траектории обучения позволяют учитывать индивидуальные особенности каждого учащегося. Более того, автоматизация рутинных процессов освобождает время преподавателей для творческой работы и взаимодействия со студентами."}'

echo -n "R7  RU_AI social:    "; get '{"text":"Социальное предпринимательство представляет собой уникальную модель, которая объединяет коммерческую эффективность с социальной ответственностью. Нельзя не отметить, что подобные инициативы способствуют решению актуальных проблем общества. В конечном итоге, устойчивое развитие возможно только при условии интеграции экономических и социальных целей."}'

echo -n "R8  RU_AI ecology:   "; get '{"text":"Экологическая осознанность является важнейшим аспектом формирования ответственного гражданина. Безусловно, развитие экологического мышления должно начинаться с раннего возраста. Принимая во внимание глобальные вызовы изменения климата, необходимо подчеркнуть значимость образовательных программ в области устойчивого развития."}'

echo -n "R9  RU_AI tech:      "; get '{"text":"Цифровая трансформация оказывает значительное влияние на все сферы жизни общества. Следует отметить, что внедрение инновационных технологий требует комплексного подхода и системного планирования. Кроме того, важно обеспечить кибербезопасность и защиту персональных данных в условиях цифровизации."}'

echo -n "R10 RU_AI teamwork:  "; get '{"text":"Командная работа является неотъемлемым компонентом успешной реализации любого проекта. Важно подчеркнуть, что эффективное взаимодействие в коллективе основывается на взаимном уважении и доверии. На основании вышеизложенного, можно сделать вывод что развитие навыков командной работы представляет собой приоритетную задачу."}'

echo -n "R11 RU_AI innovat:   "; get '{"text":"Инновации являются движущей силой экономического прогресса. Стоит отметить, что создание благоприятной экосистемы для стартапов способствует развитию предпринимательского потенциала молодежи. Таким образом, поддержка инновационной деятельности представляет собой стратегически важное направление государственной политики."}'

echo -n "R12 RU_AI values:    "; get '{"text":"Формирование ценностных ориентиров молодого поколения является одной из ключевых задач системы образования. Необходимо отметить, что духовно-нравственное воспитание должно осуществляться в тесном взаимодействии семьи и образовательных учреждений. Подводя итог, следует подчеркнуть что именно система ценностей определяет траекторию личностного развития."}'

echo ""
echo "=== RUSSIAN HUMAN TEXTS (should be < 41) ==="

echo -n "R13 RU_Hum diary:   "; get '{"text":"Сегодня был ужасный день. Сначала проспал будильник потом автобус ушел прямо перед носом. На паре по физике получил двойку за лабу потому что забыл отчет дома. Единственное что спасло день это когда Даша угостила меня кофе и мы час просидели в кафешке обсуждая новый сезон сериала."}'

echo -n "R14 RU_Hum project: "; get '{"text":"Мы с ребятами решили сделать приложение для нашего аула. Идея простая - люди скидывают что им нужно из города и кто едет может захватить. Мой одноклассник Арман нарисовал дизайн а я пишу бекенд на Python. Пока работает криво но 20 человек уже пользуются. Дядя Берик вчера через нас заказал запчасти для трактора."}'

echo -n "R15 RU_Hum dream:   "; get '{"text":"Когда мне было 10 лет я увидел как папа чинит телевизор и мне стало жутко интересно как все устроено внутри. Начал разбирать все подряд мамин фен пульт от кондиционера старый телефон. Мама ругалась конечно но потом привыкла. Сейчас мне 17 и я могу собрать компьютер с закрытыми глазами."}'

echo -n "R16 RU_Hum fail:    "; get '{"text":"На хакатоне в Астане мы с командой полностью провалились. За 48 часов не смогли даже базу данных нормально настроить. Зато познакомился с крутыми ребятами из Алматы которые потом помогли мне разобраться в Docker. Теперь созваниваемся каждую неделю и делаем совместный проект."}'

echo -n "R17 RU_Hum volunt:  "; get '{"text":"Летом работал волонтером в детском лагере под Балхашом. Там был мальчик Асет 8 лет который вообще не разговаривал с другими детьми. Я начал с ним играть в шахматы каждый вечер. Через неделю он первый раз засмеялся а к концу смены уже бегал со всеми. Его мама потом позвонила и плакала от счастья."}'

echo -n "R18 RU_Hum school:  "; get '{"text":"Наш учитель информатики Кайрат Сериковуч реально крутой. Он вместо скучных презентаций дает нам делать реальные проекты. В прошлом семестре мы сделали чат-бота для школьной столовой чтобы можно было заранее заказать обед. Директор сначала был против но потом сам начал пользоваться."}'

echo -n "R19 RU_Hum sport:   "; get '{"text":"Три года занимаюсь боксом в секции у тренера Ермека. Первый бой проиграл за 30 секунд было стыдно перед пацанами. Тренер сказал что это нормально и что важнее встать чем не упасть. На прошлой неделе выиграл областной турнир и тренер прослезился. Говорит первый раз такое за 15 лет работы."}'

echo -n "R20 RU_Hum travel:  "; get '{"text":"Прошлым летом автостопом доехал до Алматы из Костаная за 3 дня. Мама чуть с ума не сошла когда узнала. Но это было лучшее приключение в жизни. Один дальнобойщик дядя Серик 6 часов рассказывал про свои поездки по всему Казахстану. Другой водитель угостил бешбармаком прямо в кабине."}'

echo -n "R21 RU_Hum code:    "; get '{"text":"Вчера до 3 ночи сидел фиксил баг в своем проекте. Оказалось я забыл await перед асинхронной функцией и данные приходили пустые. 5 часов потратил на поиск а решение было в одной строчке. Зато теперь точно запомню что в Python надо ждать корутины. Рассказал в чате одногруппникам все поржали."}'

echo -n "R22 RU_Hum family:  "; get '{"text":"Мой дедушка Кабыл ата прожил 92 года и до последнего дня рассказывал истории. Он помнил как строили первую школу в нашем ауле своими руками из самана. Говорил что образование это единственное что у тебя никто не отберет. Я поступаю в универ в том числе ради него."}'

echo -n "R23 RU_Hum idea:    "; get '{"text":"У меня есть идея сделать платформу где школьники из аулов могут найти менторов из города. Типа как Tinder но для учебы. Уже нарисовал прототип в Figma и показал трем учителям. Двое сказали что это круто а один сказал что я трачу время. Ну посмотрим кто прав через год."}'

echo -n "R24 RU_Hum honest:  "; get '{"text":"Честно говоря не знаю чем хочу заниматься в будущем. Мне нравится и программирование и биология и даже немного рисование. Мама говорит надо выбрать что-то одно но я не могу. Может inVision U поможет разобраться. Мой друг Данияр тоже подает заявку будет веселее вместе."}'

echo ""
echo "=== ENGLISH AI TEXTS (should be >= 41) ==="

echo -n "E1  EN_AI edtech:    "; get '{"text":"The transformative potential of educational technology cannot be overstated. It is important to note that digital learning platforms have revolutionized the way knowledge is disseminated and consumed. Furthermore, the integration of artificial intelligence in educational settings enables personalized learning experiences that cater to diverse student needs and learning styles."}'

echo -n "E2  EN_AI sustain:   "; get '{"text":"Sustainable development represents a paradigm shift in how societies approach economic growth and environmental stewardship. The multifaceted nature of sustainability requires a comprehensive strategy that balances ecological preservation with social equity. Moreover, stakeholders across all sectors must collaborate to implement innovative solutions that address these interconnected challenges."}'

echo -n "E3  EN_AI career:    "; get '{"text":"Career development in the modern era necessitates a proactive approach to skill acquisition and professional growth. It is essential to cultivate a diverse portfolio of competencies that align with the evolving demands of the labor market. Additionally, networking and mentorship play crucial roles in facilitating career advancement and opening doors to new opportunities."}'

echo -n "E4  EN_AI innovat:   "; get '{"text":"Innovation serves as the cornerstone of competitive advantage in the contemporary business landscape. Organizations must foster a culture of creativity and experimentation to remain relevant in an increasingly dynamic marketplace. Furthermore, the strategic implementation of emerging technologies can significantly enhance operational efficiency and drive sustainable growth."}'

echo -n "E5  EN_AI mental:    "; get '{"text":"Mental health awareness has emerged as a critical priority in educational institutions worldwide. It is crucial to acknowledge that psychological well-being directly impacts academic performance and overall student success. Consequently, comprehensive support systems must be established to address the growing prevalence of anxiety, depression, and other mental health challenges among young people."}'

echo -n "E6  EN_AI climate:   "; get '{"text":"Climate change represents one of the most pressing challenges facing humanity in the 21st century. The scientific consensus underscores the urgent need for collective action to mitigate greenhouse gas emissions and adapt to the inevitable consequences of global warming. Moreover, transitioning to renewable energy sources is not merely an environmental imperative but also an economic opportunity."}'

echo -n "E7  EN_AI diversity: "; get '{"text":"Diversity and inclusion are fundamental pillars of a thriving organizational culture. Research consistently demonstrates that diverse teams outperform homogeneous ones in terms of creativity and problem-solving capabilities. It is therefore imperative that institutions implement comprehensive strategies to ensure equitable representation and create environments where all individuals can flourish."}'

echo -n "E8  EN_AI entrep:    "; get '{"text":"Entrepreneurship education has gained significant traction as a means of fostering economic development and social innovation. By cultivating an entrepreneurial mindset, educational programs empower individuals to identify opportunities and develop viable solutions to pressing societal challenges. This approach not only stimulates economic growth but also contributes to building resilient communities."}'

echo ""
echo "=== ENGLISH HUMAN TEXTS (should be < 41) ==="

echo -n "E9  EN_Hum startup:  "; get '{"text":"My first startup was a total mess. We burned through 10k of our savings in 3 months building something nobody wanted. The pivot came when my cofounder Jake literally threw his laptop across the room and said we need to talk to actual users. Turns out the real problem was completely different from what we assumed. Lesson learned the hard way."}'

echo -n "E10 EN_Hum intern:   "; get '{"text":"Did my internship at a tiny startup in downtown Almaty last summer. The office was literally a converted apartment with beanbags instead of chairs. My boss Maria was 24 and already on her second company. I mostly fixed bugs and made coffee but honestly learned more in 3 months there than in 2 years of university classes."}'

echo -n "E11 EN_Hum college:  "; get '{"text":"College apps are stressing me out so much rn. My counselor keeps saying I need a hook but like what even is that. Im not an Olympic athlete or a child prodigy. Im just a kid from a small town who likes coding and playing guitar. Maybe thats enough? My older sister says just be honest and it will work out. Hope shes right."}'

echo -n "E12 EN_Hum hack:     "; get '{"text":"48 hours no sleep 17 Red Bulls and a working prototype. Thats what hackathons are about baby. Our team of 4 built a food waste app that connects restaurants with food banks. We didnt win the grand prize but got honorable mention and two VCs gave us their cards. Still riding that high a week later honestly."}'

echo -n "E13 EN_Hum debug:    "; get '{"text":"Found the weirdest bug today. Our payment system was charging people exactly twice but only on Tuesdays. Spent 6 hours going through logs before I realized the cron job for retries was set to run at the same time as the weekly database backup which caused a deadlock. Changed the cron schedule by 5 minutes and boom fixed."}'

echo -n "E14 EN_Hum teach:    "; get '{"text":"Started tutoring math to middle schoolers at the community center. This one kid Ahmed went from failing to getting a B minus in 2 months. His mom brought me homemade baklava and cried. Im not gonna lie I cried too. This is why I want to go into education. The money will suck but moments like that are worth everything."}'

echo -n "E15 EN_Hum travel:   "; get '{"text":"Backpacked through Central Asia with nothing but a 30L bag and terrible Kazakh language skills. Got lost in Shymkent at 2am and a taxi driver let me sleep at his house. His wife made me breakfast and their kid wanted to practice English with me. Ended up staying 3 days. Some of the best people I ever met and I almost skipped that city."}'

echo -n "E16 EN_Hum gaming:   "; get '{"text":"Been building this indie game for 2 years in my spare time. Its a roguelike about a postman delivering mail in post-apocalyptic Kazakhstan. Nobody asked for this game but I cant stop working on it. Got 50 wishlists on Steam which is basically nothing but every single one makes me stupidly happy. My girlfriend thinks Im insane and shes probably right."}'