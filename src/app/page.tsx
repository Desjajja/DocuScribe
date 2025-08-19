'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe } from "lucide-react";
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

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('5');
  const [isScraping, setIsScraping] = useState(false);

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

    setIsScraping(true);
    toast({
      title: "Scraping Initiated",
      description: `Building compilation for ${url}... This may take a moment.`,
    });

    try {
      // The scrapeUrl flow now always aggregates content.
      const results = await scrapeUrl({
        startUrl: url,
        maxPages: maxPagesNum,
      });

      if (results.length === 0) {
        toast({
          title: "Scraping Complete",
          description: `Could not find any content at the specified URL.`,
        });
        return;
      }
      
      const compilation = results[0];

      const storedDocsString = localStorage.getItem('scrapedDocuments');
      const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];

      // Generate hashtags from the aggregated content.
      const contentSample = compilation.content.substring(0, 4000);
      const hashtagResult = await generateHashtags({ content: contentSample, url: compilation.url });

      const newDoc: Document = {
        id: Date.now(),
        url: compilation.url,
        title: compilation.title,
        content: compilation.content,
        image: 'https://placehold.co/600x400.png',
        aiHint: 'web document compilation',
        hashtags: hashtagResult.hashtags,
      };

      const updatedDocs = [newDoc, ...storedDocs];
      localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
      
      // Notify the library page of the change.
      window.dispatchEvent(new Event('storage'));

      toast({
        title: "Compilation Complete",
        description: `Successfully created a new compilation. Check your library.`,
      });
      setUrl('');
    } catch (error) {
      console.error("Scraping failed:", error);
      toast({
        title: "Scraping Failed",
        description: "An error occurred during the scraping process.",
        variant: "destructive",
      });
    } finally {
      setIsScraping(false);
    }
  };

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
                  Building Compilation...
                </>
              ) : (
                'Start Scraping'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
