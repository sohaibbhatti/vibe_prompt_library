document.addEventListener('DOMContentLoaded', () => {
    const promptForm = document.getElementById('promptForm');
    const promptList = document.getElementById('promptList');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');

    // Load prompts from localStorage
    let prompts = JSON.parse(localStorage.getItem('prompts')) || [];

    // Initial Render
    renderPrompts();

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
                createdAt: new Date().toISOString()
            };

            prompts.push(newPrompt);
            savePrompts();
            renderPrompts();
            promptForm.reset();
        }
    });

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

        // Sort by newest first
        const sortedPrompts = [...prompts].sort((a, b) => b.id - a.id);

        sortedPrompts.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            // Create preview (first 100 chars)
            const preview = prompt.content.length > 100 
                ? prompt.content.substring(0, 100) + '...' 
                : prompt.content;

            card.innerHTML = `
                <div class="prompt-header">
                    <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
                    <div class="prompt-preview">${escapeHtml(preview)}</div>
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