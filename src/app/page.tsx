'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe } from "lucide-react";

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState('1');
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    // Simulate scraping process
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Scraping Initiated",
        description: `Scraping ${url} with depth ${depth}. This may take a few minutes.`,
      });
      setUrl('');
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center">
        <Card className="w-full max-w-lg">
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
                <Select value={depth} onValueChange={setDepth}>
                  <SelectTrigger id="depth" className="w-full">
                    <SelectValue placeholder="Select depth" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 level</SelectItem>
                    <SelectItem value="2">2 levels</SelectItem>
                    <SelectItem value="3">3 levels</SelectItem>
                    <SelectItem value="4">4 levels</SelectItem>
                    <SelectItem value="5">5 levels</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  The number of pages to follow from the initial URL.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
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
