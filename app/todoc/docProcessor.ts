"use server";

import { logger } from '@/lib/logger';
import { 
    Document, 
    Packer, 
    Paragraph, 
    Table, 
    TableCell, 
    TableRow, 
    Footer, 
    WidthType, 
    BorderStyle,
    TextRun,
    VerticalAlign,
    convertInchesToTwip,
    AlignmentType
} from 'docx';

interface DocDetails {
    razrab?: string;
    prov?: string;
    nkontr?: string;
    utv?: string;
    docCode: string;
    lit: string;
    list: string;
    listov: string;
    orgName: string;
    docTitle: string;
}

/**
 * Adds a GOST-style footer (колонтитул) to a DOCX document using the 'docx' library.
 * This function now performs a real modification of the document buffer.
 * 
 * @param originalFileBuffer The buffer of the original .docx file.
 * @param originalFileName The name of the file, used to check for unsupported .doc format.
 * @param docDetails An object with details to fill in the title block.
 * @returns A promise that resolves with the Uint8Array of the modified .docx file.
 */
export async function addColontitulToDocx(
    originalFileBuffer: Buffer,
    originalFileName: string,
    docDetails: DocDetails
): Promise<Uint8Array> {
    logger.info(`[docProcessor] Processing document: ${originalFileName}`);

    // The 'docx' library cannot handle the old binary .doc format.
    // A production setup would need a server-side converter like LibreOffice/unoconv.
    if (originalFileName.toLowerCase().endsWith('.doc')) {
        logger.error(`[docProcessor] Unsupported .doc format received: ${originalFileName}.`);
        throw new Error("Processing .doc files is not supported directly. Please convert to .docx and try again. A server-side converter like 'unoconv' is required for automatic handling.");
    }

    try {
        const doc = await Document.load(originalFileBuffer);
        
        const createCell = (text: string, width: number, borders: any, children?: any[]) => new TableCell({
            children: children || [new Paragraph({ text: text, style: "p-small" })],
            width: { size: width, type: WidthType.DXA },
            borders: borders,
            verticalAlign: VerticalAlign.CENTER,
        });

        const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };
        const allBorders = { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.SINGLE }, right: { style: BorderStyle.SINGLE } };

        const table = new Table({
            width: { size: convertInchesToTwip(7.28), type: WidthType.DXA }, // 185mm = ~7.28 inches
            columnWidths: [1000, 1000, 1500, 1000, 1000, 2000, 1000, 1000, 1000], // Approximate widths
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ children: [], borders: noBorders }),
                        new TableCell({ children: [], borders: noBorders }),
                        new TableCell({ children: [], borders: noBorders }),
                        new TableCell({ children: [], borders: noBorders }),
                        new TableCell({ children: [], borders: noBorders }),
                        new TableCell({
                            children: [new Paragraph({
                                text: docDetails.docCode,
                                alignment: AlignmentType.CENTER,
                                style: "p-large-bold",
                            })],
                            columnSpan: 4,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER,
                        }),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("Изм.", 1000, allBorders),
                        createCell("Лист", 1000, allBorders),
                        createCell("№ докум.", 1500, allBorders),
                        createCell("Подп.", 1000, allBorders),
                        createCell("Дата", 1000, allBorders),
                        new TableCell({
                            children: [new Paragraph({ text: docDetails.docTitle, alignment: AlignmentType.CENTER, style: "p-large" })],
                            rowSpan: 3,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER
                        }),
                        createCell("Лит.", 1000, allBorders, [new Paragraph({ text: docDetails.lit, alignment: AlignmentType.CENTER, style: "p-large" })]),
                        createCell("Лист", 1000, allBorders, [new Paragraph({ text: docDetails.list, alignment: AlignmentType.CENTER, style: "p-large" })]),
                        createCell("Листов", 1000, allBorders, [new Paragraph({ text: docDetails.listov, alignment: AlignmentType.CENTER, style: "p-large" })]),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("Разраб.", 1000, allBorders),
                        createCell(docDetails.razrab || "", 2500, allBorders, [new Paragraph(docDetails.razrab || "")]),
                        createCell("", 1000, allBorders),
                        createCell("", 1000, allBorders),
                        new TableCell({
                            children: [new Paragraph({ text: docDetails.orgName, alignment: AlignmentType.CENTER, style: "p-small"})],
                            columnSpan: 3,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER
                        }),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("Пров.", 1000, allBorders),
                        createCell(docDetails.prov || "", 2500, allBorders, [new Paragraph(docDetails.prov || "")]),
                        createCell("", 1000, allBorders),
                        createCell("", 1000, allBorders),
                    ]
                }),
                 new TableRow({
                    children: [
                        createCell("Н. контр.", 1000, allBorders),
                        createCell(docDetails.nkontr || "", 2500, allBorders, [new Paragraph(docDetails.nkontr || "")]),
                        createCell("", 1000, allBorders),
                        createCell("", 1000, allBorders),
                    ]
                }),
                 new TableRow({
                    children: [
                        createCell("Утв.", 1000, allBorders),
                        createCell(docDetails.utv || "", 2500, allBorders, [new Paragraph(docDetails.utv || "")]),
                        createCell("", 1000, allBorders),
                        createCell("", 1000, allBorders),
                    ]
                }),
            ],
        });

        const footer = new Footer({
            children: [table],
        });

        doc.sections.forEach(section => {
            section.properties.footers.default = footer;
        });

        doc.addStyle({
            id: "p-small",
            name: "Small Text",
            basedOn: "Normal",
            next: "Normal",
            run: { size: 14 }, // 7pt
        });
        doc.addStyle({
            id: "p-large",
            name: "Large Text",
            basedOn: "Normal",
            next: "Normal",
            run: { size: 28 }, // 14pt
        });
        doc.addStyle({
            id: "p-large-bold",
            name: "Large Bold Text",
            basedOn: "Large Text",
            next: "Normal",
            run: { bold: true },
        });

        const buffer = await Packer.toBuffer(doc);
        logger.info(`[docProcessor] Successfully processed and packed document: ${originalFileName}`);
        return new Uint8Array(buffer);

    } catch (error) {
        logger.error(`[docProcessor] Failed to process DOCX file ${originalFileName}:`, error);
        throw new Error(`Failed to process DOCX file. It may be corrupted or in an unsupported format. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}