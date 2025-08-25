'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { scrapeUrl } from '@/ai/flows/scrape-url-flow';
import { generateHashtags } from '@/ai/flows/generate-hashtags-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDocument, getDocumentByUrl, updateDocument, getDocuments } from '@/app/actions';
import { subscribe, getJobs as storeGetJobs, setJobs as storeSetJobs, updateJob as storeUpdateJob, clearJobs, Job as StoreJob, initJobsFromStorage } from '@/state/scrapeJobsStore';

type Schedule = 'none' | 'daily' | 'weekly' | 'monthly';

type Document = {
  id: number;
  title: string;
  url:string;
  content: string;
  image: string;
  aiHint: string;
  hashtags: string[];
  lastUpdated: string;
  schedule: Schedule;
  maxPages: number;
};

type Job = StoreJob & { result?: Document }; // extend for typed result

export default function ScraperPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('5');
  const [schedule, setSchedule] = useState<Schedule>('none');
  // Helper to fetch current provider (global config) on demand
  const getCurrentProvider = () => {
    try { return localStorage.getItem('docuscribe:provider') || 'gemini'; } catch { return 'gemini'; }
  };
  const [jobs, setJobs] = useState<Job[]>(() => storeGetJobs() as Job[]);
  const [docToUpdate, setDocToUpdate] = useState<Document | null>(null);
  const [updateMaxPages, setUpdateMaxPages] = useState('5');
  
  const processedUrlParams = useRef(false);
  const LOCAL_STORAGE_KEY = 'docuscribe:scrapeJobs';

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    storeUpdateJob(id, updates);
  }, []);

  // Subscribe to global store changes
  useEffect(() => {
  // Initialize jobs from storage only after client mounts to avoid hydration diff
  initJobsFromStorage();
    const unsubscribe = subscribe((jobs) => setJobs(jobs as Job[]));
    return () => { unsubscribe && unsubscribe(); };
  }, []);

  // Rehydrate jobs from localStorage on mount
  // Remove now-unused local persistence effects (handled in store)

  const runJob = useCallback(async (job: Job) => {
    try {
      updateJob(job.id, { status: 'scraping', progress: 10, message: 'Fetching and parsing content...' });
      
      const results = await scrapeUrl({
        startUrl: job.url,
        maxPages: job.maxPages,
        existingTitle: job.existingTitle,
      });

      if (results.length === 0) {
        throw new Error("Could not find any content at the specified URL.");
      }
      
  const documentation = results[0];
  updateJob(job.id, { status: 'scraping', progress: 50, message: 'Content parsed successfully.' });
      
  updateJob(job.id, { status: 'generating_hashtags', progress: 75, message: 'Generating AI hashtags...' });
  const contentSample = documentation.content.substring(0, 4000);
  // Ensure job has provider captured at execution time if missing (legacy jobs)
  if (!job.provider) {
    const p = getCurrentProvider();
    updateJob(job.id, { provider: p });
    job.provider = p;
  }
  const hashtagResult = await generateHashtags({ content: contentSample, url: documentation.url, provider: job.provider });

      const docData = {
        url: documentation.url,
        title: documentation.title,
        content: documentation.content,
        image: documentation.image || 'https://placehold.co/600x400.png',
        aiHint: 'web documentation',
        hashtags: hashtagResult.hashtags,
        lastUpdated: new Date().toISOString(),
        schedule: job.schedule,
        maxPages: job.maxPages,
      };

      let finalDoc: Document;

      if (job.isUpdate && job.updateId) {
        const existingDoc = (await getDocuments()).find(d => d.id === job.updateId);
        const docToUpdate: Document = { ...docData, id: job.updateId, schedule: existingDoc?.schedule ?? 'none', maxPages: existingDoc?.maxPages ?? 5 }; // Retain existing schedule on manual update
        await updateDocument(docToUpdate);
        finalDoc = docToUpdate;
      } else {
        const newId = await addDocument(docData);
        finalDoc = { ...docData, id: newId };
      }
      
      updateJob(job.id, { 
        status: 'complete', 
        progress: 100, 
  message: job.isUpdate ? 'Update complete!' : 'Documentation complete!',
        result: finalDoc
      });

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateJob(job.id, { status: 'failed', progress: 100, message: 'Scraping failed.', error: errorMessage });
    }
  }, [updateJob]);


  useEffect(() => {
    if (processedUrlParams.current) return;
  
    const updateUrl = searchParams.get('updateUrl');
    const updateId = searchParams.get('updateId');
    const maxPagesParam = searchParams.get('maxPages');
    const existingTitleParam = searchParams.get('existingTitle');
  
    if (updateUrl && updateId && maxPagesParam) {
      processedUrlParams.current = true;
  
      const job: Job = {
        id: `${Date.now()}-${Math.random()}-${updateUrl}`,
        url: updateUrl,
        maxPages: parseInt(maxPagesParam, 10),
        status: 'scraping',
        progress: 0,
        message: 'Initializing update...',
        isUpdate: true,
        updateId: parseInt(updateId, 10),
        schedule: 'none',
        existingTitle: existingTitleParam || undefined,
        provider: getCurrentProvider(),
      };
    storeSetJobs(prev => [job, ...prev]);
      runJob(job);
  
      router.replace('/', undefined);
    }
  }, [searchParams, runJob, router]);


  useEffect(() => {
    const completedJob = jobs.find(job => job.status === 'complete' && job.result);
    if (completedJob && completedJob.result) {
      toast({
  title: completedJob.isUpdate ? "Update Complete" : "Documentation Complete",
  description: `Successfully processed "${completedJob.result.title}". Check your library.`,
      });
    }

    const failedJob = jobs.find(job => job.status === 'failed');
    if (failedJob) {
       toast({
        title: "Scraping Failed",
        description: failedJob.error,
        variant: "destructive",
      });
    }
  }, [jobs]);

  const handleScrapeRequest = (url: string, maxPages: number, schedule: Schedule, isUpdate: boolean, updateId?: number, existingTitle?: string) => {
    const newJob: Job = {
      id: `${Date.now()}-${Math.random()}-${url}`,
      url,
      maxPages,
      status: 'scraping',
      progress: 0,
      message: 'Initializing...',
      isUpdate,
      updateId,
      schedule,
      existingTitle,
      provider: getCurrentProvider(),
    };
  storeSetJobs(prevJobs => [newJob, ...prevJobs]);
    runJob(newJob);
  };
  
  const handleConfirmUpdate = () => {
    if (!docToUpdate) return;
    const maxPagesNum = parseInt(updateMaxPages, 10);
     if (isNaN(maxPagesNum) || maxPagesNum < 1 || maxPagesNum > 50) {
      toast({
        title: "Invalid Number",
        description: "Please enter a number between 1 and 50.",
        variant: "destructive",
      });
      return;
    }
    handleScrapeRequest(docToUpdate.url, maxPagesNum, docToUpdate.schedule, true, docToUpdate.id, docToUpdate.title);
    setDocToUpdate(null);
    setUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast({ title: "Error", description: "Please enter a URL to scrape.", variant: "destructive" });
      return;
    }

    try {
      new URL(url);
    } catch (_) {
      toast({ title: "Invalid URL", description: "Please enter a valid URL.", variant: "destructive" });
      return;
    }
    
    const existingDoc = await getDocumentByUrl(url);
    if (existingDoc) {
      setDocToUpdate(existingDoc);
      setUpdateMaxPages(existingDoc.maxPages.toString());
      return;
    }

    const maxPagesNum = parseInt(maxPages, 10);
    if (isNaN(maxPagesNum) || maxPagesNum < 1 || maxPagesNum > 50) {
      toast({
        title: "Invalid Number",
        description: "Please enter a number between 1 and 50 for the maximum pages.",
        variant: "destructive",
      });
      return;
    }

    handleScrapeRequest(url, maxPagesNum, schedule, false);
    setUrl('');
  };
  
  const isScraping = jobs.some(job => job.status === 'scraping' || job.status === 'generating_hashtags');

  const handleClearHistory = () => {
  clearJobs();
    toast({
        title: "History Cleared",
        description: "All scraping tasks have been removed.",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="w-full max-w-lg mx-auto">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Globe className="w-6 h-6"/>
              AI Web Scraper
            </CardTitle>
            <CardDescription>
              Enter a starting URL to create a documentation compilation. The scraper will follow on-site links.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/docs"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxPages">Maximum Pages</Label>
                <Input
                  id="maxPages"
                  type="number"
                  placeholder="5"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  min="1"
                  max="50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule Updates</Label>
                <Select value={schedule} onValueChange={(value: Schedule) => setSchedule(value)}>
                  <SelectTrigger id="schedule">
                    <SelectValue placeholder="No schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isScraping}>
              {isScraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping in Progress...
                </>
              ) : (
                'Start Scraping'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {jobs.length > 0 && (
        <div className="w-full max-w-lg mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold tracking-tight">Scraping Tasks</h2>
                <Button variant="outline" size="sm" onClick={handleClearHistory}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                </Button>
            </div>
            <div className="space-y-2">
              {jobs.map((job) => (
                <Card key={job.id}>
                  <CardHeader className="pb-2">
                     <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base font-medium truncate" title={job.url}>{job.url}</CardTitle>
                          <CardDescription className="text-xs pt-1">{job.message}</CardDescription>
                        </div>
                         {job.status === 'complete' && <CheckCircle className="w-5 h-5 text-green-500" />}
                         {job.status === 'failed' && <XCircle className="w-5 h-5 text-destructive" />}
                         {(job.status === 'scraping' || job.status === 'generating_hashtags') && <Loader2 className="w-5 h-5 animate-spin" />}
                     </div>
                  </CardHeader>
                  <CardContent>
                     <Progress value={job.progress} className="w-full h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
        </div>
      )}
      
       <Dialog open={!!docToUpdate} onOpenChange={(isOpen) => !isOpen && setDocToUpdate(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Update Existing Document</DialogTitle>
                <DialogDescription>
                  A document with this URL already exists. Would you like to re-scrape it now? This won't affect its existing update schedule.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="space-y-2">
                  <Label htmlFor="updateMaxPages">Maximum Pages</Label>
                  <Input
                    id="updateMaxPages"
                    type="number"
                    value={updateMaxPages}
                    onChange={(e) => setUpdateMaxPages(e.target.value)}
                    min="1"
                    max="50"
                  />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setDocToUpdate(null)}>Cancel</Button>
                <Button onClick={handleConfirmUpdate}>Update Document</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
