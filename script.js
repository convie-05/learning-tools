const STORAGE_KEY = 'vocab_words';
const STATS_KEY = 'vocab_stats';
const AI_BASE_URL_KEY = 'vocab_ai_base_url';
const ARTICLE_WORDS_KEY = 'vocab_article_words';
const ARTICLE_SETTINGS_KEY = 'vocab_article_settings';
const DEFAULT_AI_BASE_URL = 'http://localhost:3000';

let words = [];
let articleWords = [];
let studyIndex = 0;
let correctCount = 0;
let quizCount = 0;
let currentFilter = '';
let currentSort = 'newest';
let aiConfig = null;

function loadWords() {
    const storedWords = localStorage.getItem(STORAGE_KEY);
    const storedStats = localStorage.getItem(STATS_KEY);
    const storedAiBaseUrl = localStorage.getItem(AI_BASE_URL_KEY);
    const storedArticleWords = localStorage.getItem(ARTICLE_WORDS_KEY);
    const storedArticleSettings = localStorage.getItem(ARTICLE_SETTINGS_KEY);

    if (storedWords) {
        try {
            words = JSON.parse(storedWords);
        } catch (error) {
            words = [];
        }
    }

    if (storedStats) {
        try {
            const stats = JSON.parse(storedStats);
            correctCount = Number(stats.correctCount) || 0;
            quizCount = Number(stats.quizCount) || 0;
        } catch (error) {
            correctCount = 0;
            quizCount = 0;
        }
    }

    if (storedArticleWords) {
        try {
            articleWords = JSON.parse(storedArticleWords)
                .map(item => String(item || '').trim())
                .filter(Boolean);
        } catch (error) {
            articleWords = [];
        }
    }

    if (storedArticleSettings) {
        try {
            const settings = JSON.parse(storedArticleSettings);
            document.getElementById('articleLevel').value = settings.level || 'easy';
            document.getElementById('articleLength').value = settings.length || 'short';
            document.getElementById('articlePrompt').value = settings.prompt || '';
        } catch (error) {
            document.getElementById('articleLevel').value = 'easy';
            document.getElementById('articleLength').value = 'short';
            document.getElementById('articlePrompt').value = '';
        }
    }

    document.getElementById('aiBaseUrl').value = storedAiBaseUrl || DEFAULT_AI_BASE_URL;
    renderWordList();
    renderStudyCard();
    renderArticleWords();
    resetAiStatus();
}

function saveWords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify({ correctCount, quizCount }));
}

function saveAiBaseUrl() {
    const value = document.getElementById('aiBaseUrl').value.trim() || DEFAULT_AI_BASE_URL;
    localStorage.setItem(AI_BASE_URL_KEY, value);
}

function saveArticleWords() {
    localStorage.setItem(ARTICLE_WORDS_KEY, JSON.stringify(articleWords));
}

function saveArticleSettings() {
    localStorage.setItem(ARTICLE_SETTINGS_KEY, JSON.stringify({
        level: document.getElementById('articleLevel').value,
        length: document.getElementById('articleLength').value,
        prompt: document.getElementById('articlePrompt').value.trim()
    }));
}

function normalizeWord(word) {
    return String(word || '').trim().toLowerCase();
}

function showFormTip(message, type = 'info') {
    const tip = document.getElementById('formTip');
    tip.textContent = message;
    tip.className = `form-tip ${type}`;
}

function showArticleWordsTip(message, type = 'info') {
    const tip = document.getElementById('articleWordsTip');
    tip.textContent = message;
    tip.className = `form-tip ${type}`;
}

function setAiStatus(status, text, hint = '') {
    const badge = document.getElementById('aiStatusBadge');
    const hintElement = document.getElementById('aiStatusHint');
    badge.textContent = text;
    badge.className = `ai-status-badge ${status}`;
    if (hint) {
        hintElement.textContent = hint;
    }
}

function updateAiConfigInfo(configData) {
    document.getElementById('aiModelInfo').textContent = configData?.model || '-';
    document.getElementById('aiQuestionLimit').textContent = configData?.questionMaxLength ? `${configData.questionMaxLength} 字` : '-';
    document.getElementById('aiWordLimit').textContent = configData?.maxWordList ? `${configData.maxWordList} 个` : '-';

    if (configData?.rateLimit?.maxRequests && configData?.rateLimit?.windowMs) {
        document.getElementById('aiRateLimitInfo').textContent = `${configData.rateLimit.maxRequests} 次 / ${Math.round(configData.rateLimit.windowMs / 1000)} 秒`;
    } else {
        document.getElementById('aiRateLimitInfo').textContent = '-';
    }
}

function resetAiStatus() {
    aiConfig = null;
    updateAiConfigInfo(null);
    setAiStatus('idle', '未检测', '点击检测后会自动读取后端配置。');
}

function addWord(e) {
    e.preventDefault();
    const word = document.getElementById('word').value.trim();
    const meaning = document.getElementById('meaning').value.trim();
    const example = document.getElementById('example').value.trim();

    if (!word || !meaning) {
        showFormTip('请先填写英文单词和中文释义。', 'error');
        return;
    }

    const duplicated = words.find(item => normalizeWord(item.word) === normalizeWord(word));
    if (duplicated) {
        showFormTip(`单词“${word}”已存在，请直接编辑原条目。`, 'error');
        openEditModal(duplicated.id);
        return;
    }

    words.unshift({
        id: Date.now(),
        word,
        meaning,
        example,
        addedAt: new Date().toLocaleDateString('zh-CN')
    });

    saveWords();
    renderWordList();
    renderStudyCard();
    document.getElementById('wordForm').reset();
    showFormTip(`已添加单词：${word}`, 'success');
}

function getFilteredWords() {
    const keyword = currentFilter.trim().toLowerCase();
    let result = [...words];

    if (keyword) {
        result = result.filter(item => {
            const text = [item.word, item.meaning, item.example].filter(Boolean).join(' ').toLowerCase();
            return text.includes(keyword);
        });
    }

    result.sort((a, b) => {
        if (currentSort === 'oldest') {
            return a.id - b.id;
        }
        if (currentSort === 'az') {
            return a.word.localeCompare(b.word, 'en');
        }
        if (currentSort === 'za') {
            return b.word.localeCompare(a.word, 'en');
        }
        return b.id - a.id;
    });

    return result;
}

function renderWordList() {
    const list = document.getElementById('wordList');
    const clearBtn = document.getElementById('clearBtn');
    const filteredWords = getFilteredWords();

    document.getElementById('wordCount').textContent = words.length;
    document.getElementById('quizCount').textContent = quizCount;
    document.getElementById('correctRate').textContent = quizCount === 0 ? '0%' : `${Math.round((correctCount / quizCount) * 100)}%`;
    clearBtn.style.display = words.length > 0 ? 'inline-block' : 'none';

    if (words.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div>📝</div>
                <p>暂无单词，请添加单词开始学习</p>
            </div>
        `;
        return;
    }

    if (filteredWords.length === 0) {
        list.innerHTML = `
            <div class="empty-state compact-empty-state">
                <div>🔎</div>
                <p>没有找到匹配的单词，请尝试其他关键词。</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredWords.map(item => `
        <div class="word-item">
            <div class="word-info">
                <div class="word">${escapeHtml(item.word)}</div>
                <div class="meaning">${escapeHtml(item.meaning)}</div>
                ${item.example ? `<div class="example">${escapeHtml(item.example)}</div>` : ''}
                <div class="word-date">添加于 ${item.addedAt}</div>
            </div>
            <div class="word-actions">
                <button class="action-btn edit" onclick="openEditModal(${item.id})">编辑</button>
                <button class="action-btn delete" onclick="deleteWord(${item.id})">删除</button>
            </div>
        </div>
    `).join('');
}

function renderArticleWords() {
    const list = document.getElementById('articleWordList');

    if (articleWords.length === 0) {
        list.innerHTML = `
            <div class="empty-state compact-empty-state">
                <div>🪄</div>
                <p>暂未添加文章专用单词</p>
            </div>
        `;
        return;
    }

    list.innerHTML = articleWords.map((word, index) => `
        <div class="article-word-item">
            <input
                type="text"
                class="article-word-input"
                value="${escapeHtml(word)}"
                oninput="updateArticleWord(${index}, this.value)"
                aria-label="文章单词 ${index + 1}"
            >
            <button class="action-btn delete" type="button" onclick="removeArticleWord(${index})">删除</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function deleteWord(id) {
    if (!confirm('确定要删除这个单词吗？')) {
        return;
    }

    words = words.filter(item => item.id !== id);
    if (studyIndex >= words.length) {
        studyIndex = 0;
    }
    saveWords();
    renderWordList();
    renderStudyCard();
}

function clearAllWords() {
    if (!confirm('确定要清空所有单词吗？此操作不可恢复！')) {
        return;
    }

    words = [];
    studyIndex = 0;
    saveWords();
    renderWordList();
    renderStudyCard();
    showFormTip('已清空全部单词。', 'info');
}

function openEditModal(id) {
    const word = words.find(item => item.id === id);
    if (!word) {
        return;
    }

    document.getElementById('editId').value = word.id;
    document.getElementById('editWord').value = word.word;
    document.getElementById('editMeaning').value = word.meaning;
    document.getElementById('editExample').value = word.example;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEdit(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editId').value, 10);
    const word = document.getElementById('editWord').value.trim();
    const meaning = document.getElementById('editMeaning').value.trim();
    const example = document.getElementById('editExample').value.trim();

    if (!word || !meaning) {
        return;
    }

    const duplicated = words.find(item => item.id !== id && normalizeWord(item.word) === normalizeWord(word));
    if (duplicated) {
        alert(`单词“${word}”已存在，请不要重复保存。`);
        return;
    }

    const index = words.findIndex(item => item.id === id);
    if (index === -1) {
        return;
    }

    words[index] = {
        ...words[index],
        word,
        meaning,
        example
    };

    saveWords();
    renderWordList();
    renderStudyCard();
    closeEditModal();
    showFormTip(`已更新单词：${word}`, 'success');
}

function addArticleWord() {
    const input = document.getElementById('articleWordInput');
    const word = input.value.trim();

    if (!word) {
        showArticleWordsTip('请先输入要用于生成文章的单词。', 'error');
        return;
    }

    const duplicated = articleWords.some(item => normalizeWord(item) === normalizeWord(word));
    if (duplicated) {
        showArticleWordsTip(`文章词库中已存在“${word}”。`, 'error');
        return;
    }

    articleWords.push(word);
    saveArticleWords();
    renderArticleWords();
    input.value = '';
    showArticleWordsTip(`已加入文章词库：${word}`, 'success');
}

function updateArticleWord(index, value) {
    const trimmedValue = String(value || '').trim();
    articleWords[index] = trimmedValue;
    articleWords = articleWords.filter(Boolean);
    saveArticleWords();
    renderArticleWords();
}

function removeArticleWord(index) {
    articleWords.splice(index, 1);
    saveArticleWords();
    renderArticleWords();
    showArticleWordsTip('已从文章词库删除单词。', 'info');
}

function fillArticleWordsFromExisting() {
    if (words.length === 0) {
        showArticleWordsTip('当前没有现有单词可导入。', 'error');
        return;
    }

    const mergedWords = [...articleWords];
    words.forEach(item => {
        if (!mergedWords.some(word => normalizeWord(word) === normalizeWord(item.word))) {
            mergedWords.push(item.word);
        }
    });

    articleWords = mergedWords;
    saveArticleWords();
    renderArticleWords();
    showArticleWordsTip('已把现有单词复制到文章词库，原单词列表未被修改。', 'success');
}

function renderStudyCard() {
    const studyCard = document.getElementById('studyCard');
    const quizInput = document.getElementById('quizInput');
    const quizResult = document.getElementById('quizResult');
    const studyControls = document.getElementById('studyControls');

    quizInput.value = '';
    quizResult.textContent = '';
    quizResult.className = 'quiz-result';

    if (words.length === 0) {
        studyCard.classList.remove('revealed');
        studyCard.innerHTML = `
            <div class="empty-state">
                <div>🎯</div>
                <p>添加单词后可在这里背诵和测验</p>
            </div>
        `;
        studyControls.style.display = 'none';
        return;
    }

    if (studyIndex >= words.length) {
        studyIndex = 0;
    }

    studyControls.style.display = 'block';
    const current = words[studyIndex];
    studyCard.classList.remove('revealed');
    studyCard.innerHTML = `
        <div class="study-word">${escapeHtml(current.word)}</div>
        <div class="study-meaning">${escapeHtml(current.meaning)}</div>
        ${current.example ? `<div class="study-example">${escapeHtml(current.example)}</div>` : ''}
    `;
}

function revealMeaning() {
    document.getElementById('studyCard').classList.add('revealed');
}

function nextWord() {
    if (words.length === 0) {
        return;
    }

    studyIndex = (studyIndex + 1) % words.length;
    renderStudyCard();
}

function randomWord() {
    if (words.length === 0) {
        return;
    }

    studyIndex = Math.floor(Math.random() * words.length);
    renderStudyCard();
}

function normalizeMeaningText(text) {
    return String(text || '')
        .replace(/[，,、;；。.!！?？]/g, '/')
        .replace(/\s+/g, '')
        .toLowerCase();
}

function splitMeanings(text) {
    return normalizeMeaningText(text)
        .split('/')
        .map(item => item.trim())
        .filter(Boolean);
}

function checkAnswer() {
    if (words.length === 0) {
        return;
    }

    const input = document.getElementById('quizInput').value.trim();
    const result = document.getElementById('quizResult');
    const answer = words[studyIndex].meaning.trim();

    if (!input) {
        result.textContent = '请先输入中文释义';
        result.className = 'quiz-result wrong';
        return;
    }

    quizCount++;

    const answerList = splitMeanings(answer);
    const inputList = splitMeanings(input);
    const isCorrect = inputList.some(userItem => answerList.some(answerItem => userItem === answerItem || answerItem.includes(userItem) || userItem.includes(answerItem)));

    if (isCorrect) {
        correctCount++;
        result.textContent = '回答正确！';
        result.className = 'quiz-result correct';
    } else {
        result.textContent = `再想想，参考答案：${answer}`;
        result.className = 'quiz-result wrong';
    }

    saveStats();
    revealMeaning();
    renderWordList();
}

function exportToPDF() {
    if (words.length === 0) {
        alert('请先添加单词再导出');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('Vocabulary List', 14, 20);

    const tableData = words.map((item, index) => [
        index + 1,
        item.word,
        item.meaning,
        item.example || '',
        item.addedAt || ''
    ]);

    doc.autoTable({
        startY: 28,
        head: [['#', 'Word', 'Meaning', 'Example', 'Date']],
        body: tableData,
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 3,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [102, 126, 234]
        },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 35 },
            2: { cellWidth: 55 },
            3: { cellWidth: 60 },
            4: { cellWidth: 25 }
        }
    });

    doc.save('vocabulary-list.pdf');
}

function exportToJSON() {
    if (words.length === 0) {
        alert('请先添加单词再导出');
        return;
    }

    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vocabulary-list.json';
    link.click();
    URL.revokeObjectURL(url);
}

function handleImportClick() {
    document.getElementById('importFile').click();
}

function importFromJSON(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function loadJson() {
        try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data)) {
                throw new Error('JSON 格式不正确');
            }

            const sanitizedWords = data
                .filter(item => item && typeof item === 'object')
                .map((item, index) => ({
                    id: Date.now() + index,
                    word: String(item.word || '').trim(),
                    meaning: String(item.meaning || '').trim(),
                    example: String(item.example || '').trim(),
                    addedAt: item.addedAt || new Date().toLocaleDateString('zh-CN')
                }))
                .filter(item => item.word && item.meaning);

            if (sanitizedWords.length === 0) {
                throw new Error('没有可导入的单词');
            }

            const existingMap = new Map(words.map(item => [normalizeWord(item.word), item]));
            sanitizedWords.forEach(item => {
                existingMap.set(normalizeWord(item.word), {
                    ...item,
                    id: existingMap.get(normalizeWord(item.word))?.id || item.id
                });
            });

            words = Array.from(existingMap.values()).sort((a, b) => b.id - a.id);
            saveWords();
            renderWordList();
            renderStudyCard();
            showFormTip(`已成功导入 ${sanitizedWords.length} 个单词。`, 'success');
        } catch (error) {
            alert(`导入失败：${error.message}`);
        } finally {
            event.target.value = '';
        }
    };

    reader.readAsText(file, 'utf-8');
}

function getAiBaseUrl() {
    const value = document.getElementById('aiBaseUrl').value.trim();
    return (value || DEFAULT_AI_BASE_URL).replace(/\/$/, '');
}

async function loadAiConfig() {
    const baseUrl = getAiBaseUrl();
    setAiStatus('loading', '检测中', '正在尝试连接 AI 服务并读取配置...');

    try {
        saveAiBaseUrl();
        const response = await fetch(`${baseUrl}/api/config`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '读取 AI 配置失败。');
        }

        aiConfig = data;
        updateAiConfigInfo(data);

        if (Array.isArray(data.modes) && data.modes.length > 0) {
            syncAiModes(data.modes);
        }

        setAiStatus('success', '已连接', `已连接到 ${baseUrl}，当前模型：${data.model}`);
    } catch (error) {
        aiConfig = null;
        updateAiConfigInfo(null);
        let hint = `读取配置失败：${error.message}`;
        // 给未启动后端的用户更明确的提示
        if (error.message.includes('fetch') || error.message.includes('连接') || error.message.includes('拒绝') || error.message.includes('超时')) {
            hint = `连接失败！AI后端服务未启动。\n👉 请先在命令行里进入 vocab-app 目录，运行：node ai-server.js`;
        }
        setAiStatus('error', '连接失败', hint);
    }
}

function syncAiModes(modes) {
    const select = document.getElementById('aiMode');
    const currentValue = select.value;
    const labels = {
        answer: '答题解析',
        explainWord: '单词讲解',
        makeQuiz: '生成练习',
        explainMistake: '错题讲解',
        makeArticle: '生成记忆文章'
    };

    select.innerHTML = modes
        .map(mode => `<option value="${mode}">${labels[mode] || mode}</option>`)
        .join('');

    if (modes.includes(currentValue)) {
        select.value = currentValue;
    }
}

async function askAi() {
    const questionInput = document.getElementById('aiQuestion');
    const mode = document.getElementById('aiMode').value;
    const answerBox = document.getElementById('aiAnswer');
    const question = questionInput.value.trim();

    if (!question) {
        answerBox.textContent = '请先输入题目、单词或你的疑问。';
        answerBox.className = 'ai-answer error';
        return;
    }

    if (aiConfig?.questionMaxLength && question.length > aiConfig.questionMaxLength) {
        answerBox.textContent = `问题过长，当前服务限制为 ${aiConfig.questionMaxLength} 个字符。`;
        answerBox.className = 'ai-answer error';
        return;
    }

    const payloadWordsSource = mode === 'makeArticle'
        ? articleWords.map(word => ({ word, meaning: '文章专用词', example: '' }))
        : words;
    const payloadWords = aiConfig?.maxWordList ? payloadWordsSource.slice(0, aiConfig.maxWordList) : payloadWordsSource;

    answerBox.textContent = 'AI 正在生成答案...';
    answerBox.className = 'ai-answer loading';

    try {
        saveAiBaseUrl();
        const response = await fetch(`${getAiBaseUrl()}/api/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question,
                mode,
                wordList: payloadWords
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'AI 服务请求失败。');
        }

        answerBox.innerHTML = renderMarkdown(data.answer);
        answerBox.className = 'ai-answer markdown-body';
        setAiStatus('success', '已连接', '请求成功，AI 服务响应正常。');
    } catch (error) {
        let hint = `AI请求失败：${error.message}`;
        if (error.message.includes('fetch') || error.message.includes('连接') || error.message.includes('拒绝') || error.message.includes('超时') || error.message.includes('Failed to fetch')) {
            hint = `❌ AI后端未连接！\n👉 请先启动后端：在vocab-app目录运行 node ai-server.js\n👉 启动后再点「检测AI服务」按钮`;
        } else if (error.message.includes('未配置AI_API_KEY')) {
            hint = `⚠️ ${error.message}\n👉 PowerShell配置：$env:AI_API_KEY="你的AI密钥" （如DeepSeek密钥）`;
        }
        answerBox.textContent = hint;
        answerBox.className = 'ai-answer error';
        setAiStatus('error', '连接失败', hint);
    }
}

async function generateArticle() {
    const output = document.getElementById('articleOutput');
    const customPrompt = document.getElementById('articlePrompt').value.trim();
    const level = document.getElementById('articleLevel').value;
    const length = document.getElementById('articleLength').value;

    if (articleWords.length === 0) {
        output.textContent = '请先添加一些文章专用单词，再生成记忆文章。';
        output.className = 'article-output error';
        showArticleWordsTip('请先添加文章专用单词。', 'error');
        return;
    }

    saveArticleSettings();

    const levelText = {
        easy: '简单，适合初学者',
        medium: '中等，适合有一定基础的学习者',
        hard: '较难，适合进阶学习者'
    }[level] || '中等';

    const lengthText = {
        short: '120 到 180 词',
        medium: '220 到 320 词',
        long: '350 到 500 词'
    }[length] || '220 到 320 词';

    const question = [
        '请使用我提供的单词生成一篇适合背单词学习的英语文章。',
        `文章难度：${levelText}。`,
        `文章长度：${lengthText}。`,
        '要求：尽量自然地使用所有给定单词；先输出英文文章，再输出中文梗概，最后列出文中每个目标单词对应的语境提示。',
        customPrompt ? `额外要求：${customPrompt}` : ''
    ].filter(Boolean).join('\n');

    output.textContent = 'AI 正在生成记忆文章...';
    output.className = 'article-output loading';

    try {
        saveAiBaseUrl();
        const payloadWords = aiConfig?.maxWordList
            ? articleWords.slice(0, aiConfig.maxWordList)
            : articleWords;
        const response = await fetch(`${getAiBaseUrl()}/api/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question,
                mode: 'makeArticle',
                wordList: payloadWords.map(word => ({
                    word,
                    meaning: '文章专用词',
                    example: ''
                }))
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'AI 服务请求失败。');
        }

        output.innerHTML = renderMarkdown(data.answer);
        output.className = 'article-output markdown-body';
        setAiStatus('success', '已连接', 'AI 文章生成成功。');
    } catch (error) {
        let hint = `AI文章生成失败：${error.message}`;
        if (error.message.includes('fetch') || error.message.includes('连接') || error.message.includes('拒绝') || error.message.includes('超时') || error.message.includes('Failed to fetch')) {
            hint = `❌ AI后端未连接！\n👉 请先启动后端：在vocab-app目录运行 node ai-server.js\n👉 启动后再点「生成文章」按钮`;
        } else if (error.message.includes('未配置AI_API_KEY')) {
            hint = `⚠️ ${error.message}\n👉 PowerShell配置：$env:AI_API_KEY="你的AI密钥" （如DeepSeek密钥）`;
        }
        output.textContent = hint;
        output.className = 'article-output error';
        setAiStatus('error', '连接失败', hint);
    }
}

function useCurrentWordForAi() {
    const answerBox = document.getElementById('aiAnswer');
    if (words.length === 0) {
        answerBox.textContent = '当前还没有单词，请先添加单词。';
        answerBox.className = 'ai-answer error';
        return;
    }

    const current = words[studyIndex];
    document.getElementById('aiMode').value = 'explainWord';
    document.getElementById('aiQuestion').value = `${current.word}\n中文释义：${current.meaning}${current.example ? `\n例句：${current.example}` : ''}`;
    answerBox.textContent = '已填入当前单词，点击“AI 生成答案”即可讲解。';
    answerBox.className = 'ai-answer markdown-body';
}

document.getElementById('wordForm').addEventListener('submit', addWord);
document.getElementById('editForm').addEventListener('submit', saveEdit);
document.getElementById('revealBtn').addEventListener('click', revealMeaning);
document.getElementById('nextBtn').addEventListener('click', nextWord);
document.getElementById('randomBtn').addEventListener('click', randomWord);
document.getElementById('checkBtn').addEventListener('click', checkAnswer);
document.getElementById('askAiBtn').addEventListener('click', askAi);
document.getElementById('useCurrentWordBtn').addEventListener('click', useCurrentWordForAi);
document.getElementById('checkAiBtn').addEventListener('click', loadAiConfig);
document.getElementById('clearBtn').addEventListener('click', clearAllWords);
document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
document.getElementById('exportJsonBtn').addEventListener('click', exportToJSON);
document.getElementById('importJsonBtn').addEventListener('click', handleImportClick);
document.getElementById('importFile').addEventListener('change', importFromJSON);
document.getElementById('addArticleWordBtn').addEventListener('click', addArticleWord);
document.getElementById('fillArticleWordsBtn').addEventListener('click', fillArticleWordsFromExisting);
document.getElementById('generateArticleBtn').addEventListener('click', generateArticle);
document.getElementById('articleWordInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addArticleWord();
    }
});
document.getElementById('articleLevel').addEventListener('change', saveArticleSettings);
document.getElementById('articleLength').addEventListener('change', saveArticleSettings);
document.getElementById('articlePrompt').addEventListener('change', saveArticleSettings);
document.getElementById('searchInput').addEventListener('input', event => {
    currentFilter = event.target.value;
    renderWordList();
});
document.getElementById('sortSelect').addEventListener('change', event => {
    currentSort = event.target.value;
    renderWordList();
});
document.getElementById('quizInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        checkAnswer();
    }
});
document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
document.getElementById('aiBaseUrl').addEventListener('change', () => {
    saveAiBaseUrl();
    resetAiStatus();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeEditModal();
    }
});

window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
};

window.updateArticleWord = updateArticleWord;
window.removeArticleWord = removeArticleWord;
window.openEditModal = openEditModal;
window.deleteWord = deleteWord;

loadWords();
