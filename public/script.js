const socket = io();

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

convertBtn.addEventListener('click', () => {
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

    socket.emit('start-conversion', { url });
});

socket.on('conversion-progress', (data) => {
    if (data.type === 'start') {
        statusTitle.innerText = 'Converting Pages...';
        pageCount.innerText = `0 / ${data.total}`;
    } else if (data.type === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        progressBar.style.width = `${percent}%`;
        percentage.innerText = `${percent}%`;
        pageCount.innerText = `${data.current} / ${data.total}`;
        currentUrl.innerText = `Processing: ${data.url}`;

        const logItem = document.createElement('div');
        logItem.className = 'log-item success';
        logItem.innerHTML = `
            <span>Converted: ${data.url.split('/').pop() || 'index'}</span>
            <span class="time">${new Date().toLocaleTimeString()}</span>
        `;
        logs.prepend(logItem);
    } else if (data.type === 'merging') {
        statusTitle.innerText = 'Merging PDF Pages...';
        currentUrl.innerText = 'Combining all pages into a single document...';
        progressBar.style.width = '95%';
    } else if (data.type === 'done') {
        progressBar.style.width = '100%';
        percentage.innerText = '100%';
        statusTitle.innerText = 'Conversion Complete!';
        currentUrl.innerText = 'Your PDF is ready for download.';
        
        downloadSection.classList.remove('hidden');
        downloadBtn.href = `/downloads/${data.jobId}/complete_gitbook.pdf`;
        convertBtn.disabled = false;
    }
});

socket.on('conversion-error', (data) => {
    alert('Error: ' + data.message);
    convertBtn.disabled = false;
    statusTitle.innerText = 'Conversion Failed';
});
