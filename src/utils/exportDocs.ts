import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, UnderlineType, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';
import { TreeEntry, SurveyMetadata, GirthClass, AuditReport } from '../types';
import { parseGirthRanges, getGirthBucketIndex, calculateBasalArea, estimateVolume, auditTreeEntries } from './tally';

export function getHeadingLines(meta: SurveyMetadata) {
  const line1 = 'PROPOSED YIELD';

  let line2 = '';
  if (meta.siteName && meta.siteName.trim()) {
    line2 = meta.siteName.trim().toUpperCase();
    if (!line2.includes('OFF RESERVE') && !line2.includes('OFF-RESERVE')) {
      line2 += ' OFF RESERVE';
    }
  }

  let line3 = '';
  if (meta.clientName && meta.clientName.trim()) {
    line3 = meta.clientName.trim().toUpperCase();
    if (!line3.startsWith('MESSRS')) {
      line3 = `MESSRS ${line3}`;
    }
  }

  let line4 = '';
  if (meta.district && meta.district.trim()) {
    line4 = meta.district.trim().toUpperCase();
    if (!line4.includes('DISTRICT')) {
      line4 += ' FOREST DISTRICT';
    }
  }

  return { line1, line2, line3, line4 };
}

export function exportToPDF(entries: TreeEntry[], meta: SurveyMetadata) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ranges: GirthClass[] = parseGirthRanges(meta.girthClassRanges);
  const audit: AuditReport = auditTreeEntries(entries);
  const { line1, line2, line3, line4 } = getHeadingLines(meta);

  // Group entries by species code
  const speciesOrder: string[] = [];
  const speciesGroupMap = new Map<string, { name: string; buckets: number[][] }>();

  entries.forEach(e => {
    const code = e.code.toUpperCase();
    if (!speciesGroupMap.has(code)) {
      speciesOrder.push(code);
      speciesGroupMap.set(code, {
        name: e.name,
        buckets: ranges.map(() => [])
      });
    }
    const bucketIdx = getGirthBucketIndex(e.girth, ranges);
    if (bucketIdx >= 0) {
      speciesGroupMap.get(code)!.buckets[bucketIdx].push(e.num);
    }
  });

  let grandTotalBasalArea = 0;
  let grandTotalVolume = 0;
  entries.forEach(e => {
    grandTotalBasalArea += calculateBasalArea(e.girth);
    grandTotalVolume += estimateVolume(e.girth);
  });

  // Centered Heading Block
  const centerX = 297 / 2; // A4 Landscape width is 297mm
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);

  const headingLines = [line1, line2, line3, line4].filter(Boolean);
  headingLines.forEach((line, idx) => {
    const y = 10 + idx * 5;
    doc.text(line, centerX, y, { align: 'center' });
    doc.line(centerX - doc.getTextWidth(line) / 2, y + 1, centerX + doc.getTextWidth(line) / 2, y + 1);
  });

  // Survey Metadata Summary
  doc.setTextColor(43, 32, 19);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`District: ${meta.district || 'N/A'}`, 14, 33);
  doc.text(`Client: ${meta.clientName || 'N/A'}`, 85, 33);
  doc.text(`Site: ${meta.siteName || 'N/A'}`, 175, 33);
  doc.text(`Date: ${meta.date || new Date().toLocaleDateString()}`, 240, 33);

  // Metrics summary bar
  doc.setFillColor(236, 230, 214);
  doc.roundedRect(14, 37, 269, 10, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(31, 61, 46);
  doc.setFont('helvetica', 'bold');
  const treeCountLabel = meta.targetTotalTrees ? `Trees: ${entries.length} / ${meta.targetTotalTrees}` : `Total Trees: ${entries.length}`;
  doc.text(treeCountLabel, 20, 43.5);
  doc.text(`Total Basal Area: ${grandTotalBasalArea.toFixed(2)} m²`, 105, 43.5);
  doc.text(`Est. Timber Volume: ${grandTotalVolume.toFixed(1)} m³`, 190, 43.5);

  // Table Columns & Rows
  const tableHeaders = ['Code', 'Local Species Name', ...ranges.map(r => `${r.label}cm`), 'Total'];
  const colTotals = ranges.map(() => 0);

  const tableRows = speciesOrder.map(code => {
    const g = speciesGroupMap.get(code)!;
    let rowTotal = 0;

    const cells = g.buckets.map((nums, idx) => {
      rowTotal += nums.length;
      colTotals[idx] += nums.length;
      return nums.length ? `${nums.slice().sort((a, b) => a - b).join(',')} (${nums.length})` : '-';
    });

    return [code, g.name, ...cells, rowTotal.toString()];
  });

  autoTable(doc, {
    startY: 50,
    head: [tableHeaders],
    body: tableRows,
    foot: [[
      { content: 'Total', colSpan: 2 + ranges.length, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: entries.length.toString(), styles: { halign: 'center', fontStyle: 'bold' } }
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [31, 61, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [43, 32, 19],
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', fillColor: [240, 236, 224] },
      1: { fontStyle: 'bold', halign: 'left' }
    },
    footStyles: {
      fillColor: [31, 61, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    }
  });

  // Verification Audit Footer Stamp
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 160;
  
  if (audit.isClean) {
    doc.setDrawColor(47, 107, 69);
    doc.setFillColor(230, 245, 235);
    doc.roundedRect(14, finalY, 269, 12, 2, 2, 'FD');
    doc.setTextColor(47, 107, 69);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`[VERIFICATION STAMP] SEQUENCE COMPLETE - No missing or duplicate tree numbers detected (Trees 1 to #${audit.maxNumber}).`, 20, finalY + 8);
  } else {
    doc.setDrawColor(140, 47, 47);
    doc.setFillColor(255, 235, 235);
    doc.roundedRect(14, finalY, 269, 12, 2, 2, 'FD');
    doc.setTextColor(140, 47, 47);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`[VERIFICATION STAMP] SEQUENCE AUDIT FLAG - ${audit.missingNums.length} missing gaps, ${audit.duplicateNums.length} duplicates. Requires field review.`, 20, finalY + 8);
  }

  const filename = `timber_tally_${(meta.siteName || 'survey').toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}

export async function exportToDocx(entries: TreeEntry[], meta: SurveyMetadata) {
  const ranges: GirthClass[] = parseGirthRanges(meta.girthClassRanges);
  const { line1, line2, line3, line4 } = getHeadingLines(meta);

  // Group entries by species code
  const speciesOrder: string[] = [];
  const speciesGroupMap = new Map<string, { name: string; buckets: number[][] }>();

  entries.forEach(e => {
    const code = e.code.toUpperCase();
    if (!speciesGroupMap.has(code)) {
      speciesOrder.push(code);
      speciesGroupMap.set(code, {
        name: e.name,
        buckets: ranges.map(() => [])
      });
    }
    const bucketIdx = getGirthBucketIndex(e.girth, ranges);
    if (bucketIdx >= 0) {
      speciesGroupMap.get(code)!.buckets[bucketIdx].push(e.num);
    }
  });

  let grandTotalBasalArea = 0;
  let grandTotalVolume = 0;
  entries.forEach(e => {
    grandTotalBasalArea += calculateBasalArea(e.girth);
    grandTotalVolume += estimateVolume(e.girth);
  });

  const tableHeaders = [
    'CODE',
    'LOCAL NAME',
    ...ranges.map(r => (r.label.includes('-') ? r.label.replace(/\s*-\s*/, ' - ') : r.label)),
    'Total'
  ];
  const colTotals = ranges.map(() => 0);

  // Docx Table Header Row
  const docxHeaderRow = new TableRow({
    tableHeader: true,
    children: tableHeaders.map((text, idx) => {
      const isTotalHeader = idx === tableHeaders.length - 1;
      const colWidthPercent = idx === 0 ? 10 : idx === 1 ? 22 : isTotalHeader ? 10 : Math.floor(58 / ranges.length);

      return new TableCell({
        width: { size: colWidthPercent, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        children: [
          new Paragraph({
            style: 'Normal',
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: text,
                font: 'Times New Roman',
                bold: true,
                color: '000000',
                size: 20
              })
            ]
          })
        ]
      });
    })
  });

  // Docx Table Data Rows (normal weight, Times New Roman)
  const docxDataRows = speciesOrder.map(code => {
    const g = speciesGroupMap.get(code)!;
    let rowTotal = 0;
    const bucketWidth = Math.floor(58 / ranges.length);

    const cells = g.buckets.map((nums, idx) => {
      rowTotal += nums.length;
      colTotals[idx] += nums.length;

      if (nums.length === 0) {
        return new TableCell({
          width: { size: bucketWidth, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 60, right: 60 },
          children: [
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: '-',
                  font: 'Times New Roman',
                  bold: false,
                  color: '000000',
                  size: 20
                })
              ]
            })
          ]
        });
      }

      const sortedNums = nums.slice().sort((a, b) => a - b);
      const cellText = `${sortedNums.join(', ')} (${nums.length})`;

      return new TableCell({
        width: { size: bucketWidth, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 60, right: 60 },
        children: [
          new Paragraph({
            style: 'Normal',
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: cellText,
                font: 'Times New Roman',
                bold: false,
                color: '000000',
                size: 20
              })
            ]
          })
        ]
      });
    });

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 60, right: 60 },
          children: [
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: code,
                  font: 'Times New Roman',
                  bold: false,
                  size: 20,
                  color: '000000'
                })
              ]
            })
          ]
        }),
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 80, right: 60 },
          children: [
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: g.name,
                  font: 'Times New Roman',
                  bold: false,
                  size: 20,
                  color: '000000'
                })
              ]
            })
          ]
        }),
        ...cells,
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 60, right: 60 },
          children: [
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: rowTotal.toString(),
                  font: 'Times New Roman',
                  bold: false,
                  size: 20,
                  color: '000000'
                })
              ]
            })
          ]
        })
      ]
    });
  });

  // Docx Footer Row
  const docxFooterRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        width: { size: 32, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        children: [
          new Paragraph({
            style: 'Normal',
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: 'TOTAL',
                font: 'Times New Roman',
                bold: true,
                color: '000000',
                size: 20
              })
            ]
          })
        ]
      }),
      ...colTotals.map((tot) => {
        const bucketWidth = Math.floor(58 / ranges.length);
        return new TableCell({
          width: { size: bucketWidth, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 80, right: 80 },
          children: [
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: tot > 0 ? tot.toString() : '-',
                  font: 'Times New Roman',
                  bold: true,
                  color: '000000',
                  size: 20
                })
              ]
            })
          ]
        });
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        children: [
          new Paragraph({
            style: 'Normal',
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: entries.length.toString(),
                font: 'Times New Roman',
                bold: true,
                color: '000000',
                size: 20
              })
            ]
          })
        ]
      })
    ]
  });

  const docxTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    },
    rows: [docxHeaderRow, ...docxDataRows, docxFooterRow]
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 24,
            color: '000000'
          },
          paragraph: {
            spacing: { after: 120, line: 276 }
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 24,
            color: '000000'
          },
          paragraph: {
            spacing: { after: 120, line: 276 }
          }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
            size: { orientation: PageOrientation.LANDSCAPE }
          }
        },
        children: [
          ...[line1, line2, line3, line4].filter(Boolean).map((line, idx, arr) =>
            new Paragraph({
              style: 'Normal',
              alignment: AlignmentType.CENTER,
              spacing: { after: idx === arr.length - 1 ? 180 : 60 },
              children: [
                new TextRun({
                  text: line,
                  font: 'Times New Roman',
                  bold: true,
                  underline: { type: UnderlineType.SINGLE },
                  color: '000000',
                  size: 24
                })
              ]
            })
          ),
          new Paragraph({ style: 'Normal', text: '' }),
          docxTable
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `timber_tally_${(meta.siteName || 'survey').toLowerCase().replace(/[^a-z0-9]/g, '_')}.docx`;
  saveAs(blob, filename);
}

