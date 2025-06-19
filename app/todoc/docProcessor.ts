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
    ImageRun
} from 'docx';

interface DocDetails {
    razrab?: string;
    prov?: string;
    nkontr?: string;
    utv?: string;
    docCode: string;
    lit: string;
    // list and listov are now handled dynamically
    orgName: string;
    docTitle: string;
}

/**
 * Parses a line of markdown text into an array of docx objects (TextRun, ImageRun).
 * Handles **bold**, *italic*, and ![alt](src) for images.
 * @param text The line of text to parse.
 * @returns A promise that resolves to an array of TextRun and ImageRun objects.
 */
const createRunsFromMarkdownLine = async (text: string): Promise<(TextRun | ImageRun)[]> => {
    const runs: (TextRun | ImageRun)[] = [];
    // Regex to capture **bold**, *italic*, or ![alt](src)
    const markdownRegex = /(\*\*|`)(.*?)\1|(\*)(.*?)\*|!\[(.*?)\]\((.*?)\)/g;
    let lastIndex = 0;
    let match;

    const promises: Promise<void>[] = [];

    while ((match = markdownRegex.exec(text)) !== null) {
        // Add preceding normal text
        if (match.index > lastIndex) {
            runs.push(new TextRun(text.substring(lastIndex, match.index)));
        }

        const [fullMatch, boldDelim, boldText, italicDelim, italicText, imgAlt, imgUrl] = match;

        if (boldDelim === '**') {
            runs.push(new TextRun({ text: boldText, bold: true }));
        } else if (italicDelim === '*') {
            runs.push(new TextRun({ text: italicText, italics: true }));
        } else if (imgUrl) {
            const promise = fetch(imgUrl)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    runs.push(new ImageRun({
                        data: buffer,
                        transformation: { width: 400, height: 300 }, // Default size, can be adjusted
                        altText: { title: imgAlt || 'image' },
                    }));
                }).catch(err => {
                    logger.error(`Failed to fetch image from URL: ${imgUrl}`, err);
                    runs.push(new TextRun({ text: `[Failed to load image: ${imgAlt || imgUrl}]`, color: "FF0000" }));
                });
            promises.push(promise);
        }
        
        lastIndex = markdownRegex.lastIndex;
    }

    // Add any remaining normal text
    if (lastIndex < text.length) {
        runs.push(new TextRun(text.substring(lastIndex)));
    }

    await Promise.all(promises);
    return runs;
};

/**
 * Parses a markdown string into an array of docx Paragraph objects.
 * Supports headings, bullet points, horizontal rules, images, and inline bold/italic.
 * @param markdown The full markdown text.
 * @returns A promise resolving to an array of Paragraphs.
 */
const parseMarkdownToDocxObjects = async (markdown: string): Promise<Paragraph[]> => {
    const paragraphs: Paragraph[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
        const children = await createRunsFromMarkdownLine(line);

        if (line.startsWith('### ')) {
            paragraphs.push(new Paragraph({ children: await createRunsFromMarkdownLine(line.substring(4)), heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith('## ')) {
            paragraphs.push(new Paragraph({ children: await createRunsFromMarkdownLine(line.substring(3)), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('# ')) {
            paragraphs.push(new Paragraph({ children: await createRunsFromMarkdownLine(line.substring(2)), heading: HeadingLevel.HEADING_1 }));
        } else if (line.match(/^(\*|-|_){3,}$/)) {
            paragraphs.push(new Paragraph({ border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } } }));
        } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            paragraphs.push(new Paragraph({ children: await createRunsFromMarkdownLine(line.trim().substring(2)), bullet: { level: 0 } }));
        } else if (line.trim() === '' && paragraphs[paragraphs.length - 1]?.getTextRun(0)?.text.includes('![')) {
             // Avoid adding extra space after an image-only line
        }
        else {
            paragraphs.push(new Paragraph({ children }));
        }
    }

    return paragraphs;
};


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
                        // Dynamic Page Numbers
                        createCell("", colWidths[7], allBorders, [new Paragraph({ children: [new TextRun(PageNumber.CURRENT)], alignment: AlignmentType.CENTER, style: "p-large" })]),
                        createCell("", colWidths[8], allBorders, [new Paragraph({ children: [new TextRun(PageNumber.TOTAL_PAGES)], alignment: AlignmentType.CENTER, style: "p-large" })]),
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
                children: await parseMarkdownToDocxObjects(mainContent),
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