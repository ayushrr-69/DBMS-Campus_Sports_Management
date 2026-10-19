const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const htmlParts = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listType = ''; // 'ul' or 'ol'

  function closeList() {
    if (inList) {
      htmlParts.push(`</${listType}>`);
      inList = false;
      listType = '';
    }
  }

  function closeTable() {
    if (inTable) {
      let tableHtml = '<div class="table-wrap"><table>';
      tableRows.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const tag = isHeader ? 'th' : 'td';
        tableHtml += '<tr>';
        row.forEach((cell) => {
          tableHtml += `<${tag}>${formatInline(cell.trim())}</${tag}>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</table></div>';
      htmlParts.push(tableHtml);
      inTable = false;
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      closeList();
      closeTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const codeText = escapeHtml(codeBuffer.join('\n'));
        htmlParts.push(`<pre><code class="language-${escapeHtml(codeLanguage)}">${codeText}</code></pre>`);
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Table rows: lines with pipes
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      closeList();
      // Check if separator line (|---|---|)
      if (/^\|[\s:-|-]+\|$/.test(line.trim())) {
        // separator, skip
        continue;
      }
      const rawCells = line.trim().slice(1, -1).split('|');
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(rawCells);
      continue;
    } else {
      closeTable();
    }

    // Blank lines
    if (!line.trim()) {
      closeList();
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      htmlParts.push('<hr>');
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      closeList();
      const content = line.trim().replace(/^>\s*/, '');
      htmlParts.push(`<blockquote><p>${formatInline(content)}</p></blockquote>`);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const id = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      htmlParts.push(`<h${level} id="${id}">${formatInline(title)}</h${level}>`);
      continue;
    }

    // Unordered lists
    const ulMatch = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(`<li>${formatInline(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered lists
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        htmlParts.push('<ol>');
      }
      htmlParts.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    }

    closeList();

    // Regular paragraphs
    htmlParts.push(`<p>${formatInline(line.trim())}</p>`);
  }

  closeList();
  closeTable();

  return htmlParts.join('\n');
}

function formatInline(text) {
  let out = escapeHtml(text);

  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold & Italic: ***text***
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold: **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Markdown links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return out;
}

const mdFileName = process.argv[2] ? process.argv[2] : 'DBMS_DESIGN_HANDOUT.md';
const mdBaseName = path.basename(mdFileName, path.extname(mdFileName));
const mdPath = path.isAbsolute(mdFileName) ? mdFileName : path.join(__dirname, '..', 'docs', `${mdBaseName}.md`);
const htmlPath = path.join(__dirname, '..', 'docs', `${mdBaseName}.html`);
const pdfPath = path.join(__dirname, '..', 'docs', `${mdBaseName}.pdf`);

const markdownContent = fs.readFileSync(mdPath, 'utf8');

// Extract first H1 as document title if present
const firstH1Match = markdownContent.match(/^#\s+(.+)$/m);
const documentTitle = firstH1Match ? firstH1Match[1].replace(/[`*]/g, '').trim() : 'Campus Sports Tournament DBMS';

const parsedBody = parseMarkdown(markdownContent);

const completeHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 18mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      line-height: 1.25;
      page-break-after: avoid;
    }
    h1 {
      font-size: 20pt;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 12px;
      color: #1e3a8a;
    }
    h2 {
      font-size: 14pt;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #1e40af;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11.5pt;
      margin-top: 16px;
      margin-bottom: 6px;
      color: #0f172a;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10.5pt;
      margin-top: 12px;
      margin-bottom: 4px;
      color: #334155;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 8px;
    }
    blockquote {
      margin: 8px 0 12px 0;
      padding: 8px 14px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 0 6px 6px 0;
      color: #1e40af;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    blockquote p {
      margin: 0;
    }
    ul, ol {
      margin-top: 4px;
      margin-bottom: 10px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 3px;
    }
    code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 8.8pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1.5px 4.5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 8.5pt;
      line-height: 1.45;
      margin-top: 6px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: inherit;
    }
    hr {
      border: none;
      border-top: 1px solid #cbd5e1;
      margin: 18px 0;
    }
    .table-wrap {
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.8pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 9px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      color: #0f172a;
      font-weight: 700;
      border-bottom: 2px solid #94a3b8;
    }
    tr:nth-child(even) td {
      background: #fcfdfe;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    .diagram-pre {
      font-family: "Consolas", monospace;
      font-size: 8pt;
      line-height: 1.25;
      background: #f8fafc;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
    }
  </style>
</head>
<body>
${parsedBody}
</body>
</html>`;

fs.writeFileSync(htmlPath, completeHtml, 'utf8');
console.log('Generated HTML at:', htmlPath);

const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const edgeBin = edgePaths.find((p) => fs.existsSync(p));
if (!edgeBin) {
  console.error('Edge binary not found.');
  process.exit(1);
}

console.log('Found Edge at:', edgeBin);

try {
  execFileSync(edgeBin, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
  ], { stdio: 'inherit' });
  console.log('SUCCESS: Generated PDF at:', pdfPath);
} catch (err) {
  console.error('Error invoking msedge for PDF generation:', err);
  process.exit(1);
}
