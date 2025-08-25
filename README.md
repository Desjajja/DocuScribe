# DocuScribe

Docuscribe is a Next.js application designed for scraping, managing, and organizing web documentation. It leverages AI-powered flows for tasks like hashtag generation and content parsing.

## Features

- **Web Scraping**: Extracts documentation from websites, following links to compile structured content.
- **AI Integration**: Generates hashtags and summaries using AI providers.
- **Document Management**: Allows users to rename, delete, schedule updates, and export documentation.
- **Scheduling**: Supports daily, weekly, and monthly update schedules for automated scraping.
- **Library View**: Browse and search scraped documentation with filters and detailed views.
- **Customizable UI Components**: Includes reusable components like buttons, dialogs, and schedule selectors.

## Project Structure

- `src/app/`: Contains Next.js pages and API routes.
  - `page.tsx`: Main scraper interface.
  - `library/page.tsx`: Documentation library view.
  - `schedule/page.tsx`: Scheduled tasks management.
- `src/components/`: Reusable UI components.
  - `ui/`: Includes buttons, dialogs, inputs, and more.
  - `schedule/`: Contains the `ScheduleSelect` component.
- `src/lib/`: Shared utilities and types.
  - `db.ts`: Database entity definitions.
  - `content.ts`: Markdown section parsing helpers.
  - `utils.ts`: Utility functions like class merging and numeric validation.
- `src/state/`: Global state management for scraping jobs.
- `scripts/`: Test scripts for scraping logic.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Notes

- The application uses SQLite for local data storage.
- AI flows are powered by Genkit.
- TailwindCSS is used for styling.

For more details, explore the codebase starting with `src/app/page.tsx`. Contributions and feedback are welcome!
