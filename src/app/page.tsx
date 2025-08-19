'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const [scrapingMode, setScrapingMode] = useState<'aggregate' | 'separate'>('separate');
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
      description: `Scraping ${url}... This may take a moment.`,
    });

    try {
      const results = await scrapeUrl({
        startUrl: url,
        maxPages: maxPagesNum,
        mode: scrapingMode,
      });

      const storedDocsString = localStorage.getItem('scrapedDocuments');
      const storedDocs: Document[] = storedDocsString ? JSON.parse(storedDocsString) : [];

      const newDocs: Document[] = await Promise.all(results.map(async (result, i) => {
        // Limit content sent for hashtag generation to avoid being too verbose
        const contentSample = result.content.substring(0, 2000);
        const hashtagResult = await generateHashtags({ content: contentSample });
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
        description: `Successfully processed ${results.length} page(s). Check your library.`,
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
              Enter a URL and choose how to scrape the content. The scraper will follow on-site links.
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
            </div>
             <div className="space-y-3">
               <Label>Scraping Mode</Label>
               <RadioGroup value={scrapingMode} onValueChange={(value) => setScrapingMode(value as 'aggregate' | 'separate')} className="flex gap-4">
                  <div>
                    <RadioGroupItem value="separate" id="separate" className="peer sr-only" />
                    <Label htmlFor="separate" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Separate Docs
                    </Label>
                  </div>
                   <div>
                    <RadioGroupItem value="aggregate" id="aggregate" className="peer sr-only" />
                    <Label htmlFor="aggregate" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Aggregate Doc
                    </Label>
                  </div>
               </RadioGroup>
                <p className="text-sm text-muted-foreground">
                    {scrapingMode === 'separate' 
                        ? "Create a separate library document for each page found." 
                        : "Combine content from all found pages into a single document."}
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
