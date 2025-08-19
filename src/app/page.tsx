'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe, CheckCircle, XCircle } from "lucide-react";
import { scrapeUrl } from '@/ai/flows/scrape-url-flow';
import { generateHashtags } from '@/ai/flows/generate-hashtags-flow';

type Document = {
  id: number;
  title: string;
  url: string;
  content: string;
  image: string;
  aiHint: string;
  hashtags: string[];
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
};

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('5');
  const [jobs, setJobs] = useState<Job[]>([]);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prevJobs =>
      prevJobs.map(job => (job.id === id ? { ...job, ...updates } : job))
    );
  }, []);

  const runJob = useCallback(async (job: Job) => {
    try {
      // Step 1: Scraping
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
      
      // Step 2: Generating Hashtags
      updateJob(job.id, { status: 'generating_hashtags', progress: 75, message: 'Generating AI hashtags...' });
      const contentSample = compilation.content.substring(0, 4000);
      const hashtagResult = await generateHashtags({ content: contentSample, url: compilation.url });

      // Step 3: Storing the document
      const newDoc: Document = {
        id: Date.now(),
        url: compilation.url,
        title: compilation.title,
        content: compilation.content,
        image: 'https://placehold.co/600x400.png',
        aiHint: 'web document compilation',
        hashtags: hashtagResult.hashtags,
      };

      const storedDocsString = localStorage.getItem('scrapedDocuments');
      const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];
      const updatedDocs = [newDoc, ...storedDocs];
      localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
      window.dispatchEvent(new Event('storage'));

      updateJob(job.id, { 
        status: 'complete', 
        progress: 100, 
        message: 'Compilation complete!',
        result: newDoc 
      });

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateJob(job.id, { status: 'failed', progress: 100, message: 'Scraping failed.', error: errorMessage });
    }
  }, [updateJob]);

  useEffect(() => {
    jobs.forEach(job => {
      if (job.status === 'complete' && job.result) {
        toast({
          title: "Compilation Complete",
          description: `Successfully scraped "${job.result.title}". Check your library.`,
        });
      } else if (job.status === 'failed') {
        toast({
          title: "Scraping Failed",
          description: job.error,
          variant: "destructive",
        });
      }
    });
  }, [jobs]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL to scrape.",
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(url);
    } catch (_) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL.",
        variant: "destructive",
      });
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

    const newJob: Job = {
      id: `${Date.now()}-${url}`,
      url,
      maxPages: maxPagesNum,
      status: 'scraping',
      progress: 0,
      message: 'Initializing...',
    };

    setJobs(prevJobs => [newJob, ...prevJobs]);
    setUrl('');

    // Run the job asynchronously
    runJob(newJob);
  };
  
  const isScraping = jobs.some(job => job.status === 'scraping' || job.status === 'generating_hashtags');

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
        <div className="w-full max-w-lg mx-auto space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Scraping Tasks</h2>
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
      )}
    </div>
  );
}
