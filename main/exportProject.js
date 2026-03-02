const fs = require('fs');
const path = require('path');
const { dialog, BrowserWindow } = require('electron');
const store = require('../projectStore');

const EXPORT_FORMATS = {
  doc: {
    label: 'Word-compatible document',
    extension: 'doc',
  },
  pdf: {
    label: 'PDF document',
    extension: 'pdf',
  },
};

function sanitizeFileName(value) {
  const trimmed = String(value || 'inkfold').trim();
  const cleaned = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'inkfold-export';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function buildParagraphs(value) {
  const text = normalizeText(value).trim();
  if (!text) {
    return '<p class="empty">(No content)</p>';
  }
  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function buildDocSection(doc, index) {
  const headerMeta = [];
  if (doc.status) {
    headerMeta.push(`Status: ${escapeHtml(doc.status)}`);
  }
  if (doc.pov) {
    headerMeta.push(`POV: ${escapeHtml(doc.pov)}`);
  }
  if (doc.synopsis) {
    headerMeta.push(`Synopsis: ${escapeHtml(doc.synopsis)}`);
  }
  const metaHtml = headerMeta.length
    ? `<p class="chapter-meta">${headerMeta.join(' | ')}</p>`
    : '';

  return `
    <section class="chapter">
      <header class="chapter-header">
        <div class="chapter-index">Chapter ${index + 1}</div>
        <div>
          <h2>${escapeHtml(doc.title || `Untitled chapter ${index + 1}`)}</h2>
          ${metaHtml}
        </div>
      </header>
      <div class="chapter-content">
        ${buildParagraphs(doc.text)}
      </div>
      ${doc.notes ? `<div class="chapter-notes">
        <h3>Notes</h3>
        ${buildParagraphs(doc.notes)}
      </div>` : ''}
    </section>
  `;
}

function buildProjectNotesSection(meta) {
  const notes = Array.isArray(meta && meta.notes) ? meta.notes : [];
  if (!notes.length) {
    return '';
  }
  const entries = notes
    .map((note) => {
      const title = escapeHtml(note.title || 'Untitled note');
      return `
        <article class="note">
          <div class="note-title">${title}</div>
          <div class="note-body">
            ${buildParagraphs(note.content)}
          </div>
        </article>
      `;
    })
    .join('');
  return `
    <section class="project-notes">
      <h2>Project notes</h2>
      ${entries}
    </section>
  `;
}

function buildExportHtml(projectName, projectPath, docs, meta) {
  const header = `
    <header class="export-header">
      <p class="export-subtitle">Inkfold export</p>
      <h1>${escapeHtml(projectName || 'Untitled project')}</h1>
      <p class="project-meta">
        Path: ${escapeHtml(projectPath)}<br />
        Exported: ${escapeHtml(new Date().toLocaleString())}<br />
        Chapters: ${docs.length}
      </p>
    </header>
  `;
  const chapters = docs.length
    ? docs.map((doc, index) => buildDocSection(doc, index)).join('')
    : '<p class="empty">No chapters yet.</p>';

  const projectNotes = buildProjectNotesSection(meta);
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(projectName || 'Inkfold export')}</title>
        <style>
          body {
            font-family: "Palatino Linotype", "Book Antiqua", Palatino, serif;
            color: #1f1b16;
            background: #fff;
            margin: 0;
            padding: 40px;
            line-height: 1.6;
          }
          .export-header {
            margin-bottom: 32px;
          }
          .export-subtitle {
            text-transform: uppercase;
            letter-spacing: 0.3em;
            font-size: 11px;
            color: #6a5f54;
            margin-bottom: 8px;
          }
          .export-header h1 {
            margin-bottom: 8px;
          }
          .project-meta {
            font-size: 12px;
            color: #6a5f54;
            line-height: 1.5;
          }
          .chapter {
            border-bottom: 1px solid #d7c8b4;
            margin-bottom: 32px;
            padding-bottom: 24px;
          }
          .chapter:last-of-type {
            border-bottom: none;
          }
          .chapter-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
          }
          .chapter-index {
            font-size: 12px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #6a5f54;
            min-width: 120px;
          }
          .chapter-header h2 {
            margin-bottom: 4px;
          }
          .chapter-meta {
            margin: 0;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6a5f54;
          }
          .chapter-content p {
            margin-bottom: 12px;
            text-align: justify;
          }
          .chapter-notes {
            margin-top: 18px;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px dashed #d7c8b4;
            background: #fbf7f2;
          }
          .chapter-notes h3 {
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 12px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #0f6f73;
          }
          .project-notes {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #d7c8b4;
          }
          .project-notes h2 {
            margin-bottom: 16px;
          }
          .note {
            margin-bottom: 18px;
          }
          .note-title {
            font-size: 12px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #0f6f73;
            margin-bottom: 6px;
          }
          .note-body p {
            margin-bottom: 10px;
          }
          .empty {
            font-style: italic;
            color: #6a5f54;
          }
        </style>
      </head>
      <body>
        ${header}
        <section class="chapters">
          ${chapters}
        </section>
        ${projectNotes}
      </body>
    </html>
  `;
}

async function renderPdfFromHtml(html) {
  const win = new BrowserWindow({
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      offscreen: true,
    },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await win.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: 'A4',
    });
    return pdfBuffer;
  } finally {
    if (!win.isDestroyed()) {
      win.close();
    }
  }
}

async function collectDocs(projectPath) {
  const entries = await store.listDocs(projectPath);
  const docs = [];
  for (const entry of entries) {
    if (!entry || !entry.id) {
      continue;
    }
    const doc = await store.readDoc(projectPath, entry.id);
    if (!doc) {
      continue;
    }
    docs.push({
      title: doc.title || entry.title || 'Untitled chapter',
      synopsis: doc.synopsis,
      status: doc.status,
      pov: doc.pov,
      text: doc.text || '',
      notes: doc.notes || '',
    });
  }
  return docs;
}

async function exportProject(projectPath, format = 'doc') {
  if (!projectPath) {
    throw new Error('Project path is required.');
  }
  const mode = EXPORT_FORMATS[format] ? format : 'doc';
  const projectName = path.basename(projectPath) || 'Inkfold';
  const docs = await collectDocs(projectPath);
  const meta = await store.readProject(projectPath);
  const html = buildExportHtml(projectName, projectPath, docs, meta);

  const definition = EXPORT_FORMATS[mode];
  const safeName = sanitizeFileName(projectName);
  const defaultName = `${safeName}.${definition.extension}`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: `Export project as ${definition.label}`,
    defaultPath: path.join(projectPath, defaultName),
    filters: [{ name: definition.label, extensions: [definition.extension] }],
  });
  if (canceled || !filePath) {
    return null;
  }

  if (mode === 'pdf') {
    const pdfBuffer = await renderPdfFromHtml(html);
    await fs.promises.writeFile(filePath, pdfBuffer);
  } else {
    await fs.promises.writeFile(filePath, html, 'utf-8');
  }

  return { path: filePath };
}

module.exports = {
  exportProject,
};
