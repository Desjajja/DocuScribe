'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe, History } from "lucide-react";
import { Separator } from '@/components/ui/separator';

type Document = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  image: string;
  aiHint: string;
  content: string;
};


type Job = {
  id: number;
  url: string;
  pagesToScrape: number;
  status: 'in-progress' | 'completed' | 'failed';
  progress: number;
};

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [pagesToScrape, setPagesToScrape] = useState('1');
  const [jobs, setJobs] = useState<Job[]>([]);
  const prevJobsRef = useRef<Job[]>([]);

  // Update prevJobsRef whenever jobs changes
  useEffect(() => {
    prevJobsRef.current = jobs;
  });

  // Effect for showing toast on job completion and saving data
  useEffect(() => {
    const previouslyRunningJobs = prevJobsRef.current.filter(job => job.status === 'in-progress');
    const currentlyCompletedJobs = jobs.filter(job => job.status === 'completed');

    previouslyRunningJobs.forEach(prevJob => {
      if (currentlyCompletedJobs.some(job => job.id === prevJob.id)) {
        toast({
          title: "Scraping Complete",
          description: `Finished scraping ${prevJob.pagesToScrape} page(s) from ${prevJob.url}.`,
        });

        // Save the scraped data to localStorage
        try {
            const storedDocsString = localStorage.getItem('scrapedDocuments');
            const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];
            
            const newDocs: Document[] = Array.from({ length: prevJob.pagesToScrape }, (_, i) => {
               const pageNum = i + 1;
               const pageUrl = `${prevJob.url}/${pageNum}`;
               return {
                id: Date.now() + i,
                url: pageUrl,
                title: `Scraped: ${prevJob.url.split('//')[1]?.split('/')[0] || prevJob.url} - Page ${pageNum}`,
                snippet: `Scraped content from ${pageUrl}. This is page ${pageNum} of ${prevJob.pagesToScrape} from the scraping job.`,
                image: 'https://placehold.co/600x400.png',
                aiHint: 'web document',
                content: `This is the full, simulated text content for page ${pageNum} scraped from ${pageUrl}. It includes much more detail than the snippet. Based on your scraping strategy, this represents one node in the discovered page graph. An intelligent scraper would analyze links, find neighbors like 'next' or 'previous', and use an LLM to determine relevance before adding it to the graph and scraping it. This placeholder text simulates the final result of such a process.`,
            }});

            const updatedDocs = [...newDocs, ...storedDocs];
            localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
        } catch (error) {
            console.error("Failed to save to localStorage", error);
             toast({
              title: "Storage Error",
              description: "Could not save scraped documents.",
              variant: "destructive"
            });
        }
      }
    });
  }, [jobs]);


  useEffect(() => {
    const activeJob = jobs.find(job => job.status === 'in-progress');
    let interval: NodeJS.Timeout | undefined;

    if (activeJob) {
      interval = setInterval(() => {
        setJobs(prevJobs =>
          prevJobs.map(j => {
            if (j.id === activeJob.id && j.progress < 100) {
              const newProgress = j.progress + 10;
              if (newProgress >= 100) {
                return { ...j, progress: 100, status: 'completed' };
              }
              return { ...j, progress: newProgress };
            }
            return j;
          })
        );
      }, 500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [jobs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL to scrape.",
        variant: "destructive",
      });
      return;
    }

    // A simple URL validation
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

    const newJob: Job = {
      id: Date.now(),
      url,
      pagesToScrape: parseInt(pagesToScrape, 10),
      status: 'in-progress',
      progress: 0,
    };

    setJobs(prevJobs => [newJob, ...prevJobs]);

    toast({
      title: "Scraping Initiated",
      description: `Scraping ${url} for ${pagesToScrape} page(s).`,
    });
    setUrl('');
  };

  const isScraping = jobs.some(job => job.status === 'in-progress');

  return (
    <div className="flex flex-col gap-8">
      <Card className="w-full max-w-lg mx-auto">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Globe className="w-6 h-6"/>
              Web Scraper
            </CardTitle>
            <CardDescription>
              Enter a URL and select how many pages to scrape.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pages">Pages to Scrape</Label>
              <Select value={pagesToScrape} onValueChange={setPagesToScrape}>
                <SelectTrigger id="pages" className="w-full">
                  <SelectValue placeholder="Select number of pages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Page</SelectItem>
                  <SelectItem value="2">2 Pages</SelectItem>
                  <SelectItem value="3">3 Pages</SelectItem>
                  <SelectItem value="4">4 Pages</SelectItem>
                  <SelectItem value="5">5 Pages</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Simulates finding and scraping a number of linked pages.
              </p>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Scraping History
            </CardTitle>
            <CardDescription>
              Overview of your recent scraping jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobs.map((job, index) => (
              <React.Fragment key={job.id}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-medium truncate" title={job.url}>{job.url}</p>
                    <p className="text-sm text-muted-foreground capitalize">{job.status}</p>
                  </div>
                  <Progress value={job.progress} />
                </div>
                {index < jobs.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
