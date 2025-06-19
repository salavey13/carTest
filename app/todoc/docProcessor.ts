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
    ImageRun,
    PageNumber,
    IImageOptions,
    HeadingLevel,
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
type TextItem = { text: string; bold?: boolean; italics?: boolean };
type ContentItem = 
    | { type: 'paragraph'; runs: TextItem[]; style?: string } 
    | { type: 'heading'; level: HeadingLevel; runs: TextItem[] }
    | { type: 'list_item'; level: number; runs: TextItem[] }
    | { type: 'image'; data: IImageOptions };

/**
 * Extracts structured content (text with formatting, images, lists, headings) from a DOCX file buffer.
 * @param docxBuffer The buffer of the uploaded .docx file.
 * @returns A promise that resolves to an array of structured content items.
 */
async function extractStructuredContentFromDocx(docxBuffer: Buffer): Promise<ContentItem[]> {
    const zip = await JSZip.loadAsync(docxBuffer);
    const contentItems: ContentItem[] = [];

    const relsContent = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const relsParser = new XMLParser({ ignoreAttributes: false });
    const rels = relsParser.parse(relsContent || "");
    const imageRelMap = new Map<string, Buffer>();
    if (rels.Relationships && rels.Relationships.Relationship) {
        const relationships = Array.isArray(rels.Relationships.Relationship) ? rels.Relationships.Relationship : [rels.Relationships.Relationship];
        for (const rel of relationships) {
            if (rel["@_Type"].includes("image")) {
                const imageFile = zip.file(`word/${rel["@_Target"]}`);
                if (imageFile) {
                    const buffer = await imageFile.async("nodebuffer");
                    imageRelMap.set(rel["@_Id"], buffer);
                }
            }
        }
    }
    
    const contentXml = await zip.file("word/document.xml")?.async("string");
    if (!contentXml) throw new Error("word/document.xml not found.");

    const xmlParser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, textNodeName: "#text" });
    const docXml = xmlParser.parse(contentXml);
    const body = docXml.find((n:any) => n["w:document"])?.["w:document"]?.find((n:any) => n["w:body"])?.["w:body"];

    if (body) {
        for (const element of body) {
            if (element["w:p"]) {
                const pPrNode = element["w:p"].find((n: any) => n["w:pPr"]);
                const pPr = pPrNode ? pPrNode["w:pPr"] : null;

                let headingLevel: HeadingLevel | undefined;
                let bulletLevel: number | undefined;
                let style: string | undefined;

                if (pPr) {
                    const styleNode = pPr.find((n: any) => n["w:pStyle"]);
                    const styleVal = styleNode?.["w:pStyle"]?.[0]?.["@_w:val"];
                    if (styleVal) {
                        if (styleVal.startsWith("Heading")) headingLevel = styleVal.replace("Heading", `HEADING_`);
                        else if (styleVal.toLowerCase().includes("quote")) style = 'Quote';
                    }

                    const numPrNode = pPr.find((n: any) => n["w:numPr"]);
                    if (numPrNode) {
                        const levelNode = numPrNode["w:numPr"]?.find((n: any) => n["w:ilvl"]);
                        // FIX: Added safe navigation to prevent crash
                        const level = levelNode?.["w:ilvl"]?.[0]?.["@_w:val"];
                        bulletLevel = level !== undefined ? parseInt(level, 10) : 0;
                    }
                }
                
                const runs: TextItem[] = [];
                const runNodes = element["w:p"].filter((n: any) => n["w:r"]);

                for (const rNode of runNodes) {
                    const rPrNode = rNode["w:r"].find((n: any) => n["w:rPr"]);
                    const rPr = rPrNode ? rPrNode["w:rPr"] : null;
                    const isBold = !!rPr?.some((n: any) => n["w:b"]);
                    const isItalic = !!rPr?.some((n: any) => n["w:i"]);
                    
                    for (const child of rNode["w:r"]) {
                        // FIX: Safely access text content, defaulting to empty string
                        const textContent = child["w:t"]?.[0]?.["#text"] || '';
                        if (textContent) {
                            runs.push({ text: textContent, bold: isBold, italics: isItalic });
                        }

                        if (child["w:drawing"]) {
                             const blip = child["w:drawing"]?.[0]?.["wp:inline"]?.[0]?.["a:graphic"]?.[0]?.["a:graphicData"]?.[0]?.["pic:pic"]?.[0]?.["pic:blipFill"]?.[0]?.["a:blip"]?.[0];
                             const rId = blip?.["@_r:embed"];
                             if (rId && imageRelMap.has(rId)) {
                                 contentItems.push({
                                     type: 'image',
                                     data: { data: imageRelMap.get(rId)!, transformation: { width: 500, height: 300 } }
                                 });
                             }
                        }
                    }
                }

                if (runs.length > 0) {
                     if (headingLevel) contentItems.push({ type: 'heading', level: headingLevel, runs });
                     else if (bulletLevel !== undefined) contentItems.push({ type: 'list_item', level: bulletLevel, runs });
                     else contentItems.push({ type: 'paragraph', runs, style });
                } else if (runNodes.length === 0) {
                    // Handle empty paragraphs to preserve line breaks
                    contentItems.push({ type: 'paragraph', runs: [{ text: '' }] });
                }
            }
        }
    }
    
    return contentItems;
}


export async function generateDocxWithColontitul(
    docxBuffer: Buffer,
    docDetails: DocDetails
): Promise<Uint8Array> {
    logger.info(`[docProcessor] Processing DOCX in-memory. Doc code: ${docDetails.docCode}`);

    try {
        const content = await extractStructuredContentFromDocx(docxBuffer);

        const docChildren: Paragraph[] = content.map(item => {
            if (item.type === 'image') {
                return new Paragraph({ children: [new ImageRun(item.data)], alignment: AlignmentType.CENTER });
            }
            const runs = item.runs.map(run => new TextRun({ text: run.text, bold: run.bold, italics: run.italics }));

            switch (item.type) {
                case 'heading':
                    return new Paragraph({ children: runs, heading: item.level });
                case 'list_item':
                    return new Paragraph({ children: runs, bullet: { level: item.level } });
                case 'paragraph':
                default:
                    return new Paragraph({ children: runs, style: item.style });
            }
        });

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