/* ============================================
   Storage Layer - localStorage Wrapper
   With auto file backup for crash recovery
   ============================================ */

const STORAGE = (() => {
  const KEYS = {
    NOTES: 'personal_app_notes',
    WORDS: 'personal_app_words',
    QUIZZES: 'personal_app_quizzes',
    SETTINGS: 'personal_app_settings',
    RECENT: 'personal_app_recent_notes',
    PINNED: 'personal_app_pinned_notes',
    SPEAKING: 'personal_app_speaking',
  };

  // ---------- File backup ----------
  const BACKUP_KEY = 'as_backup';
  let backupTimer = null;

  function scheduleBackup() {
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = setTimeout(saveBackupToFile, 2000);
  }

  function saveBackupToFile() {
    try {
      const data = {};
      Object.values(KEYS).forEach(key => {
        const val = localStorage.getItem(key);
        if (val) data[key] = JSON.parse(val);
      });
      // Also store in localStorage itself as a backup
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Backup save failed:', e);
    }
  }

  function recoverFromBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      let restored = 0;
      Object.entries(data).forEach(([key, val]) => {
        const existing = localStorage.getItem(key);
        if (!existing || JSON.parse(existing).length === 0) {
          localStorage.setItem(key, JSON.stringify(val));
          restored++;
        }
      });
      return restored > 0;
    } catch (e) {
      console.warn('Backup recovery failed:', e);
      return false;
    }
  }

  // ---------- Server sync (file persistence — survives localStorage clears) ----------
  let serverSyncTimer = null;

  function scheduleServerSync() {
    if (serverSyncTimer) clearTimeout(serverSyncTimer);
    serverSyncTimer = setTimeout(syncAllToServer, 3000);
  }

  function syncAllToServer() {
    try {
      const data = {};
      Object.values(KEYS).forEach(key => {
        const val = localStorage.getItem(key);
        if (val) data[key] = JSON.parse(val);
      });
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => { /* server might not be available */ });
    } catch (e) { /* silent */ }
  }

  function restoreFromServer() {
    return fetch('/api/data')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        let restored = 0;
        Object.entries(data).forEach(([key, val]) => {
          const existing = localStorage.getItem(key);
          if (!existing || JSON.parse(existing).length === 0) {
            localStorage.setItem(key, JSON.stringify(val));
            restored++;
          }
        });
        return restored;
      })
      .catch(() => 0);
  }

  // Auto-recover from backup on init
  recoverFromBackup();

  // Try to restore from server file (takes priority)
  setTimeout(() => {
    restoreFromServer().then(count => {
      if (count > 0) {
        console.log(`🔄 Restored ${count} datasets from server backup`);
        // Reload the page so all UI reflects the restored data
        // Only reload if we actually had zero data before restore
        window.location.reload();
      }
    });
  }, 300);

  // ---------- Safe JSON helpers ----------
  function getData(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn(`Storage read error [${key}]:`, e);
      return fallback;
    }
  }

  function setData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      scheduleBackup();
      scheduleServerSync();
      return true;
    } catch (e) {
      console.error(`Storage write error [${key}]:`, e);
      return false;
    }
  }

  // ---------- ID Generator ----------
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ---------- Notes CRUD ----------
  function getNotes() {
    return getData(KEYS.NOTES, []);
  }

  function saveNotes(notes) {
    return setData(KEYS.NOTES, notes);
  }

  function addNote(note) {
    const notes = getNotes();
    const newNote = {
      id: generateId(),
      title: note.title.trim(),
      content: note.content.trim(),
      tags: note.tags || [],
      pinned: false,
      template: note.template || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    saveNotes(notes);
    return newNote;
  }

  function updateNote(id, updates) {
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    notes[idx] = {
      ...notes[idx],
      ...updates,
      id: notes[idx].id,
      createdAt: notes[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    saveNotes(notes);
    return notes[idx];
  }

  function deleteNote(id) {
    const notes = getNotes();
    const filtered = notes.filter(n => n.id !== id);
    if (filtered.length === notes.length) return false;
    saveNotes(filtered);
    return true;
  }

  function getNote(id) {
    const notes = getNotes();
    return notes.find(n => n.id === id) || null;
  }

  // ---------- Tags ----------
  function getAllTags() {
    const notes = getNotes();
    const tagMap = {};
    notes.forEach(n => {
      (n.tags || []).forEach(t => {
        tagMap[t] = (tagMap[t] || 0) + 1;
      });
    });
    // Sort by count descending, then alphabetically
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }

  // ---------- Words CRUD ----------
  function getWords() {
    return getData(KEYS.WORDS, []);
  }

  function saveWords(words) {
    return setData(KEYS.WORDS, words);
  }

  function addWord(wordData) {
    const words = getWords();
    const newWord = {
      id: generateId(),
      word: wordData.word.trim(),
      translation: wordData.translation.trim(),
      example: (wordData.example || '').trim(),
      notes: (wordData.notes || '').trim(),
      category: wordData.category || 'general',
      difficulty: Math.min(5, Math.max(1, parseInt(wordData.difficulty) || 1)),
      correctCount: 0,
      wrongCount: 0,
      reviewCount: 0,
      lastReviewed: null,
      createdAt: new Date().toISOString(),
    };
    words.unshift(newWord);
    saveWords(words);
    return newWord;
  }

  function updateWord(id, updates) {
    const words = getWords();
    const idx = words.findIndex(w => w.id === id);
    if (idx === -1) return null;
    words[idx] = {
      ...words[idx],
      ...updates,
      id: words[idx].id,
      createdAt: words[idx].createdAt,
    };
    saveWords(words);
    return words[idx];
  }

  function deleteWord(id) {
    const words = getWords();
    const filtered = words.filter(w => w.id !== id);
    if (filtered.length === words.length) return false;
    saveWords(filtered);
    return true;
  }

  function getWord(id) {
    const words = getWords();
    return words.find(w => w.id === id) || null;
  }

  function recordAnswer(wordId, correct) {
    const word = getWord(wordId);
    if (!word) return null;
    return updateWord(wordId, {
      correctCount: word.correctCount + (correct ? 1 : 0),
      wrongCount: word.wrongCount + (correct ? 0 : 1),
      reviewCount: word.reviewCount + 1,
      lastReviewed: new Date().toISOString(),
    });
  }

  // ---------- Quiz History ----------
  function getQuizzes() {
    return getData(KEYS.QUIZZES, []);
  }

  function saveQuizzes(quizzes) {
    return setData(KEYS.QUIZZES, quizzes);
  }

  function addQuiz(quizData) {
    const quizzes = getQuizzes();
    const newQuiz = {
      id: generateId(),
      score: quizData.score,
      total: quizData.total,
      wordIds: quizData.wordIds || [],
      date: new Date().toISOString(),
    };
    quizzes.push(newQuiz);
    saveQuizzes(quizzes);
    return newQuiz;
  }

  // ---------- Statistics ----------
  function getStats() {
    const words = getWords();
    const quizzes = getQuizzes();

    const totalWords = words.length;
    const reviewedWords = words.filter(w => w.reviewCount > 0).length;
    const masteredWords = words.filter(w => {
      const total = w.correctCount + w.wrongCount;
      return total >= 3 && (w.correctCount / total) >= 0.8;
    }).length;
    const dueForReview = words.filter(w => {
      if (!w.lastReviewed) return true;
      const daysSince = (Date.now() - new Date(w.lastReviewed).getTime()) / (1000 * 86400);
      return daysSince >= 3;
    }).length;

    const totalQuizzes = quizzes.length;
    let totalScore = 0, totalQuestions = 0;
    quizzes.forEach(q => {
      totalScore += q.score;
      totalQuestions += q.total;
    });
    const avgAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    const recentQuizzes = quizzes.slice(-10).reverse().map(q => ({
      id: q.id,
      date: q.date,
      score: q.score,
      total: q.total,
      accuracy: q.total > 0 ? Math.round((q.score / q.total) * 100) : 0,
    }));

    return {
      totalWords,
      reviewedWords,
      masteredWords,
      dueForReview,
      totalQuizzes,
      avgAccuracy,
      recentQuizzes,
    };
  }

  // ---------- Settings ----------
  function getSettings() {
    return getData(KEYS.SETTINGS, {
      quizQuestionCount: 10,
    });
  }

  function saveSettings(settings) {
    return setData(KEYS.SETTINGS, settings);
  }

  // ---------- Speaking History ----------
  function getSpeakingHistory() {
    return getData(KEYS.SPEAKING, []);
  }

  function saveSpeakingHistory(history) {
    return setData(KEYS.SPEAKING, history);
  }

  function addSpeakingRecord(record) {
    const history = getSpeakingHistory();
    const newRecord = {
      id: generateId(),
      sentence: record.sentence,
      transcribed: record.transcribed || '',
      accuracy: record.accuracy || 0,
      details: record.details || [],
      duration: record.duration || 0,
      createdAt: new Date().toISOString(),
    };
    history.unshift(newRecord);
    if (history.length > 100) history.length = 100;
    saveSpeakingHistory(history);
    return newRecord;
  }

  function deleteSpeakingRecord(id) {
    const history = getSpeakingHistory();
    const filtered = history.filter(r => r.id !== id);
    if (filtered.length === history.length) return false;
    saveSpeakingHistory(filtered);
    return true;
  }

  // ---------- Pinned Notes ----------
  function getPinnedIds() {
    return getData(KEYS.PINNED, []);
  }

  function savePinnedIds(ids) {
    return setData(KEYS.PINNED, ids);
  }

  function toggleNotePin(id) {
    const pinned = getPinnedIds();
    const idx = pinned.indexOf(id);
    if (idx === -1) {
      pinned.unshift(id);
    } else {
      pinned.splice(idx, 1);
    }
    savePinnedIds(pinned);
    // Also update note's pinned field for backward compat
    const note = getNote(id);
    if (note) {
      note.pinned = idx === -1;
      updateNote(id, { pinned: note.pinned });
    }
    return idx === -1;
  }

  function isNotePinned(id) {
    return getPinnedIds().indexOf(id) !== -1;
  }

  // ---------- Sorted Notes ----------
  function getNotesWithSort(sortBy, pinnedFirst) {
    let notes = getNotes();
    // Sort
    switch (sortBy) {
      case 'oldest':
        notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'title-asc':
        notes.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        notes.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'updated':
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      case 'newest':
      default:
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }
    // Pinned first
    if (pinnedFirst) {
      const pinned = getPinnedIds();
      const pinnedNotes = [];
      // Preserve sorted order within each group
      pinned.forEach(pid => {
        const idx = notes.findIndex(n => n.id === pid);
        if (idx !== -1) {
          pinnedNotes.push(notes.splice(idx, 1)[0]);
        }
      });
      return [...pinnedNotes, ...notes];
    }
    return notes;
  }

  // ---------- Recently Viewed ----------
  function addRecentNote(noteId) {
    let recent = getData(KEYS.RECENT, []);
    recent = recent.filter(id => id !== noteId);
    recent.unshift(noteId);
    if (recent.length > 10) recent = recent.slice(0, 10);
    setData(KEYS.RECENT, recent);
  }

  function getRecentNotes() {
    const ids = getData(KEYS.RECENT, []);
    const notes = getNotes();
    return ids.map(id => notes.find(n => n.id === id)).filter(Boolean);
  }

  // ---------- Note Word Count ----------
  function getNoteStats(content) {
    const text = content.replace(/#{1,6}\s+/g, '').replace(/[*`~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    const englishWords = text.replace(/[一-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
    const total = chineseChars + englishWords;
    const readingTime = Math.max(1, Math.round(total / 250));
    return { chineseChars, englishWords, total, readingTime };
  }

  // ---------- Public API ----------
  return {
    // Backup / Recovery
    recoverFromBackup,
    restoreFromServer,
    syncAllToServer,
    // Notes
    getNotes,
    saveNotes,
    addNote,
    updateNote,
    deleteNote,
    getNote,
    getAllTags,
    // Pinned
    getPinnedIds,
    toggleNotePin,
    isNotePinned,
    // Sorted notes
    getNotesWithSort,
    // Recently viewed
    addRecentNote,
    getRecentNotes,
    // Stats
    getNoteStats,
    // Words
    getWords,
    saveWords,
    addWord,
    updateWord,
    deleteWord,
    getWord,
    recordAnswer,
    // Quizzes
    getQuizzes,
    addQuiz,
    // Stats
    getStats,
    // Settings
    getSettings,
    saveSettings,
    // Speaking
    getSpeakingHistory,
    addSpeakingRecord,
    deleteSpeakingRecord,
  };
})();
