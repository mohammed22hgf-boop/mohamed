
// These are global variables from the scripts loaded in index.html
declare const html2canvas: any;
declare const jspdf: any;

/**
 * Generates a PDF from a DOM element.
 * @param elementId The ID of the element to capture.
 * @param filename The desired filename for the downloaded PDF.
 */
const generatePDFFromElement = async (elementId: string, filename: string): Promise<void> => {
  const { jsPDF } = jspdf;

  // Wait for fonts to be fully loaded to ensure they are rendered correctly in the canvas.
  await document.fonts.ready;
  
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id #${elementId} not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Use a higher scale for better quality
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const canvasAspectRatio = canvasWidth / canvasHeight;

    // Calculate the width and height of the image in the PDF to fit the A4 page with some margin
    let imgWidth = pdfWidth - 20; // 10mm margin on each side
    let imgHeight = imgWidth / canvasAspectRatio;

    // If height is still too large, scale based on height
    if (imgHeight > pdfHeight - 20) { // 10mm margin on top/bottom
      imgHeight = pdfHeight - 20;
      imgWidth = imgHeight * canvasAspectRatio;
    }

    const xOffset = (pdfWidth - imgWidth) / 2;
    const yOffset = 10; // 10mm top margin

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
    pdf.save(filename);

  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error; // Re-throw to be caught in the component
  }
};

export default generatePDFFromElement;
