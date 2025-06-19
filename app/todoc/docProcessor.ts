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
    ImageRun,
    PageNumber
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

// Represents a piece of content extracted from the original DOCX
type DocContent = { type: 'text'; text: string } | { type: 'image'; rId: string };

/**
 * Extracts text and image references from a DOCX file buffer in order.
 * @param docxBuffer The buffer of the uploaded .docx file.
 * @returns A promise that resolves to the extracted content array and a map of image data.
 */
async function extractContentFromDocx(docxBuffer: Buffer): Promise<{ content: DocContent[]; imageMap: Map<string, Buffer> }> {
    const zip = await JSZip.loadAsync(docxBuffer);
    const imageMap = new Map<string, Buffer>();
    const content: DocContent[] = [];

    // 1. Build relationship map (rId -> image path)
    const relsContent = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const relsParser = new XMLParser({ ignoreAttributes: false });
    const rels = relsParser.parse(relsContent || "");
    const relMap = new Map<string, string>();
    if (rels.Relationships && rels.Relationships.Relationship) {
        const relationships = Array.isArray(rels.Relationships.Relationship) ? rels.Relationships.Relationship : [rels.Relationships.Relationship];
        for (const rel of relationships) {
            if (rel["@_Type"].includes("image")) {
                relMap.set(rel["@_Id"], rel["@_Target"]);
            }
        }
    }
    
    // 2. Pre-load all images into a map
    for (const [rId, path] of relMap.entries()) {
        const imageFile = zip.file(`word/${path}`);
        if (imageFile) {
            const buffer = await imageFile.async("nodebuffer");
            imageMap.set(rId, buffer);
        }
    }

    // 3. Parse main document and extract content in order
    const contentXml = await zip.file("word/document.xml")?.async("string");
    if (!contentXml) throw new Error("word/document.xml not found.");

    const contentParser = new XMLParser({ ignoreAttributes: false, preserveOrder: true });
    const docXml = contentParser.parse(contentXml);
    
    const body = docXml.find((node: any) => node["w:document"])?.["w:document"]
                      .find((node: any) => node["w:body"])?.["w:body"];

    if (body) {
        for (const pNode of body) {
            if (pNode['w:p']) {
                let currentParagraphText = '';
                for (const rNode of pNode['w:p']) {
                     if (rNode['w:r']) {
                        for (const child of rNode['w:r']) {
                            if (child['w:t']) {
                                currentParagraphText += (child['w:t'][0]?.['#text'] || '');
                            }
                            if (child['w:drawing']) {
                                // Flush any preceding text in the paragraph
                                if (currentParagraphText) {
                                    content.push({ type: 'text', text: currentParagraphText });
                                    currentParagraphText = '';
                                }
                                // Find the image rId
                                const blip = child['w:drawing'][0]?.['wp:inline']?.[0]?.['a:graphic']?.[0]?.['a:graphicData']?.[0]?.['pic:pic']?.[0]?.['pic:blipFill']?.[0]?.['a:blip']?.[0];
                                const rId = blip?.['@_r:embed'];
                                if (rId) {
                                    content.push({ type: 'image', rId });
                                }
                            }
                        }
                    }
                }
                 // Flush any remaining text in the paragraph
                if (currentParagraphText) {
                    content.push({ type: 'text', text: currentParagraphText });
                }
            }
        }
    }
    
    return { content, imageMap };
}


/**
 * Generates a new DOCX document from extracted content and adds a GOST-style footer.
 */
export async function generateDocxWithColontitul(
    docxBuffer: Buffer,
    docDetails: DocDetails
): Promise<Uint8Array> {
    logger.info(`[docProcessor] Processing DOCX in-memory. Doc code: ${docDetails.docCode}`);

    try {
        const { content, imageMap } = await extractContentFromDocx(docxBuffer);

        const docChildren: (Paragraph | Table)[] = [];
        for (const item of content) {
            if (item.type === 'text') {
                docChildren.push(new Paragraph({ text: item.text }));
            } else if (item.type === 'image' && imageMap.has(item.rId)) {
                const imageBuffer = imageMap.get(item.rId)!;
                docChildren.push(new Paragraph({
                    children: [new ImageRun({ data: imageBuffer, transformation: { width: 500, height: 300 } })], // Adjust size as needed
                    alignment: AlignmentType.CENTER
                }));
            }
        }

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
                new TableRow({ children: [ createCell("Изм.", colWidths[0], allBorders), createCell("Лист", colWidths[1], allBorders), createCell("№ докум.", colWidths[2], allBorders), createCell("Подп.", colWidths[3], allBorders), createCell("Дата", colWidths[4], allBorders), new TableCell({ children: [new Paragraph({ text: docDetails.docTitle, alignment: AlignmentType.CENTER, style: "p-large" })], rowSpan: 3, borders: allBorders, verticalAlign: VerticalAlign.CENTER }), createCell(docDetails.lit, colWidths[6], allBorders, [new Paragraph({ text: docDetails.lit, alignment: AlignmentType.CENTER, style: "p-large" })]), createCell("", colWidths[7], allBorders, [new Paragraph({ children: [new TextRun({ children: [PageNumber.CURRENT] })], alignment: AlignmentType.CENTER, style: "p-large" })]), createCell("", colWidths[8], allBorders, [new Paragraph({ children: [new TextRun({ children: [PageNumber.TOTAL_PAGES] })], alignment: AlignmentType.CENTER, style: "p-large" })]), ] }),
                new TableRow({ children: [ createCell("Разраб.", colWidths[0], allBorders), createCell(docDetails.razrab, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders), new TableCell({ children: docDetails.orgName.split('\n').map(line => new Paragraph({ text: line, alignment: AlignmentType.CENTER, style: "p-small"})), columnSpan: 3, borders: allBorders, verticalAlign: VerticalAlign.CENTER }), ] }),
                new TableRow({ children: [ createCell("Пров.", colWidths[0], allBorders), createCell(docDetails.prov, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Н. контр.", colWidths[0], allBorders), createCell(docDetails.nkontr, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
                new TableRow({ children: [ createCell("Утв.", colWidths[0], allBorders), createCell(docDetails.utv, colWidths[1], allBorders), createCell("", colWidths[2], allBorders), createCell("", colWidths[3], allBorders), createCell("", colWidths[4], allBorders) ] }),
            ],
        });

        const footer = new Footer({ children: [table] });

        const doc = new Document({
            styles: { paragraphStyles: [ { id: "p-small", name: "Small Text", basedOn: "Normal", next: "Normal", run: { size: 16 } }, { id: "p-large", name: "Large Text", basedOn: "Normal", next: "Normal", run: { size: 28 } }, { id: "p-large-bold", name: "Large Bold Text", basedOn: "Large Text", next: "Normal", run: { bold: true } }, ] },
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