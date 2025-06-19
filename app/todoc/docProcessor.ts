"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
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
    ImageRun,
    PageNumber,
    IImageOptions,
    HeadingLevel,
    ExternalHyperlink
} from 'docx';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

interface DocDetails {
    razrab?: string;
    prov?: string;
    nkontr?: string;
    utv?: string;
    docCode: string;
    lit: string;
    orgName: string;
    docTitle: string;
}

// Represents a piece of structured content extracted from the original DOCX
type TextItem = { text: string; bold?: boolean; italics?: boolean; hyperlink?: string };
type ContentItem = 
    | { type: 'paragraph'; runs: TextItem[]; style?: string } 
    | { type: 'heading'; level: HeadingLevel; runs: TextItem[] }
    | { type: 'list_item'; level: number; runs: TextItem[] }
    | { type: 'table', rows: { cells: { content: ContentItem[] }[] }[] }
    | { type: 'image'; data: IImageOptions };

const ensureArray = (node: any): any[] => {
    if (node === undefined || node === null) return [];
    return Array.isArray(node) ? node : [node];
};

/**
 * Extracts structured content (text, formatting, images, lists, tables, hyperlinks) from a DOCX file buffer.
 * This is a more robust, recursive parser with enhanced debugging.
 * @param docxBuffer The buffer of the uploaded .docx file.
 * @returns A promise that resolves to an array of structured content items.
 */
async function extractStructuredContentFromDocx(docxBuffer: Buffer): Promise<ContentItem[]> {
    debugLogger.info('[DOCX_PARSER] Starting content extraction...');
    const zip = await JSZip.loadAsync(docxBuffer);
    
    // --- Relationship and Image Mapping ---
    const relsContent = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const relsParser = new XMLParser({ ignoreAttributes: false, preserveOrder: true });
    const rels = relsParser.parse(relsContent || "");
    const imageRelMap = new Map<string, Buffer>();
    const linkRelMap = new Map<string, string>();

    const relationshipNodes = rels[0]?.Relationships?.[0]?.Relationship;
    if (relationshipNodes) {
        debugLogger.debug(`[DOCX_PARSER] Found ${ensureArray(relationshipNodes).length} relationships.`);
        for (const rel of ensureArray(relationshipNodes)) {
            const relAttrs = rel[':@'];
            if (relAttrs["@_Type"].includes("image")) {
                const imagePath = `word/${relAttrs["@_Target"]}`;
                const imageFile = zip.file(imagePath);
                if (imageFile) {
                    const buffer = await imageFile.async("nodebuffer");
                    imageRelMap.set(relAttrs["@_Id"], buffer);
                    debugLogger.debug(`[DOCX_PARSER] Mapped Image: ${relAttrs["@_Id"]} -> ${imagePath} (${buffer.byteLength} bytes)`);
                }
            } else if (relAttrs["@_Type"].includes("hyperlink")) {
                linkRelMap.set(relAttrs["@_Id"], relAttrs["@_Target"]);
                debugLogger.debug(`[DOCX_PARSER] Mapped Hyperlink: ${relAttrs["@_Id"]} -> ${relAttrs["@_Target"]}`);
            }
        }
    } else {
        debugLogger.warn('[DOCX_PARSER] No relationships found in document.xml.rels.');
    }
    
    // --- Main Document Parsing ---
    const contentXml = await zip.file("word/document.xml")?.async("string");
    if (!contentXml) throw new Error("word/document.xml not found.");

    const xmlParser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, textNodeName: "#text" });
    const docXml = xmlParser.parse(contentXml);
    const body = docXml.find((n:any) => n["w:document"])?.["w:document"]?.find((n:any) => n["w:body"])?.["w:body"];

    const parseRuns = (runContainer: any[]): TextItem[] => {
        const runs: TextItem[] = [];
        for (const node of ensureArray(runContainer)) {
             if (node["w:r"]) { // Standard run
                const runChildren = ensureArray(node["w:r"]);
                const rPr = runChildren.find((n: any) => n["w:rPr"])?.["w:rPr"];
                const rPrChildren = ensureArray(rPr);
                const text = runChildren.find((n: any) => n["w:t"])?.["w:t"]?.[0]?.["#text"] || '';
                if(text) runs.push({ text, bold: !!rPrChildren.some((n:any)=>n["w:b"]), italics: !!rPrChildren.some((n:any)=>n["w:i"]) });
             } else if (node["w:hyperlink"]) { // Hyperlink run
                 const hyperlinkChildren = ensureArray(node["w:hyperlink"]);
                 const rId = hyperlinkChildren[0]?.[':@']?.['@_r:id'];
                 const url = linkRelMap.get(rId);
                 const linkRun = ensureArray(hyperlinkChildren[0]?.['w:r']);
                 const text = linkRun[0]?.['w:r']?.find((n: any) => n['w:t'])?.['w:t'][0]['#text'];
                 if(text) runs.push({text, bold: false, italics: false, hyperlink: url });
             }
        }
        return runs;
    }

    const parseParagraph = (pNode: any): ContentItem | null => {
        const pPrNode = pNode["w:p"]?.find((n: any) => n["w:pPr"]);
        let bulletLevel: number | undefined;
        let headingLevel: HeadingLevel | undefined;
        let style: string | undefined;

        if (pPrNode?.["w:pPr"]) {
            const pPrChildren = ensureArray(pPrNode["w:pPr"]);
            const styleNode = pPrChildren.find((n: any) => n["w:pStyle"]);
            const styleVal = styleNode?.["w:pStyle"]?.[0]?.[':@']?.["@_w:val"];
            if(styleVal) {
                if(styleVal.startsWith("Heading")) headingLevel = styleVal.replace('Heading', 'HEADING_') as HeadingLevel;
                else if (styleVal.toLowerCase().includes("quote")) style = 'Quote';
            }

            const numPrNode = pPrChildren.find((n: any) => n["w:numPr"]);
            if (numPrNode) {
                const numPrChildren = ensureArray(numPrNode["w:numPr"]);
                const levelNode = numPrChildren.find((n: any) => n["w:ilvl"]);
                const level = levelNode?.["w:ilvl"]?.[0]?.[':@']?.["@_w:val"];
                bulletLevel = level !== undefined ? parseInt(level, 10) : 0;
            }
        }
        
        const runs: TextItem[] = parseRuns(pNode["w:p"]);
        if (runs.length === 0) return null; // Ignore paragraphs without text runs

        if (headingLevel) return { type: 'heading', level: headingLevel, runs };
        if (bulletLevel !== undefined) return { type: 'list_item', level: bulletLevel, runs };
        return { type: 'paragraph', runs, style };
    }

    const parseBodyContent = (elements: any[]): ContentItem[] => {
        const items: ContentItem[] = [];
        for (const element of ensureArray(elements)) {
            if (element["w:p"]) {
                 const parsedP = parseParagraph(element);
                 if (parsedP) items.push(parsedP);
            } else if (element["w:tbl"]) {
                 debugLogger.debug('[DOCX_PARSER] Found a table <w:tbl>. Parsing rows...');
                 const tableRows: { cells: { content: ContentItem[] }[] }[] = [];
                 const trNodes = ensureArray(element["w:tbl"]).filter((n: any) => n["w:tr"]);
                 for (const trNode of trNodes) {
                     const tableCells: { content: ContentItem[] }[] = [];
                     const tcNodes = ensureArray(trNode["w:tr"]).filter((n: any) => n["w:tc"]);
                     for (const tcNode of tcNodes) {
                         const cellContentElements = ensureArray(tcNode["w:tc"]);
                         debugLogger.debug(`[DOCX_PARSER] Parsing table cell with ${cellContentElements.length} elements.`);
                         tableCells.push({ content: parseBodyContent(cellContentElements) });
                     }
                     tableRows.push({ cells: tableCells });
                 }
                 items.push({ type: 'table', rows: tableRows });
            }
        }
        return items;
    }
    
    if (body) {
        return parseBodyContent(body);
    }
    
    return [];
}

export async function generateDocxWithColontitul(
    docxBuffer: Buffer,
    docDetails: DocDetails
): Promise<Uint8Array> {
    logger.info(`[docProcessor] Processing DOCX in-memory. Doc code: ${docDetails.docCode}`);

    try {
        const content = await extractStructuredContentFromDocx(docxBuffer);
        debugLogger.info(`[docProcessor] Extracted ${content.length} top-level content items.`, content);

        const buildParagraphsFromContent = (items: ContentItem[]): (Paragraph | Table)[] => {
            const children: (Paragraph | Table)[] = [];
            for (const item of items) {
                switch (item.type) {
                    case 'paragraph':
                    case 'heading':
                    case 'list_item':
                        const runs = item.runs.map(run => {
                            if (run.hyperlink) {
                                return new ExternalHyperlink({
                                    children: [new TextRun({ text: run.text, style: "Hyperlink" })],
                                    link: run.hyperlink,
                                });
                            }
                            return new TextRun({ text: run.text, bold: run.bold, italics: run.italics });
                        });
                        children.push(new Paragraph({
                            children: runs,
                            heading: item.type === 'heading' ? item.level : undefined,
                            bullet: item.type === 'list_item' ? { level: item.level } : undefined,
                            style: item.type === 'paragraph' ? item.style : undefined,
                        }));
                        break;
                    case 'image':
                        children.push(new Paragraph({ children: [new ImageRun(item.data)], alignment: AlignmentType.CENTER }));
                        break;
                    case 'table':
                        children.push(new Table({
                            rows: item.rows.map(row => new TableRow({
                                children: row.cells.map(cell => new TableCell({
                                    children: buildParagraphsFromContent(cell.content) as Paragraph[]
                                }))
                            }))
                        }));
                        break;
                }
            }
            return children;
        }

        const docChildren = buildParagraphsFromContent(content);

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
            width: { size: convertInchesToTwip(7.28), type: WidthType.DXA },
            rows: [
                new TableRow({ children: [ createCell("", colWidths[0], noBorders), createCell("", colWidths[1], noBorders), createCell("", colWidths[2], noBorders), createCell("", colWidths[3], noBorders), createCell("", colWidths[4], noBorders), new TableCell({ children: [new Paragraph({ text: docDetails.docCode, alignment: AlignmentType.CENTER, style: "p-large-bold" })], columnSpan: 4, borders: allBorders, verticalAlign: VerticalAlign.CENTER, }), ] }),
                new TableRow({ children: [ createCell("Изм.", colWidths[0], allBorders), createCell("Лист", colWidths[1], allBorders), createCell("№ докум.", colWidths[2], allBorders), createCell("Подп.", colWidths[3], allBorders), createCell("Дата", colWidths[4], allBorders), new TableCell({ children: [new Paragraph({ text: docDetails.docTitle, alignment: AlignmentType.CENTER, style: "p-large" })], rowSpan: 3, borders: allBorders, verticalAlign: VerticalAlign.CENTER }), createCell(docDetails.lit, colWidths[6], allBorders, [new Paragraph({ text: docDetails.lit, alignment: AlignmentType.CENTER, style: "p-large" })]), createCell("", colWidths[7], allBorders, [new Paragraph({ children: [ new TextRun({ children: [PageNumber.CURRENT] }) ], alignment: AlignmentType.CENTER, style: "p-large" })]), createCell("", colWidths[8], allBorders, [new Paragraph({ children: [ new TextRun({ children: [PageNumber.TOTAL_PAGES] }) ], alignment: AlignmentType.CENTER, style: "p-large" })]), ] }),
                new TableRow({ children: [ createCell("Разраб.", colWidths[0], allBorders), createCell(docDetails.razrab, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders), new TableCell({ children: docDetails.orgName.split('\n').map(line => new Paragraph({ text: line, alignment: AlignmentType.CENTER, style: "p-small"})), columnSpan: 3, borders: allBorders, verticalAlign: VerticalAlign.CENTER }), ] }),
                new TableRow({ children: [ createCell("Пров.", colWidths[0], allBorders), createCell(docDetails.prov, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Н. контр.", colWidths[0], allBorders), createCell(docDetails.nkontr, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Утв.", colWidths[0], allBorders), createCell(docDetails.utv, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
            ],
        });

        const footer = new Footer({ children: [table] });

        const doc = new Document({
            styles: { paragraphStyles: [ { id: "p-small", name: "Small Text", basedOn: "Normal", next: "Normal", run: { size: 16 } }, { id: "p-large", name: "Large Text", basedOn: "Normal", next: "Normal", run: { size: 28 } }, { id: "p-large-bold", name: "Large Bold Text", basedOn: "Large Text", next: "Normal", run: { bold: true } }, { id: "Quote", name: "Quote", basedOn: "Normal", next: "Normal", run: { italics: true, color: "888888" }, paragraph: { indentation: { left: 720 }, spacing: { before: 100, after: 100 } } } ] },
            sections: [{ properties: { type: SectionType.NEXT_PAGE }, footers: { default: footer }, children: docChildren, }],
        });

        const buffer = await Packer.toBuffer(doc);
        logger.info(`[docProcessor] Successfully generated and packed new DOCX.`);
        return new Uint8Array(buffer);

    } catch (error) {
        logger.error(`[docProcessor] Failed to generate DOCX file:`, error);
        throw new Error(`Failed to generate DOCX file. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}