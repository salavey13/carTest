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
    SectionType,
    TextRun,
    HeadingLevel,
    TabStopType,
    TabStopPosition
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
 * Parses a line of markdown text into an array of TextRun objects for docx.
 * Handles **bold** and *italic*.
 * @param text The line of text to parse.
 * @returns An array of TextRun objects.
 */
const createTextRuns = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    // Regex to capture **bold** or *italic* text
    const markdownRegex = /(\*\*|`)(.*?)\1|(\*)(.*?)\*/g;
    let lastIndex = 0;
    let match;

    while ((match = markdownRegex.exec(text)) !== null) {
        // Add preceding normal text
        if (match.index > lastIndex) {
            runs.push(new TextRun(text.substring(lastIndex, match.index)));
        }

        const [fullMatch, boldOrCodeDelim, boldOrCodeText, italicDelim, italicText] = match;
        
        if (boldOrCodeDelim === '**') {
            runs.push(new TextRun({ text: boldOrCodeText, bold: true }));
        } else if (italicDelim === '*') {
            runs.push(new TextRun({ text: italicText, italics: true }));
        }
        
        lastIndex = markdownRegex.lastIndex;
    }

    // Add any remaining normal text
    if (lastIndex < text.length) {
        runs.push(new TextRun(text.substring(lastIndex)));
    }

    return runs;
};


/**
 * Parses a markdown string into an array of docx Paragraph objects.
 * Supports headings, bullet points, horizontal rules, and inline bold/italic.
 * @param markdown The full markdown text.
 * @returns An array of Paragraphs for use in a docx Document.
 */
const parseMarkdownToDocxObjects = (markdown: string): Paragraph[] => {
    const paragraphs: Paragraph[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
        // Headings
        if (line.startsWith('### ')) {
            paragraphs.push(new Paragraph({ children: createTextRuns(line.substring(4)), heading: HeadingLevel.HEADING_3 }));
            continue;
        }
        if (line.startsWith('## ')) {
            paragraphs.push(new Paragraph({ children: createTextRuns(line.substring(3)), heading: HeadingLevel.HEADING_2 }));
            continue;
        }
        if (line.startsWith('# ')) {
            paragraphs.push(new Paragraph({ children: createTextRuns(line.substring(2)), heading: HeadingLevel.HEADING_1 }));
            continue;
        }
        // Horizontal Rule
        if (line.match(/^(\*|-|_){3,}$/)) {
            paragraphs.push(new Paragraph({ border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } } }));
            continue;
        }
        // Bullet points
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            paragraphs.push(new Paragraph({ children: createTextRuns(line.trim().substring(2)), bullet: { level: 0 } }));
            continue;
        }
        // Empty line
        if (line.trim() === '') {
            paragraphs.push(new Paragraph(""));
            continue;
        }
        // Normal paragraph
        paragraphs.push(new Paragraph({ children: createTextRuns(line) }));
    }

    return paragraphs;
};


/**
 * Generates a new DOCX document from user-provided markdown text and adds a GOST-style footer.
 *
 * @param mainContent The main text content of the document in Markdown format.
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
        
        const colWidths = [700, 1400, 1000, 1000, 1000, 2900, 850, 850, 850].map(w => convertInchesToTwip(w / 1000));

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
                children: parseMarkdownToDocxObjects(mainContent),
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