/* ============================================
   Main Application Controller
   Hirotos Minimalist Theme
   ============================================ */

const APP = (() => {
  // ---------- State ----------
  let currentPage = 'home';
  let isTransitioning = false;

  // ---------- Init ----------
  function init() {
    // Set up bottom navigation
    document.querySelectorAll('.nav-btn').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) {
          navigateTo(page);
        }
      });
    });

    // Keyboard: Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('modal-overlay');
        if (modal && modal.classList.contains('show')) closeModal();
      }
    });

    // Load home page
    navigateTo('home');
  }

  // ==========================================
  //  NAVIGATION
  // ==========================================
  function navigateTo(page) {
    // Close fullscreen editor if open
    const editorRoot = document.getElementById('fullscreen-editor-root');
    if (editorRoot) editorRoot.innerHTML = '';

    if (page === currentPage && page !== 'home') return;
    if (isTransitioning && page !== currentPage) return;
    currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update badges
    updateBadges();

    // Animate content
    const content = document.getElementById('dynamic-content');
    if (page === 'home') {
      renderHome();
      return;
    }

    isTransitioning = true;
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';

    setTimeout(() => {
      switch (page) {
        case 'knowledge':
          KNOWLEDGE.renderList();
          break;
        case 'dictionary':
          ENGLISH.renderDictionary();
          break;
        case 'linking':
          ENGLISH.renderLinking();
          break;
        case 'speaking':
          ENGLISH.renderSpeaking();
          break;
        case 'translate':
          ENGLISH.renderTranslate();
          break;
        case 'wordlist':
          ENGLISH.renderWordList();
          break;
        case 'quiz':
          ENGLISH.renderQuiz();
          break;
        case 'progress':
          ENGLISH.renderProgress();
          break;
        default:
          KNOWLEDGE.renderList();
      }

      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
        content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      });

      isTransitioning = false;
    }, 180);
  }

  // ==========================================
  //  HOME
  // ==========================================
  function renderHome() {
    const container = document.getElementById('dynamic-content');
    const stats = STORAGE.getStats();
    const notes = STORAGE.getNotes();

    container.innerHTML = `
      <div class="home-page">
        <div class="home-title">Aria Study</div>
        <p class="home-subtitle">Knowledge · English · Growth</p>

        <!-- Recovery banner - only shown when backup data is available -->
        <div id="recovery-banner" style="display:none;width:100%;max-width:520px;margin:0 auto 16px;padding:12px 18px;border:1px solid var(--accent);border-radius:var(--radius);background:var(--accent-light);text-align:center;font-size:0.85rem;">
          💾 检测到备份数据，<a href="#" onclick="APP.recoverData();return false;" style="color:var(--accent);font-weight:600;text-decoration:underline;">点击恢复</a>
        </div>

        <div class="home-stats">
          <div class="home-stat-card">
            <div class="home-stat-value">${stats.totalWords}</div>
            <div class="home-stat-label">Words</div>
          </div>
          <div class="home-stat-card">
            <div class="home-stat-value">${notes.length}</div>
            <div class="home-stat-label">Notes</div>
          </div>
          <div class="home-stat-card">
            <div class="home-stat-value">${stats.masteredWords}</div>
            <div class="home-stat-label">Mastered</div>
          </div>
          <div class="home-stat-card">
            <div class="home-stat-value">${stats.avgAccuracy}%</div>
            <div class="home-stat-label">Accuracy</div>
          </div>
        </div>

        <div class="home-quick-links">
          <div class="home-quick-link" onclick="APP.navigateTo('knowledge')">
            <span class="ql-icon">📚</span>
            <span class="ql-label">Knowledge</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('wordlist')">
            <span class="ql-icon">📝</span>
            <span class="ql-label">Words</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('quiz')">
            <span class="ql-icon">✍️</span>
            <span class="ql-label">Quiz</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('dictionary')">
            <span class="ql-icon">📖</span>
            <span class="ql-label">Dict</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('speaking')">
            <span class="ql-icon">🎤</span>
            <span class="ql-label">Speaking</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('progress')">
            <span class="ql-icon">📈</span>
            <span class="ql-label">Progress</span>
          </div>
          <div class="home-quick-link" onclick="APP.navigateTo('linking')">
            <span class="ql-icon">🔗</span>
            <span class="ql-label">Linking</span>
          </div>
        </div>
      </div>
    `;

    // Reset content transition
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
    container.style.transition = '';

    // Check for backup recovery
    setTimeout(checkBackup, 100);
  }

  // ---------- Badge Updates ----------
  function updateBadges() {
    // Reserved for future badge updates
  }

  // ---------- Recovery ----------
  function checkBackup() {
    // Called after home renders to check if backup is available
    try {
      const raw = localStorage.getItem('as_backup');
      if (!raw) return;
      const data = JSON.parse(raw);
      const notes = STORAGE.getNotes();
      if (notes.length === 0 && data.personal_app_notes && data.personal_app_notes.length > 0) {
        const banner = document.getElementById('recovery-banner');
        if (banner) banner.style.display = 'block';
      }
    } catch (e) { /* ignore */ }
  }

  function recoverData() {
    // Try local backup first
    const restored = STORAGE.recoverFromBackup();
    if (restored) {
      showToast('✅ 数据已从本地备份恢复！');
      navigateTo('home');
      return;
    }
    // Try server-side backup
    STORAGE.restoreFromServer().then(count => {
      if (count > 0) {
        showToast(`✅ 已从服务器恢复 ${count} 项数据！`);
        navigateTo('home');
      } else {
        showToast('没有找到可恢复的数据', 'error');
      }
    });
  }

  // ---------- Public API ----------
  return {
    init,
    navigateTo,
    updateBadges,
    recoverData,
    checkBackup,
    getCurrentPage: () => currentPage,
  };
})();

// ==========================================
//  GLOBAL HELPERS
// ==========================================

// Modal
function showModal({ title, body, footer }) {
  const overlay = document.getElementById('modal-overlay');
  const header = overlay.querySelector('.modal-header h3');
  const bodyEl = overlay.querySelector('.modal-body');
  const footerEl = overlay.querySelector('.modal-footer');

  header.textContent = title || '';
  bodyEl.innerHTML = body || '';
  footerEl.innerHTML = footer || '';
  overlay.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}



// Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

// ---------- DOM Ready ----------
document.addEventListener('DOMContentLoaded', () => {
  APP.init();
});
