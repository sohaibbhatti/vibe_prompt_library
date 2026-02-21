document.addEventListener('DOMContentLoaded', () => {
    const promptForm = document.getElementById('promptForm');
    const promptList = document.getElementById('promptList');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const sortBySelect = document.getElementById('sortBy');

    // Load prompts from localStorage
    let prompts = JSON.parse(localStorage.getItem('prompts')) || [];
    let userNotes = JSON.parse(localStorage.getItem('userNotes')) || [];

    // Initial Render
    renderPrompts();

    // Handle Sorting
    if (sortBySelect) {
        sortBySelect.addEventListener('change', renderPrompts);
    }

    // Handle Form Submission
    promptForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (title && content) {
            const newPrompt = {
                id: Date.now(), // Simple unique ID
                title: title,
                content: content,
                userRating: 0,
                ratingCount: 0,
                averageRating: 0,
                createdAt: new Date().toISOString()
            };

            prompts.push(newPrompt);
            savePrompts();
            renderPrompts();
            promptForm.reset();
        }
    });

    // Rate Prompt Function
    window.ratePrompt = (id, rating) => {
        const prompt = prompts.find(p => p.id === id);
        if (prompt) {
            // Only increment count if this is a first-time rating
            if (!prompt.userRating) {
                prompt.ratingCount = (prompt.ratingCount || 0) + 1;
            }
            prompt.userRating = rating;
            // Since single user, average is just the user's rating
            prompt.averageRating = rating; 
            savePrompts();
            renderPrompts();
        }
    };

    // Note Functions
    window.saveNote = (promptId) => {
        const textarea = document.getElementById(`note-input-${promptId}`);
        const content = textarea.value.trim();
        const statusSpan = document.getElementById(`note-status-${promptId}`);
        const deleteBtn = document.getElementById(`delete-note-btn-${promptId}`);

        if (!content) return; // Prevent saving empty strings

        const existingNoteIndex = userNotes.findIndex(n => n.promptId === promptId);
        
        if (existingNoteIndex > -1) {
            userNotes[existingNoteIndex].noteContent = content;
            userNotes[existingNoteIndex].lastUpdated = Date.now();
        } else {
            userNotes.push({
                promptId: promptId,
                noteContent: content,
                lastUpdated: Date.now()
            });
        }

        saveNotes();
        
        // Show Saved! message
        statusSpan.textContent = 'Saved!';
        statusSpan.classList.add('visible');
        setTimeout(() => {
            statusSpan.classList.remove('visible');
        }, 2000);

        // Show delete button
        deleteBtn.style.display = 'inline-block';
    };

    window.deleteNote = (promptId) => {
        const textarea = document.getElementById(`note-input-${promptId}`);
        const deleteBtn = document.getElementById(`delete-note-btn-${promptId}`);
        
        userNotes = userNotes.filter(n => n.promptId !== promptId);
        saveNotes();

        textarea.value = '';
        deleteBtn.style.display = 'none';
    };

    function saveNotes() {
        localStorage.setItem('userNotes', JSON.stringify(userNotes));
    }

    // Star Hover Effects
    window.highlightStars = (id, rating) => {
        const container = document.getElementById(`rating-${id}`);
        const stars = container.querySelectorAll('.star');
        stars.forEach((star, index) => {
            const value = index + 1;
            if (value <= rating) {
                star.classList.add('filled');
            } else {
                star.classList.remove('filled');
            }
        });
    };

    window.resetStars = (id) => {
        const prompt = prompts.find(p => p.id === id);
        if (prompt) {
            const rating = prompt.userRating || 0;
            const container = document.getElementById(`rating-${id}`);
            // Check if container exists (it might not if deleted/re-rendered quickly, though unlikely here)
            if (container) {
                const stars = container.querySelectorAll('.star');
                stars.forEach((star, index) => {
                    const value = index + 1;
                    if (value <= rating) {
                        star.classList.add('filled');
                    } else {
                        star.classList.remove('filled');
                    }
                });
            }
        }
    };

    // Delete Prompt Function
    window.deletePrompt = (id) => {
        if (confirm('Are you sure you want to delete this prompt?')) {
            prompts = prompts.filter(prompt => prompt.id !== id);
            savePrompts();
            renderPrompts();
        }
    };

    // Save to LocalStorage
    function savePrompts() {
        localStorage.setItem('prompts', JSON.stringify(prompts));
    }

    // Render Prompts to DOM
    function renderPrompts() {
        promptList.innerHTML = '';

        if (prompts.length === 0) {
            promptList.innerHTML = '<div class="empty-state">No prompts saved yet. Add one above!</div>';
            return;
        }

        // Sort Prompts
        const sortBy = sortBySelect ? sortBySelect.value : 'newest';
        const sortedPrompts = [...prompts].sort((a, b) => {
            if (sortBy === 'rating') {
                // Secondary sort by date if ratings equal
                return ((b.userRating || 0) - (a.userRating || 0)) || (b.id - a.id);
            }
            return b.id - a.id;
        });

        sortedPrompts.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            // Create preview (first 100 chars)
            const preview = prompt.content.length > 100 
                ? prompt.content.substring(0, 100) + '...' 
                : prompt.content;

            // Generate Star Rating HTML
            let starsHtml = '';
            const currentRating = prompt.userRating || 0;
            for (let i = 1; i <= 5; i++) {
                const isFilled = currentRating >= i ? 'filled' : '';
                starsHtml += `<span class="star ${isFilled}" 
                                   onclick="ratePrompt(${prompt.id}, ${i})"
                                   onmouseover="highlightStars(${prompt.id}, ${i})">★</span>`;
            }

            // Check for existing note
            const existingNote = userNotes.find(n => n.promptId === prompt.id);
            const noteContent = existingNote ? existingNote.noteContent : '';
            const hasNote = !!existingNote;

            card.innerHTML = `
                <div class="prompt-header">
                    <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
                    <div class="prompt-preview">${escapeHtml(preview)}</div>
                    <div class="star-rating" id="rating-${prompt.id}" onmouseleave="resetStars(${prompt.id})">
                        ${starsHtml}
                        <span class="rating-text">(${prompt.ratingCount || 0})</span>
                    </div>
                </div>
                
                <div class="prompt-notes-section">
                    <textarea id="note-input-${prompt.id}" placeholder="Add your notes here...">${escapeHtml(noteContent)}</textarea>
                    <div class="note-actions">
                        <span id="note-status-${prompt.id}" class="note-status">Saved!</span>
                        <button class="btn-save-note" onclick="saveNote(${prompt.id})">Save Note</button>
                        <button class="btn-delete-note" id="delete-note-btn-${prompt.id}" onclick="deleteNote(${prompt.id})" style="${hasNote ? '' : 'display:none'}">Delete Note</button>
                    </div>
                </div>

                <div class="prompt-actions">
                    <button class="btn-delete" onclick="deletePrompt(${prompt.id})">Delete</button>
                </div>
            `;

            promptList.appendChild(card);
        });
    }

    // Utility to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});