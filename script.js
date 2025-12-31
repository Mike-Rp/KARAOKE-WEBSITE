// ========== CONFIGURATION ==========
const YOUTUBE_API_KEY = 'AIzaSyDX0lOX4hkHIojC2Br8NjxUzMkd6OPDiF8';

// ========== STATE ==========
let player;
let queue = [];
let playedVideos = [];
let currentVideoId = null;

// ========== TOAST NOTIFICATION SYSTEM ==========
function showToast(title, message = '', type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-warning',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========== YOUTUBE PLAYER INITIALIZATION ==========
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'showinfo': 0
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

// ========== PLAYER EVENT HANDLER ==========
function onPlayerStateChange(event) {
    // When video ends (state 0), play next in queue
    if (event.data === YT.PlayerState.ENDED) {
        playNextInQueue();
    }
}

// ========== SEARCH FUNCTION ==========
async function searchVideos() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showToast('Search Required', 'Please enter a song name or artist', 'warning');
        return;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.error) {
            showToast('API Error', data.error.message, 'error');
            return;
        }

        displaySearchResults(data.items);
        showToast('Search Complete', `Found ${data.items.length} results`, 'success');
    } catch (error) {
        showToast('Search Error', error.message, 'error');
    }
}

// ========== DISPLAY SEARCH RESULTS WITH THUMBNAILS ==========
function displaySearchResults(videos) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (!videos || videos.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i> No results found</div>';
        return;
    }

    resultsDiv.innerHTML = videos.map(video => {
        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const thumbnail = video.snippet.thumbnails.default.url;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        return `
            <div class="video-item">
                <div class="video-thumbnail">
                    <img src="${thumbnail}" alt="${title}">
                </div>
                <div class="video-info">
                    <div class="video-title">${title}</div>
                    <div class="video-actions">
                        <button class="small-btn" onclick="addToQueue('${videoId}', \`${title.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`)">
                            <i class="fas fa-plus"></i> Add
                        </button>
                        <button class="small-btn" onclick="copyLink('${videoUrl}')">
                            <i class="fas fa-copy"></i> Link
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== ADD TO QUEUE ==========
function addToQueue(videoId, title) {
    queue.push({ videoId, title });
    updateQueueDisplay();

    // If nothing is playing, start playing immediately
    if (!currentVideoId) {
        playNextInQueue();
    }
    showToast('Added to Queue', title, 'success');
}

// ========== UPDATE QUEUE DISPLAY ==========
function updateQueueDisplay() {
    const queueDiv = document.getElementById('queueList');
    const queueCount = document.getElementById('queueCount');
    
    queueCount.textContent = queue.length;

    if (queue.length === 0) {
        queueDiv.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i> Queue is empty</div>';
        return;
    }

    queueDiv.innerHTML = queue.map((item, index) => `
        <div class="queue-item">
            <div class="queue-number">${index + 1}</div>
            <div class="queue-content">
                <div class="video-title">${item.title}</div>
            </div>
            <button class="queue-remove" onclick="removeFromQueue(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// ========== REMOVE FROM QUEUE ==========
function removeFromQueue(index) {
    const title = queue[index].title;
    queue.splice(index, 1);
    updateQueueDisplay();
    showToast('Removed from Queue', title, 'info');
}

// ========== PLAY NEXT IN QUEUE ==========
function playNextInQueue() {
    if (queue.length === 0) {
        currentVideoId = null;
        showToast('Queue Empty', 'No more songs in queue', 'info');
        return;
    }

    const nextVideo = queue.shift();
    if (currentVideoId) {
        playedVideos.push(currentVideoId);
    }
    currentVideoId = nextVideo.videoId;
    
    player.loadVideoById(nextVideo.videoId);
    updateQueueDisplay();
    showToast('Now Playing', nextVideo.title, 'info');
}

// ========== COPY LINK ==========
function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('Copied', 'Link copied to clipboard', 'success');
    }).catch(err => {
        showToast('Copy Failed', 'Could not copy to clipboard', 'error');
    });
}

// ========== PASTE YOUTUBE LINK ==========
async function pasteYouTubeLink() {
    try {
        const text = await navigator.clipboard.readText();
        const videoId = extractVideoId(text);
        
        if (!videoId) {
            showToast('Invalid URL', 'Please copy a valid YouTube video link', 'error');
            return;
        }

        // Fetch video details
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
            );
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const title = data.items[0].snippet.title;
                addToQueue(videoId, title);
            } else {
                showToast('Error', 'Could not fetch video details', 'error');
            }
        } catch (error) {
            showToast('Error', 'Failed to fetch video information', 'error');
        }
    } catch (err) {
        showToast('Permission Denied', 'Allow clipboard access to paste links', 'error');
    }
}

// ========== EXTRACT VIDEO ID FROM URL ==========
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// ========== PLAY PREVIOUS VIDEO ==========
function playPrevious() {
    if (playedVideos.length === 0) {
        showToast('No Previous Video', 'You are at the beginning', 'info');
        return;
    }

    if (currentVideoId) {
        queue.unshift({ videoId: currentVideoId, title: 'Current Video' });
    }

    const previousVideoId = playedVideos.pop();
    currentVideoId = previousVideoId;
    
    player.loadVideoById(previousVideoId);
    updateQueueDisplay();
    showToast('Playing Previous', 'Going back to last video', 'info');
}

// ========== ENTER KEY SEARCH ==========
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchVideos();
        }
    });
});