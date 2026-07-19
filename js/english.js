/* ============================================
   English Learning Module (Enhanced)
   Features: Word CRUD, Flashcards, Quiz,
             Dictionary Lookup, Pronunciation
   ============================================ */

const ENGLISH = (() => {
  // ---------- State ----------
  let currentWordFilter = { search: '' };
  let quizState = {
    words: [], current: 0, correct: 0, wrong: 0,
    answered: false, selectedWordIds: [], mode: 'en-zh',
  };
  let currentView = 'wordlist';

  // ==========================================
  //  PRONUNCIATION (Web Speech API)
  // ==========================================
  function speakWord(word, rate = 0.85) {
    if (!word || !window.speechSynthesis) {
      showToast('该浏览器不支持语音功能', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = 'en-US';
    utter.rate = rate;
    utter.pitch = 1;
    // Try to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.localService)
      || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utter.voice = enVoice;
    window.speechSynthesis.speak(utter);
  }

  // ==========================================
  //  DICTIONARY LOOKUP (Free Dictionary API)
  // ==========================================
  function renderDictionary() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = `
      <div class="page-header">
        <h2>📖 词典查询</h2>
        <p>在线查词 · 发音 · 释义 · 例句</p>
      </div>
      <div class="page-body">
        <div class="dictionary-search">
          <div class="search-bar" style="margin-bottom:0;">
            <span class="search-icon">🔍</span>
            <input type="text" id="dict-input" placeholder="输入要查询的英文单词..." autofocus>
          </div>
          <button class="btn btn-primary" onclick="ENGLISH.dictLookup()">查词</button>
        </div>
        <div id="dict-result">
          <div class="empty-state" style="padding:40px 20px;">
            <div class="empty-icon">📖</div>
            <h3>查词</h3>
            <p>输入英文单词，查看释义、音标、发音和例句</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('dict-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ENGLISH.dictLookup();
    });
    currentView = 'dictionary';
  }

  async function dictLookup() {
    const input = document.getElementById('dict-input');
    const resultEl = document.getElementById('dict-result');
    const word = input.value.trim().toLowerCase();

    if (!word) {
      showToast('请输入要查询的单词', 'error');
      return;
    }

    resultEl.innerHTML = `<div style="text-align:center;padding:40px;"><div class="skeleton" style="width:200px;height:24px;margin:0 auto 16px;"></div><div class="skeleton" style="width:300px;height:16px;margin:0 auto;"></div></div>`;

    try {
      const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!resp.ok) {
        if (resp.status === 404) {
          resultEl.innerHTML = `
            <div class="empty-state" style="padding:40px;">
              <div class="empty-icon">😕</div>
              <h3>未找到 "${escapeHtml(word)}"</h3>
              <p>词典中没有收录这个单词，请检查拼写</p>
              <button class="btn btn-primary btn-sm" onclick="ENGLISH.addFromDict('${escapeHtml(word)}','')" style="margin-top:12px;">＋ 添加到词库</button>
            </div>`;
          return;
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const entry = data[0];
      if (!entry) throw new Error('Empty response');

      const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics.find(p => p.text)?.text) || '';
      const audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';
      const meanings = entry.meanings || [];

      resultEl.innerHTML = `
        <div class="dict-result-card">
          <!-- Word Header -->
          <div class="dict-word-header">
            <div>
              <div class="dict-word">${escapeHtml(entry.word)}</div>
              ${phonetic ? `<div class="dict-phonetic">${escapeHtml(phonetic)}</div>` : ''}
            </div>
            <div class="dict-word-actions">
              ${audioUrl ? `<button class="btn btn-icon dict-speaker" onclick="ENGLISH.playDictAudio('${escapeHtml(audioUrl)}')" title="发音(在线)">🔊</button>` : ''}
              <button class="btn btn-icon dict-speaker" onclick="ENGLISH.speakWord('${escapeHtml(entry.word)}')" title="发音(TTS)">🗣️</button>
            </div>
          </div>

          <!-- Meanings -->
          ${meanings.map(m => `
            <div class="dict-meaning">
              <div class="dict-part-of-speech">${m.partOfSpeech}</div>
              ${m.definitions.slice(0, 3).map((def, i) => `
                <div class="dict-definition">
                  <span class="dict-def-num">${i + 1}.</span>
                  <div class="dict-def-text">
                    <div>${escapeHtml(def.definition)}</div>
                    ${def.example ? `<div class="dict-example">${escapeHtml(def.example)}</div>` : ''}
                    ${def.synonyms && def.synonyms.length ? `<div class="dict-synonyms">同义: ${def.synonyms.slice(0, 4).map(s => `<span class="dict-word-link" onclick="ENGLISH.lookupRelated('${escapeHtml(s)}')">${escapeHtml(s)}</span>`).join(', ')}</div>` : ''}
                  </div>
                </div>
              `).join('')}
              ${m.antonyms && m.antonyms.length ? `<div class="dict-synonyms" style="margin-left:28px;margin-top:4px;">反义: ${m.antonyms.slice(0, 3).map(s => escapeHtml(s)).join(', ')}</div>` : ''}
            </div>
          `).join('')}

          <!-- Add to vocabulary -->
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-sm" onclick="ENGLISH.addFromDict('${escapeHtml(entry.word)}', '${escapeHtml(meanings[0]?.definitions[0]?.definition || '')}')">＋ 添加到词库</button>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Dictionary lookup error:', err);
      resultEl.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <div class="empty-icon">⚠️</div>
          <h3>查询失败</h3>
          <p>请检查网络连接后重试</p>
        </div>`;
    }
  }

  function playDictAudio(url) {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(() => showToast('无法播放音频', 'error'));
  }

  function lookupRelated(word) {
    const input = document.getElementById('dict-input');
    if (input) {
      input.value = word;
      dictLookup();
    }
  }

  function addFromDict(word, definition) {
    // Check if word already exists
    const words = STORAGE.getWords();
    if (words.some(w => w.word.toLowerCase() === word.toLowerCase())) {
      showToast(`「${word}」已在词库中`, 'info');
      return;
    }
    // Extract Chinese translation from definition if possible, or use definition
    const translation = definition || word;
    STORAGE.addWord({ word, translation, notes: '', category: 'general', difficulty: 1 });
    showToast(`「${word}」已添加到词库 ✅`);
  }

  // ==========================================
  //  TRANSLATION (MyMemory API)
  // ==========================================
  let translateState = {
    sourceLang: 'en',
    targetLang: 'zh-CN',
    lastSource: '',
    lastResult: '',
  };

  function renderTranslate() {
    const container = document.getElementById('dynamic-content');
    currentView = 'translate';
    container.innerHTML = `
      <div class="page-header">
        <h2>🌐 翻译</h2>
        <p>中英互译 · 单词 · 句子 · 段落</p>
      </div>
      <div class="page-body">
        ${renderSubNav()}
        <div class="translate-container">
          <div class="translate-language-bar">
            <button class="translate-lang-btn ${translateState.sourceLang === 'en' ? 'active' : ''}" onclick="ENGLISH.setSourceLang('en')">English</button>
            <button class="btn btn-icon swap-btn" onclick="ENGLISH.swapLanguage()" title="交换语言">⇄</button>
            <button class="translate-lang-btn ${translateState.sourceLang === 'zh-CN' ? 'active' : ''}" onclick="ENGLISH.setSourceLang('zh-CN')">中文</button>
          </div>
          <div class="translate-input-area">
            <textarea id="translate-input" placeholder="输入要翻译的文本..." rows="5"></textarea>
          </div>
          <div class="translate-actions">
            <button class="btn btn-primary btn-lg" onclick="ENGLISH.translateText()">🌐 翻译</button>
          </div>
          <div id="translate-result">
            <div class="empty-state" style="padding:30px 20px;">
              <div class="empty-icon">🌐</div>
              <h3>翻译</h3>
              <p>输入文本后点击"翻译"，或按 Ctrl+Enter 快速翻译</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const textarea = document.getElementById('translate-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          ENGLISH.translateText();
        }
      });
      setTimeout(() => textarea.focus(), 200);
    }
  }

  function setSourceLang(lang) {
    translateState.sourceLang = lang;
    translateState.targetLang = lang === 'en' ? 'zh-CN' : 'en';
    renderTranslate();
  }

  function swapLanguage() {
    const temp = translateState.sourceLang;
    translateState.sourceLang = translateState.targetLang;
    translateState.targetLang = temp;
    renderTranslate();
  }

  async function translateText() {
    const input = document.getElementById('translate-input');
    const resultEl = document.getElementById('translate-result');
    const text = input.value.trim();

    if (!text) {
      showToast('请输入要翻译的文本', 'error');
      return;
    }

    translateState.lastSource = text;
    const sourceLang = translateState.sourceLang;
    const targetLang = translateState.targetLang;
    const langpair = `${sourceLang}|${targetLang}`;

    resultEl.innerHTML = `<div style="text-align:center;padding:40px;"><div class="skeleton" style="width:200px;height:24px;margin:0 auto 16px;"></div><div class="skeleton" style="width:300px;height:16px;margin:0 auto;"></div></div>`;

    try {
      const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`);
      const data = await resp.json();

      if (data.responseStatus === 200) {
        const translatedText = data.responseData.translatedText;
        translateState.lastResult = translatedText;

        // Check if input is a single English word (for adding to vocabulary)
        const isSingleWord = /^[a-zA-Z]+$/.test(text) && text.split(/\s+/).length === 1;

        resultEl.innerHTML = `
          <div class="translate-result-card">
            <div class="translate-row">
              <div class="translate-label">${escapeHtml(sourceLang === 'en' ? 'English' : '中文')}</div>
              <div class="translate-source">${escapeHtml(text)}</div>
              <button class="btn btn-icon" onclick="ENGLISH.speakTranslation('source')" title="朗读原文">🔊</button>
            </div>
            <div class="translate-divider"></div>
            <div class="translate-row">
              <div class="translate-label">${escapeHtml(targetLang === 'zh-CN' ? '中文' : 'English')}</div>
              <div class="translate-result-text">${escapeHtml(translatedText)}</div>
              <button class="btn btn-icon" onclick="ENGLISH.speakTranslation('target')" title="朗读译文">🔊</button>
            </div>
            <div class="translate-result-actions">
              <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escapeHtml(translatedText)}').then(()=>showToast('✅ 已复制'))">📋 复制译文</button>
              ${isSingleWord ? `<button class="btn btn-sm btn-primary" onclick="ENGLISH.addFromTranslate()">➕ 加入词库</button>` : ''}
            </div>
          </div>
        `;
      } else {
        throw new Error(data.responseDetails || 'Translation failed');
      }
    } catch (err) {
      console.error('Translation error:', err);
      resultEl.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <div class="empty-icon">⚠️</div>
          <h3>翻译失败</h3>
          <p>请检查网络连接后重试</p>
        </div>`;
    }
  }

  function speakTranslation(type) {
    const text = type === 'source' ? translateState.lastSource : translateState.lastResult;
    const lang = type === 'source' ? translateState.sourceLang : translateState.targetLang;
    if (!text || !window.speechSynthesis) {
      showToast('该浏览器不支持语音功能', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
    utter.rate = lang === 'zh-CN' ? 0.9 : 0.8;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const matchingVoices = lang === 'zh-CN'
      ? voices.filter(v => v.lang.startsWith('zh'))
      : voices.filter(v => v.lang.startsWith('en'));
    const voice = matchingVoices.find(v => v.localService) || matchingVoices[0];
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }

  function addFromTranslate() {
    const word = translateState.lastSource.trim().toLowerCase();
    const translation = translateState.lastResult.trim();
    if (!word || !translation) {
      showToast('请先翻译', 'error');
      return;
    }
    if (!/^[a-z]+$/.test(word)) {
      showToast('只支持添加英文单词到词库', 'error');
      return;
    }
    const words = STORAGE.getWords();
    if (words.some(w => w.word.toLowerCase() === word)) {
      showToast(`「${word}」已在词库中`, 'info');
      return;
    }
    STORAGE.addWord({ word, translation, notes: '', category: 'general', difficulty: 1 });
    showToast(`「${word}」已添加到词库 ✅`);
  }

  // ==========================================
  //  SUB-NAV TOOLBAR
  // ==========================================
  function renderSubNav() {
    return `
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <button class="btn ${currentView === 'wordlist' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('wordlist')">📚 词库</button>
        <button class="btn ${currentView === 'quiz' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('quiz')">📝 测验</button>
        <button class="btn ${currentView === 'progress' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('progress')">📈 进度</button>
        <button class="btn ${currentView === 'dictionary' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('dictionary')">📖 词典</button>
        <button class="btn ${currentView === 'translate' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('translate')">🌐 翻译</button>
        <button class="btn ${currentView === 'linking' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('linking')">🔗 连读</button>
        <button class="btn ${currentView === 'speaking' ? 'btn-primary' : 'btn-secondary'}" onclick="APP.navigateTo('speaking')">🎤 口语</button>
      </div>
    `;
  }

  // ==========================================
  //  HELPERS
  // ==========================================
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderStats() {
    const stats = STORAGE.getStats();
    return `
      <div class="word-stats">
        <div class="stat-card"><div class="stat-value">${stats.totalWords}</div><div class="stat-label">📖 总词汇</div></div>
        <div class="stat-card"><div class="stat-value">${stats.masteredWords}</div><div class="stat-label">⭐ 已掌握</div></div>
        <div class="stat-card"><div class="stat-value">${stats.dueForReview}</div><div class="stat-label">🔄 待复习</div></div>
        <div class="stat-card"><div class="stat-value">${stats.avgAccuracy}%</div><div class="stat-label">📊 平均正确率</div></div>
      </div>
    `;
  }

  // ==========================================
  //  WORD LIST
  // ==========================================
  function renderWordList() {
    const container = document.getElementById('dynamic-content');
    let words = STORAGE.getWords();
    if (currentWordFilter.search) {
      const q = currentWordFilter.search.toLowerCase();
      words = words.filter(w =>
        w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
      );
    }
    currentView = 'wordlist';

    container.innerHTML = `
      <div class="page-header">
        <h2>🎯 英语学习</h2>
        <p>词汇积累 · 自我测验 · 在线词典</p>
      </div>
      <div class="page-body">
        ${renderStats()}
        ${renderSubNav()}
        <div class="word-list-toolbar">
          <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" id="word-search" placeholder="搜索单词..." value="${escapeHtml(currentWordFilter.search)}">
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="ENGLISH.showWordEditor()">➕ 添加单词</button>
          </div>
        </div>
        ${words.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📕</div>
            <h3>${currentWordFilter.search || currentWordFilter.category ? '没有找到匹配的单词' : '词汇表还是空的'}</h3>
            <p>${currentWordFilter.search || currentWordFilter.category ? '试试其他的搜索词或分类' : '点击"添加单词"开始建立你的词汇本吧！'}</p>
          </div>
        ` : `
          <div class="word-table-container">
            <table class="word-table">
              <thead><tr>
                <th>单词</th><th>释义</th><th style="text-align:right;">操作</th>
              </tr></thead>
              <tbody>
                ${words.map(w => {
                  return `<tr>
                    <td class="word-cell">
                      <span style="cursor:pointer;" onclick="ENGLISH.speakWord('${escapeHtml(w.word)}')" title="点击发音">🔊</span>
                      ${escapeHtml(w.word)}
                    </td>
                    <td class="translation-cell">${escapeHtml(w.translation)}</td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="发音" onclick="ENGLISH.speakWord('${escapeHtml(w.word)}')">🔊</button>
                      <button class="btn-icon" title="编辑" onclick="ENGLISH.showWordEditor('${w.id}')">✏️</button>
                      <button class="btn-icon" title="删除" onclick="ENGLISH.deleteWord('${w.id}')">🗑️</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    const searchInput = document.getElementById('word-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => { currentWordFilter.search = e.target.value; renderWordList(); });
    }
  }

  // ==========================================
  //  WORD EDITOR — 仅保留单词 + 释义，回车保存
  // ==========================================

  function showWordEditor(id) {
    const word = id ? STORAGE.getWord(id) : null;
    const isEdit = !!word;
    showModal({
      title: isEdit ? '✏️ 编辑单词' : '➕ 添加单词',
      body: `
        <div class="form-group">
          <label>单词 <span class="required">*</span></label>
          <input type="text" class="form-control" id="word-input" placeholder="eg: ubiquitous" value="${isEdit ? escapeHtml(word.word) : ''}">
        </div>
        <div class="form-group">
          <label>释义 <span class="required">*</span></label>
          <input type="text" class="form-control" id="translation-input" placeholder="eg: 无处不在的" value="${isEdit ? escapeHtml(word.translation) : ''}">
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-top:8px;">💡 单词和释义填写完成后按 Enter 保存</div>
      `,
      footer: '',
    });

    const wordInput = document.getElementById('word-input');
    const transInput = document.getElementById('translation-input');

    function onEnterSave(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const wordVal = wordInput?.value.trim();
        const transVal = transInput?.value.trim();
        if (wordVal && transVal) {
          const data = { word: wordVal, translation: transVal };
          if (id) {
            STORAGE.updateWord(id, data);
          } else {
            STORAGE.addWord(data);
          }
          renderWordList();
          closeModal();
        }
      }
    }

    if (wordInput) {
      wordInput.addEventListener('keydown', onEnterSave);
      wordInput.focus();
    }
    if (transInput) transInput.addEventListener('keydown', onEnterSave);
  }

  function deleteWord(id) {
    const word = STORAGE.getWord(id);
    if (!word) return;
    if (confirm(`确定要从词库中删除「${word.word}」吗？`)) {
      STORAGE.deleteWord(id); showToast('单词已删除'); renderWordList();
    }
  }

  // ==========================================
  //  FLASHCARD
  // ==========================================

  // ==========================================
  //  QUIZ
  // ==========================================
  function renderQuiz() {
    const container = document.getElementById('dynamic-content');
    const words = STORAGE.getWords();
    currentView = 'quiz';
    if (words.length < 4) {
      container.innerHTML = `
        <div class="page-header"><h2>🎯 英语学习</h2><p>词汇积累 · 自我测验 · 在线词典</p></div>
        <div class="page-body">${renderStats()}${renderSubNav()}
          <div class="empty-state"><div class="empty-icon">📝</div><h3>需要至少 4 个单词</h3><p>当前词库只有 ${words.length} 个单词</p></div>
        </div>`;
      return;
    }
    if (quizState.words.length === 0) {
      container.innerHTML = `
        <div class="page-header"><h2>🎯 英语学习</h2><p>词汇积累 · 自我测验 · 在线词典</p></div>
        <div class="page-body">${renderSubNav()}
          <div class="quiz-container">
            <div class="card" style="padding:40px;text-align:center;">
              <div style="font-size:3rem;margin-bottom:16px;">📝</div>
              <h3 style="font-size:1.3rem;margin-bottom:8px;">开始测验</h3>
              <p style="color:var(--text-secondary);margin-bottom:20px;">从词库中随机抽题，共 <strong>${words.length}</strong> 个单词</p>
              <div class="form-group" style="max-width:200px;margin:0 auto 20px;">
                <label>题目数量</label>
                <select class="form-control" id="quiz-count">
                  <option value="5">5 题</option><option value="10" selected>10 题</option>
                  <option value="15">15 题</option><option value="20">20 题</option>
                </select>
              </div>
              <div class="form-group" style="max-width:200px;margin:0 auto 20px;">
                <label>模式</label>
                <select class="form-control" id="quiz-mode">
                  <option value="en-zh">看英文选中文</option>
                  <option value="zh-en">看中文选英文</option>
                </select>
              </div>
              <button class="btn btn-primary btn-lg" onclick="ENGLISH.startQuiz()">开始答题 🚀</button>
            </div>
          </div>
        </div>`;
      return;
    }
    renderQuizQuestion();
  }

  function startQuiz() {
    const count = parseInt(document.getElementById('quiz-count')?.value || '10');
    const mode = document.getElementById('quiz-mode')?.value || 'en-zh';
    let words = STORAGE.getWords();
    words.sort((a, b) => (a.reviewCount + a.correctCount * 2 - a.wrongCount) - (b.reviewCount + b.correctCount * 2 - b.wrongCount));
    const selected = shuffleArray(words).slice(0, Math.min(count, words.length));
    quizState = { words: selected, current: 0, correct: 0, wrong: 0, answered: false, selectedWordIds: selected.map(w => w.id), mode };
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const container = document.getElementById('dynamic-content');
    const { words, current, correct, wrong, mode } = quizState;
    currentView = 'quiz';
    if (current >= words.length) { finishQuiz(); return; }
    const word = words[current];
    const total = words.length;
    const progress = ((current / total) * 100).toFixed(0);
    const allWords = STORAGE.getWords();
    const wrongOptions = shuffleArray(allWords.filter(w => w.id !== word.id));
    let options;
    if (mode === 'en-zh') {
      options = shuffleArray([
        { text: word.translation, correct: true },
        ...wrongOptions.slice(0, 3).map(w => ({ text: w.translation, correct: false }))
      ]);
    } else {
      options = shuffleArray([
        { text: word.word, correct: true },
        ...wrongOptions.slice(0, 3).map(w => ({ text: w.word, correct: false }))
      ]);
    }
    const questionWord = mode === 'en-zh' ? word.word : word.translation;
    const questionPrompt = mode === 'en-zh' ? '请选择正确的释义' : '请选择正确的单词';

    container.innerHTML = `
      <div class="page-header"><h2>🎯 英语学习</h2><p>词汇积累 · 自我测验 · 在线词典</p></div>
      <div class="page-body">${renderSubNav()}
        <div class="quiz-container">
          <div class="quiz-header">
            <div class="quiz-progress-text">第 ${current + 1} / ${total} 题 · 答对 ${correct} 题 · 答错 ${wrong} 题</div>
            <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progress}%"></div></div>
          </div>
          <div class="quiz-question">
            <div class="quiz-question-word">
              ${escapeHtml(questionWord)}
              ${mode === 'en-zh' ? `<span style="font-size:1.2rem;cursor:pointer;margin-left:8px;" onclick="ENGLISH.speakWord('${escapeHtml(word.word)}')">🔊</span>` : ''}
            </div>
            <div class="quiz-question-prompt">${questionPrompt}</div>
          </div>
          <div class="quiz-options" id="quiz-options">
            ${options.map((opt, i) => `<button class="quiz-option" data-index="${i}" data-correct="${opt.correct}" onclick="ENGLISH.answerQuiz(${i})">${escapeHtml(opt.text)}</button>`).join('')}
          </div>
          <div style="text-align:center;margin-top:16px;">
            <button class="btn btn-secondary" onclick="ENGLISH.quitQuiz()">退出测验</button>
          </div>
        </div>
      </div>`;
  }

  function answerQuiz(index) {
    if (quizState.answered) return;
    quizState.answered = true;
    const options = document.querySelectorAll('.quiz-option');
    const selected = options[index];
    const isCorrect = selected.dataset.correct === 'true';
    options.forEach(o => o.classList.add('disabled'));
    if (isCorrect) { selected.classList.add('correct'); quizState.correct++; }
    else {
      selected.classList.add('wrong');
      options.forEach(o => { if (o.dataset.correct === 'true') o.classList.add('correct'); });
      quizState.wrong++;
    }
    const word = quizState.words[quizState.current];
    STORAGE.recordAnswer(word.id, isCorrect);
    setTimeout(() => {
      quizState.current++;
      quizState.answered = false;
      if (quizState.current >= quizState.words.length) finishQuiz();
      else renderQuizQuestion();
    }, 1200);
  }

  function finishQuiz() {
    const { correct, wrong, words } = quizState;
    const total = words.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    STORAGE.addQuiz({ score: correct, total, wordIds: words.map(w => w.id) });
    const container = document.getElementById('dynamic-content');
    currentView = 'quiz';
    container.innerHTML = `
      <div class="page-header"><h2>🎯 英语学习</h2><p>词汇积累 · 自我测验 · 在线词典</p></div>
      <div class="page-body">${renderSubNav()}
        <div class="quiz-container">
          <div class="quiz-result card" style="padding:32px;">
            <div style="font-size:3rem;margin-bottom:8px;">${accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪'}</div>
            <div class="result-score">${correct} / ${total}</div>
            <div class="result-label">正确率 ${accuracy}%</div>
            <div class="result-details">
              <div class="result-detail-card correct-count"><div class="detail-value">${correct}</div><div class="detail-label">✅ 答对</div></div>
              <div class="result-detail-card wrong-count"><div class="detail-value">${wrong}</div><div class="detail-label">❌ 答错</div></div>
            </div>
            <div class="btn-group" style="justify-content:center;">
              <button class="btn btn-primary btn-lg" onclick="ENGLISH.startQuiz()">🔄 再来一次</button>
              <button class="btn btn-secondary btn-lg" onclick="APP.navigateTo('wordlist')">📚 看词库</button>
            </div>
          </div>
        </div>
      </div>`;
    quizState.words = []; quizState.current = 0;
  }

  function quitQuiz() {
    if (confirm('确定退出当前测验吗？进度将不会保存。')) {
      quizState.words = []; quizState.current = 0; renderQuiz();
    }
  }

  // ==========================================
  //  PROGRESS
  // ==========================================
  function renderProgress() {
    const container = document.getElementById('dynamic-content');
    const stats = STORAGE.getStats();
    const words = STORAGE.getWords();
    currentView = 'progress';
    const mastered = words.filter(w => { const t = w.correctCount + w.wrongCount; return t >= 3 && (w.correctCount / t) >= 0.8; }).length;
    const learning = words.filter(w => { const t = w.correctCount + w.wrongCount; return t > 0 && !(t >= 3 && (w.correctCount / t) >= 0.8); }).length;
    const newWords = words.filter(w => w.reviewCount === 0).length;
    const total = words.length || 1;

    container.innerHTML = `
      <div class="page-header"><h2>🎯 英语学习</h2><p>词汇积累 · 自我测验 · 在线词典</p></div>
      <div class="page-body progress-view">${renderSubNav()}
        <div class="progress-grid">
          <div class="progress-card"><h3>📊 掌握分布</h3>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>✅ 已掌握</span><span>${mastered} (${Math.round(mastered/total*100)}%)</span></div><div class="progress-bar-track"><div class="progress-bar-fill green" style="width:${mastered/total*100}%"></div></div></div>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>📖 学习中</span><span>${learning} (${Math.round(learning/total*100)}%)</span></div><div class="progress-bar-track"><div class="progress-bar-fill orange" style="width:${learning/total*100}%"></div></div></div>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>🆕 未学习</span><span>${newWords} (${Math.round(newWords/total*100)}%)</span></div><div class="progress-bar-track"><div class="progress-bar-fill purple" style="width:${newWords/total*100}%"></div></div></div>
          </div>
          <div class="progress-card"><h3>📝 测验统计</h3>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>总测验次数</span><span>${stats.totalQuizzes} 次</span></div></div>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>平均正确率</span><span>${stats.avgAccuracy}%</span></div><div class="progress-bar-track"><div class="progress-bar-fill green" style="width:${stats.avgAccuracy}%"></div></div></div>
            ${stats.recentQuizzes.length > 0 ? `<div style="margin-top:12px;"><div style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">最近测验</div>
              ${stats.recentQuizzes.slice(0,5).map(q => `<div class="quiz-history-item"><span class="quiz-date">${new Date(q.date).toLocaleDateString('zh-CN')}</span><span class="quiz-score" style="color:${q.accuracy>=80?'var(--secondary)':q.accuracy>=60?'var(--accent-orange)':'var(--accent-red)'};">${q.score}/${q.total} (${q.accuracy}%)</span></div>`).join('')}</div>` : '<p style="color:var(--text-muted);font-size:0.9rem;">还没有测验记录</p>'}
          </div>
          <div class="progress-card"><h3>🔄 复习概况</h3>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>待复习</span><span>${stats.dueForReview} 个</span></div></div>
            <div class="progress-bar-wrapper"><div class="progress-bar-label"><span>已复习</span><span>${stats.reviewedWords} / ${stats.totalWords}</span></div><div class="progress-bar-track"><div class="progress-bar-fill" style="width:${total>0?(stats.reviewedWords/total)*100:0}%"></div></div></div>
            <div style="margin-top:16px;display:flex;gap:8px;"><button class="btn btn-primary btn-sm" onclick="APP.navigateTo('wordlist')">📚 浏览词库</button><button class="btn btn-secondary btn-sm" onclick="APP.navigateTo('quiz')">📝 开始测验</button></div>
          </div>
          <div class="progress-card"><h3>🔥 困难单词</h3>
            ${words.filter(w=>w.wrongCount>0).sort((a,b)=>(b.wrongCount/Math.max(1,b.correctCount+b.wrongCount))-(a.wrongCount/Math.max(1,a.correctCount+a.wrongCount))).slice(0,5).map(w=>{const t=w.correctCount+w.wrongCount;const acc=t>0?Math.round(w.correctCount/t*100):0;return`<div class="quiz-history-item"><span><strong>${escapeHtml(w.word)}</strong> — ${escapeHtml(w.translation)}</span><span style="color:${acc>=80?'var(--secondary)':acc>=50?'var(--accent-orange)':'var(--accent-red)'};font-weight:500;">${acc}%</span></div>`;}).join('') || '<p style="color:var(--text-muted);font-size:0.9rem;">还没有错题记录 👍</p>'}
          </div>
        </div>
      </div>`;
  }

  // ==========================================
  //  UTILITIES
  // ==========================================
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==========================================
  //  SENTENCE LINKING (连读)
  // ==========================================
  function renderLinking() {
    const container = document.getElementById('dynamic-content');
    currentView = 'linking';
    container.innerHTML = `
      <div class="page-header">
        <h2>🔗 句子连读</h2>
        <p>输入句子，展示连读规则并示范地道发音</p>
      </div>
      <div class="page-body">
        ${renderSubNav()}
        <div class="linking-container">
          <div class="linking-input-area">
            <div class="search-bar" style="margin-bottom:0;">
              <span class="search-icon">🔤</span>
              <input type="text" id="linking-input" placeholder="输入英文句子，如: Not at all" autofocus>
            </div>
            <button class="btn btn-primary" onclick="ENGLISH.analyzeLinking()">分析连读</button>
          </div>
          <div id="linking-result">
            <div class="empty-state" style="padding:40px 20px;">
              <div class="empty-icon">🔗</div>
              <h3>连读分析</h3>
              <p>输入英文句子，查看单词之间的连读关系<br>并收听地道的连读发音</p>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('linking-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ENGLISH.analyzeLinking();
    });
  }

  function analyzeLinking() {
    const input = document.getElementById('linking-input');
    const resultEl = document.getElementById('linking-result');
    const sentence = input.value.trim();
    if (!sentence) { showToast('请输入英文句子', 'error'); return; }

    // Tokenize
    const words = sentence.split(/\s+/).filter(Boolean);
    const wordData = words.map(w => ({
      original: w,
      clean: w.replace(/[^a-zA-Z'-]/g, ''),
    }));

    // Analyze linking rules
    const linkGroups = [];
    const rules = [];
    const linkedParts = [];

    for (let i = 0; i < wordData.length; i++) {
      const curr = wordData[i].clean.toLowerCase();
      const next = i < wordData.length - 1 ? wordData[i + 1].clean.toLowerCase() : null;

      if (!next) {
        linkedParts.push({ text: wordData[i].original, type: 'normal' });
        continue;
      }

      const currEndsConsonant = /[bcdfghjklmnpqrstvwxyz]$/i.test(curr);
      const nextStartsVowel = /^[aeiou]/i.test(next);
      const currEndsT = /t$/i.test(curr);
      const nextStartsY = /^y/i.test(next);
      const sameConsonant = /([bcdfghjklmnpqrstvwxyz])$/i.test(curr) && next && new RegExp(`^${curr.match(/([bcdfghjklmnpqrstvwxyz])$/i)[1]}`, 'i').test(next);
      const isAAn = /^a$/i.test(curr) || /^an$/i.test(curr);

      // C+V linking
      if (currEndsConsonant && nextStartsVowel) {
        linkGroups.push({ a: wordData[i].original, b: wordData[i+1].original, type: 'consonant-vowel',
          display: `${wordData[i].clean} → ${wordData[i].clean.slice(0,-1)}_${wordData[i].clean.slice(-1)}‧${next}` });
        rules.push({ type: '辅音+元音', rule: 'consonant-vowel',
          desc: `「${wordData[i].clean}」结尾辅音与「${next}」开头元音连读` });
        linkedParts.push({ text: wordData[i].original + '~' + wordData[i+1].original, type: 'linked' });
        continue;
      }

      // T/Y → ʧ
      if (currEndsT && nextStartsY) {
        rules.push({ type: 'T+Y → ʧ', rule: 't-d',
          desc: `「${wordData[i].clean}」结尾 /t/ 与「${next}」开头 /j/ 融合成 /ʧ/` });
        linkGroups.push({ a: wordData[i].original, b: wordData[i+1].original, type: 't-y' });
        linkedParts.push({ text: wordData[i].original + '~' + wordData[i+1].original, type: 'linked' });
        continue;
      }

      // Same consonant
      if (sameConsonant && !isAAn) {
        rules.push({ type: '相同辅音合并', rule: 't-d',
          desc: `「${wordData[i].clean}」和「${next}」的相同辅音合并成一个音` });
        linkGroups.push({ a: wordData[i].original, b: wordData[i+1].original, type: 'same-consonant' });
        linkedParts.push({ text: wordData[i].original + '~' + wordData[i+1].original, type: 'linked' });
        continue;
      }

      linkedParts.push({ text: wordData[i].original, type: 'normal' });
    }

    resultEl.innerHTML = `
      <div class="linking-card">
        <h4>📝 原文</h4>
        <div class="linking-original">${escapeHtml(sentence)}</div>

        ${rules.length > 0 ? `
          <h4>🔗 连读规则 (${rules.length} 处)</h4>
          <div class="linking-rules">
            ${rules.map(r => `
              <div class="linking-rule">
                <span class="link-rule-badge ${r.rule}">${r.type}</span>
                <span>${r.desc}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color:var(--text-muted);font-size:0.88rem;">该句子中没有明显的连读规则</p>'}

        <div class="linking-actions">
          <button class="btn btn-primary" onclick="ENGLISH.speakLinking('${escapeHtml(sentence)}')">🔊 听连读发音</button>
          <button class="btn btn-secondary" onclick="ENGLISH.speakLinkingSlow('${escapeHtml(sentence)}')">🐢 慢速朗读</button>
        </div>
      </div>
    `;
  }

  function speakLinking(sentence, rate = 0.8) {
    speakSentence(sentence, rate);
  }

  function speakLinkingSlow(sentence) {
    speakSentence(sentence, 0.5);
  }

  function speakSentence(sentence, rate = 0.8) {
    if (!sentence || !window.speechSynthesis) {
      showToast('该浏览器不支持语音功能', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(sentence);
    utter.lang = 'en-US';
    utter.rate = rate;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.localService)
      || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utter.voice = enVoice;
    window.speechSynthesis.speak(utter);
  }

  // ==========================================


  // ==========================================
  //  SPEAKING — 场景化日常对话训练
  // ==========================================

  const SCENARIOS = [
    { id:'cafe', icon:'\u2615', title:'\u5496\u5561\u9986\u70b9\u5355',
      situation:'\u4f60\u8d70\u8fdb\u4e00\u5bb6\u5496\u5561\u9986\uff0c\u5e97\u5458\u5fae\u7b11\u7740\u95ee\u4f60\uff1a\u201cHi there, what can I get for you today?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u70b9\u4e00\u676f\u4f60\u559c\u6b22\u7684\u996e\u54c1\uff0c\u5305\u62ec\uff1a\n\u2022 \u996e\u54c1\u540d\u79f0\uff08\u62ff\u94c1\u3001\u7f8e\u5f0f\u3001\u5361\u5e03\u5947\u8bfa\u7b49\uff09\n\u2022 \u6e29\u5ea6\uff08\u70ed/\u51b0\uff09\n\u2022 \u676f\u578b\uff08\u5927/\u4e2d/\u5c0f\uff09\n\u2022 \u5176\u4ed6\u9700\u6c42\uff08\u5982\u8131\u8102\u5976\u3001\u5c11\u7cd6\u7b49\uff09',
      keywords:['coffee','latte','americano','cappuccino','hot','iced','ice','cold','large','medium','small','size','milk','sugar','syrup','please','thank','like','want','have','get','take','would'],
      sampleAnswer:'Hi! Can I have a medium iced latte with oat milk, please?',
      sampleBetter:'I\'d like a medium iced latte with oat milk, please. And could I add a shot of caramel syrup?',
      tip:'\u7528 \u201cI\'d like\u2026\u201d \u6216 \u201cCan I have\u2026\u201d \u6bd4 \u201cI want\u2026\u201d \u66f4\u793c\u8c8c\u81ea\u7136\u3002\u70b9\u5355\u65f6\u5148\u8bf4\u676f\u578b + \u6e29\u5ea6 + \u996e\u54c1\uff0c\u518d\u8bf4\u7279\u6b8a\u9700\u6c42\u3002' },
    { id:'restaurant', icon:'\uD83C\uDF7D\uFE0F', title:'\u9910\u5385\u70b9\u9910',
      situation:'\u4f60\u548c\u670b\u53cb\u6765\u5230\u4e00\u5bb6\u897f\u9910\u5385\uff0c\u670d\u52a1\u5458\u9012\u4e0a\u83dc\u5355\u540e\u8d70\u8fc7\u6765\u95ee\uff1a\u201cAre you ready to order?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u70b9\u83dc\uff0c\u5305\u62ec\uff1a\n\u2022 \u524d\u83dc/\u4e3b\u83dc/\u751c\u70b9\n\u2022 \u7279\u6b8a\u8981\u6c42\uff08\u4e0d\u8981\u67d0\u98df\u6750\u3001\u8fc7\u654f\u7b49\uff09\n\u2022 \u8be2\u95ee\u63a8\u8350\n\u2022 \u7ed3\u8d26',
      keywords:['order','recommend','special','appetizer','main','dessert','menu','check','bill','please','thank','like','have','want','need','could','would','allergic','without','delicious','good','suggestion'],
      sampleAnswer:'Yes, I\'d like the grilled salmon as my main course, please. Could you recommend a good side dish?',
      sampleBetter:'I\'m not quite ready yet \u2014 could you give us a few more minutes? Actually, what would you recommend from the appetizers?',
      tip:'\u201cI\'d like\u2026\u201d \u548c \u201cCould I have\u2026\u201d \u662f\u6700\u5730\u9053\u7684\u70b9\u9910\u8868\u8fbe\u3002\u60f3\u8be2\u95ee\u63a8\u8350\u53ef\u4ee5\u7528 \u201cWhat do you recommend?\u201d\u3002\u5fcc\u53e3\u7528 \u201cI\'m allergic to\u2026\u201d \u6216 \u201cCould you leave out\u2026\u201d\u3002' },
    { id:'hotel', icon:'\uD83C\uDFE8', title:'\u9152\u5e97\u5165\u4f4f',
      situation:'\u4f60\u5230\u8fbe\u9152\u5e97\u524d\u53f0\u529e\u7406\u5165\u4f4f\uff0c\u524d\u53f0\u8bf4\uff1a\u201cWelcome! Do you have a reservation?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u4e0e\u524d\u53f0\u5bf9\u8bdd\uff0c\u5305\u62ec\uff1a\n\u2022 \u786e\u8ba4\u9884\u8ba2\n\u2022 \u5165\u4f4f\u5929\u6570\n\u2022 \u623f\u95f4\u504f\u597d\uff08\u697c\u5c42\u3001\u666f\u89c2\u7b49\uff09\n\u2022 \u8be2\u95ee\u65e9\u9910/WiFi\u7b49\u8bbe\u65bd',
      keywords:['reservation','booking','check','room','night','floor','view','breakfast','wifi','key','card','please','thank','have','need','like','confirm','name','available'],
      sampleAnswer:'Yes, I have a reservation under the name Wang. I\'d like a room with a nice view, please.',
      sampleBetter:'Hi, I have a reservation under Wang. Could I get a room on a higher floor with a city view? Also, what time is breakfast served?',
      tip:'\u7528 \u201cunder the name\u2026\u201d \u8bf4\u660e\u9884\u8ba2\u59d3\u540d\u3002\u60f3\u5347\u7ea7\u623f\u95f4\u53ef\u4ee5\u8bf4 \u201cIs it possible to upgrade?\u201d\u3002\u8be2\u95ee\u8bbe\u65bd\u7528 \u201cWhat time is\u2026?\u201d \u6216 \u201cIs there\u2026?\u201d\u3002' },
    { id:'directions', icon:'\uD83D\uDDFA\uFE0F', title:'\u95ee\u8def',
      situation:'\u4f60\u5728\u4e00\u4e2a\u964c\u751f\u57ce\u5e02\u65c5\u6e38\uff0c\u60f3\u627e\u9644\u8fd1\u7684\u535a\u7269\u9986\u3002\u4f60\u770b\u5230\u4e00\u4f4d\u8def\u4eba\uff0c\u9700\u8981\u4e0a\u524d\u95ee\u8def\u3002\n\n\u8bf7\u7528\u82f1\u8bed\u95ee\u8def\uff0c\u5305\u62ec\uff1a\n\u2022 \u793c\u8c8c\u6253\u62db\u547c\n\u2022 \u8be2\u95ee\u53bb\u67d0\u5730\u600e\u4e48\u8d70\n\u2022 \u786e\u8ba4\u8ddd\u79bb\n\u2022 \u8be2\u95ee\u662f\u5426\u8981\u5750\u8f66',
      keywords:['excuse','sorry','help','where','how','get','go','turn','straight','left','right','block','street','road','far','walk','bus','subway','near','museum','station','please','thank'],
      sampleAnswer:'Excuse me, could you tell me how to get to the nearest museum? Is it within walking distance?',
      sampleBetter:'Excuse me, I\'m a bit lost. Could you tell me the way to the Art Museum? Is it far from here, or can I walk there?',
      tip:'\u95ee\u8def\u524d\u5148\u8bf4 \u201cExcuse me\u201d \u6216 \u201cSorry to bother you\u201d \u975e\u5e38\u793c\u8c8c\u3002\u201cIs it within walking distance?\u201d \u662f\u5730\u9053\u8868\u8fbe\u3002\u8f6c\u5f2f\u7528 \u201cturn left/right\u201d\uff0c\u76f4\u8d70\u7528 \u201cgo straight\u201d\u3002' },
    { id:'shopping', icon:'\uD83D\uDED2', title:'\u8d2d\u7269',
      situation:'\u4f60\u5728\u670d\u88c5\u5e97\u770b\u5230\u4e00\u4ef6\u559c\u6b22\u7684\u8863\u670d\uff0c\u4f46\u60f3\u8bd5\u7a7f\u548c\u95ee\u4ef7\u683c\u3002\u5e97\u5458\u8d70\u8fc7\u6765\u95ee\uff1a\u201cCan I help you find anything?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u4e0e\u5e97\u5458\u4ea4\u6d41\uff0c\u5305\u62ec\uff1a\n\u2022 \u8bd5\u7a7f\u8bf7\u6c42\n\u2022 \u8be2\u95ee\u4ef7\u683c\u548c\u6298\u6263\n\u2022 \u8be2\u95ee\u989c\u8272/\u5c3a\u5bf8\n\u2022 \u7ed3\u8d26',
      keywords:['try','fitting','size','color','price','cost','how much','discount','sale','expensive','cheap','pay','cash','card','like','have','need','please','thank','help','look','this'],
      sampleAnswer:'Yes, could I try this on in a medium? And how much is it? Is there any discount?',
      sampleBetter:'I really like this sweater. Can I try it on in a size M? Also, is this on sale or do you have any promotions right now?',
      tip:'\u201cCan I try this on?\u201d \u8bd5\u7a7f\u3002\u201cDo you have this in a smaller size?\u201d \u6362\u5c3a\u5bf8\u3002\u201cIs this on sale?\u201d \u95ee\u6298\u6263\u3002\u7528\u5361\u652f\u4ed8\u8bf4 \u201cCard, please\u201d\u3002' },
    { id:'doctor', icon:'\uD83C\uDFE5', title:'\u770b\u533b\u751f',
      situation:'\u4f60\u611f\u89c9\u4e0d\u8212\u670d\uff0c\u53bb\u8bca\u6240\u770b\u533b\u751f\u3002\u533b\u751f\u95ee\uff1a\u201cWhat seems to be the problem?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u63cf\u8ff0\u4f60\u7684\u75c7\u72b6\uff0c\u5305\u62ec\uff1a\n\u2022 \u54ea\u91cc\u4e0d\u8212\u670d\n\u2022 \u75c7\u72b6\u6301\u7eed\u591a\u4e45\n\u2022 \u662f\u5426\u6709\u53d1\u70e7/\u8fc7\u654f\n\u2022 \u8fc7\u5f80\u75c5\u53f2',
      keywords:['feel','sick','pain','headache','fever','cough','cold','flu','symptom','since','days','week','allergic','medicine','hurt','sore','stomach','doctor','help','please','throat','bad'],
      sampleAnswer:'I\'ve had a bad headache and a sore throat for three days. I also feel a bit feverish.',
      sampleBetter:'I\'ve been feeling unwell for the past few days. I have a splitting headache and a sore throat, and I think I might have a slight fever. What do you suggest?',
      tip:'\u63cf\u8ff0\u75c7\u72b6\u7528 \u201cI have\u2026\u201d + \u75c7\u72b6\u6216 \u201cI feel\u2026\u201d\u3002\u8bf4\u6301\u7eed\u591a\u4e45\u7528 \u201cfor\u2026\u201d (\u4e00\u6bb5\u65f6\u95f4) \u6216 \u201csince\u2026\u201d (\u65f6\u95f4\u70b9)\u3002\u201cI\'ve been feeling\u2026\u201d \u6bd4 \u201cI feel\u2026\u201d \u66f4\u81ea\u7136\u3002' },
    { id:'airport', icon:'\u2708\uFE0F', title:'\u673a\u573a\u51fa\u884c',
      situation:'\u4f60\u5230\u8fbe\u673a\u573a\uff0c\u9700\u8981\u529e\u7406\u767b\u673a\u624b\u7eed\u3002\u5730\u52e4\u4eba\u5458\u8bf4\uff1a\u201cMay I see your passport and booking reference, please?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u529e\u7406\u767b\u673a\uff0c\u5305\u62ec\uff1a\n\u2022 \u51fa\u793a\u8bc1\u4ef6\n\u2022 \u9009\u5ea7\u4f4d\uff08\u9760\u7a97/\u8fc7\u9053\uff09\n\u2022 \u6258\u8fd0\u884c\u674e\n\u2022 \u8be2\u95ee\u767b\u673a\u53e3\u548c\u767b\u673a\u65f6\u95f4',
      keywords:['passport','boarding','pass','flight','seat','window','aisle','luggage','baggage','check','gate','time','delay','carry','kg','weight','please','thank','have','departure'],
      sampleAnswer:'Here\'s my passport. Could I get a window seat, please? And I\'d like to check in this suitcase.',
      sampleBetter:'Sure, here\'s my passport. Would it be possible to get a window seat? I\'d also like to check this bag in. What gate should I go to and when does boarding start?',
      tip:'\u9009\u5ea7\u4f4d\u8bf4 \u201cWindow seat, please\u201d (\u9760\u7a97) \u6216 \u201cAisle seat, please\u201d (\u8fc7\u9053)\u3002\u95ee\u767b\u673a\u53e3 \u201cWhich gate should I go to?\u201d\u3002\u95ee\u65f6\u95f4 \u201cWhat\'s the boarding time?\u201d\u3002' },
    { id:'smalltalk', icon:'\uD83D\uDC4B', title:'\u793e\u4ea4\u7834\u51b0',
      situation:'\u4f60\u5728\u4e00\u4e2a\u805a\u4f1a\u4e0a\u9047\u5230\u4e00\u4f4d\u65b0\u670b\u53cb\uff0c\u5bf9\u65b9\u5fae\u7b11\u7740\u6253\u62db\u547c\uff1a\u201cHey, I don\'t think we\'ve met before. I\'m Alex!\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u4e0e\u65b0\u670b\u53cb\u4ea4\u6d41\uff0c\u5305\u62ec\uff1a\n\u2022 \u81ea\u6211\u4ecb\u7ecd\n\u2022 \u8be2\u95ee\u5bf9\u65b9\u60c5\u51b5\n\u2022 \u804a\u5174\u8da3\u7231\u597d/\u5de5\u4f5c\n\u2022 \u627e\u4e2a\u5171\u540c\u8bdd\u9898',
      keywords:['nice','meet','hello','hi','name','from','work','job','hobby','like','enjoy','music','movie','travel','sport','great','cool','really','too','also','nice','what about you'],
      sampleAnswer:'Hi Alex, I\'m Sarah. Nice to meet you! I\'m a software engineer. What do you do?',
      sampleBetter:'Hey Alex, great to meet you! I\'m Sarah. I work as a graphic designer. What about you? I love your jacket, by the way \u2014 where did you get it?',
      tip:'\u201cNice to meet you\u201d \u662f\u521d\u6b21\u89c1\u9762\u7684\u6807\u914d\u3002\u7528 \u201cWhat do you do?\u201d \u95ee\u5de5\u4f5c\u3002\u201cHow do you know the host?\u201d \u662f\u5f88\u597d\u7684\u7834\u51b0\u8bdd\u9898\u3002\u8d5e\u7f8e\u5bf9\u65b9\u662f\u4e2a\u597d\u6280\u5de7\u3002' },
    { id:'phone', icon:'\uD83D\uDCDE', title:'\u6253\u7535\u8bdd',
      situation:'\u4f60\u9700\u8981\u6253\u7ed9\u4e00\u5bb6\u9910\u5385\u9884\u8ba2\u5468\u672b\u7684\u4f4d\u5b50\u3002\u7535\u8bdd\u63a5\u901a\u540e\uff1a\u201cThank you for calling Bella Italia, how can I help you?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u6253\u7535\u8bdd\u9884\u8ba2\uff0c\u5305\u62ec\uff1a\n\u2022 \u8868\u660e\u76ee\u7684\n\u2022 \u65f6\u95f4/\u4eba\u6570\n\u2022 \u7279\u6b8a\u8981\u6c42\n\u2022 \u786e\u8ba4\u9884\u8ba2',
      keywords:['hello','booking','reservation','table','tonight','tomorrow','weekend','people','person','time','evening','name','phone','confirm','call','please','thank','like','book','reserve','available'],
      sampleAnswer:'Hi, I\'d like to book a table for two this Friday at 7pm, please.',
      sampleBetter:'Hello! I\'d like to make a reservation for Saturday evening, please. A table for four at around 7:30. And could we sit by the window if possible?',
      tip:'\u6253\u7535\u8bdd\u8bf4 \u201cI\'d like to make a reservation\u201d \u6bd4 \u201cI want to book\u201d \u66f4\u6b63\u5f0f\u3002\u201cFor + \u4eba\u6570 + at + \u65f6\u95f4\u201d \u662f\u6807\u51c6\u683c\u5f0f\u3002\u786e\u8ba4\u7528 \u201cCould you confirm that for me?\u201d\u3002' },
    { id:'interview', icon:'\uD83D\uDCBC', title:'\u6c42\u804c\u9762\u8bd5',
      situation:'\u4f60\u6765\u4e00\u5bb6\u516c\u53f8\u9762\u8bd5\uff0c\u9762\u8bd5\u5b98\u5fae\u7b11\u7740\u8bf4\uff1a\u201cThanks for coming in. Could you start by telling me a bit about yourself?\u201d\n\n\u8bf7\u7528\u82f1\u8bed\u81ea\u6211\u4ecb\u7ecd\uff0c\u5305\u62ec\uff1a\n\u2022 \u6559\u80b2\u80cc\u666f\n\u2022 \u5de5\u4f5c\u7ecf\u9a8c\n\u2022 \u6838\u5fc3\u6280\u80fd\n\u2022 \u4e3a\u4ec0\u4e48\u60f3\u52a0\u5165\u8fd9\u5bb6\u516c\u53f8',
      keywords:['graduate','degree','university','work','experience','year','skill','team','project','learn','company','industry','passionate','interested','opportunity','grow','contribute','strong','good','background'],
      sampleAnswer:'I graduated with a degree in Computer Science and have been working as a front-end developer for three years. I am really passionate about building great user experiences.',
      sampleBetter:'I recently graduated with a degree in Marketing. I have gained valuable experience through internships where I developed strong analytical and communication skills. I am particularly drawn to your company because of your innovative approach.',
      tip:'\u7528 \u201cI graduated from\u2026\u201d \u8bf4\u6559\u80b2\u80cc\u666f\u3002\u201cI have been working as\u2026\u201d \u8bf4\u5de5\u4f5c\u7ecf\u9a8c\u3002\u8868\u8fbe\u70ed\u60c5\u7528 \u201cI am passionate about\u2026\u201d\u3002\u201cI am drawn to your company because\u2026\u201d \u6bd4 \u201cI want to join\u2026\u201d \u66f4\u663e\u6df1\u601d\u719f\u8651\u3002' },
  ];

  // ==========================================
  //  CUSTOM SCENARIOS (用户自定义场景)
  // ==========================================
  const CUSTOM_SCENARIOS_KEY = 'personal_app_custom_scenarios';

  function getCustomScenarios() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_SCENARIOS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveCustomScenario(scenario) {
    const list = getCustomScenarios();
    scenario.id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    scenario.isCustom = true;
    scenario.createdAt = new Date().toISOString();
    list.unshift(scenario);
    try { localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(list)); } catch (e) { console.warn(e); }
    return scenario;
  }

  function deleteCustomScenario(id) {
    let list = getCustomScenarios();
    list = list.filter(s => s.id !== id);
    try { localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(list)); } catch (e) { console.warn(e); }
  }

  function getAllScenarios() {
    return [...SCENARIOS, ...getCustomScenarios()];
  }


  let speakingState = {
    isRecording: false,
    recognition: null,
    scenarioId: null,
    startTime: null,
    timeoutId: null,
    finalTranscript: '',
  };

  function renderSpeaking() {
    currentView = 'speaking';
    var allScenarios = getAllScenarios();
    var customScenarios = getCustomScenarios();
    var container = document.getElementById('dynamic-content');
    var builtinScenarios = allScenarios.filter(function(s) { return !s.isCustom; });
    var customHTML = '';
    if (customScenarios.length > 0) {
      customHTML = '<div class="scenario-section"><h4 style="font-size:0.85rem;font-weight:500;margin-bottom:10px;margin-top:20px;color:var(--accent);letter-spacing:0.035em;">\uD83D\uDCCC 我的自定义场景 (' + customScenarios.length + ')</h4><div class="scenario-grid">' +
        customScenarios.map(function(s) {
          return '<div class="scenario-card" data-id="' + s.id + '" onclick="ENGLISH.selectScenario(\'' + s.id + '\')"><div class="scenario-icon">' + s.icon + '</div><div class="scenario-title">' + s.title + '</div><div class="scenario-arrow">\u2192</div></div>';
        }).join('') + '</div></div>';
    }
    container.innerHTML = [
      '<div class="page-header"><h2>\uD83C\uDFA4 口语训练</h2><p>模拟真实情境 \u00b7 自由发挥 \u00b7 自定义场景 \u00b7 ' + allScenarios.length + ' 个场景</p></div>',
      '<div class="page-body">',
      renderSubNav(),
      '<div class="speaking-container">',
      '<div class="speaking-scenarios" id="speaking-scenarios">',
      '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><h4 style="font-size:0.9rem;font-weight:500;">\uD83D\uDCCC 选择场景开始练习</h4><button class="btn btn-primary btn-sm" onclick="ENGLISH.showScenarioCreator()" style="margin-left:auto;">\u2795 创建场景</button></div>',
      '<div class="scenario-grid">',
      builtinScenarios.map(function(s) {
        return '<div class="scenario-card" data-id="' + s.id + '" onclick="ENGLISH.selectScenario(\'' + s.id + '\')"><div class="scenario-icon">' + s.icon + '</div><div class="scenario-title">' + s.title + '</div><div class="scenario-arrow">\u2192</div></div>';
      }).join(''),
      '</div>',
      customHTML,
      '<div style="margin-top:16px;padding:10px 14px;background:var(--accent-light);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--text-secondary);">\uD83D\uDCA1 数据库共 ' + allScenarios.length + ' 个场景，场景越多练习难度越高。点击\u201c创建场景\u201d丰富数据库吧！</div>',
      '<div class="speaking-history" id="speaking-history" style="margin-top:32px;"></div>',
      '</div>',
      '<div class="speaking-dialog" id="speaking-dialog" style="display:none;"></div>',
      '</div>',
      '</div>',
    ].join('');
    renderSpeakingHistory();
  }

  function selectScenario(id) {
    var scenario = getAllScenarios().find(function(s) { return s.id === id; });
    if (!scenario) return;
    speakingState.scenarioId = id;
    document.getElementById('speaking-scenarios').style.display = 'none';
    var dialog = document.getElementById('speaking-dialog');
    dialog.style.display = 'block';
    dialog.innerHTML = [
      '<div class="scenario-header"><div class="scenario-header-icon">' + scenario.icon + '</div><div class="scenario-header-info"><h3>' + scenario.title + '</h3><p>\u65e5\u5e38\u5bf9\u8bdd\u60c5\u5883\u6a21\u62df \u00b7 \u81ea\u7531\u53d1\u6325</p></div><div style="display:flex;gap:4px;flex-shrink:0;">' + (scenario.isCustom ? '<button class="btn btn-danger btn-sm" onclick="ENGLISH.deleteCurrentScenario()" title="\u5220\u9664\u6b64\u573a\u666f">\ud83d\uddd1\ufe0f \u5220\u9664</button>' : '') + '<button class="btn btn-ghost btn-sm" onclick="ENGLISH.backToScenarios()">\u2190 \u8fd4\u56de\u573a\u666f</button></div></div>',
      '<div class="scenario-situation card"><div class="card-body"><h4>\uD83D\uDCD6 \u60c5\u5883\u8bf4\u660e</h4><div class="situation-text">' + scenario.situation.replace(/\n/g, '<br>') + '</div></div></div>',
      '<div class="scenario-recording card"><div class="card-body" style="text-align:center;"><div style="margin-bottom:8px;font-size:0.85rem;color:var(--text-secondary);">\u70b9\u51fb\u6309\u94ae \u2192 \u7528\u82f1\u8bed\u81ea\u7531\u8868\u8fbe\uff0c\u81f3\u5c11\u8bf4 2-3 \u53e5\u8bdd</div><div class="speaking-controls"><button class="speaking-recording-btn" id="speaking-record-btn" onclick="ENGLISH.toggleRecording()">\uD83C\uDFA4</button></div><div class="speaking-timer" id="speaking-timer">\u51c6\u5907\u597d\u540e\u70b9\u51fb\u9ea6\u514b\u98ce\u5f00\u59cb</div></div></div>',
      '<div class="scenario-manual card" style="margin-top:12px;"><div class="card-header" style="cursor:pointer;" onclick="var el=document.getElementById(\'manual-input-area\');el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.manual-toggle\').textContent=el.style.display===\'none\'?\u25bc:\u25b2;"><span>\u270d\ufe0f \u624b\u52a8\u8f93\u5165</span><span class="manual-toggle">\u25bc</span></div><div class="card-body" id="manual-input-area" style="display:none;"><textarea class="form-control" id="manual-text-input" placeholder="\u5728\u8fd9\u91cc\u6253\u5b57\u8f93\u5165\u4f60\u7684\u53e3\u8bed\u7ec3\u4e60\u56de\u7b54..." style="min-height:80px;"></textarea><div style="margin-top:8px;display:flex;gap:8px;"><button class="btn btn-primary btn-sm" onclick="ENGLISH.submitManualInput()">\ud83d\udcac \u63d0\u4ea4\u5e76\u4fdd\u5b58</button></div></div></div>',
      '<div class="scenario-vocab card" id="scenario-vocab"><div class="card-header" style="cursor:pointer;" onclick="var el=document.getElementById(\'scenario-vocab\');el.classList.toggle(\'collapsed\')"><span>\uD83D\uDCA1 \u53c2\u8003\u8bcd\u6c47 & \u5730\u9053\u8868\u8fbe</span><span class="vocab-toggle">\u5c55\u5f00 \u25be</span></div><div class="card-body vocab-body"><div class="vocab-tags">' + scenario.keywords.map(function(k){ return '<span class="tag vocab-tag">' + k + '</span>'; }).join('') + '</div><div class="vocab-tip"><div style="background:var(--accent-gold-bg);padding:10px 14px;border-radius:var(--radius-sm);margin-top:8px;font-size:0.85rem;"><span style="font-weight:500;">\uD83D\uDC8E \u5efa\u8bae\uff1a</span>' + scenario.tip + '</div></div></div></div>',
      '<div id="speaking-result"></div>',
    ].join('');
  }

  // ==========================================
  //  SCENARIO CREATOR (\u81ea\u5b9a\u4e49\u573a\u666f)
  // ==========================================
  function showScenarioCreator() {
    showModal({
      title: '\u2795 \u521b\u5efa\u81ea\u5b9a\u4e49\u573a\u666f',
      body: [
        '<div class="form-group">',
        '  <label>\u573a\u666f\u540d\u79f0 <span class="required">*</span></label>',
        '  <input type="text" class="form-control" id="scenario-title-input" placeholder="eg: \u56fe\u4e66\u9986\u501f\u4e66">',
        '</div>',
        '<div class="form-group">',
        '  <label>\u573a\u666f\u56fe\u6807 (emoji)</label>',
        '  <input type="text" class="form-control" id="scenario-icon-input" placeholder="eg: \ud83d\udcda" value="\ud83d\udcda">',
        '</div>',
        '<div class="form-group">',
        '  <label>\u573a\u666f\u63cf\u8ff0 <span class="required">*</span></label>',
        '  <textarea class="form-control" id="scenario-situation-input" placeholder="\u63cf\u8ff0\u573a\u666f\u80cc\u666f\u3001\u5bf9\u8bdd\u89d2\u8272\u3001\u9700\u8981\u7ec3\u4e60\u7684\u5185\u5bb9..." style="min-height:100px;"></textarea>',
        '  <div class="form-hint">\u63d0\u793a\uff1a\u5199\u6e05\u695a\u8c01\u5728\u4ec0\u4e48\u573a\u666f\u4e0b\u8bf4\u4ec0\u4e48\uff0c\u63d0\u4f9b\u8db3\u591f\u7684\u4e0a\u4e0b\u6587\u5f15\u5bfc\u7ec3\u4e60</div>',
        '</div>',
        '<div class="form-group">',
        '  <label>\u5173\u952e\u8bcd (\u9017\u53f7\u5206\u9694)</label>',
        '  <textarea class="form-control" id="scenario-keywords-input" placeholder="eg: book, library, borrow, return, due date, fine" style="min-height:50px;"></textarea>',
        '  <div class="form-hint">\u8f93\u5165\u4e0e\u573a\u666f\u76f8\u5173\u7684\u82f1\u6587\u5173\u952e\u8bcd\uff0c\u8bc4\u4f30\u65f6\u4f1a\u53c2\u8003\u8fd9\u4e9b\u8bcd\u6c47</div>',
        '</div>',
        '<div class="form-group">',
        '  <label>\u793a\u8303\u56de\u7b54\uff08\u5165\u95e8\u7ea7\uff09</label>',
        '  <input type="text" class="form-control" id="scenario-sample-input" placeholder="eg: Excuse me, how can I borrow this book?">',
        '</div>',
        '<div class="form-group">',
        '  <label>\u7ec3\u4e60\u5c0f\u63d0\u793a</label>',
        '  <input type="text" class="form-control" id="scenario-tip-input" placeholder="eg: \u7528 \"Could I\u2026\" \u4f1a\u66f4\u793c\u8c8c">',
        '</div>',
      ].join('\\n'),
      footer: [
        '<button class="btn btn-secondary" onclick="closeModal()">\u53d6\u6d88</button>',
        '<button class="btn btn-primary" onclick="ENGLISH.doSaveCustomScenario()">\u2714\ufe0f \u521b\u5efa\u5e76\u4fdd\u5b58</button>',
      ].join('\\n'),
    });
  }

  function doSaveCustomScenario() {
    var title = document.getElementById('scenario-title-input')?.value.trim();
    var icon = document.getElementById('scenario-icon-input')?.value.trim() || '\ud83d\udcda';
    var situation = document.getElementById('scenario-situation-input')?.value.trim();
    var keywordsStr = document.getElementById('scenario-keywords-input')?.value.trim();
    var sampleAnswer = document.getElementById('scenario-sample-input')?.value.trim() || '';
    var tip = document.getElementById('scenario-tip-input')?.value.trim() || '';

    if (!title) { showToast('\u8bf7\u8f93\u5165\u573a\u666f\u540d\u79f0', 'error'); return; }
    if (!situation) { showToast('\u8bf7\u8f93\u5165\u573a\u666f\u63cf\u8ff0', 'error'); return; }

    var keywords = keywordsStr ? keywordsStr.split(/[,，\s]+/).filter(function(k) { return k.trim(); }) : [];

    var scenario = {
      icon: icon,
      title: title,
      situation: situation,
      keywords: keywords,
      sampleAnswer: sampleAnswer,
      sampleBetter: '',
      tip: tip,
    };

    saveCustomScenario(scenario);
    closeModal();
    showToast('\u2705 \u573a\u666f\u5df2\u521b\u5efa\uff01\u6570\u636e\u5e93\u73b0\u5728\u5171 ' + getAllScenarios().length + ' \u4e2a\u573a\u666f');
    renderSpeaking();
  }



  function deleteCurrentScenario() {
    var id = speakingState.scenarioId;
    if (!id || !id.startsWith('custom_')) return;
    if (confirm('确定要删除这个自定义场景吗？')) {
      deleteCustomScenario(id);
      showToast('场景已删除');
      renderSpeaking();
    }
  }

  function backToScenarios() {
    document.getElementById('speaking-scenarios').style.display = 'block';
    document.getElementById('speaking-dialog').style.display = 'none';
  }

  function submitManualInput() {
    var textarea = document.getElementById('manual-text-input');
    if (!textarea) return;
    var text = textarea.value.trim();
    if (!text) {
      showToast('请输入你要练习的口语内容', 'error');
      return;
    }
    // 设定开始时间用于记录
    speakingState.startTime = Date.now();
    // 直接用输入文本进行评估和保存
    evaluateScenarioResponse(text);
    // 清空输入框
    textarea.value = '';
  }

  function toggleRecording() {
    speakingState.isRecording ? stopRecording() : startRecording();
  }

  function startRecording() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      showToast('\u8bed\u97f3\u8bc6\u522b\u9700\u8981 Chrome \u6d4f\u89c8\u5668', 'error');
      return;
    }
    var SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    speakingState.recognition = new SpeechRecognitionAPI();
    speakingState.recognition.lang = 'en-US';
    speakingState.recognition.continuous = true;
    speakingState.recognition.interimResults = true;
    speakingState.recognition.maxAlternatives = 1;
    speakingState.finalTranscript = '';

    speakingState.recognition.onresult = function(event) {
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          speakingState.finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      var timerEl = document.getElementById('speaking-timer');
      if (timerEl && speakingState.finalTranscript.trim()) {
        timerEl.textContent = '\uD83C\uDFA4 ' + speakingState.finalTranscript.trim().split(/\s+/).length + ' \u8bcd \u00b7 \u7ee7\u7eed\u8bf4\u2026';
      }
    };
    speakingState.recognition.onerror = function(event) {
      stopRecording();
      var msg = event.error === 'not-allowed' ? '\u8bf7\u5141\u8bb8\u9ea6\u514b\u98ce\u6743\u9650' : (event.error === 'no-speech' ? '\u672a\u68c0\u6d4b\u5230\u8bed\u97f3' : '\u8bc6\u522b\u51fa\u9519\uff1a' + event.error);
      showToast(msg, 'error');
    };

    speakingState.isRecording = true;
    speakingState.startTime = Date.now();
    var btn = document.getElementById('speaking-record-btn');
    if (btn) { btn.classList.add('recording'); btn.textContent = '\u23F9'; }
    var timerEl = document.getElementById('speaking-timer');
    if (timerEl) timerEl.textContent = '\uD83C\uDFA4 \u5f55\u97f3\u4e2d\u2026 \u8bf7\u7528\u82f1\u8bed\u81ea\u7531\u8868\u8fbe\uff01';
    try { speakingState.recognition.start(); } catch(e) {}

    speakingState.timeoutId = setTimeout(function() {
      if (speakingState.isRecording) { showToast('\u23F0 \u65f6\u95f4\u5230\uff01', 'info'); stopRecording(); }
    }, 20000);
  }

  function stopRecording() {
    speakingState.isRecording = false;
    if (speakingState.timeoutId) { clearTimeout(speakingState.timeoutId); speakingState.timeoutId = null; }
    if (speakingState.recognition) { try { speakingState.recognition.stop(); } catch(e) {} }
    var btn = document.getElementById('speaking-record-btn');
    if (btn) { btn.classList.remove('recording'); btn.textContent = '\uD83C\uDFA4'; }
    var timerEl = document.getElementById('speaking-timer');
    if (timerEl) timerEl.textContent = '\uD83D\uDD04 \u5904\u7406\u4e2d\u2026';
    setTimeout(function() { captureFinalTranscript(); }, 400);
  }

  function captureFinalTranscript() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;
    if (speakingState.finalTranscript && speakingState.finalTranscript.trim().length > 3) {
      evaluateScenarioResponse(speakingState.finalTranscript.trim());
      return;
    }
    var SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    var captureRec = new SpeechRecognitionAPI();
    captureRec.lang = 'en-US';
    captureRec.continuous = false;
    captureRec.interimResults = false;
    captureRec.maxAlternatives = 1;
    var timerEl = document.getElementById('speaking-timer');
    captureRec.onresult = function(event) {
      var transcript = event.results[0][0].transcript.trim();
      if (transcript) { if (timerEl) timerEl.textContent = '\u2705 \u5206\u6790\u4e2d\u2026'; evaluateScenarioResponse(transcript); }
      else { if (timerEl) timerEl.textContent = '\uD83D\uDE05 \u672a\u68c0\u6d4b\u5230\u8bed\u97f3\uff0c\u8bf7\u91cd\u8bd5'; }
    };
    captureRec.onerror = function() {
      if (timerEl) timerEl.textContent = '\u26A0\uFE0F \u8bc6\u522b\u5931\u8d25';
      evaluateScenarioResponse(speakingState.finalTranscript || '');
    };
    if (timerEl) timerEl.textContent = '\uD83C\uDFA4 \u8bf7\u518d\u8bf4\u4e00\u904d\u2026';
    try { captureRec.start(); } catch(e) {}
    setTimeout(function() { try { captureRec.stop(); } catch(e) {} }, 5000);
  }

  function evaluateScenarioResponse(transcript) {
    var scenario = getAllScenarios().find(function(s) { return s.id === speakingState.scenarioId; });
    if (!scenario) return;
    if (!transcript || !transcript.trim()) {
      document.getElementById('speaking-result').innerHTML = '<div class="speaking-suggestions" style="text-align:center;padding:20px;">\uD83D\uDE05 \u6ca1\u6709\u6355\u6349\u5230\u4f60\u7684\u58f0\u97f3\uff0c\u8bf7\u518d\u8bd5\u4e00\u6b21</div>';
      return;
    }

    var resultEl = document.getElementById('speaking-result');
    var duration = (Date.now() - speakingState.startTime) / 1000;
    var text = transcript.toLowerCase().trim();
    var words = text.split(/\s+/).filter(Boolean);
    var wordCount = words.length;

    var uniqueKeywords = scenario.keywords.filter(function(v,i,a){return a.indexOf(v)===i;});
    var matchedKeywords = [];
    uniqueKeywords.forEach(function(kw) { if (text.includes(kw.toLowerCase())) matchedKeywords.push(kw); });
    var keywordScore = uniqueKeywords.length > 0 ? Math.round((matchedKeywords.length / Math.min(uniqueKeywords.length, 12)) * 100) : 0;

    var sentenceEndings = (text.match(/[.!?]+/g) || []).length;
    var sentenceCount = Math.max(1, sentenceEndings || Math.ceil(wordCount / 8) || 1);
    var avgWordsPerSentence = wordCount / sentenceCount;
    var complexIndicators = ['because','although','which','that','when','if','since','while','however','therefore','actually','honestly','definitely','probably'];
    var hasComplexStructures = complexIndicators.filter(function(w) { return text.includes(w); }).length;
    var questionForms = ['can i','could i','can you','could you','would you','may i','do you','is there','are there','what do','how do'];
    var hasQuestions = questionForms.filter(function(q) { return text.includes(q); }).length;
    var politeMarkers = ['please','thank','thanks','sorry','excuse me','appreciate'];
    var hasPolite = politeMarkers.filter(function(p) { return text.includes(p); }).length;

    var fluencyScore = 0;
    if (wordCount >= 8) fluencyScore += 20; else if (wordCount >= 5) fluencyScore += 12; else fluencyScore += 4;
    if (sentenceCount >= 3) fluencyScore += 20; else if (sentenceCount >= 2) fluencyScore += 14; else if (sentenceCount >= 1) fluencyScore += 8;
    fluencyScore = Math.min(fluencyScore + hasComplexStructures * 5 + hasQuestions * 4, 40);

    var uniqueWordsSet = new Set(words);
    var vocabRatio = words.length > 0 ? uniqueWordsSet.size / words.length : 0;
    var vocabScore = vocabRatio > 0.8 ? 20 : vocabRatio > 0.65 ? 15 : vocabRatio > 0.5 ? 10 : 5;

    // Difficulty scaling based on total scenario count
    var totalScenarios = getAllScenarios().length;
    var difficultyLevel = Math.min(3, Math.floor((totalScenarios - 10) / 5)); // 0-3, every 5 scenarios above 10 = +1 level
    if (difficultyLevel < 0) difficultyLevel = 0;
    var difficultyMultiplier = 1 + difficultyLevel * 0.15; // 1x, 1.15x, 1.3x, 1.45x

    // Adjust thresholds based on difficulty
    var minWordsTarget = 8 + difficultyLevel * 3;       // 8, 11, 14, 17
    var minSentencesTarget = 2 + difficultyLevel;        // 2, 3, 4, 5
    var minKeywordsTarget = 3 + difficultyLevel;         // 3, 4, 5, 6
    var excellentWordCount = 20 + difficultyLevel * 5;   // 20, 25, 30, 35

    var rawScore = Math.round((keywordScore * 0.35 + fluencyScore * 1.2 + vocabScore * 0.8 + hasPolite * 2) / difficultyMultiplier);
    var finalScore = Math.min(100, Math.max(10, rawScore));

    var feedback = [];
    if (wordCount < minWordsTarget) {
      feedback.push({ type:'improve', icon:'\uD83D\uDCCF', title:'\u8868\u8fbe\u53ef\u4ee5\u66f4\u5145\u5b9e', desc:'\u4f60\u8bf4\u4e86 ' + wordCount + ' \u4e2a\u8bcd\u3002\u8bd5\u7740\u591a\u8bf4\u4e00\u4e9b\uff0c\u63cf\u8ff0\u7ec6\u8282\u3001\u8868\u8fbe\u611f\u53d7\u3001\u89e3\u91ca\u539f\u56e0\u80fd\u8ba9\u5bf9\u8bdd\u66f4\u81ea\u7136\u3002' + (difficultyLevel > 0 ? ' (\u96be\u5ea6\u7b49\u7ea7' + difficultyLevel + '\uff0c\u76ee\u6807' + minWordsTarget + '\u8bcd)' : '') });
    } else if (wordCount >= excellentWordCount) {
      feedback.push({ type:'excellent', icon:'\uD83C\uDF1F', title:'\u8868\u8fbe\u5f88\u5145\u5b9e', desc:'\u8bf4\u4e86 ' + wordCount + ' \u4e2a\u8bcd\uff0c\u5185\u5bb9\u4e30\u5bcc\uff01' });
    } else {
      feedback.push({ type:'good', icon:'\uD83D\uDC4D', title:'\u57fa\u7840\u8868\u8fbe\u6709\u4e86', desc:'\u8bf4\u4e86 ' + wordCount + ' \u4e2a\u8bcd\uff0c\u4e0d\u9519\u7684\u5f00\u59cb\uff01' + (difficultyLevel > 0 ? ' (\u96be\u5ea6' + difficultyLevel + ' \u76ee\u6807' + minWordsTarget + '\u8bcd)' : '') });
    }
    if (sentenceCount < minSentencesTarget) {
      feedback.push({ type:'improve', icon:'\uD83D\uDCDD', title:'\u5c1d\u8bd5\u7528\u591a\u4e2a\u53e5\u5b50', desc:'\u53ea\u8bf4\u4e86 ' + sentenceCount + ' \u53e5\u8bdd\u3002' + (difficultyLevel > 0 ? ' (\u96be\u5ea6' + difficultyLevel + ' \u76ee\u6807' + minSentencesTarget + '\u53e5)' : '\u7528 And/Also/Because \u6765\u6269\u5c55\u6210 2-4 \u53e5\u8bdd\u3002') });
    }
    if (hasQuestions === 0) {
      feedback.push({ type:'improve', icon:'\uD83D\uDCAC', title:'\u589e\u52a0\u4e92\u52a8\u611f', desc:'\u5bf9\u8bdd\u662f\u53cc\u5411\u7684\u3002\u8bd5\u7740\u52a0\u4e0a \u201cWhat do you think?\u201d \u6216 \u201cHow about you?\u201d\u3002' });
    }
    if (hasPolite === 0) {
      feedback.push({ type:'improve', icon:'\uD83C\uDFA9', title:'\u4f7f\u7528\u793c\u8c8c\u7528\u8bed', desc:'\u52a0\u4e0a please / thank you / excuse me \u4f1a\u8ba9\u8868\u8fbe\u66f4\u5730\u9053\u3002' });
    } else {
      feedback.push({ type:'excellent', icon:'\u2728', title:'\u6ce8\u610f\u5230\u793c\u8c8c\u7528\u8bed', desc:'\u4f7f\u7528\u4e86\u793c\u8c8c\u7528\u8bed\uff0c\u8fd9\u5728\u65e5\u5e38\u5bf9\u8bdd\u4e2d\u975e\u5e38\u91cd\u8981\u3002' });
    }
    if (matchedKeywords.length < minKeywordsTarget) {
      var missed = uniqueKeywords.slice(0, minKeywordsTarget + 2).filter(function(k){return !text.includes(k);});
      if (missed.length > 0) {
        feedback.push({ type:'improve', icon:'\uD83C\uDFAF', title:'\u5173\u952e\u8bcd\u53ef\u66f4\u7cbe\u51c6', desc:'\u8bd5\u8bd5\u4f7f\u7528: ' + missed.map(function(k){return '\u300c' + k + '\u300d';}).join(' ') + (difficultyLevel > 0 ? ' (\u96be\u5ea6' + difficultyLevel + ' \u76ee\u6807' + minKeywordsTarget + '\u4e2a)' : '') });
      }
    } else if (matchedKeywords.length >= minKeywordsTarget + 2) {
      feedback.push({ type:'excellent', icon:'\uD83C\uDFAF', title:'\u5173\u952e\u8bcd\u8fd0\u7528\u5230\u4f4d', desc:'\u6db5\u76d6\u4e86 ' + matchedKeywords.length + ' \u4e2a\u573a\u666f\u8bcd\u6c47\uff01' });
    } else if (matchedKeywords.length >= minKeywordsTarget) {
      feedback.push({ type:'good', icon:'\uD83C\uDFAF', title:'\u5173\u952e\u8bcd\u57fa\u672c\u5f97\u5f53', desc:'\u6db5\u76d6\u4e86 ' + matchedKeywords.length + ' \u4e2a\u573a\u666f\u8bcd\u6c47' });
    }
    if (hasComplexStructures > 0) {
      feedback.push({ type:'excellent', icon:'\uD83E\uDDE0', title:'\u53e5\u5f0f\u4e30\u5bcc', desc:'\u4f7f\u7528\u4e86\u590d\u5408\u53e5\u5f0f (because/which/if\u7b49)\uff0c\u8868\u8fbe\u66f4\u6709\u5c42\u6b21\u3002' });
    } else {
      feedback.push({ type:'tip', icon:'\uD83D\uDCA1', title:'\u5c1d\u8bd5\u590d\u5408\u53e5', desc:'\u7528 because \u89e3\u91ca\u539f\u56e0\u3001which \u8865\u5145\u4fe1\u606f\u3001if \u63d0\u51fa\u6761\u4ef6\u3002' });
    }
    if (finalScore >= 80) {
      feedback.push({ type:'excellent', icon:'\uD83C\uDF89', title:'\u6574\u4f53\u51fa\u8272', desc:'\u8868\u8fbe\u5f88\u5730\u9053\uff01\u7ee7\u7eed\u4fdd\u6301\uff0c\u7ec3\u4e60\u66f4\u591a\u573a\u666f\u3002' });
    } else if (finalScore < 40) {
      feedback.push({ type:'improve', icon:'\uD83D\uDD25', title:'\u4ece\u57fa\u7840\u5f00\u59cb', desc:'\u5148\u770b\u53c2\u8003\u8bcd\u6c47\u548c\u793a\u4f8b\u56de\u7b54\uff0c\u70b9\u51fb\u542c\u53d1\u97f3\uff0c\u8ddf\u7740\u6a21\u4eff\u3002' });
    }
    else if (finalScore < 40) feedback.push({ type:'improve', icon:'\uD83D\uDD25', title:'\u4ece\u57fa\u7840\u5f00\u59cb', desc:'\u5148\u770b\u53c2\u8003\u8bcd\u6c47\u548c\u793a\u4f8b\u56de\u7b54\uff0c\u70b9\u51fb\ud83d\udd0a\u542c\u53d1\u97f3\uff0c\u8ddf\u7740\u6a21\u4eff\u3002'});

    var polished = text.charAt(0).toUpperCase() + text.slice(1);
    if (!/[.!?]$/.test(polished)) polished += '.';
    if (/^i want/i.test(polished)) polished = polished.replace(/^i want/i, "I'd like");

    STORAGE.addSpeakingRecord({
      sentence: scenario.title,
      transcribed: transcript,
      accuracy: finalScore,
      details: { wordCount: wordCount, keywordMatches: matchedKeywords, feedback: feedback },
      duration: duration,
    });

    resultEl.innerHTML = [
      '<div class="speaking-feedback">',
      '<div class="feedback-scorecard"><div class="score-ring"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="5"/><circle cx="40" cy="40" r="34" fill="none" stroke="' + (finalScore>=65?'var(--secondary)':finalScore>=45?'var(--accent-gold)':'var(--accent-rose)') + '" stroke-width="5" stroke-dasharray="' + ((finalScore/100)*214).toFixed(1) + ' 214" stroke-dashoffset="0" transform="rotate(-90, 40, 40)"/></svg><div class="score-number">' + finalScore + '</div></div><div class="score-details"><div class="score-label">\u7efc\u5408\u8bc4\u5206</div><div class="score-sub">' + (finalScore>=75?'\uD83C\uDF89 \u8868\u8fbe\u4f18\u79c0\uff01':finalScore>=50?'\uD83D\uDC4D \u8868\u73b0\u4e0d\u9519\uff01':'\uD83D\uDCAA \u7ee7\u7eed\u52a0\u6cb9\uff01') + '</div></div></div>',
      '<div class="feedback-section"><div class="feedback-section-title">\uD83D\uDCDD \u4f60\u7684\u8868\u8fbe</div><div class="feedback-user-text">' + escapeHtml(transcript) + '</div><div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' + wordCount + ' \u4e2a\u8bcd \u00b7 ' + sentenceCount + ' \u53e5\u8bdd \u00b7 ' + Math.round(duration) + ' \u79d2</div></div>',
      '<div class="feedback-dimensions">',
      '<div class="dimension-item"><div class="dimension-header"><span class="dimension-label">\uD83C\uDFAF \u5173\u952e\u8bcd\u8986\u76d6</span><span class="dimension-score" style="color:' + (keywordScore>=60?'var(--secondary)':'var(--accent-gold)') + ';">' + matchedKeywords.length + '/' + uniqueKeywords.length + '</span></div><div class="feedback-bar-track"><div class="feedback-bar-fill" style="width:' + Math.min(100,keywordScore) + '%;background:' + (keywordScore>=60?'var(--secondary)':'var(--accent-gold)') + ';"></div></div>' + (matchedKeywords.length>0?'<div class="dimension-keywords">\u2705 ' + matchedKeywords.map(function(k){return '<span class="keyword-badge used">' + k + '</span>';}).join(' ') + '</div>':'') + '</div>',
      '<div class="dimension-item"><div class="dimension-header"><span class="dimension-label">\uD83D\uDCAC \u8868\u8fbe\u6d41\u7545\u5ea6</span><span class="dimension-score" style="color:' + (fluencyScore>=24?'var(--secondary)':'var(--accent-gold)') + ';">' + Math.min(40,fluencyScore) + '/40</span></div><div class="feedback-bar-track"><div class="feedback-bar-fill" style="width:' + Math.min(100,fluencyScore*2.5) + '%;background:' + (fluencyScore>=24?'var(--secondary)':'var(--accent-gold)') + ';"></div></div><div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' + (avgWordsPerSentence<6?'\u53e5\u5b50\u504f\u77ed\uff0c\u5c1d\u8bd5\u66f4\u5b8c\u6574\u7684\u53e5\u5b50':avgWordsPerSentence<12?'\u53e5\u5b50\u957f\u5ea6\u9002\u4e2d\uff0c\u81ea\u7136\u6d41\u7545':'\u53e5\u5b50\u7ed3\u6784\u4e30\u5bcc') + (hasComplexStructures>0?' \u00b7 \u4f7f\u7528\u4e86\u590d\u6742\u53e5\u5f0f \u2728':'') + '</div></div>',
      '<div class="dimension-item"><div class="dimension-header"><span class="dimension-label">\uD83D\uDCDA \u8bcd\u6c47\u591a\u6837\u6027</span><span class="dimension-score" style="color:' + (vocabScore>=12?'var(--secondary)':'var(--accent-gold)') + ';">' + vocabScore + '/20</span></div><div class="feedback-bar-track"><div class="feedback-bar-fill" style="width:' + (vocabScore*5) + '%;background:' + (vocabScore>=12?'var(--secondary)':'var(--accent-gold)') + ';"></div></div><div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' + (vocabRatio>0.7?'\u8bcd\u6c47\u4e30\u5bcc\uff0c\u6ca1\u6709\u91cd\u590d\u4f7f\u7528\u76f8\u540c\u8868\u8fbe \uD83D\uDC4D':'\u5c1d\u8bd5\u4f7f\u7528\u66f4\u591a\u4e0d\u540c\u7684\u8bcd\u6c47\uff0c\u907f\u514d\u91cd\u590d') + '</div></div>',
      '</div>',
      (feedback.length>0?'<div class="feedback-section"><div class="feedback-section-title">\uD83D\uDCA1 \u8be6\u7ec6\u70b9\u8bc4</div><div class="feedback-items">' + feedback.map(function(f){return '<div class="feedback-item ' + f.type + '"><span class="feedback-icon">' + f.icon + '</span><div><div style="font-weight:500;font-size:0.88rem;">' + f.title + '</div><div style="font-size:0.83rem;color:var(--text-secondary);margin-top:2px;">' + f.desc + '</div></div></div>';}).join('') + '</div></div>':''),
      '<div class="feedback-section"><div class="feedback-section-title">\u2728 \u6da6\u8272\u793a\u8303</div><div class="feedback-polish"><div class="polish-comparison"><div class="polish-side"><div class="polish-label">\u4f60\u7684\u8868\u8fbe</div><div class="polish-text original">' + escapeHtml(transcript) + '</div></div><div class="polish-arrow">\u2192</div><div class="polish-side"><div class="polish-label">\u4f18\u5316\u7248\u672c</div><div class="polish-text improved">' + escapeHtml(polished) + '</div></div></div><div style="font-size:0.82rem;color:var(--text-secondary);margin-top:8px;padding:8px 12px;background:var(--accent-gold-bg);border-radius:var(--radius-sm);">\uD83D\uDC8E ' + scenario.tip + '</div></div></div>',
      '<div class="feedback-section"><div class="feedback-section-title">\uD83C\uDFAF \u53c2\u8003\u56de\u7b54</div><div class="feedback-sample"><div style="margin-bottom:8px;"><div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">\u5165\u95e8\u7ea7</div><div style="font-size:0.95rem;line-height:1.6;">' + escapeHtml(scenario.sampleAnswer) + '</div></div><div><div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:4px;">\u8fdb\u9636\u7ea7</div><div style="font-size:0.95rem;line-height:1.6;">' + escapeHtml(scenario.sampleBetter) + '</div></div></div></div>',
      '<div class="feedback-actions"><button class="btn btn-primary" onclick="ENGLISH.speakSentence("ENGLISH_ESC_TRANSCRIPT", 0.8)">\uD83D\uDD0A \u542c\u4f60\u7684\u53d1\u97f3</button><button class="btn btn-secondary" onclick="ENGLISH.speakSentence("ENGLISH_ESC_POLISHED", 0.8)">\uD83D\uDD0A \u542c\u4f18\u5316\u7248</button><button class="btn btn-ghost" onclick="ENGLISH.redoSameScenario()">\uD83D\uDD04 \u518d\u8bf4\u4e00\u6b21</button></div>',
      '</div>',
    ].join('').replace('ENGLISH_ESC_TRANSCRIPT', escapeHtml(transcript)).replace('ENGLISH_ESC_POLISHED', escapeHtml(polished));

    renderSpeakingHistory();
  }

  function redoSameScenario() {
    if (speakingState.scenarioId) selectScenario(speakingState.scenarioId);
  }

  function renderSpeakingHistory() {
    var historyEl = document.getElementById('speaking-history');
    if (!historyEl) return;
    var history = STORAGE.getSpeakingHistory().slice(0, 8);
    if (history.length === 0) {
      historyEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:12px;">\u8fd8\u6ca1\u6709\u7ec3\u4e60\u8bb0\u5f55\uff0c\u9009\u4e00\u4e2a\u573a\u666f\u5f00\u59cb\u5427 \uD83C\uDFA4</div>';
      return;
    }
    historyEl.innerHTML = [
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:0.85rem;font-weight:500;color:var(--text-secondary);">\uD83D\uDCCB \u7ec3\u4e60\u8bb0\u5f55</span><span style="font-size:0.72rem;color:var(--text-muted);">\u6700\u8fd1 ' + history.length + ' \u6b21</span></div>',
      history.map(function(h) {
        var sc = h.accuracy >= 65 ? 'high' : (h.accuracy >= 45 ? 'medium' : 'low');
        var d = new Date(h.createdAt).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
        return '<div class="speaking-history-item" onclick="ENGLISH.reviewSpeaking(\'' + h.id + '\')"><span style="font-size:0.82rem;flex-shrink:0;">' + escapeHtml(h.sentence) + '</span><span class="history-sentence">' + escapeHtml((h.transcribed||'').substring(0,28)) + '</span><div class="speaking-score ' + sc + '" style="flex-shrink:0;">' + h.accuracy + '%</div><span style="font-size:0.7rem;color:var(--text-muted);margin-left:4px;flex-shrink:0;">' + d + '</span></div>';
      }).join(''),
    ].join('');
  }

  function reviewSpeaking(id) {
    var history = STORAGE.getSpeakingHistory();
    var record = history.find(function(h) { return h.id === id; });
    if (!record) return;
    var resultEl = document.getElementById('speaking-result');
    if (!resultEl) return;
    var sc = record.accuracy >= 65 ? 'high' : (record.accuracy >= 45 ? 'medium' : 'low');
    var fb = (record.details && record.details.feedback) || [];
    resultEl.innerHTML = [
      '<div class="speaking-result-card"><div class="speaking-result-header"><div><div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:2px;">\uD83D\uDCCB ' + escapeHtml(record.sentence) + ' \u56de\u987e</div><div style="font-size:0.95rem;">' + escapeHtml(record.transcribed||'') + '</div></div><div class="speaking-score ' + sc + '">' + record.accuracy + '%</div></div>',
      (fb.length > 0 ? '<div class="speaking-suggestions"><div style="font-weight:500;margin-bottom:4px;">\uD83D\uDCA1 \u53cd\u9988</div>' + fb.slice(0,3).map(function(f){return '<div>\u00b7 [' + f.title + '] ' + f.desc + '</div>';}).join('') + '</div>' : ''),
      '<div style="margin-top:12px;display:flex;gap:8px;"><button class="btn btn-primary btn-sm" onclick="ENGLISH.speakSentence("' + escapeHtml(record.transcribed) + '", 0.8)">\uD83D\uDD0A \u542c\u4f60\u7684\u53d1\u97f3</button><button class="btn btn-ghost btn-sm" onclick="ENGLISH.redoSameScenario()">\uD83D\uDD04 \u518d\u7ec3\u4e00\u6b21</button></div>',
      '</div>',
    ].join('');
  }



  // ==========================================
  //  PUBLIC API
  // ==========================================
  return {
    // Word list
    renderWordList, showWordEditor, deleteWord,
    // Quiz
    renderQuiz, startQuiz, answerQuiz, quitQuiz,
    // Progress
    renderProgress,
    // Dictionary
    renderDictionary, dictLookup, playDictAudio, lookupRelated, addFromDict,
    // Pronunciation
    speakWord,
    // Sentence Linking
    renderLinking, analyzeLinking, speakLinking, speakLinkingSlow,
    // Speaking Training
    renderSpeaking, selectScenario, backToScenarios, toggleRecording,
    redoSameScenario, reviewSpeaking, speakSentence, submitManualInput,
    showScenarioCreator, doSaveCustomScenario, deleteCurrentScenario,
    // Translation
    renderTranslate, translateText, swapLanguage, setSourceLang,
    speakTranslation, addFromTranslate,
  };
})();
