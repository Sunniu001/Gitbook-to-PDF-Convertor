const gitbookUrl = document.getElementById('gitbookUrl');
const convertBtn = document.getElementById('convertBtn');
const statusSection = document.getElementById('statusSection');
const progressBar = document.getElementById('progressBar');
const percentage = document.getElementById('percentage');
const statusTitle = document.getElementById('statusTitle');
const currentUrl = document.getElementById('currentUrl');
const pageCount = document.getElementById('pageCount');
const logs = document.getElementById('logs');
const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');

convertBtn.addEventListener('click', async () => {
    const url = gitbookUrl.value.trim();
    if (!url) return alert('Please enter a Gitbook URL');

    // Reset UI
    convertBtn.disabled = true;
    statusSection.classList.remove('hidden');
    downloadSection.classList.add('hidden');
    logs.innerHTML = '';
    progressBar.style.width = '0%';
    percentage.innerText = '0%';
    statusTitle.innerText = 'Analyzing Sitemap...';
    currentUrl.innerText = 'Fetching pages...';
    pageCount.innerText = '0 / 0';

    try {
        const response = await fetch(`/api/sitemap?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const urls = data.urls;
        statusTitle.innerText = 'Converting Pages...';
        pageCount.innerText = `0 / ${urls.length}`;

        const pdfBuffers = [];

        for (let i = 0; i < urls.length; i++) {
            const pageUrl = urls[i];
            const percent = Math.round(((i) / urls.length) * 100);
            progressBar.style.width = `${percent}%`;
            percentage.innerText = `${percent}%`;
            pageCount.innerText = `${i} / ${urls.length}`;
            currentUrl.innerText = `Processing: ${pageUrl}`;

            addLog(`Converting: ${pageUrl.split('/').pop() || 'index'}`);

            try {
                const pdfRes = await fetch(`/api/convert?url=${encodeURIComponent(pageUrl)}`);
                if (!pdfRes.ok) throw new Error(`Failed to convert ${pageUrl}`);
                const buffer = await pdfRes.arrayBuffer();
                pdfBuffers.push(buffer);
            } catch (err) {
                addLog(`Error: ${err.message}`, 'error');
            }
        }

        // Final Progress
        progressBar.style.width = '95%';
        percentage.innerText = '95%';
        statusTitle.innerText = 'Merging PDF Pages...';
        currentUrl.innerText = 'Combining all pages in your browser...';

        const mergedPdf = await PDFLib.PDFDocument.create();
        for (const buffer of pdfBuffers) {
            const pdf = await PDFLib.PDFDocument.load(buffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((p) => mergedPdf.addPage(p));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);

        progressBar.style.width = '100%';
        percentage.innerText = '100%';
        statusTitle.innerText = 'Conversion Complete!';
        currentUrl.innerText = 'Your PDF is ready for download.';
        
        downloadSection.classList.remove('hidden');
        downloadBtn.href = downloadUrl;
        downloadBtn.download = 'gitbook_complete.pdf';
        convertBtn.disabled = false;

    } catch (error) {
        alert('Error: ' + error.message);
        convertBtn.disabled = false;
        statusTitle.innerText = 'Conversion Failed';
    }
});

function addLog(message, type = 'success') {
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `
        <span>${message}</span>
        <span class="time">${new Date().toLocaleTimeString()}</span>
    `;
    logs.prepend(logItem);
}
