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
    VerticalAlign,
    convertInchesToTwip,
    AlignmentType,
    SectionType
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
 * Generates a new DOCX document from user-provided text and adds a GOST-style footer.
 * This function creates a document from scratch, which is the correct way to use the 'docx' library.
 *
 * @param mainContent The main text content of the document, with newlines separating paragraphs.
 * @param docDetails An object with details to fill in the title block.
 * @returns A promise that resolves with the Uint8Array of the generated .docx file.
 */
export async function generateDocxWithColontitul(
    mainContent: string,
    docDetails: DocDetails
): Promise<Uint8Array> {
    logger.info(`[docProcessor] Generating new DOCX with colontitul. Doc code: ${docDetails.docCode}`);

    try {
        const createCell = (text: string = '', width: number, borders: any, children?: any[]) => new TableCell({
            children: children || [new Paragraph({ text, style: "p-small", alignment: AlignmentType.CENTER })],
            width: { size: width, type: WidthType.DXA },
            borders: borders,
            verticalAlign: VerticalAlign.CENTER,
        });

        const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };
        const allBorders = { top: { style: BorderStyle.SINGLE, size: 1, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" }, left: { style: BorderStyle.SINGLE, size: 1, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 1, color: "000000" } };
        
        // Define widths in DXA (1/20th of a point). Using a helper for consistency.
        const colWidths = [700, 1400, 1000, 1000, 1000, 2900, 850, 850, 850].map(w => convertInchesToTwip(w / 1000)); // Example conversion, adjust as needed

        const table = new Table({
            width: { size: convertInchesToTwip(7.28), type: WidthType.DXA }, // 185mm
            rows: [
                new TableRow({
                    children: [
                        createCell("", colWidths[0], noBorders),
                        createCell("", colWidths[1], noBorders),
                        createCell("", colWidths[2], noBorders),
                        createCell("", colWidths[3], noBorders),
                        createCell("", colWidths[4], noBorders),
                        new TableCell({
                            children: [new Paragraph({ text: docDetails.docCode, alignment: AlignmentType.CENTER, style: "p-large-bold" })],
                            columnSpan: 4,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER,
                        }),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("Изм.", colWidths[0], allBorders),
                        createCell("Лист", colWidths[1], allBorders),
                        createCell("№ докум.", colWidths[2], allBorders),
                        createCell("Подп.", colWidths[3], allBorders),
                        createCell("Дата", colWidths[4], allBorders),
                        new TableCell({
                            children: [new Paragraph({ text: docDetails.docTitle, alignment: AlignmentType.CENTER, style: "p-large" })],
                            rowSpan: 3,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER
                        }),
                        createCell(docDetails.lit, colWidths[6], allBorders, [new Paragraph({ text: docDetails.lit, alignment: AlignmentType.CENTER, style: "p-large" })]),
                        createCell(docDetails.list, colWidths[7], allBorders, [new Paragraph({ text: docDetails.list, alignment: AlignmentType.CENTER, style: "p-large" })]),
                        createCell(docDetails.listov, colWidths[8], allBorders, [new Paragraph({ text: docDetails.listov, alignment: AlignmentType.CENTER, style: "p-large" })]),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("Разраб.", colWidths[0], allBorders),
                        createCell(docDetails.razrab, colWidths[1], allBorders),
                        createCell("", colWidths[2], allBorders),
                        createCell("", colWidths[3], allBorders),
                        createCell("", colWidths[4], allBorders),
                        new TableCell({
                            children: docDetails.orgName.split('\n').map(line => new Paragraph({ text: line, alignment: AlignmentType.CENTER, style: "p-small"})),
                            columnSpan: 3,
                            borders: allBorders,
                            verticalAlign: VerticalAlign.CENTER
                        }),
                    ]
                }),
                new TableRow({ children: [ createCell("Пров.", colWidths[0], allBorders), createCell(docDetails.prov, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Н. контр.", colWidths[0], allBorders), createCell(docDetails.nkontr, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Утв.", colWidths[0], allBorders), createCell(docDetails.utv, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
            ],
        });

        const footer = new Footer({ children: [table] });

        const doc = new Document({
            styles: {
                paragraphStyles: [
                    { id: "p-small", name: "Small Text", basedOn: "Normal", next: "Normal", run: { size: 16 } }, // 8pt
                    { id: "p-large", name: "Large Text", basedOn: "Normal", next: "Normal", run: { size: 28 } }, // 14pt
                    { id: "p-large-bold", name: "Large Bold Text", basedOn: "Large Text", next: "Normal", run: { bold: true } },
                ]
            },
            sections: [{
                properties: { type: SectionType.NEXT_PAGE },
                footers: { default: footer },
                children: mainContent.split('\n').map(text => new Paragraph({ text })),
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        logger.info(`[docProcessor] Successfully generated and packed new DOCX.`);
        return new Uint8Array(buffer);

    } catch (error) {
        logger.error(`[docProcessor] Failed to generate DOCX file:`, error);
        throw new Error(`Failed to generate DOCX file. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}