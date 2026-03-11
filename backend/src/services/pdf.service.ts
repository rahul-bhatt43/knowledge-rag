import PDFDocument from "pdfkit";

export interface PDFSummaryData {
    title: string;
    date: string;
    duration: string;
    speakers: number;
    sentiment: string;
    sentimentScore: number;
    keyTopics: string[];
    actionItems: string[];
    transcript: string;
}

export function generateMeetingSummaryPdf(data: PDFSummaryData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: Buffer[] = [];

            doc.on("data", (chunk) => buffers.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(buffers)));

            // ─── Header ───────────────────────────────────────────────────────
            doc.fontSize(24).font("Helvetica-Bold").text("Meeting Analytics Report");
            doc.moveDown(0.5);

            doc.fontSize(12).font("Helvetica").fillColor("gray");
            doc.text(`Meeting: ${data.title}`);
            doc.text(`Generated: ${data.date}`);
            doc.text(`Duration: ${data.duration} | Speakers: ${data.speakers}`);
            doc.moveDown(2);

            // ─── AI Analytics ─────────────────────────────────────────────────
            doc.fillColor("black").fontSize(18).font("Helvetica-Bold").text("AI Analysis", { underline: true });
            doc.moveDown();

            // Sentiment
            doc.fontSize(14).font("Helvetica-Bold").text("Overall Sentiment:");
            const sentimentColor =
                data.sentiment === "positive" ? "green" :
                    data.sentiment === "negative" ? "red" : "black";
            doc.fontSize(12).font("Helvetica").fillColor(sentimentColor)
                .text(`${data.sentiment.toUpperCase()} (Score: ${(data.sentimentScore * 100).toFixed(0)}%)`);
            doc.fillColor("black");
            doc.moveDown();

            // Key Topics
            doc.fontSize(14).font("Helvetica-Bold").text("Key Discussion Topics:");
            doc.moveDown(0.5);
            doc.fontSize(12).font("Helvetica");
            if (data.keyTopics.length > 0) {
                data.keyTopics.forEach((topic) => {
                    doc.text(`• ${topic}`);
                });
            } else {
                doc.text("No specific topics identified.");
            }
            doc.moveDown();

            // Action Items
            doc.fontSize(14).font("Helvetica-Bold").text("Action Items:");
            doc.moveDown(0.5);
            if (data.actionItems.length > 0) {
                data.actionItems.forEach((action) => {
                    doc.text(`[ ] ${action}`);
                });
            } else {
                doc.text("No action items identified.");
            }
            doc.moveDown(2);

            // ─── Full Transcript ──────────────────────────────────────────────
            doc.addPage();
            doc.fontSize(18).font("Helvetica-Bold").text("Full Transcript", { underline: true });
            doc.moveDown();

            doc.fontSize(10).font("Helvetica").text(data.transcript, {
                lineGap: 4,
            });

            // ─── Finalize ─────────────────────────────────────────────────────
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}
