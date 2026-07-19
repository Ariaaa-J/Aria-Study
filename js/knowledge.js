/* ============================================
   Knowledge Base Module (Enhanced)
   ============================================ */

const KNOWLEDGE = (() => {
  // ---------- State ----------
  let currentFilter = { search: '', tag: null };
  let currentSort = 'newest';
  let viewMode = localStorage.getItem('as_view_mode') || 'grid';
  let pinnedFirst = true;
  let noteAutoSaveId = null;
  let noteAutoSaveTimer = null;
  let noteAutoSaveDirty = false;

  // ---------- Render Helpers ----------
  function renderDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 86400));
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 30) return `${diffDays}天前`;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function renderTags(tags, activeTag) {
    if (!tags || tags.length === 0) return '';
    return tags.map(t => {
      const cls = t === activeTag ? 'tag active' : 'tag';
      return `<span class="${cls}" data-tag="${t}" onclick="KNOWLEDGE.filterByTag('${t}')">${escapeHtml(t)}</span>`;
    }).join('');
  }

  function getExcerpt(content, maxLen = 120) {
    let text = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/>\s+/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (text.length <= maxLen) return text;
    return text.substr(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }

  function highlightSearch(text, query) {
    if (!query || !query.trim()) return text;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + q.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  // ---------- Templates ----------
  const TEMPLATES = {
    meeting: {
      title: '会议记录 - ',
      content: `# 会议记录\n\n**日期：** \n**参与人：** \n\n## 议程\n1. \n2. \n3. \n\n## 讨论要点\n- \n- \n- \n\n## 待办事项\n- [ ] \n- [ ] \n`,
      tags: ['work'],
    },
    learning: {
      title: '学习笔记 - ',
      content: `# 学习笔记\n\n**主题：** \n**来源：** \n\n## 核心要点\n- \n- \n- \n\n## 详细内容\n\n\n## 总结与思考\n\n`,
      tags: ['study'],
    },
    journal: {
      title: '日记 - ',
      content: `# 日记\n\n**日期：** \n**天气：** \n\n## 今日记录\n\n\n## 感想与反思\n\n\n## 明日计划\n- \n`,
      tags: ['life'],
    },
    idea: {
      title: '灵感 - ',
      content: `# 灵感\n\n**相关领域：** \n\n## 想法描述\n\n\n## 为什么重要\n\n\n## 下一步行动\n- [ ] \n`,
      tags: ['idea'],
    },
    book: {
      title: '读书笔记 - ',
      content: `# 读书笔记\n\n**书名：** \n**作者：** \n\n## 核心观点\n- \n- \n\n## 精彩摘录\n> \n\n## 个人感悟\n\n`,
      tags: ['study'],
    },
  };

  // ---------- Render List ----------
  function renderList() {
    const container = document.getElementById('dynamic-content');
    let notes = STORAGE.getNotesWithSort(currentSort, pinnedFirst);

    // Search filter
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // Tag filter
    if (currentFilter.tag) {
      notes = notes.filter(n => (n.tags || []).includes(currentFilter.tag));
    }

    const allTags = STORAGE.getAllTags();
    const recentNotes = STORAGE.getRecentNotes();
    const pinnedIds = STORAGE.getPinnedIds();

    container.innerHTML = `
      <div class="page-header">
        <h2>📚 知识库</h2>
        <p>记录你的想法、笔记与知识</p>
      </div>
      <div class="page-body">
        <!-- Toolbar -->
        <div class="knowledge-toolbar">
          <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" id="knowledge-search" placeholder="搜索笔记..." value="${escapeHtml(currentFilter.search)}">
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="KNOWLEDGE.showTemplates()">✏️ 新建笔记</button>
          </div>
        </div>

        <!-- Sort & View Toggle -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.82rem;color:var(--text-muted);">排序:</label>
            <select id="sort-select" class="form-control" style="width:auto;padding:6px 28px 6px 10px;font-size:0.82rem;" onchange="KNOWLEDGE.changeSort(this.value)">
              <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>最新创建</option>
              <option value="oldest" ${currentSort === 'oldest' ? 'selected' : ''}>最早创建</option>
              <option value="updated" ${currentSort === 'updated' ? 'selected' : ''}>最近更新</option>
              <option value="title-asc" ${currentSort === 'title-asc' ? 'selected' : ''}>标题 A-Z</option>
              <option value="title-desc" ${currentSort === 'title-desc' ? 'selected' : ''}>标题 Z-A</option>
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;color:var(--text-muted);cursor:pointer;">
            <input type="checkbox" ${pinnedFirst ? 'checked' : ''} onchange="KNOWLEDGE.togglePinnedFirst(this.checked)"> 置顶优先
          </label>
          <div style="margin-left:auto;display:flex;gap:4px;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
            <button class="btn-icon view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}" onclick="KNOWLEDGE.setViewMode('grid')" title="卡片视图" style="border-radius:0;padding:6px 10px;font-size:0.9rem;${viewMode === 'grid' ? 'background:var(--primary-bg);color:var(--primary);' : ''}">⊞</button>
            <button class="btn-icon view-toggle-btn ${viewMode === 'list' ? 'active' : ''}" onclick="KNOWLEDGE.setViewMode('list')" title="列表视图" style="border-radius:0;padding:6px 10px;font-size:0.9rem;${viewMode === 'list' ? 'background:var(--primary-bg);color:var(--primary);' : ''}">☰</button>
          </div>
        </div>

        <!-- Tags -->
        <div class="tags-filter" style="margin-bottom:16px;display:flex;gap:6px;flex-wrap:wrap;">
          <span class="tag ${!currentFilter.tag ? 'active' : ''}" onclick="KNOWLEDGE.filterByTag(null)">全部 (${notes.length})</span>
          ${allTags.map(t => `<span class="tag ${currentFilter.tag === t.name ? 'active' : ''}" onclick="KNOWLEDGE.filterByTag('${t.name}')">${escapeHtml(t.name)} (${t.count})</span>`).join('')}
        </div>

        ${notes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <h3>${currentFilter.search || currentFilter.tag ? '没有找到匹配的笔记' : '还没有笔记'}</h3>
            <p>${currentFilter.search || currentFilter.tag ? '试试其他的搜索词或标签' : '点击"新建笔记"开始记录你的知识吧！'}</p>
          </div>
        ` : viewMode === 'grid' ? `
          <!-- Grid View -->
          <div class="knowledge-grid">
            ${notes.map(n => {
              const isPinned = pinnedIds.includes(n.id);
              const title = currentFilter.search ? highlightSearch(escapeHtml(n.title), currentFilter.search) : escapeHtml(n.title);
              const excerpt = currentFilter.search ? highlightSearch(escapeHtml(getExcerpt(n.content)), currentFilter.search) : escapeHtml(getExcerpt(n.content));
              return `
                <div class="knowledge-card ${isPinned ? 'pinned' : ''}" onclick="KNOWLEDGE.showDetail('${n.id}')">
                  <div class="card-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" title="${isPinned ? '取消置顶' : '置顶'}" onclick="KNOWLEDGE.togglePin('${n.id}')">${isPinned ? '⭐' : '☆'}</button>
                    <button class="btn-icon" title="编辑" onclick="KNOWLEDGE.showEditor('${n.id}')">✏️</button>
                    <button class="btn-icon" title="删除" onclick="KNOWLEDGE.deleteNote('${n.id}')">🗑️</button>
                  </div>
                  <div class="card-date">${renderDate(n.updatedAt || n.createdAt)}${isPinned ? ' · 置顶' : ''}</div>
                  <h3>${title}</h3>
                  <div class="card-excerpt">${excerpt}</div>
                  <div class="card-tags">${renderTags(n.tags, null)}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- List View -->
          <div class="note-list-view">
            ${notes.map(n => {
              const isPinned = pinnedIds.includes(n.id);
              const title = currentFilter.search ? highlightSearch(escapeHtml(n.title), currentFilter.search) : escapeHtml(n.title);
              const excerpt = currentFilter.search ? highlightSearch(escapeHtml(getExcerpt(n.content, 80)), currentFilter.search) : escapeHtml(getExcerpt(n.content, 80));
              const stats = STORAGE.getNoteStats(n.content);
              return `
                <div class="note-list-item ${isPinned ? 'pinned' : ''}" onclick="KNOWLEDGE.showDetail('${n.id}')">
                  <div class="note-list-left">
                    <div class="note-list-title">${isPinned ? '⭐ ' : ''}${title}</div>
                    <div class="note-list-excerpt">${excerpt}</div>
                    <div class="note-list-meta">
                      <span>${renderDate(n.updatedAt || n.createdAt)}</span>
                      <span>${stats.total} 字</span>
                      ${n.tags && n.tags.length > 0 ? '<span>' + n.tags.map(t => '<span class="tag" style="font-size:0.7rem;padding:1px 6px;">' + escapeHtml(t) + '</span>').join(' ') + '</span>' : ''}
                    </div>
                  </div>
                  <div class="note-list-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" title="${isPinned ? '取消置顶' : '置顶'}" onclick="KNOWLEDGE.togglePin('${n.id}')">${isPinned ? '⭐' : '☆'}</button>
                    <button class="btn-icon" title="编辑" onclick="KNOWLEDGE.showEditor('${n.id}')">✏️</button>
                    <button class="btn-icon" title="删除" onclick="KNOWLEDGE.deleteNote('${n.id}')">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

        <!-- Recently Viewed -->
        ${recentNotes.length > 0 ? `
          <div style="margin-top:32px;">
            <div style="font-size:0.85rem;font-weight:600;color:var(--text-muted);margin-bottom:12px;">🕐 最近浏览</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${recentNotes.slice(0, 5).map(n => `
                <span class="tag" style="cursor:pointer;" onclick="KNOWLEDGE.showDetail('${n.id}')">${escapeHtml(n.title)}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Attach search handler
    const searchInput = document.getElementById('knowledge-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value;
        renderList();
      });
    }
  }

  // ---------- Sort & View ----------
  function changeSort(value) {
    currentSort = value;
    renderList();
  }

  function togglePinnedFirst(checked) {
    pinnedFirst = checked;
    renderList();
  }

  function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('as_view_mode', mode);
    renderList();
  }

  // ---------- Pin Toggle ----------
  function togglePin(id) {
    STORAGE.toggleNotePin(id);
    renderList();
  }

  // ---------- Templates Picker ----------
  function showTemplates() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = `
      <div class="page-header" style="padding-bottom:0;">
        <button class="btn btn-secondary btn-sm" onclick="KNOWLEDGE.renderList()">← 返回列表</button>
      </div>
      <div class="page-body">
        <div style="margin-bottom:24px;">
          <h3 style="font-size:1.1rem;font-weight:600;margin-bottom:4px;">选择笔记模板</h3>
          <p style="color:var(--text-muted);font-size:0.9rem;">选择一个模板快速开始，或者直接创建空白笔记</p>
        </div>
        <div class="template-grid">
          <div class="template-card" onclick="KNOWLEDGE.showEditor('', 'blank')">
            <div class="template-icon">📄</div>
            <div class="template-name">空白笔记</div>
            <div class="template-desc">从零开始，自由书写</div>
          </div>
          ${Object.entries(TEMPLATES).map(([key, tpl]) => `
            <div class="template-card" onclick="KNOWLEDGE.showEditor('', '${key}')">
              <div class="template-icon">${key === 'meeting' ? '📋' : key === 'learning' ? '📖' : key === 'journal' ? '📓' : key === 'idea' ? '💡' : '📕'}</div>
              <div class="template-name">${tpl.title.replace(' - ', '')}</div>
              <div class="template-desc">${['结构化会议记录模板', '知识点整理与总结', '每日心情与反思', '捕获一闪而过的灵感', '阅读摘录与感悟'][Object.keys(TEMPLATES).indexOf(key)]}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ---------- Render Detail ----------
  function showDetail(id) {
    const note = STORAGE.getNote(id);
    if (!note) {
      showToast('笔记未找到', 'error');
      renderList();
      return;
    }

    // Track recently viewed
    STORAGE.addRecentNote(id);

    const container = document.getElementById('dynamic-content');
    const rendered = marked.parse(note.content);
    const stats = STORAGE.getNoteStats(note.content);
    const isPinned = STORAGE.isNotePinned(id);

    container.innerHTML = `
      <div class="page-header" style="padding-bottom:0;">
        <button class="btn btn-secondary btn-sm" onclick="KNOWLEDGE.renderList()">← 返回列表</button>
      </div>
      <div class="page-body">
        <div class="note-detail">
          <div class="note-header">
            <h1 class="note-title">${isPinned ? '⭐ ' : ''}${escapeHtml(note.title)}</h1>
            <div class="note-meta">
              <span>📅 创建: ${new Date(note.createdAt).toLocaleString('zh-CN')}</span>
              ${note.updatedAt !== note.createdAt ? `<span>🔄 更新: ${new Date(note.updatedAt).toLocaleString('zh-CN')}</span>` : ''}
              <span>📊 ${stats.total} 字 · 阅读约 ${stats.readingTime} 分钟</span>
            </div>
            <div class="note-tags">${renderTags(note.tags, null)}</div>
          </div>
          <div class="note-content">${rendered}</div>
          <div class="note-actions">
            <button class="btn btn-primary" onclick="KNOWLEDGE.showEditor('${note.id}')">✏️ 编辑</button>
            <button class="btn ${isPinned ? 'btn-success' : 'btn-secondary'}" onclick="KNOWLEDGE.togglePin('${note.id}');KNOWLEDGE.showDetail('${note.id}')">${isPinned ? '⭐ 已置顶' : '☆ 置顶'}</button>
            <button class="btn btn-secondary" onclick="KNOWLEDGE.exportSingleNote('${note.id}')">📥 导出</button>
            <button class="btn btn-danger" onclick="KNOWLEDGE.deleteNote('${note.id}')">🗑️ 删除</button>
            <button class="btn btn-secondary" onclick="KNOWLEDGE.renderList()">← 返回</button>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Export Single Note ----------
  function exportSingleNote(id) {
    const note = STORAGE.getNote(id);
    if (!note) return;
    const md = `# ${note.title}\n\n> 创建: ${note.createdAt}  |  标签: ${(note.tags || []).join(', ') || '无'}\n\n---\n\n${note.content}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9一-龥\-_]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('笔记已导出 📥');
  }

  // ---------- Render Editor (Create / Edit) ----------
  function showEditor(id, templateKey) {
    const note = id ? STORAGE.getNote(id) : null;
    const isEdit = !!note;

    let titleVal = isEdit ? note.title : '';
    let contentVal = isEdit ? note.content : '';
    let tagsVal = isEdit ? (note.tags || []).join(', ') : '';

    // Apply template
    if (!isEdit && templateKey && TEMPLATES[templateKey]) {
      const tpl = TEMPLATES[templateKey];
      titleVal = tpl.title;
      contentVal = tpl.content;
      tagsVal = tpl.tags.join(', ');
    }

    const container = document.getElementById('dynamic-content');

    container.innerHTML = `
      <div class="page-header" style="padding-bottom:0;">
        <button class="btn btn-secondary btn-sm" onclick="KNOWLEDGE.renderList()">← 返回列表</button>
      </div>
      <div class="page-body">
        <div class="editor-container card">
          <div class="card-header">
            <span>${isEdit ? '✏️ 编辑笔记' : '✏️ 新建笔记'}</span>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>标题 <span class="required">*</span></label>
              <input type="text" class="form-control" id="note-title" placeholder="输入笔记标题..." value="${escapeHtml(titleVal)}">
            </div>
            <div class="form-group">
              <label>标签</label>
              <input type="text" class="form-control" id="note-tags" placeholder="用逗号分隔，如: tech, life, study" value="${escapeHtml(tagsVal)}">
              <div class="form-hint">常用标签: tech, life, study, work, idea, english</div>
            </div>
            <div class="form-group">
              <label>内容 (支持 Markdown) <span class="required">*</span></label>
              <div class="editor-split">
                <div class="editor-split-pane editor-write-pane">
                  <div class="editor-split-label">
                    编辑
                    <span class="editor-preview-badge">LIVE</span>
                  </div>
                  <textarea class="form-control editor-textarea" id="note-content" placeholder="支持 Markdown 格式&#10;&#10;## 标题&#10;**粗体** *斜体*&#10;- 列表项&#10;1. 编号列表&#10;\`代码\`&#10;> 引用">${escapeHtml(contentVal)}</textarea>
                </div>
                <div class="editor-split-pane editor-preview-pane">
                  <div class="editor-split-label">
                    预览
                    <span class="editor-preview-badge">实时</span>
                  </div>
                  <div class="preview-content" id="markdown-preview">
                    <p style="color:var(--text-muted);">实时预览</p>
                  </div>
                </div>
              </div>
              <div class="form-hint" style="margin-top:4px;">
                <span id="editor-word-count">0 字 · 阅读约 0 分钟</span>
                <span id="editor-auto-save-status" style="margin-left:12px;font-size:0.72rem;color:var(--text-muted);"></span>
              </div>
            </div>
            <div class="btn-group">
              <button class="btn btn-primary btn-lg" onclick="KNOWLEDGE.saveNote('${id || ''}')">💾 保存</button>
              ${isEdit ? `<button class="btn btn-secondary btn-lg" onclick="KNOWLEDGE.showDetail('${id}')">取消</button>` : `<button class="btn btn-secondary btn-lg" onclick="KNOWLEDGE.renderList()">取消</button>`}
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach auto-save
    noteAutoSaveId = id || null;
    noteAutoSaveDirty = false;
    const titleInput = document.getElementById('note-title');
    const contentTextarea = document.getElementById('note-content');
    const tagsInput = document.getElementById('note-tags');

    function onAutoSaveInput() {
      noteAutoSaveDirty = true;
      if (!noteAutoSaveId) {
        // New note — set a temporary title for creation
        const t = titleInput.value.trim();
        if (t) {
          triggerAutoSave();
        }
      } else {
        triggerAutoSave();
      }
    }

    function triggerAutoSave() {
      if (noteAutoSaveTimer) clearTimeout(noteAutoSaveTimer);
      noteAutoSaveTimer = setTimeout(() => {
        autoSaveNote();
      }, 1500);
      updateAutoSaveStatus('⏳ 待保存...');
    }

    if (titleInput) titleInput.addEventListener('input', onAutoSaveInput);
    if (contentTextarea) {
      contentTextarea.addEventListener('input', () => {
        updateWordCount();
        onAutoSaveInput();
      });
      updateWordCount();
    }
    if (tagsInput) tagsInput.addEventListener('input', onAutoSaveInput);

    // ---------- Live Preview ----------
    const markdownPreview = document.getElementById('markdown-preview');
    if (contentTextarea && markdownPreview) {
      let previewTimeout = null;
      const updatePreview = () => {
        const text = contentTextarea.value;
        if (text.trim()) {
          markdownPreview.innerHTML = marked.parse(text);
        } else {
          markdownPreview.innerHTML = '<p style="color:var(--text-muted);">开始输入以预览…</p>';
        }
      };
      contentTextarea.addEventListener('input', () => {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(updatePreview, 200);
      });
      // Initial render
      updatePreview();
    }
  }

  function updateAutoSaveStatus(text) {
    const el = document.getElementById('editor-auto-save-status');
    if (el) el.textContent = text;
  }

  function autoSaveNote() {
    const title = document.getElementById('note-title')?.value.trim();
    const content = document.getElementById('note-content')?.value.trim();
    const tagsStr = document.getElementById('note-tags')?.value.trim();

    if (!title || !content) {
      updateAutoSaveStatus('');
      return;
    }

    const tags = tagsStr ? tagsStr.split(/[,，、]/).map(t => t.trim()).filter(t => t) : [];

    if (noteAutoSaveId) {
      // Update existing note
      const updated = STORAGE.updateNote(noteAutoSaveId, { title, content, tags });
      if (updated) {
        noteAutoSaveDirty = false;
        updateAutoSaveStatus('✅ 已自动保存');
        setTimeout(() => updateAutoSaveStatus(''), 3000);
      }
    } else {
      // Create new note, keep its ID for subsequent auto-saves
      const created = STORAGE.addNote({ title, content, tags });
      if (created) {
        noteAutoSaveId = created.id;
        noteAutoSaveDirty = false;
        updateAutoSaveStatus('✅ 已自动保存');
        setTimeout(() => updateAutoSaveStatus(''), 3000);
      }
    }
  }

  function updateWordCount() {
    const el = document.getElementById('note-content');
    const counter = document.getElementById('editor-word-count');
    if (!el || !counter) return;
    const stats = STORAGE.getNoteStats(el.value);
    counter.textContent = `${stats.total} 字 · 阅读约 ${stats.readingTime} 分钟`;
  }

  // ---------- Editor Tab Switch (legacy — split layout shows both) ----------
  function switchEditorTab(tab) {
    // With live split-preview, tabs are no longer needed.
    // If called externally, refresh the preview.
    if (tab === 'preview') {
      const preview = document.getElementById('markdown-preview');
      const content = document.getElementById('note-content');
      if (preview && content) {
        if (content.value.trim()) {
          preview.innerHTML = marked.parse(content.value);
        }
      }
    }
  }

  // ---------- Save Note ----------
  function saveNote(id) {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const tagsStr = document.getElementById('note-tags').value.trim();

    if (!title) {
      showToast('请输入笔记标题', 'error');
      document.getElementById('note-title').focus();
      return;
    }
    if (!content) {
      showToast('请输入笔记内容', 'error');
      document.getElementById('note-content').focus();
      return;
    }

    const tags = tagsStr ? tagsStr.split(/[,，、]/).map(t => t.trim()).filter(t => t) : [];

    if (id) {
      const updated = STORAGE.updateNote(id, { title, content, tags });
      if (updated) {
        showToast('笔记已更新 ✅');
        showDetail(id);
      } else {
        showToast('更新失败，请重试', 'error');
      }
    } else {
      const created = STORAGE.addNote({ title, content, tags });
      if (created) {
        showToast('笔记已创建 ✅');
        renderList();
      } else {
        showToast('创建失败，请重试', 'error');
      }
    }
  }

  // ---------- Delete Note ----------
  function deleteNote(id) {
    const note = STORAGE.getNote(id);
    if (!note) return;
    if (confirm(`确定要永久删除「${note.title}」吗？此操作不可撤销。`)) {
      if (STORAGE.deleteNote(id)) {
        showToast('笔记已删除 🗑️');
        renderList();
      } else {
        showToast('删除失败', 'error');
      }
    }
  }

  // ---------- Filter ----------
  function filterByTag(tag) {
    currentFilter.tag = tag;
    renderList();
  }

  // ---------- Escape HTML ----------
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Public API ----------
  return {
    renderList,
    showDetail,
    showEditor,
    showTemplates,
    saveNote,
    deleteNote,
    filterByTag,
    switchEditorTab,
    changeSort,
    togglePinnedFirst,
    setViewMode,
    togglePin,
    exportSingleNote,
  };
})();
