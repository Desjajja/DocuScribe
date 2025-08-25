// Simple global in-memory store for scraping jobs to persist across page navigations
// (lightweight alternative to more complex state managers)

export type Schedule = 'none' | 'daily' | 'weekly' | 'monthly';

export interface ScrapeDocumentMeta {
  id?: number;
  title?: string;
  url?: string;
}

export type JobStatus = 'scraping' | 'generating_hashtags' | 'complete' | 'failed';

export interface Job {
  id: string;
  url: string;
  maxPages: number;
  status: JobStatus;
  progress: number; // 0-100
  message: string;
  result?: any; // final document (optional shape)
  error?: string;
  isUpdate: boolean;
  updateId?: number;
  schedule: Schedule;
  existingTitle?: string;
  provider?: string; // AI provider key (e.g., 'gemini', 'deepseek')
}

type Listener = (jobs: Job[]) => void;

const state: { jobs: Job[] } = {
  jobs: [],
};

const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  // Emit current state immediately
  listener(state.jobs);
  return () => listeners.delete(listener);
}

function notify() {
  for (const l of listeners) l(state.jobs);
}

export function getJobs() {
  return state.jobs;
}

export function setJobs(updater: Job[] | ((prev: Job[]) => Job[])) {
  state.jobs = typeof updater === 'function' ? (updater as (p: Job[]) => Job[])(state.jobs) : updater;
  notify();
  // Persist lightweight version to localStorage (omit heavy content)
  try {
    const toStore = state.jobs.map(j => ({
      ...j,
      result: j.result ? { ...j.result, content: undefined } : undefined,
    }));
    if (typeof window !== 'undefined') {
      localStorage.setItem('docuscribe:scrapeJobs', JSON.stringify(toStore));
    }
  } catch {}
}

export function updateJob(id: string, updates: Partial<Job>) {
  setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...updates } : j)));
}

let initialized = false;
export function initJobsFromStorage() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const raw = localStorage.getItem('docuscribe:scrapeJobs');
    if (raw) {
      const parsed = JSON.parse(raw) as Job[];
      state.jobs = parsed;
      notify();
    }
  } catch {}
}

export function clearJobs() {
  state.jobs = [];
  notify();
  try { if (typeof window !== 'undefined') localStorage.removeItem('docuscribe:scrapeJobs'); } catch {}
}
