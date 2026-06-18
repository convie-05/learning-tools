const APP = {
  STORAGE_KEY: 'vocab_words',
  STATS_KEY: 'vocab_stats',
  AI_BASE_URL_KEY: 'vocab_ai_base_url',
  ARTICLE_WORDS_KEY: 'vocab_article_words',
  ARTICLE_SETTINGS_KEY: 'vocab_article_settings',
  PAGESIZE_KEY: 'vocab_page_size',
  DEFAULT_AI_BASE_URL: 'http://localhost:3000',

  words: [],
  articleWords: [],
  studyIndex: 0,
  correctCount: 0,
  quizCount: 0,
  currentFilter: '',
  currentSort: 'newest',
  currentPage: 1,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  aiConfig: null,
  aiPagination: { rawHtml: '', pages: [], currentPage: 1, totalPages: 0 },

  toastTimer: null,
};

function $(id) { return document.getElementById(id); }

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showTip(msg, type = 'info', targetId = 'formTip') {
  const el = $(targetId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'form-tip ' + type;
}

function toast(msg, type = 'info') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(APP.toastTimer);
  APP.toastTimer = setTimeout(() => { t.className = 'toast'; }, 2200);
}

function normalizeWord(w) { return String(w || '').trim().toLowerCase(); }

function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = $('section-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.nav-btn[data-section="' + name + '"]');
  if (btn) btn.classList.add('active');
  if (name === 'study') renderStudyCard();
  if (name === 'words') renderWordList();
  if (name === 'article') renderArticleWords();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadWords() {
  try { APP.words = JSON.parse(localStorage.getItem(APP.STORAGE_KEY)) || []; } catch(e) { APP.words = []; }
  try {
    const s = JSON.parse(localStorage.getItem(APP.STATS_KEY));
    APP.correctCount = Number(s.correctCount) || 0;
    APP.quizCount = Number(s.quizCount) || 0;
  } catch(e) { APP.correctCount = 0; APP.quizCount = 0; }
  try { APP.articleWords = JSON.parse(localStorage.getItem(APP.ARTICLE_WORDS_KEY)) || []; } catch(e) { APP.articleWords = []; }
  try {
    const s = JSON.parse(localStorage.getItem(APP.ARTICLE_SETTINGS_KEY));
    if (s) {
      if ($('articleLevel')) $('articleLevel').value = s.level || 'easy';
      if ($('articleLength')) $('articleLength').value = s.length || 'short';
      if ($('articlePrompt')) $('articlePrompt').value = s.prompt || '';
    }
  } catch(e) {}
  const storedUrl = localStorage.getItem(APP.AI_BASE_URL_KEY) || APP.DEFAULT_AI_BASE_URL;
  if ($('aiBaseUrl')) $('aiBaseUrl').value = storedUrl;

  APP.currentFilter = '';
  APP.currentSort = 'newest';
  APP.currentPage = 1;
  APP.pageSize = 20;
  try { localStorage.removeItem(APP.PAGESIZE_KEY); } catch(e) {}
  if ($('searchInput')) $('searchInput').value = '';
  if ($('sortSelect')) $('sortSelect').value = 'newest';

  renderWordList();
  renderStudyCard();
  renderArticleWords();
  resetAiStatus();
}

function saveWords() { localStorage.setItem(APP.STORAGE_KEY, JSON.stringify(APP.words)); }
function saveStats() { localStorage.setItem(APP.STATS_KEY, JSON.stringify({ correctCount: APP.correctCount, quizCount: APP.quizCount })); }
function saveAiBaseUrl() {
  const v = ($('aiBaseUrl').value || APP.DEFAULT_AI_BASE_URL).trim().replace(/\/$/, '');
  localStorage.setItem(APP.AI_BASE_URL_KEY, v);
}
function saveArticleWords() { localStorage.setItem(APP.ARTICLE_WORDS_KEY, JSON.stringify(APP.articleWords)); }
function saveArticleSettings() {
  localStorage.setItem(APP.ARTICLE_SETTINGS_KEY, JSON.stringify({
    level: $('articleLevel').value,
    length: $('articleLength').value,
    prompt: $('articlePrompt').value.trim()
  }));
}

function addWord(e) {
  e.preventDefault();
  const word = $('word').value.trim();
  const meaning = $('meaning').value.trim();
  const example = $('example').value.trim();
  if (!word || !meaning) { showTip('请先填写英文单词和中文释义。', 'error'); return; }
  const dup = APP.words.find(i => normalizeWord(i.word) === normalizeWord(word));
  if (dup) { showTip('单词"' + word + '"已存在！', 'error'); return; }
  APP.words.unshift({
    id: Date.now(), word, meaning, example,
    addedAt: new Date().toLocaleDateString('zh-CN')
  });
  saveWords();
  $('wordForm').reset();
  showTip('已添加：' + word, 'success');
  toast('✅ 添加成功', 'success');
  renderWordList();
  renderStudyCard();
}

function getFilteredWords() {
  const kw = APP.currentFilter.trim().toLowerCase();
  let arr = [...APP.words];
  if (kw) arr = arr.filter(i => (i.word + ' ' + i.meaning + ' ' + (i.example || '')).toLowerCase().includes(kw));
  if (APP.currentSort === 'oldest') arr.sort((a, b) => a.id - b.id);
  else if (APP.currentSort === 'az') arr.sort((a, b) => a.word.localeCompare(b.word, 'en'));
  else if (APP.currentSort === 'za') arr.sort((a, b) => b.word.localeCompare(a.word, 'en'));
  else arr.sort((a, b) => b.id - a.id);
  return arr;
}

function renderWordList() {
  const box = $('wordList');
  const wordCount = $('wordCount');
  const quizCountEl = $('quizCount');
  const correctRateEl = $('correctRate');
  const clearBtn = $('clearBtn');
  const list = getFilteredWords();
  const total = list.length;
  const ps = APP.pageSize || 20;
  const totalPages = Math.max(1, Math.ceil(total / ps));
  if (APP.currentPage > totalPages) APP.currentPage = totalPages;
  if (APP.currentPage < 1) APP.currentPage = 1;
  const start = (APP.currentPage - 1) * ps;
  const pageItems = list.slice(start, start + ps);

  wordCount.textContent = APP.words.length;
  quizCountEl.textContent = APP.quizCount;
  correctRateEl.textContent = APP.quizCount === 0 ? '0%' : Math.round((APP.correctCount / APP.quizCount) * 100) + '%';
  clearBtn.style.display = APP.words.length > 0 ? 'inline-block' : 'none';

  if (APP.words.length === 0) {
    box.innerHTML = '<div class="empty-state"><div>📝</div><p>暂无单词，请去"首页"添加</p></div>';
    renderPaginationBar(total, APP.currentPage, totalPages, true);
    return;
  }
  if (list.length === 0) {
    box.innerHTML = '<div class="empty-state compact-empty-state"><div>🔎</div><p>没有匹配的单词</p></div>';
    renderPaginationBar(total, APP.currentPage, totalPages, true);
    return;
  }
  box.innerHTML = pageItems.map(item => `
    <div class="word-item" data-id="${item.id}">
      <div class="word-info">
        <div class="word">${escapeHtml(item.word)}</div>
        <div class="meaning">${escapeHtml(item.meaning)}</div>
        ${item.example ? '<div class="example">' + escapeHtml(item.example) + '</div>' : ''}
        <div class="word-date">添加于 ${escapeHtml(item.addedAt || '')}</div>
      </div>
      <div class="word-actions">
        <button class="action-btn edit" type="button">编辑</button>
        <button class="action-btn delete" type="button">删除</button>
      </div>
    </div>
  `).join('');

  box.querySelectorAll('.action-btn.edit').forEach(b => {
    b.addEventListener('click', () => {
      const id = parseInt(b.closest('.word-item').dataset.id, 10);
      openEditModal(id);
    });
  });
  box.querySelectorAll('.action-btn.delete').forEach(b => {
    b.addEventListener('click', () => {
      const id = parseInt(b.closest('.word-item').dataset.id, 10);
      deleteWord(id);
    });
  });

  renderPaginationBar(total, APP.currentPage, totalPages, false);
}

function deleteWord(id) {
  if (!confirm('确定删除此单词？')) return;
  APP.words = APP.words.filter(i => i.id !== id);
  if (APP.studyIndex >= APP.words.length) APP.studyIndex = 0;
  const list = getFilteredWords();
  const ps = APP.pageSize || 20;
  const tp = Math.max(1, Math.ceil(list.length / ps));
  if (APP.currentPage > tp) APP.currentPage = tp;
  saveWords();
  renderWordList();
  renderStudyCard();
  toast('🗑️ 已删除', 'info');
}

function clearAllWords() {
  if (!confirm('确定要清空所有单词？此操作不可恢复！')) return;
  APP.words = []; APP.studyIndex = 0; APP.currentPage = 1;
  saveWords();
  renderWordList();
  renderStudyCard();
  toast('🗑️ 已清空', 'info');
}

function openEditModal(id) {
  const w = APP.words.find(i => i.id === id);
  if (!w) return;
  $('editId').value = w.id;
  $('editWord').value = w.word;
  $('editMeaning').value = w.meaning;
  $('editExample').value = w.example;
  $('editModal').style.display = 'flex';
}

function closeEditModal() { $('editModal').style.display = 'none'; }

function saveEdit(e) {
  e.preventDefault();
  const id = parseInt($('editId').value, 10);
  const word = $('editWord').value.trim();
  const meaning = $('editMeaning').value.trim();
  const example = $('editExample').value.trim();
  if (!word || !meaning) return;
  const dup = APP.words.find(i => i.id !== id && normalizeWord(i.word) === normalizeWord(word));
  if (dup) { alert('单词"' + word + '"已存在'); return; }
  const idx = APP.words.findIndex(i => i.id === id);
  if (idx === -1) return;
  APP.words[idx] = { ...APP.words[idx], word, meaning, example };
  saveWords();
  closeEditModal();
  renderWordList();
  renderStudyCard();
  toast('💾 已保存', 'success');
}

function exportToJSON() {
  if (APP.words.length === 0) { alert('请先添加单词'); return; }
  const blob = new Blob([JSON.stringify(APP.words, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vocabulary-list.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 已导出JSON', 'success');
}

function handleImportClick() { $('importFile').click(); }

function importFromJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('JSON 格式不正确');
      const sanitized = data
        .filter(i => i && typeof i === 'object')
        .map((i, idx) => ({
          id: Date.now() + idx,
          word: String(i.word || '').trim(),
          meaning: String(i.meaning || '').trim(),
          example: String(i.example || '').trim(),
          addedAt: i.addedAt || new Date().toLocaleDateString('zh-CN')
        }))
        .filter(i => i.word && i.meaning);
      if (sanitized.length === 0) throw new Error('没有可导入的单词');
      const map = new Map(APP.words.map(i => [normalizeWord(i.word), i]));
      sanitized.forEach(i => map.set(normalizeWord(i.word), { ...i, id: map.get(normalizeWord(i.word))?.id || i.id }));
      APP.words = Array.from(map.values()).sort((a, b) => b.id - a.id);
      saveWords();
      renderWordList();
      renderStudyCard();
      toast('📥 导入成功 ' + sanitized.length + ' 个单词', 'success');
    } catch (err) { alert('导入失败：' + err.message); }
    finally { e.target.value = ''; }
  };
  reader.readAsText(file, 'utf-8');
}

function exportToPDF() {
  if (APP.words.length === 0) { alert('请先添加单词'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text('Vocabulary List', 14, 18);
  const rows = APP.words.map((w, i) => [
    i + 1, w.word, w.meaning, w.example || '', w.addedAt || ''
  ]);
  doc.autoTable({
    startY: 24,
    head: [['#', 'Word', 'Meaning', 'Example', 'Date']],
    body: rows,
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [102, 126, 234] },
    columnStyles: {
      0: { cellWidth: 10 }, 1: { cellWidth: 35 }, 2: { cellWidth: 55 },
      3: { cellWidth: 60 }, 4: { cellWidth: 25 }
    }
  });
  doc.save('vocabulary-list.pdf');
  toast('📄 已导出PDF', 'success');
}

function parsePDFFile() {
  if (typeof pdfjsLib === 'undefined') {
    alert('PDF库未加载'); return;
  }
  $('pdfFileInput').click();
}

async function handlePDFFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  toast('📄 正在解析PDF...', 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map(it => it.str).join(' ') + '\n';
    }
    const words = extractWordsFromText(text);
    if (words.length === 0) {
      toast('⚠️ 未从PDF中识别到单词对', 'error');
      return;
    }
    const map = new Map(APP.words.map(i => [normalizeWord(i.word), i]));
    let added = 0;
    words.forEach(({ word, meaning, example }) => {
      if (!map.has(normalizeWord(word))) {
        APP.words.unshift({
          id: Date.now() + Math.random(), word, meaning, example,
          addedAt: new Date().toLocaleDateString('zh-CN')
        });
        map.set(normalizeWord(word), true);
        added++;
      }
    });
    saveWords();
    renderWordList();
    renderStudyCard();
    toast('📄 从PDF导入 ' + added + ' 个新单词（共 ' + words.length + ' 条）', 'success');
    switchSection('words');
  } catch (err) {
    alert('PDF解析失败：' + err.message);
    toast('❌ PDF解析失败', 'error');
  } finally { e.target.value = ''; }
}

function extractWordsFromText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z][a-zA-Z\-']{1,})(?:\s*[\t\s]+|\s+[-—]\s+|\s*\|\s*)(.+)$/);
    if (!m) continue;
    const word = m[1].trim();
    let rest = m[2].trim();
    const parts = rest.split(/[。.!!?！？]/);
    const meaningPart = parts[0].trim();
    const example = parts.slice(1).join('. ').trim();
    const m2 = meaningPart.match(/^([^a-zA-Z]{1,50})(.*)$/);
    let meaning = meaningPart;
    let tail = '';
    if (m2 && /[\u4e00-\u9fa5]/.test(m2[1])) {
      meaning = m2[1].trim();
      tail = m2[2].trim();
    }
    if (!meaning || !/[\u4e00-\u9fa5]/.test(meaning)) continue;
    results.push({ word, meaning: meaning.replace(/\s+/g, ' '), example: example || tail || '' });
    if (results.length >= 300) break;
  }
  return results;
}

function renderStudyCard() {
  const card = $('studyCard');
  const controls = $('studyControls');
  const quizInput = $('quizInput');
  const quizResult = $('quizResult');
  quizInput.value = '';
  quizResult.textContent = '';
  quizResult.className = 'quiz-result';

  if (APP.words.length === 0) {
    card.classList.remove('revealed');
    card.innerHTML = '<div class="empty-state"><div>🎯</div><p>添加单词后可在这里背诵和测验</p></div>';
    controls.style.display = 'none';
    return;
  }
  if (APP.studyIndex >= APP.words.length) APP.studyIndex = 0;
  controls.style.display = 'block';
  const w = APP.words[APP.studyIndex];
  card.classList.remove('revealed');
  card.innerHTML = `
    <div class="study-word">${escapeHtml(w.word)}</div>
    <div class="study-meaning">${escapeHtml(w.meaning)}</div>
    ${w.example ? '<div class="study-example">' + escapeHtml(w.example) + '</div>' : ''}
  `;
}

function revealMeaning() { $('studyCard').classList.add('revealed'); }

function nextWord() {
  if (APP.words.length === 0) return;
  APP.studyIndex = (APP.studyIndex + 1) % APP.words.length;
  renderStudyCard();
}

function randomWord() {
  if (APP.words.length === 0) return;
  APP.studyIndex = Math.floor(Math.random() * APP.words.length);
  renderStudyCard();
}

function splitMeanings(t) {
  return String(t || '').replace(/[，,、;；。.!！?？]/g, '/').replace(/\s+/g, '').toLowerCase().split('/').map(s => s.trim()).filter(Boolean);
}

function checkAnswer() {
  if (APP.words.length === 0) return;
  const input = $('quizInput').value.trim();
  const result = $('quizResult');
  const answer = APP.words[APP.studyIndex].meaning.trim();
  if (!input) { result.textContent = '请先输入中文释义'; result.className = 'quiz-result wrong'; return; }
  APP.quizCount++;
  const aList = splitMeanings(answer);
  const iList = splitMeanings(input);
  const ok = iList.some(u => aList.some(a => u === a || a.includes(u) || u.includes(a)));
  if (ok) {
    APP.correctCount++;
    result.textContent = '✅ 回答正确！';
    result.className = 'quiz-result correct';
  } else {
    result.textContent = '❌ 再想想，参考答案：' + answer;
    result.className = 'quiz-result wrong';
  }
  saveStats();
  revealMeaning();
  renderWordList();
}

function getAiBaseUrl() {
  return (($('aiBaseUrl').value || APP.DEFAULT_AI_BASE_URL).trim() || APP.DEFAULT_AI_BASE_URL).replace(/\/$/, '');
}

function setAiStatus(status, text, hint) {
  const badge = $('aiStatusBadge');
  badge.textContent = text;
  badge.className = 'ai-status-badge ' + status;
  if (hint) $('aiStatusHint').textContent = hint;
}

function updateAiConfigInfo(c) {
  $('aiModelInfo').textContent = c?.model || '-';
  $('aiQuestionLimit').textContent = c?.questionMaxLength ? c.questionMaxLength + ' 字' : '-';
  $('aiWordLimit').textContent = c?.maxWordList ? c.maxWordList + ' 个' : '-';
  if (c?.rateLimit?.maxRequests && c?.rateLimit?.windowMs) {
    $('aiRateLimitInfo').textContent = c.rateLimit.maxRequests + ' 次 / ' + Math.round(c.rateLimit.windowMs / 1000) + ' 秒';
  } else {
    $('aiRateLimitInfo').textContent = '-';
  }
}

function resetAiStatus() {
  APP.aiConfig = null;
  updateAiConfigInfo(null);
  setAiStatus('idle', '未检测', '点击检测后会自动读取后端配置。');
}

async function loadAiConfig() {
  const url = getAiBaseUrl();
  setAiStatus('loading', '检测中', '正在尝试连接 AI 服务...');
  try {
    saveAiBaseUrl();
    const res = await fetch(url + '/api/config');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '读取AI配置失败');
    APP.aiConfig = data;
    updateAiConfigInfo(data);
    if (Array.isArray(data.modes) && data.modes.length > 0) syncAiModes(data.modes);
    setAiStatus('success', '已连接', '已连接到 ' + url + '，模型：' + data.model);
  } catch (err) {
    APP.aiConfig = null;
    updateAiConfigInfo(null);
    let hint = '连接失败：' + err.message;
    if (/fetch|连接|拒绝|超时/i.test(err.message)) {
      hint = '❌ AI后端未启动！请在 vocab-app 目录运行: node ai-server.js';
    }
    setAiStatus('error', '连接失败', hint);
  }
}

function syncAiModes(modes) {
  const sel = $('aiMode');
  const cur = sel.value;
  const labels = {
    answer: '答题解析', explainWord: '单词讲解', makeQuiz: '生成练习',
    explainMistake: '错题讲解', makeArticle: '生成记忆文章'
  };
  sel.innerHTML = modes.map(m => '<option value="' + m + '">' + (labels[m] || m) + '</option>').join('');
  if (modes.includes(cur)) sel.value = cur;
}

async function askAi() {
  const q = $('aiQuestion').value.trim();
  const mode = $('aiMode').value;
  const box = $('aiAnswer');
  if (!q) { box.textContent = '请输入问题或单词'; box.className = 'ai-answer error'; return; }
  if (APP.aiConfig?.questionMaxLength && q.length > APP.aiConfig.questionMaxLength) {
    box.textContent = '问题过长，服务限制 ' + APP.aiConfig.questionMaxLength + ' 字符';
    box.className = 'ai-answer error'; return;
  }
  const src = mode === 'makeArticle'
    ? APP.articleWords.map(w => ({ word: w, meaning: '文章专用词', example: '' }))
    : APP.words;
  const payloadWords = APP.aiConfig?.maxWordList ? src.slice(0, APP.aiConfig.maxWordList) : src;
  box.textContent = 'AI 正在思考...';
  box.className = 'ai-answer loading';
  try {
    saveAiBaseUrl();
    const res = await fetch(getAiBaseUrl() + '/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, mode, wordList: payloadWords })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    const rawHtml = renderMarkdown(data.answer);
    const pages = splitHtmlIntoPages(rawHtml);
    APP.aiPagination = {
      rawHtml,
      pages,
      currentPage: 1,
      totalPages: pages.length
    };
    renderAiAnswerPage();
    setAiStatus('success', '已连接', 'AI 请求成功');
  } catch (err) {
    let hint = 'AI请求失败：' + err.message;
    if (/fetch|连接|拒绝|超时/i.test(err.message)) {
      hint = '❌ AI后端未启动！请先启动后端再试';
    } else if (/AI_API_KEY/i.test(err.message)) {
      hint = '⚠️ ' + err.message + '\n👉 请在 PowerShell 设置 API_KEY 后启动后端';
    }
    box.textContent = hint;
    box.className = 'ai-answer error';
    APP.aiPagination = { rawHtml: '', pages: [], currentPage: 1, totalPages: 0 };
    setAiStatus('error', '连接失败', hint);
  }
}

function splitHtmlIntoPages(html, maxChars) {
  maxChars = maxChars || 600;
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString('<div id="__ai_root__">' + html + '</div>', 'text/html');
  const root = doc.getElementById('__ai_root__');
  const children = Array.from(root.children);
  if (children.length === 0) return [html];

  var hasH2 = children.some(function(c) { return c.tagName === 'H2'; });
  var hasH3 = !hasH2 && children.some(function(c) { return c.tagName === 'H3'; });

  const pages = [];
  let current = [];
  let currentSize = 0;
  const pushPage = function() {
    if (current.length) {
      const container = document.createElement('div');
      current.forEach(function(el) { container.appendChild(el.cloneNode(true)); });
      pages.push(container.innerHTML);
      current = [];
      currentSize = 0;
    }
  };
  const addToCurrent = function(el) {
    const s = (el.textContent || '').length;
    if (currentSize + s > maxChars && current.length > 0) {
      pushPage();
    }
    current.push(el);
    currentSize += s;
  };

  if (hasH2) {
    children.forEach(function(el) {
      if (el.tagName === 'H2' && current.length) pushPage();
      current.push(el);
      currentSize += (el.textContent || '').length;
      if (currentSize > maxChars * 2 && current.length > 4) {
        if (el.tagName === 'P' || el.tagName === 'UL' || el.tagName === 'OL') pushPage();
      }
    });
    pushPage();
  } else if (hasH3) {
    children.forEach(function(el) {
      if (el.tagName === 'H3' && current.length) pushPage();
      addToCurrent(el);
    });
    pushPage();
  } else {
    children.forEach(function(el) { addToCurrent(el); });
    pushPage();
  }

  if (pages.length === 0) return [html];
  if (pages.length === 1) return [html];
  return pages;
}

function renderAiAnswerPage() {
  var box = $('aiAnswer');
  var ap = APP.aiPagination;
  if (!ap.pages || ap.pages.length === 0) {
    box.innerHTML = '';
    box.className = 'ai-answer markdown-body';
    return;
  }
  if (ap.totalPages <= 1) {
    box.innerHTML = ap.pages[0];
    box.className = 'ai-answer markdown-body';
    var existing = box.querySelector('.ai-pagination-bar');
    if (existing) existing.remove();
    return;
  }
  var content = ap.pages[ap.currentPage - 1] || '';
  box.innerHTML = content;
  box.className = 'ai-answer markdown-body';
  var barHtml = renderAiPaginationBar(ap.currentPage, ap.totalPages);
  var barDiv = document.createElement('div');
  barDiv.className = 'ai-pagination-bar';
  barDiv.innerHTML = barHtml;
  box.appendChild(barDiv);
}

function renderAiPaginationBar(current, total) {
  if (total <= 1) return '';
  var html = '';
  html += '<button class="page-btn" data-ai-page="' + Math.max(1, current - 1) + '"' + (current <= 1 ? ' disabled' : '') + '>‹ 上一页</button>';
  html += '<span class="page-info">第 ' + current + ' / ' + total + ' 页</span>';
  html += '<button class="page-btn" data-ai-page="' + Math.min(total, current + 1) + '"' + (current >= total ? ' disabled' : '') + '>下一页 ›</button>';
  var startPage = Math.max(1, current - 2);
  var endPage = Math.min(total, startPage + 4);
  startPage = Math.max(1, endPage - 4);
  html += '<span class="page-nums">';
  if (startPage > 1) {
    html += '<button class="page-btn" data-ai-page="1">1</button>';
    if (startPage > 2) html += '<span class="page-ellipsis">...</span>';
  }
  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="page-btn' + (i === current ? ' active' : '') + '" data-ai-page="' + i + '">' + i + '</button>';
  }
  if (endPage < total) {
    if (endPage < total - 1) html += '<span class="page-ellipsis">...</span>';
    html += '<button class="page-btn" data-ai-page="' + total + '">' + total + '</button>';
  }
  html += '</span>';
  return html;
}

function aiGotoPage(n) {
  var ap = APP.aiPagination;
  if (n < 1 || n > ap.totalPages || !ap.pages.length) return;
  ap.currentPage = n;
  renderAiAnswerPage();
  var box = $('aiAnswer');
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useCurrentWordForAi() {
  if (APP.words.length === 0) { $('aiAnswer').textContent = '当前还没有单词'; $('aiAnswer').className = 'ai-answer error'; return; }
  const w = APP.words[APP.studyIndex];
  $('aiMode').value = 'explainWord';
  $('aiQuestion').value = w.word + '\n中文释义：' + w.meaning + (w.example ? '\n例句：' + w.example : '');
  $('aiAnswer').textContent = '已填入当前单词，点击"AI 生成答案"即可讲解。';
  $('aiAnswer').className = 'ai-answer markdown-body';
  switchSection('ai');
}

function renderArticleWords() {
  const box = $('articleWordList');
  if (APP.articleWords.length === 0) {
    box.innerHTML = '<div class="empty-state compact-empty-state"><div>🪄</div><p>暂未添加文章专用单词</p></div>';
    return;
  }
  box.innerHTML = APP.articleWords.map((w, i) => `
    <div class="article-word-item">
      <input type="text" class="article-word-input" value="${escapeHtml(w)}" data-idx="${i}" />
      <button class="action-btn delete" type="button" data-del="${i}">删除</button>
    </div>
  `).join('');
  box.querySelectorAll('.article-word-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx, 10);
      APP.articleWords[idx] = inp.value.trim();
      APP.articleWords = APP.articleWords.filter(Boolean);
      saveArticleWords();
    });
  });
  box.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      APP.articleWords.splice(parseInt(btn.dataset.del, 10), 1);
      saveArticleWords();
      renderArticleWords();
    });
  });
}

function addArticleWord() {
  const v = $('articleWordInput').value.trim();
  if (!v) { showArticleTip('请输入文章单词', 'error'); return; }
  if (APP.articleWords.some(x => normalizeWord(x) === normalizeWord(v))) {
    showArticleTip('已存在：' + v, 'error'); return;
  }
  APP.articleWords.push(v);
  saveArticleWords();
  renderArticleWords();
  $('articleWordInput').value = '';
  showArticleTip('已添加：' + v, 'success');
}

function showArticleTip(msg, type) { showTip(msg, type, 'articleWordsTip'); }

function fillArticleWordsFromExisting() {
  if (APP.words.length === 0) { showArticleTip('现有单词为空', 'error'); return; }
  if (APP.articleWords.length > 0 && !confirm('文章词库已有单词，是否覆盖？')) return;
  APP.articleWords = [];
  APP.words.filter(w => /^[a-zA-Z]/.test(w.word)).slice(0, 50).forEach(w => APP.articleWords.push(w.word));
  saveArticleWords();
  renderArticleWords();
  showArticleTip('已把现有单词复制到文章词库', 'success');
}

async function generateArticle() {
  const out = $('articleOutput');
  if (APP.articleWords.length === 0) {
    out.textContent = '请先添加文章专用单词'; out.className = 'article-output error';
    showArticleTip('请先添加文章单词', 'error'); return;
  }
  saveArticleSettings();
  const levelText = { easy: '简单', medium: '中等', hard: '较难' }[$('articleLevel').value] || '中等';
  const lengthText = { short: '短文', medium: '中篇', long: '长文' }[$('articleLength').value] || '中篇';
  const customPrompt = $('articlePrompt').value.trim();
  const q = [
    '请使用我提供的单词生成一篇适合背单词学习的英语文章。',
    '文章难度：' + levelText + '，文章长度：' + lengthText + '。',
    '要求：尽量自然地使用所有给定单词；先输出英文文章，再输出中文梗概，最后列出文中每个目标单词对应的语境提示。',
    customPrompt ? '额外要求：' + customPrompt : ''
  ].filter(Boolean).join('\n');
  out.textContent = 'AI 正在生成记忆文章...';
  out.className = 'article-output loading';
  try {
    saveAiBaseUrl();
    const words = APP.aiConfig?.maxWordList ? APP.articleWords.slice(0, APP.aiConfig.maxWordList) : APP.articleWords;
    const res = await fetch(getAiBaseUrl() + '/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q, mode: 'makeArticle',
        wordList: words.map(w => ({ word: w, meaning: '文章专用词', example: '' }))
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI 服务请求失败');
    out.innerHTML = renderMarkdown(data.answer);
    out.className = 'article-output markdown-body';
    setAiStatus('success', '已连接', '文章生成成功');
  } catch (err) {
    let hint = '文章生成失败：' + err.message;
    if (/fetch|连接|拒绝|超时/i.test(err.message)) hint = '❌ AI后端未启动！请先启动后端再试';
    out.textContent = hint;
    out.className = 'article-output error';
    setAiStatus('error', '连接失败', hint);
  }
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) switchSection(section);
    });
  });
}

function initEvents() {
  $('wordForm').addEventListener('submit', addWord);
  $('gotoWordsBtn').addEventListener('click', () => switchSection('words'));
  $('editForm').addEventListener('submit', saveEdit);
  $('closeModalBtn').addEventListener('click', closeEditModal);
  $('revealBtn').addEventListener('click', revealMeaning);
  $('nextBtn').addEventListener('click', nextWord);
  $('randomBtn').addEventListener('click', randomWord);
  $('checkBtn').addEventListener('click', checkAnswer);
  $('quizInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkAnswer(); } });
  $('askAiBtn').addEventListener('click', askAi);
  $('useCurrentWordBtn').addEventListener('click', useCurrentWordForAi);
  $('checkAiBtn').addEventListener('click', loadAiConfig);
  $('aiBaseUrl').addEventListener('change', () => { saveAiBaseUrl(); resetAiStatus(); });
  $('clearBtn').addEventListener('click', clearAllWords);
  $('exportJsonBtn').addEventListener('click', exportToJSON);
  $('importJsonBtn').addEventListener('click', handleImportClick);
  $('importFile').addEventListener('change', importFromJSON);
  $('exportPdfBtn').addEventListener('click', exportToPDF);
  $('parsePdfBtn').addEventListener('click', parsePDFFile);
  $('pdfFileInput').addEventListener('change', handlePDFFile);
  $('addArticleWordBtn').addEventListener('click', addArticleWord);
  $('fillArticleWordsBtn').addEventListener('click', fillArticleWordsFromExisting);
  $('generateArticleBtn').addEventListener('click', generateArticle);
  $('articleWordInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addArticleWord(); } });
  $('articleLevel').addEventListener('change', saveArticleSettings);
  $('articleLength').addEventListener('change', saveArticleSettings);
  $('articlePrompt').addEventListener('change', saveArticleSettings);
  $('searchInput').addEventListener('input', e => { APP.currentFilter = e.target.value; APP.currentPage = 1; renderWordList(); });
  $('sortSelect').addEventListener('change', e => { APP.currentSort = e.target.value; APP.currentPage = 1; renderWordList(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditModal(); });
  window.onclick = e => { if (e.target === $('editModal')) closeEditModal(); };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) return;
    if (['Section', 'Input', 'Textarea', 'Select'].includes(e.target.tagName)) return;
    const map = { '1': 'home', '2': 'study', '3': 'ai', '4': 'article', '5': 'words' };
    if (map[e.key]) switchSection(map[e.key]);
  });

  document.addEventListener('click', e => {
    var t = e.target.closest('[data-ai-page]');
    if (t) {
      e.preventDefault();
      if (t.disabled) return;
      aiGotoPage(parseInt(t.dataset.aiPage, 10));
    }
  });
}

window.openEditModal = openEditModal;
window.deleteWord = deleteWord;

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initEvents();
  loadWords();
});
// ---------- TTS MODULE ----------
const TTS = {
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  voices: [],
  initialized: false,
  _pending: false,
  init() {
    if (!this.supported || this.initialized || this._pending) return;
    this._pending = true;
    const self = this;
    const tryLoad = () => {
      const raw = typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : [];
      if (!raw || raw.length === 0) { self._pending = false; return false; }
      self.voices = raw.filter(v => v.lang && /^en/i.test(v.lang));
      self.initialized = self.voices.length > 0;
      self._pending = false;
      return self.initialized;
    };
    const ok = tryLoad();
    if (!ok && typeof window !== 'undefined') {
      try { window.speechSynthesis.onvoiceschanged = tryLoad; } catch(e){}
      setTimeout(tryLoad, 400);
    }
  },
  pickVoice() {
    if (!this.supported) return null;
    if (!this.initialized) this.init();
    if (this.voices.length === 0) return null;
    const prio = ['Google US English', 'en-US', 'en_US', 'en-GB', 'en_GB', 'en-AU'];
    for (const p of prio) {
      const v = this.voices.find(v => v.name && v.name.indexOf(p) !== -1);
      if (v) return v;
    }
    for (const p of prio) {
      const v = this.voices.find(v => v.lang === p || (v.lang && v.lang.replace('_','-') === p));
      if (v) return v;
    }
    return this.voices[0];
  },
  speak(text, opts) {
    opts = opts || {};
    if (!this.supported || !text) return;
    if (!this.initialized) this.init();
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = opts.rate != null ? opts.rate : 0.85;
        u.pitch = opts.pitch != null ? opts.pitch : 1.0;
        u.volume = opts.volume != null ? opts.volume : 1.0;
        u.lang = opts.lang || 'en-US';
        const v = this.pickVoice();
        if (v) { try { u.voice = v; } catch(e){} }
        window.speechSynthesis.speak(u);
      }
    } catch(e){}
  },
  speakWord(w) { if (!w) return; this.speak(String(w).trim(), { rate: 0.85 }); },
  speakSentence(s) { if (!s) return; this.speak(String(s).trim(), { rate: 0.78 }); }
};

function __tts_makeSpeakBtn(word) {
  if (!TTS.supported) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'speak-btn';
  b.title = 'Click to speak';
  b.setAttribute('aria-label', 'Speak');
  b.innerHTML = '<span class="speak-ico">🔊</span>';
  b.addEventListener('click', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    TTS.speakWord(word);
  });
  return b;
}

function __tts_makeSentenceBtn(sentence) {
  if (!TTS.supported) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'speak-btn tiny';
  b.title = 'Read aloud';
  b.innerHTML = '<span class="speak-ico">🔊</span>';
  b.addEventListener('click', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    TTS.speakSentence(sentence);
  });
  return b;
}

function __tts_decorateList() {
  if (!TTS.supported) return;
  const items = document.querySelectorAll('#wordList .word');
  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    if (el.dataset.tts === '1') continue;
    const word = el.textContent.trim();
    const btn = __tts_makeSpeakBtn(word);
    if (btn) { el.appendChild(btn); el.dataset.tts = '1'; }
  }
}

function __tts_decorateStudy() {
  if (!TTS.supported) return;
  const card = document.getElementById('studyCard');
  if (!card) return;
  const wEl = card.querySelector('.study-word');
  if (wEl && !wEl.dataset.tts) {
    const btn = __tts_makeSpeakBtn(wEl.textContent.trim());
    if (btn) { wEl.appendChild(btn); wEl.dataset.tts = '1'; }
  }
  const exEl = card.querySelector('.study-example');
  if (exEl && !exEl.dataset.tts && exEl.textContent.trim()) {
    const btn = __tts_makeSentenceBtn(exEl.textContent.trim());
    if (btn) { exEl.appendChild(btn); exEl.dataset.tts = '1'; }
  }
}

(function wrapRender() {
  if (typeof renderWordList === 'function') {
    const _wl = renderWordList;
    renderWordList = function() { _wl.apply(null, arguments); setTimeout(__tts_decorateList, 0); };
  }
  if (typeof renderStudyCard === 'function') {
    const _sc = renderStudyCard;
    renderStudyCard = function() { _sc.apply(null, arguments); setTimeout(__tts_decorateStudy, 0); };
  }
})();

APP.tts = TTS;
if (typeof window !== 'undefined') { window.APP = APP; window.TTS = TTS; }
try { TTS.init(); } catch(e){}
function renderPaginationBar(total, page, totalPages, hide) {
  const bar = paginationBar;
  if (!bar) return;
  if (hide || total <= APP.pageSize) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = 'flex';

  const ps = APP.pageSize;
  const psOptions = APP.pageSizeOptions || [10, 20, 50, 100];

  let html = '<div class="page-info">共 ' + total + ' 条 · 第 ' + page + ' / ' + totalPages + ' 页</div>';

  html += '<button class="page-btn" title="第一页"';
  if (page <= 1) html += ' disabled'; else html += ' onclick="goPage(1)"';
  html += '>&larr;&larr;</button>';

  html += '<button class="page-btn" title="上一页"';
  if (page <= 1) html += ' disabled'; else html += ' onclick="goPage(' + (page - 1) + ')"';
  html += '>&larr;</button>';

  const numBtns = [];
  const push = (n) => { if (numBtns.indexOf(n) === -1) numBtns.push(n); };
  push(1); push(totalPages);
  for (let d = 1; d <= 2; d++) { if (page - d >= 1) push(page - d); }
  for (let d = 1; d <= 2; d++) { if (page + d <= totalPages) push(page + d); }
  numBtns.sort((a, b) => a - b);
  let last = 0;
  for (const n of numBtns) {
    if (n - last > 1) html += '<span class="page-dots">...</span>';
    const active = n === page ? ' active' : '';
    html += '<button class="page-btn' + active + '" onclick="goPage(' + n + ')">' + n + '</button>';
    last = n;
  }

  html += '<button class="page-btn" title="下一页"';
  if (page >= totalPages) html += ' disabled'; else html += ' onclick="goPage(' + (page + 1) + ')"';
  html += '>&rarr;</button>';

  html += '<button class="page-btn" title="最后一页"';
  if (page >= totalPages) html += ' disabled'; else html += ' onclick="goPage(' + totalPages + ')"';
  html += '>&rarr;&rarr;</button>';

  html += '<span class="page-size-wrap">每页<select class="page-size-select" id="pageSizeSelect">';
  for (const sz of psOptions) {
    html += '<option value="' + sz + '"' + (sz === ps ? ' selected' : '') + '>' + sz + '</option>';
  }
  html += '</select>条</span>';

  bar.innerHTML = html;
  const sel = bar.querySelector('#pageSizeSelect') || bar.querySelector('.page-size-select');
  if (sel) {
    sel.addEventListener('change', function() { changePageSize(parseInt(this.value, 10)); });
  }
}

function goPage(n) {
  const list = getFilteredWords();
  const total = list.length;
  const ps = APP.pageSize || 20;
  const totalPages = Math.max(1, Math.ceil(total / ps));
  n = Math.max(1, Math.min(totalPages, parseInt(n, 10) || 1));
  APP.currentPage = n;
  renderWordList();
}

function changePageSize(n) {
  n = [10, 20, 50, 100].indexOf(n) >= 0 ? n : 20;
  APP.pageSize = n;
  try { localStorage.setItem(APP.PAGESIZE_KEY, String(n)); } catch(e) {}
  APP.currentPage = 1;
  renderWordList();
}