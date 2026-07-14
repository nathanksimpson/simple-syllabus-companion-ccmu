/**
 * Export syllabi as editable Word (.docx) tables.
 * window.CCPCompanionWordExport
 */
(function (global) {
    function escapeCellText(value) {
        return String(value ?? '').replace(/\r?\n/g, ' ').trim();
    }

    function rowToCells(row, options) {
        const showDate = !options || options.showDateColumn !== false;
        const cells = [];
        cells.push(escapeCellText(row.weekLabel || ''));
        cells.push(row.sessionNumber != null ? String(row.sessionNumber) : '');
        if (showDate) {
            cells.push(escapeCellText(row.dateLabel || row.date || ''));
        }
        const plan = [row.planTitle, row.planDetail].filter(Boolean).join(' — ');
        cells.push(escapeCellText(plan));
        cells.push(escapeCellText(row.pages || row.planDetail || ''));
        cells.push(escapeCellText(row.note || ''));
        return cells;
    }

    function buildTableHeaders(options) {
        const showDate = !options || options.showDateColumn !== false;
        const headers = ['Week', 'Class #'];
        if (showDate) headers.push('Date');
        headers.push('Lesson plan', 'Pages / detail', 'Notes');
        return headers;
    }

    function buildProjectDocMeta(project) {
        const lines = [];
        if (project.name) lines.push(project.name);
        if (project.grade) lines.push(`Grade: ${project.grade}`);
        if (project.startDate || project.endDate) {
            lines.push(`Dates: ${project.startDate || '—'} – ${project.endDate || '—'}`);
        }
        return lines.join('\n');
    }

  async function exportProjectToDocx(project, options) {
        const docx = global.docx;
        if (!docx) {
            throw new Error('Word export bundle not loaded');
        }
        const {
            Document, Packer, Paragraph, Table, TableRow, TableCell,
            TextRun, WidthType, HeadingLevel
        } = docx;
        const opts = options || {};
        const headers = buildTableHeaders(opts);
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
            }))
        });
        const rows = (project.syllabusRows || []).map((row) => {
            const cells = rowToCells(row, opts);
            return new TableRow({
                children: cells.map((text) => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text })] })]
                }))
            });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        text: project.name || 'Syllabus',
                        heading: HeadingLevel.HEADING_1
                    }),
                    new Paragraph({ text: buildProjectDocMeta(project) }),
                    new Paragraph({ text: '' }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...rows]
                    }),
                    ...(project.syllabusGeneralNotes
                        ? [
                            new Paragraph({ text: '' }),
                            new Paragraph({ children: [new TextRun({ text: 'General notes', bold: true })] }),
                            new Paragraph({ text: String(project.syllabusGeneralNotes) })
                        ]
                        : [])
                ]
            }]
        });
        return Packer.toBlob(doc);
    }

    async function downloadProjectDocx(project, options) {
        const blob = await exportProjectToDocx(project, options);
        const name = (project.name || 'syllabus').replace(/[<>:"/\\|?*]+/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.docx`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function downloadProjectsDocx(projects, options) {
        const list = Array.isArray(projects) ? projects : [];
        for (let i = 0; i < list.length; i += 1) {
            await downloadProjectDocx(list[i], options);
        }
        return list.length;
    }

    global.CCPCompanionWordExport = {
        escapeCellText,
        rowToCells,
        buildTableHeaders,
        buildProjectDocMeta,
        exportProjectToDocx,
        downloadProjectDocx,
        downloadProjectsDocx
    };
})(typeof window !== 'undefined' ? window : globalThis);
