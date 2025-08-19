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
};


type Job = {
  id: number;
  url: string;
  levels: number;
  status: 'in-progress' | 'completed' | 'failed';
  progress: number;
};

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [levels, setLevels] = useState('1');
  const [jobs, setJobs] = useState<Job[]>([]);
  const prevJobsRef = useRef<Job[]>([]);

  // Update prevJobsRef whenever jobs changes
  useEffect(() => {
    prevJobsRef.current = jobs;
  });

  // Effect for showing toast on job completion
  useEffect(() => {
    const previouslyRunningJobs = prevJobsRef.current.filter(job => job.status === 'in-progress');
    const currentlyCompletedJobs = jobs.filter(job => job.status === 'completed');

    previouslyRunningJobs.forEach(prevJob => {
      if (currentlyCompletedJobs.some(job => job.id === prevJob.id)) {
        toast({
          title: "Scraping Complete",
          description: `Finished scraping ${prevJob.url}.`,
        });

        // Save the scraped data to localStorage
        try {
            const storedDocsString = localStorage.getItem('scrapedDocuments');
            const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];
            const newDoc: Document = {
                id: Date.now(),
                url: prevJob.url,
                title: `Scraped: ${prevJob.url.split('//')[1]?.split('/')[0] || prevJob.url}`,
                snippet: `This is scraped content from ${prevJob.url} with a depth of ${prevJob.levels}. The content is simulated as pure text.`,
                image: 'https://placehold.co/600x400.png',
                aiHint: 'web document'
            };
            const updatedDocs = [newDoc, ...storedDocs];
            localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
        } catch (error) {
            console.error("Failed to save to localStorage", error);
             toast({
              title: "Storage Error",
              description: "Could not save scraped document.",
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
      levels: parseInt(levels, 10),
      status: 'in-progress',
      progress: 0,
    };

    setJobs(prevJobs => [newJob, ...prevJobs]);

    toast({
      title: "Scraping Initiated",
      description: `Scraping ${url} with ${levels} levels.`,
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
              Enter a URL and select the scraping depth to begin.
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
              <Label htmlFor="depth">Scraping Depth</Label>
              <Select value={levels} onValueChange={setLevels}>
                <SelectTrigger id="depth" className="w-full">
                  <SelectValue placeholder="Select levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Level</SelectItem>
                  <SelectItem value="2">2 Levels</SelectItem>
                  <SelectItem value="3">3 Levels</SelectItem>
                  <SelectItem value="4">4 Levels</SelectItem>
                  <SelectItem value="5">5 Levels</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How many links deep to follow from the initial URL.
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
