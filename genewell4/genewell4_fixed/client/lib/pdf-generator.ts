import { Product } from "./products";

export const generatePDFContent = (product: Product): string => {
  // Convert markdown-like content to HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${product.name}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 900px;
          margin: 40px;
          background: white;
        }
        h1 { color: #2d3748; font-size: 28px; margin-top: 30px; margin-bottom: 10px; }
        h2 { color: #4a5568; font-size: 22px; margin-top: 25px; margin-bottom: 10px; }
        h3 { color: #718096; font-size: 18px; margin-top: 15px; margin-bottom: 8px; }
        p { margin: 10px 0; }
        ul { margin: 10px 0; padding-left: 25px; }
        li { margin: 5px 0; }
        .header { border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin: 20px 0; }
        .highlight { background-color: #f0f4ff; padding: 10px 15px; border-left: 4px solid #667eea; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f0f4ff; font-weight: bold; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧬 Genewell Personalized Health Guide</h1>
        <h2>${product.name}</h2>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Valid Until:</strong> ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
      </div>

      <div class="section">
        ${product.pdfContent}
      </div>

      <div class="footer">
        <p><strong>Genewell Health © 2026</strong></p>
        <p>This guide is personalized to your profile and should be used in conjunction with professional medical advice.</p>
        <p>For questions or support, contact us at support@genewell.com</p>
        <p>This document is for personal use only and cannot be shared or resold without permission.</p>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
};

export const downloadPDF = (content: string, filename: string) => {
  // Create a blob from the HTML content
  const blob = new Blob([content], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  // Create a temporary link and trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadAsText = (content: string, filename: string) => {
  // Remove HTML tags for text version
  const textContent = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const blob = new Blob([textContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(".pdf", ".txt");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
