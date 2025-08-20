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
};

type Job = {
  id: string;
  url: string;
  maxPages: number;
  status: 'scraping' | 'generating_hashtags' | 'complete' | 'failed';
  progress: number;
  message: string;
  result?: Document;
  error?: string;
  isUpdate: boolean;
  updateId?: number;
  schedule: Schedule;
};

export default function ScraperPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('5');
  const [schedule, setSchedule] = useState<Schedule>('none');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [docToUpdate, setDocToUpdate] = useState<Document | null>(null);
  const [updateMaxPages, setUpdateMaxPages] = useState('5');
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const processedUrlParams = useRef(false);

  useEffect(() => {
    try {
      const storedDocsString = localStorage.getItem('scrapedDocuments');
      if (storedDocsString) {
        setDocuments(JSON.parse(storedDocsString));
      }
    } catch (error) {
      console.error("Failed to load documents from localStorage", error);
    }
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prevJobs =>
      prevJobs.map(job => (job.id === id ? { ...job, ...updates } : job))
    );
  }, []);

  const runJob = useCallback(async (job: Job) => {
    try {
      updateJob(job.id, { status: 'scraping', progress: 10, message: 'Fetching and parsing content...' });
      
      const results = await scrapeUrl({
        startUrl: job.url,
        maxPages: job.maxPages,
      });

      if (results.length === 0) {
        throw new Error("Could not find any content at the specified URL.");
      }
      
      const compilation = results[0];
      updateJob(job.id, { status: 'scraping', progress: 50, message: 'Content parsed successfully.' });
      
      updateJob(job.id, { status: 'generating_hashtags', progress: 75, message: 'Generating AI hashtags...' });
      const contentSample = compilation.content.substring(0, 4000);
      const hashtagResult = await generateHashtags({ content: contentSample, url: compilation.url });

      const docData = {
        url: compilation.url,
        title: compilation.title,
        content: compilation.content,
        image: compilation.image || 'https://placehold.co/600x400.png',
        aiHint: 'web document compilation',
        hashtags: hashtagResult.hashtags,
        lastUpdated: new Date().toISOString(),
        schedule: job.schedule,
      };

      const storedDocsString = localStorage.getItem('scrapedDocuments');
      const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];
      let updatedDocs: Document[];
      let finalDoc: Document;

      if (job.isUpdate && job.updateId) {
        const existingDoc = storedDocs.find(d => d.id === job.updateId);
        finalDoc = { ...docData, id: job.updateId, schedule: existingDoc?.schedule ?? 'none' }; // Retain existing schedule on manual update
        updatedDocs = storedDocs.map(d => d.id === job.updateId ? finalDoc : d);
      } else {
        finalDoc = { ...docData, id: Date.now() };
        updatedDocs = [finalDoc, ...storedDocs];
      }
      
      localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
      window.dispatchEvent(new Event('storage'));

      updateJob(job.id, { 
        status: 'complete', 
        progress: 100, 
        message: job.isUpdate ? 'Update complete!' : 'Compilation complete!',
        result: finalDoc
      });

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateJob(job.id, { status: 'failed', progress: 100, message: 'Scraping failed.', error: errorMessage });
    }
  }, [updateJob]);

  useEffect(() => {
    const updateUrl = searchParams.get('updateUrl');
    const updateId = searchParams.get('updateId');
    const maxPagesParam = searchParams.get('maxPages');

    if (updateUrl && updateId && maxPagesParam && !processedUrlParams.current) {
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
        schedule: 'none', // Manual updates don't set a schedule
      };
      setJobs(prev => [job, ...prev]);
      runJob(job);
      
      router.replace('/', undefined);
    }
    
    if (!updateUrl && !updateId && !maxPagesParam) {
        processedUrlParams.current = false;
    }
    
  }, [searchParams, runJob, router]);

  useEffect(() => {
    const completedJob = jobs.find(job => job.status === 'complete' && job.result);
    if (completedJob && completedJob.result) {
      toast({
        title: completedJob.isUpdate ? "Update Complete" : "Compilation Complete",
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

  const handleScrapeRequest = (url: string, maxPages: number, schedule: Schedule, isUpdate: boolean, updateId?: number) => {
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
    };
    setJobs(prevJobs => [newJob, ...prevJobs]);
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
    handleScrapeRequest(docToUpdate.url, maxPagesNum, docToUpdate.schedule, true, docToUpdate.id);
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
    
    const existingDoc = documents.find(doc => doc.url === url);
    if (existingDoc) {
      setDocToUpdate(existingDoc);
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
    setJobs([]);
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
