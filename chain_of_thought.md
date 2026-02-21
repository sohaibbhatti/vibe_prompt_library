Let's build a complete export/import system step by step.

Step 1: First, analyze what data we need to export:

- All prompts with their metadata

Step 2: Design the export JSON schema that includes:

- Version number for future compatibility
- Export timestamp
- Statistics (total prompts, average rating, most used model)
- Complete prompts array

Step 3: Create the export function that:

- Gathers all data from localStorage
- Validates data integrity
- Creates a blob and triggers download with timestamp

Step 4: Create the import function that:

- Reads the uploaded file
- Validates the JSON structure and version
- Checks for duplicate IDs
- Merges or replaces existing data based on user choice

Step 5: Add error recovery:

- Backup existing data before import
- Rollback on failure
- Provide detailed error messages

Add the import and export buttons and merge conflict resolution prompts

Implement this complete system with all steps. Think step by step.
