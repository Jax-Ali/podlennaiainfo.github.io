document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkForm');
    const input = document.getElementById('factInput');
    const scannerBox = document.querySelector('.scanner-box');
    const resultArea = document.getElementById('resultArea');
    const loadingState = document.getElementById('loadingState');
    const finalResult = document.getElementById('finalResult');
    const progressFill = document.querySelector('.progress-fill');
    const loadingSteps = document.querySelectorAll('.loading-steps li');
    const resetBtn = document.getElementById('resetBtn');
    
    // Новые элементы:
    const tagBtns = document.querySelectorAll('.tag-btn');
    const confidenceCircle = document.getElementById('confidenceCircle');
    const confidenceValue = document.getElementById('confidenceValue');
    const historyList = document.getElementById('historyList');
    
    // Элементы продвинутых функций
    const resultActions = document.getElementById('resultActions');
    const shareTgBtn = document.getElementById('shareTgBtn');
    const shareWaBtn = document.getElementById('shareWaBtn');
    const downloadImageBtn = document.getElementById('downloadImageBtn');

    // UI Elements for result
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultDescription = document.getElementById('resultDescription');
    const sourceList = document.getElementById('sourceList');

    const API_KEY = 'AQ.Ab8RN6KT19SkWmPQYq_70X7aMqgCun_9VuvItWXNGvrZrm1QLw';

    const defaultIcons = {
        'true': '✅',
        'likely': '⚠️',
        'false': '❌',
        'unknown': '❓'
    };
    
    // Глобальная переменная для текущей проверки
    let currentCheckData = null;
    let typingTimeout;

    // Загрузка истории при старте
    loadHistory();

    // Быстрые теги
    tagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.textContent;
            form.dispatchEvent(new Event('submit')); 
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if(!text) return;

        startAnalysis(text);
    });

    resetBtn.addEventListener('click', () => {
        finalResult.classList.add('hidden');
        scannerBox.classList.remove('hidden');
        input.value = '';
        input.focus();
        
        finalResult.classList.remove('status-true', 'status-likely', 'status-false', 'status-unknown');
        clearTimeout(typingTimeout);
    });

    async function startAnalysis(text) {
        scannerBox.classList.add('hidden');
        resultArea.classList.remove('hidden');
        loadingState.classList.remove('hidden');
        finalResult.classList.add('hidden');
        resultActions.classList.add('hidden');

        // Сброс шкалы уверенности перед новым показом
        confidenceCircle.style.background = `conic-gradient(var(--glass-border) 0deg, rgba(255,255,255,0.02) 0deg)`;
        confidenceValue.textContent = '0%';

        let step = 0;
        updateStep(0);
        progressFill.style.width = '10%';

        // Определяем режим объяснения ИИ
        const mode = document.querySelector('input[name="explanationMode"]:checked').value;

        try {
            const fetchPromise = fetchFactCheck(text, mode);
            
            await new Promise(r => setTimeout(r, 800));
            progressFill.style.width = '40%';
            updateStep(1);

            const result = await fetchPromise;

            progressFill.style.width = '85%';
            updateStep(2);
            await new Promise(r => setTimeout(r, 500));

            progressFill.style.width = '100%';
            
            // Сохраняем для быстрых кнопок и истории
            currentCheckData = { text, result };
            
            saveToHistory({
                id: Date.now(),
                text: text,
                type: result.type,
                title: result.title,
                icon: result.icon || defaultIcons[result.type] || '❓',
                date: new Date().toLocaleDateString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            });

            setTimeout(() => {
                showResult(result);
            }, 300);

        } catch (error) {
            console.error('API Error:', error);
            progressFill.style.width = '100%';
            setTimeout(() => {
                showResult({
                    type: 'unknown',
                    title: 'Тексеру қатесі',
                    desc: 'Google Gemini нейрожелісіне қосылу сәтсіз аяқталды. Толығырақ: ' + error.message,
                    icon: '💥',
                    confidence: 0,
                    sources: []
                });
            }, 400);
        }
    }

    async function fetchFactCheck(text, mode) {
        let explanationStyle = "Ғылыми немесе ресми фактілерге сілтеме жасай отырып, егжей-тегжейлі аналитикалық түсіндірме (1-3 абзац). Ресми тонды қолдану.";
        
        if (mode === 'brief') {
            explanationStyle = "Өте қысқа және нұсқа түсіндірме (тура мағынасында 1-2 сөйлем, тек ең басты мәні).";
        } else if (mode === 'child') {
            explanationStyle = "Күрделі терминдерсіз, 10 жасар балаға арналғандай, өте қарапайым, мейірімді, қызықты және түсінікті тілмен түсіндіру.";
        }

        const prompt = `Сен қатал ЖИ-фактчекерсің. Мына пікірдің рас-өтірігін тексер: "${text}".

НАЗАР АУДАРЫҢЫЗ: Пікірдің тілін анықта (қазақ немесе орыс). Сенің жауабың (title, desc, name өрістері) ҚАТАҢ түрде қолданушы жазған тілде болуы тиіс! Егер мәтін қазақша болса, тек қазақша жауап бер. Егер орысша болса, орысша жаз.

Нәтижені ТЕК ҚАНА JSON ФОРМАТЫНДА қайтар. Ешқандай маркдаун болмасын.

JSON құрылымы:
{
  "type": "true" | "likely" | "false" | "unknown",
  "title": "Сұрау тіліндегі қысқаша мәртебе (мысалы: 'Толық шындық' / 'Абсолютная правда', 'Қастандық теориясы' / 'Теория заговора', 'Аңыз' / 'Миф')",
  "desc": "${explanationStyle} (міндетті түрде сұрау тілінде)",
  "confidence": 1-ден 100-ге дейінгі сан (үкімге деген сенімділігің),
  "sources": [
    {
      "name": "Дереккөздің атауы (сұрау тілінде)",
      "url": "https://нағыз-сілтеме-мүмкіндігінше"
    }
  ]
}

"type" кілті үшін (оларды ағылшын тілінде қалдыру): 
"true" = ғылыми немесе ресми түрде дәлелденген.
"likely" = жартылай шындық немесе ықтимал қауесет.
"false" = фейк, миф немесе жалған.
"unknown" = нақты дәлелдеу немесе жоққа шығару мүмкін емес.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Строгий тон
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        return JSON.parse(responseText);
    }

    function updateStep(index) {
        loadingSteps.forEach((li, i) => {
            if(i === index) li.classList.add('active');
            else li.classList.remove('active');
        });
    }

    function typeTextAnimated(element, text, speed = 15, callback) {
        element.textContent = '';
        element.classList.add('typing-cursor');
        let i = 0;
        
        clearTimeout(typingTimeout);
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                typingTimeout = setTimeout(type, speed);
            } else {
                element.classList.remove('typing-cursor');
                if(callback) callback();
            }
        }
        type();
    }

    function animateConfidence(targetConfidence, type) {
        let startValue = 0;
        let speed = 15;
        
        let color = 'var(--status-unknown)';
        if (type === 'true') color = 'var(--status-true)';
        if (type === 'likely') color = 'var(--status-likely)';
        if (type === 'false') color = 'var(--status-false)';

        if (!targetConfidence) targetConfidence = 0;

        let interval = setInterval(() => {
            if (startValue >= targetConfidence) {
                clearInterval(interval);
                return;
            }
            startValue++;
            confidenceValue.textContent = `${startValue}%`;
            confidenceCircle.style.background = `conic-gradient(${color} ${startValue * 3.6}deg, rgba(255,255,255,0.02) 0deg)`;
        }, speed);
    }

    function showResult(result) {
        loadingState.classList.add('hidden');
        
        const type = result.type || 'unknown';
        const conf = result.confidence || 0;
        
        finalResult.className = `state final-result glass-panel fade-in status-${type}`;
        resultIcon.textContent = result.icon || defaultIcons[type] || '❓';
        resultTitle.textContent = result.title || 'Статус анықталмады';
        
        // Очищаем старый текст
        resultDescription.textContent = '';

        // Отрисовка ссылок
        sourceList.innerHTML = '';
        if (result.sources && result.sources.length > 0) {
            result.sources.forEach(src => {
                const li = document.createElement('li');
                
                if(typeof src === 'string') {
                    li.innerHTML = `<span>📄 ${src}</span>`;
                } else if (src.url && src.url.startsWith('http')) {
                    li.innerHTML = `<span>🔗</span> <div>
                        <span class="link-title">${src.name || 'Ресми дереккөз'}</span>
                        <a href="${src.url}" target="_blank" rel="noopener noreferrer">${src.url}</a>
                    </div>`;
                } else {
                     li.innerHTML = `<span>📄 ${src.name || src.url || 'Атаусыз дереккөз'}</span>`;
                }
                sourceList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'Сенімді сілтемелер табылған жоқ.';
            sourceList.appendChild(li);
        }

        // Запуск анимаций: Шкала и Эффект печатной машинки
        animateConfidence(conf, type);
        
        const textToType = result.desc || 'Детальды сипаттама жоқ.';
        // Зависимость скорости печати от размера текста
        const typeSpeed = textToType.length > 200 ? 10 : 25; 
        
        typeTextAnimated(resultDescription, textToType, typeSpeed, () => {
             // Показываем кнопки шаринга только когда машинка допечатает
             resultActions.classList.remove('hidden');
        });

        progressFill.style.width = '0%';
        updateStep(0);
    }

    // --- Social Sharing ---
    shareTgBtn.addEventListener('click', () => {
        if(!currentCheckData) return;
        const icon = currentCheckData.result.icon || defaultIcons[currentCheckData.result.type];
        const shareText = `${icon} Фактіні тексеру:\n"${currentCheckData.text}"\n\nҮкім: ${currentCheckData.result.title}\n\n🕵️‍♂️ "ШындықӨлшемі" ЖИ тексерді`;
        window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`, '_blank');
    });

    shareWaBtn.addEventListener('click', () => {
        if(!currentCheckData) return;
        const icon = currentCheckData.result.icon || defaultIcons[currentCheckData.result.type];
        const shareText = `${icon} Фактіні тексеру:\n"${currentCheckData.text}"\n\nҮкім: ${currentCheckData.result.title}\n\n🕵️‍♂️ "ШындықӨлшемі" ЖИ тексерді`;
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    });

    // --- HTML to Image (Карточка разоблачения) ---
    downloadImageBtn.addEventListener('click', () => {
        const el = document.getElementById('finalResult');
        const actions = document.getElementById('resultActions');
        const sourcesUl = document.querySelector('.sources ul');
        
        // Временно убираем тени и кнопки для нормального скриншота
        const originalShadow = el.style.boxShadow;
        const origTransform = el.style.transform;
        const origMaxHeight = sourcesUl.style.maxHeight;
        
        el.style.boxShadow = 'none';
        el.style.transform = 'none';
        actions.style.display = 'none';
        sourcesUl.style.maxHeight = 'none'; // Показываем все источники для картинки
        
        // Маленький фикс цвета бэкграунда, так как стекло прозрачно
        html2canvas(el, {
            backgroundColor: '#0f172a',
            scale: 2 // Высокое качество (моб/ретины)
        }).then(canvas => {
            // Восстанавливаем дизайн
            el.style.boxShadow = originalShadow;
            el.style.transform = origTransform;
            actions.style.display = 'flex';
            sourcesUl.style.maxHeight = origMaxHeight;
            
            // Скачиваем
            const link = document.createElement('a');
            link.download = `ШындықӨлшемі_${currentCheckData.result.title.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error('Карточканы жасау қатесі:', err);
            el.style.boxShadow = originalShadow;
            el.style.transform = origTransform;
            actions.style.display = 'flex';
            sourcesUl.style.maxHeight = origMaxHeight;
        });
    });

    // --- History Functions ---
    function saveToHistory(record) {
        let history = JSON.parse(localStorage.getItem('factcheck_history') || '[]');
        history = history.filter(h => h.text !== record.text);
        history.unshift(record); 
        if (history.length > 15) history = history.slice(0, 15);
        
        localStorage.setItem('factcheck_history', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('factcheck_history') || '[]');
        if (history.length === 0) {
            historyList.innerHTML = '<p class="empty-history">Тарих әзірге бос. Алғашқы сұрауыңызды жасаңыз!</p>';
            return;
        }

        historyList.innerHTML = '';
        history.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-icon">${item.icon}</div>
                <div class="history-details">
                    <div class="history-query">"${item.text}"</div>
                    <div class="history-status">${item.title} • ${item.date}</div>
                </div>
            `;
            el.addEventListener('click', () => {
                input.value = item.text;
                document.getElementById('checkForm').dispatchEvent(new Event('submit'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            historyList.appendChild(el);
        });
    }
});
