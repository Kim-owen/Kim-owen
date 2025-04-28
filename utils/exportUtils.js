const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

function generateCSV(transactions) {
    const header = ['ID', 'User', 'Plan', 'Amount (USDT)', 'Status', 'Created At'];
    const rows = transactions.map(tx => [
        tx._id.toString(),
        tx.userId ? tx.userId.phoneNumber : 'Unknown',
        tx.dataPlan ? tx.dataPlan.name : 'N/A',
        tx.amount.crypto,
        tx.status,
        new Date(tx.createdAt).toLocaleString()
    ]);

    return [header, ...rows].map(row => row.join(',')).join('\n');
}

function generateExcel(transactions) {
    const data = transactions.map(tx => ({
        ID: tx._id.toString(),
        User: tx.userId ? tx.userId.phoneNumber : 'Unknown',
        Plan: tx.dataPlan ? tx.dataPlan.name : 'N/A',
        'Amount (USDT)': tx.amount.crypto,
        Status: tx.status,
        'Created At': new Date(tx.createdAt).toLocaleString()
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function generatePDF(transactions) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Title
            doc.fontSize(20).text('Transaction Report', { align: 'center' });
            doc.moveDown();

            // Add timestamp
            doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
            doc.moveDown();

            // Table headers
            const headers = ['ID', 'User', 'Plan', 'Amount (USDT)', 'Status', 'Created At'];
            let y = doc.y;
            
            // Draw header background
            doc.rect(50, y - 5, 500, 20).fill('#f3f4f6');
            
            // Draw headers
            headers.forEach((header, i) => {
                doc.fontSize(10)
                   .fillColor('#000')
                   .text(header, 50 + (i * 83), y, { width: 83, align: 'center' });
            });

            y += 20;

            // Table rows
            transactions.forEach(tx => {
                const row = [
                    tx._id.toString().substring(0, 8) + '...',
                    tx.userId ? tx.userId.phoneNumber : 'Unknown',
                    tx.dataPlan ? tx.dataPlan.name : 'N/A',
                    tx.amount.crypto,
                    tx.status,
                    new Date(tx.createdAt).toLocaleString()
                ];

                // Draw row background (alternating)
                if ((y - 70) / 20 % 2 === 0) {
                    doc.rect(50, y - 5, 500, 20).fill('#ffffff');
                } else {
                    doc.rect(50, y - 5, 500, 20).fill('#f9fafb');
                }

                // Draw row data
                row.forEach((cell, i) => {
                    doc.fontSize(8)
                       .fillColor('#000')
                       .text(cell.toString(), 50 + (i * 83), y, { 
                           width: 83, 
                           align: 'center',
                           lineBreak: false,
                           ellipsis: true
                       });
                });

                y += 20;

                // Add new page if needed
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateCSV,
    generateExcel,
    generatePDF
};
