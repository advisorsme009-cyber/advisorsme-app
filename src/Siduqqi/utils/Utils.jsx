/**
 * Splits a PDF document into individual single-page PDF documents.
 *
 * @param {Uint8Array} pdfBytes - The byte array of the input PDF document.
 * @returns {Promise<Uint8Array[]>} A promise that resolves to an array of Uint8Array,
 * where each Uint8Array represents a single-page PDF.
 * @throws {Error} If there's an issue loading or processing the PDF.
 */
import { PDFDocument } from "pdf-lib";

export async function splitPdfIntoPages(pdfBytes) {
  try {
    // Load the original PDF document from the byte array
    const originalPdfDoc = await PDFDocument.load(pdfBytes);
    const numberOfPages = originalPdfDoc.getPageCount();
    const singlePagePdfs = [];

    // Loop through each page of the original PDF
    for (let i = 0; i < numberOfPages; i++) {
      // Create a new blank PDF document for the current page
      const newPdfDoc = await PDFDocument.create();

      // Copy the current page from the original PDF to the new PDF
      // The `copyPages` method returns an array of copied pages, so we take the first one.
      const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [i]);

      // Add the copied page to the new PDF document
      newPdfDoc.addPage(copiedPage);

      // Serialize the new single-page PDF document to a byte array
      const newPdfBytes = await newPdfDoc.save();

      // Add the byte array of the single-page PDF to our results array
      singlePagePdfs.push(newPdfBytes);
    }

    return singlePagePdfs;
  } catch (error) {
    console.error("Error splitting PDF:", error);
    throw new Error("Failed to split PDF into pages. " + error.message);
  }
}
