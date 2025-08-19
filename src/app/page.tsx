'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [pagesToScrape, setPagesToScrape] = useState('1');
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

    setIsScraping(true);
    toast({
      title: "Scraping Initiated",
      description: `Scraping ${url}... This may take a moment.`,
    });

    try {
      const results = await scrapeUrl({
        startUrl: url,
        maxPages: parseInt(pagesToScrape, 10),
      });

      const storedDocsString = localStorage.getItem('scrapedDocuments');
      const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];

      const newDocs: Document[] = await Promise.all(results.map(async (result, i) => {
        const hashtagResult = await generateHashtags({ content: result.content.substring(0, 1000) });
        return {
          id: Date.now() + i,
          url: result.url,
          title: result.title,
          content: result.content,
          image: 'https://placehold.co/600x400.png',
          aiHint: 'web document',
          hashtags: hashtagResult.hashtags,
        };
      }));

      const updatedDocs = [...newDocs, ...storedDocs];
      localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
      
      // This is a workaround to notify the library page of the change
      // because the 'storage' event doesn't fire for the same page that made the change.
      window.dispatchEvent(new Event('storage'));

      toast({
        title: "Scraping Complete",
        description: `Successfully scraped and saved ${results.length} page(s).`,
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
              Enter a URL and select how many relevant pages to find and scrape.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                The AI will try to find and scrape this many relevant pages.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isScraping}>
              {isScraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
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
