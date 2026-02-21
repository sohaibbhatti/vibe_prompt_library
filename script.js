document.addEventListener('DOMContentLoaded', () => {
    const promptForm = document.getElementById('promptForm');
    const promptList = document.getElementById('promptList');
    const titleInput = document.getElementById('title');
    const modelInput = document.getElementById('model');
    const contentInput = document.getElementById('content');
    const sortBySelect = document.getElementById('sortBy');

    // Load prompts from localStorage
    let prompts = JSON.parse(localStorage.getItem('prompts')) || [];
    let userNotes = JSON.parse(localStorage.getItem('userNotes')) || [];

    // Export/Import Elements
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    // Export Handler
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const exportData = {
                version: 1,
                timestamp: new Date().toISOString(),
                stats: calculateStats(),
                prompts: prompts,
                userNotes: userNotes
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `prompt-library-export-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Import Handler
    if (importBtn) {
        importBtn.addEventListener('click', () => importFile.click());
    }

    if (importFile) {
        importFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    processImport(importedData);
                } catch (err) {
                    alert('Failed to parse JSON: ' + err.message);
                }
                event.target.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    function calculateStats() {
        if (!prompts.length) return { total: 0, averageRating: 0, mostUsedModel: 'N/A' };
        
        const total = prompts.length;
        const avgRating = prompts.reduce((sum, p) => sum + (p.userRating || 0), 0) / total;
        
        const modelCounts = {};
        prompts.forEach(p => {
            const m = p.metadata?.model || 'Unknown';
            modelCounts[m] = (modelCounts[m] || 0) + 1;
        });
        
        const sortedModels = Object.entries(modelCounts).sort((a,b) => b[1] - a[1]);
        const topModel = sortedModels.length > 0 ? sortedModels[0][0] : 'N/A';

        return {
            total,
            averageRating: avgRating.toFixed(2),
            mostUsedModel: topModel
        };
    }

    function processImport(data) {
        // Step 4: Validate
        if (!data.version || !Array.isArray(data.prompts)) {
            alert('Invalid import file format.');
            return;
        }

        // Step 5: Backup & Error Recovery
        const backupPrompts = JSON.stringify(prompts);
        const backupNotes = JSON.stringify(userNotes);

        try {
            const newPrompts = data.prompts;
            const newNotes = data.userNotes || [];
            
            let conflictCount = 0;
            const existingIds = new Set(prompts.map(p => p.id));
            
            newPrompts.forEach(p => {
                if (existingIds.has(p.id)) conflictCount++;
            });

            let mergeStrategy = 'keep_both';
            
            if (conflictCount > 0) {
                // Merge conflict resolution prompts
                const userChoice = confirm(`Found ${conflictCount} conflicting prompt IDs.\n\nClick OK to OVERWRITE existing prompts.\nClick Cancel to KEEP BOTH (import as new copies).`);
                mergeStrategy = userChoice ? 'overwrite' : 'keep_both';
            }

            let importedCount = 0;

            newPrompts.forEach(p => {
                const existingIndex = prompts.findIndex(existing => existing.id === p.id);
                
                if (existingIndex > -1) {
                    if (mergeStrategy === 'overwrite') {
                        prompts[existingIndex] = p;
                        // Update associated note
                        const newNote = newNotes.find(n => n.promptId === p.id);
                        if (newNote) {
                             const noteIndex = userNotes.findIndex(n => n.promptId === p.id);
                             if (noteIndex > -1) userNotes[noteIndex] = newNote;
                             else userNotes.push(newNote);
                        }
                    } else {
                        // Keep both: Create new ID
                        const oldId = p.id;
                        const newId = Date.now() + Math.floor(Math.random() * 100000); 
                        p.id = newId;
                        prompts.push(p);
                        
                        // Handle Note
                        const note = newNotes.find(n => n.promptId === oldId);
                        if (note) {
                            // Clone note with new ID
                            userNotes.push({
                                ...note,
                                promptId: newId
                            });
                        }
                    }
                } else {
                    prompts.push(p);
                    const note = newNotes.find(n => n.promptId === p.id);
                    if (note) userNotes.push(note);
                }
                importedCount++;
            });

            savePrompts();
            saveNotes();
            renderPrompts();
            alert(`Successfully imported ${importedCount} prompts!`);

        } catch (err) {
            console.error(err);
            // Rollback
            prompts = JSON.parse(backupPrompts);
            userNotes = JSON.parse(backupNotes);
            savePrompts(); // Restore storage
            saveNotes();
            renderPrompts();
            alert('Error during import. Changes reverted.\n' + err.message);
        }
    }

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
        const model = modelInput.value.trim();
        const content = contentInput.value.trim();

        if (title && content && model) {
            try {
                const metadata = trackModel(model, content);
                
                const newPrompt = {
                    id: Date.now(), // Simple unique ID
                    title: title,
                    content: content,
                    metadata: metadata, // Add metadata here
                    userRating: 0,
                    ratingCount: 0,
                    averageRating: 0,
                    createdAt: metadata.createdAt // Use metadata timestamp for consistency
                };

                prompts.push(newPrompt);
                savePrompts();
                renderPrompts();
                promptForm.reset();
            } catch (error) {
                alert(`Error creating prompt: ${error.message}`);
            }
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

            // Metadata HTML Generation
            let metadataHtml = '';
            if (prompt.metadata) {
                const { model, createdAt, updatedAt, tokenEstimate } = prompt.metadata;
                const formattedCreated = new Date(createdAt).toLocaleString();
                const formattedUpdated = updatedAt ? new Date(updatedAt).toLocaleString() : formattedCreated;
                
                let confidenceClass = 'token-high';
                if (tokenEstimate.confidence === 'medium') confidenceClass = 'token-medium';
                if (tokenEstimate.confidence === 'low') confidenceClass = 'token-low';

                metadataHtml = `
                    <div class="metadata-section">
                        <div class="metadata-item">
                            <span class="metadata-label">Model:</span>
                            <span class="metadata-value">${escapeHtml(model)}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Created:</span>
                            <span class="metadata-value">${formattedCreated}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Tokens:</span>
                            <span class="metadata-value token-badge ${confidenceClass}">
                                ${tokenEstimate.min}-${tokenEstimate.max} (${tokenEstimate.confidence})
                            </span>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="prompt-header">
                    <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
                    <div class="prompt-preview">${escapeHtml(preview)}</div>
                    ${metadataHtml}
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

    // Metadata Tracking System
    function estimateTokens(text, isCode = false) {
        if (!text) return { min: 0, max: 0, confidence: 'high' };
        
        // Simple heuristic: 
        // Words are split by spaces. 
        // Characters are length of string.
        const wordCount = text.trim().split(/\s+/).length;
        const charCount = text.length;
        
        let min = Math.ceil(0.75 * wordCount);
        let max = Math.ceil(0.25 * charCount);
        
        if (isCode) {
            min = Math.ceil(min * 1.3);
            max = Math.ceil(max * 1.3);
        }
        
        // Determine confidence based on average estimate size
        const avg = (min + max) / 2;
        let confidence = 'high';
        if (avg >= 1000 && avg <= 5000) {
            confidence = 'medium';
        } else if (avg > 5000) {
            confidence = 'low';
        }
        
        return {
            min,
            max,
            confidence
        };
    }

    function trackModel(modelName, content) {
        if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
            throw new Error('Model name must be a non-empty string.');
        }
        if (modelName.length > 100) {
            throw new Error('Model name must be less than 100 characters.');
        }

        const now = new Date().toISOString();
        
        // Check if content looks like code (simple heuristic)
        const isCode = /[{}[\];]/.test(content) || /\b(function|const|let|var|class|import|def|if|else|for|while)\b/.test(content);
        
        const tokenEstimate = estimateTokens(content, isCode);

        return {
            model: modelName.trim(),
            createdAt: now,
            updatedAt: now,
            tokenEstimate: tokenEstimate
        };
    }

    function updateTimestamps(metadata) {
        if (!metadata || !metadata.createdAt) {
             throw new Error('Invalid metadata object.');
        }
        
        const now = new Date().toISOString();
        
        // Validate createdAt is valid ISO string
        const createdDate = new Date(metadata.createdAt);
        if (isNaN(createdDate.getTime())) {
            throw new Error('Invalid createdAt timestamp.');
        }
        
        const updatedDate = new Date(now);
        
        if (updatedDate < createdDate) {
            throw new Error('updatedAt cannot be before createdAt.');
        }
        
        return {
            ...metadata,
            updatedAt: now
        };
    }
});